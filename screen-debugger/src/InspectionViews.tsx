import {
  Button, DisclosureGroup, HStack, Image, LabeledContent, Rectangle,
  Section, Text, Toggle, VStack, ZStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel, aspectRatio, border, contentShape, font, foregroundStyle,
  frame, lineLimit, offset, onGeometryChange, onTapGesture, resizable, shapes, textSelection,
} from "@expo/ui/swift-ui/modifiers";
import { useState } from "react";
import type { CaptureRecord, ElementInfo, Observation, OpenCapture } from "./model";
import { allElements, containsMatch, elementTitle, imageRect, matchesElement } from "./model";

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

export function ScreenshotPanel({ opened, selectedID, onSelect }: {
  opened: OpenCapture; selectedID: string | null; onSelect: (id: string) => void;
}) {
  const [width, setWidth] = useState(0);
  const [showFrames, setShowFrames] = useState(true);
  const { record, screenshotURI } = opened;
  const shot = record.screenshot.status === "ok" ? record.screenshot.data : null;
  const elements = record.accessibility.status === "ok"
    ? allElements(record.accessibility.data)
    : [];
  const boxes = shot === null ? [] : elements
    .filter((element) => element.frame && !element.offScreen && (
      element.id === selectedID || element.children.length === 0 ||
      element.role === "button" || element.traits.includes("button")
    ))
    .flatMap((element) => {
      const projected = imageRect(element.frame!, shot, width);
      return projected ? [{ element, projected }] : [];
    })
    .sort((a, b) => b.projected[2] * b.projected[3] - a.projected[2] * a.projected[3]);

  return <Section title="畫面">
    <ObservationError observation={record.screenshot} />
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
            {boxes.filter(({ element }) => showFrames || element.id === selectedID)
              .map(({ element, projected }) => (
                <OverlayBox key={element.id} id={element.id} bounds={projected}
                  selected={element.id === selectedID}
                  label={element.role + " · " + elementTitle(element)}
                  onSelect={onSelect} />
              ))}
          </ZStack>
        ) : <Text>正在調整預覽大小…</Text>}
        <Toggle label="顯示元素框" isOn={showFrames} onIsOnChange={setShowFrames} />
        <Text modifiers={[font({ textStyle: "caption" }), secondary]}>
          點選框線查看元素。框線顯示末層與按鈕；完整層級見「元素」。
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

export function OCRPanel({ record, onCopy }: {
  record: CaptureRecord; onCopy: (text: string) => void;
}) {
  return <>
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
