/* ══ 날씨 (v2.19.16 사용자 지시) ═══════════════════════════
   ★현황판 빈자리를 채운다. 현재 날씨 + 앞으로 1주일 예보.
   ★사용자 확정
     · 깃허브에서 돌린다 — 인터넷은 된다.
     · 위치는 **PC 위치정보**를 쓴다.
     · 볼 것 : 기온 · 강수 · 풍속 · 안개(시정) 등.

   ★이 파일이 이 시스템에서 **유일하게 밖에서 자료를 받아오는 곳**이다.
     그래서 지켜야 할 것이 셋 있다.
     ① **막혀도 화면이 멀쩡해야 한다.** 인터넷이 끊기거나 위치를 거부해도
        날씨 칸만 조용히 접힌다 — 다른 숫자는 하나도 안 건드린다.
     ② **화면을 다시 그리지 않는다.** 자료가 늦게 오면 `#wxBox` 한 칸만
        갈아 끼운다. A.render()를 부르면 입력 중이던 칸이 날아간다.
     ③ **받아 둔 것을 저장한다.** 새로 열었을 때 빈칸부터 보이지 않도록
        마지막 값을 들고 있다가 먼저 그리고, 뒤에서 새로 받는다.

   ★Open-Meteo를 쓴다 — 키가 없고 가입도 없고 CORS가 열려 있다.
     현장에 등록·결제·키 관리를 시키지 않는다.
   ★위치를 못 얻으면 **BNCP 현장(바스라)** 좌표로 간다. 화면에 그 사실을 적는다.
     짐작을 숨기지 않는다(0-C에서 장비 근사를 알린 것과 같은 규칙). */
