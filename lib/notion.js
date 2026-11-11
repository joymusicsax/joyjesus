// Notion 與 LINE 共用工具。只在伺服器端（Cloudflare Pages Functions）執行。
// 需要的環境變數：
//   NOTION_TOKEN     Notion integration 的金鑰（Secret）
//   LINE_CHANNEL_ID  LINE MINI App／LINE Login 頻道的 Channel ID

// 「航海系統」各資料庫的 ID（不是機密，可以公開）
export const DB = {
  members: '1f4e4ef494314213b65172be67a0b134',   // 🧭 成員名冊
  boats: 'db69135e9b454588a4abd504e3b02a12',     // ⛵ 小船
  quests: 'cfb48240efdc449e8c7667d94dcc470b',    // 🗺️ 任務
  logs: 'dcded645b59e46f186e0cbbcfe7c8195',      // ✅ 完成紀錄
  teams: '436cf12310c043d799b12fd22ef55311',     // 🚤 出航小隊
  blessings: 'cf900b112b084184a3333169bcc18ce9', // 🍾 漂流瓶祝福
  stories: '0605c12446ad4220974c7d1aabbe0b2d',   // 📜 漂流瓶故事投稿
  events: '1743602e1c81800db858f1d3cc62445c',    // 團契內容（既有）
  board: '720cf066176b4bce8f27d37ae8f6b21e',     // 團契留言板（既有）
};

const NOTION_VERSION = '2022-06-28';

export async function notion(env, path, body, method = 'POST') {
  if (!env.NOTION_TOKEN) throw new HttpError(500, '伺服器尚未設定 NOTION_TOKEN');
  const res = await fetch('https://api.notion.com/v1/' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + env.NOTION_TOKEN,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(502, 'Notion 回應錯誤：' + (data.message || res.status));
  return data;
}

export async function queryAll(env, dbId, body = {}) {
  let results = [];
  let cursor;
  do {
    const page = await notion(env, `databases/${dbId}/query`, { ...body, start_cursor: cursor, page_size: 100 });
    results = results.concat(page.results);
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor && results.length < 500);
  return results;
}

export const createPage = (env, dbId, properties) =>
  notion(env, 'pages', { parent: { database_id: dbId }, properties });

export const updatePage = (env, pageId, properties) =>
  notion(env, 'pages/' + pageId, { properties }, 'PATCH');

// ---------- 讀取 Notion 屬性 ----------
const plain = (arr) => (arr || []).map((t) => t.plain_text).join('');
export const P = {
  title: (pg, k) => plain(pg.properties[k]?.title),
  text: (pg, k) => plain(pg.properties[k]?.rich_text),
  select: (pg, k) => pg.properties[k]?.select?.name || pg.properties[k]?.status?.name || null,
  multi: (pg, k) => (pg.properties[k]?.multi_select || []).map((o) => o.name),
  rel: (pg, k) => (pg.properties[k]?.relation || []).map((r) => r.id.replace(/-/g, '')),
  date: (pg, k) => pg.properties[k]?.date?.start || null,
  check: (pg, k) => !!pg.properties[k]?.checkbox,
  num: (pg, k) => pg.properties[k]?.number ?? null,
  formula: (pg, k) => {
    const f = pg.properties[k]?.formula;
    return f ? f[f.type] : null;
  },
  rollup: (pg, k) => {
    const r = pg.properties[k]?.rollup;
    return r ? (r.type === 'number' ? r.number : r[r.type]) : null;
  },
};
export const id = (pg) => pg.id.replace(/-/g, '');

// ---------- 寫入 Notion 屬性 ----------
export const W = {
  title: (s) => ({ title: [{ text: { content: String(s).slice(0, 1900) } }] }),
  text: (s) => ({ rich_text: [{ text: { content: String(s).slice(0, 1900) } }] }),
  select: (s) => ({ select: { name: s } }),
  status: (s) => ({ status: { name: s } }),
  date: (s) => ({ date: { start: s } }),
  rel: (ids) => ({ relation: ids.map((x) => ({ id: x })) }),
  check: (b) => ({ checkbox: !!b }),
  num: (n) => ({ number: n }),
};

// 台北時間的今天（YYYY-MM-DD）
export function todayTW() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

// ---------- LINE 身分驗證 ----------
// 前端送來 liff.getIDToken()，這裡向 LINE 驗證，只相信 LINE 回傳的 userId。
export async function verifyLine(env, request) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) throw new HttpError(401, '請先用 LINE 登入');
  if (!env.LINE_CHANNEL_ID) throw new HttpError(500, '伺服器尚未設定 LINE_CHANNEL_ID');
  // LINE MINI App 有開發／審核／正式三個 Channel ID，用逗號分隔都接受
  const ids = String(env.LINE_CHANNEL_ID).split(',').map(s => s.trim()).filter(Boolean);
  let j = null;
  for (const id of ids) {
    const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: token, client_id: id }),
    });
    if (res.ok) { j = await res.json(); break; }
  }
  if (!j) throw new HttpError(401, 'LINE 登入已過期，請重新開啟');
  return { userId: j.sub, name: j.name || '旅人' };
}

export async function findMember(env, userId) {
  const r = await notion(env, `databases/${DB.members}/query`, {
    filter: { property: 'LINE userId', rich_text: { equals: userId } },
    page_size: 1,
  });
  return r.results[0] || null;
}

// ---------- 回應 ----------
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function json(data, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': maxAge ? `public, max-age=${maxAge}` : 'no-store',
    },
  });
}

export function handle(fn) {
  return async (ctx) => {
    try {
      return await fn(ctx);
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error(e);
      return json({ error: e.message || '發生錯誤' }, status);
    }
  };
}

export async function readJson(request) {
  try { return await request.json(); } catch { throw new HttpError(400, '資料格式錯誤'); }
}
