import * as accessibility from "@swipt/api/accessibility";
import * as device from "@swipt/api/device";
import type { RasterImage } from "@swipt/api/image";
import { defineAction, defineExtension } from "@swipt/api/swiplet";
import { z } from "zod";

import { mapDeviceInfo, mapSnapshot, mapTextLine, observe } from "./capture";
import type { CaptureRecord, ScreenshotInfo } from "./model";
import { captureDirectory, capturesDirectory, history, openCapture, removeCapture, saveCapture } from "./storage";

const captureID = z.object({ id: z.string().regex(/^\d+$/) });
const copiedText = z.object({ text: z.string() });

export default defineExtension({
  actions: {
    capture: defineAction({
      title: "擷取完整畫面資料",
      description: "取得截圖、可存取元素、OCR 文字和裝置資訊，儲存在本機擷取紀錄。",
      async run(_, { caller, signal }) {
        if (caller === "app") await sleep(5_000, { signal });
        const startedAt = Date.now();
        const id = String(startedAt);
        const root = capturesDirectory();
        if (!(await root.exists())) await root.create();
        const directory = captureDirectory(id);
        await directory.create();
        const deviceInfo = await observe(async () => mapDeviceInfo(await device.info({ signal })), signal);
        const foreground = await observe(() => device.foregroundApplication.get({ signal }), signal);
        let image: RasterImage | undefined;
        const screenshot = await observe<ScreenshotInfo>(async () => {
          image = await device.screenshot({ signal });
          await image.save(directory.file("screen.png"), { format: "png", signal });
          return {
            file: "screen.png",
            width: image.width,
            height: image.height,
            scale: image.scale,
            frame: [...image.frame],
            time: image.time,
            timestamp: image.timestamp,
          };
        }, signal);
        const snapshot = await observe(async () => mapSnapshot(
          await accessibility.snapshot({ scope: "fullScreen", full: true, signal }),
        ), signal);
        const capturedImage = image;
        const ocr = capturedImage === undefined
          ? { status: "skipped" as const, startedAt: Date.now(), finishedAt: Date.now(),
              reason: "截圖未能取得，因此未執行 OCR。" }
          : await observe(async () => (await capturedImage.recognizeText({
              detectLanguage: true, level: "accurate", signal,
            })).map(mapTextLine), signal);
        const record: CaptureRecord = {
          schemaVersion: 1, id, startedAt, finishedAt: Date.now(),
          device: deviceInfo, screenshot, accessibility: snapshot, ocr, foreground,
        };
        await saveCapture(record);
        return openCapture(id);
      },
    }),
    history: defineAction({
      title: "讀取擷取紀錄",
      run: () => history(),
    }),
    open: defineAction({
      title: "開啟擷取紀錄",
      input: captureID,
      run: ({ id }) => openCapture(id),
    }),
    remove: defineAction({
      title: "刪除擷取紀錄",
      input: captureID,
      run: ({ id }) => removeCapture(id),
    }),
    copy: defineAction({
      title: "複製文字",
      input: copiedText,
      run: ({ text }, { signal }) => device.setPasteboard(text, { signal }),
    }),
  },
});
