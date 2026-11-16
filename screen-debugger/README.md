# 畫面元素檢查器

這個 Swiplet 用來檢查 Swipt 實際讀到的畫面資料，取得截圖、完整 Accessibility snapshot、OCR 文字及裝置資訊。它不會點按、輸入或修改目標 App。

## 檢查與複製資料

- **截圖**：切換可存取元素框或同一截圖的 OCR 文字框。元素框只顯示 App 控制項及有文字的末層元素；其他容器與系統資料仍可在元素樹中查看。
- **元素**：搜尋文字、`identifier`、`role` 或 `class`，展開層級，查看來源提供的全部欄位。
- **文字**：逐行查看 OCR 文字、位置、信心值及候選文字。
- **裝置**：查看型號、iOS 版本、build、語言、螢幕及截圖的尺寸與方向資料。
- **原始**：查看或複製完整報告及 JSON，方便貼給 AI 分析。

欄位文字可以選取複製；另外提供「複製完整報告」「複製此元素 JSON」「複製全部辨識文字」「複製裝置資料」及原生文字分享。截圖圖片不會嵌入複製的文字報告。

介面由 React／TSX 配合 `@expo/ui/swift-ui` 顯示原生 SwiftUI 元件。寬畫面可並排顯示截圖與詳情，窄畫面使用系統的單欄導覽。

## 建置

在本目錄執行：

```sh
bun install
bun run check
bun run test
bun run build
```

產物是 `dist/screen-debugger.swiplet`。

若目標裝置已連上 Swipt API，可在本目錄安裝：

```sh
bun run swipt swiplet install dist/screen-debugger.swiplet -d <device>
```

## 在 Swipt 內擷取

1. 安裝 `.swiplet`，開啟「畫面元素檢查器」。
2. 按「擷取目前畫面」，在 5 秒內切換到要檢查的 App。
3. 返回 Swipt，點選截圖的元素框，或按「查看全部資料」。
4. 按「複製完整報告」，再貼上到 AI 或其他 App。

所有擷取紀錄保留在本機，可從「紀錄」重新開啟或逐筆刪除。每份紀錄位於 `captures/<id>/`，包含 `report.json`、`report.txt`，以及成功取得時的 `screen.png`。舊版的 `latest-elements.txt` 不會被刪除，但不會出現在新的紀錄清單中。

如果已連上目標裝置的 Swipt API，也可以在目標 App 正顯示時從電腦即時擷取，毋須等待 5 秒：

```sh
bun run swipt swiplet call screen-debugger capture -d <device>
bun run swipt swiplet call screen-debugger history -d <device>
bun run swipt swiplet data read screen-debugger captures/<id> -d <device> --output <directory>
```

## 資料限制

截圖與元素樹依序取得，報告保留各自的時間。OCR 直接辨識本次截圖。某項讀取失敗時，其餘成功資料仍會保存；「未取得」與成功但沒有元素／文字分開顯示。

元素來源範圍與截圖不同，或來源 App 與另外取得的前景 App 不同時，預覽會說明原因並改用 OCR 文字框。原始元素資料不會被縮放湊合或刪除。來源範圍相同也不能單獨證明畫面完全一致；實際內容仍需對照。此修正及實際 Duo 報告的重播結果見 [來源不一致診斷](../docs/overlay-source-mismatch.md)。

沒有暴露為可存取元素的畫面內容，可能只出現在截圖或 OCR 中。元素樹的 `truncated` 欄位表示來源有否截短結果；完整資料不包含目標 App 的內部變數或私有資料庫。

目前已完成型別檢查、資料處理測試及 Swiplet 建置；使用者的 iOS 27.3 Beta 1 iPhone Duo 尚未連上本機工具，原生 UI、剪貼簿和內外屏實際顯示仍待該裝置驗證。設計與驗證範圍見 [設計紀錄](../docs/inspector-design.md)。
