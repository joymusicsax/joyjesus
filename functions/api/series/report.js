// POST /api/series/report — 團契系列「舉手參加」
// body: { date: 'YYYY-MM-DD', on: true | false }
//   on=true  舉手：新增一筆「舉手參加」紀錄（確認狀態＝待確認），讓同工提前知道人數
//   on=false 放下手：刪除自己還沒被確認的那筆
// 聚會過後，船長／督導在船長甲板確認出席 → 已確認＝完成這一週
import { DB, notion, queryAll, createPage, P, W, id, handle, json, verifyLine, findMember, readJson, nowTW, HttpError, currentSeries } from '../../../lib/notion.js';

export const onRequestPost = handle(async ({ env, request }) => {
  const user = await verifyLine(env, request);
  const m = await findMember(env, user.userId);
  if (!m) throw new HttpError(403, '請先登上一艘小船');
  const { date, on } = await readJson(request);
  const s = await currentSeries(env);
  if (!s) throw new HttpError(404, '目前沒有團契系列');
  const wk = s.weeks.find((w) => w.date === date);
  if (!wk) throw new HttpError(400, '這一天不是這個系列的聚會日');

  const mine = await queryAll(env, DB.logs, { filter: { and: [
    { property: '成員', relation: { contains: id(m) } },
    { property: '系列', relation: { contains: s.id } },
    { property: '系列聚會日', date: { equals: date } },
  ] } });
  const active = mine.filter((lg) => P.select(lg, '確認狀態') !== '退回');

  if (on === false) {
    if (active.some((lg) => P.select(lg, '確認狀態') !== '待確認')) throw new HttpError(400, '船長已經確認你出席了，不能取消');
    await Promise.all(active.map((lg) => notion(env, 'pages/' + id(lg), { archived: true }, 'PATCH')));
    return json({ ok: true, on: false });
  }
  if (active.length) return json({ ok: true, already: true });
  await createPage(env, DB.logs, {
    '紀錄': W.title(`${P.title(m, '暱稱')}｜${s.name} ${date.slice(5).replace('-', '/')}${wk.topic ? ' ' + wk.topic : ''}`),
    '成員': W.rel([id(m)]),
    '系列': W.rel([s.id]),
    '系列聚會日': W.date(date),
    '完成日期': W.datetime(nowTW()),
    '紀錄方式': W.select('舉手參加'),
    '確認狀態': W.select('待確認'),
  });
  return json({ ok: true, on: true });
});
