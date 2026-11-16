import type { CaptureRecord } from "./model";
import { summarize } from "./model";

export type CompletionFeedback =
  | { status: "acknowledged" | "dismissed" }
  | { status: "failed"; message: string };

export function completionMessage(record: CaptureRecord): string {
  const summary = summarize(record);
  return [
    "擷取已完成",
    summary.elementCount === null ? "元素未取得。" : "已儲存 " + summary.elementCount + " 個元素。",
    summary.textLineCount === null ? "OCR 文字未取得。" : "已儲存 " + summary.textLineCount + " 行辨識文字。",
    summary.overlayIssue ? "元素來源與截圖待核對，預覽使用 OCR 文字框。" : "",
    "返回畫面檢查器可查看或複製完整報告。",
  ].filter(Boolean).join("\n");
}

export async function finishCapture<T>(
  record: CaptureRecord,
  persist: () => Promise<T>,
  present: ((message: string) => Promise<unknown>) | null,
): Promise<{ value: T; completion: CompletionFeedback | null }> {
  const value = await persist();
  if (present === null) return { value, completion: null };
  try {
    await present(completionMessage(record));
    return { value, completion: { status: "acknowledged" } };
  } catch (error) {
    return {
      value,
      completion: error instanceof Error && error.name === "AbortError"
        ? { status: "dismissed" }
        : { status: "failed", message: error instanceof Error ? error.message : String(error) },
    };
  }
}
