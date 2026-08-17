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
    rxAt: '',     // 마지막 수신 시각
    rxErr: ''     // 마지막 수신 오류
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
        return d.rows || [];
      })
      .catch(function (e) {
        r.ok = false; r.err = String((e && e.message) || e); API.rxErr = r.err;
        return null;
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
