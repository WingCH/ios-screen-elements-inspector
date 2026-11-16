import { dataDirectory } from "@swipt/api/file-system";
import type { CaptureRecord, CaptureSummary, OpenCapture } from "./model";
import { summarize, textReport } from "./model";

export const capturesDirectory = () => dataDirectory.directory("captures");
export const captureDirectory = (id: string) => capturesDirectory().directory(id);
const indexFile = () => dataDirectory.file("capture-history.json");

export async function history(): Promise<CaptureSummary[]> {
  const file = indexFile();
  return (await file.stat()) === null ? [] : JSON.parse(await file.text());
}

export async function saveCapture(record: CaptureRecord): Promise<void> {
  const directory = captureDirectory(record.id);
  await directory.file("report.json").write(JSON.stringify(record, null, 2));
  await directory.file("report.txt").write(textReport(record));
  await indexFile().write(JSON.stringify([summarize(record), ...await history()]));
}

export async function openCapture(id: string): Promise<OpenCapture> {
  const directory = captureDirectory(id);
  const record: CaptureRecord = JSON.parse(await directory.file("report.json").text());
  return {
    record,
    screenshotURI: record.screenshot.status === "ok"
      ? directory.file(record.screenshot.data.file).uri
      : null,
  };
}

export async function removeCapture(id: string): Promise<CaptureSummary[]> {
  await captureDirectory(id).delete();
  const next = (await history()).filter((entry) => entry.id !== id);
  await indexFile().write(JSON.stringify(next));
  return next;
}
