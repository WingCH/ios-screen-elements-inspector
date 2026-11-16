import { expect, test } from "bun:test";
import { completionMessage, finishCapture } from "./completion";
import mixedDisplays from "./fixtures/mixed-displays.json";

const ok = (data) => ({ status: "ok", startedAt: 1, finishedAt: 2, data });
const record = {
  schemaVersion: 1, id: "1000", startedAt: 1, finishedAt: 2,
  device: ok({}), screenshot: ok(mixedDisplays.screenshot),
  accessibility: ok(mixedDisplays.snapshot), ocr: ok(mixedDisplays.ocr),
};

test("先保存並讀回紀錄，再顯示完成提示", async () => {
  const events = [];
  const opened = { record, screenshotURI: "file:///screen.png" };
  const result = await finishCapture(record, async () => {
    events.push("saved");
    await Promise.resolve();
    events.push("readBack");
    return opened;
  }, async (message) => {
    events.push("prompt");
    expect(message).toContain("擷取已完成");
    expect(message).toContain("2 行辨識文字");
    expect(message).toContain("來源與截圖待核對");
  });
  expect(events).toEqual(["saved", "readBack", "prompt"]);
  expect(result.value).toBe(opened);
  expect(result.completion.status).toBe("acknowledged");
});

test("未成功保存時，不顯示已完成提示", async () => {
  let prompted = false;
  await expect(finishCapture(record, async () => {
    throw new Error("disk full");
  }, async () => { prompted = true; })).rejects.toThrow("disk full");
  expect(prompted).toBe(false);
});

test("關閉完成提示不把已保存的紀錄變成擷取失敗", async () => {
  const result = await finishCapture(record, async () => record, async () => {
    throw new DOMException("dismissed", "AbortError");
  });
  expect(result.value).toBe(record);
  expect(result.completion.status).toBe("dismissed");
});

test("提示無法顯示時，保留保存結果並回傳提示錯誤", async () => {
  const result = await finishCapture(record, async () => record, async () => {
    throw new DOMException("dialog unavailable", "UnavailableError");
  });
  expect(result.value).toBe(record);
  expect(result.completion).toEqual({ status: "failed", message: "dialog unavailable" });
});

test("API 擷取可直接回傳結果，不要求人在手機確認", async () => {
  const result = await finishCapture(record, async () => record, null);
  expect(result.completion).toBeNull();
  expect(result.value).toBe(record);
});

test("完成提示分清未取得與沒有文字", () => {
  const failed = { status: "error", startedAt: 1, finishedAt: 2,
    error: { name: "UnavailableError", message: "no tree" } };
  const message = completionMessage({ ...record, accessibility: failed, ocr: ok([]) });
  expect(message).toContain("元素未取得");
  expect(message).toContain("0 行辨識文字");
});
