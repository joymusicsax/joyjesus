// 團契系列管理（只有督導可以用）
// GET  /api/series/admin — 最近的系列
// POST /api/series/admin — 新增或更新  body: { id?, name, subtitle, weeks: [{date, topic}], current }
import { DB, notion, queryAll, createPage, updatePage, W, id, handle, json, verifyLine, findMember, readJson, HttpError,
  isSupervisor, readSeries } from '../../../lib/notion.js';

export async function requireSupervisor(env, request) {
  const user = await verifyLine(env, request);
  const m = await findMember(env, user.userId);
  if (!m || !isSupervisor(m)) throw new HttpError(403, '只有督導可以管理團契系列');
  return m;
}

export const onRequestGet = handle(async ({ env, request }) => {
  await requireSupervisor(env, request);
  const r = await notion(env, `databases/${DB.series}/query`, { sorts: [{ timestamp: 'created_time', direction: 'descending' }], page_size: 12 });
  return json({ series: r.results.map(readSeries) });
});

const okDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

export const onRequestPost = handle(async ({ env, request }) => {
  await requireSupervisor(env, request);
  const b = await readJson(request);
  const name = String(b.name || '').trim().slice(0, 60);
  if (!name) throw new HttpError(400, '請填系列名稱');
  const weeks = (Array.isArray(b.weeks) ? b.weeks : []).filter((w) => okDate(w.date)).slice(0, 5)
    .sort((a, c) => a.date.localeCompare(c.date));
  if (weeks.length < 1) throw new HttpError(400, '請至少填一個聚會日期');

  const props = {
    '系列名稱': W.title(name),
    '副標': String(b.subtitle || '').trim() ? W.text(String(b.subtitle).trim().slice(0, 120)) : { rich_text: [] },
    '目前系列': W.check(!!b.current),
  };
  for (let n = 1; n <= 5; n++) {
    const w = weeks[n - 1];
    props[`第${n}週`] = w ? W.date(w.date) : { date: null };
    props[`第${n}週主題`] = w && String(w.topic || '').trim() ? W.text(String(w.topic).trim().slice(0, 80)) : { rich_text: [] };
  }

  let pageId = b.id && /^[0-9a-f]{32}$/.test(String(b.id).replace(/-/g, '')) ? String(b.id).replace(/-/g, '') : null;
  if (pageId) {
    const pg = await notion(env, 'pages/' + pageId, null, 'GET');
    if ((pg.parent?.database_id || '').replace(/-/g, '') !== DB.series) throw new HttpError(400, '找不到這個系列');
    await updatePage(env, pageId, props);
  } else {
    pageId = id(await createPage(env, DB.series, props));
  }
  // 只能有一個「目前系列」
  if (b.current) {
    const others = await queryAll(env, DB.series, { filter: { property: '目前系列', checkbox: { equals: true } } });
    await Promise.all(others.filter((o) => id(o) !== pageId).map((o) => updatePage(env, id(o), { '目前系列': W.check(false) })));
  }
  return json({ ok: true, id: pageId });
});
