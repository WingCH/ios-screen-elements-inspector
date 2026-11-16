import {
  Alert, BottomSheet, Button, Form, Host, List, NavigationSplitView,
  NavigationStack, Picker, ProgressView, Section, ShareLink, Text, Toolbar,
  ToolbarItem, useNativeState, VStack,
} from "@expo/ui/swift-ui";
import type { NavigationSplitViewColumn } from "@expo/ui/swift-ui";
import {
  buttonStyle, disabled, font, navigationTitle, pickerStyle, searchable, tag,
} from "@expo/ui/swift-ui/modifiers";
import { useEffect, useMemo, useState } from "react";
import { actions, exit } from "@swipt/api/swiplet";

import type extension from "./extension";
import type { CaptureSummary, OpenCapture } from "./model";
import { allElements, plainOCR, summarize, textReport } from "./model";
import {
  ElementDetails, ElementResults, Fields, ObservationError, OCRPanel,
  ScreenshotPanel, secondary, selectable,
} from "./InspectionViews";

const inspector = actions<typeof extension>();
type Tab = "elements" | "ocr" | "device" | "report";
const date = (time: number) => new Date(time).toLocaleString();
const counts = (entry: CaptureSummary) => [
  entry.elementCount === null ? "元素未取得" : entry.elementCount + " 個元素",
  entry.textLineCount === null ? "文字未取得" : entry.textLineCount + " 行文字",
].join(" · ");

