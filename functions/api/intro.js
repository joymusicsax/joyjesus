// 自我介紹
// GET  /api/intro — 我看得到的自我介紹
// POST /api/intro — 更新自己的自我介紹  body: { intro, scope: '只給船長' | '同船' | '全團契' }
// 可見規則（本人選擇）：
//   全團契：所有已登船的成員
//   同船　：同一艘船的人（含船長、水手）
//   只給船長：這艘船的船長
//   督導看得到全部
import { DB, queryAll, updatePage, P, W, id, handle, json, verifyLine, findMember, readJson, HttpError,
  boatMap, boatOf, captainBoats, isSupervisor } from '../../lib/notion.js';

const SCOPES = ['只給船長', '同船', '全團契'];

export const onRequestGet = handle(async ({ env, request }) => {
  const user = await verifyLine(env, request);
  const me = await findMember(env, user.userId);
  if (!me) throw new HttpError(403, '登上小船之後就能看船員介紹');

  const bm = await boatMap(env);
  const myBoat = boatOf(me, bm);
  const myCapBoats = captainBoats(me, bm);
  const sup = isSupervisor(me);

  const rows = await queryAll(env, DB.members, {
    filter: { property: '自我介紹', rich_text: { is_not_empty: true } },
    sorts: [{ property: '加入日期', direction: 'descending' }],
  });
  const list = rows.filter((r) => {
    if (id(r) === id(me) || sup) return true;
    const scope = P.select(r, '介紹公開範圍') || '只給船長';
    const b = boatOf(r, bm);
    if (scope === '全團契') return true;
    if (scope === '同船') return !!b && (b === myBoat || myCapBoats.includes(b));
    return !!b && myCapBoats.includes(b);
  }).map((r) => {
    const b = boatOf(r, bm);
    return {
      name: P.title(r, '暱稱'),
      intro: P.text(r, '自我介紹'),
      scope: P.select(r, '介紹公開範圍') || '只給船長',
      boat: b && bm.byId[b] ? P.title(bm.byId[b], '船名') : '',
      joined: P.date(r, '加入日期'),
      mine: id(r) === id(me),
    };
  });
  return json({ intros: list });
});

export const onRequestPost = handle(async ({ env, request }) => {
  const user = await verifyLine(env, request);
  const me = await findMember(env, user.userId);
  if (!me) throw new HttpError(403, '請先登上一艘小船');
  const { intro, scope } = await readJson(request);
  if (!SCOPES.includes(scope)) throw new HttpError(400, '請選擇誰看得到');
  const text = String(intro || '').trim().slice(0, 500);
  await updatePage(env, id(me), {
    '自我介紹': text ? W.text(text) : { rich_text: [] },
    '介紹公開範圍': W.select(scope),
  });
  return json({ ok: true });
});
