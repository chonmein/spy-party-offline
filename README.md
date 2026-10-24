# 誰是間諜｜Spy Party

目前主線是「純離線、單裝置傳遞」版《誰是間諜》：一台手機、平板或筆電由現場玩家輪流操作，不需要伺服器、網路、登入或安裝 App，可直接打包到 itch.io。

原本的 `apps/server` 與 `packages/protocol` 保留作為未來跨手機連線版的實驗程式，但離線版不會載入或呼叫它們。

## 本機開發

```powershell
pnpm install
pnpm dev:web
```

開啟 `http://localhost:5173`。執行期間不會建立任何網路連線；把裝置交給畫面指定的玩家即可。

## 驗證

```powershell
pnpm build
pnpm package:itch
```

`pnpm build` 只建立離線前端。`pnpm package:itch` 會產生可上傳 itch.io HTML5 遊戲的 ZIP，ZIP 根目錄包含 `index.html`。

`pnpm smoke` 需要先啟動伺服器，會用 4、8、12 個模擬玩家驗證加入房間、玩家重新連線、角色私密傳送、投票、抓到間諜與平民勝利流程；也可以把 WebSocket URL 傳給它，對部署後的服務執行同一套檢查：

```powershell
pnpm --filter @spy/server smoke wss://你的後端網址
```

## GitHub Pages 部署

此版本也支援直接部署到 GitHub Pages。Repository 需要啟用 Pages，來源選擇 `GitHub Actions`；之後每次推送到 `main`，`.github/workflows/deploy-pages.yml` 會自動建置並發布 `apps/web/dist`。

Vite 使用相對資源路徑，因此可在 GitHub Pages 的 project site 路徑下正常載入。遊戲本身不使用伺服器、不使用 API，也不保存玩家資料。

## itch.io 部署

執行 `pnpm package:itch` 後，把 `dist/spy-party-offline.zip` 上傳到 itch.io，選擇 HTML 遊戲並勾選在嵌入框架中執行。此版本不需要設定環境變數，也不需要另外租用伺服器。

## 離線 MVP 邊界

- 4–12 位玩家，一名間諜。
- 平民與間諜取得相近詞語。
- 內建 10,000 組不重複的情境題目，每局隨機抽取一組。
- 一台裝置傳遞，依序私密查看身分。
- 逐人匿名投票、平票重投、間諜猜詞翻盤。
- 不需登入、不需網路、不保存玩家資料或歷史戰績。

若要開啟「每人使用自己的手機」，請另行恢復線上版本規劃；那會需要區網主機或外部即時伺服器，不屬於本離線 MVP。
