// POST /api/series/report — 船員勾選某一週的聚會日期＝回報出席（待船長確認）
// body: { date: 'YYYY-MM-DD' }
import { DB, queryAll, createPage, P, W, id, handle, json, verifyLine, findMember, readJson, todayTW, HttpError, currentSeries } from '../../../lib/notion.js';

export const onRequestPost = handle(async ({ env, request }) => {
  const user = await verifyLine(env, request);
  const m = await findMember(env, user.userId);
  if (!m) throw new HttpError(403, '請先登上一艘小船');
  const { date } = await readJson(request);
  const s = await currentSeries(env);
  if (!s) throw new HttpError(404, '目前沒有團契系列');
  const wk = s.weeks.find((w) => w.date === date);
  if (!wk) throw new HttpError(400, '這一天不是這個系列的聚會日');
  if (date > todayTW()) throw new HttpError(400, '聚會還沒開始喔，參加之後再回報');

  const prev = await queryAll(env, DB.logs, { filter: { and: [
    { property: '成員', relation: { contains: id(m) } },
    { property: '系列', relation: { contains: s.id } },
    { property: '系列聚會日', date: { equals: date } },
  ] } });
  if (prev.some((lg) => P.select(lg, '確認狀態') !== '退回')) return json({ ok: true, already: true });

  await createPage(env, DB.logs, {
    '紀錄': W.title(`${P.title(m, '暱稱')}｜${s.name} ${date.slice(5).replace('-', '/')}${wk.topic ? ' ' + wk.topic : ''}`),
    '成員': W.rel([id(m)]),
    '系列': W.rel([s.id]),
    '系列聚會日': W.date(date),
    '完成日期': W.date(todayTW()),
    '紀錄方式': W.select('船員回報'),
    '確認狀態': W.select('待確認'),
  });
  return json({ ok: true, pending: true });
});
