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

## 登船、自我介紹與任務確認（2026-11 更新）

- **登船**：新朋友做完測驗會先掛在測驗結果那艘船，畫面顯示入口群組邀請（https://line.me/ti/g/fA5EzTwWzr）。
- **LINE@ 推播**（選用）：在 Cloudflare 加 Secret `LINE_OA_TOKEN`（官方帳號 Messaging API 的 Channel access token），登船時會推播入口群組邀請給新朋友，並通知該船船長。船長要先用 LIFF 登入過一次，成員名冊才有他的 LINE userId。
- **自我介紹**：居住地區必填（台灣 22 縣市；海外：馬來西亞、香港、新加坡、中國、澳洲、美國、加拿大、其他自填），存在「居住地區」，並自動歸類到「地區」（北中南東離島海外）。暱稱＋居住地區全團契看得到；詳細介紹本人選擇「只給船長／同船／全團契」。督導看得到全部。送出自我介紹＝自動完成第一個任務「寫下你的自我介紹」。
- **任務**：船員按「回報完成」→ 完成紀錄「確認狀態＝待確認」→ 船長（或督導）在船長甲板按確認／退回。只有已確認的才算完成；在 Notion 手動新增、確認狀態留空的紀錄視為已確認。

| API | 說明 |
|---|---|
| POST /api/complete | 船員回報完成（待確認） |
| POST /api/confirm | 船長／督導確認或退回 |
| GET/POST /api/intro | 讀取看得到的自我介紹／更新自己的 |

## 團契系列（主視覺＋聚會日期）

- Notion「🎨 團契系列」：系列名稱、副標、主視覺（圖片）、第1～5週日期與主題、目前系列。
- LIFF 航海日誌的「團契主題」板塊：上半段主視覺、下半段 4～5 個日期。大船船員／同工當主線，小船船員當支線。
- 每個日期有「✋ 參加」舉手按鈕：提前舉手讓同工知道人數（完成紀錄：紀錄方式＝舉手參加、待確認），可放下手取消；聚會後船長／督導在船長甲板確認出席才算完成。日期下方顯示目前舉手人數，督導在系列管理看得到每次的舉手名單。
- 督導在船長甲板「🎨 團契系列管理」可以換主視覺（自動縮圖後存進 Notion）、改日期與主題、建立新系列。

| API | 說明 |
|---|---|
| POST /api/series/report | 勾選聚會日期（待確認） |
| GET/POST /api/series/admin | 督導：讀取／新增／更新系列 |
| POST /api/series/visual?id= | 督導：上傳主視覺圖片 |

## 船員探索與培力計畫（成長任務・角色任務・探索問卷）

- **🗺️ 任務** 新增 `類型`＝成長任務／角色任務，欄位：任務圈層（小船／大船／共同使命）、階段（L1–L5）、難度（微參與／主動參與／共同實踐）、角色、角色層次、檢核方式、送出內容、感謝回饋。
- **檢核方式**（系統判斷，不是自己勾）：
  - `文字送出` → `/api/task/submit`，送出內容寫進完成紀錄「備註」，直接已確認。
  - `甲板回應` → 在船員甲板回應任一則代禱／提問就完成（`/api/board/replies`）。
  - `為你禱告` → 在代禱按「為你禱告」就完成（`/api/board/heart`）。任務紀錄記在本人名下，留言本身的匿名不受影響。
  - `小船問卷`／`大船問卷` → `/api/survey` 送出就完成。
  - `船長確認`／`舉手參加` → 「我要挑戰」＋船長確認（確認時用 LINE@ 推「感謝回饋」）。
- **頁籤與鎖住規則**：任務板依 Lv1–Lv5 分頁籤。小船船員的 Lv3–Lv5 顯示「🔒 待解鎖」（後端也擋）；大船船員五層都開，Lv1–Lv2 標示「初心者挑戰」。
- **🧭 船員探索問卷**（DB `41a3602e1c8181a2be22f4e0d318b2d1`）：題目定義在 `lib/survey.js`。大船問卷選的三個角色寫回成員名冊「參與角色」，航海日誌就會出現對應的角色任務。小船問卷的「這個月一件小事」會釘在任務板最上面。
- 船長甲板的船員列有「📋 問卷」；督導有「🎭 角色地圖」（`/api/rolemap`），Notion 也有同名看板視圖。
