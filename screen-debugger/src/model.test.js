import { describe, expect, test } from "bun:test";
import { mapSnapshot, mapTextLine, observe } from "./capture";
import {
  allElements, containsMatch, imageRect, matchesElement, plainOCR, summarize, textReport,
} from "./model";

const element = (fields) => ({ role: "button", traits: ["button"], children: [], ...fields });
const ok = (data) => ({ status: "ok", startedAt: 1, finishedAt: 2, data });
const shot = {
  file: "screen.png", width: 400, height: 800, scale: 3,
  frame: [0, 0, 400, 800], time: null, timestamp: 1000,
};

describe("保留實際元素資料", () => {
  test("讀取 getter 欄位，保留空值語意及層級，排除 parent 循環", () => {
    class NativeElement {
      get role() { return "textField"; }
      get traits() { return ["textEntry"]; }
      get value() { return ""; }
      get expanded() { return false; }
      get selection() { return [0, 0]; }
      get frame() { return [0, 0, 200, 44]; }
      get children() { return []; }
      get parent() { return this; }
    }
    const source = {
      app: "example.app", time: 123, truncated: true,
      root: element({ children: [new NativeElement()] }),
      system: element({ role: "alert", label: "系統提示" }),
    };
    const mapped = mapSnapshot(source);
    const child = mapped.root.children[0];
    expect(child).toMatchObject({
      id: "root.0", role: "textField", value: "", expanded: false,
      selection: [0, 0], frame: [0, 0, 200, 44],
    });
    expect("identifier" in child).toBe(false);
    expect("parent" in child).toBe(false);
    expect(JSON.parse(JSON.stringify(mapped))).toEqual(mapped);
    expect(mapped.truncated).toBe(true);
    expect(allElements(mapped).map((node) => node.id)).toEqual(["root", "root.0", "system"]);
  });

  test("以 identifier、文字、class 搜尋，保留通往相符子項的祖先", () => {
    const snapshot = mapSnapshot({
      app: "example.app", time: 1,
      root: element({ role: "container", children: [
        element({ identifier: "SkipButton", label: "跳過", class: "AdCloseButton" }),
      ] }),
    });
    expect(containsMatch(snapshot.root, "skipbutton")).toBe(true);
    expect(matchesElement(snapshot.root.children[0], "跳過")).toBe(true);
    expect(matchesElement(snapshot.root.children[0], "adclose")).toBe(true);
    expect(containsMatch(snapshot.root, "沒有這個文字")).toBe(false);
  });
});

describe("截圖與元素位置", () => {
  test("以 points 映射，不把 3x scale 再乘一次", () => {
    expect(imageRect([300, 50, 80, 40], shot, 200)).toEqual([150, 25, 40, 20]);
  });
  test("保留來源原點，裁切部分在畫面外的框", () => {
    const cropped = { ...shot, frame: [100, 200, 400, 800] };
    expect(imageRect([80, 180, 100, 100], cropped, 200)).toEqual([0, 0, 40, 40]);
    expect(imageRect([10, 10, 20, 20], cropped, 200)).toBeNull();
  });
  test("Duo 寬畫面依來源比例縮放，不自行旋轉", () => {
    const wide = { ...shot, frame: [0, 0, 1000, 700], width: 1000, height: 700 };
    expect(imageRect([600, 100, 200, 40], wide, 500)).toEqual([300, 50, 100, 20]);
  });
});

describe("可複製的除錯報告", () => {
  const snapshot = mapSnapshot({ app: "example.app", time: 123, root: element({ label: "跳過" }) });
  const record = {
    schemaVersion: 1, id: "1000", startedAt: 1000, finishedAt: 2000,
    device: ok({ screen: { width: 400, height: 800, scale: 3 } }),
    screenshot: ok(shot), accessibility: ok(snapshot),
    ocr: ok([{
      text: "跳過\n廣告", confidence: 0.98, frame: [1, 2, 3, 4], center: [2.5, 4],
      quad: [[1, 2], [4, 2], [4, 6], [1, 6]], candidates: [],
    }]),
  };
  test("完整文字可讀回原始 JSON，保留截圖、元素、OCR 與各階段時間", () => {
    const report = textReport(record);
    const json = report.split("## 完整資料（JSON）\n")[1];
    expect(JSON.parse(json)).toEqual(record);
    expect(plainOCR(record)).toBe("跳過\n廣告");
    expect(summarize(record)).toMatchObject({ complete: true, elementCount: 1, textLineCount: 1 });
  });
  test("失敗不偽裝成成功但沒有元素", async () => {
    const failure = await observe(async () => {
      throw new DOMException("device tree unavailable", "UnavailableError");
    }, new AbortController().signal);
    const partial = { ...record, accessibility: failure };
    expect(failure.status).toBe("error");
    expect(textReport(partial)).toContain("device tree unavailable");
    expect(summarize(partial).complete).toBe(false);
    expect(summarize(partial).app).toBeNull();
    expect(summarize(partial).elementCount).toBeNull();
  });
  test("取消作業不儲存成普通讀取錯誤", async () => {
    const cancellation = new AbortController();
    cancellation.abort();
    await expect(observe(async () => {
      throw cancellation.signal.reason;
    }, cancellation.signal)).rejects.toHaveProperty("name", "AbortError");
  });
  test("保留 OCR 的候選文字、四角座標及信心值", () => {
    const result = mapTextLine({
      text: "跳過", confidence: 0.99, frame: [1, 2, 3, 4], center: [2.5, 4],
      quad: [[1, 2], [4, 2], [4, 6], [1, 6]],
      candidates: [{ text: "跳過", confidence: 0.99 }, { text: "跳遇", confidence: 0.5 }],
      boundingBox() { return null; },
    });
    expect(result.candidates[1]).toEqual({ text: "跳遇", confidence: 0.5 });
    expect(result.quad).toEqual([[1, 2], [4, 2], [4, 6], [1, 6]]);
    expect("boundingBox" in result).toBe(false);
  });
});
