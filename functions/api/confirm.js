// POST /api/confirm — 船長確認（或退回）船員回報的任務
// body: { logId, action: 'confirm' | 'reject' }
// 權限：這位船員所在的船，我是船長；或我是督導。不能確認自己的回報。
import { notion, updatePage, P, W, id, handle, json, verifyLine, findMember, readJson, todayTW, HttpError,
  boatMap, boatOf, captainBoats, isSupervisor } from '../../lib/notion.js';

export const onRequestPost = handle(async ({ env, request }) => {
  const user = await verifyLine(env, request);
  const { logId, action } = await readJson(request);
  if (!/^[0-9a-f]{32}$/.test(String(logId || '').replace(/-/g, ''))) throw new HttpError(400, '紀錄不存在');
  if (!['confirm', 'reject'].includes(action)) throw new HttpError(400, '動作不正確');

  const me = await findMember(env, user.userId);
  if (!me) throw new HttpError(403, '沒有權限');

  const lg = await notion(env, 'pages/' + logId, null, 'GET');
  if (P.select(lg, '確認狀態') !== '待確認') return json({ ok: true, already: true });
  const crewId = P.rel(lg, '成員')[0];
  if (!crewId || crewId === id(me)) throw new HttpError(403, '自己的任務要請船長確認');
  const crew = await notion(env, 'pages/' + crewId, null, 'GET');

  const bm = await boatMap(env);
  const allowed = isSupervisor(me) || captainBoats(me, bm).includes(boatOf(crew, bm));
  if (!allowed) throw new HttpError(403, '只有這艘船的船長可以確認');

  const today = todayTW();
  await updatePage(env, logId, {
    '確認狀態': W.select(action === 'confirm' ? '已確認' : '退回'),
    '確認者': W.rel([id(me)]),
    '確認日期': W.date(today),
  });
  // 確認也算一次互動
  if (action === 'confirm') await updatePage(env, crewId, { '最後互動日': W.date(today) }).catch(() => {});
  return json({ ok: true });
});
