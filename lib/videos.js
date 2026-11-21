// 影片回顧：讀取與整理（公開頁和管理後台共用）
import { DB, queryAll, P, id } from './notion.js';

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
