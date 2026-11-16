import {
  Button, DisclosureGroup, HStack, Image, LabeledContent, Rectangle,
  Picker, Section, Text, Toggle, VStack, ZStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel, aspectRatio, border, contentShape, font, foregroundStyle,
  frame, lineLimit, offset, onGeometryChange, onTapGesture, pickerStyle, resizable, shapes, tag, textSelection,
} from "@expo/ui/swift-ui/modifiers";
import { useState } from "react";
import type { CaptureRecord, ElementInfo, Observation, OpenCapture } from "./model";
import { accessibilityBoxes, allElements, containsMatch, elementTitle, matchesElement, ocrBoxes, recordOverlayIssue } from "./model";

export const secondary = foregroundStyle({ type: "hierarchical", style: "secondary" });
export const selectable = textSelection(true);
const codeFont = font({ textStyle: "caption", design: "monospaced" });

export function ObservationError({ observation }: { observation: Observation<unknown> }) {
  switch (observation.status) {
    case "ok": return null;
    case "error": return <Text modifiers={[selectable]}>
      {"讀取失敗 · " + observation.error.name + "\n" + observation.error.message}
    </Text>;
    case "skipped": return <Text modifiers={[secondary]}>{observation.reason}</Text>;
  }
}

export function Fields({ value }: { value: object }) {
  return <>{Object.entries(value).map(([key, field]) => (
    <LabeledContent key={key} label={key}>
      <Text modifiers={[selectable, codeFont]}>
        {typeof field === "string" ? (field === "" ? '""' : field) : JSON.stringify(field)}
      </Text>
    </LabeledContent>
  ))}</>;
}

function OverlayBox({ id, bounds, selected, label, onSelect }: {
  id: string; bounds: number[];
  selected: boolean; label: string; onSelect: (id: string) => void;
}) {
  const [x, y, width, height] = bounds;
  return <Rectangle modifiers={[
    foregroundStyle("clear"),
    frame({ width, height }),
    border({ content: selected ? "orange" : "blue", width: selected ? 3 : 1 }),
    contentShape(shapes.rectangle()),
    accessibilityLabel(label),
    onTapGesture(() => onSelect(id)),
    offset({ x, y }),
  ]} />;
}

