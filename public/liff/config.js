// LINE MINI App「揪喜樂航海日誌」（頻道 2012557387，Provider：揪喜樂團契）
// 三個版本各有自己的 LIFF ID。端點網址加上 ?env=dev / ?env=review 來分辨；沒加就是正式版。
// LINE Login 只接受「端點網址」所在的網域。端點目前登記在 joyjesus-web.pages.dev，
// 從其他網域（joyjesus.com）進來就先轉過去，避免 access.line.me 400 Bad Request。
(function () {
  var ENDPOINT_HOST = 'joyjesus-web.pages.dev';
  var h = location.hostname;
  if (h !== ENDPOINT_HOST && h !== 'localhost' && h.indexOf('127.') !== 0) {
    location.replace('https://' + ENDPOINT_HOST + location.pathname + location.search + location.hash);
  }
})();
window.JOY_CONFIG = {
  liffIds: {
    dev: '2012557387-XkSSWmOo',
    review: '2012557388-CLcYFPrM',
    published: '2012557389-Jfp3TUw4',
  },
  instagram: 'https://www.instagram.com/joyjesus_fellowship/',
  lineOA: 'https://lin.ee/rn4IiXA',
  oaId: '@126rtjnb', // 官方帳號 ID：「傳訊息」會開啟官方帳號聊天室並預填訊息
};
(function () {
  var c = window.JOY_CONFIG, env = null;
  try {
    env = new URLSearchParams(location.search).get('env');
    if (!env) {
      var st = new URLSearchParams(location.search).get('liff.state');
      if (st) env = new URLSearchParams(st.split('?')[1] || '').get('env');
    }
    if (env) sessionStorage.setItem('joy_env', env); else env = sessionStorage.getItem('joy_env');
  } catch (e) {}
  c.env = c.liffIds[env] ? env : 'published';
  c.liffId = c.liffIds[c.env];
})();