(function () {
  'use strict';
  var A = window.APP; if (!A) return;

  var KEY = 'bncp.wx';
  var FRESH = 30 * 60 * 1000;              /* 30분 — 그 안이면 다시 안 받는다 */
  var SITE = { lat: 30.5085, lon: 47.7804, fb: true };   /* BNCP 바스라 */

  A.WX = { st: 'idle', cur: null, days: null, place: '', fb: false, at: 0 };

  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      if (o && o.cur) { A.WX = o; A.WX.st = 'ok'; }
    } catch (e) { /* 저장분이 깨졌으면 없는 셈 친다 */ }
  }
  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(A.WX)); } catch (e) {}
  }

  /* WMO 코드 → 알아볼 수 있는 몇 갈래로 줄인다.
     ★스무 갈래를 그대로 쓰면 띠 한 칸에 안 들어간다. */
  A.wxKind = function (c) {
    c = Number(c);
    if (c === 0) return 'wx_s';
    if (c === 1 || c === 2) return 'wx_pc';
    if (c === 3) return 'wx_cl';
    if (c === 45 || c === 48) return 'wx_fog';
    if (c >= 51 && c <= 57) return 'wx_dz';
    if (c >= 61 && c <= 67) return 'wx_ra';
    if (c >= 71 && c <= 77) return 'wx_sn';
    if (c >= 80 && c <= 82) return 'wx_sh';
    if (c >= 85 && c <= 86) return 'wx_sn';
    if (c >= 95) return 'wx_ts';
    return 'wx_un';
  };
  var GLYPH = { wx_s: '☀', wx_pc: '⛅', wx_cl: '☁', wx_fog: '≡', wx_dz: '☂',
                wx_ra: '☂', wx_sh: '☂', wx_sn: '❄', wx_ts: '⚡', wx_un: '·' };
  A.wxGlyph = function (c) { return GLYPH[A.wxKind(c)] || '·'; };

  /* ★시정이 나쁘면 안개·모래바람이다. 이라크 현장에서 실제로 걸리는 값이라
     따로 표시한다 — WMO 코드에는 모래바람이 없다. */
  A.wxLowVis = function (m) { return m != null && m < 2000; };

  function url(lat, lon) {
    return 'https://api.open-meteo.com/v1/forecast' +
      '?latitude=' + lat.toFixed(3) + '&longitude=' + lon.toFixed(3) +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,' +
      'precipitation,weather_code,wind_speed_10m' +
      '&hourly=visibility' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,' +
      'precipitation_sum,wind_speed_10m_max' +
      '&timezone=auto&forecast_days=7&wind_speed_unit=ms';
  }

  function pull(lat, lon, fb) {
    if (typeof window.fetch !== 'function') { A.WX.st = 'err'; paint(); return; }
    window.fetch(url(lat, lon))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.current) { A.WX.st = 'err'; paint(); return; }
        /* 지금 시각에 가장 가까운 시정 한 칸 */
        var vis = null;
        try {
          var hs = j.hourly.time, i = hs.indexOf(String(j.current.time).slice(0, 13) + ':00');
          if (i < 0) i = 0;
          vis = j.hourly.visibility[i];
        } catch (e) { vis = null; }
        A.WX = {
          st: 'ok', fb: !!fb, at: Date.now(),
          place: (j.timezone || '').split('/').pop().replace(/_/g, ' '),
          cur: { t: j.current.temperature_2m, ft: j.current.apparent_temperature,
                 hum: j.current.relative_humidity_2m, rain: j.current.precipitation,
                 code: j.current.weather_code, wind: j.current.wind_speed_10m, vis: vis },
          days: (j.daily.time || []).map(function (d, k) {
            return { d: d, code: j.daily.weather_code[k],
                     hi: j.daily.temperature_2m_max[k], lo: j.daily.temperature_2m_min[k],
                     rain: j.daily.precipitation_sum[k], wind: j.daily.wind_speed_10m_max[k] };
          })
        };
        save(); paint();
      })
      .catch(function () { A.WX.st = 'err'; paint(); });
  }

  /* ★한 번만 부른다. 30분이 안 지났으면 저장분을 그대로 쓴다. */
  var asked = false;
  A.wxInit = function () {
    load();
    if (asked) { paint(); return; }
    if (A.WX.at && (Date.now() - A.WX.at) < FRESH) { paint(); return; }
    asked = true;
    if (A.WX.st !== 'ok') A.WX.st = 'wait';
    paint();
    var geo = window.navigator && window.navigator.geolocation;
    if (!geo) { pull(SITE.lat, SITE.lon, true); return; }
    /* ★위치를 못 받아도 기다리지 않는다 — 8초면 포기하고 현장 좌표로 간다.
       사용자가 창을 무시하면 날씨 칸이 영영 「받는 중」으로 남는다. */
    var done = false;
    var t = window.setTimeout(function () {
      if (!done) { done = true; pull(SITE.lat, SITE.lon, true); }
    }, 8000);
    try {
      geo.getCurrentPosition(function (p) {
        if (done) return; done = true; window.clearTimeout(t);
        pull(p.coords.latitude, p.coords.longitude, false);
      }, function () {
        if (done) return; done = true; window.clearTimeout(t);
        pull(SITE.lat, SITE.lon, true);       /* 거부·실패 — 현장 좌표로 */
      }, { timeout: 7000, maximumAge: 30 * 60 * 1000 });
    } catch (e) {
      if (!done) { done = true; window.clearTimeout(t); pull(SITE.lat, SITE.lon, true); }
    }
  };

  /* ★칸 하나만 갈아 끼운다 — A.render()를 부르지 않는다 (위 ②) */
  function paint() {
    try {
      var el = window.document.querySelector('#wxBox');
      /* ★늦게 도착해도 이 칸 하나만 갈아 끼운다. 기둥 안이라 높아져도
         본문을 덮지 않는다 — v2.19.20까지 애먹던 높이 계산이 필요 없다. */
      if (el && A.wxHTML) el.innerHTML = A.wxHTML();
    } catch (e) {}
  }
  A.wxPaint = paint;
})();
