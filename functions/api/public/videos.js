// GET /api/public/videos — 官網「影片回顧」用：第一列是有星號的，其餘依月份分組（新月份在前）
import { handle, json } from '../../../lib/notion.js';
import { allVideos, sortVideos, syncPlaylist } from '../../../lib/videos.js';

export const onRequestGet = handle(async ({ env, waitUntil }) => {
  // 有人開影片頁時，順便（最多每 30 分鐘一次）把 YouTube 播放清單的新影片同步進 Notion；新影片預設不顯示
  try {
    const cache = globalThis.caches && caches.default, key = new Request('https://joyjesus.com/__video_sync');
    if (cache && env.YOUTUBE_API_KEY && !(await cache.match(key))) {
      await cache.put(key, new Response('1', { headers: { 'Cache-Control': 'max-age=1800' } }));
      (waitUntil || (() => {}))(syncPlaylist(env).catch(() => {}));
    }
  } catch (e) { /* 同步失敗不影響頁面 */ }
  const seen = new Set();
  const vs = (await allVideos(env)).filter((v) => v.show && !seen.has(v.vid) && seen.add(v.vid)).sort(sortVideos);
  const pick = (v) => ({ id: v.vid, title: v.title, date: v.date });
  const featured = vs.filter((v) => v.star).map(pick);
  const byMonth = new Map();
  for (const v of vs.filter((x) => !x.star)) {
    const key = v.date ? v.date.slice(0, 7) : '未標日期';
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key).push(pick(v));
  }
  const months = [...byMonth.entries()]
    .sort((a, b) => (a[0] === '未標日期') - (b[0] === '未標日期') || b[0].localeCompare(a[0]))
    .map(([key, videos]) => ({
      key,
      title: key === '未標日期' ? '其他' : key.replace(/^(\d{4})-0?(\d+)$/, '$1 年 $2 月'),
      videos,
    }));
  return json({ featured, months }, 200, 120);
});
