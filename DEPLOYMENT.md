# 離線版部署與現場驗收

目前主線是純靜態、單裝置傳遞版，不需要 Render、WebSocket、資料庫或任何外部伺服器。

## 本機驗證

```powershell
pnpm install
pnpm test
pnpm build
pnpm package:itch
```

完成後會得到：

```text
dist/spy-party-offline.zip
```

ZIP 根目錄必須包含 `index.html`；目前打包腳本已自動產生符合這個結構的 ZIP。

## GitHub Pages 設定

1. 將此專案推送到 GitHub 的公開 Repository。
2. 在 Repository 的 Settings → Pages 將 Source 設為 `GitHub Actions`。
3. 推送到 `main` 後，等待 `Deploy offline Spy Party to GitHub Pages` workflow 完成。
4. 使用 GitHub 顯示的 Pages 網址開啟遊戲；不需要 itch.io iframe，也不需要伺服器。

目前 Vite 使用相對資源路徑，能在 `https://帳號.github.io/Repository/` 這種 project site 路徑下載入。

## itch.io 設定

1. 建立新的 itch.io project。
2. Project type 選 `HTML`。
3. 上傳 `dist/spy-party-offline.zip`。
4. 開啟 `Mobile Friendly`。
5. 視需要開啟 `Click to launch in fullscreen`。
6. 發布後用手機開啟遊戲頁，確認載入後仍可正常操作。

遊戲執行期間不需要網路連線。現場由一台手機、平板或筆電作為遊戲裝置，按照畫面指示輪流傳遞。

## 現場驗收矩陣

| 規模 | 驗證重點 |
| --- | --- |
| 4 人 | 最小人數、身分交接、抓到間諜與猜詞翻盤 |
| 8 人 | 長名單、逐人匿名投票、平票重投 |
| 12 人 | 最大人數、手機直向畫面、完整流程與文字不溢出 |

每次都要確認：

- 不登入、不安裝、不連線也能開始遊戲。
- 玩家在 2 分鐘內完成姓名設定與開局。
- 查看身分後，下一位玩家不會直接看到前一位的角色或詞語。
- 投票提交後不顯示個別玩家選擇。
- 一局在 10–20 分鐘內完成。
- 重新整理頁面後不會恢復或保留上一局資料。

## 未來線上版

若要恢復「每位玩家使用自己的手機」，才需要使用 `apps/server`、`packages/protocol` 與 `render.yaml` 的線上架構；那是不同的部署目標，不應混入本離線 MVP。