export function ScreenshotPanel({ opened, selectedID, selectedText, onSelect, onSelectText }: {
  opened: OpenCapture; selectedID: string | null; selectedText: number | null;
  onSelect: (id: string) => void; onSelectText: (index: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const [showFrames, setShowFrames] = useState(true);
  const [chosenSource, setChosenSource] = useState<"accessibility" | "ocr" | null>(null);
  const { record, screenshotURI } = opened;
  const shot = record.screenshot.status === "ok" ? record.screenshot.data : null;
  const issue = recordOverlayIssue(record);
  const source = chosenSource ?? (issue === null ? "accessibility" : "ocr");
  const boxes = shot !== null && record.accessibility.status === "ok"
    ? accessibilityBoxes(record.accessibility.data, shot, width, selectedID,
        record.foreground?.status === "ok" ? record.foreground.data : null)
    : [];
  const textBoxes = ocrBoxes(record, width);

  return <Section title="畫面">
    <ObservationError observation={record.screenshot} />
    {issue ? <Text modifiers={[selectable]}>
      {issue + " 原始元素仍可在「元素」與「原始」查看。"}
    </Text> : null}
    <Picker<"accessibility" | "ocr"> label="框線來源" selection={source}
      onSelectionChange={setChosenSource} modifiers={[pickerStyle("segmented")]}>
      <Text modifiers={[tag("accessibility")]}>可存取元素</Text>
      <Text modifiers={[tag("ocr")]}>文字辨識 OCR</Text>
    </Picker>
    {source === "ocr" ? <ObservationError observation={record.ocr} /> : null}
    {source === "accessibility" && selectedID?.startsWith("system") ? <Text modifiers={[secondary]}>
      選取的是系統視窗資料，未確認它屬於這張截圖；請在元素詳情查看，預覽不疊加系統視窗。
    </Text> : null}
    {shot && screenshotURI ? (
      <VStack alignment="leading" spacing={12} modifiers={[
        frame({ maxWidth: Infinity }),
        onGeometryChange((geometry) => setWidth(geometry.width)),
      ]}>
        {width > 0 && shot.frame[2] > 0 && shot.frame[3] > 0 ? (
          <ZStack alignment="topLeading" modifiers={[
            frame({ width, height: width * shot.frame[3] / shot.frame[2] }),
          ]}>
            <Image uiImage={screenshotURI} modifiers={[
              resizable(),
              aspectRatio({ ratio: shot.frame[2] / shot.frame[3], contentMode: "fit" }),
              frame({ width, height: width * shot.frame[3] / shot.frame[2] }),
              accessibilityLabel("擷取的原始畫面"),
            ]} />
            {source === "accessibility" ? boxes.filter(({ element }) => showFrames || element.id === selectedID)
              .map(({ element, projected }) => (
                <OverlayBox key={element.id} id={element.id} bounds={projected}
                  selected={element.id === selectedID}
                  label={element.role + " · " + elementTitle(element)}
                  onSelect={onSelect} />
              )) : textBoxes.filter(({ index }) => showFrames || index === selectedText)
              .map(({ index, projected }) => (
                <OverlayBox key={"ocr." + index} id={"ocr." + index} bounds={projected}
                  selected={index === selectedText}
                  label={"OCR 第 " + (index + 1) + " 行"}
                  onSelect={() => onSelectText(index)} />
              ))}
          </ZStack>
        ) : <Text>正在調整預覽大小…</Text>}
        <Toggle label="顯示框線" isOn={showFrames} onIsOnChange={setShowFrames} />
        <Text modifiers={[font({ textStyle: "caption" }), secondary]}>
          {source === "ocr"
            ? "目前顯示本次截圖的 OCR 文字框，點選查看辨識文字。"
            : "目前顯示 App 的文字與控制項；系統視窗及完整層級可在「元素」查看。"}
        </Text>
        <Text modifiers={[codeFont, secondary, selectable]}>
          {"截圖 " + shot.width + " × " + shot.height + " pt · scale " + shot.scale}
        </Text>
      </VStack>
    ) : null}
  </Section>;
}

export function ElementBranch({ element, query, selectedID, onSelect }: {
  element: ElementInfo; query: string; selectedID: string | null;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(element.id === "root" || element.id === "system");
  if (!containsMatch(element, query)) return null;
  const label = <Button onPress={() => onSelect(element.id)}>
    <VStack alignment="leading" spacing={3}>
      <Text modifiers={[font({ textStyle: "body", weight: element.id === selectedID ? "bold" : "regular" }), lineLimit(2)]}>
        {(element.id === selectedID ? "✓ " : "") + elementTitle(element)}
      </Text>
      <Text modifiers={[codeFont, secondary, lineLimit(1)]}>
        {element.role + " · " + element.id}
      </Text>
    </VStack>
  </Button>;
  if (element.children.length === 0) return label;
  const open = query.trim() !== "" || expanded;
  return <DisclosureGroup isExpanded={open} onIsExpandedChange={setExpanded}>
    <DisclosureGroup.Label>{label}</DisclosureGroup.Label>
    {open ? element.children.map((child) => (
      <ElementBranch key={child.id} element={child} query={query}
        selectedID={selectedID} onSelect={onSelect} />
    )) : null}
  </DisclosureGroup>;
}

export function ElementDetails({ element, onCopy }: {
  element: ElementInfo; onCopy: (text: string) => void;
}) {
  const { children, ...fields } = element;
  return <Section title="選取元素">
    <Text modifiers={[font({ textStyle: "headline" }), selectable]}>{elementTitle(element)}</Text>
    <Button label="複製此元素 JSON" systemImage="doc.on.doc"
      onPress={() => onCopy(JSON.stringify(element, null, 2))} />
    <Fields value={fields} />
    <LabeledContent label="children"><Text>{children.length}</Text></LabeledContent>
  </Section>;
}

export function OCRPanel({ record, selectedIndex, onCopy }: {
  record: CaptureRecord; selectedIndex: number | null; onCopy: (text: string) => void;
}) {
  const selectedLine = record.ocr.status === "ok" && selectedIndex !== null
    ? record.ocr.data[selectedIndex]
    : undefined;
  return <>
    {selectedLine ? <Section title={"選取文字 · 第 " + (selectedIndex! + 1) + " 行"}>
      <Text modifiers={[selectable, font({ textStyle: "headline" })]}>{selectedLine.text}</Text>
      <Button label="複製選取文字" onPress={() => onCopy(selectedLine.text)} />
      <Button label="複製選取文字資料" onPress={() => onCopy(JSON.stringify(selectedLine, null, 2))} />
      <Fields value={selectedLine} />
    </Section> : null}
    <Section title="圖片辨識文字">
      <Text modifiers={[secondary]}>文字來自本次截圖，位置及信心值保留在每行資料中。</Text>
      <ObservationError observation={record.ocr} />
      {record.ocr.status === "ok" && record.ocr.data.length === 0 ? <Text>未辨識到文字。</Text> : null}
    </Section>
    {record.ocr.status === "ok" ? record.ocr.data.map((line, index) => (
      <Section key={index} title={"第 " + (index + 1) + " 行"}>
        <Text modifiers={[selectable]}>{line.text}</Text>
        <HStack>
          <Button label="複製文字" onPress={() => onCopy(line.text)} />
          <Button label="複製資料" onPress={() => onCopy(JSON.stringify(line, null, 2))} />
        </HStack>
        <Fields value={{
          confidence: line.confidence, frame: line.frame, center: line.center,
          quad: line.quad, candidates: line.candidates,
        }} />
      </Section>
    )) : null}
  </>;
}

export function ElementResults({ record, query, selectedID, onSelect }: {
  record: CaptureRecord; query: string; selectedID: string | null;
  onSelect: (id: string) => void;
}) {
  const snapshot = record.accessibility.status === "ok" ? record.accessibility.data : null;
  const matches = snapshot ? allElements(snapshot).filter((element) => matchesElement(element, query)) : [];
  return <Section title={snapshot === null ? "元素未取得" : "元素 · " + matches.length}>
    <ObservationError observation={record.accessibility} />
    {snapshot ? <>
      {snapshot.truncated ? <Text>來源已截短元素樹，這份資料未包含所有元素。</Text> : null}
      {query.trim() !== "" && matches.length === 0 ? <Text>沒有符合的元素。</Text> : null}
      <ElementBranch element={snapshot.root} query={query} selectedID={selectedID} onSelect={onSelect} />
      {snapshot.system ? <ElementBranch element={snapshot.system} query={query} selectedID={selectedID} onSelect={onSelect} /> : null}
    </> : null}
  </Section>;
}
