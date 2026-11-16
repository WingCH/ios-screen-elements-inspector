# Duo 截圖與元素框來源不一致

日期：2026-11-16

狀態：已修正預覽判斷並完成報告重播；Swipt 在目標裝置回傳錯誤前景元素的原因仍待驗證。

後續已確認手機 Swipt 為 0.1.0 (83)，已包含舊版固定外屏的修正；不能再以未更新舊版解釋這次問題。完整呼叫鏈與仍缺少的實機證據見 [build 83 原始碼調查](swipt-duo-accessibility-routing.md)。

## 實際觀察

使用者提供的截圖顯示 Settings 的「一般」頁面。文字報告顯示裝置為 iPhone19,4、iOS 27.3、build 24C5037i。

報告中，截圖的來源範圍為 `[0, 0, 669, 951]`，元素樹的根節點範圍則為 `[0, 0, 466, 678]`，來源 App 原文為 `"app": "com.apple.SleepLockScreen"`。已刪去個人資料的樣本保留這些原值，見 [mixed-displays.json](../screen-debugger/src/fixtures/mixed-displays.json)，第 7、17、24 行。這些值直接證明兩個來源範圍不同；App 識別也與可見的 Settings 內容不相符。

完整報告的 231 個元素中找不到「一般」「關於」「軟件更新」等可見項目，但同一截圖的 OCR 能取得它們。SpringBoard 還同時包含 466 × 678、669 × 951、1398 × 2034 等範圍。尺寸符合不同顯示器或座標來源混用的假說，但不能單憑這份資料判定是 Duo、Beta 系統還是 Swipt 的顯示器選擇所致。

## 插件的錯誤

v0.2.0 把完整原始元素樹中的無子元素節點都當成可畫框的內容，連無內容的系統視窗及容器也一起處理。超出截圖的視窗又被裁切至預覽邊界，於是產生幾乎覆蓋整張圖的大框。

此外，疊框前沒有核對元素來源範圍與截圖是否一致。把 466 × 678 的鎖定畫面元素直接縮放至 Settings 截圖，不能得到真正的 Settings 控件位置；Settings 控件本來就不在這份元素樹中。

## 修正

- 截圖與元素來源範圍不同時，顯示原因並停用元素疊框。
- 新紀錄另外取得前景 App；與元素來源 App 不同時也停用元素疊框。
- 無內容的葉容器、非目前 App 的系統視窗及 inert 節點不自動畫框；完整原始資料繼續保留。
- 來源無法對應時，預覽預設顯示同一截圖的 OCR 文字框，清楚標示來源為 OCR。點選後開啟文字詳情。
- 新舊紀錄都可讀取，舊紀錄不需要重寫或刪除。

前景 App 與 AX 快照在 Swipt 中是不同讀取途徑。原文分別為 `front, err := c.front.get(ctx)` 及 `front := first.Frontmost(c.display())` — [Phone.Frontmost](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/device/phone.go#L658)、[ReadScreen](https://github.com/swipt-automation/swipt/blob/69bb1cf7ac4a5d0425f64781615952dd42c3f063/internal/coredevice/accessibility/screen.go#L57)。新增前景讀值用於對照及診斷，沒有宣稱它能修復底層 AX 回傳。

## 驗證

先把 v0.2.0 的實際疊框篩選移至可測試函式，加入此樣本；`bun run test` 得到 9 pass、1 fail，錯誤輸出包含被投影成全圖大小的系統視窗框。修正後，完整 13 項測試通過，涵蓋來源尺寸不同、App 不同、空容器、原始資料不變及實際 OCR 座標。

另以使用者提供的完整文字報告重播，得到：

    sourceApp: com.apple.SleepLockScreen
    rootFrame: [0, 0, 466, 678]
    screenshotFrame: [0, 0, 669, 951]
    accessibilityBoxCount: 0
    ocrBoxCount: 45
    replay: passed

這證明已停止在該報告的截圖上疊加錯誤來源元素。尚未在使用者的 Swipt runtime 重新擷取或操作 UI，因此 OCR 框的原生呈現與底層 AX 來源恢復仍待裝置驗證。這也不能代替兩個官方 Swiplet 的實際重跑結果。
