/* 揪喜樂航海日誌（LIFF）— 單頁應用，無需打包工具 */
(function () {
  'use strict';
  var CFG = window.JOY_CONFIG || {};
  var S = { ready: false, loggedIn: false, token: null, me: null, content: null, events: null, error: null, view: 'map', boardKind: 'pray', deckMode: null, filter: 'all', bless: -1 };
  var $view = document.getElementById('view');
  var $sheet = document.getElementById('sheet');

  // ---------- 小工具 ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function api(path, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    if (S.token) headers.Authorization = 'Bearer ' + S.token;
    return fetch(path, { method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && S.token) { S.authFailed = true; }
        if (!r.ok) throw new Error(j.error || '連線失敗，請稍後再試');
        return j;
      }); });
  }
  // LINE 的 ID token 大約一小時就過期；LIFF 會一直沿用快取的舊 token，所以要自己檢查
  function tokenExpired(t) {
    try { var p = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return p.exp * 1000 < Date.now() + 60000; } catch (e) { return true; }
  }
  function relogin() {
    if (!window.liff || !S.ready) { alert(S.error || '請在 LINE 裡打開這個頁面'); return; }
    if (liff.isInClient()) { location.reload(); return; }
    try { liff.logout(); } catch (e) {}
    liff.login({ redirectUri: location.href });
  }
  var WD = ['日', '一', '二', '三', '四', '五', '六'];
  function md(d) { var x = new Date(d + 'T00:00:00+08:00'); return { m: x.getMonth() + 1, d: x.getDate(), wd: '週' + WD[x.getDay()] }; }
  function daysUntil(d) { var t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((new Date(d + 'T00:00:00+08:00') - t) / 864e5); }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function login() {
    if (!window.liff || !S.ready) { alert(S.error || '登入元件還沒準備好，請重新整理或在 LINE 裡打開這個頁面'); return; }
    if (!liff.isLoggedIn()) liff.login({ redirectUri: location.href });
    else relogin();
  }

  // ---------- 啟動 ----------
  function boot() {
    var hasLiff = window.liff && CFG.liffId && CFG.liffId !== 'YOUR_LIFF_ID';
    var p = hasLiff ? liff.init({ liffId: CFG.liffId }).then(function () {
      S.ready = true;
      S.loggedIn = liff.isLoggedIn();
      if (S.loggedIn) {
        var t = liff.getIDToken();
        if (t && !tokenExpired(t)) S.token = t;
        else if (!liff.isInClient()) {
          // 外部瀏覽器的登入過期：登出，自動重新登入一次（同一個分頁只試一次，避免無限迴圈）
          try { liff.logout(); } catch (e) {}
          S.loggedIn = false;
          var tried = false; try { tried = sessionStorage.getItem('joy_relogin') === '1'; sessionStorage.setItem('joy_relogin', '1'); } catch (e) {}
          if (!tried) { liff.login({ redirectUri: location.href }); return; }
        } else {
          S.token = t;
        }
      }
      if (S.token) { try { sessionStorage.removeItem('joy_relogin'); } catch (e) {} }
    }).catch(function (e) { S.error = 'LINE 初始化失敗：' + e.message; }) : Promise.resolve();
    p.then(function () {
      route();
      api('/api/public/content').then(function (c) { S.content = c; render(); }).catch(function () {});
      api('/api/public/events').then(function (e) { S.events = e.events; render(); }).catch(function () {});
      if (S.token) loadMe();
    });
  }
  function loadMe() {
    S.meError = null;
    return api('/api/me').then(function (j) { S.me = j; render(); }).catch(function (e) { S.meError = e.message; render(); });
  }

  // ---------- 路由 ----------
  function route() {
    var seg = location.pathname.replace(/^\/liff\/?/, '').split('/')[0];
    S.view = ['log', 'news', 'deck'].indexOf(seg) >= 0 ? seg : 'map';
    if (S.view !== 'map' && !S.loggedIn) { S.view = 'map'; }
    render();
  }
  document.querySelector('.tabs').addEventListener('click', function (e) {
    var a = e.target.closest('a'); if (!a) return;
    e.preventDefault();
    if (a.hasAttribute('data-lock') && !S.loggedIn) { login(); return; }
    history.pushState(null, '', a.getAttribute('href'));
    route(); window.scrollTo(0, 0);
  });
  window.addEventListener('popstate', route);

  // ---------- 畫面 ----------
  function render() {
    document.querySelectorAll('.tabs a').forEach(function (a) {
      a.toggleAttribute('aria-current', a.dataset.view === S.view);
      if (a.dataset.view === S.view) a.setAttribute('aria-current', 'page');
      a.classList.toggle('locked', a.hasAttribute('data-lock') && !S.loggedIn);
    });
    var cap = S.me && S.me.member && (S.me.member.isCaptain || S.me.member.isSupervisor);
    document.getElementById('deckLabel').textContent = cap ? '船長甲板' : '船員甲板';
    document.getElementById('topTitle').textContent = { map: '揪喜樂團契', log: '航海日誌', news: '聚會消息', deck: cap ? '船長甲板' : '船員甲板' }[S.view];
    var html = S.error ? '<p class="err">' + esc(S.error) + '</p>' : '';
    html += ({ map: viewMap, log: viewLog, news: viewNews, deck: viewDeck })[S.view]();
    $view.innerHTML = html;
  }
  function spinner() { return '<div class="spin" role="status" aria-label="載入中"></div>'; }

  // ----- 航海地圖 -----
  function viewMap() {
    var m = S.me && S.me.member;
    var name = m ? m.name : (S.me ? S.me.user.name : '旅人');
    var h = '<div><p class="h1">嗨，' + esc(name) + '</p><p class="tiny" style="margin-top:2px">今天也歡迎靠岸。</p></div>';
    h += blessCard() + mapCard();
    if (!S.loggedIn) h += '<div class="card"><p class="h2">用 LINE 登入，開始你的航程</p><p class="small" style="margin:6px 0 10px">航海日誌、聚會消息、船員甲板需要登入 LINE 才看得到。我們只會讀取你的 LINE 名稱。</p><button class="btn line" data-act="login">用 LINE 登入</button></div>';
    else if (!S.me && S.meError) h += authErrCard();
    else if (!S.me) h += spinner();
    else if (!m) h += '<button class="card" data-act="quiz" style="text-align:left;display:flex;gap:12px;align-items:center;background:#FDF1EA;border-color:#F0C9B8"><span style="flex:1"><span class="h2" style="display:block">你還沒有小船</span><span class="small">三個問題，找到最適合你的入口。</span></span><span class="btn">開始</span></button>';
    else h += voyageCard();
    h += nextPortCard();
    return h;
  }
  function authErrCard() {
    return '<div class="card" style="display:flex;flex-direction:column;gap:8px;border-color:#F0C9B8;background:#FDF1EA"><p class="h2">讀取你的資料時出了點問題</p><p class="small">' + esc(S.meError) + '</p><button class="btn line" style="align-self:flex-start" data-act="relogin">重新登入</button></div>';
  }
  function blessCard() {
    var list = (S.content && S.content.blessings) || [];
    var b = S.bless >= 0 ? list[S.bless] : null;
    return '<div class="card" style="display:flex;flex-direction:column;gap:8px"><p class="kicker" style="color:var(--brown)">BLESSING BOTTLE</p>' +
      (b ? '<p style="font-size:15px;line-height:1.75;font-weight:700">' + esc(b.text) + '</p><p class="tiny">' + esc(b.ref) + '</p>'
         : '<p class="small">今天需要一句話嗎？從漂流瓶裡抽一張祝福。</p>') +
      '<button class="btn" style="background:var(--brown);align-self:flex-start" data-act="bless"' + (list.length ? '' : ' disabled') + '>' + (b ? '再抽一張' : '抽一張祝福') + '</button></div>';
  }
  function mapCard() {
    return '<div class="map"><svg viewBox="0 0 1100 700" aria-hidden="true">' +
      '<rect width="1100" height="700" fill="#5FB3C4"/>' +
      '<path d="M330 300C340 210 470 170 580 190C700 205 790 240 780 320C772 390 700 430 600 430C470 440 330 400 330 300Z" fill="#F1E2C2"/>' +
      '<path d="M380 290C390 230 480 210 560 222C650 232 720 262 712 315C700 360 640 380 560 380C470 384 375 350 380 290Z" fill="#A9CF8F"/>' +
      '<rect x="515" y="266" width="60" height="38" fill="#FFF6E6"/><path d="M507 269L545 240L583 269Z" fill="#D9673F"/>' +
      '<g transform="translate(640 380)"><g fill="none" stroke-width="7" opacity=".55"><path d="M10 110A110 110 0 0 1 230 110" stroke="#E5534B"/><path d="M20 110A100 100 0 0 1 220 110" stroke="#F2C14E"/><path d="M30 110A90 90 0 0 1 210 110" stroke="#5BAE6A"/><path d="M40 110A80 80 0 0 1 200 110" stroke="#4A7FC1"/></g><path d="M55 70L120 38L185 70Z" fill="#6B3F22"/><rect x="65" y="68" width="110" height="42" fill="#C98B4E"/><path d="M8 108L232 108L208 146Q120 160 32 146Z" fill="#8A5A34"/></g>' +
      '<g transform="translate(150 560)"><path d="M0 0L72 0L60 20L12 20Z" fill="#C98B4E"/><path d="M39 -40L39 -4L66 -4Z" fill="#fff"/></g>' +
      '<circle cx="300" cy="610" r="14" fill="none" stroke="#fff" stroke-width="9"/>' +
      '<g transform="translate(860 230) rotate(-28)"><path d="M0 26L110 26L142 12L128 36L8 40Z" fill="#fff"/><path d="M50 26L68 12L92 12L92 26Z" fill="#7FB6C9"/></g>' +
      '</svg>' +
      '<button class="pin" style="left:69%;top:84%" data-act="sheet" data-k="ark"><b style="background:var(--brown)">01</b>方舟</button>' +
      '<button class="pin" style="left:22%;top:72%" data-act="sheet" data-k="care"><b style="background:var(--brick)">02</b>小船</button>' +
      '<button class="pin" style="left:86%;top:22%" data-act="sheet" data-k="sail"><b style="background:var(--teal)">03</b>快艇</button></div>';
  }
  function mainQuest() {
    var q = (S.me && S.me.quests) || [];
    var m = S.me.member;
    var journey = m.circle === '小船船員' ? '登船之旅' : '季節航程';
    var list = q.filter(function (x) { return x.type === '主線' && x.journey === journey; });
    var season = list[0] && list[0].season;
    if (season) list = list.filter(function (x) { return x.season === season; });
    list.sort(function (a, b) { return a.order - b.order; });
    return { title: season || journey, list: list, done: list.filter(function (x) { return x.done; }).length };
  }
  function voyageCard() {
    var mq = mainQuest(), boat = S.me.boat;
    var next = mq.list.filter(function (x) { return !x.done; })[0];
    var pct = mq.list.length ? Math.round(mq.done / mq.list.length * 100) : 0;
    return '<a class="card" href="/liff/log" data-nav style="text-decoration:none;color:inherit;display:flex;flex-direction:column;gap:10px">' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline"><div><p class="kicker" style="color:var(--brick)">MY VOYAGE' + (boat ? '・' + esc(boat.name) : '') + '</p><p class="h2" style="margin-top:2px">' + esc(mq.title) + '</p></div>' +
      '<p style="font-family:Fraunces,serif;font-style:italic;font-size:20px;color:var(--brick)">' + mq.done + ' / ' + mq.list.length + '</p></div>' +
      '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      '<p class="small">' + (next ? '下一關：' + esc(next.name) : '這段航程完成了！') + '</p><span style="font-size:13px;font-weight:700;color:var(--brick)">打開航海日誌 →</span></a>';
  }
  function nextPortCard() {
    var ev = S.events || [];
    var f = ev.filter(function (e) { return e.featured; })[0] || ev[0];
    if (!f) return '';
    var d = md(f.date), n = daysUntil(f.date);
    return '<div class="hero" style="flex-direction:row;align-items:center;gap:12px"><div style="flex:1"><p class="kicker" style="color:var(--gold)">NEXT PORT</p><p style="font-size:16px;font-weight:900;margin-top:3px">' + d.m + '/' + d.d + '（' + d.wd.slice(1) + '）' + esc(f.title) + '</p><p style="font-size:12px;color:#C9D3DF;margin-top:2px">' + (n > 0 ? '還有 ' + n + ' 天' : '就是今天') + (f.kind ? '・' + esc(f.kind) : '') + '</p></div>' +
      (S.loggedIn ? '<a class="btn" style="background:var(--gold);color:var(--navy)" href="/liff/news" data-nav>看詳情</a>' : '') + '</div>';
  }

  // ----- 航海日誌 -----
  function viewLog() {
    if (!S.me) return S.meError ? authErrCard() : spinner();
    var m = S.me.member;
    if (!m) return '<div class="card"><p class="h2">你還沒有小船</p><p class="small" style="margin:6px 0 12px">做完三題小測驗，登上適合你的小船，航海日誌就會開始記錄你的航程。</p><button class="btn" data-act="quiz">開始測驗</button></div>';
    var boat = S.me.boat, color = boat ? boat.color : 'var(--brick)';
    var days = m.joined ? Math.max(1, 1 - daysUntil(m.joined)) : 0;
    var h = '<div class="card" style="display:flex;gap:14px;align-items:center">' + boatBadge(boat, 60) + '<div style="flex:1;min-width:0"><p class="kicker" style="color:' + esc(color) + '">' + esc(boat ? boat.en : 'ON BOARD') + '</p><p class="h1" style="margin-top:2px">' + esc(m.name) + '</p><p class="small">' + esc(boat ? boat.name : m.circle) + (days ? '・上船第 ' + days + ' 天' : '') + (m.status === '待船長聯繫' ? '・等船長打招呼' : '') + '</p></div></div>';
    if (boat && boat.captain) h += '<div class="card" style="display:flex;align-items:center;gap:12px"><span class="avatar" style="width:40px;height:40px;background:var(--gold)">' + esc(boat.captain.slice(0, 1)) + '</span><div style="flex:1;min-width:0"><p class="tiny">你的船長</p><p style="font-weight:700">' + esc(boat.captain) + (boat.sailors.length ? ' ＋ 水手 ' + esc(boat.sailors.join('、')) : '') + '</p></div><a class="btn line" style="padding:8px 12px;font-size:13px;white-space:nowrap" href="' + esc(oaMessage('我是' + m.name + '（' + boat.name + '），想找船長' + boat.captain + '聊聊')) + '" target="_blank" rel="noopener">傳訊息</a></div>';
    if (m.status === '待船長聯繫') h += entryCard();
    h += introCard(m);
    var mq = mainQuest(), firstOpen = true;
    h += '<div class="card" style="display:flex;flex-direction:column;gap:12px"><div style="display:flex;justify-content:space-between;align-items:baseline"><div><p class="kicker" style="color:var(--brick)">MAIN QUEST・主線</p><p class="h2" style="margin-top:2px">' + esc(mq.title) + '</p></div><p style="font-family:Fraunces,serif;font-style:italic;font-size:22px;color:var(--brick)">' + mq.done + ' / ' + mq.list.length + '</p></div>';
    h += '<div class="bar"><i style="width:' + (mq.list.length ? Math.round(mq.done / mq.list.length * 100) : 0) + '%"></i></div><div class="steps">';
    mq.list.forEach(function (q) {
      var isNext = !q.done && firstOpen; if (isNext) firstOpen = false;
      var gather = isNext && /聚會/.test((q.how || '') + q.name);
      var ev = gather ? nextEvent() : null;
      var sub = ev ? '下一站：' + fmtEvent(ev) : (q.note || '');
      h += '<div class="step' + (isNext ? ' next' : '') + '"><span class="chk' + (q.done ? ' on' : '') + '"></span><div style="flex:1;min-width:0"><p style="font-size:14px;' + (isNext ? 'font-weight:700' : '') + '" class="' + (q.done ? 'done-text' : '') + '">' + esc(q.name) + '</p>' + (isNext && sub ? '<p class="tiny" style="margin-top:3px">' + esc(sub) + '</p>' : '') +
        (gather && !q.pending ? '<p class="tiny" style="margin-top:3px">參加後按「回報完成」，船長確認就打勾。</p>' : '') + '</div>' +
        (isNext ? '<span style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">' + (gather && !q.pending ? '<a class="btn" style="padding:6px 12px;font-size:12px;white-space:nowrap" href="' + esc(ev && ev.link ? ev.link : '/liff/news') + '"' + (ev && ev.link ? ' target="_blank" rel="noopener"' : ' data-nav') + '>報名</a>' : '') + reportBtn(q, gather) + '</span>' : (!q.done && q.pending ? pendingTag() : '')) + '</div>';
    });
    if (!mq.list.length) h += '<p class="tiny">這一季的任務還沒公布。</p>';
    h += '</div>' + (m.circle === '小船船員' ? '<p class="tiny">沒有截止日，準備好再出發。完成後按「回報完成」，船長確認後才會打勾。</p>' : '<p class="tiny">完成後按「回報完成」，由船長或督導確認。</p>') + '</div>';
    var side = S.me.quests.filter(function (x) { return x.type === '支線'; }).sort(function (a, b) { return a.order - b.order; });
    var drew = store('joy-bless-day') === todayKey();
    {
      h += '<div class="card" style="display:flex;flex-direction:column;gap:10px"><p class="kicker" style="color:var(--brown)">SIDE QUEST・支線</p>';
      h += '<a class="row" href="/liff/" data-nav style="text-decoration:none;color:inherit"><span style="flex:1;font-size:14px;font-weight:700">從漂流瓶抽一張祝福</span><span class="tiny" style="' + (drew ? 'color:#2F7A44;font-weight:700' : '') + '">' + (drew ? '今天已抽' : '每天一張') + '</span></a>';
      side.forEach(function (q) {
        var right = !q.done ? reportBtn(q, true)
          : q.badge && q.badge !== '無' ? '<span style="display:flex;gap:3px">' + [0, 1, 2].map(function (i) { return '<span class="dot" style="width:7px;height:7px;background:' + (i < q.done ? 'var(--brown)' : '#E6DECF') + '"></span>'; }).join('') + '</span>'
          : '<span class="tiny">' + (q.done ? '已完成' : '未開始') + '</span>';
        h += '<div class="row"><span style="flex:1"><span style="display:block;font-size:14px;font-weight:700">' + esc(q.name) + '</span>' + (q.note ? '<span class="tiny">' + esc(q.note) + '</span>' : '') + '</span>' + right + '</div>';
      });
      h += '</div>';
    }
    h += badgeShelf(boat);
    return h;
  }

  function todayKey() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function oaMessage(text) {
    var id = (CFG.oaId || '@126rtjnb').replace(/^@?/, '@');
    return 'https://line.me/R/oaMessage/' + encodeURIComponent(id) + '/?' + encodeURIComponent(text);
  }
  function nextEvent() {
    var ev = S.events || [];
    return ev.filter(function (e) { return e.featured; })[0] || ev[0] || null;
  }
  function fmtEvent(e) { var d = md(e.date); return d.m + '/' + d.d + '（' + d.wd.slice(1) + '）' + e.title + (e.kind ? '・' + e.kind : ''); }
  // 小船徽章：三艘船各自的圖樣
  function boatBadge(boat, size) {
    var c = boat ? boat.color : '#B8503A', code = boat && boat.code;
    var inner = code === 'grace' ? '<path d="M18 34c4-4 8-4 12 0s8 4 12 0" fill="none" stroke="#F5EDE1" stroke-width="4" stroke-linecap="round"/><path d="M18 26c4-4 8-4 12 0s8 4 12 0" fill="none" stroke="#F5EDE1" stroke-width="3" stroke-linecap="round" opacity=".6"/>'
      : code === 'moses' ? '<path d="M20 18v24M40 18v24" stroke="#F5EDE1" stroke-width="5" stroke-linecap="round"/><path d="M30 20v20" stroke="#F5EDE1" stroke-width="2" stroke-dasharray="3 3"/>'
      : '<circle cx="30" cy="30" r="10" fill="none" stroke="#F5EDE1" stroke-width="6"/><circle cx="30" cy="30" r="10" fill="none" stroke="#C2553A" stroke-width="6" stroke-dasharray="7.85 7.85"/>';
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 60 60" role="img" aria-label="' + esc(boat ? boat.name : '小船') + '徽章" style="flex-shrink:0"><circle cx="30" cy="30" r="28" fill="' + esc(c) + '"/><circle cx="30" cy="30" r="23" fill="none" stroke="#F5EDE1" stroke-width="1.5" stroke-dasharray="3 3"/>' + inner + '</svg>';
  }
  var BADGE_ICON = {
    '靠港印記': '<path d="M26 15v20M19 30c2 5 12 5 14 0M21 19h10"/>',
    '燈塔守望': '<path d="M22 36l2-18h4l2 18zM21 18h10"/>',
    '漂流瓶故事': '<path d="M23 14h6v5l3 4v14H20V23l3-4z"/>'
  };
  function badgeShelf(boat) {
    var list = S.me.badges || [];
    var h = '<div style="display:flex;flex-direction:column;gap:8px"><p style="font-size:13px;font-weight:700;color:var(--ink2)">我的徽章</p><div style="display:flex;gap:10px;flex-wrap:wrap">';
    if (boat) h += '<span title="' + esc(boat.name) + '新人徽章">' + boatBadge(boat, 52) + '</span>';
    list.forEach(function (b) {
      var on = b.done > 0;
      h += '<svg width="52" height="52" viewBox="0 0 52 52" role="img" aria-label="' + esc(b.name) + (on ? '，已獲得' : '，未獲得：' + (b.note || '')) + '"><title>' + esc(b.name) + (on ? '' : '：' + (b.note || '')) + '</title><circle cx="26" cy="26" r="24" fill="' + (on ? '#8A5A34' : '#E6DECF') + '"/><g fill="none" stroke="' + (on ? '#F5EDE1' : '#B3A68F') + '" stroke-width="2.5">' + (BADGE_ICON[b.name] || '<circle cx="26" cy="26" r="8"/>') + '</g></svg>';
    });
    return h + '</div><p class="tiny">灰色的徽章登上大船後就能開始收集。</p></div>';
  }
  function reportBtn(q, ghost) {
    if (q.pending) return pendingTag();
    return '<button class="btn' + (ghost ? ' ghost' : '') + '" style="padding:6px 12px;font-size:12px;white-space:nowrap" data-act="complete" data-id="' + q.id + '">回報完成</button>';
  }
  function pendingTag() { return '<span class="tag" style="background:#FFF4D6;color:#9A7012;white-space:nowrap">待船長確認</span>'; }
  function entryCard() {
    var e = S.me.entry || {};
    return '<div class="card" style="display:flex;flex-direction:column;gap:8px;background:#EAF4EC;border-color:#BFDCC6"><p class="kicker" style="color:#2F7A44">BOARDING PASS・登船邀請</p><p style="font-size:14px;line-height:1.7">' + esc(e.msg || '') + '</p><a class="btn line" style="align-self:flex-start" href="' + esc(e.url || '#') + '" target="_blank" rel="noopener">加入入口群組</a></div>';
  }
  var SCOPE_NOTE = { '只給船長': '只有你的船長看得到', '同船': '同一艘船的人看得到', '全團契': '所有登船的團契成員看得到' };
  var PLACES = [
    ['北部', ['台北市', '新北市', '基隆市', '桃園市', '新竹市', '新竹縣', '宜蘭縣']],
    ['中部', ['苗栗縣', '台中市', '彰化縣', '南投縣', '雲林縣']],
    ['南部', ['嘉義市', '嘉義縣', '台南市', '高雄市', '屏東縣']],
    ['東部', ['花蓮縣', '台東縣']],
    ['離島', ['澎湖縣', '金門縣', '連江縣']],
    ['海外', ['馬來西亞', '香港', '新加坡', '中國', '澳洲', '美國', '加拿大', '其他']]
  ];
  var KNOWN = {}; PLACES.forEach(function (g) { g[1].forEach(function (p) { KNOWN[p] = 1; }); });
  function introCard(m) {
    return '<div class="card" style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;justify-content:space-between;align-items:baseline"><p class="kicker" style="color:var(--teal)">HELLO・自我介紹</p><span class="tiny">詳細介紹：' + esc(SCOPE_NOTE[m.introScope] || '') + '</span></div>' +
      '<p class="small">居住地區：<b>' + esc(m.region || '還沒填') + '</b>　<span class="tiny">（暱稱和地區全團契看得到）</span></p>' +
      (m.intro ? '<p style="font-size:14px;line-height:1.75;white-space:pre-wrap">' + esc(m.intro) + '</p>' : '<p class="small">還沒寫自我介紹。想讓船長和船員怎麼認識你？</p>') +
      '<button class="btn ghost" style="align-self:flex-start;padding:6px 12px;font-size:12px" data-act="intro-edit">' + (m.intro || m.region ? '編輯' : '寫自我介紹') + '</button></div>';
  }
  function introFields(intro, scope, region) {
    scope = scope || '只給船長';
    var isOther = !!region && !KNOWN[region];
    var sel = isOther ? '其他' : (region || '');
    return '<label class="field">居住地區 <span style="color:var(--brick)">*必填</span>　<span class="tiny" style="font-weight:400">和暱稱一起，全團契看得到</span><select name="place" required data-act-change="place"><option value="">請選擇縣市或國家</option>' +
      PLACES.map(function (g) { return '<optgroup label="' + (g[0] === '海外' ? '海外' : '台灣・' + g[0]) + '">' + g[1].map(function (p) { return '<option' + (p === sel ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</optgroup>'; }).join('') +
      '</select></label><label class="field" id="placeOtherWrap"' + (isOther ? '' : ' hidden') + '>請填寫國家或城市<input name="placeOther" maxlength="30" value="' + esc(isOther ? region : '') + '" placeholder="例如：英國・倫敦"></label>' +
      '<label class="field">詳細自我介紹<textarea name="intro" rows="4" maxlength="500" placeholder="想怎麼被稱呼、從哪裡來、最近在想什麼…寫多少都可以">' + esc(intro || '') + '</textarea></label>' +
      '<fieldset style="border:0;padding:0;margin:0;display:flex;flex-direction:column;gap:8px"><legend class="small" style="font-weight:700;margin-bottom:6px">詳細介紹要給誰看？</legend>' +
      ['只給船長', '同船', '全團契'].map(function (k) { return '<label style="display:flex;align-items:center;gap:10px;font-size:14px"><input type="radio" name="scope" value="' + k + '"' + (k === scope ? ' checked' : '') + ' style="width:20px;height:20px;accent-color:#B8503A"><span><b>' + k + '</b>　<span class="tiny">' + SCOPE_NOTE[k] + '</span></span></label>'; }).join('') +
      '</fieldset>';
  }

  // ----- 聚會消息 -----
  function viewNews() {
    if (!S.events) return spinner();
    var ev = S.events;
    var f = ev.filter(function (e) { return e.featured; })[0];
    var h = '';
    if (f) { var d = md(f.date), n = daysUntil(f.date); h += '<div class="hero"><div style="display:flex;justify-content:space-between"><p class="kicker" style="color:var(--gold)">NEXT PORT</p><p style="font-size:12px;color:#C9D3DF">' + (n > 0 ? '還有 <b style="font-family:Fraunces,serif;font-style:italic;font-size:20px;color:var(--gold)">' + n + '</b> 天' : '就是今天') + '</p></div><p style="font-size:22px;font-weight:900">' + esc(f.title) + '</p><p style="font-size:13px;color:#C9D3DF">' + d.m + '/' + d.d + '（' + d.wd.slice(1) + '）' + (f.kind ? '・' + esc(f.kind) + '聚會' : '') + '</p>' + (f.link ? '<a class="btn" style="background:var(--gold);color:var(--navy);align-self:flex-start;margin-top:6px" href="' + esc(f.link) + '" target="_blank" rel="noopener">看詳情</a>' : '') + '</div>'; }
    h += '<div class="chips" role="group" aria-label="篩選聚會">' + [['all', '全部'], ['線上', '線上'], ['實體', '實體']].map(function (c) { return '<button class="chip" data-act="filter" data-k="' + c[0] + '" aria-pressed="' + (S.filter === c[0]) + '">' + c[1] + '</button>'; }).join('') + '</div>';
    var list = ev.filter(function (e) { return S.filter === 'all' || e.kind === S.filter; });
    if (!list.length) return h + '<p class="empty">目前沒有聚會消息。</p>';
    var lastM = null;
    list.forEach(function (e) {
      var d = md(e.date), on = e.kind === '線上';
      if (d.m !== lastM) { h += '<p style="font-size:13px;font-weight:700;color:var(--muted);margin-top:4px">' + d.m + ' 月</p>'; lastM = d.m; }
      var inner = '<div class="date" style="background:' + (on ? '#EEF3FA' : '#F6EEE2') + ';color:' + (on ? '#2B5A8F' : '#8A5A34') + '"><b>' + d.d + '</b><span style="font-size:11px">' + d.wd + '</span></div><div style="flex:1;min-width:0"><p style="font-size:15px;font-weight:700">' + esc(e.title) + '</p><p class="tiny" style="margin-top:3px">' + esc(e.type || '') + '</p></div>' + (e.kind ? '<span class="tag" style="background:' + (on ? '#E3ECF7' : '#E3EFE3') + ';color:' + (on ? '#2B5A8F' : '#2F7A44') + '">' + esc(e.kind) + '</span>' : '');
      h += e.link ? '<a class="row" href="' + esc(e.link) + '" target="_blank" rel="noopener" style="border-radius:16px;padding:12px">' + inner + '</a>' : '<div class="row" style="border-radius:16px;padding:12px">' + inner + '</div>';
    });
    return h + '<p class="tiny" style="text-align:center">時間地點以 LINE 群組公告為準</p>';
  }

  // ----- 船員甲板／船長甲板 -----
  function viewDeck() {
    if (!S.me) return S.meError ? authErrCard() : spinner();
    var m = S.me.member;
    if (!m) return '<div class="card"><p class="h2">登上小船之後就能使用船員甲板</p><p class="small" style="margin:6px 0 12px">在這裡可以彼此代禱、提出問題，也可以匿名。</p><button class="btn" data-act="quiz">找到我的小船</button></div>';
    var lead = m.isCaptain || m.isSupervisor;
    if (lead && S.deckMode !== 'board') return viewCaptain();
    return viewBoard(lead);
  }
  function viewCaptain() {
    var crew = S.me.crew || [];
    var week = crew.filter(function (c) { return c.joined && daysUntil(c.joined) > -8; }).length;
    var care = crew.filter(function (c) { return c.needsCare; });
    var boatNames = S.me.boat ? S.me.boat.name : '';
    var h = '<div class="card" style="display:flex;flex-direction:column;gap:12px"><div><p class="kicker" style="color:#9A7012">CAPTAIN\'S DECK</p><p class="h2" style="margin-top:2px">' + esc(S.me.member.name) + (S.me.member.isCaptain ? ' 船長' : ' 督導') + '</p><p class="small">' + esc(boatNames) + '</p></div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">' + [[crew.length, '船員', ''], [week, '本週新上船', ''], [care.length, '需要你關心', 'color:var(--brick)']].map(function (x) { return '<div style="background:#F6EEE2;border-radius:12px;padding:10px;text-align:center"><p style="font-family:Fraunces,serif;font-style:italic;font-size:24px;' + x[2] + '">' + x[0] + '</p><p style="font-size:11px;' + x[2] + '">' + x[1] + '</p></div>'; }).join('') + '</div></div>';
    var pend = S.me.pending || [];
    if (pend.length) {
      h += '<p style="font-size:13px;font-weight:700;color:#9A7012">待你確認（' + pend.length + '）</p>';
      pend.forEach(function (p) { h += '<div class="row" style="border-color:#F2DFA6"><span class="avatar" style="background:#FFF4D6">' + esc((p.name || '?').slice(0, 1)) + '</span><span style="flex:1;min-width:0"><span style="display:block;font-size:14px;font-weight:700">' + esc(p.name) + '</span><span class="tiny">' + esc(p.quest) + (p.date ? '・' + esc(p.date) + ' 回報' : '') + '</span></span><button class="btn" style="padding:6px 12px;font-size:12px" data-act="confirm" data-id="' + p.id + '" data-k="confirm">確認</button><button class="btn ghost" style="padding:6px 10px;font-size:12px" data-act="confirm" data-id="' + p.id + '" data-k="reject">退回</button></div>'; });
    }
    if (care.length) { h += '<p style="font-size:13px;font-weight:700;color:var(--brick)">需要你關心</p>'; care.forEach(function (c) { h += crewRow(c, true); }); }
    h += '<p style="font-size:13px;font-weight:700;color:var(--ink2)">我的船員</p>';
    h += crew.length ? crew.map(function (c) { return crewRow(c, false); }).join('') : '<p class="empty">還沒有船員登船。</p>';
    h += '<button class="btn ghost block" data-act="deckmode" data-k="board">看代禱、提問與船員介紹</button>';
    h += '<p class="tiny" style="background:#F6EEE2;border-radius:12px;padding:12px;line-height:1.7">你只看得到自己船上的船員。新船員會先進入口群組，請邀請他加入你的小船群組。確認任務時會自動更新「最後互動日」。</p>';
    return h;
  }
  function crewRow(c, careMode) {
    var sub = careMode ? (c.lastContact ? '上次互動 ' + c.lastContact : '還沒有互動紀錄') : (c.status || '') + '・已完成 ' + c.done + ' 個任務';
    return '<div class="row"' + (careMode ? ' style="border-color:#F0C9B8"' : '') + '><span class="avatar" style="background:#DCE6F2">' + esc((c.name || '?').slice(0, 1)) + '</span><span style="flex:1"><span style="display:block;font-size:14px;font-weight:700">' + esc(c.name) + '</span><span class="tiny">' + esc(sub) + '</span></span>' + (c.status === '待船長聯繫' ? '<span class="tag" style="background:#FDF1EA;color:var(--brick)">新上船</span>' : '') + '</div>';
  }
  function viewBoard(isCaptain) {
    var h = '';
    if (isCaptain) h += '<button class="btn ghost" style="align-self:flex-start" data-act="deckmode" data-k="captain">← 回船長甲板</button>';
    h += '<div><p class="kicker" style="color:var(--brick)">CREW DECK</p><p class="h1" style="margin-top:3px">在甲板上，彼此守望</p><p class="small" style="margin-top:4px">可以匿名。只有團契成員看得到這裡的內容。</p></div>';
    h += '<div class="seg" role="tablist"><button role="tab" data-act="kind" data-k="pray" aria-selected="' + (S.boardKind === 'pray') + '">代禱事項</button><button role="tab" data-act="kind" data-k="ask" aria-selected="' + (S.boardKind === 'ask') + '">提問板</button><button role="tab" data-act="kind" data-k="intro" aria-selected="' + (S.boardKind === 'intro') + '">船員介紹</button></div>';
    if (S.boardKind === 'intro') return h + viewIntros();
    var b = S.board && S.board.kind === S.boardKind ? S.board : null;
    if (!b) { loadBoard(); return h + spinner(); }
    var hearted = store('joy-hearted') || {};
    var pray = S.boardKind === 'pray';
    h += b.posts.length ? b.posts.map(function (p) {
      var on = !!hearted[p.id];
      var t = new Date(p.time);
      return '<article class="card post"><div style="display:flex;align-items:center;gap:10px"><span class="avatar" style="background:' + (p.anon ? '#F6EEE2' : '#DCE6F2') + '">' + esc(p.anon ? '匿' : p.name.slice(0, 1)) + '</span><div><p style="font-size:14px;font-weight:700">' + esc(p.name) + '</p><p class="tiny">' + (t.getMonth() + 1) + '/' + t.getDate() + '</p></div></div><p class="text">' + esc(p.text) + '</p><div style="display:flex;align-items:center;gap:10px"><button class="heart" data-act="heart" data-id="' + p.id + '" aria-pressed="' + on + '"' + (on ? ' disabled' : '') + '>♥ ' + (pray ? (on ? '已為你禱告' : '為你禱告') : '我也想知道') + ' ' + p.hearts + '</button><button class="heart" data-act="thread" data-id="' + p.id + '" aria-expanded="' + (S.openThread === p.id) + '">💬 ' + (p.replies ? p.replies + ' 則' + (pray ? '回應' : '回覆') : (pray ? '回應' : '回覆')) + '</button></div>' + (S.openThread === p.id ? threadHtml(p.id, pray) : '') + '</article>';
    }).join('') : '<p class="empty">' + (pray ? '還沒有代禱事項。' : '還沒有人發問。') + '</p>';
    h += '<button class="btn dark fab" data-act="compose">＋ ' + (pray ? '寫下代禱' : '我要發問') + '</button>';
    return h;
  }
  function viewIntros() {
    if (!S.intros) {
      if (!S.introLoading) { S.introLoading = true; api('/api/intro').then(function (j) { S.intros = j.intros; S.introLoading = false; render(); }).catch(function (e) { S.introLoading = false; S.intros = []; S.meError = e.message; render(); }); }
      return spinner();
    }
    var h = '<p class="tiny">大家都看得到暱稱和居住地區；詳細介紹由每個人自己決定給誰看。</p>';
    h += S.intros.length ? S.intros.map(function (p) {
      return '<article class="card post"><div style="display:flex;align-items:center;gap:10px"><span class="avatar" style="background:#DCE6F2">' + esc((p.name || '?').slice(0, 1)) + '</span><div style="flex:1"><p style="font-size:14px;font-weight:700">' + esc(p.name) + (p.mine ? '（我）' : '') + '</p><p class="tiny">' + esc(p.region || '地區未填') + (p.boat ? '・' + esc(p.boat) : '') + '</p></div>' + (p.region ? '<span class="tag" style="background:#E3EFE3;color:#2F7A44">' + esc(p.region) + '</span>' : '') + '</div>' +
        (p.intro ? '<p class="text" style="white-space:pre-wrap">' + esc(p.intro) + '</p>' : p.hidden ? '<p class="tiny">🔒 詳細介紹只給特定的人看</p>' : '') + '</article>';
    }).join('') : '<p class="empty">還沒有船員。</p>';
    return h + '<button class="btn dark fab" data-act="intro-edit">＋ 寫／改我的介紹</button>';
  }
  function threadHtml(postId, pray) {
    var t = (S.threads || {})[postId];
    var h = '<div class="thread" style="border-top:1px solid var(--line);padding-top:10px;display:flex;flex-direction:column;gap:10px">';
    if (!t) h += spinner();
    else h += t.length ? t.map(function (r) { var d = new Date(r.time); return '<div style="display:flex;gap:8px"><span class="avatar" style="width:28px;height:28px;font-size:12px;background:' + (r.anon ? '#F6EEE2' : '#DCE6F2') + '">' + esc(r.anon ? '匿' : r.name.slice(0, 1)) + '</span><div style="flex:1;background:#F8F4EC;border-radius:12px;padding:8px 10px"><p style="font-size:12px;font-weight:700">' + esc(r.name) + ' <span class="tiny" style="font-weight:400">' + (d.getMonth() + 1) + '/' + d.getDate() + '</span></p><p style="font-size:14px;line-height:1.7;white-space:pre-wrap">' + esc(r.text) + '</p></div></div>'; }).join('') : '<p class="tiny">還沒有人' + (pray ? '回應' : '回覆') + '，成為第一個吧。</p>';
    h += '<form class="replyForm" data-post="' + postId + '" style="display:flex;flex-direction:column;gap:8px"><textarea name="text" rows="2" maxlength="1000" required placeholder="' + (pray ? '寫下你的祝福或禱告…' : '寫下你的想法或回答…') + '" style="border:1px solid var(--line);border-radius:12px;padding:10px;font:inherit;font-size:14px"></textarea>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input name="name" maxlength="30" placeholder="稱呼（不匿名時顯示）" style="flex:1;min-width:120px;border:1px solid var(--line);border-radius:999px;padding:7px 12px;font:inherit;font-size:13px"><label style="display:flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" name="anon" checked style="width:18px;height:18px;accent-color:#B8503A">匿名</label><button class="btn" type="submit" style="padding:7px 14px;font-size:13px">送出</button></div></form>';
    return h + '</div>';
  }
  function loadThread(postId) {
    S.threads = S.threads || {};
    delete S.threads[postId];
    return api('/api/board/replies?post=' + postId).then(function (j) { S.threads[postId] = j.replies; render(); })
      .catch(function (e) { S.threads[postId] = []; alert(e.message); render(); });
  }
  function loadBoard() {
    if (S.boardLoading === S.boardKind) return;
    S.boardLoading = S.boardKind;
    api('/api/board?kind=' + S.boardKind).then(function (j) { S.board = j; S.boardLoading = null; render(); })
      .catch(function (e) { S.boardLoading = null; S.board = { kind: S.boardKind, posts: [] }; S.meError = e.message; render(); });
  }

  // ---------- 底部面板 ----------
  function openSheet(inner) {
    $sheet.innerHTML = '<div class="sheet" role="dialog" aria-modal="true"><div class="grip"></div>' + inner + '</div>';
    $sheet.hidden = false;
  }
  function closeSheet() { $sheet.hidden = true; $sheet.innerHTML = ''; }
  $sheet.addEventListener('click', function (e) { if (e.target === $sheet) closeSheet(); });
  function head(kicker, color, title) { return '<div style="display:flex;justify-content:space-between;align-items:flex-start"><div><p class="kicker" style="color:' + color + '">' + kicker + '</p><p class="h1" style="margin-top:3px">' + esc(title) + '</p></div><button class="x" data-act="close" aria-label="關閉">×</button></div>'; }
  function sheetFor(k) {
    var c = S.content || { boats: [], teams: [] };
    if (k === 'ark') return openSheet(head('ENTRY 01・方舟', 'var(--brown)', '認識揪喜樂') + '<p class="small">在線上相遇，在生活中同行，在世界中成為祝福。</p><p style="background:#F6EEE2;border-radius:12px;padding:10px 12px;font-size:13px;line-height:1.7">建立性別友善的福音動態團體，向酷兒分享好消息。</p><a class="btn block" style="background:var(--brown)" href="' + esc(CFG.instagram) + '" target="_blank" rel="noopener">追蹤 Instagram</a><a class="btn ghost block" href="/" target="_blank" rel="noopener">看揪喜樂官網</a>');
    if (k === 'care') return openSheet(head('ENTRY 02・小船', 'var(--brick)', '找到安全的地方') + '<p class="small">給還在探索信仰或身分、受過傷，或只是好奇的你。</p><p style="background:#F6EEE2;border-radius:12px;padding:10px 12px;font-size:13px;line-height:1.7">陪伴不是拯救。你可以帶著問號上船，照自己的節奏前進。</p>' + c.boats.map(function (b) { return '<div class="row"><span class="dot" style="background:' + esc(b.color) + '"></span><span style="font-size:14px;font-weight:700;flex:1">' + esc(b.name) + '</span><span class="tiny">' + esc(b.tagline) + '</span></div>'; }).join('') + ((S.me && S.me.member) ? '' : '<button class="btn block" data-act="quiz">做 3 題小測驗，找到你的船</button>'));
    if (k === 'sail') return openSheet(head('ENTRY 03・快艇', 'var(--teal)', '一起出航') + '<p class="small">給想成為同工、執行外展專案的你。有分工表、有懶人包，不會讓你一個人扛。</p>' + c.teams.map(function (t) { return '<div class="row"><span class="dot" style="background:var(--teal)"></span><span style="flex:1"><span style="display:block;font-size:14px;font-weight:700">' + esc(t.name) + '</span><span class="tiny">' + esc(t.desc) + '</span></span><span class="tiny">' + esc(t.commitment.join('・')) + '</span></div>'; }).join('') + '<a class="btn block" style="background:var(--teal)" href="' + esc(CFG.lineOA) + '" target="_blank" rel="noopener">我想加入，私訊 LINE@</a>');
  }
  var QS = [
    ['你和基督信仰的關係，比較像？', ['剛開始認識，有點好奇', '曾經很投入，但受過傷', '信仰穩定，想多理解同志基督徒']],
    ['現在的你，最需要的是？', ['有人回答我的疑問', '有人好好聽我說', '學習怎麼陪伴別人']],
    ['上船之後，你希望…', ['慢慢認識耶穌', '找到可以重新靠岸的地方', '和同志基督徒一起同行']]
  ];
  var BOATS = ['恩典漂漂船', '浪子返航號', '摩西分海號'];
  var quizAns = [];
  function quizStep() {
    if (quizAns.length < 3) {
      var q = QS[quizAns.length];
      return openSheet(head('QUESTION ' + (quizAns.length + 1) + ' / 3', 'var(--brick)', q[0]) + q[1].map(function (o, i) { return '<button class="row" data-act="answer" data-k="' + i + '" style="text-align:left;padding:15px 14px"><span class="mono" style="color:var(--brick);font-size:12px">' + 'ABC'[i] + '</span><span style="font-size:15px">' + esc(o) + '</span></button>'; }).join(''));
    }
    var cnt = [0, 0, 0]; quizAns.forEach(function (a) { cnt[a]++; });
    var max = Math.max.apply(null, cnt), r = cnt[quizAns[0]] === max ? quizAns[0] : cnt.indexOf(max);
    var info = ((S.content && S.content.boats) || []).filter(function (b) { return b.name === BOATS[r]; })[0] || { name: BOATS[r], en: '', color: '#B8503A', result: '' };
    openSheet(head('YOUR BOAT', esc(info.color), info.name) + '<p class="small">' + esc(info.result) + '</p><p class="tiny">登船後會先邀請你進入口群組，再由船長邀請你進小船群組。</p><form id="joinForm" data-boat="' + esc(info.name) + '" style="display:flex;flex-direction:column;gap:12px">' + introFields('', '只給船長') + '<button class="btn dark block" type="submit">登上這艘船</button></form><button class="btn ghost block" data-act="quiz">重新測一次</button>');
  }

  // ---------- 事件 ----------
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act],[data-nav]'); if (!el) return;
    if (el.hasAttribute('data-nav')) { e.preventDefault(); history.pushState(null, '', el.getAttribute('href')); route(); window.scrollTo(0, 0); return; }
    var act = el.dataset.act, k = el.dataset.k;
    if (act === 'login') login();
    else if (act === 'relogin') relogin();
    else if (act === 'bless') { store('joy-bless-day', todayKey()); var n = ((S.content && S.content.blessings) || []).length; if (n) { S.bless = n === 1 ? 0 : (S.bless < 0 ? Math.floor(Math.random() * n) : (S.bless + 1 + Math.floor(Math.random() * (n - 1))) % n); render(); } }
    else if (act === 'sheet') sheetFor(k);
    else if (act === 'close') closeSheet();
    else if (act === 'quiz') { quizAns = []; quizStep(); }
    else if (act === 'answer') { quizAns.push(+k); quizStep(); }
    else if (act === 'complete') {
      el.disabled = true; el.textContent = '回報中…';
      api('/api/complete', { method: 'POST', body: { questId: el.dataset.id } }).then(loadMe).catch(function (err) { el.disabled = false; el.textContent = '回報完成'; alert(err.message); });
    }
    else if (act === 'confirm') {
      el.disabled = true;
      api('/api/confirm', { method: 'POST', body: { logId: el.dataset.id, action: k } }).then(loadMe).catch(function (err) { el.disabled = false; alert(err.message); });
    }
    else if (act === 'intro-edit') {
      var mm = S.me && S.me.member;
      openSheet(head('HELLO', 'var(--teal)', '我的自我介紹') + '<form id="introForm" style="display:flex;flex-direction:column;gap:12px">' + introFields(mm && mm.intro, mm && mm.introScope, mm && mm.region) + '<button class="btn block" type="submit">儲存</button></form>');
    }
    else if (act === 'filter') { S.filter = k; render(); }
    else if (act === 'kind') { S.boardKind = k; S.openThread = null; render(); }
    else if (act === 'deckmode') { S.deckMode = k; render(); }
    else if (act === 'thread') {
      var pid = el.dataset.id;
      S.openThread = S.openThread === pid ? null : pid;
      render();
      if (S.openThread && !(S.threads && S.threads[pid])) loadThread(pid);
    }
    else if (act === 'heart') {
      var hearted = store('joy-hearted') || {}; if (hearted[el.dataset.id]) return;
      el.disabled = true;
      api('/api/board/heart', { method: 'POST', body: { id: el.dataset.id } }).then(function (j) {
        hearted[el.dataset.id] = 1; store('joy-hearted', hearted);
        S.board.posts.forEach(function (p) { if (p.id === el.dataset.id) p.hearts = j.hearts; }); render();
      }).catch(function (err) { el.disabled = false; alert(err.message); });
    }
    else if (act === 'compose') {
      var pray = S.boardKind === 'pray';
      openSheet(head(pray ? 'PRAYER' : 'QUESTION', 'var(--brick)', pray ? '寫下代禱事項' : '我要發問') +
        '<form id="composeForm" style="display:flex;flex-direction:column;gap:12px"><label class="field">稱呼<input name="name" maxlength="30" placeholder="暱稱就好"></label><label class="field">' + (pray ? '代禱內容' : '你的問題') + '<textarea name="text" rows="4" maxlength="1000" required placeholder="' + (pray ? '想請大家為什麼禱告？' : '關於信仰、團契或聚會，什麼都可以問') + '"></textarea></label><label style="display:flex;align-items:center;gap:10px;font-size:14px"><input type="checkbox" name="anon" checked style="width:20px;height:20px;accent-color:#B8503A"> 匿名送出（顯示為「匿名旅人」）</label><button class="btn block" type="submit">送出</button></form>');
    }
  });
  document.addEventListener('change', function (e) {
    if (e.target.name !== 'place') return;
    var w = document.getElementById('placeOtherWrap');
    if (w) { w.hidden = e.target.value !== '其他'; if (!w.hidden) w.querySelector('input').focus(); }
  });
  document.addEventListener('submit', function (e) {
    var f0 = e.target;
    if (f0.id === 'joinForm' || f0.id === 'introForm') {
      e.preventDefault();
      if (!S.loggedIn) return login();
      var b0 = f0.querySelector('button[type=submit]'), label = b0.textContent;
      var scopeEl = f0.querySelector('input[name=scope]:checked');
      var sc = scopeEl ? scopeEl.value : '只給船長';
      var pl = f0.elements.place.value, po = (f0.elements.placeOther.value || '').trim();
      if (!pl) { alert('請選擇居住地區'); return; }
      if (pl === '其他' && !po) { alert('請填寫你住的國家或城市'); f0.elements.placeOther.focus(); return; }
      var body = { intro: f0.elements.intro.value, introScope: sc, scope: sc, place: pl, placeOther: po };
      b0.disabled = true; b0.textContent = '送出中…';
      if (f0.id === 'joinForm') {
        body.boat = f0.dataset.boat;
        api('/api/join', { method: 'POST', body: body }).then(function (j) {
          openSheet(head('WELCOME ABOARD', '#2F7A44', '歡迎登船！') + '<p style="font-size:15px;line-height:1.8">' + esc(j.groupMsg || '') + '</p><a class="btn line block" href="' + esc(j.groupUrl || '#') + '" target="_blank" rel="noopener">加入入口群組</a><p class="tiny">揪喜樂 LINE@ 也會傳一則提醒給你。如果沒收到，記得先把官方帳號加為好友。</p><button class="btn ghost block" data-act="close">先逛逛航海日誌</button>');
          return loadMe();
        }).catch(function (err) { b0.disabled = false; b0.textContent = label; alert(err.message); });
      } else {
        api('/api/intro', { method: 'POST', body: body }).then(function () { closeSheet(); S.intros = null; return loadMe(); })
          .catch(function (err) { b0.disabled = false; b0.textContent = label; alert(err.message); });
      }
      return;
    }
    if (f0.classList.contains('replyForm')) {
      e.preventDefault();
      var rb = f0.querySelector('button[type=submit]'), pid = f0.dataset.post;
      var txt = f0.elements.text.value.trim(); if (!txt) return;
      rb.disabled = true; rb.textContent = '送出中…';
      api('/api/board/replies', { method: 'POST', body: { post: pid, text: txt, name: f0.elements.name.value, anon: f0.elements.anon.checked } })
        .then(function () {
          (S.board.posts || []).forEach(function (p) { if (p.id === pid) p.replies++; });
          return loadThread(pid);
        })
        .catch(function (err) { rb.disabled = false; rb.textContent = '送出'; alert(err.message); });
      return;
    }
    if (e.target.id !== 'composeForm') return;
    e.preventDefault();
    var f = e.target, btn = f.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = '送出中…';
    api('/api/board', { method: 'POST', body: { kind: S.boardKind, text: f.elements.text.value, name: f.elements.name.value, anon: f.elements.anon.checked } })
      .then(function () { closeSheet(); S.board = null; render(); })
      .catch(function (err) { btn.disabled = false; btn.textContent = '送出'; alert(err.message); });
  });

  boot();
})();
