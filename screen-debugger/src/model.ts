/** Screen points serialized as [x, y, width, height]. */
export type Rect = number[];
/** Screen points serialized as [x, y]. */
export type Point = number[];

export interface ElementInfo {
  id: string;
  role: string;
  class?: string;
  traits: string[];
  label?: string;
  value?: string;
  identifier?: string;
  placeholder?: string;
  hint?: string;
  url?: string;
  frame?: Rect;
  point?: Point;
  partial?: true;
  offScreen?: true;
  inert?: true;
  remote?: true;
  disabled?: true;
  focused?: true;
  selected?: true;
  expanded?: boolean;
  secure?: true;
  selection?: number[];
  actions?: string[];
  truncated?: true;
  children: ElementInfo[];
}

export interface ElementSnapshot {
  app: string;
  time: number;
  truncated?: true;
  root: ElementInfo;
  system?: ElementInfo;
}

export interface DeviceDetails {
  name: string;
  model: string;
  os: string;
  build: string;
  language: string;
  screen: {
    width: number;
    height: number;
    scale: number;
    orientation: "portrait" | "portraitUpsideDown" | "landscape";
  };
}

export interface ScreenshotInfo {
  file: string;
  width: number;
  height: number;
  scale: number;
  frame: Rect;
  time: number | null;
  timestamp: number | null;
}

export interface TextCandidate {
  text: string;
  confidence: number;
}

export interface TextLine extends TextCandidate {
  frame: Rect;
  center: Point;
  quad: Point[];
  candidates: TextCandidate[];
}

interface ObservationTimes {
  startedAt: number;
  finishedAt: number;
}

export type Observation<T> = ObservationTimes & (
  | { status: "ok"; data: T }
  | { status: "error"; error: { name: string; message: string } }
  | { status: "skipped"; reason: string }
);

export interface CaptureRecord {
  schemaVersion: 1;
  id: string;
  startedAt: number;
  finishedAt: number;
  device: Observation<DeviceDetails>;
  screenshot: Observation<ScreenshotInfo>;
  accessibility: Observation<ElementSnapshot>;
  ocr: Observation<TextLine[]>;
}

export interface CaptureSummary {
  id: string;
  startedAt: number;
  app: string | null;
  elementCount: number | null;
  textLineCount: number | null;
  complete: boolean;
}

export interface OpenCapture {
  record: CaptureRecord;
  screenshotURI: string | null;
}

export function allElements(snapshot: ElementSnapshot): ElementInfo[] {
  const walk = (node: ElementInfo): ElementInfo[] => [
    node,
    ...node.children.flatMap(walk),
  ];
  return [
    ...walk(snapshot.root),
    ...(snapshot.system ? walk(snapshot.system) : []),
  ];
}

export function summarize(record: CaptureRecord): CaptureSummary {
  return {
    id: record.id,
    startedAt: record.startedAt,
    app: record.accessibility.status === "ok" ? record.accessibility.data.app : null,
    elementCount: record.accessibility.status === "ok"
      ? allElements(record.accessibility.data).length
      : null,
    textLineCount: record.ocr.status === "ok" ? record.ocr.data.length : null,
    complete: [record.device, record.screenshot, record.accessibility, record.ocr]
      .every((part) => part.status === "ok"),
  };
}

export function elementTitle(element: ElementInfo): string {
  return element.label || element.identifier || element.value || element.class || element.role;
}

export function matchesElement(element: ElementInfo, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  return needle === "" || [
    element.id, element.role, element.class, element.label, element.value,
    element.identifier, element.placeholder, element.hint, ...element.traits,
  ].some((value) => value?.toLocaleLowerCase().includes(needle));
}

export function containsMatch(element: ElementInfo, query: string): boolean {
  return matchesElement(element, query) ||
    element.children.some((child) => containsMatch(child, query));
}

/** Projects a screen-points rectangle into a screenshot displayed at the given width. */
export function imageRect(bounds: Rect, screenshot: ScreenshotInfo, width: number): Rect | null {
  const [originX, originY, imageWidth, imageHeight] = screenshot.frame;
  const [x, y, w, h] = bounds;
  if (imageWidth <= 0 || imageHeight <= 0 || w <= 0 || h <= 0) return null;
  const left = Math.max(x, originX);
  const top = Math.max(y, originY);
  const right = Math.min(x + w, originX + imageWidth);
  const bottom = Math.min(y + h, originY + imageHeight);
  if (right <= left || bottom <= top) return null;
  const scale = width / imageWidth;
  return [(left - originX) * scale, (top - originY) * scale,
    (right - left) * scale, (bottom - top) * scale];
}

export function plainOCR(record: CaptureRecord): string {
  switch (record.ocr.status) {
    case "ok": return record.ocr.data.map((line) => line.text).join("\n");
    case "error": return record.ocr.error.name + ": " + record.ocr.error.message;
    case "skipped": return record.ocr.reason;
  }
}

export function textReport(record: CaptureRecord): string {
  return [
    "# 畫面元素檢查報告",
    "",
    "以下是 Swipt 實際回傳的觀察資料。",
    "各階段依序擷取，時間可能不同；OCR 來自這份紀錄的截圖。",
    "JSON 包含截圖資訊；截圖圖片另存，未嵌入這段文字。",
    "缺少的欄位表示來源沒有提供；不等於 false、0 或空字串。",
    "",
    "## OCR 文字",
    plainOCR(record),
    "",
    "## 完整資料（JSON）",
    JSON.stringify(record, null, 2),
  ].join("\n");
}
