// 影片回顧：讀取與整理（公開頁和管理後台共用）
import { DB, queryAll, createPage, W, P, id } from './notion.js';

export function readVideo(pg) {
  return {
    id: id(pg),
    vid: P.text(pg, '影片ID'),
    title: P.title(pg, '標題'),
    date: P.date(pg, '日期'),
    star: P.check(pg, '星號'),
    order: P.num(pg, '排序'),
    show: P.check(pg, '顯示'),
  };
}

// 從網址或單純的 ID 取出 11 碼 YouTube 影片 ID
export function parseVid(s) {
  s = String(s || '').trim();
  let m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{11}$/.test(s) ? s : null;
}

// 排序規則：「排序」數字小的在前（沒填的排最後）；同樣就新的在前
export function sortVideos(a, b) {
  const x = a.order ?? 1e9, y = b.order ?? 1e9;
  if (x !== y) return x - y;
  return String(b.date || '').localeCompare(String(a.date || ''));
}

export async function allVideos(env) {
  const pages = await queryAll(env, DB.videos, {});
  return pages.map(readVideo).filter((v) => v.vid);
}

// ---------- 從 YouTube 播放清單同步到 Notion ----------
export const PLAYLIST_ID = 'PLZCr0ZQElmYXKLLGkDRweo32-qWk-S2PW';

// 標題裡常帶日期（20261117、2024年10月1日），寫進「日期」欄，標題本身去掉這段
export function parseTitleDate(t) {
  let m = String(t).match(/(20\d{2})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = String(t).match(/(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return null;
}
export function cleanTitle(t) {
  let s = String(t)
    .replace(/揪喜樂團契\s*20\d{6}/g, '')
    .replace(/20\d{6}\s*揪喜樂團契/g, '')
    .replace(/20\d{2}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日/g, '')
    .replace(/\b20\d{6}\b/g, '');
  s = s.replace(/[｜|]\s*[｜|]/g, '｜').replace(/^[\s｜|]+|[\s｜|]+$/g, '').trim();
  return s || String(t).trim();
}

// 回傳 { added, total }；新影片「顯示」預設關閉，等督導確認後才會出現在官網
export async function syncPlaylist(env) {
  if (!env.YOUTUBE_API_KEY) return { error: '尚未設定 YOUTUBE_API_KEY' };
  const items = [];
  let token = '';
  for (let i = 0; i < 6; i++) {
    const u = 'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=' + PLAYLIST_ID + '&key=' + env.YOUTUBE_API_KEY + (token ? '&pageToken=' + token : '');
    const r = await fetch(u);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { error: 'YouTube 回應錯誤：' + (j.error?.message || r.status) };
    items.push(...(j.items || []));
    token = j.nextPageToken;
    if (!token) break;
  }
  const have = new Set((await allVideos(env)).map((v) => v.vid));
  let added = 0;
  for (const it of items) {
    const vid = it.contentDetails?.videoId;
    const title = it.snippet?.title || '';
    if (!vid || have.has(vid) || /^(Private|Deleted) video$/i.test(title)) continue;
    have.add(vid);
    const pub = it.contentDetails?.videoPublishedAt;                       // 上傳時間（UTC）
    const date = parseTitleDate(title) || (pub ? new Date(new Date(pub).getTime() + 8 * 3600e3).toISOString().slice(0, 10) : null);
    const props = { '標題': W.title(cleanTitle(title)), '影片ID': W.text(vid), '星號': W.check(false), '顯示': W.check(false) };
    if (date) props['日期'] = W.date(date);
    await createPage(env, DB.videos, props);
    added++;
  }
  return { added, total: items.length };
}
