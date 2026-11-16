# 畫面元素檢查器

這是個人的 Swiplet repository，收錄 [畫面元素檢查器](screen-debugger/README.md)。它與 Swipt 官方沒有關聯。

檢查器可保留截圖、完整元素樹、OCR 及裝置資訊，並以原生 SwiftUI 介面提供搜尋、元素詳情、擷取紀錄，以及方便交給 AI 分析的文字／JSON 複製。

## 在 Swipt 加入 repository

在 Swipt 開啟 **Swiplets → Add → Add Repository**，貼上：

```text
https://github.com/WingCH/ios-screen-elements-inspector/releases/latest/download/swiplets.json
```

加入後，在 repository 中選擇「畫面元素檢查器」安裝。日後新版本會沿用同一個網址；安裝更新前仍需在 App 內確認。

## 發佈新版本

先修改 `screen-debugger/package.json` 的 `version` 與 `swiplet.versionCode`，後者必須比已發佈版本大。提交並推送原始碼後，建立並推送 `v*` tag；GitHub Actions 會執行檢查、建置，並在該 tag 的 Release 上傳 `swiplets.json` 與 `.swiplet`。原始碼的依賴版本記錄在 `bun.lock`。

## 第三方內容

`.agents/skills/swipt` 來自 [swipt-automation/skills](https://github.com/swipt-automation/skills)，依其 [LICENSE](.agents/skills/swipt/LICENSE) 保留原作者聲明；完整 GPL 第 3 版條文見 [COPYING](COPYING)。此目錄只是本 repo 的開發輔助 skill，不會打包進 `.swiplet`。
