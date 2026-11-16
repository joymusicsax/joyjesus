// GET /api/me — 登入者自己的航海日誌資料（需要 LINE 登入）
import { DB, notion, queryAll, P, id, handle, json, verifyLine, findMember,
  boatMap, boatOf, captainBoats, isSupervisor, logConfirmed, ENTRY_GROUP_URL, ENTRY_GROUP_MSG,
  currentSeries, seriesAttendance, todayTW, questLocked } from '../../lib/notion.js';
import { ONE_THING_MAP } from '../../lib/survey.js';

export const onRequestGet = handle(async ({ env, request }) => {
  const user = await verifyLine(env, request);
  const m = await findMember(env, user.userId);
  if (!m) return json({ user: { name: user.name }, member: null });

  const memberId = id(m);
  const circle = P.select(m, '圈層') || '小船船員';
  const roles = P.multi(m, '同工角色');
  const sup = isSupervisor(m);

  const seriesP = currentSeries(env).then(async (s) => {
    if (!s) return null;
    const [attendance, all] = await Promise.all([
      seriesAttendance(env, memberId, s.id),
      queryAll(env, DB.logs, { filter: { property: '系列', relation: { contains: s.id } } }),
    ]);
    const counts = {};
    all.forEach((lg) => { if (P.select(lg, '確認狀態') === '退回') return; const d = (P.date(lg, '系列聚會日') || '').slice(0, 10); if (d) counts[d] = (counts[d] || 0) + 1; });
    return { ...s, attendance, counts };
  }).catch((e) => { console.error(e); return null; });
  const surveysP = queryAll(env, DB.survey, {
    filter: { property: '成員', relation: { contains: memberId } },
    sorts: [{ property: '送出時間', direction: 'descending' }],
  }).catch(() => []);
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
      // 成長任務／角色任務
      layer: P.select(q, '任務圈層'),
      stage: P.select(q, '階段'),
      level: P.select(q, '難度'),
      roleTags: P.multi(q, '角色'),
      roleTier: P.select(q, '角色層次'),
      check: P.select(q, '檢核方式'),
      prompt: P.text(q, '送出內容'),
      thanks: P.text(q, '感謝回饋'),
      locked: questLocked(m, q),
    }));

  // 徽章：所有設了徽章的任務（不分圈層），已確認完成就點亮
  const badges = quests
    .filter((q) => { const b = P.select(q, '徽章'); return b && b !== '無'; })
    .map((q) => ({ name: P.select(q, '徽章'), note: P.text(q, 'LIFF 顯示說明'), done: doneCount[id(q)] || 0 }));

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
      code: P.select(b, '代碼'),
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
    // 督導看得到每一艘船的船員；船長看自己的船
    const seeBoats = sup ? bm.boats.map(id) : myBoats;
    const crewRows = rows.filter((r) => id(r) !== memberId && seeBoats.includes(boatOf(r, bm)) && !P.multi(r, '同工角色').includes('船長'));
    const allPending = await queryAll(env, DB.logs, { filter: { property: '確認狀態', select: { equals: '待確認' } } });
    const crewIds = new Set(crewRows.map(id));
    const byId = {}; rows.forEach((r) => { byId[id(r)] = r; });

    // 船員的已確認完成數
    const confirmedLogs = crewRows.length
      ? await queryAll(env, DB.logs, { filter: { or: crewRows.slice(0, 90).map((r) => ({ property: '成員', relation: { contains: id(r) } })) } })
      : [];
    const doneBy = {};
    confirmedLogs.filter(logConfirmed).forEach((lg) => P.rel(lg, '成員').forEach((x) => { doneBy[x] = (doneBy[x] || 0) + 1; }));

    // 船員的探索問卷（只給船長／督導看）
    const surveyRows = crewRows.length
      ? await queryAll(env, DB.survey, { filter: { or: crewRows.slice(0, 90).map((r) => ({ property: '成員', relation: { contains: id(r) } })) },
          sorts: [{ property: '送出時間', direction: 'descending' }] }).catch(() => [])
      : [];
    const surveyOf = (mid) => {
      const rs = surveyRows.filter((x) => P.rel(x, '成員').includes(mid));
      const sm = rs.find((x) => P.select(x, '問卷') === '小船問卷');
      const bg = rs.find((x) => P.select(x, '問卷') === '大船問卷');
      if (!sm && !bg) return null;
      return {
        small: sm ? { expect: P.multi(sm, '期待'), interact: P.multi(sm, '互動偏好'), cared: P.multi(sm, '被關心的方式'), support: P.multi(sm, '陪伴方式'), roles: P.multi(sm, '角色'), oneThing: P.text(sm, '這個月一件小事') } : null,
        big: bg ? { roles: P.multi(bg, '角色'), ready: P.multi(bg, '可以立即嘗試'), learn: P.multi(bg, '希望有人陪著學'), not: P.multi(bg, '目前不想承擔'), time: P.select(bg, '每月時間'), team: P.select(bg, '合作方式'), term: P.select(bg, '承擔多久'), need: P.multi(bg, '需要的支持'), mission: P.text(bg, '使命宣言') } : null,
      };
    };
    crew = crewRows.map((r) => ({
      survey: surveyOf(id(r)),
      boat: P.title(bm.byId[boatOf(r, bm)], '船名'),
      name: P.title(r, '暱稱'),
      status: P.select(r, '狀態'),
      circle: P.select(r, '圈層'),
      joined: (P.date(r, '加入日期') || '').slice(0, 10) || null,
      lastContact: (P.date(r, '最後互動日') || '').slice(0, 10) || null,
      needsCare: !!P.formula(r, '需要關心'),
      done: doneBy[id(r)] || 0,
    }));
    pending = allPending
      .filter((lg) => {
        const sd = (P.date(lg, '系列聚會日') || '').slice(0, 10);
        if (sd && sd > todayTW()) return false; // 還沒聚會的舉手，聚會後才需要確認出席
        const who = P.rel(lg, '成員')[0];
        if (!who || who === memberId) return false;
        return crewIds.has(who) || (sup && byId[who]);
      })
      .map((lg) => {
        const who = byId[P.rel(lg, '成員')[0]];
        return {
          id: id(lg),
          name: who ? P.title(who, '暱稱') : '',
          quest: questName[P.rel(lg, '任務')[0]] || (P.title(lg, '紀錄').split('｜')[1] || P.title(lg, '紀錄')),
          kind: P.select(lg, '紀錄方式') === '舉手參加' ? '有舉手，確認是否出席' : '我要挑戰',
          date: (P.date(lg, '完成日期') || '').slice(0, 10) || null,
        };
      });
  }

  const mySurveys = await surveysP;
  const lastOf = (t) => mySurveys.find((r) => P.select(r, '問卷') === t);
  const sm = lastOf('小船問卷'), bg = lastOf('大船問卷');
  const oneThing = sm ? P.text(sm, '這個月一件小事') : '';
  const survey = {
    small: sm ? { at: P.date(sm, '送出時間'), oneThing, oneThingQuest: ONE_THING_MAP[oneThing] || null, roles: P.multi(sm, '角色') } : null,
    big: bg ? { at: P.date(bg, '送出時間'), roles: P.multi(bg, '角色'), mission: P.text(bg, '使命宣言') } : null,
  };

  return json({
    user: { name: user.name },
    member: {
      name: P.title(m, '暱稱'),
      circle,
      status: P.select(m, '狀態'),
      roles,
      quiz: P.select(m, '測驗結果'),
      joined: (P.date(m, '加入日期') || '').slice(0, 10) || null,
      isCaptain: myBoats.length > 0 || roles.includes('船長'),
      isSupervisor: sup,
      intro: P.text(m, '自我介紹'),
      introScope: P.select(m, '介紹公開範圍') || '只給船長',
      region: P.text(m, '居住地區') || P.select(m, '地區') || '',
      partRoles: P.multi(m, '參與角色'),
    },
    survey,
    boat,
    quests: questList,
    series: await seriesP,
    badges,
    crew,
    pending,
    entry: { url: ENTRY_GROUP_URL, msg: ENTRY_GROUP_MSG },
  });
});
