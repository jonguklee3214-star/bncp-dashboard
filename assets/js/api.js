/* 서버 전송·수신 계층 — Google Apps Script 웹앱
   · 전송 실패해도 화면 저장(localStorage)은 그대로 유지된다(오프라인 대비).
   · 같은 id로 다시 보내면 서버가 그 줄을 덮어쓴다(upsert) → 재전송해도 중복 안 생김.
   · 여기는 통신만 한다. 무엇을 보낼지·화면에 어떻게 표시할지는 호출부(vendor/tabs)가 정한다. */
(function (G) {
  'use strict';

  var API = {
    /* 배포 주소 — 코드 수정 시 [배포 관리]에서 기존 배포를 '업데이트'해야 이 주소가 유지된다 */
    url: 'https://script.google.com/macros/s/AKfycbw4dDiqV_7gDnOCk0W5kGL0ie0NJrwy654GzY80VgNzgRyRyjxELs5_2AaMM_yTOE19/exec',
    on: true,     // false로 두면 통신하지 않는다(로컬 테스트용)
    log: [],      // 최근 통신 결과 50건
    rxAt: '',     // 마지막 수신 시각(내 시계 — 표시용)
    last: '',     // ★서버가 알려준 마지막 수신시각 — 다음 조회의 since
    rxErr: '',    // 마지막 수신 오류
    canBatch: false  // ★서버가 묶음 저장을 받는가 — meta가 알려준다(v2.48.0)
  };

  function rec(kind, type) {
    var r = { kind: kind, type: type, at: new Date().toISOString(), ok: null, err: '', row: 0 };
    API.log.push(r);
    if (API.log.length > 50) API.log.shift();
    return r;
  }
  function live() { return !!(API.on && API.url && typeof fetch === 'function'); }

  /* ── 전송 ───────────────────────────────────────────
     type: 'work' | 'crew' | 'insp' | 'surv' | 'mat' | 'direct'
     row : 시트에 남길 평평한 객체. id는 반드시 포함할 것(재전송 대조 키) */
  API.send = function (type, row) {
    var r = rec('tx', type), body = { type: type }, k;
    for (k in row) if (Object.prototype.hasOwnProperty.call(row, k)) body[k] = row[k];

    if (!live()) { r.ok = false; r.err = 'no transport'; return Promise.resolve(r); }

    /* Content-Type은 반드시 text/plain — application/json으로 보내면 브라우저가
       사전요청(preflight)을 먼저 보내는데 Apps Script가 이를 처리하지 못해 실패한다. */
    return fetch(API.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    })
      .then(function (res) { return res.json(); })
      .then(function (d) {
        r.ok = !!(d && d.ok);
        r.row = (d && d.row) || 0;
        if (!r.ok) r.err = (d && d.err) || 'rejected';
        return r;
      })
      .catch(function (e) {
        r.ok = false;
        r.err = String((e && e.message) || e);
        return r;
      });
  };

  /* ── 묶음 전송 (v2.48.0) ─────────────────────────────
     ★한 줄에 요청 하나면 설계수량 수천 건이 수천 왕복이 된다. 서버는 쓰기를 한 줄로
       세우므로(waitLock) 받는 데 아주 오래 걸렸다 — 사용자가 확인한 그 느림이다.
     ★여러 줄을 한 요청으로 보낸다. 서버는 잠금을 한 번만 잡는다.
     ★쓸 수 있는지는 meta의 batch로 안다 — API.cap.batch가 참일 때만 부를 것.
       재배포 안 한 서버에 보내면 모르는 종류라 etc 시트에 통째로 쌓여 자료가 뭉개진다.
     ★100줄씩 잘라 보낸다(Apps Script 실행시간·본문 크기 여유). */
  API.BATCH_MAX = 100;
  API.sendMany = function (rows) {
    var list = (rows || []).filter(function (r) { return r && r.id; });
    var r = rec('tx', 'batch');
    r.row = list.length;
    if (!live() || !list.length) { r.ok = false; r.err = 'no transport'; return Promise.resolve(r); }

    var packs = [], i;
    for (i = 0; i < list.length; i += API.BATCH_MAX) packs.push(list.slice(i, i + API.BATCH_MAX));

    /* 한 묶음씩 차례로 — 서버가 어차피 한 줄로 세운다. 동시에 쏠 이유가 없다. */
    var okAll = true;
    return packs.reduce(function (chain, pack) {
      return chain.then(function () {
        return fetch(API.url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ type: 'batch', rows: pack })
        })
          .then(function (res) { return res.json(); })
          .then(function (d) { if (!d || !d.ok) { okAll = false; r.err = (d && d.err) || 'rejected'; } })
          .catch(function (e) { okAll = false; r.err = String((e && e.message) || e); });
      });
    }, Promise.resolve()).then(function () { r.ok = okAll; return r; });
  };

  /* ── 수신 ───────────────────────────────────────────
     성공하면 rows(배열), 실패하면 null을 돌려준다. 예외를 던지지 않는다. */
  API.rows = function (type, since) {
    var r = rec('rx', type);
    if (!live()) { r.ok = false; r.err = 'no transport'; API.rxErr = r.err; return Promise.resolve(null); }

    var q = API.url + '?action=rows&type=' + encodeURIComponent(type || '') +
            (since ? '&since=' + encodeURIComponent(since) : '');

    return fetch(q)
      .then(function (res) { return res.json(); })
      .then(function (d) {
        if (!d || !d.ok) { r.ok = false; r.err = (d && d.err) || 'rejected'; API.rxErr = r.err; return null; }
        r.ok = true; r.row = d.count || 0;
        API.rxAt = new Date().toISOString(); API.rxErr = '';
        /* ★서버가 알려준 마지막 수신시각을 기억한다 — 다음 조회의 since가 된다.
           내 시계가 아니라 서버 시계여야 한다. 둘이 어긋나면 그 사이에 들어온
           줄을 영영 건너뛴다. */
        if (d.last) API.last = d.last;
        return d.rows || [];
      })
      .catch(function (e) {
        r.ok = false; r.err = String((e && e.message) || e); API.rxErr = r.err;
        return null;
      });
  };

  /* ── 바뀐 게 있는지만 묻는다 (v2.19.3) ───────────────
     ★본문을 받지 않는다. 응답이 수십 바이트로 끝난다.
       내가 가진 last와 같으면 조회 자체를 건너뛴다. */
  API.meta = function () {
    if (!live()) return Promise.resolve(null);
    return fetch(API.url + '?action=meta')
      .then(function (res) { return res.json(); })
      .then(function (d) {
        /* ★서버 용량을 기억해 둔다 (v2.22.5). meta는 화면 들어올 때마다
           도는 길이라, 따로 물으러 가지 않아도 늘 최신이다. */
        if (d && d.ok && d.cellPct != null) {
          API.cap = { cells: d.cells, cap: d.cellCap, pct: d.cellPct, rows: d.count };
        }
        /* ★서버가 묶음을 받을 줄 아는가 (v2.48.0). meta는 동기화마다 도는 길이라
           따로 물으러 갈 필요가 없다. 옛 서버는 이 칸이 없어 false로 남는다. */
        if (d && d.ok) API.canBatch = !!d.batch;
        return (d && d.ok) ? d : null;
      })
      .catch(function () { return null; });
  };

  /** 바뀐 것만 받는다. 바뀐 게 없으면 null이 아니라 빈 배열을 준다 —
      null은 「통신 실패」라는 뜻이라 구분해야 한다. */
  API.changed = function () {
    if (!live()) return Promise.resolve(null);
    return API.meta().then(function (m) {
      if (!m) return null;                          /* 통신 실패 */
      if (API.last && m.last && m.last === API.last) return [];   /* 바뀐 게 없다 */
      return API.rows('', API.last || '');
    });
  };

  /* ── 로그인 ─────────────────────────────────────────
     비밀번호는 Apps Script 스크립트 속성에 있다. 화면 코드에 두면
     소스를 뜯어 볼 수 있어 의미가 없다. */
  API.login = function (pw) {
    if (!live()) return Promise.resolve({ ok: false, err: 'offline' });
    return fetch(API.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ type: 'login', pw: String(pw || '') })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) { return d && d.ok ? { ok: true, role: d.role } : { ok: false }; })
      .catch(function (e) { return { ok: false, err: String(e && e.message || e) }; });
  };

  /* 서버가 살아있는지 — 콘솔에서 BNCP_API.ping() */
  API.ping = function () {
    if (!live()) return Promise.resolve({ ok: false });
    return fetch(API.url).then(function (r) { return r.json(); }).catch(function () { return { ok: false }; });
  };

  G.BNCP_API = API;
})(typeof window !== 'undefined' ? window : this);
