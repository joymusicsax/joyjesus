// GET /api/me — 登入者自己的航海日誌資料（需要 LINE 登入）
import { DB, notion, queryAll, P, id, handle, json, verifyLine, findMember,
  boatMap, boatOf, captainBoats, isSupervisor, logConfirmed, ENTRY_GROUP_URL, ENTRY_GROUP_MSG } from '../../lib/notion.js';

export const onRequestGet = handle(async ({ env, request }) => {
  const user = await verifyLine(env, request);
  const m = await findMember(env, user.userId);
  if (!m) return json({ user: { name: user.name }, member: null });

  const memberId = id(m);
  const circle = P.select(m, '圈層') || '小船船員';
  const roles = P.multi(m, '同工角色');
  const sup = isSupervisor(m);

  const [quests, logs, bm] = await Promise.all([
    queryAll(env, DB.quests, {
      filter: { property: '啟用', checkbox: { equals: true } },
      sorts: [{ property: '順序', direction: 'ascending' }],
    }),
    queryAll(env, DB.logs, { filter: { property: '成員', relation: { contains: memberId } } }),
    boatMap(env),
  ]);
  const questName = {};
  quests.forEach((q) => { questName[id(q)] = P.title(q, '任務名稱'); });

  // 只有確認過的才算完成；待確認另外標示
  const doneCount = {}, pendingQ = {};
  logs.forEach((lg) => P.rel(lg, '任務').forEach((q) => {
    if (logConfirmed(lg)) doneCount[q] = (doneCount[q] || 0) + 1;
    else if (P.select(lg, '確認狀態') === '待確認') pendingQ[q] = true;
  }));

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
      pending: !!pendingQ[id(q)],
    }));

  // 所在的船與船長
  let boat = null;
  const boatId = boatOf(m, bm);
  if (boatId && bm.byId[boatId]) {
    const b = bm.byId[boatId];
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
      assigned: P.rel(m, '所屬小船').length > 0,
    };
  }

  // 船長甲板：自己當船長的船上的船員＋待確認的回報；督導另外看得到所有同工的待確認
  let crew = null, pending = null;
  const myBoats = captainBoats(m, bm);
  if (myBoats.length || sup) {
    const rows = await queryAll(env, DB.members, {});
    const crewRows = rows.filter((r) => id(r) !== memberId && myBoats.includes(boatOf(r, bm)) && !P.multi(r, '同工角色').includes('船長'));
    const allPending = await queryAll(env, DB.logs, { filter: { property: '確認狀態', select: { equals: '待確認' } } });
    const crewIds = new Set(crewRows.map(id));
    const byId = {}; rows.forEach((r) => { byId[id(r)] = r; });

    // 船員的已確認完成數
    const confirmedLogs = crewRows.length
      ? await queryAll(env, DB.logs, { filter: { or: crewRows.slice(0, 90).map((r) => ({ property: '成員', relation: { contains: id(r) } })) } })
      : [];
    const doneBy = {};
    confirmedLogs.filter(logConfirmed).forEach((lg) => P.rel(lg, '成員').forEach((x) => { doneBy[x] = (doneBy[x] || 0) + 1; }));

    crew = crewRows.map((r) => ({
      boat: P.title(bm.byId[boatOf(r, bm)], '船名'),
      name: P.title(r, '暱稱'),
      status: P.select(r, '狀態'),
      circle: P.select(r, '圈層'),
      joined: P.date(r, '加入日期'),
      lastContact: P.date(r, '最後互動日'),
      needsCare: !!P.formula(r, '需要關心'),
      done: doneBy[id(r)] || 0,
    }));
    pending = allPending
      .filter((lg) => {
        const who = P.rel(lg, '成員')[0];
        if (!who || who === memberId) return false;
        return crewIds.has(who) || (sup && byId[who]);
      })
      .map((lg) => {
        const who = byId[P.rel(lg, '成員')[0]];
        return {
          id: id(lg),
          name: who ? P.title(who, '暱稱') : '',
          quest: questName[P.rel(lg, '任務')[0]] || P.title(lg, '紀錄'),
          date: P.date(lg, '完成日期'),
        };
      });
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
      isCaptain: myBoats.length > 0 || roles.includes('船長'),
      isSupervisor: sup,
      intro: P.text(m, '自我介紹'),
      introScope: P.select(m, '介紹公開範圍') || '只給船長',
    },
    boat,
    quests: questList,
    crew,
    pending,
    entry: { url: ENTRY_GROUP_URL, msg: ENTRY_GROUP_MSG },
  });
});
