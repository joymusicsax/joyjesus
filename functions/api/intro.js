// 自我介紹
// GET  /api/intro — 船員介紹列表
// POST /api/intro — 更新自己的自我介紹  body: { place, placeOther?, intro, scope }
// 規則：
//   暱稱＋居住地區：所有登船的團契成員都看得到
//   詳細介紹（與所在小船）：本人選擇
//     全團契：所有登船的成員　同船：同一艘船的人（含船長、水手）　只給船長：這艘船的船長
//   督導看得到全部
// 送出自我介紹＝完成第一個任務「寫下你的自我介紹」
import { DB, queryAll, updatePage, P, W, id, handle, json, verifyLine, findMember, readJson, HttpError,
  boatMap, boatOf, captainBoats, isSupervisor, parsePlace, completeIntroQuest } from '../../lib/notion.js';

const SCOPES = ['只給船長', '同船', '全團契'];

export const onRequestGet = handle(async ({ env, request }) => {
  const user = await verifyLine(env, request);
  const me = await findMember(env, user.userId);
  if (!me) throw new HttpError(403, '登上小船之後就能看船員介紹');

  const bm = await boatMap(env);
  const myBoat = boatOf(me, bm);
  const myCapBoats = captainBoats(me, bm);
  const sup = isSupervisor(me);

  const rows = await queryAll(env, DB.members, { sorts: [{ property: '加入日期', direction: 'descending' }] });
  const list = rows
    .filter((r) => P.select(r, '狀態') !== '暫時停泊')
    .map((r) => {
      const scope = P.select(r, '介紹公開範圍') || '只給船長';
      const b = boatOf(r, bm);
      const mine = id(r) === id(me);
      const canSee = mine || sup || scope === '全團契'
        || (scope === '同船' && !!b && (b === myBoat || myCapBoats.includes(b)))
        || (!!b && myCapBoats.includes(b));
      const intro = P.text(r, '自我介紹');
      return {
        name: P.title(r, '暱稱'),
        region: P.text(r, '居住地區') || P.select(r, '地區') || '',
        intro: canSee ? intro : '',
        hidden: !canSee && !!intro,
        scope: canSee ? scope : '',
        boat: canSee && b && bm.byId[b] ? P.title(bm.byId[b], '船名') : '',
        mine,
      };
    });
  list.sort((a, b) => (b.mine - a.mine));
  return json({ intros: list });
});

export const onRequestPost = handle(async ({ env, request }) => {
  const user = await verifyLine(env, request);
  const me = await findMember(env, user.userId);
  if (!me) throw new HttpError(403, '請先登上一艘小船');
  const { intro, scope, place, placeOther } = await readJson(request);
  const loc = parsePlace(place, placeOther);
  if (!SCOPES.includes(scope)) throw new HttpError(400, '請選擇誰看得到');
  const text = String(intro || '').trim().slice(0, 500);
  await updatePage(env, id(me), {
    '居住地區': W.text(loc.place),
    '地區': W.select(loc.area),
    '自我介紹': text ? W.text(text) : { rich_text: [] },
    '介紹公開範圍': W.select(scope),
  });
  const done = await completeIntroQuest(env, id(me), P.title(me, '暱稱'));
  return json({ ok: true, questDone: done });
});
