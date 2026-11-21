// GET /api/public/topic?date=2026-09-22 — 查「那一天的團契主題」，給 Zoom 錄影自動上傳（Make）命名用
// 回傳 { found, date, series, topic, title }。title 例：雅各書｜小心你的嘴｜揪喜樂團契20260901
// 沒給 date 就用台北時間的今天。找不到時 found:false（自動化請改用 Zoom 會議主題）。
import { DB, notion, readSeries, handle, json, HttpError } from '../../../lib/notion.js';

export const onRequestGet = handle(async ({ env, request }) => {
  const q = new URL(request.url).searchParams.get('date');
  const date = q || new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'date 格式要是 YYYY-MM-DD');
  const r = await notion(env, `databases/${DB.series}/query`, {
    filter: { or: [1, 2, 3, 4, 5].map((n) => ({ property: `第${n}週`, date: { equals: date } })) },
    page_size: 5,
  });
  for (const pg of r.results) {
    const s = readSeries(pg), w = s.weeks.find((x) => x.date === date);
    if (!w) continue;
    const parts = [s.name, w.topic].filter(Boolean);
    parts.push('揪喜樂團契' + date.replace(/-/g, ''));
    return json({ found: true, date, series: s.name, topic: w.topic || '', title: parts.join('｜') }, 200, 60);
  }
  return json({ found: false, date });
});
