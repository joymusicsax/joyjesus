// GET /api/public/videos — 官網「影片回顧」用：第一列是有星號的，其餘依月份分組（新月份在前）
import { handle, json } from '../../../lib/notion.js';
import { allVideos, sortVideos } from '../../../lib/videos.js';

export const onRequestGet = handle(async ({ env }) => {
  const vs = (await allVideos(env)).filter((v) => v.show).sort(sortVideos);
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
