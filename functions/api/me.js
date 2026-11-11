// GET /api/me — 登入者自己的航海日誌資料（需要 LINE 登入）
import { DB, notion, queryAll, P, id, handle, json, verifyLine, findMember } from '../../lib/notion.js';

export const onRequestGet = handle(async ({ env, request }) => {
  const user = await verifyLine(env, request);
  const m = await findMember(env, user.userId);
  if (!m) return json({ user: { name: user.name }, member: null });

  const memberId = id(m);
  const circle = P.select(m, '圈層') || '小船船員';
  const roles = P.multi(m, '同工角色');
  const boatIds = P.rel(m, '所屬小船');

  // 任務與完成紀錄
  const [quests, logs] = await Promise.all([
    queryAll(env, DB.quests, {
      filter: { property: '啟用', checkbox: { equals: true } },
      sorts: [{ property: '順序', direction: 'ascending' }],
    }),
    queryAll(env, DB.logs, { filter: { property: '成員', relation: { contains: memberId } } }),
  ]);
  const doneCount = {};
  logs.forEach((lg) => P.rel(lg, '任務').forEach((q) => { doneCount[q] = (doneCount[q] || 0) + 1; }));

  const visible = circle === '同工' ? ['同工', '大船船員'] : [circle];
  const questList = quests
    .filter((q) => P.multi(q, '適用圈層').some((c) => visible.includes(c)))
    .map((q) => ({
      id: id(q),
      name: P.title(q, '任務名稱'),
      type: P.select(q, '類型'),
      journey: P.select(q, '航程'),
      season: P.text(q, '季節') || null,
      order: P.num(q, '順序') || 0,
      badge: P.select(q, '徽章'),
      how: P.select(q, '完成方式'),
      note: P.text(q, 'LIFF 顯示說明'),
      done: doneCount[id(q)] || 0,
    }));

  // 所屬小船與船長
  let boat = null;
  if (boatIds[0]) {
    const b = await notion(env, 'pages/' + boatIds[0], null, 'GET');
    const capIds = P.rel(b, '船長');
    const sailorIds = P.rel(b, '水手');
    const names = await Promise.all(
      [...capIds, ...sailorIds].slice(0, 4).map((x) => notion(env, 'pages/' + x, null, 'GET').then((pg) => P.title(pg, '暱稱')).catch(() => ''))
    );
    boat = {
      name: P.title(b, '船名'),
      en: P.text(b, '英文名'),
      color: P.text(b, '主色') || '#B8503A',
      captain: names[0] || '',
      sailors: names.slice(capIds.length).filter(Boolean),
    };
  }

  // 船長甲板：只看得到自己當船長的船
  let crew = null;
  if (roles.includes('船長')) {
    const myBoats = await queryAll(env, DB.boats, { filter: { property: '船長', relation: { contains: memberId } } });
    crew = [];
    for (const b of myBoats) {
      const rows = await queryAll(env, DB.members, { filter: { property: '所屬小船', relation: { contains: id(b) } } });
      rows
        .filter((r) => id(r) !== memberId && !P.multi(r, '同工角色').includes('船長'))
        .forEach((r) => crew.push({
          boat: P.title(b, '船名'),
          name: P.title(r, '暱稱'),
          status: P.select(r, '狀態'),
          circle: P.select(r, '圈層'),
          roles: P.multi(r, '同工角色'),
          joined: P.date(r, '加入日期'),
          lastContact: P.date(r, '最後互動日'),
          needsCare: !!P.formula(r, '需要關心'),
          done: P.rollup(r, '已完成任務數') || 0,
        }));
    }
  }

  return json({
    user: { name: user.name },
    member: {
      name: P.title(m, '暱稱'),
      circle,
      status: P.select(m, '狀態'),
      roles,
      quiz: P.select(m, '測驗結果'),
      joined: P.date(m, '加入日期'),
      isCaptain: roles.includes('船長'),
    },
    boat,
    quests: questList,
    crew,
  });
});