export default function App() {
  const [opened, setOpened] = useState<OpenCapture | null>(null);
  const [history, setHistory] = useState<CaptureSummary[]>([]);
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("elements");
  const [query, setQuery] = useState("");
  const searchText = useNativeState("");
  const [compact, setCompact] = useState<NavigationSplitViewColumn>("sidebar");
  const [capturing, setCapturing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [status, setStatus] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const elements = useMemo(() => opened?.record.accessibility.status === "ok"
    ? allElements(opened.record.accessibility.data) : [], [opened]);
  const selected = elements.find((element) => element.id === selectedID);
  const report = useMemo(() => opened ? textReport(opened.record) : "", [opened]);
  const summary = opened ? summarize(opened.record) : null;

  const reportError = (error: unknown) => setStatus("操作失敗：" + String(error));
  const accept = (next: OpenCapture) => {
    setOpened(next);
    setSelectedID(null);
    setSelectedText(null);
    setQuery("");
    searchText.value = "";
    setTab("elements");
  };
  useEffect(() => {
    inspector.history().then(async (entries) => {
      setHistory(entries);
      if (entries[0]) accept(await inspector.open({ id: entries[0].id }));
    }).catch(reportError);
  }, []);

  useEffect(() => {
    if (!capturing) return;
    const deadline = Date.now() + 5_000;
    const timer = setInterval(() => {
      setCountdown(Math.max(0, Math.ceil((deadline - Date.now()) / 1_000)));
    }, 250);
    return () => clearInterval(timer);
  }, [capturing]);

  const capture = async () => {
    setCapturing(true);
    setCountdown(5);
    setStatus("請切換到目標 App，擷取後返回這裡。");
    try {
      const next = await inspector.capture();
      accept(next);
      setHistory(await inspector.history());
      setCompact("sidebar");
      const result = summarize(next.record);
      setStatus(result.overlayIssue
        ? "已儲存紀錄；元素來源與截圖無法對應，預覽改用 OCR 文字框。"
        : result.complete ? "擷取完成" : "已儲存可取得的資料；部分項目讀取失敗。");
    } catch (error) {
      reportError(error);
    } finally {
      setCapturing(false);
      setCountdown(0);
    }
  };

  const copy = (text: string) => {
    inspector.copy({ text }).then(() => setStatus("已複製，可貼上到 AI 或其他 App。"), reportError);
  };
  const selectElement = (id: string) => {
    setSelectedID(id);
    setSelectedText(null);
    setTab("elements");
    setCompact("detail");
  };
  const selectText = (index: number) => {
    setSelectedText(index);
    setSelectedID(null);
    setTab("ocr");
    setCompact("detail");
  };
  const openHistory = async (id: string) => {
    try {
      accept(await inspector.open({ id }));
      setShowHistory(false);
      setCompact("sidebar");
      setStatus("");
    } catch (error) { reportError(error); }
  };
  const deleteRecord = async () => {
    if (deleting === null) return;
    const id = deleting;
    setDeleting(null);
    try {
      setHistory(await inspector.remove({ id }));
      if (opened?.record.id === id) {
        setOpened(null);
        setSelectedID(null);
      }
      setStatus("已刪除紀錄");
    } catch (error) { reportError(error); }
  };

  return <Host style={{ flex: 1 }}>
    <NavigationSplitView preferredCompactColumn={compact} onPreferredCompactColumnChange={setCompact}>
      <NavigationSplitView.Sidebar>
        <Toolbar modifiers={[navigationTitle("畫面檢查器")]}>
          <Form>
            <Section>
              <Text modifiers={[font({ textStyle: "title2", weight: "bold" })]}>看清程式讀到的畫面</Text>
              <Text modifiers={[secondary]}>擷取截圖、元素、辨識文字與裝置資料，再逐項檢查。</Text>
              <Button label={capturing ? (countdown > 0 ? countdown + " 秒後擷取" : "正在擷取…") : "擷取目前畫面"}
                systemImage="camera.viewfinder" onPress={capture}
                modifiers={[buttonStyle("borderedProminent"), disabled(capturing)]} />
              {capturing ? <ProgressView /> : null}
              {status ? <Text modifiers={[selectable]}>{status}</Text> : null}
            </Section>
            {opened && summary ? <>
              <Section title="本次紀錄">
                <Text modifiers={[font({ textStyle: "headline" }), selectable]}>
                  {summary.app ?? "未取得 App 識別"}
                </Text>
                <Text modifiers={[secondary]}>{date(summary.startedAt)}</Text>
                <Text>{counts(summary)}</Text>
                <Button label="查看全部資料" systemImage="list.bullet.rectangle"
                  onPress={() => setCompact("detail")} />
                <Button label="複製完整報告" systemImage="doc.on.doc" onPress={() => copy(report)} />
              </Section>
              <ScreenshotPanel key={opened.record.id} opened={opened}
                selectedID={selectedID} selectedText={selectedText}
                onSelect={selectElement} onSelectText={selectText} />
              <Section footer={<Text>截圖與元素依序讀取；若畫面正在移動，框線位置可能不同。</Text>}>
                <Text modifiers={[secondary]}>所有紀錄只儲存在本機；你可以在「紀錄」逐筆刪除。</Text>
              </Section>
            </> : <Section title="開始檢查">
              <Text>按擷取後，在 5 秒內切換到目標 App。完成後返回這裡查看結果。</Text>
            </Section>}
          </Form>
          <Toolbar.Content>
            <ToolbarItem placement="topBarLeading"><Button label="返回" onPress={exit} /></ToolbarItem>
            <ToolbarItem placement="primaryAction">
              <Button label="紀錄" systemImage="clock.arrow.circlepath" onPress={() => setShowHistory(true)}
                modifiers={[disabled(capturing)]} />
            </ToolbarItem>
          </Toolbar.Content>
        </Toolbar>
      </NavigationSplitView.Sidebar>
      <NavigationSplitView.Detail>
        <Toolbar modifiers={[navigationTitle("檢查資料")]}>
          <Form modifiers={tab === "elements" ? [
            searchable(searchText, { onChange: setQuery, prompt: "搜尋文字、identifier 或 role" }),
          ] : []}>
            {opened ? <>
              <Section>
                <Picker<Tab> label="資料類別" selection={tab} onSelectionChange={setTab}
                  modifiers={[pickerStyle("segmented")]}>
                  <Text modifiers={[tag("elements")]}>元素</Text>
                  <Text modifiers={[tag("ocr")]}>文字</Text>
                  <Text modifiers={[tag("device")]}>裝置</Text>
                  <Text modifiers={[tag("report")]}>原始</Text>
                </Picker>
                {status ? <Text modifiers={[selectable]}>{status}</Text> : null}
              </Section>
              {tab === "elements" ? <>
                {selected ? <ElementDetails element={selected} onCopy={copy} /> : <Section>
                  <Text modifiers={[secondary]}>從截圖或元素樹選取一個元素，查看完整欄位。</Text>
                </Section>}
                <ElementResults record={opened.record} query={query} selectedID={selectedID}
                  onSelect={selectElement} />
              </> : null}
              {tab === "ocr" ? <>
                <Section><Button label="複製全部辨識文字" systemImage="doc.on.doc"
                  onPress={() => copy(plainOCR(opened.record))} /></Section>
                <OCRPanel record={opened.record} selectedIndex={selectedText} onCopy={copy} />
              </> : null}
              {tab === "device" ? <DevicePanel opened={opened} onCopy={copy} /> : null}
              {tab === "report" ? <Section title="完整資料">
                <Button label="複製完整報告" systemImage="doc.on.doc" onPress={() => copy(report)} />
                <Button label="只複製 JSON" onPress={() => copy(JSON.stringify(opened.record, null, 2))} />
                <Text modifiers={[selectable, font({ textStyle: "caption", design: "monospaced" })]}>{report}</Text>
              </Section> : null}
            </> : <Section><Text>擷取畫面或從紀錄選取一份資料。</Text></Section>}
          </Form>
          <Toolbar.Content>
            {opened ? <ToolbarItem placement="primaryAction">
              <ShareLink item={report} subject="畫面元素檢查報告"><Text>分享報告</Text></ShareLink>
            </ToolbarItem> : null}
          </Toolbar.Content>
        </Toolbar>
      </NavigationSplitView.Detail>
    </NavigationSplitView>
    <BottomSheet isPresented={showHistory} onIsPresentedChange={setShowHistory}>
      <NavigationStack>
        <Alert title="刪除此擷取紀錄？" isPresented={deleting !== null}
          onIsPresentedChange={(visible) => { if (!visible) setDeleting(null); }}>
        <Alert.Trigger>
        <Toolbar modifiers={[navigationTitle("擷取紀錄")]}>
          <List>
            {history.length === 0 ? <Text>還沒有擷取紀錄。</Text> : null}
            {history.map((entry) => <Section key={entry.id}>
              <Button onPress={() => openHistory(entry.id)}>
                <VStack alignment="leading" spacing={4}>
                  <Text modifiers={[font({ textStyle: "headline" })]}>{entry.app ?? "未取得 App 識別"}</Text>
                  <Text modifiers={[secondary]}>{date(entry.startedAt)}</Text>
                  <Text>{counts(entry) + " · " + (entry.overlayIssue ? "來源待核對" : entry.complete ? "完整" : "部分資料")}</Text>
                </VStack>
              </Button>
              <Button label="刪除此紀錄" role="destructive" onPress={() => setDeleting(entry.id)} />
            </Section>)}
          </List>
          <Toolbar.Content><ToolbarItem placement="confirmationAction">
            <Button label="完成" onPress={() => setShowHistory(false)} />
          </ToolbarItem></Toolbar.Content>
        </Toolbar>
        </Alert.Trigger>
          <Alert.Actions>
            <Button label="取消" role="cancel" onPress={() => setDeleting(null)} />
            <Button label="刪除" role="destructive" onPress={deleteRecord} />
          </Alert.Actions>
          <Alert.Message><Text>這份紀錄的截圖與資料會從本機刪除。</Text></Alert.Message>
        </Alert>
      </NavigationStack>
    </BottomSheet>
  </Host>;
}

function DevicePanel({ opened, onCopy }: { opened: OpenCapture; onCopy: (text: string) => void }) {
  const { record } = opened;
  return <>
    <Section title="前景 App">
      {record.foreground ? <>
        <ObservationError observation={record.foreground} />
        {record.foreground.status === "ok" ? <Text modifiers={[selectable]}>{record.foreground.data}</Text> : null}
      </> : <Text>這份舊紀錄未另外讀取前景 App。</Text>}
    </Section>
    <Section title="裝置資料">
      <ObservationError observation={record.device} />
      {record.device.status === "ok" ? <>
        <Button label="複製裝置資料" onPress={() => onCopy(JSON.stringify(record.device, null, 2))} />
        <Fields value={{
          name: record.device.data.name, model: record.device.data.model,
          os: record.device.data.os, build: record.device.data.build, language: record.device.data.language,
        }} />
      </> : null}
    </Section>
    {record.device.status === "ok" ? <Section title="螢幕"><Fields value={record.device.data.screen} /></Section> : null}
    <Section title="截圖資訊">
      <ObservationError observation={record.screenshot} />
      {record.screenshot.status === "ok" ? <Fields value={record.screenshot.data} /> : null}
    </Section>
    <Section title="元素來源">
      <ObservationError observation={record.accessibility} />
      {record.accessibility.status === "ok" ? <Fields value={{
        app: record.accessibility.data.app, time: record.accessibility.data.time,
        truncated: record.accessibility.data.truncated ?? "來源未提供",
      }} /> : null}
    </Section>
    <Section title="擷取時間">
      <Fields value={{ startedAt: record.startedAt, finishedAt: record.finishedAt }} />
      <Text modifiers={[secondary]}>各項資料的開始、完成時間保留在完整報告；這些資料不是同一瞬間取得。</Text>
    </Section>
  </>;
}
