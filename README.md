# 揪喜樂團契｜官網與 LINE 航海日誌

部署在 Cloudflare Pages。官網、LIFF 前端、後端 API 都在這個專案裡。

```
public/index.html        品牌官網（joyjesus.com）
public/liff/             LINE 航海日誌（LIFF）：航海地圖、航海日誌、聚會消息、船員／船長甲板
functions/api/           後端（Cloudflare Pages Functions）：驗證 LINE 身分、讀寫 Notion
lib/notion.js            共用工具與 Notion 資料庫 ID
```

## Cloudflare Pages 設定

連接這個 GitHub 專案時：

| 設定 | 值 |
|---|---|
| Framework preset | None |
| Build command | （留空） |
| Build output directory | `public` |

### 環境變數（Settings → Variables and Secrets）

| 名稱 | 類型 | 說明 |
|---|---|---|
| `NOTION_TOKEN` | **Secret** | Notion integration 的金鑰（請自己貼，不要放進程式碼） |
| `LINE_CHANNEL_ID` | Text | LINE MINI App 頻道的 Channel ID |

## LINE 設定

1. LINE Developers → 你的官方帳號所在的 Provider → 建立 **LINE MINI App** 頻道
2. Web app settings 的 Endpoint URL：`https://joyjesus.com/liff/`（網域切換前先用 `https://joyjesus.pages.dev/liff/`）
3. Scope 勾選 `openid`、`profile`
4. 把 LIFF ID 填進 `public/liff/config.js`
5. 圖文選單按鈕連結：
   - 航海地圖 `https://liff.line.me/<LIFF ID>`
   - 航海日誌 `https://liff.line.me/<LIFF ID>/log`
   - 聚會消息 `https://liff.line.me/<LIFF ID>/news`
   - 船員甲板 `https://liff.line.me/<LIFF ID>/deck`

## Notion 設定

1. https://www.notion.so/profile/integrations 建立 internal integration，取得金鑰 → 貼到 Cloudflare 的 `NOTION_TOKEN`
2. 在 Notion 把以下頁面「連結」給這個 integration（頁面右上角 ⋯ → Connections）：
   - 「航海系統｜LIFF 與官網資料庫」（含底下所有資料庫）
   - 「團契內容」資料庫
   - 「團契留言板」資料庫

## API 一覽

| 路徑 | 登入 | 用途 |
|---|---|---|
| `GET /api/public/events` | 否 | 近期聚會（團契內容，日期在今天之後） |
| `GET /api/public/content` | 否 | 小船、出航小隊、漂流瓶祝福 |
| `GET /api/me` | 是 | 自己的成員資料、任務、船長甲板船員 |
| `POST /api/join` | 是 | 測驗後登船，新增到成員名冊 |
| `POST /api/complete` | 是 | 完成「本人勾選」的任務 |
| `GET/POST /api/board` | 是（且需是成員） | 代禱事項／提問板 |
| `POST /api/board/heart` | 是 | 為你禱告／我也想知道 +1 |

## 隱私原則

- 只相信 LINE 驗證後回傳的 userId，不相信前端送來的身分
- 匿名留言的稱呼一律存成「匿名旅人」，不記錄 LINE userId
- 船長只看得到自己船上的船員
- Notion 金鑰只存在 Cloudflare，不會出現在網頁或程式碼中
