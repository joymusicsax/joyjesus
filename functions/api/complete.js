// POST /api/complete — 船員按「我要挑戰」。不會直接算完成，要等船長（或督導）確認。
// body: { questId }
import { DB, notion, queryAll, createPage, P, W, id, handle, json, verifyLine, findMember, readJson, nowTW, HttpError, questLocked } from '../../lib/notion.js';

export const onRequestPost = handle(async ({ env, request }) => {
  const user = await verifyLine(env, request);
  const { questId } = await readJson(request);
  if (!/^[0-9a-f]{32}$/.test(String(questId || '').replace(/-/g, ''))) throw new HttpError(400, '任務不存在');

  const m = await findMember(env, user.userId);
  if (!m) throw new HttpError(403, '請先登上一艘小船');

  const q = await notion(env, 'pages/' + questId, null, 'GET');
  if (!P.check(q, '啟用')) throw new HttpError(403, '這個任務目前沒有開放');
  if (questLocked(m, q)) throw new HttpError(403, '這是大船任務，登上大船後就會解鎖');
  const chk = P.select(q, '檢核方式');
  if (chk && !['船長確認', '舉手參加'].includes(chk)) throw new HttpError(400, '這個任務送出後系統會自動完成，不需要按我要挑戰');

  // 已經有待確認或已確認的紀錄就不重複回報（被退回的可以再回報）
  const prev = await queryAll(env, DB.logs, {
    filter: { and: [
      { property: '成員', relation: { contains: id(m) } },
      { property: '任務', relation: { contains: id(q) } },
    ] },
  });
  if (prev.some((lg) => P.select(lg, '確認狀態') !== '退回')) return json({ ok: true, already: true });

  await createPage(env, DB.logs, {
    '紀錄': W.title(`${P.title(m, '暱稱')}｜${P.title(q, '任務名稱')}`),
    '成員': W.rel([id(m)]),
    '任務': W.rel([id(q)]),
    '完成日期': W.datetime(nowTW()),
    '紀錄方式': W.select(chk === '舉手參加' ? '舉手參加' : '船員回報'),
    '確認狀態': W.select('待確認'),
  });
  return json({ ok: true, pending: true });
});
