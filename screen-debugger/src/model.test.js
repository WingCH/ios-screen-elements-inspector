import { describe, expect, test } from "bun:test";
import { mapSnapshot, mapTextLine, observe } from "./capture";
import {
  accessibilityBoxes, accessibilityOverlayIssue, allElements, containsMatch, imageRect,
  matchesElement, ocrBoxes, plainOCR, recordOverlayIssue, summarize, textReport,
} from "./model";
import mixedDisplays from "./fixtures/mixed-displays.json";

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
  test("實際 Duo 報告的鎖定畫面元素樹不能疊在內屏 Settings 截圖上", () => {
    const before = JSON.stringify(mixedDisplays);
    expect(accessibilityBoxes(mixedDisplays.snapshot, mixedDisplays.screenshot, 334.5, null, null)).toEqual([]);
    const issue = accessibilityOverlayIssue(mixedDisplays.snapshot, mixedDisplays.screenshot, null);
    expect(issue).toContain("466, 678");
    expect(issue).toContain("669, 951");
    expect(JSON.stringify(mixedDisplays)).toBe(before);
  });
  test("來源尺寸相同但 App 不同也不能疊加", () => {
    const snapshot = {
      ...mixedDisplays.snapshot,
      root: { ...mixedDisplays.snapshot.root, frame: [0, 0, 669, 951] },
    };
    expect(accessibilityBoxes(snapshot, mixedDisplays.screenshot, 334.5, null, "com.apple.Preferences")).toEqual([]);
    expect(accessibilityOverlayIssue(snapshot, mixedDisplays.screenshot, "com.apple.Preferences"))
      .toContain("com.apple.SleepLockScreen");
  });
  test("不把無內容的葉容器或 SpringBoard 視窗當成 App 控制項", () => {
    const snapshot = mapSnapshot({
      app: "example.app", time: 1,
      root: element({ role: "application", traits: [], frame: [0, 0, 400, 800], children: [
        element({ role: "other", traits: [], class: "UIView", frame: [0, 0, 400, 800] }),
        element({ label: "關於", frame: [100, 200, 80, 44] }),
        element({ label: "隱藏按鈕", inert: true, frame: [100, 300, 80, 44] }),
      ] }),
      system: element({ role: "application", traits: [], frame: [0, 0, 400, 800], children: [
        element({ role: "window", traits: [], frame: [0, 0, 400, 800] }),
      ] }),
    });
    expect(accessibilityBoxes(snapshot, shot, 200, null, "example.app").map(({ element }) => element.id))
      .toEqual(["root.1"]);
    expect(accessibilityBoxes(snapshot, shot, 200, "root.0", "example.app").map(({ element }) => element.id))
      .toEqual(["root.0", "root.1"]);
  });
  test("不縮放錯誤元素樹湊截圖；OCR 框使用同一截圖內的實際文字位置", () => {
    const record = {
      screenshot: ok(mixedDisplays.screenshot), accessibility: ok(mixedDisplays.snapshot),
      ocr: ok(mixedDisplays.ocr),
    };
    expect(recordOverlayIssue(record)).not.toBeNull();
    const boxes = ocrBoxes(record, 334.5);
    expect(boxes).toHaveLength(2);
    expect(boxes[0].index).toBe(0);
    const expected = [35.245, 218.4, 22.115, 8.295];
    boxes[0].projected.forEach((value, index) => expect(value).toBeCloseTo(expected[index], 5));
  });
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
