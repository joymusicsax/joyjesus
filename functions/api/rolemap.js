// GET /api/rolemap — 督導看的角色地圖：每個角色有哪些人（來自大船問卷）
import { DB, queryAll, P, id, handle, json, verifyLine, findMember, HttpError, isSupervisor } from '../../lib/notion.js';
import { ROLE_DESC } from '../../lib/survey.js';

export const onRequestGet = handle(async ({ env, request }) => {
  const user = await verifyLine(env, request);
  const me = await findMember(env, user.userId);
  if (!me || !isSupervisor(me)) throw new HttpError(403, '只有督導可以看角色地圖');
  const [members, surveys] = await Promise.all([
    queryAll(env, DB.members, {}),
    queryAll(env, DB.survey, { filter: { property: '問卷', select: { equals: '大船問卷' } }, sorts: [{ property: '送出時間', direction: 'descending' }] }),
  ]);
  const latest = {};
  surveys.forEach((s) => { const mid = P.rel(s, '成員')[0]; if (mid && !latest[mid]) latest[mid] = s; });
  const roles = Object.keys(ROLE_DESC).map((r) => ({ role: r, desc: ROLE_DESC[r], people: [] }));
  members.forEach((m) => {
    const s = latest[id(m)];
    P.multi(m, '參與角色').forEach((r) => {
      const g = roles.find((x) => x.role === r); if (!g) return;
      g.people.push({
        name: P.title(m, '暱稱'),
        circle: P.select(m, '圈層'),
        ready: s ? P.multi(s, '可以立即嘗試').includes(r) : false,
        learn: s ? P.multi(s, '希望有人陪著學').includes(r) : false,
        time: s ? P.select(s, '每月時間') : null,
        team: s ? P.select(s, '合作方式') : null,
        term: s ? P.select(s, '承擔多久') : null,
      });
    });
  });
  return json({ roles });
});
