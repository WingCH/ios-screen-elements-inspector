# 畫面元素檢查器：資料與介面設計

日期：2026-11-16

狀態：已實作，待 iOS 27.3 Beta 1 iPhone Duo 驗證。

## 用途與已確認選擇

這個工具讓使用者看清 Swipt 對目標畫面實際取得的資料，並複製文字交給 AI 分析。使用者已確認採用單次擷取、截圖點選元素及多次擷取紀錄，並指定參考 [apple-design-skill](https://github.com/dickwu/apple-design-skill/tree/91e15664896f6f27e75dcf1414d1226cb95fa167)。

一次擷取保存完整元素樹、截圖、OCR 及裝置資訊。各項資料獨立保留成功、失敗或未執行狀態，以及開始和完成時間。讀取失敗的數量顯示「未取得」，成功但沒有結果才顯示 0。紀錄只保存在本機，可逐筆刪除，不自動覆蓋上一份。

## 介面

原生 SwiftUI 元件負責導覽、工具列、表單、搜尋、選擇器、展開清單及文字選取；React／TSX 負責組合元件和畫面狀態。

窄畫面：

    畫面檢查器                       紀錄
    [擷取目前畫面]
    App · 時間 · 元素／文字數量
    [複製完整報告]
    ┌──────── 截圖 ────────┐
    │ 點選元素框 → 查看詳情 │
    └─────────────────────┘
             ↓ 系統單欄導覽
    [元素｜文字｜裝置｜原始]
    選取元素詳情 / 可展開元素樹

寬畫面：

    ┌──── 畫面 ────┬──────── 檢查資料 ────────┐
    │ 擷取、紀錄    │ [元素｜文字｜裝置｜原始] │
    │ App、時間     │ 搜尋、選取元素詳情       │
    │ 截圖與元素框  │ 元素樹 / OCR / 裝置資訊  │
    │ 複製完整報告  │ 文字選取、複製、分享報告 │
    └──────────────┴─────────────────────────┘

這個產品的主要視覺特徵是截圖與元素資料之間的對應；其他部分保持安靜，方便閱讀。App 控制項及有文字的末層元素預設顯示框線，容器與系統資料仍可從完整元素樹選取。選取後以較粗框線及元素清單中的勾選記號標示，避免只靠顏色。

2026-11-16 實際 Duo 報告顯示截圖與元素來源範圍不同。現已加入來源範圍／App 檢查，不一致時保留原始資料、停用元素疊框並改用同一截圖的 OCR 框，見 [診斷紀錄](overlay-source-mismatch.md)。

原始 JSON 及大段報告放在獨立檢視，讓主要畫面先顯示有用摘要。Apple 原文：「Use progressive disclosure to make layouts cleaner and easier to interact with.」— [Layout，Visual hierarchy](https://developer.apple.com/design/human-interface-guidelines/layout#Visual-hierarchy)。此處按該原則分開摘要與完整資料。

寬窄切換使用系統 NavigationSplitView，不依型號或方向硬設畫面寬度。Apple 原文：「Create a consistent experience across displays.」及「Avoid fixed widths and display-specific dependencies.」— [Designing for iPhone Duo，Best practices](https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo#Best-practices)。採用系統分欄是依此作出的實作選擇；實際摺疊行為仍需裝置驗證。

## 字體與顏色

標題使用系統 title2，分組或選取標題使用 headline，內容使用 body，欄位名稱及資料使用可隨 Dynamic Type 縮放的 caption／monospaced。沒有自訂字型、固定整頁字體大小或裝飾動畫。

色彩角色如下。Hex 只用於設計參考及對比計算，程式沿用系統表面、文字與具名顏色；下表不是裝置實測值。

| 角色 | 淺色參考 | 深色參考 | 參考對比 |
| --- | --- | --- | --- |
| 主表面 | #F2F2F7 | #000000 | 主文字與表面：18.82:1／21.00:1 |
| 內容表面 | #FFFFFF | #1C1C1E | 由原生 Form／Section 管理 |
| 主文字 | #000000 | #FFFFFF | 同主表面 |
| 次要文字 | #6C6C70 | #98989D | 與主表面：4.69:1／7.31:1 |
| 可選元素框 | #007AFF | #0A84FF | 白底／黑底：4.02:1／5.76:1 |
| 選取元素框 | #FF9500 | #FF9F0A | 黑底：9.55:1／10.22:1；不作一般文字色 |

截圖內容會改變框線背景，框線的實際可見性不能由此表保證；完整元素樹提供另一個可選取入口。狀態使用文字，選取也使用勾選記號。

Apple 原文：「Avoid hard-coding system color values in your app.」— [Color，System colors](https://developer.apple.com/design/human-interface-guidelines/color#System-colors)。因此參考值不直接寫入系統元件，顏色由原生元件跟隨外觀與系統設定。

## 複製與資料完整性

文字支援系統選取；完整報告、單一元素、OCR 行、全部 OCR 及裝置資料提供一鍵複製。完整報告包含 OCR 文字及可讀回的 JSON。圖片獨立保存在紀錄目錄，文字報告只包含圖片資訊。原生分享提供的是文字報告。

複製不經過清單的摘要或搜尋結果，因此不會因畫面上的省略號或篩選而丟失原始欄位。來源沒有提供的欄位保持缺省；空字串、0 及 false 保留。

## 擷取完成提示

使用者已選擇無須額外設定的 Swipt 完成對話框。從 App 啟動的擷取會先保存並讀回紀錄，再呼叫 requestChoice，提供單一「完成」選項。提示顯示取得的元素／OCR 數量，以及來源待核對狀態。關閉提示不影響已保存的紀錄；提示本身出錯時，回傳保存結果並在介面顯示提示錯誤。

SDK 原文：「Swipt presents them」以及「returns to that app when the interaction ends.」— [app-intents.d.ts，第 4–7 行](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/api/app-intents.d.ts#L4)。這支持在背景完成後由 Swipt 顯示對話框，再恢復原本 App 的流程；本次沒有聲稱發送 iOS 通知中心橫額。

API 擷取不會要求手機使用者確認對話框。提示的原生呈現、切回及返回行為仍待目標裝置驗證。

## 座標與時間

疊框使用 screenshot.frame 的 points 座標範圍映射到預覽，不再乘裝置 scale。上游原文：「Width: float64(width) / scale, Height: float64(height) / scale」— [Swipt nightly.90 phone.go，第 159–174 行](https://github.com/swipt-automation/swipt/blob/522a0fbfc9a8dc47b2c15b710cb7ac4bd6576104/internal/device/phone.go#L159)。這支持使用邏輯座標。

截圖與元素樹依序讀取，各自保留時間。截圖 timestamp 取自請求開始時間；原文：「double started = SWNowMilliseconds();」— [SWScreenCalls.m，第 15 行](https://github.com/swipt-automation/swipt/blob/522a0fbfc9a8dc47b2c15b710cb7ac4bd6576104/internal/graphics/SWScreenCalls.m#L15)。報告不把兩者宣稱為同一瞬間的快照。

較新 Swipt host 才有 Duo 內屏方向修正；原文：「The picture of the inner display of an iPhone Duo at rot90 comes unturned」— [phone_screenshot.go，第 28–48 行](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/device/phone_screenshot.go#L28)。插件不在未核對 host 版本前自行旋轉圖片。

## 驗證範圍

已完成 TypeScript 檢查及 13 項資料處理測試，涵蓋初版資料保留、搜尋、幾何與報告測試，以及實際 Duo 來源不一致、App 不一致、無內容容器及 OCR 疊框回歸案例。已重播使用者提供的完整報告，確認停止錯誤元素疊框並取得 45 個 OCR 框；原生畫面效果仍待使用者裝置驗證。

完成提示新增 6 項測試，合共 19 項：涵蓋先保存後提示、保存失敗時不提示、關閉與顯示失敗不抹除結果，以及未取得資料與 0 個結果的區別。

未完成使用者裝置上的畫面驗證。Device MCP 目前只有 iOS 27.1 Duo Simulator，沒有使用者的 iOS 27.3 Beta 1 目標。因此尚未證明：實機截圖與框線對齊、點選與搜尋互動、剪貼簿貼上、內外屏切換、最大 Dynamic Type、深色及提高對比顯示。
