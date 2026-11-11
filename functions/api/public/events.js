// GET /api/public/events — 近期聚會（官網「近期活動」與 LIFF「聚會消息」共用）
import { DB, queryAll, P, id, handle, json, todayTW } from '../../../lib/notion.js';

export const onRequestGet = handle(async ({ env }) => {
  const rows = await queryAll(env, DB.events, {
    filter: {
      and: [
        { property: 'Created', date: { on_or_after: todayTW() } },
        { or: [
          { property: 'Tags', select: { equals: '團契內容' } },
          { property: 'Tags', select: { equals: '團契活動' } },
        ] },
      ],
    },
    sorts: [{ property: 'Created', direction: 'ascending' }],
  });
  const events = rows.map((pg) => ({
    id: id(pg),
    title: P.title(pg, 'Name'),
    date: P.date(pg, 'Created'),
    kind: P.select(pg, '聚會形式'),        // 線上／實體／其他／null
    type: P.select(pg, 'Tags'),            // 團契內容／團契活動
    featured: P.check(pg, '顯示在下一站'),
    link: P.text(pg, '網址') || null,
  }));
  return json({ events }, 200, 300);
});
