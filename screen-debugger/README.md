# 畫面元素檢查器

這個 Swiplet 只讀取 Swipt 的 Accessibility snapshot，不會點按、輸入或修改目標 App。報告列出 Swipt 讀到的元素層級，以及每個元素的 `role`、`class`、`label`、`value`、`identifier`、`frame`、狀態等欄位。`snapshotTruncated` 會指出 Swipt 是否把擷取結果截短。

## 建置

在本目錄執行：

```sh
bun install
bun run check
bun run build
```

產物是 `dist/screen-debugger.swiplet`。

若目標裝置已連上 Swipt API，可在本目錄安裝：

```sh
./node_modules/.bin/swipt swiplet install dist/screen-debugger.swiplet -d <device>
```

## 在 Swipt 內擷取

1. 安裝 `.swiplet`，開啟「畫面元素檢查器」。
2. 按「擷取畫面元素」，在 5 秒內切換到要檢查的 App。
3. 返回 Swipt，按「讀取上次擷取」查看完整報告。

報告亦儲存在這個 Swiplet 的資料目錄，檔名為 `latest-elements.txt`。每次擷取會覆蓋上一次；報告可能包含畫面上的個人資料，分享前請檢查內容。

如果已連上目標裝置的 Swipt API，也可以在目標 App 正顯示時從電腦即時擷取，毋須等待 5 秒：

```sh
./node_modules/.bin/swipt swiplet call screen-debugger capture -d <device>
./node_modules/.bin/swipt swiplet data read screen-debugger latest-elements.txt -d <device>
```

這份報告是 **Swipt 的 Accessibility snapshot**。它不包含 screenshot、OCR 文字或 App 私有狀態；若畫面內容沒有暴露為可存取元素，就不會列在報告中。
