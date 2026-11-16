# Swipt 在 iPhone Duo 讀到鎖定畫面的原始碼調查

日期：2026-11-16
範圍：Swipt 原始碼、公開發佈資料，以及使用者提供的截圖與報告。沒有操作裝置、修改上游或發送 issue。

## 結論

**使用者已在 AltStore 確認手機上的 Swipt 是 0.1.0 (83)。本次以官方 build 83 已包含 Duo 修正為前提，不能再把問題歸因於未更新的舊版，或要求使用者更新至同一個 build。**

最準確的判斷是：本次畫面與 AX（Accessibility，系統提供的介面元素）資料來源不一致，**高度符合 Duo 內外屏路由不同的症狀**。build 83 的源碼已按活躍 display 傳入 AX；仍須取得實際 display ID、幾何快取、佇列工作與背光狀態的同次 trace，才能判斷哪一層與截圖分歧。現有源碼及報告不足以斷言是 ID 選錯、待執行工作合併，或系統 AX 回傳錯誤。

### 上游曾經修正的歷史問題

1. **舊版硬寫 display 1。** 原文：`"displayId": int64(1)` — [522a0fb 的 Batch.Frontmost，第 86–89 行](https://github.com/swipt-automation/swipt/blob/522a0fbfc9a8dc47b2c15b710cb7ac4bd6576104/internal/coredevice/accessibility/batch.go#L86)。此處沒有讀取活躍顯示器。
2. **上游明確修正這個問題。** Commit 標題原文：`Fix the inner display of iPhone Duo being ignored` — [84805eee](https://github.com/swipt-automation/swipt/commit/84805eee486cd456beb5aaffa40faad53eab9661)，提交時間為香港時間 2026-11-14 01:06:10。Diff 把固定的 1 改成傳入的 display，並把同一修改用於 Frontmost 與 HitTest。
3. **display 1 是 cover 的記錄來自上游實測註解。** 原文：`display 1, its cover display` — [69bb1cf 的 batch.go，第 86–95 行](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/coredevice/accessibility/batch.go#L86)。註解記錄 iOS 27.2、內屏有 App 在前時，查 cover 會取得 SpringBoard；它沒有直接聲稱 iOS 27.3 一定回傳 SleepLockScreen。後者是本次使用者的觀察。

## 本次裝置證據

刪去個人資料的 [mixed-displays.json](../screen-debugger/src/fixtures/mixed-displays.json) 保留了關鍵原值：

| 觀察 | 原值 | 能支持的結論 |
| --- | --- | --- |
| 截圖範圍 | `[0, 0, 669, 951]` | 與使用者看到的 Settings 內屏畫面一致 |
| AX App | `com.apple.SleepLockScreen` | AX 並非在報告可見 Settings 的元素 |
| AX 根範圍 | `[0, 0, 466, 678]` | 與截圖不是同一範圍 |
| system 視窗 | 包含多個尺寸 | fullScreen 原始樹包含不同視窗，不能全部直接視為當前截圖中的內容 |

來源可定位至樣本第 7、17、24 行。另見[先前的報告重播](overlay-source-mismatch.md)：Settings 文字可由同張圖的 OCR 取得，原始 AX 中卻沒有對應 Settings 項目。

尺寸也有上游依據：原文分別記錄 `2007x2853 inner display` 與 `1398x2034 cover display` — [displayinfo.go，第 76–77 行](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/coredevice/display/displayinfo.go#L76)。以本次 scale 3 換算，恰為 669 × 951 與 466 × 678 points。因此「內屏截圖配外屏 AX 範圍」是有具體尺寸依據的推論；報告未包含實際的 AX displayId，所以仍不能把推論升格為已觀測路由。

## 修正後 main 的完整呼叫鏈

以下固定在 `69bb1cf7ac4a5d0425f64781615952dd42c3f063`，不是把日後變動的 main 當作不變依據。

| 層次 | 直接原文與定位 | 意義 |
| --- | --- | --- |
| SDK | `"accessibility.snapshot"` — [runtime accessibility.ts:108](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/automation/runtime/src/extension/accessibility.ts#L108) | JS 把 snapshot 請求交給 Swipt host |
| Go bridge | `Raw: options.Full` — [ops.go:589](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/automation/ops.go#L589) | full 是原始元素呈現選項，不是顯示器選擇 |
| 裝置讀取 | `geometry, err := c.readGeometry(ctx)` — [phone.go:477](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/device/phone.go#L475) | 先取得或沿用幾何狀態 |
| fullScreen 分支 | `client.ReadScreen(ctx, springboard, options.Depth, nil)` — [phone.go:522](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/device/phone.go#L522) | 呼叫包含 SpringBoard 的讀取 |
| AX 前景查詢 | `front := first.Frontmost(c.display())` — [screen.go:57](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/coredevice/accessibility/screen.go#L57) | 查詢指定顯示器的前景 App |
| AX session 建立 | `s.displayID` — [ax.go:295](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/device/ax.go#L295) | 傳入函式 callback，不是固定數字 |
| ID 讀值 | `return s.display.ID` — [connection.go:842–846](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/device/connection.go#L842) | 每次 callback 都讀 Connection 的現有 ID |
| AX protocol | `"displayId": int64(display)` — [batch.go:94](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/coredevice/accessibility/batch.go#L94) | 請求 type 4 真正送出的參數 |

RemoteClient 的欄位型別原文為 `func() int`，並保存傳入的 callback，見 [remote.go:103、132](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/coredevice/accessibility/remote.go#L103)。所以**不能說新 main 在建立 AX session 時把外屏 ID 永久快取住**。它每次重新取 Connection 的值；但此 callback 本身沒有重新列舉裝置顯示器。

frontApp 也不是改正 display 的捷徑：原文是 `app = first.Frontmost(c.display())` — [ReadApplication，screen.go:158](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/coredevice/accessibility/screen.go#L158)。兩種 scope 共享同一個 display callback。

## 活躍顯示器如何選擇

`activeDisplay` 會列舉 CoreDevice 顯示器，交給 `display.Active` 選擇，再把結果保存到 Connection。原文：`c.connection.updateDisplay(active)` — [conn.go:78–89](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/device/conn.go#L78)。保存動作的原文為 `s.display = info` — [connection.go:820](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/device/connection.go#L820)。

選擇順序直接寫在 [displayinfo.go:114–134](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/coredevice/display/displayinfo.go#L114)：

1. primary 若 lit，先回 primary。原文：`if primary.lit()`。
2. 否則找另一個 integrated 且 lit 的顯示器。
3. 都找不到時，回到尺寸可用的 primary。

其中 lit 接受的原文是 `"inactiveOn", "activeOn", "activeDimmed"`。因此，若 Beta 實際同時回報 cover=inactiveOn、inner=activeOn，這段選擇會優先 cover。**這是根據分支可確定的條件結果，不是本次已取得的背光資料**；本次報告沒有逐屏背光值。

若列舉本身發生錯誤，activeDisplay 會把錯誤回傳，不會在這條路徑靜默改用 display 1。不可把「沒有 lit 時回 primary」和「讀取錯誤時回 display 1」混為一談。

## Screenshot 的 ID 與 AX 的 ID 不可混用

CoreDevice 會分別讀取數字 `displayId` 與字串 `uniqueId` — [displayinfo.go:61–62](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/coredevice/display/displayinfo.go#L61)。新 main 把同一份 DisplayInfo 的數字 ID 用於 AX，字串 UniqueID 用於 screenshot。

截圖原文：`screencapture.Capture(ctx, c.device, geometry.display.UniqueID)` — [phone_screenshot.go:28](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/device/phone_screenshot.go#L28)。協定輸入再寫入 `input["displayUniqueID"] = displayUniqueID` — [screencapture.go:34](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/coredevice/screencapture/screencapture.go#L34)。

這證明兩條路徑使用不同欄位，**不證明它們指向不同實體螢幕**。原始碼的設計就是從同一份選擇結果取各自協定需要的 ID。若懷疑 iOS 27.3 的 AX 數字命名或回傳行為改變，必須同時記錄 CoreDevice ID／UniqueID、AX 實際 request 參數與 response；不能直接把字串 UniqueID 轉成數字塞入 AX。

## build 83 仍需核對的路徑

### AX read 的 key 未含 display，但不是已完成結果快取

SnapshotOptions 的 key 包含 scope、within 和 depth，沒有 display ID；例如原文 `"fullScreen:" + depth` — [phone.go:462–473](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/device/phone.go#L462)。但不能因此直接下結論說「它一直取回外屏快取」。

`c.ax.read` 實際建立一個新 job，再進入佇列。合併條件原文為 `it.key == job.key && !it.started` — [ax.go:85–99](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/device/ax.go#L85)。它只合併相同 key、**尚未開始**的佇列工作；不是保存或重用已完成 snapshot 的 cache。開始執行時 job 會從 queue 移除，因此連已在執行中的工作也不會由這個條件合併。

**根據源碼推論**：若兩個相同 scope／depth 的讀取在換屏前後都排進尚未開始的 queue，後者可能加入前者已擷取 geometry 的 closure。等工作執行時，AX 又會讀當時的 live display callback。這是 key 未含 display 所容許的跨狀態合併條件；本次沒有 queued／started／joined trace，也未證明有第二個同 key 讀取，所以不能把它當作已確認根因。

### 換 display 不會自動清 AX generation 或 node index

[updateDisplay 的完整分支，connection.go:817–840](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/device/connection.go#L817) 保存新顯示器、讓 stream 跟隨及通知畫面尺寸變化，沒有更新 AX generation 或清除 node index。其通知動作最終只把新 screen 傳給 viewer；原文為 `viewers.ScreenChanged(screen)` — [frontend.go:153–160](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/device/frontend.go#L153)。

相對地，daemon kill 路徑明確執行 `w.generation.Add(1)` 與 `w.conn.nodes.clear()` — [ax.go:476–477](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/device/ax.go#L476)。

這表示舊元素 ref 的有效期不以 display 切換作界線；它可能影響拿舊 ref 作後續操作的情境。**本次新的 fullScreen snapshot 沒有 within ref，最後仍會真的呼叫 AX Frontmost，所以「沒有清 node index」本身不足以解釋新讀取為何答 SleepLockScreen。** 需要把舊 ref 問題和本次新 snapshot 的來源問題分開驗證。

### 幾何快取與 AX callback 不是同一份固定狀態

readGeometry 可直接回快取，原文：`return c.geometry, nil` — [phone.go:145–150](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/device/phone.go#L145)。條件是資料未滿 1 秒，或近期畫面串流顯示方向持續穩定；後者見 [screen_stream.go:384–386](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/device/screen_stream.go#L384)，原文包含 `s.oriented.Load() < at.UnixNano()`。

Connection 另一方面可由背景 display polling 或裝置事件重新選擇顯示器，見 [connection.go:787–808](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/device/connection.go#L787)，實際呼叫為 `c.activeDisplay(c.ctx)`。換屏時既有記錄訊息是 `the screen moved from display `，見 [同檔第 830 行](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/device/connection.go#L830)。

**根據源碼推論**：screenshot 可能沿用一份 geometry.display.UniqueID，稍後的 AX callback 則讀到 Connection 新保存的 ID。這是源碼容許的不同時間狀態，不代表這次真的發生過換屏或並行更新。本次樣本中截圖 request timestamp 與 snapshot.time 約差 759 毫秒，落在 1 秒範圍內；僅能說值得對照 trace，不能據此新增競態修補。

### 舊版只作比較，已不作本次根因

完全未修的 522a0fb 不僅 AX 固定 display 1，readGeometry 也選 primary。原文：`primaryDisplay(displays)` — [舊 phone.go:154](https://github.com/swipt-automation/swipt/blob/522a0fbfc9a8dc47b2c15b710cb7ac4bd6576104/internal/device/phone.go#L154)。

若裝置仍如上游註解所述把 cover 標為 primary，這條舊路徑應回 466 × 678 的裝置螢幕資訊。然而使用者原始報告的 device.info.screen 已是 669 × 951，且後來已明確確認 host 為 build 83。**因此舊固定 display 1 的 bug 只保留為歷史對照，不再列為本次待驗證假說。**

## 已發佈版本與插件版本的關係

截至本次查詢：

- nightly release 的 target_commitish 是 `69bb1cf7ac4a5d0425f64781615952dd42c3f063`，已包含 84805eee。來源：[官方 nightly release API](https://api.github.com/repos/swipt-automation/swipt/releases/tags/nightly)，香港時間 2026-11-14 12:28:34 發佈。
- 公開 metadata 原文是 `{"version":"0.1.0","build":83}`。來源：[官方 metadata.json](https://github.com/swipt-automation/swipt/releases/download/nightly/metadata.json)，本次以公開 URL 實際讀回。nightly URL 日後會改變，這是 2026-11-16 的讀值。
- 插件使用的 `@swipt/api@0.1.0-nightly.90`，npm metadata 的 gitHead 原文是 `522a0fbfc9a8dc47b2c15b710cb7ac4bd6576104`。來源：[npm package metadata](https://registry.npmjs.org/@swipt/api/0.1.0-nightly.90)。這只是該 SDK 套件的 source revision。

AX 實作在手機 Swipt host 中。SDK stub 原文直接寫着 `@swipt/api/accessibility runs inside Swipt` — [api/accessibility.mjs:3](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/api/accessibility.mjs#L3)。所以只升級插件的 npm 依賴，不能替換已安裝 Swipt App 的 Go AX 實作；也不能由插件 SDK 的 gitHead 推回手機 host 的 build。

## 最少還需要甚麼證據

使用者已確認 Swipt App 是 0.1.0 (83)。接下來最有價值的是一次穩定內屏畫面的對照 trace，而不是再次要求同一個版本資料或建議升級至 83：

| 同次紀錄 | 用來區分甚麼 |
| --- | --- |
| 已確認 host 0.1.0 (83)，trace 記錄 source SHA 供對照 | 對照此次研究的 69bb1cf 實作 |
| 截圖前列舉的每屏 ID、UniqueID、Primary、Integrated、Backlight、尺寸與方向 | active 選擇是否真的挑了 inner；是否兩屏都被判 lit |
| screenshot request 的 UniqueID，及回應的 displayUniqueID／圖片尺寸 | 圖片服務實際選了哪個顯示器；現有包裝只取 image，沒有把回應 ID 傳到插件 |
| AX Frontmost 送出的 displayId、回傳 PID／bundle ID／根範圍 | 是否實際查 cover，或查 inner 卻被 AX 回成 cover |
| 同時的 Connection.display.ID 與 geometry.display.ID／geometryAt | 是否存在可觀測的幾何快取與 ID 分歧 |
| AX job key、queuedAt、startedAt、是否加入既有未開始的 job | 是否真的有跨顯示器同 key 合併；沒有合併就排除此方向 |
| process-based foreground App 與 locked 狀態 | 分辨全裝置真的鎖定，還是只有非活躍外屏回傳鎖定畫面 |

最低限度應在完全展開且畫面穩定的狀態讀取，並以 CoreDevice 真正列出的各個數字 ID 逐一作唯讀 AX Frontmost 對照；不預設內屏 ID 一定是 2。若同次 geometry 與 AX 所用 ID 已一致、工作沒有合併，而 AX 仍回 cover 的 bundle ID／範圍，才把焦點移到 AX 的 display ID 解釋或系統回傳／快取。

這部分需要可連接的目標裝置或上游 host 的診斷 trace，本次沒有執行，也沒有新增任何競態修補。

本次以 repo 本地 Swipt CLI 查詢裝置，回覆原文為 `No device publishes Swipt on the local network`。目前沒有可讀取該手機 log 的連線，所以未取得上述 runtime ID／request 對照；不能把原始碼推導當成已完成實機定案。

## 完成範圍

已完成固定 commit 的 source trace、舊新版本 diff、修正 commit 與公開 release metadata 核對。沒有把 mock、源碼條件推導或其他型號結果當成使用者裝置上的成功證據；沒有修改上游或替使用者升級 Swipt host。
