// GET /api/public/content — 小船、出航小隊、漂流瓶祝福（公開內容，不需登入）
import { DB, queryAll, P, id, handle, json } from '../../../lib/notion.js';

export const onRequestGet = handle(async ({ env }) => {
  const [boats, teams, blessings] = await Promise.all([
    queryAll(env, DB.boats, {
      filter: { property: '航行狀態', select: { equals: '航行中' } },
      sorts: [{ property: '排序', direction: 'ascending' }],
    }),
    queryAll(env, DB.teams, {
      filter: { property: '招募中', checkbox: { equals: true } },
      sorts: [{ property: '排序', direction: 'ascending' }],
    }),
    queryAll(env, DB.blessings, { filter: { property: '啟用', checkbox: { equals: true } } }),
  ]);
  return json({
    boats: boats.map((pg) => ({
      id: id(pg),
      name: P.title(pg, '船名'),
      en: P.text(pg, '英文名'),
      tagline: P.text(pg, '一句話'),
      forWhom: P.text(pg, '適合對象'),
      result: P.text(pg, '測驗結果文案'),
      color: P.text(pg, '主色') || '#B8503A',
      code: P.select(pg, '代碼'),
    })),
    teams: teams.map((pg) => ({
      id: id(pg),
      name: P.title(pg, '小隊名稱'),
      desc: P.text(pg, '說明'),
      commitment: P.multi(pg, '投入程度'),
    })),
    blessings: blessings.map((pg) => ({ text: P.title(pg, '經文'), ref: P.text(pg, '出處') })),
  }, 200, 300);
});
