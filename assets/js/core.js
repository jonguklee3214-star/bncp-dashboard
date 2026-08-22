/* ══════════════════════════════════════════════════════════
   core.js v2 — 상태저장 · 위치체계 · 공종 레지스트리 · 계산
   ──────────────────────────────────────────────────────────
   위치
     부지토목 civil : Phase 1~6 × 공구 1/2  → "Phase 3-1"
     부대토목 anc   : Town A~H × Block      → "Town B · Block 5"
     ※ Phase / Town / Block / 장비명은 언어와 무관하게 항상 영문(층1)
   공종
     civil : 부지토목 코드 261 + 시설물 원단위행 231(개소 선택 필요)
     anc   : 부대토목 코드 92
   기록
     work  실적(수량)          — 업체 제출 → 스탭 확인
     crew  인원·장비(한 묶음)  — 업체 제출 → 스탭 확인
     insp  검측  요청/제출/합격/불합격/검측지연 (+재검측, 2일↑ 장기)
     surv  측량  사유 + 처리/미처리
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var D = window.BNCP, M = window.BNCP_MASTER, MAT = window.BNCP_MAT, EQ = window.BNCP_EQ;
  var A = window.APP = {};

  /* ── 도우미 ─────────────────────────────────────────── */
  A.$ = function (s, r) { return (r || document).querySelector(s); };
  A.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  A.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  };
  A.nf = function (v, d) {
    if (v == null || isNaN(v)) return '—';
    return Number(v).toLocaleString('en-US', {
      minimumFractionDigits: d == null ? 0 : d, maximumFractionDigits: d == null ? 0 : d
    });
  };
  A.pf = function (v) { return v == null || isNaN(v) ? '—' : (Math.round(v * 10) / 10).toFixed(1) + '%'; };
  A.today = function () { return new Date().toISOString().slice(0, 10); };
  A.yday = function () { var d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); };
  A.dayGap = function (a, b) { return Math.round((new Date(b || A.today()) - new Date(a)) / 86400000); };
  A.uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };

  /* ── 상태 ───────────────────────────────────────────── */
  var KEY = 'bncp.dash.v2';
  var BLANK = {
    v: 2, lang: 'ko',
    plan: {}, fac: {},
    work: [], crew: [], insp: [], surv: [], mat: [], issue: [], msg: [],
    direct: [],
    matmap: {},
    mdesign: {}, mreq: [], staff: {}, msgq: [],
    vend: [], roadX: [], mt: {},  /* 협력업체·담당자 명부 / 현장에서 추가한 도로폭 */
    alias: {},                    /* 내역서 항목 → 공종코드. 한 번 지정하면 계속 쓴다(v2.14.0) */
    alias2: {},                   /* ★대분류를 뺀 별칭 — 다른 페이즈에도 붙는다(v2.19.5). '*'면 갈린 것 */
    boq: null,                    /* ★확인 필요 목록. 저장을 안 눌러도 살아 있다(v2.16.2) */
    stock: {},                    /* ★재고수량 — 사람이 직접 넣는다(v2.17.1). {위치키:{자재id:수량}} */
    tab: 1,                       /* ★마지막으로 보던 탭 — 다시 들어오면 그 자리(v2.16.2) */
    rxLast: ''                    /* ★서버에서 마지막으로 받은 시각 — 증분 수신 기준(v2.19.3) */
  };
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.v === 2) { for (var k in BLANK) if (!(k in s)) s[k] = BLANK[k]; return s; }
    } catch (e) { }
    return JSON.parse(JSON.stringify(BLANK));
  }
  var S = A.S = load();
  /* ══ 저장 용량 (v2.18.5) ═══════════════════════════════
     ★하루 100건이면 1년에 3~4만 건이다. localStorage 한도가 보통 5MB라
       1~2년 안에 터진다. 터지면 setItem이 조용히 실패해 방금 입력한 것이
       날아간다 — 현장에서 가장 나쁜 실패다.
     ★원본은 구글 시트다. 화면은 최근 것만 들고 있으면 된다.
       오래된 것은 지우는 게 아니라 「안 들고 있는」 것이다. 필요하면
       서버에서 다시 받는다.
     ★자동으로 덜어내되, 무엇을 언제 덜어냈는지 반드시 알린다.
       조용히 지우면 「내 자료가 왜 없지」가 된다. */
  A.KEEP_DAYS = 90;                       /* 화면에 들고 있는 기간 */
  A.CAP = 4 * 1024 * 1024;                /* 4MB — 5MB 한도에 여유를 둔다 */

  A.usage = function () {
    var n = 0;
    try { n = JSON.stringify(S).length; } catch (e) { }
    return { bytes: n, pct: Math.min(100, Math.round(n / A.CAP * 100)) };
  };

  /* 기록형 저장소만 자른다. 마스터·설계량·명부는 건드리지 않는다 —
     그건 쌓이는 자료가 아니라 기준 자료다. */
  var TRIM_BOX = ['work', 'crew', 'insp', 'surv', 'mreq', 'direct'];

  A.trim = function (days) {
    /* addDays는 tabs.js 안에 있어 여기서 못 쓴다 — core는 tabs를 모른다 */
    var d = new Date(A.today());
    d.setDate(d.getDate() - (days || A.KEEP_DAYS));
    var cut = d.getFullYear() + '-' +
      ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    var out = { cut: cut, n: 0 };
    TRIM_BOX.forEach(function (b) {
      if (!Array.isArray(S[b])) return;
      var before = S[b].length;
      S[b] = S[b].filter(function (x) {
        /* 아직 처리 안 끝난 것은 오래됐어도 남긴다 — 밀린 일이 사라지면 안 된다 */
        if (x.st && x.st !== 'ok' && x.st !== 'pass' && x.st !== 'iss') return true;
        if (b === 'surv' && !x.done) return true;
        return !x.date || x.date >= cut;
      });
      out.n += before - S[b].length;
    });
    return out;
  };

  A.save = function () {
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
      S.trimMsg = S.trimMsg || '';
      return true;
    } catch (e) {
      /* ★터지면 그때 덜어내고 한 번 더 시도한다. 여기서 실패하면
         방금 입력한 것이 날아가므로 조용히 넘어가면 안 된다. */
      var r = A.trim(A.KEEP_DAYS);
      try {
        localStorage.setItem(KEY, JSON.stringify(S));
        S.trimMsg = A.T('cap_trimmed').replace('{n}', r.n).replace('{d}', r.cut);
        localStorage.setItem(KEY, JSON.stringify(S));
        return true;
      } catch (e2) {
        alert(A.T('e_full'));
        return false;
      }
    }
  };
  /* ══ [초기화] (v2.21.1 · 인수인계서 0-Z-1·0-Z-2) ═══════════
     ★종전에는 저장소 키를 통째로 지웠다(`removeItem`). 그러면 설계수량·
       협력업체 명부·별칭·마스터까지 같이 날아가 정식 전환 때 전부 다시
       올려야 했다. 문구는 「실적·검측·측량·자재」라고만 해서 실제와 달랐다.
     사용자 확정 : 「협력업체에서 입력한 것만 날리는 거야」
       → 문구를 실제에 맞추는 것이 아니라 **동작을 문구에 맞춘다.**
     ★같이 지울 것을 따로 물었고 「없다 — 협력업체 입력 5종만」이었다.
       직영(direct)·장비 지급대장(issue)·자재 재고(stock)·내역서 확인필요
       목록(boq)은 우리 쪽에서 넣은 것이라 **남긴다.**
       (boq는 [목록 지우기] 단추가 따로 있다 — 0-B-2)
     ★rxLast는 일부러 안 건드린다. 되돌리면 증분 수신이 방금 지운 줄을
       서버에서 그대로 다시 받아 와 초기화가 없던 일이 된다. */
  A.WIPE_BOX = ['work', 'crew', 'insp', 'surv', 'mreq'];
  A.wipe = function () {
    A.WIPE_BOX.forEach(function (b) { S[b] = []; });
    S.trimMsg = '';
    A.save();
    location.reload();
  };

  /* 로그인 응답 하나로 판정한다. ★비동기와 갈라 둔 이유는 이 판정이
     검사로 확인되어야 하기 때문이다 — 통신은 검사에서 못 돌린다.
       ok    관리자다
       role  들어오긴 했는데 스탭·측량팀이다 → 거절
       bad   비밀번호가 틀렸다
       off   대조할 방법이 없다 → ★거절. 확인 못 하면 지우지 않는다. */
  A.wipeOk = function (r) {
    if (!r) return { ok: false, err: 'off' };          /* 응답 자체가 없다 = 대조 못 했다 */
    if (!r.ok) return { ok: false, err: r.err === 'offline' ? 'off' : 'bad' };
    return r.role === 'admin' ? { ok: true } : { ok: false, err: 'role' };
  };

  /* ★비밀번호를 화면 코드에 박지 않는다. 로그인과 **같은 길**을 쓴다 —
     Apps Script 스크립트 속성 PW_ADMIN에서 대조한다. */
  A.wipeGate = function (pw) {
    var api = window.BNCP_API;
    if (!api || !api.login) return Promise.resolve({ ok: false, err: 'off' });
    return api.login(pw).then(A.wipeOk);
  };

  /* ══ 권한 ════════════════════════════════════════════
     · 두 등급뿐이다: 스탭(staff) / 관리자(admin).
     · 인수인계서 45행 — index.html은 스탭·관리자 공용 화면이다. 화면을 따로 만들지 않는다.
     · 인수인계서 344·473행 — 스탭은 확인만, 반려·최종승인은 관리자.
     · 여기에 더해 업체 간 비교가 되는 자료(생산성·지급대조)와 재고·알림·공정표는 감춘다.
       이라크 현장 특성상 타업체로 흘러가면 협상 재료가 된다(사용자 지시).
     ★ 비밀번호는 화면 코드에 두지 않는다. Apps Script(스크립트 속성)에서 검사한다 —
       소스를 뜯어도 나오지 않아야 의미가 있다. */
  var ROLE_KEY = 'bncp.role';
  A.role = function () {
    try { return localStorage.getItem(ROLE_KEY) || ''; } catch (e) { return ''; }
  };
  A.setRole = function (r) {
    try {
      if (r) localStorage.setItem(ROLE_KEY, r);
      else localStorage.removeItem(ROLE_KEY);
    } catch (e) { }
  };
  A.isAdmin = function () { return A.role() === 'admin'; };
  A.isStaff = function () { return A.role() === 'staff' || A.isAdmin(); };
  /* ★측량팀 (v2.20.0 사용자 지시) — 스탭이 아니다.
     들어와서 하는 일은 「완료」 또는 「완료 못한 사유」 입력 하나뿐이다.
     그래서 스탭 권한을 물려주지 않는다. 측량 탭만 보인다(TABS_ON). */
  A.isSurv = function () { return A.role() === 'surv'; };
  /** 로그인 여부 — 게이트는 이것으로 판정한다.
      ★isStaff()로 판정하면 측량팀이 영영 못 들어온다. */
  A.isIn = function () { return A.isStaff() || A.isSurv(); };

  /* 관리자에게만 보이는 것 */
  A.can = function (what) {
    if (A.isAdmin()) return true;
    /* ★측량팀은 아무 관리 기능도 못 쓴다. 스탭보다 더 좁다 —
       업체별 실적·재고·생산성은 측량과 아무 상관이 없다. */
    if (A.isSurv()) return false;
    switch (what) {
      case 'deny':     // 반려·미승인·미지급
      case 'approve':  // 공정지연 최종승인
      case 'prod':     // 생산성 분석 — 업체 간 비교가 된다
      case 'recon':    // 장비 지급대조 — 업체별 판정
      case 'stock':    // 자재 재고 — 없다는 사실이 협력업체에 새면 공기 클레임이 된다
      case 'notice':   // 알림·전파
      case 'sched':    // 공정표
      case 'print':    // 인쇄·복사
        return false;
    }
    return true;
  };

  /* ══ 협력업체 명부 ═══════════════════════════════════
     · 업체·담당자를 CSV로 올려 선택하게 한다 → 표기가 흩어지지 않는다
       (KEW / K.E.W / kew 로 갈라지면 집계가 갈라진다)
     · 업체마다 무작위 키를 발급해 링크에 넣는다 → 남의 업체로 못 올린다
       vendor.html?c=KEW-7f3a9b21 */
  function randKey() {
    var s = '', c = 'abcdef0123456789', i;
    for (i = 0; i < 8; i++) s += c.charAt(Math.floor(Math.random() * c.length));
    return s;
  }
  A.vendKey = function (code) { return String(code) + '-' + randKey(); };

  /* CSV: 업체코드,업체명,담당자  (머리행 있으면 건너뜀) */
  A.vendLoad = function (text) {
    var rows = String(text || '').split(/\r?\n/), out = {}, n = 0, skip = 0, i;
    for (i = 0; i < rows.length; i++) {
      var line = rows[i].trim();
      if (!line) continue;
      var c = line.split(',').map(function (x) { return x.trim(); });
      if (c.length < 2) { skip++; continue; }
      if (i === 0 && /코드|code/i.test(c[0])) continue;      // 머리행
      var code = c[0], name = c[1], staff = c[2] || '';
      if (!code || !name) { skip++; continue; }
      if (!out[code]) out[code] = { code: code, name: name, staff: [], key: '' };
      if (staff && out[code].staff.indexOf(staff) < 0) { out[code].staff.push(staff); n++; }
    }
    /* 기존 키는 유지한다 — 다시 올렸다고 링크가 바뀌면 현장이 곤란해진다 */
    var old = {};
    S.vend.forEach(function (v) { old[v.code] = v.key; });
    S.vend = Object.keys(out).map(function (k) {
      out[k].key = old[k] || A.vendKey(k);
      return out[k];
    });
    A.save();
    return { comp: S.vend.length, staff: n, skip: skip };
  };

  /* 손으로 한 곳씩 넣기 (v2.15.4)
     ★업체가 몇 곳뿐인 현장에서 CSV를 만들어 올리는 건 번거롭다(사용자 지시).
       CSV는 그대로 두고, 화면에서 바로 넣는 길을 연다.
       같은 코드면 담당자만 더한다 — 링크(key)는 유지한다. */
  A.vendAdd = function (code, name, staff, tel) {
    code = String(code || '').trim();
    name = String(name || '').trim();
    staff = String(staff || '').trim();
    tel = String(tel || '').replace(/[^0-9+]/g, '');
    if (!code || !name) return { ok: false, why: 'need' };
    var hit = null;
    S.vend.forEach(function (v) { if (v.code === code) hit = v; });
    if (hit) {
      hit.name = name;
      if (tel) hit.tel = tel;
      if (staff && hit.staff.indexOf(staff) < 0) hit.staff.push(staff);
    } else {
      hit = { code: code, name: name, tel: tel, staff: staff ? [staff] : [], key: A.vendKey(code) };
      S.vend.push(hit);
    }
    A.save();
    return { ok: true, v: hit };
  };
  /* ══ 공종별 담당자 (v2.19.2 사용자 지시) ═══════════════
     ★staff는 종전부터 이름 문자열 배열이다. 구조를 갈아엎지 않고
       「공종|이름」 꼴로 담는다. 공종이 없으면 종전처럼 이름만 들어간다.
       옛 자료(이름만 있는 것)도 그대로 읽힌다 — 마이그레이션이 필요 없다.
     ★쓰임 : 협력업체 화면에서 공종을 고르면 담당자가 자동으로 뜬다.
       틀리면 목록에서 고른다. 매번 손으로 적던 것을 없앤다. */
  /* ★전화번호를 **담당자마다** 갖는다 (v2.21.0 사용자 지시).
     종전에는 업체에 하나뿐이라(`v.tel`) 독촉이 늘 대표번호로만 갔다.
     ★구조를 갈아엎지 않는다 — staff는 종전대로 문자열 배열이고,
       칸을 하나 더 쓴다: 「공종|이름|전화」.
       옛 자료(이름만 · 공종|이름)도 그대로 읽힌다. 마이그레이션이 없다. */
  function _sp(x) {
    var a = String(x || '').split('|');
    if (a.length === 1) return { grp: '', name: a[0], tel: '', raw: String(x || '') };
    return { grp: a[0] || '', name: a[1] || '', tel: a[2] || '', raw: String(x || '') };
  }
  /** 되돌려 담는다. ★공종이 없어도 전화가 있으면 칸을 비워 자리를 지킨다
      (`|이름|전화`) — 안 그러면 이름이 공종 자리로 밀려 들어간다. */
  function _mk(grp, name, tel) {
    grp = String(grp || '').trim(); name = String(name || '').trim();
    tel = String(tel || '').replace(/[^0-9+]/g, '');
    if (tel) return grp + '|' + name + '|' + tel;
    if (grp) return grp + '|' + name;
    return name;
  }
  A.vendStaffMake = _mk;
  A.vendStaffList = function (v) {
    return (v && v.staff || []).map(_sp);
  };
  /** 그 업체에서 이 공종을 맡은 사람 — 없으면 공종 없는 담당자를 준다 */
  A.staffFor = function (vname, grp) {
    var v = null;
    S.vend.forEach(function (x) { if (x.name === vname) v = x; });
    if (!v) return { pick: '', all: [] };
    var all = A.vendStaffList(v), hit = '';
    all.forEach(function (s2) { if (s2.grp && s2.grp === grp && !hit) hit = s2.name; });
    if (!hit) all.forEach(function (s2) { if (!s2.grp && !hit) hit = s2.name; });
    return { pick: hit, all: all.map(function (s2) { return s2.name; }) };
  };

  /** ★그 공종 담당자의 번호 — 없으면 공종 없는 담당자, 그것도 없으면 업체 번호.
      독촉은 **사람에게** 가야 한다. 대표번호로만 보내면 누가 처리할지 모른다. */
  A.vendTel = function (v, grp, sname) {
    if (!v) return '';
    var all = A.vendStaffList(v), hit = '';
    if (sname) all.forEach(function (x) { if (x.name === sname && x.tel && !hit) hit = x.tel; });
    if (!hit && grp) all.forEach(function (x) { if (x.grp === grp && x.tel && !hit) hit = x.tel; });
    if (!hit) all.forEach(function (x) { if (!x.grp && x.tel && !hit) hit = x.tel; });
    if (!hit) all.forEach(function (x) { if (x.tel && !hit) hit = x.tel; });
    return hit || v.tel || '';
  };

  /* ══ 명부 — 업체 먼저, 담당자는 그 다음 (v2.21.0 사용자 지시) ══
     ★두 단계로 나눈다. 종전에는 한 폼에서 업체코드·업체명·담당자를 **매번
       다시** 적었다. 업체명을 그때그때 타이핑하다 한 글자만 달라도
       (KEW / K.E.W) 같은 업체가 둘로 갈라진다.
     ★이제 업체는 한 번만 만들고, 담당자는 **만들어진 업체에 골라 붙인다.** */

  /** 1단계 — 업체만 만든다. 담당자는 받지 않는다. */
  A.vendCreate = function (code, name) {
    code = String(code || '').trim();
    name = String(name || '').trim();
    if (!code || !name) return { ok: false, why: 'need' };
    var hit = null;
    S.vend.forEach(function (v) { if (v.code === code) hit = v; });
    if (hit) { hit.name = name; A.save(); return { ok: true, v: hit, dup: true }; }
    hit = { code: code, name: name, tel: '', staff: [], key: A.vendKey(code) };
    S.vend.push(hit); A.save();
    return { ok: true, v: hit };
  };

  /** 2단계 — 만들어진 업체에 담당자를 붙인다.
      ★같은 공종에 같은 이름이 이미 있으면 **덧붙이지 않고 고친다.**
        안 그러면 전화만 바꾸려다 같은 사람이 둘이 된다. */
  A.vendStaffAdd = function (code, grp, name, tel) {
    name = String(name || '').trim();
    if (!name) return { ok: false, why: 'sname' };
    var hit = null;
    S.vend.forEach(function (v) { if (v.code === code) hit = v; });
    if (!hit) return { ok: false, why: 'novend' };
    var raw = _mk(grp, name, tel), done = false;
    hit.staff = hit.staff.map(function (x) {
      var q = _sp(x);
      if (!done && q.name === name && q.grp === String(grp || '').trim()) { done = true; return raw; }
      return x;
    });
    if (!done) hit.staff.push(raw);
    A.save();
    return { ok: true, v: hit, edit: done };
  };

  /** 담당자 한 줄을 통째로 바꾼다(공종·이름까지 바뀔 수 있다) */
  A.vendStaffSet = function (code, oldRaw, grp, name, tel) {
    name = String(name || '').trim();
    if (!name) return { ok: false, why: 'sname' };
    var hit = null;
    S.vend.forEach(function (v) { if (v.code === code) hit = v; });
    if (!hit) return { ok: false, why: 'novend' };
    var raw = _mk(grp, name, tel), found = false;
    hit.staff = hit.staff.map(function (x) {
      if (!found && x === oldRaw) { found = true; return raw; }
      return x;
    });
    if (!found) hit.staff.push(raw);
    A.save();
    return { ok: true, v: hit };
  };

  /** ★명부 전체를 비운다. 되돌릴 수 없다 — 부르는 쪽에서 반드시 확인을 받는다. */
  A.vendReset = function () {
    var n = S.vend.length;
    S.vend = [];
    A.save();
    return n;
  };

  A.vendDel = function (code) {
    S.vend = S.vend.filter(function (v) { return v.code !== code; });
    A.save();
  };
  A.vendStaffDel = function (code, staff) {
    S.vend.forEach(function (v) {
      if (v.code === code) v.staff = v.staff.filter(function (s) { return s !== staff; });
    });
    A.save();
  };

  /* 협력업체 접속 주소 — 전체 주소로 만든다 (v2.16.0)
     ★코드에 도메인을 박지 않는다. 지금 화면이 열린 주소에서 뽑아낸다.
       그래야 로컬에서 열면 로컬 주소, GitHub Pages면 그 주소가 나오고,
       나중에 주소가 바뀌어도 손댈 곳이 없다.
     종전에는 'vendor.html?c=...'만 보여줘서, 그대로 복사해 보내면
     상대 휴대폰에서 열리지 않았다(사용자 지적). */
  A.vendUrl = function (key) {
    var base = '';
    try {
      var h = String(location.href).split('#')[0].split('?')[0];
      base = h.replace(/[^/]*$/, '');
    } catch (e) { base = ''; }
    return base + 'vendor.html?c=' + encodeURIComponent(key);
  };

  A.vendByKey = function (key) {
    var hit = null;
    S.vend.forEach(function (v) { if (v.key === key) hit = v; });
    return hit;
  };
  /* 실적의 by(제출자)는 업체명으로 들어온다. 이름으로도 찾을 수 있어야
     알림 화면에서 전화번호·링크를 붙일 수 있다. (v2.16.1) */
  A.vendByName = function (name) {
    var n = String(name || '').trim().toLowerCase(), hit = null;
    S.vend.forEach(function (v) {
      if (String(v.name).trim().toLowerCase() === n) hit = v;
      else if (String(v.code).trim().toLowerCase() === n) hit = v;
    });
    return hit;
  };

  A.vendByCode = function (code) {
    var hit = null;
    S.vend.forEach(function (v) { if (v.code === code) hit = v; });
    return hit;
  };

  /* ══ 직영 작업 (기성과 무관한 현장정리·폐기물처리 등) ═════════
     · 공종코드 없이 작업내용을 자유 입력한다 → 진행률·생산성 집계에 넣지 않는다.
     · 인원·장비 투입만 별도로 집계한다.
     · 협력업체 실적(S.work/S.crew)과 섞이지 않도록 저장소를 분리한다. */
  A.addDirect = function (r) {
    var o = { id: A.uid(), date: r.date || A.today(), loc: r.loc, task: String(r.task || '').trim(),
              teams: Number(r.teams) || 0, ppl: r.ppl || { eng: 0, fmn: 0, wkr: 0 }, eq: r.eq || [],
              by: r.by || '', note: String(r.note || '').trim(), st: r.st || 'sub' };
    S.direct.push(o); A.save(); return o;
  };
  A.updDirect = function (id, patch) {
    var hit = null;
    S.direct.forEach(function (x) {
      if (x.id !== id) return;
      hit = x;
      ['date', 'loc', 'task', 'teams', 'ppl', 'eq', 'by', 'note', 'st'].forEach(function (k) {
        if (patch[k] !== undefined) x[k] = patch[k];
      });
    });
    if (hit) A.save();
    return hit;
  };
  A.delDirect = function (id) {
    S.direct = S.direct.filter(function (x) { return x.id !== id; });
    A.save();
  };
  /* ★날짜를 본다 (v2.19.11 사용자 지시). 종전에는 위치만 보고 **전 기간**을
     늘어놓았다 — 표마다 기간이 있는데 직영만 없었다.
     기본은 오늘(RNG_DEF.dir), 기간 단추로 조회한다.
     ★A.inDate는 A.dateFlt를 본다. 화면 쪽에서 withRng('dir')로 잠깐 바꿔 준다. */
  A.directRows = function (f) {
    return S.direct.filter(function (x) { return A.locMatch(x, f) && A.inDate(x); })
      .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  };
  /* 직영 인원·장비 집계 (기성 실적과 분리해서 본다) */
  A.directSum = function (f) {
    var s = { rows: 0, teams: 0, ppl: { eng: 0, fmn: 0, wkr: 0 }, eq: 0 };
    A.directRows(f).forEach(function (x) {
      s.rows++; s.teams += Number(x.teams) || 0;
      A.JOBS.forEach(function (j) { s.ppl[j.id] += Number(x.ppl && x.ppl[j.id]) || 0; });
      s.eq += A.eqSum(x.eq, 'run') + A.eqSum(x.eq, 'brk') + A.eqSum(x.eq, 'rep');
    });
    return s;
  };
  A.T = function (k) {
    var L = window.I18N[S.lang] || window.I18N.ko;
    return L[k] != null ? L[k] : (window.I18N.ko[k] || k);
  };

  /* 공종·자재 표시 번역 (층3) — 원본 불변, 표시 시 조회. 미등록은 한국어 폴백 */
  A.trW = function (ko, lg) {                // 공종: EN·BN. lg를 주면 그 언어로 강제(협력업체 화면용)
    lg = lg || S.lang;
    if (!ko || lg === 'ko') return ko;
    var t = (window.WORK_TR && window.WORK_TR.work || {})[ko];
    return t ? (t[lg] || t.en || ko) : ko;
  };
  A.trM = function (ko, lg) {                // 자재: 영어만 (BN 화면서도 영어)
    lg = lg || S.lang;
    if (!ko || lg === 'ko') return ko;
    var t = (window.WORK_TR && window.WORK_TR.mat || {})[ko];
    return t ? (t.en || ko) : ko;
  };

  /* 규격(spec): 치수는 그대로 두고 한국어 부분만 바꾼다.
     예 'D315mm, 모래기초360˚' → 'D315mm, Sand bedding 360˚'
     긴 문구부터 치환해야 '현장타설콘크리트'가 '현장타설'로 잘리지 않는다. */
  var SPEC_KEYS = null;
  A.trS = function (ko, lg) {
    lg = lg || S.lang;
    if (!ko || lg === 'ko') return ko;
    var tr = (window.WORK_TR && window.WORK_TR.spec) || {}, out = String(ko);
    if (!SPEC_KEYS) {
      SPEC_KEYS = Object.keys(tr).sort(function (a, b) { return b.length - a.length; });
    }
    for (var i = 0; i < SPEC_KEYS.length; i++) {
      var k = SPEC_KEYS[i];
      if (out.indexOf(k) < 0) continue;
      out = out.split(k).join(tr[k].en || k);
    }
    return out;
  };

  /* 단위(unit): 마스터에 한글 단위가 17종 섞여 있다 — 개소·본·경간·회 등.
     EN/BN 화면에 그대로 나가면 협력업체가 못 읽는다(v2.15.3 사용자 지적).
     'm3/개소'처럼 복합 단위도 있어 조각 단위로 바꾼다. */
  /* 표는 work_i18n.js(WORK_TR.unit)에 둔다 — 번역표는 번역 파일에 모은다 */
  var UNIT_KEYS = null;
  A.trU = function (ko, lg) {
    lg = lg || S.lang;
    if (!ko || lg === 'ko') return ko;
    var UNIT_TR = (window.WORK_TR && window.WORK_TR.unit) || {};
    if (!UNIT_KEYS) {
      UNIT_KEYS = Object.keys(UNIT_TR).sort(function (a, b) { return b.length - a.length; });
    }
    var out = String(ko);
    for (var i = 0; i < UNIT_KEYS.length; i++) {
      var k = UNIT_KEYS[i];
      if (out.indexOf(k) < 0) continue;
      out = out.split(k).join(UNIT_TR[k][lg] || UNIT_TR[k].en || k);
    }
    return out;
  };

  /* ══ 위치체계 (층1 — 항상 영문) ═══════════════════════ */
  A.SITES = [{ id: 'civil', ko: '부지토목', en: 'Site Civil' },
             { id: 'anc', ko: '부대토목', en: 'Ancillary Civil' }];
  A.PHASES = [1, 2, 3, 4, 5, 6];
  A.SECTORS = [1, 2];
  A.TOWNS = [{ t: 'A', n: 9 }, { t: 'B', n: 8 }, { t: 'C', n: 6 }, { t: 'D', n: 5 },
             { t: 'E', n: 9 }, { t: 'F', n: 8 }, { t: 'G', n: 6 }, { t: 'H', n: 8 }];
  A.townBlocks = function (t) {
    var o = A.TOWNS.filter(function (x) { return x.t === t; })[0];
    if (!o) return [];
    var a = []; for (var i = 1; i <= o.n; i++) a.push(i); return a;
  };

  /* ══ 파일명으로 위치 판별 (v2.18.2 사용자 지시) ═══════════
     ★종전에는 상단 필터에서 사람이 고른 위치로 들어갔다. 위를 안 바꾸고
       올리면 엉뚱한 곳에 저장됐다 — Phase 3-2를 올렸는데 1-1로 들어간
       사고가 그것이다.
     ★이제 파일명이 기준이다. 상단 필터는 보지 않는다(사용자 지시).
     ★찾은 것이 없거나 둘 이상 나오면 정하지 않고 물어본다.
       틀린 곳에 조용히 넣는 것보다 한 번 묻는 편이 낫다.

     읽는 꼴
       페이즈 : P3-1 · 3-1 · P3_1 · Phase3-1 · P 3 - 1
       블럭   : B-7 · B7 · B7BL · BL7 · BL-7  (타운 글자가 앞에 붙는다)
     ★블럭은 타운 글자(A~H)가 있어야 자리가 정해진다. B7이면 Town B · Block 7. */
  A.locFromName = function (name) {
    var n = String(name || '').toUpperCase();
    n = n.replace(/\.[A-Z0-9]+$/, '');          /* 확장자 제거 */

    var hits = [], seen = {};
    function add(loc) {
      var k = A.locKey(loc);
      if (!seen[k]) { seen[k] = 1; hits.push(loc); }
    }

    /* 페이즈 — P3-1 / 3-1 / PHASE3-1. 앞뒤가 숫자면 안 잡는다(날짜·치수 오인 방지) */
    var re1 = /(?:^|[^0-9A-Z])(?:PHASE\s*|P\s*)?([1-6])\s*[-_]\s*([1-2])(?![0-9])/g, m;
    while ((m = re1.exec(n))) {
      /* 'P'나 'PHASE'가 붙어 있지 않은 맨 숫자쌍은 페이즈로 보되, 뒤에
         BL·B가 붙어 있으면 블럭 표기이므로 건너뛴다 */
      add({ s: 'civil', p: +m[1], c: +m[2] });
    }

    /* 블럭 — B7 / B-7 / B7BL / BL7 / BBL7. 타운 글자 A~H가 앞에 온다 */
    var re2 = /(?:^|[^0-9A-Z])([A-H])\s*(?:BL)?\s*[-_]?\s*(?:BL)?\s*([1-9])(?![0-9])\s*(?:BL)?/g;
    while ((m = re2.exec(n))) {
      var t = m[1], b = +m[2];
      if (A.townBlocks(t).indexOf(b) >= 0) add({ s: 'anc', t: t, b: b });
    }

    /* ★타운 글자 없이 BL7만 있는 꼴 — 블럭 번호는 알겠는데 어느 타운인지
       모른다. 정하지 않고 물어본다. 6개 타운에 7번 블럭이 다 있다. */
    if (!hits.length) {
      var bl = /(?:^|[^0-9A-Z])BL\s*[-_]?\s*([1-9])(?![0-9])/.exec(n);
      if (bl) return { ok: false, many: false, hits: [], blockOnly: +bl[1] };
    }
    if (hits.length === 1) return { ok: true, loc: hits[0] };
    return { ok: false, many: hits.length > 1, hits: hits };
  };

  /** loc = {s:'civil',p:3,c:1}  또는  {s:'anc',t:'B',b:5} */
  A.locKey = function (l) {
    if (!l || !l.s) return '';
    return l.s === 'civil' ? 'C|' + l.p + '|' + l.c : 'A|' + l.t + '|' + l.b;
  };
  A.locLabel = function (l) {
    if (!l || !l.s) return '—';
    return l.s === 'civil' ? 'Phase ' + l.p + '-' + l.c : 'Town ' + l.t + ' · Block ' + l.b;
  };
  A.locShort = function (l) {
    if (!l || !l.s) return '—';
    return l.s === 'civil' ? 'P' + l.p + '-' + l.c : l.t + '-' + l.b;
  };
  A.allLocs = function (site) {
    var o = [];
    if (site !== 'anc') A.PHASES.forEach(function (p) {
      A.SECTORS.forEach(function (c) { o.push({ s: 'civil', p: p, c: c }); });
    });
    if (site !== 'civil') A.TOWNS.forEach(function (t) {
      A.townBlocks(t.t).forEach(function (b) { o.push({ s: 'anc', t: t.t, b: b }); });
    });
    return o;
  };
  /** 기록이 필터에 걸리는지 — 필터는 부분지정 가능 */
  A.locMatch = function (rec, f) {
    if (!f || !f.s) return true;
    var l = rec.loc; if (!l || l.s !== f.s) return false;
    if (f.s === 'civil') return (!f.p || l.p === f.p) && (!f.c || l.c === f.c);
    return (!f.t || l.t === f.t) && (!f.b || l.b === f.b);
  };

  /* ══ 공종 레지스트리 ══════════════════════════════════ */
  var REG = {}, LIST = [];

  M.codes.forEach(function (c) {
    if (c.src === '시설물') return;
    var e = {
      key: c.c, kind: 'C', site: c.src === '부대토목' ? 'anc' : 'civil',
      code: c.c, grp: c.g, mid: c.m, name: c.n, spec: c.sp, unit: c.u,
      pkey: null, pteam: null, cls: '', pnote: ''
    };
    REG[e.key] = e; LIST.push(e);
  });

  A.FACS = [{ id: 'GL', ko: '갤러리', en: 'Gallery' },
            { id: 'PS', ko: '빗물펌프장', en: 'Storm P/S' },
            { id: 'SP', ko: '오수중계P/S', en: 'Sewage P/S' },
            { id: 'IT', ko: '이리게이션탱크', en: 'Irrigation Tank' }];
  A.FACS.forEach(function (f) {
    var Tb = D[f.id]; if (!Tb) return;
    var seenKey = {};
    Tb.rows.forEach(function (r) {
      /* base = 시설|그룹|규격. 원본 수량표에 같은 조합이 여러 행 있을 수 있으므로
         (단위가 다르거나 부위가 나뉜 경우) 두 번째부터 #n을 붙여 키를 유일하게 만든다.
         그러지 않으면 REG가 덮어써져 planQty가 마지막 행만 반환하고
         진행률 표에 같은 공종이 중복 출현한다. */
      var base = f.id + '|' + r.g + '|' + r.s;
      seenKey[base] = (seenKey[base] || 0) + 1;
      var key = seenKey[base] > 1 ? base + '#' + seenKey[base] : base;
      var m = D.MAP[base] || {}, pb = m.k ? D.PB[m.k] : null;   // MAP 조회는 항상 base로
      var e = {
        key: key, base: base, kind: 'F', site: 'civil', fac: f.id, code: '',
        grp: f.ko, mid: r.g, name: r.g, spec: r.s, unit: r.u,
        cls: m.c || '?', pkey: m.k || null,
        pteam: pb && pb.team != null ? pb.team : null,
        pnote: m.n || '', row: r
      };
      REG[key] = e; LIST.push(e);
    });
  });

  /* 기준 생산성 병합 (prod.js) — master.js는 자동생성이라 여기서 얹는다.
     이미 값이 있는 항목(구조물 등)은 덮어쓰지 않는다. */
  (function () {
    var PR = window.BNCP_PROD || {};
    LIST.forEach(function (e) {
      if (e.pteam != null && +e.pteam > 0) return;        // 기존 값 우선
      var d = PR[e.key] || PR[e.base];                    // #n 분리분은 base로도 찾는다
      if (!d) return;
      e.pteam = d.p;
      e.pkey = e.pkey || d.pkey;
      e.pnote = e.pnote || d.pkey;
    });
  })();

  /* 자재성 항목 판별 — 구조물 콘크리트에 딸려 들어가는 자재·부속(WATER STOP·SLEEVE 등).
     생산성이 없는 게 정상이므로 공정표·소요일 집계에서 뺀다. */
  A.isMat = function (e) { return !!(e && e.matlike); };
  (function () {
    var KW = (window.BNCP_MATLIKE || []).map(function (s) { return String(s).toUpperCase(); });
    if (!KW.length) return;
    LIST.forEach(function (e) {
      if (+e.pteam > 0) return;                       // 생산성이 있으면 공정이다
      var n = String(e.name || '').toUpperCase();
      for (var i = 0; i < KW.length; i++) {
        if (n.indexOf(KW[i]) >= 0) { e.matlike = true; return; }
      }
    });
  })();

  A.REG = REG; A.LIST = LIST;
  A.item = function (k) { return REG[k] || null; };
  A.isFac = function (k) { var e = REG[k]; return !!(e && e.kind === 'F'); };
  A.facCols = function (fac) { return (D[fac] && D[fac].cols) || []; };

  A.groupsOf = function (site) {
    var o = [], seen = {};
    LIST.forEach(function (e) {
      if (site && e.site !== site) return;
      if (!seen[e.grp]) { seen[e.grp] = { grp: e.grp, items: [] }; o.push(seen[e.grp]); }
      seen[e.grp].items.push(e);
    });
    return o;
  };
  A.itemsOf = function (site, grp) {
    return LIST.filter(function (e) {
      return (!site || e.site === site) && (!grp || e.grp === grp);
    });
  };

  /* ══ 설계목표 ═════════════════════════════════════════ */
  A.planQty = function (key, f) {
    var e = REG[key]; if (!e) return 0;
    var locs = A.allLocs().filter(function (l) { return A.locMatch({ loc: l }, f); });
    var t = 0;
    locs.forEach(function (l) {
      var lk = A.locKey(l);
      if (e.kind === 'C') t += (S.plan[lk] && S.plan[lk][key]) || 0;
      else {
        var cnt = (S.fac[lk] && S.fac[lk][e.fac]) || [];
        e.row.v.forEach(function (v, i) { t += (v || 0) * (cnt[i] || 0); });
      }
    });
    return Math.round(t * 1000) / 1000;
  };
  A.hasPlan = function (f) {
    var n = 0; LIST.forEach(function (e) { if (A.planQty(e.key, f) > 0) n++; }); return n;
  };

  /* ══ 실적 ═════════════════════════════════════════════ */
  A.actQty = function (key, f, all) {
    var t = 0;
    S.work.forEach(function (w) {
      if (w.key !== key) return;
      if (!all && w.st !== 'ok') return;
      if (!A.locMatch(w, f)) return;
      t += Number(w.qty) || 0;
    });
    return Math.round(t * 1000) / 1000;
  };
  /* ══ 오늘 + 미처리 (v2.18.9 사용자 확정) ═══════════════
     ★「검측이나 작업량이나 오늘 기준은 맞아. 그런데 확인 안 한 것들은 떠야
       누락된 거 확인하고 추가되는 거지.」
     ★그래서 기준이 둘이다 — 오늘 것이거나, 아직 처리 안 된 것.
       밀린 일이 화면에서 사라지면 그 일 자체가 없어진 것처럼 보인다.
     ★미처리는 날짜를 안 따진다. 두 달 전 것이라도 안 끝났으면 떠야 한다. */
  function todayOrOpen(rec, done) {
    if (!done) return true;                        /* 아직 안 끝났다 — 날짜 무관 */
    return String(rec && rec.date || '') === A.today();
  }

  /* ══ 오늘 + 미처리 (v2.18.9 사용자 확정) ═══════════════
     ★「오늘 기준은 맞아. 그런데 확인 안 한 것들은 떠야 누락된 걸 확인하고
       추가되는 거지」 — 처리한 것은 오늘 것만, 안 한 것은 날짜와 무관하게.
     ★안 그러면 어제 밀린 검측이 화면에서 사라져 그 일 자체가 없어진다. */
  A.todayOrOpen = function (rec, isOpen) {
    if (isOpen) return true;                      /* 미처리는 날짜 안 본다 */
    /* ★조회 기간을 따른다 (v2.19.0). 종전에는 A.today()로 굳어 있어
       기간 단추를 눌러도 끝난 건이 안 나왔다 — 단추가 반만 듣는 셈이었다.
       기간이 비어 있으면(전체) 오늘로 본다. */
    var d = String(rec && rec.date || '');
    if (A.dateFlt.from || A.dateFlt.to) return A.inDate(rec);
    return d === A.today();
  };

  A.pendWork = function (f) {
    return S.work.filter(function (w) { return w.st !== 'ok' && A.locMatch(w, f); });
  };
  A.pendCrew = function (f) {
    return S.crew.filter(function (w) { return w.st !== 'ok' && A.locMatch(w, f); });
  };

  A.rate = function (key, f) {
    var p = A.planQty(key, f); if (!p) return null;
    return A.actQty(key, f) / p * 100;
  };

  A.progressRows = function (f) {
    var o = [];
    LIST.forEach(function (e) {
      var p = A.planQty(e.key, f), a = A.actQty(e.key, f);
      if (!p && !a) return;
      o.push({ e: e, plan: p, act: a, rate: p ? a / p * 100 : null, left: p ? Math.max(0, p - a) : null });
    });
    return o;
  };
  A.avgRate = function (f) {
    var r = A.progressRows(f).filter(function (x) { return x.plan > 0; });
    if (!r.length) return null;
    var s = 0; r.forEach(function (x) { s += Math.min(100, x.rate); });
    return s / r.length;
  };

  /* ══ 인원·장비 ════════════════════════════════════════ */
  A.JOBS = [{ id: 'eng', ko: '엔지니어', en: 'Engineer', bn: 'ইঞ্জিনিয়ার' },
            { id: 'fmn', ko: '포맨', en: 'Foreman', bn: 'ফোরম্যান' },
            { id: 'wkr', ko: '워커', en: 'Worker', bn: 'শ্রমিক' }];
  A.pplSum = function (p) {
    if (!p) return 0; var t = 0;
    A.JOBS.forEach(function (j) { t += Number(p[j.id]) || 0; }); return t;
  };
  /** 장비기사 = 가동 장비 대수 (1:1 자동). 인원 다이얼에는 없다. */
  A.oprCount = function (eq) { return A.eqSum(eq, 'run'); };
  /** 총 투입인원 = 인원 다이얼 3직군 + 자동 장비기사 */
  A.crewTotal = function (c) { return A.pplSum(c && c.ppl) + A.oprCount(c && c.eq); };
  A.eqSum = function (eq, fld) {
    var t = 0; (eq || []).forEach(function (x) { t += Number(x[fld]) || 0; }); return t;
  };

  A.EQ_TREE = (EQ && EQ.tree) || [];
  A.EQ_TYPO = (EQ && EQ.typo) || {};
  /* ══ 장비 지급 기록 — 고칠 수 있어야 한다 (v2.16.2) ═══════
     ★종전에는 넣기만 되고 목록도, 수정도, 삭제도 없었다. 있는 것은
       「지급대장 전체 초기화」뿐이라, 오타 하나에 전부 지우고 다시 넣어야 했다.
       회수해서 장비가 줄어도 고칠 방법이 없었다(사용자 지적).
     ★옛 줄에는 id가 없다. 읽을 때 채워 준다 — 지우지 않는다. */
  A.issueRows = function (f) {
    var out = [];
    S.issue.forEach(function (g, i) {
      if (!g.id) g.id = 'ig' + i + '-' + (g.date || '') + '-' + (g.cat || '');
      /* ★업체 축 (v2.19.14) — 표와 같은 기준으로 센다. 위치·기간으로 거르면
         표에는 줄이 가득한데 배지만 0건이 되어 서로 어긋난다. */
      if (A.inCo(g)) out.push(g);
    });
    return out.sort(function (a, b) { return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); });
  };
  A.setIssueCnt = function (id, cnt) {
    var n = Number(cnt);
    if (!isFinite(n)) return false;
    for (var i = 0; i < S.issue.length; i++) {
      if (S.issue[i].id === id) { S.issue[i].cnt = n; A.save(); return true; }
    }
    return false;
  };
  A.delIssueRow = function (id) {
    S.issue = S.issue.filter(function (x) { return x.id !== id; });
    A.save();
  };

  /* 규격 한 칸의 지급(또는 회수) 총량을 그 값으로 맞춘다.
     ★줄을 새로 쌓지 않는다 — 같은 자리를 고친다. 그래야 표가 안 길어진다.
       기존 줄들을 합쳐 하나로 만들고 거기에 값을 적는다.
     ★★자리를 가르는 기준이 **위치에서 업체로 바뀌었다** (v2.19.14 사용자 확정).
       「장비는 업체에 주는 것이지 부지·부대에 주는 게 아니다.」
       한 업체가 부지·부대를 다 맡으면 그 업체의 지급 총량은 하나다.
       loc은 참고로 남겨 두되 자리를 가르지 않는다 — 종전 loc별로 흩어져
       있던 줄은 업체별 한 줄로 합쳐진다. */
  function eqPut(loc, cat, size, kind, qty, co, date) {
    var n = Math.max(0, Number(qty) || 0), keep = null;
    co = String(co || '');
    kind = (kind === 'take') ? 'take' : 'give';
    S.issue = S.issue.filter(function (g) {
      var same = g.cat === cat && (g.size || '') === (size || '') &&
        ((g.kind === 'take') === (kind === 'take')) && String(g.by || '') === co;
      if (!same) return true;
      if (!keep) { keep = g; return true; }
      return false;                       /* 흩어진 줄은 하나로 모은다 */
    });
    if (keep) {
      keep.cnt = n; keep.kind = kind; keep.by = co;
      keep.date = date || keep.date || A.today();
      keep.loc = loc || keep.loc;
    } else if (n > 0) {
      S.issue.push({ id: A.uid(), date: date || A.today(), loc: loc, cat: cat, size: size || '',
                     kind: kind, cnt: n, by: co });
    }
    return true;
  }
  /* ★파일 판독기도 손입력도 이 한 통로만 쓴다 — 같은 파일을 두 번 올려도
     보유가 두 배가 되지 않는다(v2.19.12까지는 push라 두 배가 됐다). */
  A.eqPut = eqPut;
  A.setEqQty = function (loc, cat, size, kind, qty, co) {
    eqPut(loc, cat, size, kind, qty, co, null);
    A.save();
    return true;
  };

  A.eqSizes = function (cat) {
    var o = A.EQ_TREE.filter(function (x) { return x.cat === cat; })[0];
    return o ? o.sizes : [];
  };
  A.eqLabel = function (cat, size) { return size ? cat + ' · ' + size : cat; };

  function crewIndex(f) {
    var ix = {};
    S.crew.forEach(function (c) {
      if (c.st !== 'ok' || !A.locMatch(c, f)) return;
      var k = c.date + '|' + A.locKey(c.loc) + '|' + c.key;
      (ix[k] = ix[k] || []).push(c);
    });
    return ix;
  }

  /** 실측 생산성 : 팀당 1일 생산량 = Σ수량 ÷ Σ팀수 (짝지어진 것만) */
  A.prod = function (key, f) {
    var ix = crewIndex(f), q = 0, td = 0, pp = 0, run = 0, n = 0, days = {};
    S.work.forEach(function (w) {
      if (w.key !== key || w.st !== 'ok' || !A.locMatch(w, f)) return;
      var cs = ix[w.date + '|' + A.locKey(w.loc) + '|' + w.key];
      if (!cs || !cs.length) return;
      var t = 0, p = 0, r = 0;
      cs.forEach(function (c) {
        t += Number(c.teams) || 0; p += A.crewTotal(c); r += A.eqSum(c.eq, 'run');
      });
      if (!t) return;
      q += Number(w.qty) || 0; td += t; pp += p; run += r; days[w.date] = 1; n++;
    });
    if (!td) return null;
    var e = REG[key], real = q / td;
    return {
      n: n, days: Object.keys(days).length, qty: q, teamDays: td, people: pp, run: run,
      perTeam: real, perMan: pp ? q / pp : null, perEq: run ? q / run : null,
      base: e && e.pteam != null ? e.pteam : null,
      gap: e && e.pteam ? (real - e.pteam) / e.pteam * 100 : null
    };
  };
  A.prodRows = function (f) {
    var seen = {}, o = [];
    S.work.forEach(function (w) { if (w.st === 'ok' && A.locMatch(w, f)) seen[w.key] = 1; });
    Object.keys(seen).forEach(function (k) { var p = A.prod(k, f); if (p) o.push({ e: REG[k], p: p }); });
    o.sort(function (a, b) { return b.p.n - a.p.n; });
    return o;
  };

  /** 공종별 집계 — 작업량 / 인원 / 장비 각각 */
  /* ══ 조회 날짜 (v2.15.0) ══════════════════════════════
     탭1 전체가 이 범위를 따른다. 비어 있으면 전 기간이다. */
  A.dateFlt = { from: '', to: '' };
  A.inDate = function (rec) {
    var d = String(rec && rec.date || '');
    if (!d) return true;
    if (A.dateFlt.from && d < A.dateFlt.from) return false;
    if (A.dateFlt.to && d > A.dateFlt.to) return false;
    return true;
  };
  /* ══ 업체 필터 (v2.15.0) ══════════════════════════════
     '' = 전체, '@dir' = 직영. 그 외는 업체명(제출자 by). */
  A.coFlt = '';
  A.inCo = function (rec, isDir) {
    if (!A.coFlt) return true;
    if (A.coFlt === '@dir') return !!isDir;
    return !isDir && String(rec && rec.by || '') === A.coFlt;
  };
  /* 위치 + 날짜 + 업체를 한 번에 — 집계는 전부 이걸 쓴다 */
  A.hit = function (rec, f, isDir) {
    return A.locMatch(rec, f) && A.inDate(rec) && A.inCo(rec, isDir);
  };

  /* ══ 장비 약어 (v2.15.0) ══════════════════════════════
     공종별 집계에 장비 62종을 원문으로 늘어놓으면 한 화면에 안 들어간다.
     ★약어는 표시 전용이다 — 지급대장 대조는 원문 철자로 한다. */
  var EQ_ABBR = [
    [/^dump\s*truck/i, 'D/T'], [/^excavator\s*\(?wheel/i, 'EX(W)'],
    [/^excavator\s*\(?crawler/i, 'EX(C)'], [/^excavator/i, 'EX'],
    [/^motor\s*grader/i, 'MG'], [/^wheel\s*loader/i, 'WL'],
    [/^pay\s*\(?wheel\)?\s*loader/i, 'PL'], [/^skid\s*loader/i, 'SL'],
    [/^vib.*padfoot/i, 'VR-P'], [/^vib/i, 'VR'], [/^tire\s*roller/i, 'TR'],
    [/^tandem\s*roller/i, 'TDR'], [/^combi\s*roller/i, 'CR'],
    [/^compactor/i, 'CPT'], [/^dozer/i, 'DZ'],
    [/^asphalt\s*finisher/i, 'AF'], [/^asphalt\s*distributor/i, 'AD'],
    [/^concrete\s*pump/i, 'CPC'], [/^cement\s*bulk/i, 'CBC'],
    [/^cargo\s*crane/i, 'CCT'], [/^cargo\s*truck/i, 'CGT'],
    [/^armroll/i, 'ART'], [/^fuel\s*truck/i, 'FT'], [/^water\s*truck/i, 'WT'],
    [/^line\s*marker/i, 'LM'], [/^pile\s*driver/i, 'PD'],
    [/^crane/i, 'CR-N'], [/^forklift/i, 'FL'], [/^generator/i, 'GEN'],
    [/^compressor/i, 'COM'], [/^pump/i, 'PMP'], [/^trailer/i, 'TRL'],
    [/^bus/i, 'BUS'], [/^pickup/i, 'PU'], [/^backhoe/i, 'BH']
  ];
  var abbrCache = {};
  A.eqAbbr = function (cat) {
    if (abbrCache[cat] != null) return abbrCache[cat];
    var out = '';
    for (var i = 0; i < EQ_ABBR.length; i++) {
      if (EQ_ABBR[i][0].test(cat)) { out = EQ_ABBR[i][1]; break; }
    }
    if (!out) {
      /* 사전에 없는 장비 — 낱말 첫 글자를 딴다 (Tower Lamp → TL) */
      var w = String(cat).replace(/[^A-Za-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
      out = w.length > 1 ? w.slice(0, 3).map(function (x) { return x[0].toUpperCase(); }).join('')
                         : String(cat).slice(0, 3).toUpperCase();
    }
    abbrCache[cat] = out;
    return out;
  };

  /* ══ 재확인 요청 (v2.15.0) ════════════════════════════
     생산성이 기준을 크게 넘어도 막지 않는다 — 장비 증투·야간이면 정상이다.
     다만 표시만 하면 아무 일도 일어나지 않으므로 업체에 답을 받아낸다.
     실적 상태: wait → (recheck) → ok  /  reject는 삭제와 같다. */
  A.RECHECK_WHY = [
    { id: 'eqadd', ko: '장비 증투', en: 'Extra equipment' },
    { id: 'night', ko: '야간작업', en: 'Night work' },
    { id: 'typo', ko: '입력 오기', en: 'Input error' },
    { id: 'etc', ko: '기타', en: 'Other' }
  ];
  A.askRecheck = function (id, why) {
    var t = null;
    S.work.forEach(function (w) { if (w.id === id) t = w; });
    if (!t) return false;
    t.st = 'recheck';
    t.rcWhy = why || '';
    t.rcAt = A.today();
    A.save();
    return true;
  };
  A.rechecks = function (f) {
    return S.work.filter(function (w) { return w.st === 'recheck' && A.hit(w, f); });
  };

  /* ══ 정비 대장 (v2.15.0) ══════════════════════════════
     체크박스만 있던 것을 단계로 바꾼다. 완료건은 목록에서 내려간다.
     req(의뢰) → recv(접수) → fix(수리중) → done(완료) */
  A.MT_STEPS = ['req', 'recv', 'fix', 'done'];
  A.mtSet = function (id, step, why) {
    S.mt = S.mt || {};
    var m = S.mt[id] = S.mt[id] || {};
    if (step != null) {
      m.step = step;
      m.req = step && step !== 'done';        /* 옛 필드 유지 — 기존 자료 호환 */
      if (step === 'req' && !m.reqAt) m.reqAt = A.today();
      if (step === 'done') m.doneAt = A.today();
    }
    if (why != null) m.why = why;
    A.save();
  };
  A.mtStep = function (id) {
    var m = (S.mt || {})[id];
    if (!m) return '';
    if (m.step) return m.step;
    return m.req ? 'req' : '';                /* v2.14 이전 자료 */
  };

  /* ══ 장비 현황 — 지급대조와 정비의뢰를 하나로 (v2.15.0) ══
     종류별로 지급·가동·고장·정비의뢰를 한 줄에 보이고,
     펼치면 규격별 상세가 나온다. */
  A.eqStatus = function (f) {
    var rec = A.eqRecon(f), by = {};
    rec.forEach(function (r) {
      var a = A.eqAbbr(r.cat);
      var o = by[r.cat] || (by[r.cat] = {
        cat: r.cat, abbr: a, given: null, gv: 0, tk: 0, run: 0, brk: 0, rep: 0, mt: 0, rows: []
      });
      o.run += r.run; o.brk += r.brk; o.rep += r.rep;
      o.gv += (r.gv || 0); o.tk += (r.tk || 0);
      if (r.given != null) o.given = (o.given || 0) + r.given;
      var st = A.mtStep(r.id);
      if (st && st !== 'done') o.mt++;
      o.rows.push(r);
    });
    return Object.keys(by).map(function (k) { return by[k]; })
      .sort(function (a, b) { return (b.brk + b.rep) - (a.brk + a.rep) || b.run - a.run; });
  };

  /* ══ 공종별 집계 ══════════════════════════════════════ */
  /* ══ 업체 기준 집계 (v2.17.5 사용자 지시) ═══════════════
     ★A.rollup은 공종키로만 합쳐 업체 정보가 사라진다. 같은 자료를
       업체 → 공종 순으로 다시 묶는다. 저장소는 건드리지 않는다.
     ★직영도 한 줄로 들어간다 — 현장 전체 투입을 볼 때 빠지면 실제와 안 맞는다(4-J). */
  /* ══ 공구 현황 (v2.18.0) ═══════════════════════════════
     ★「어느 공구에 몇 명이 장비 몇 대로 어디서 작업 중인가」 — 처음 보는
       사람이 알고 싶은 것은 공종이 아니라 이 그림이다(사용자 지시).
     ★공구가 기본 단위다. 공구당 업체는 하나이므로 업체명이 한 줄에 한 번만
       나오고, 종전 작업위치 표에서 매 줄 반복되던 중복이 사라진다.
       (한 업체가 여러 공구를 맡는 것은 된다 — 업체가 여러 줄에 나올 뿐이다.)
     ★작업 없는 공구는 줄을 만들지 않는다(사용자 지시).
     ★인원·장비는 「오늘」, 검측·측량·자재는 「누계」다(사용자 확정).
       한 표에 기준이 둘이라 칸 머리에 그 사실을 적는다. */
  A.siteRows = function (f, today) {
    today = today || A.today();
    var m = {}, list = [];
    function slot(loc) {
      var k = A.locKey(loc);
      if (!m[k]) {
        m[k] = { key: k, loc: loc, co: {}, pax: 0, run: 0, down: 0,
                 spots: [], seen: {}, insp: 0, surv: 0, mat: 0 };
        list.push(m[k]);
      }
      return m[k];
    }
    /* 오늘 인원·장비 — 협력업체 + 직영 */
    function feed(c, isDir) {
      if (!A.locMatch(c, f) || c.date !== today) return;
      var o = slot(c.loc);
      o.pax += A.crewTotal(c);
      if (isDir) o.co[A.T('res_dir')] = 1;
      else if (c.by) o.co[c.by] = 1;
      (c.eq || []).forEach(function (x) {
        o.run += Number(x.run) || 0;
        o.down += (Number(x.brk) || 0) + (Number(x.rep) || 0);
      });
    }
    S.crew.forEach(function (c) { if (c.st === 'ok') feed(c, false); });
    S.direct.forEach(function (c) { feed(c, true); });

    /* ★오늘 작업위치는 「인원·장비」에서 뽑는다 (v2.18.9 사용자 지적).
       종전에는 실적(S.work)에서 뽑았다. 그런데 실적은 그날 일이 끝나야
       나오므로 오늘 것이 늘 비어 있고, 현장 현황의 작업위치가 항상 「—」였다.
       ★「오늘 어디에 나와 있나」는 투입이 답한다. 실적이 아니다.
         작업량 표 밑의 「작업위치」(어제·실적 기준)와는 다른 물건이다 —
         이름이 같아 하나로 묶으면 안 된다. */
    /* ★★v2.19.19 — `rec.spots`(복수)도 읽는다.
       종전에는 `rec.spot` 하나만 봤는데, S.crew의 `spot`은 일반 공종이면
       늘 `null`이고 시설물이면 열 번호(숫자)라 **`kind:'road'`가 될 수가
       없었다.** 그래서 작업위치 칸이 항상 「—」였다(사용자 확인).
       측점을 인원·장비 폼에서도 받으면서(사용자 확정 「가」) 한 행에 쪽마다
       측점이 여럿 담긴다 — 행을 쪼개면 인원이 중복 계상되기 때문이다.
       ★옛 `spot` 한 개짜리도 그대로 읽는다. 지난 기록을 버리지 않는다. */
    function pickSpot(o, rec) {
      var SP = window.BNCP_SPOT; if (!SP) return;
      var list = [];
      if (rec.spots && rec.spots.length) list = rec.spots;
      else if (rec.spot) list = [rec.spot];
      list.forEach(function (x) {
        if (!x || x.kind !== 'road') return;
        var sp = String(SP.label(x)).replace(/^\s*·\s*/, '');
        if (sp && !o.seen[sp]) { o.seen[sp] = 1; o.spots.push(sp); }
      });
    }
    S.crew.forEach(function (c) {
      if (c.st !== 'ok' || !A.locMatch(c, f) || c.date !== today) return;
      pickSpot(slot(c.loc), c);
    });
    S.direct.forEach(function (c) {
      if (!A.locMatch(c, f, true) || c.date !== today) return;
      pickSpot(slot(c.loc), c);
    });

    /* 밀린 것 — 누계다. 오늘로 자르지 않는다 */
    S.insp.forEach(function (r) {
      if (r.st !== 'apply' || !A.locMatch(r, f)) return;
      slot(r.loc).insp++;
    });
    S.surv.forEach(function (r) {
      if (r.done || !A.locMatch(r, f)) return;
      slot(r.loc).surv++;
    });
    S.mreq.forEach(function (r) {
      if (r.st !== 'req' || !A.locMatch(r, f)) return;
      slot(r.loc).mat++;
    });

    /* ★작업 없는 공구는 뺀다 — 사람도 장비도 밀린 것도 없는 줄 */
    /* ★작업위치만 있고 인원 기록이 없는 공구도 남긴다 — 실적이 올라왔다는
       것 자체가 「작업 있음」이다. spots를 빼면 그 줄이 통째로 사라진다. */
    return list.filter(function (o) {
      return o.pax || o.run || o.down || o.spots.length || o.insp || o.surv || o.mat;
    }).map(function (o) {
      o.cos = Object.keys(o.co);
      return o;
    }).sort(function (a, b) {
      return A.locLabel(a.loc) < A.locLabel(b.loc) ? -1 : 1;
    });
  };

  A.rollupCo = function (f) {
    var by = {}, list = [];
    function slot(co, key) {
      var g = by[co] || (by[co] = { co: co, dir: false, map: {}, rows: [] });
      var s = g.map[key] || (g.map[key] = {
        e: REG[key] || { key: key, name: key, grp: '', unit: '' },
        key: key, qty: 0, teams: 0, ppl: { eng: 0, fmn: 0, wkr: 0 }, opr: 0, pplT: 0,
        eq: {}, run: 0, brk: 0, rep: 0
      });
      if (g.rows.indexOf(s) < 0) g.rows.push(s);
      if (list.indexOf(g) < 0) list.push(g);
      return s;
    }
    function feed(c, isDir, key) {
      var co = isDir ? A.T('res_dir') : (c.by || '—');
      var s = slot(co, key);
      if (isDir) by[co].dir = true;
      s.teams += Number(c.teams) || 0;
      A.JOBS.forEach(function (j) { s.ppl[j.id] += Number(c.ppl && c.ppl[j.id]) || 0; });
      s.opr += A.oprCount(c.eq);
      s.pplT += A.crewTotal(c);
      (c.eq || []).forEach(function (x) {
        var id = x.cat + '|' + x.size;
        s.eq[id] = s.eq[id] || { cat: x.cat, size: x.size, run: 0, brk: 0, rep: 0 };
        s.eq[id].run += Number(x.run) || 0;
        s.eq[id].brk += Number(x.brk) || 0;
        s.eq[id].rep += Number(x.rep) || 0;
        s.run += Number(x.run) || 0; s.brk += Number(x.brk) || 0; s.rep += Number(x.rep) || 0;
      });
    }
    S.crew.forEach(function (c) { if (c.st === 'ok' && A.hit(c, f)) feed(c, false, c.key); });
    S.direct.forEach(function (c) { if (A.hit(c, f, true)) feed(c, true, '_dir'); });
    list.forEach(function (g) {
      g.rows.sort(function (a, b) { return b.pplT - a.pplT; });
    });
    return list.sort(function (a, b) { return (a.dir - b.dir) || (a.co < b.co ? -1 : 1); });
  };

  A.rollup = function (f) {
    var o = {};
    function slot(k) {
      if (!o[k]) o[k] = {
        e: REG[k], qty: 0, teams: 0,
        ppl: { eng: 0, fmn: 0, wkr: 0 }, opr: 0, pplT: 0,
        eq: {}, run: 0, brk: 0, rep: 0
      };
      return o[k];
    }
    S.work.forEach(function (w) {
      if (w.st !== 'ok' || !A.hit(w, f)) return;
      slot(w.key).qty += Number(w.qty) || 0;
    });
    S.crew.forEach(function (c) {
      if (c.st !== 'ok' || !A.hit(c, f)) return;
      var s = slot(c.key);
      s.teams += Number(c.teams) || 0;
      A.JOBS.forEach(function (j) { s.ppl[j.id] += Number(c.ppl && c.ppl[j.id]) || 0; });
      s.opr += A.oprCount(c.eq);
      s.pplT += A.crewTotal(c);
      (c.eq || []).forEach(function (x) {
        var id = x.cat + '|' + x.size;
        s.eq[id] = s.eq[id] || { cat: x.cat, size: x.size, run: 0, brk: 0, rep: 0 };
        s.eq[id].run += Number(x.run) || 0;
        s.eq[id].brk += Number(x.brk) || 0;
        s.eq[id].rep += Number(x.rep) || 0;
        s.run += Number(x.run) || 0; s.brk += Number(x.brk) || 0; s.rep += Number(x.rep) || 0;
      });
    });
    return Object.keys(o).map(function (k) { return o[k]; })
      .filter(function (x) { return x.e; })
      .sort(function (a, b) { return b.qty - a.qty; });
  };

  /* ══ 장비 지급대조 ════════════════════════════════════ */
  A.eqRecon = function (f, date) {
    var used = {}, given = {}, give = {};
    S.crew.forEach(function (c) {
      if (c.st !== 'ok' || !A.hit(c, f)) return;
      if (date && c.date !== date) return;
      (c.eq || []).forEach(function (x) {
        var id = x.cat + '|' + x.size;
        used[id] = used[id] || { cat: x.cat, size: x.size, run: 0, brk: 0, rep: 0 };
        used[id].run += Number(x.run) || 0;
        used[id].brk += Number(x.brk) || 0;
        used[id].rep += Number(x.rep) || 0;
      });
    });
    /* ★지급과 회수를 갈라서 센다 (v2.16.5).
       회수는 kind:'take'. 옛 줄에는 kind가 없으니 지급으로 본다 — 지우지 않는다.
       ★보유 = 지급 − 회수. 회수했는데 보유가 안 줄면 대조가 무의미하다. */
    /* ★★보유는 **업체 축**이고 **날짜를 보지 않는다** (v2.19.14 사용자 확정).
       「한번 올린 지급 대수는 내가 회수할 때까지 지급한 것이다.
         그날그날 지급하는 게 아니다.」
       ① 위치로 거르지 않는다 — 상단 필터를 Phase 하나로 좁혀도 그 업체가
          받아 둔 대수는 줄지 않는다.
       ② 기간으로도 거르지 않는다 — 지급은 **상태값**이다. 어제 올린 파일이
          오늘 보유 0이 되면 안 된다. 줄어드는 길은 회수(kind:'take')뿐이다.
       ★가동·고장(S.crew)은 종전대로 위치별·기간별이다 — 그쪽은 그날의 기록이다.
       ★줄에 남는 date는 「언제 그 값으로 맞췄나」일 뿐, 거르는 데 쓰지 않는다. */
    S.issue.forEach(function (g) {
      if (!A.inCo(g)) return;
      var id = g.cat + '|' + g.size;
      var q = Number(g.cnt) || 0;
      var t = give[id] || (give[id] = { give: 0, take: 0, by: {} });
      if (g.kind === 'take') t.take += q; else t.give += q;
      var co = g.by || '';
      if (co) {
        var c = t.by[co] || (t.by[co] = { give: 0, take: 0 });
        if (g.kind === 'take') c.take += q; else c.give += q;
      }
      given[id] = t.give - t.take;
    });
    var ids = {};
    Object.keys(used).forEach(function (k) { ids[k] = 1; });
    Object.keys(given).forEach(function (k) { ids[k] = 1; });
    return Object.keys(ids).map(function (id) {
      var p = id.split('|');
      var u = used[id] || { cat: p[0], size: p[1], run: 0, brk: 0, rep: 0 };
      var tot = u.run + u.brk + u.rep, g = given[id] == null ? null : given[id];
      var gv = give[id] || { give: 0, take: 0, by: {} };
      u.gv = gv.give; u.tk = gv.take; u.gby = gv.by;
      var flag = '';
      if (g == null) flag = 'nogive';
      else if (tot > g) flag = 'over';
      else if (tot === 0 && g > 0) flag = 'norec';
      else if (tot < g) flag = 'idle';
      return { id: id, cat: u.cat, size: u.size, run: u.run, brk: u.brk, rep: u.rep,
               used: tot, given: g, idle: g == null ? null : g - tot, flag: flag,
               gv: gv.give, tk: gv.take, gby: gv.by };
    }).sort(function (a, b) {
      var o = { over: 0, norec: 1, nogive: 2, idle: 3, '': 4 };
      return o[a.flag] - o[b.flag] || b.used - a.used;
    });
  };

  /** 고장·수리가 2일 이상 이어지는 장비 — 사유 확인 대상 */
  A.LONG = 2;
  A.longRepair = function (f) {
    var byId = {};
    S.crew.forEach(function (c) {
      if (!A.locMatch(c, f)) return;
      (c.eq || []).forEach(function (x) {
        if (!(Number(x.rep) > 0 || Number(x.brk) > 0)) return;
        var id = A.locKey(c.loc) + '|' + x.cat + '|' + x.size;
        byId[id] = byId[id] || { loc: c.loc, cat: x.cat, size: x.size, days: {}, note: '' };
        byId[id].days[c.date] = 1;
        if (x.note) byId[id].note = x.note;
      });
    });
    return Object.keys(byId).map(function (k) {
      var o = byId[k], ds = Object.keys(o.days).sort();
      return { loc: o.loc, cat: o.cat, size: o.size, n: ds.length,
               from: ds[0], to: ds[ds.length - 1], note: o.note };
    }).filter(function (x) { return x.n >= A.LONG; })
      .sort(function (a, b) { return b.n - a.n; });
  };

  /* ══ 검측 ═════════════════════════════════════════════ */
  A.INSP_ST = ['apply', 'ready', 'sub', 'pass', 'fail', 'delay'];
  A.inspNeedReason = function (st) { return st === 'fail' || st === 'delay'; };
  A.inspOpen = function (r) { return r.st === 'apply' || r.st === 'ready' || r.st === 'sub' || r.st === 'delay'; };
  // 장기 경고 제거 — 항상 0
  A.inspLong = function () { return 0; };
  A.inspList = function (f) {
    return S.insp.filter(function (r) {
      if (!A.locMatch(r, f)) return false;
      /* ★끝난 것은 합격뿐이다. 불합격·지연은 재검측이 남아 있으므로
         미처리다 — 날짜와 무관하게 계속 떠야 한다(사용자 지시).
         재검측을 새로 만들면 원건은 그때 목록에서 빠진다(r.re로 이어진다). */
      var done = (r.st === 'pass');
      return A.todayOrOpen(r, !done);
    });
  };
  /** 기간을 직접 준 조회 — 과거를 볼 때 쓴다 */
  A.inspAll = function (f) { return S.insp.filter(function (r) { return A.locMatch(r, f); }); };
  A.setInsp = function (id, st, reason) {
    var r = S.insp.filter(function (x) { return x.id === id; })[0]; if (!r) return null;
    r.hist = r.hist || [];
    r.hist.push({ at: A.today(), st: st, reason: reason || '' });
    r.st = st; r.stAt = A.today();
    if (A.inspNeedReason(st)) r.reason = reason || '';
    A.save(); return r;
  };
  A.reInsp = function (id) {
    var r = S.insp.filter(function (x) { return x.id === id; })[0]; if (!r) return null;
    var n = {
      id: A.uid(), date: A.today(), loc: r.loc, key: r.key, unit: r.unit, qty: r.qty,
      st: 'apply', stAt: A.today(), reason: '', by: r.by, spot: r.spot,
      re: r.re || r.id, seq: (r.seq || 1) + 1, hist: []
    };
    S.insp.push(n); A.save(); return n;
  };

  /* ══ 결재 흐름 — 자재·측량 공용 (v2.20.0 사용자 지시) ═══════
     ★자재와 측량은 **같은 모양**이다.
         신청(업체) → 검토(스탭) → 확인(관리자) → 실행 → 완료입력
       그래서 엔진을 **한 벌만** 둔다. 이름만 다르다
       (지급요청/측량요청 · 지급/측량지시). 종전에는 자재 따로 측량 따로
       제각각이라 같은 일을 두 벌로 고쳐야 했다.

     ★복잡해지는 것은 단계 수가 아니라 아래 셋이다. 규칙으로 미리 막는다.
       ① **반려는 항상 한 칸만 뒤로.** 어디로 보낼지 고르게 하지 않는다.
          관리자가 반려하면 자동으로 스탭, 스탭이 반려하면 자동으로 업체다.
          규칙이 하나라 헷갈릴 자리가 없다.
       ② **버튼은 둘뿐.** 단계마다 이름만 바뀐다(승인/반려 · 완료/미완료).
          셋째 버튼이 생기는 순간 복잡해진다.
       ③ **사람은 「내 차례」만 본다.** 단계가 다섯이어도 각자에겐 한 줄이다.

     ★측량은 스탭 선에서 끝나는 길(alt='none')이 있다 — 스탭이 「측량 불필요」로
       보면 관리자까지 안 올린다. 관리자는 정말 필요한 것만 본다.
       관리자 반려(rej)는 「스탭 판단이 틀렸다」일 때만 쓴다.

     ★기록은 지우지 않는다(v2.19.1의 미지급 원칙 그대로) — 「누구 잘못인지
       알아야 되잖아」. 되돌아간 것도 hist에 누가·언제·왜가 남는다. */
  A.FLOW = {
    mat: {
      req:   { own: 'staff',  ok: 'chk',   no: 'back' },   /* 스탭 검토 → 관리자에 지급요청 */
      chk:   { own: 'admin',  ok: 'ord',   no: 'rej'  },   /* 관리자 확인 → 지급지시 */
      ord:   { own: 'staff',  ok: 'iss'               },   /* 확인 후 지급 */
      /* ★지급 뒤는 **양쪽이 확인해야** 끝난다 (v2.20.1 사용자 지시).
         「협력업체도 수령하면 확인해야 서로 확인되는 거잖아. 그러면 최종 종료.」
         한쪽만 누르면 이 자리에 그대로 남고, 남아 있는 동안 경고가 뜬다. */
      iss:   { own: 'staff',  own2: 'vendor', dual: 1, ok: 'fin' },
      fin:   { end: 1 },
      back:  { own: 'vendor', ok: 'req'               },   /* 업체 재검토 → 다시 올린다 */
      rej:   { own: 'staff',  ok: 'chk',   no: 'back' }    /* 스탭 재검토 */
    },
    surv: {
      req:   { own: 'staff',  ok: 'chk',   no: 'back', alt: 'none' },
      chk:   { own: 'admin',  ok: 'ord',   no: 'rej'  },   /* 관리자 측량지시 */
      ord:   { own: 'surv',   ok: 'sdone', no: 'sfail' },  /* 측량팀 완료 / 미완료+사유 */
      sdone: { own: 'staff',  ok: 'fin',   no: 'delay' },  /* 스탭 확인·조치 */
      sfail: { own: 'staff',  ok: 'fin',   no: 'delay' },
      delay: { own: 'staff',  ok: 'fin'               },   /* 지연은 끝난 것이 아니다 */
      fin:   { end: 1 },
      none:  { end: 1 },                                    /* 측량 불필요 — 스탭 선에서 종결 */
      back:  { own: 'vendor', ok: 'req'               },
      rej:   { own: 'staff',  ok: 'chk',   no: 'back' }
    }
  };

  /** 지금 단계 — 옛 기록도 그대로 읽는다(마이그레이션 없이).
      ★옛 자료를 버리지 않는다. fst가 없으면 종전 필드에서 유추한다. */
  A.fst = function (kind, r) {
    if (!r) return '';
    if (r.fst && A.FLOW[kind] && A.FLOW[kind][r.fst]) return r.fst;
    if (kind === 'mat') {
      if (r.st === 'iss') return 'fin';                  /* 옛 지급건은 끝난 것으로 본다 */
      if (r.st === 'noiss' || r.st === 'deny') return 'back';
      if (r.st === 'apv' || r.st === 'plantReq') return 'chk';
      return 'req';
    }
    return r.done ? 'fin' : 'req';
  };
  A.flowDef = function (kind, r) { return (A.FLOW[kind] || {})[A.fst(kind, r)] || null; };
  A.flowEnd = function (kind, r) { var d = A.flowDef(kind, r); return !!(d && d.end); };

  /** ★아직 안 누른 사람들 — 양쪽 확인 단계에서는 둘이 나온다.
      한쪽이 눌렀으면 그쪽은 빠지고 남은 쪽만 남는다. */
  A.flowOwns = function (kind, r) {
    var d = A.flowDef(kind, r);
    if (!d || d.end) return [];
    if (!d.dual) return d.own ? [d.own] : [];
    var out = [];
    if (!r.okS) out.push(d.own);
    if (!r.okV) out.push(d.own2);
    return out;
  };
  /** 대표 하나 — 라벨·묶음용. 남은 사람이 둘이면 앞의 것을 든다. */
  A.flowOwn = function (kind, r) { return A.flowOwns(kind, r)[0] || ''; };

  /** 「내 차례」 — 그 역할이 지금 눌러야 하는 것인가.
      ★관리자를 스탭 자리에 끼워 넣지 않는다. 끼워 넣으면 관리자 목록이
        스탭 것으로 가득 차 정작 관리자가 볼 것이 묻힌다. 전체는 아래 표에서 본다. */
  A.flowMine = function (kind, r, role) {
    role = role || A.role();
    if (!role || role === 'vendor') return false;
    return A.flowOwns(kind, r).indexOf(role) >= 0;
  };
  /** 협력업체 화면 전용 — 업체가 눌러야 하는 것인가 */
  A.flowMineVendor = function (kind, r) {
    return A.flowOwns(kind, r).indexOf('vendor') >= 0;
  };

  /** 한 칸 옮긴다. dir : 'ok' | 'no' | 'alt'
      ★어디로 갈지는 표가 정한다 — 부르는 쪽이 고르지 않는다(규칙 ①). */
  A.flowGo = function (kind, r, dir, o) {
    if (!r) return null;
    var d = A.flowDef(kind, r); if (!d) return null;
    var to = d[dir || 'ok']; if (!to) return null;
    o = o || {};
    /* ★양쪽 확인 — 누른 쪽만 표시하고, **둘 다 눌렀을 때만** 넘어간다.
       누가 눌렀는지는 o.as(역할)로 받는다. 이름(o.by)으로는 가릴 수 없다 —
       업체 담당자 이름이 스탭 이름과 같을 수도 있고, 비어 있을 수도 있다. */
    if (d.dual && (dir || 'ok') === 'ok') {
      var as = o.as || A.role();
      if (as === 'vendor') { r.okV = 1; r.okVAt = A.nowISO(); r.okVBy = o.by || ''; }
      else { r.okS = 1; r.okSAt = A.nowISO(); r.okSBy = o.by || ''; if (o.qty != null) r.iss = Number(o.qty); }
      r.hist = r.hist || [];
      r.hist.push({ st: A.fst(kind, r), at: A.nowISO(), by: o.by || '', why: '', as: as });
      if (!(r.okS && r.okV)) { A.save(); return r; }   /* 아직 한쪽뿐 — 여기 그대로 남는다 */
    }
    r.fst = to;
    r.fat = A.nowISO();                       /* 이 단계에 들어온 시각 — 독촉의 기준점 */
    r.fby = o.by || '';
    if (o.why != null) r.fwhy = String(o.why);
    else if (dir === 'ok') r.fwhy = '';
    r.hist = r.hist || [];
    r.hist.push({ st: to, at: r.fat, by: r.fby, why: r.fwhy || '' });
    /* ★뒤로 갔으면 양쪽 확인 표시를 지운다. 안 지우면 다시 지급됐을 때
       옛 확인이 남아 한쪽만 눌러도 종료된다. */
    if (to === 'req' || to === 'back' || to === 'rej' || to === 'chk' || to === 'ord') { r.okS = 0; r.okV = 0; }
    /* 종전 필드도 같이 맞춘다 — 옛 화면·집계·서버가 그대로 읽는다 */
    if (kind === 'mat') {
      if (to === 'iss' || to === 'fin') { r.st = 'iss'; if (o.qty != null) r.iss = Number(o.qty); if (!r.issAt) r.issAt = r.fat; }
      else if (to === 'back' || to === 'rej') { r.st = 'noiss'; r.noissWhy = r.fwhy || ''; }
      else if (to === 'chk' || to === 'ord') r.st = 'apv';
      else r.st = 'req';
      if (to === 'fin' && o.qty != null) r.iss = Number(o.qty);
    } else {
      r.done = (to === 'fin');
      if (to === 'none') r.done = true;       /* 측량 불필요도 「더 볼 것 없음」이다 */
      if (r.fwhy) r.why2 = r.fwhy;
    }
    A.save();
    return r;
  };

  /* ══ 독촉 — 화면과 문자 (v2.20.0 사용자 지시) ════════════
     「확인이 늦어지면 화면에서 독촉할 수 있게 해줘. 문자가 아니라
       화면하고 문자로 독촉하는 거야.」
     ★끝난 단계(end)와 업체 차례(vendor)는 세지 않는다 — 업체 독촉은
       종전 A.dueList가 이미 맡고 있다. 두 곳에서 세면 두 번 간다. */
  A.DUE_FLOW = { gap: 60 };                  /* 단계 대기 60분 → 1차, 120분 → 2차 */

  A.flowLate = function (kind, r, now) {
    now = now || new Date();
    var d = A.flowDef(kind, r);
    if (!d || d.end || d.own === 'vendor') return 0;
    var t = r.fat || r.at || '';
    if (!t) return String(r.date || '') === A.today() ? 0 : 2;  /* 시각 없는 옛 기록 */
    var dt = new Date(t);
    if (isNaN(dt.getTime())) return 0;
    return _stage(_mins(dt, now), A.DUE_FLOW.gap);
  };

  /** 지금 화면에 띄울 것 — 내 차례이면서 늦은 것 */
  A.flowMineList = function (f, role, now) {
    role = role || A.role();
    var out = [];
    [['mat', S.mreq], ['surv', S.surv]].forEach(function (p) {
      (p[1] || []).forEach(function (r) {
        if (!A.locMatch(r, f)) return;
        if (!A.flowMine(p[0], r, role)) return;
        out.push({ kind: p[0], row: r, st: A.fst(p[0], r), late: A.flowLate(p[0], r, now) });
      });
    });
    return out.sort(function (a, b) { return b.late - a.late || (a.row.date < b.row.date ? -1 : 1); });
  };

  /** 문자 독촉 대상 — 역할별로 묶는다.
      ★업체 수령확인(양쪽 확인 단계)은 **업체명별**로 묶는다 — 그래야
        왓츠앱 링크를 걸 수 있다. 역할 앞으로 보내면 보낼 곳이 없다. */
  A.flowDue = function (f, now) {
    now = now || new Date();
    var by = {};
    [['mat', S.mreq], ['surv', S.surv]].forEach(function (p) {
      (p[1] || []).forEach(function (r) {
        if (!A.locMatch(r, f)) return;
        var g = A.flowLate(p[0], r, now); if (!g) return;
        A.flowOwns(p[0], r).forEach(function (own) {
          var k = own, nm = '', tel = '', lg = 'en';
          if (own === 'vendor') {
            nm = r.by || '';
            var v = A.vendByName ? A.vendByName(nm) : null;
            /* ★담당자 번호를 먼저 쓴다 (v2.21.0). 대표번호로만 보내면
               누가 처리해야 하는지 모른 채 업체 안에서 돌기만 한다. */
            if (v) { tel = A.vendTel(v, r.grp || '', r.by || ''); lg = v.lang || 'en'; }
            k = 'vendor|' + nm;
          }
          var o = by[k] = by[k] || { own: own, name: nm, tel: tel, lang: lg,
                                     mat: 0, surv: 0, stage: 0 };
          o[p[0]]++; o.stage = Math.max(o.stage, g);
        });
      });
    });
    return Object.keys(by).map(function (k) { return by[k]; });
  };

  /** ★현황판용 — 결재가 멈춰 있는 건수 (v2.20.1 사용자 지시)
      「현황판만 봐도 승인이 안 되고 있는 것을 경고할 수 있게.」
      wait = 아직 안 눌린 것 전부 · late = 그중 60분을 넘긴 것
      ★끝난 것은 안 센다. 업체가 되올려야 하는 것(back)도 여기서 안 센다 —
        그것은 업체 화면 맨 위에 이미 떠 있다. */
  A.flowWarn = function (f, now) {
    now = now || new Date();
    var out = { wait: 0, late: 0, recv: 0, byOwn: {} };
    [['mat', S.mreq], ['surv', S.surv]].forEach(function (p) {
      (p[1] || []).forEach(function (r) {
        if (!A.locMatch(r, f)) return;
        var d = A.flowDef(p[0], r);
        if (!d || d.end) return;
        var owns = A.flowOwns(p[0], r);
        if (!owns.length) return;
        if (owns.length === 1 && owns[0] === 'vendor' && !d.dual) return;
        var g = A.flowLate(p[0], r, now);
        out.wait++; if (g) out.late++;
        /* ★지급받고도 수령확인을 안 한 것은 따로 센다 — 지급은 끝났는데
           서로 확인이 안 된 상태라, 나중에 「받은 적 없다」가 된다. */
        if (d.dual) out.recv++;
        owns.forEach(function (o2) { out.byOwn[o2] = (out.byOwn[o2] || 0) + 1; });
      });
    });
    return out;
  };

  /* ══ 독촉 대상 (v2.17.0) ══════════════════════════════
     ★규칙 (사용자 확정)
       · 협력업체 입력 마감 오전 8시. 안 넣었으면 8:30 · 9:00 두 번.
       · 스탭이 검측·측량 요청을 확인 안 하면 요청 30분 · 60분 뒤 두 번.
     ★요청 기록에 시각이 없었다 — 날짜만 있었다. 그래서 at(ISO 시각)을 새로
       넣는다. 옛 기록에는 없으므로, 어제 이전 것은 곧바로 2차로 본다.
       「모르니까 안 보낸다」보다 「오래된 건 확실히 늦었다」가 맞다. */
  A.DUE = { hour: 8, gap: 30 };          /* 마감 08:00 · 30분 간격 */

  function _mins(a, b) { return (b - a) / 60000; }

  /** 독촉 단계 — 0 아직 / 1 1차 / 2 2차 */
  function _stage(passed, gap) {
    if (passed >= gap * 2) return 2;
    if (passed >= gap) return 1;
    return 0;
  }

  A.dueList = function (f, now) {
    now = now || new Date();
    var today = A.today(), out = { co: [], staff: [] };

    /* ── 협력업체 : 오늘 것을 안 넣었다 ── */
    var dead = new Date(now); dead.setHours(A.DUE.hour, 0, 0, 0);
    var st = _stage(_mins(dead, now), A.DUE.gap);
    /* 반려 알림은 마감 시각과 무관하다 — 있으면 바로 알려야 한다 */
    var anyRej = S.work.some(function (w) { return w.st === 'rej' && A.locMatch(w, f); });
    if (st || anyRej) {
      var st2 = st || 1;
      S.vend.forEach(function (v) {
        var miss = [];
        /* ★반려된 것이 있으면 마감과 무관하게 독촉 대상이다 (v2.18.8 사용자 지시).
           고쳐서 다시 올려야 하는데 업체가 모르고 있을 수 있다. */
        var rej = S.work.filter(function (w) {
          return w.st === 'rej' && w.by === v.name && A.locMatch(w, f);
        }).length;
        if (rej) miss.push('rej');
        var hasW = S.work.some(function (w) { return w.by === v.name && w.date === today && A.locMatch(w, f); });
        var hasC = S.crew.some(function (c) { return c.by === v.name && c.date === today && A.locMatch(c, f); });
        var hasE = S.crew.some(function (c) {
          return c.by === v.name && c.date === today && A.locMatch(c, f) && (c.eq || []).length;
        });
        if (st) {                          /* 마감이 지났을 때만 미입력을 따진다 */
          if (!hasW) miss.push('work');
          if (!hasC) miss.push('crew');
          else if (!hasE) miss.push('eq');
        }
        if (miss.length) out.co.push({ name: v.name, tel: A.vendTel(v), lang: v.lang || 'en',
                                       miss: miss, stage: st2, rej: rej });
      });
    }

    /* ── 스탭 : 요청을 받고도 확인을 안 했다 ── */
    function _due(r) {
      if (r.at) return _stage(_mins(new Date(r.at), now), A.DUE.gap);
      return r.date === today ? 0 : 2;   /* 시각이 없는 옛 기록 — 어제 것이면 늦은 게 확실하다 */
    }
    var byS = {};
    S.insp.forEach(function (r) {
      if (r.st !== 'apply' || !A.locMatch(r, f)) return;
      var g = _due(r); if (!g) return;
      var k = r.staff || '';
      (byS[k] = byS[k] || { who: k, insp: 0, surv: 0, stage: 0 });
      byS[k].insp++; byS[k].stage = Math.max(byS[k].stage, g);
    });
    S.surv.forEach(function (r) {
      if (r.done || !A.locMatch(r, f)) return;
      var g = _due(r); if (!g) return;
      var k = r.staff || '';
      (byS[k] = byS[k] || { who: k, insp: 0, surv: 0, stage: 0 });
      byS[k].surv++; byS[k].stage = Math.max(byS[k].stage, g);
    });
    Object.keys(byS).forEach(function (k) { out.staff.push(byS[k]); });
    return out;
  };

  /* ══ 측량 ═════════════════════════════════════════════ */
  A.survList = function (f) {
    return S.surv.filter(function (r) {
      if (!A.locMatch(r, f)) return false;
      return todayOrOpen(r, !!r.done);
    });
  };
  A.survAll = function (f) { return S.surv.filter(function (r) { return A.locMatch(r, f); }); };

  /* ══ 자재 ═════════════════════════════════════════════ */
  A.MAT_SHEETS = (function () {
    var o = {}, l = [];
    MAT.rows.forEach(function (r) {
      if (!o[r.sh]) { o[r.sh] = { sh: r.sh, per: r.per, rows: [] }; l.push(o[r.sh]); }
      o[r.sh].rows.push(r);
    });
    return l;
  })();
  A.MAT_REF = MAT.tables || [];
  A.matSheet = function (sh) {
    return A.MAT_SHEETS.filter(function (x) { return x.sh === sh; })[0] || null;
  };
  A.matAxis = function (sh) {
    var s = typeof sh === 'string' ? A.matSheet(sh) : sh; if (!s) return null;
    var cand = ['k', 'item'];
    for (var i = 0; i < cand.length; i++) {
      var fl = cand[i], seen = {}, list = [];
      s.rows.forEach(function (r) { if (!seen[r[fl]]) { seen[r[fl]] = 1; list.push(r[fl]); } });
      if (list.length > 1 && list.length < s.rows.length) return { field: fl, values: list };
    }
    return null;
  };
  A.matLink = function (key) {
    var m = S.matmap[key]; if (!m) return null;
    return typeof m === 'string' ? { sh: m, v: '' } : m;
  };
  A.matPick = function (key) {
    var lk = A.matLink(key); if (!lk) return null;
    var s = A.matSheet(lk.sh); if (!s) return null;
    var ax = A.matAxis(s);
    var rows = (ax && lk.v) ? s.rows.filter(function (r) { return r[ax.field] === lk.v; }) : s.rows;
    return { sheet: s, axis: ax, rows: rows, per: s.per };
  };
  A.matNeed = function (f) {
    var need = {};
    Object.keys(S.matmap).forEach(function (key) {
      var pk = A.matPick(key); if (!pk) return;
      var act = A.actQty(key, f); if (!act) return;
      var div = /100/.test(pk.per) ? 100 : 1;
      pk.rows.forEach(function (r) {
        var id = r.mat + '|' + (r.u || '');
        need[id] = need[id] || { mat: r.mat, unit: r.u, qty: 0, from: [] };
        need[id].qty += r.v * act / div;
        if (need[id].from.indexOf(key) < 0) need[id].from.push(key);
      });
    });
    return need;
  };
  A.matIssued = function (f) {
    var o = {};
    S.mat.forEach(function (m) {
      if (!A.locMatch(m, f)) return;
      var id = m.mat + '|' + (m.unit || '');
      o[id] = o[id] || { mat: m.mat, unit: m.unit, req: 0, iss: 0, why: [] };
      o[id].req += Number(m.req) || 0;
      o[id].iss += Number(m.iss) || 0;
      if (m.why) o[id].why.push(m.why);
    });
    return o;
  };
  /* ★이름 주의 — 아래쪽에 같은 이름의 새 정의가 있어 이 함수가 덮어써지고
     있었다(v2.18.8에서 발견). 옛 화면용이므로 이름을 갈라 둔다. */
  A.matRowsLegacy = function (f) {
    var need = A.matNeed(f), iss = A.matIssued(f), keys = {};
    Object.keys(need).forEach(function (k) { keys[k] = 1; });
    Object.keys(iss).forEach(function (k) { keys[k] = 1; });
    return Object.keys(keys).map(function (k) {
      var n = need[k], i = iss[k];
      var nq = n ? n.qty : null, iq = i ? i.iss : 0;
      return {
        id: k, mat: (n || i).mat, unit: (n || i).unit, need: nq,
        req: i ? i.req : 0, iss: iq, gap: nq == null ? null : iq - nq,
        why: i ? i.why.filter(Boolean).join(' / ') : '', from: n ? n.from : []
      };
    }).sort(function (a, b) {
      var av = a.gap == null ? 1e9 : a.gap, bv = b.gap == null ? 1e9 : b.gap; return av - bv;
    });
  };
  A.matShort = function (f) {
    return A.matRowsLegacy(f).filter(function (r) { return r.gap != null && r.gap < -0.0001; });
  };
  /* ══ 자재 워크플로 v2 (설계 업로드 → 신청 → 승인 → 지급/플랜트 → 실사용 → 증감) ══
     S.mdesign[locKey][matId] = 설계수량
     S.mreq = [{id,date,loc,grp,sub,mat,spec,unit,plant,qty(신청),
                st, apvBy, denyWhy, iss, noissWhy, use, ...시각들}]
       st: req → apv/deny → (창고)iss/noiss  또는 (플랜트)plantReq→iss  → use입력
     matId = grp|sub|mat|spec|unit  */
  function matId(o) {
    return [o.grp, o.sub, o.mat, o.spec || '', o.unit || ''].join('|');
  }
  A.matId = matId;

  A.setDesign = function (loc, id, qty) {
    var lk = A.locKey(loc);
    S.mdesign[lk] = S.mdesign[lk] || {};
    S.mdesign[lk][id] = qty;
  };
  A.designQty = function (id, f) {
    var t = 0;
    A.allLocs().forEach(function (l) {
      if (!A.locMatch({ loc: l }, f)) return;
      var d = S.mdesign[A.locKey(l)];
      if (d && d[id] != null) t += d[id];
    });
    return Math.round(t * 1000) / 1000;
  };

  /** 설계수량 시트 읽기 — 위치열 + 자재열 + 수량열 */
  A.readDesignRows = function (rows, site) {
    if (!rows.length) return { ok: 0, miss: [], skip: 0 };
    var head = rows[0].map(function (h) { return String(h || '').trim(); });
    function col(re) { for (var i = 0; i < head.length; i++) if (re.test(head[i])) return i; return -1; }
    var iP = col(/phase|페이즈/i), iC = col(/section|공구/i),
        iT = col(/town|타운/i), iB = col(/block|블럭|블록/i),
        iG = col(/대분류|group|공종그룹/i), iS = col(/세부|sub/i),
        iM = col(/자재|material|mat/i), iSp = col(/규격|spec/i),
        iU = col(/단위|unit/i), iQ = col(/설계|수량|qty|design/i);
    if (iM < 0 || iQ < 0) return { ok: 0, miss: [], skip: rows.length - 1, err: A.T('e_matcol') };
    var ok = 0, skip = 0, miss = [];
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      var mat = String(row[iM] == null ? '' : row[iM]).trim();
      var qty = parseFloat(String(row[iQ]).replace(/,/g, ''));
      if (!mat || isNaN(qty)) { skip++; continue; }
      var loc;
      if (site === 'civil') {
        var p = parseInt(row[iP], 10), c = parseInt(row[iC], 10) || 1;
        if (!p) { skip++; continue; }
        loc = { s: 'civil', p: p, c: c };
      } else {
        var t = String(row[iT] == null ? '' : row[iT]).trim().toUpperCase().replace(/TOWN\s*/i, '');
        var b = parseInt(row[iB], 10);
        if (!t || !b) { skip++; continue; }
        loc = { s: 'anc', t: t, b: b };
      }
      var id = [String(row[iG] || '').trim(), String(row[iS] || '').trim(), mat,
                String(row[iSp] || '').trim(), String(row[iU] || '').trim()].join('|');
      A.setDesign(loc, id, (A.designQty(id, loc) || 0) * 0 + qty);
      S.mdesign[A.locKey(loc)][id] = (S.mdesign[A.locKey(loc)][id] || 0) + qty;
      ok++;
    }
    A.save();
    return { ok: ok, miss: miss, skip: skip };
  };

  /* 신청 생성 */
  A.addMreq = function (o) {
    var m = {
      id: A.uid(), date: o.date || A.today(), loc: o.loc,
      grp: o.grp, sub: o.sub, mat: o.mat, spec: o.spec || '', unit: o.unit || '',
      plant: !!o.plant, qty: Number(o.qty) || 0, by: o.by || '',
      st: 'req', reqAt: A.nowISO(),
      apvBy: '', apvAt: '', denyWhy: '',
      plantReqAt: '', iss: null, issAt: '', noissWhy: '',
      use: null, useAt: ''
    };
    S.mreq.push(m);
    A.save();
    return m;
  };
  A.nowISO = function () { return new Date().toISOString(); };

  /* 승인/미승인 */
  A.mApprove = function (id, by) {
    var r = A.mreqById(id); if (!r) return;
    r.st = 'apv'; r.apvBy = by || ''; r.apvAt = A.nowISO();
    A.msgAuto('apv', r);
    A.save();
  };
  A.mDeny = function (id, why) {
    var r = A.mreqById(id); if (!r) return;
    r.st = 'deny'; r.denyWhy = why || ''; r.apvAt = A.nowISO();
    A.msgAuto('deny', r);
    A.save();
  };
  /* 플랜트 신청(스탭 수동) */
  A.mPlantReq = function (id) {
    var r = A.mreqById(id); if (!r) return;
    r.st = 'plantReq'; r.plantReqAt = A.nowISO();
    A.save();
  };
  /* 지급/미지급 */
  A.mIssue = function (id, qty) {
    var r = A.mreqById(id); if (!r) return;
    r.st = 'iss'; r.iss = Number(qty); r.issAt = A.nowISO();
    A.msgAuto('iss', r);
    A.save();
  };
  A.mNoIssue = function (id, why) {
    var r = A.mreqById(id); if (!r) return;
    r.st = 'noiss'; r.noissWhy = why || ''; r.issAt = A.nowISO();
    A.msgAuto('noiss', r);
    A.save();
  };
  /* 실사용 입력(협력업체, 시공완료 후) */
  A.mUse = function (id, qty) {
    var r = A.mreqById(id); if (!r) return;
    r.use = Number(qty); r.useAt = A.nowISO();
    A.save();
  };
  A.mreqById = function (id) { return S.mreq.filter(function (x) { return x.id === id; })[0]; };
  A.mreqList = function (f, plant) {
    return S.mreq.filter(function (r) {
      if (plant != null && !!r.plant !== !!plant) return false;
      return A.locMatch(r, f);
    });
  };
  /** 화면용 — 오늘 것이거나 아직 지급 안 된 것 */
  A.mreqOpen = function (f, plant) {
    return A.mreqList(f, plant).filter(function (r) {
      return todayOrOpen(r, r.st === 'iss' || r.st === 'deny');
    });
  };
  /* 실사용 미입력(지급됐는데 use 없음) */
  A.mUseMissing = function (f) {
    return A.mreqList(f).filter(function (r) {
      return r.st === 'iss' && r.iss > 0 && r.use == null;
    });
  };

  /* 자재별 증감표 : 설계 vs 신청 vs 지급 vs 실사용 */
  A.mVariance = function (f, plant) {
    var agg = {};
    // 설계
    A.allLocs().forEach(function (l) {
      if (!A.locMatch({ loc: l }, f)) return;
      var d = S.mdesign[A.locKey(l)]; if (!d) return;
      Object.keys(d).forEach(function (id) {
        var isPlant = A.matById(id) ? A.matById(id).plant : false;
        if (plant != null && isPlant !== !!plant) return;
        agg[id] = agg[id] || blankAgg(id);
        agg[id].design += d[id];
      });
    });
    // 신청/지급/실사용
    A.mreqList(f, plant).forEach(function (r) {
      var id = matId(r);
      agg[id] = agg[id] || blankAgg(id);
      agg[id].req += Number(r.qty) || 0;
      if (r.st === 'iss') agg[id].iss += Number(r.iss) || 0;
      if (r.use != null) agg[id].use += Number(r.use) || 0;
    });
    return Object.keys(agg).map(function (id) {
      var a = agg[id];
      a.gapIss = a.design ? a.iss - a.design : null;   // 지급 − 설계
      a.gapUse = a.design ? a.use - a.design : null;   // 실사용 − 설계
      return a;
    }).sort(function (a, b) {
      var av = a.gapIss == null ? 1e9 : a.gapIss, bv = b.gapIss == null ? 1e9 : b.gapIss;
      return av - bv;
    });
  };
  function blankAgg(id) {
    var p = id.split('|');
    return { id: id, grp: p[0], sub: p[1], mat: p[2], spec: p[3], unit: p[4],
             plant: A.matById(id) ? A.matById(id).plant : false,
             design: 0, req: 0, iss: 0, use: 0 };
  }
  /* ══ 재고 — 직접 입력 (v2.17.1 사용자 지시) ═══════════
     ★자재는 설계수량 · 재고수량 · 지급수량 셋으로 통일한다.
       신청→승인→플랜트신청→지급→실사용 5단계는 화면에서 뺐다.
     ★재고는 어디서도 계산할 수 없다 — 창고를 세어 넣는 수밖에 없다.
       설계−지급으로 갈음하면 반입분과 잔재가 빠져 실제와 안 맞는다.
     ★플랜트 자재는 목록에서 뺀다(사용자 지시). 플랜트 신청은 시스템 밖 일이다. */
  A.stockOf = function (f, id) {
    var v = (S.stock[A.locKey(f)] || {})[id];
    return v == null ? null : Number(v);
  };
  A.setStock = function (f, id, qty) {
    var k = A.locKey(f);
    S.stock[k] = S.stock[k] || {};
    if (qty === '' || qty == null) delete S.stock[k][id];
    else S.stock[k][id] = Number(qty) || 0;
    A.save();
  };
  /* ★설계에 없는 자재 — 손으로 넣은 것 (v2.19.0 사용자 지시).
     S.mreq에 st:'iss'로 넣되 extra:1을 세운다. 설계 대비 차이를 낼 때
     이것을 설계 초과로 오해하면 안 되므로 표시를 갈라 둔다. */
  A.addExtraMat = function (o) {
    var m = {
      id: A.uid(), date: o.date || A.today(), loc: o.loc,
      grp: o.grp || A.T('m_extra'), sub: o.sub || '',
      mat: o.mat, spec: o.spec || '', unit: o.unit || '',
      plant: false, qty: Number(o.qty) || 0, by: o.by || '',
      st: 'iss', iss: Number(o.qty) || 0, issAt: A.nowISO(), extra: 1
    };
    S.mreq.push(m); A.save(); return m;
  };
  A.matExtraCount = function (f) {
    return S.mreq.filter(function (r) { return r.extra && A.hit(r, f); }).length;
  };

  /* ★신청 건을 줄마다 되짚는다 (v2.19.1 사용자 지적).
     종전에는 신청 수량 합계만 보이고 그 신청을 처리할 길이 없었다.
     600을 신청했는데 지급인지 미지급인지 알 수가 없었다.
     ★미지급은 사유와 함께 계속 남긴다 — 누구 잘못인지 알아야 하기 때문이다.
       업체가 보고 다시 신청한다. 지워 버리면 아무도 책임을 못 진다. */
  A.mreqOf = function (f, id) {
    return S.mreq.filter(function (r) {
      return matId(r) === id && A.hit(r, f);
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  };

  /** 설계 · 신청 · 재고 · 지급 — 창고 자재만
      ★신청(req)을 걸러내고 있었다 (v2.18.8 사용자 지적).
        협력업체가 올린 자재신청은 지급 전이라 design·iss·stock이 셋 다
        없다. 그래서 관리자 화면에 아예 안 떴다 — 신청이 온 줄도 몰랐다.
        신청이야말로 스탭이 가장 먼저 봐야 할 것이다. */
  A.matRows = function (f) {
    return A.mVariance(f, false).map(function (a) {
      a.stock = A.stockOf(f, a.id);
      return a;
    }).filter(function (a) {
      return a.design || a.iss || a.req || a.stock != null;
    });
  };

  A.matById = function (id) {
    var p = id.split('|');
    return A.MAT2 ? A.MAT2.filter(function (m) {
      return m.grp === p[0] && m.sub === p[1] && m.mat === p[2] && (m.spec || '') === (p[3] || '');
    })[0] : null;
  };

  /* ══ 메시지 자동전송 (테스트 모드 — 대기열에만. 5단계에서 확장) ══ */
  A.msgAuto = function (kind, r) {
    var body = '[BNCP] ' + A.T('m_' + kind) + ' · ' + A.locLabel(r.loc) + ' · ' + (r.mat || '') +
      (r.denyWhy ? ' — ' + r.denyWhy : '') + (r.noissWhy ? ' — ' + r.noissWhy : '');
    S.msgq.push({ id: A.uid(), at: A.nowISO(), kind: kind, to: '', body: body, test: true });
  };

  /* ══ 경고 ═════════════════════════════════════════════ */
  A.warn = function (f) {
    var ins = A.inspList(f), rec = A.eqRecon(f);
    return {
      pendWork: A.pendWork(f).length,
      pendCrew: A.pendCrew(f).length,
      inspOpen: ins.filter(A.inspOpen).length,
      inspFail: ins.filter(function (r) { return r.st === 'fail'; }).length,
      survOpen: A.survList(f).filter(function (r) { return !r.done; }).length,
      eqOver: rec.filter(function (r) { return r.flag === 'over'; }).length,
      eqNoRec: rec.filter(function (r) { return r.flag === 'norec'; }).length,
      repLong: A.longRepair(f).length,
      short: A.mVariance(f).filter(function (x) { return x.gapIss != null && x.gapIss < -0.0001; }).length,
      useMiss: A.mUseMissing(f).length,
      noPlan: A.hasPlan(f) ? 0 : 1
    };
  };

  /* ══ CSV ══════════════════════════════════════════════ */
  A.toCSV = function (head, rows) {
    var q = function (v) {
      v = v == null ? '' : String(v);
      return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    return '\ufeff' + [head].concat(rows).map(function (r) { return r.map(q).join(','); }).join('\r\n');
  };
  A.dl = function (name, text) {
    var b = new Blob([text], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  };
  A.parseCSV = function (text) {
    var rows = [], row = [], cur = '', q = false;
    text = text.replace(/^\ufeff/, '').replace(/\r\n?/g, '\n');
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim(); }); });
  };

  /* ══ 내역서 원본 파서 (v2.14.0) ═══════════════════════
     설계 내역서를 그대로 올려도 읽는다. 공종코드 열이 없고
     대·중·세 계층이 들여쓰기로만 표현된 파일이 대상이다.

       공 사 명 : 부지조성공사 3-1공구
       구분        규격      단위   수량
       1. 토공                              ← 대분류
       1. 표토제거                           ← 중분류
          1) 표토제거   T=30cm   m3   -      ← 세부(수량행)

     ★ 대분류와 중분류는 둘 다 '숫자.' 형식이라 글자만으로는 못 가른다.
       머리의 목차를 먼저 읽어 대분류 이름·번호를 확보하고,
       중분류는 1부터 다시 매겨진다는 성질로 가른다.
     ★ 목차에 있어도 본문에 없는 공종이 있다(그 공구에 없는 공종).
       번호가 건너뛰어도 따라갈 수 있어야 한다. */

  /* 비교용 정규화 — 기호·공백·대소문자를 지운다.
     Φ/φ/Ø/ø는 D로, ×/X는 x로 통일한다(같은 뜻인데 파일마다 다르게 쓴다). */
  function bqz(t) {
    t = String(t == null ? '' : t);
    t = t.replace(/[ΦφØø]/g, 'D').replace(/[×X]/g, 'x');
    t = t.replace(/[·・,.\-_/=()\[\]'"˚°]/g, '');
    return t.replace(/\s+/g, '').toLowerCase();
  }
  /* 글자 다발 — 마스터와 내역서가 같은 내용을 다르게 쪼개 놓아도
     글자 구성은 같다는 성질을 쓴다.
       내역서 '원형맨홀1호, 현장타설콘크리트' + 'D=1200mm'
       마스터 '원형맨홀' + '1호, D=1200mm, 현장타설콘크리트'  → 글자 구성 동일 */
  function bqbag(s) {
    var b = {}, t = bqz(s);
    for (var i = 0; i < t.length; i++) b[t[i]] = (b[t[i]] || 0) + 1;
    return b;
  }
  function bqSub(a, b) {   /* a ⊆ b */
    for (var k in a) if ((b[k] || 0) < a[k]) return false;
    return true;
  }
  function bqScore(a, b) {
    var k, inter = 0, uni = 0, keys = {};
    for (k in a) keys[k] = 1;
    for (k in b) keys[k] = 1;
    for (k in keys) {
      var x = a[k] || 0, y = b[k] || 0;
      inter += Math.min(x, y); uni += Math.max(x, y);
    }
    return uni ? inter / uni : 0;
  }
  function bqNum(v) {
    var t = String(v == null ? '' : v).replace(/,/g, '').trim();
    if (!t || t === '-' || t === 'ㅡ') return null;
    var n = parseFloat(t);
    return isNaN(n) ? null : n;
  }
  /* '   1) 표토제거' → { name:'표토제거', ind:3, no:1 } */
  function bqLine(v) {
    var raw = String(v == null ? '' : v).replace(/\t/g, '    ');
    var ind = raw.length - raw.replace(/^[\s\u00a0]+/, '').length;
    var s = raw.trim();
    var m = /^\(?\s*(\d+)\s*\)?\s*[.)]\s*/.exec(s);
    return { name: s.replace(/^\(?\s*\d+\s*\)?\s*[.)]?\s*/, '').trim(), ind: ind, no: m ? +m[1] : null };
  }

  /** 내역서 형식인지 판별 — 코드 열이 있으면 기존 양식이다. */
  A.isBoq = function (rows) {
    if (!rows || rows.length < 5) return false;
    for (var i = 0; i < Math.min(rows.length, 12); i++) {
      var r = rows[i] || [];
      for (var c = 0; c < r.length; c++) {
        if (/^(코드|code|공종코드)$/i.test(String(r[c] || '').trim())) return false;
      }
    }
    /* 목차처럼 '숫자. 이름'만 있고 나머지 열이 빈 행이 3개 이상이면 내역서로 본다 */
    var n = 0;
    for (i = 0; i < Math.min(rows.length, 40); i++) {
      var rr = rows[i] || [], c0 = String(rr[0] == null ? '' : rr[0]).trim();
      if (!/^\d+\.\s*\S/.test(c0)) continue;
      var rest = 0;
      for (var j = 1; j < rr.length; j++) if (String(rr[j] == null ? '' : rr[j]).trim()) rest++;
      if (!rest) n++;
    }
    return n >= 3;
  };

  /** 내역서를 {g,m,sub,n,sp,u,q} 목록으로 편다. */
  A.boqItems = function (rows) {
    var toc = [], tocN = {}, body = 0, i;
    for (i = 0; i < rows.length; i++) {
      var r = rows[i] || [], c0 = String(r[0] == null ? '' : r[0]).trim();
      if (/^\[/.test(c0)) { body = i + 1; break; }
      var mm = /^(\d+)\.\s*(.+)$/.exec(c0);
      if (!mm) continue;
      var rest = 0;
      for (var j = 1; j < r.length; j++) if (String(r[j] == null ? '' : r[j]).trim()) rest++;
      if (!rest) { toc.push([+mm[1], mm[2].trim()]); tocN[+mm[1]] = mm[2].trim(); }
    }
    var out = [], g = '', gn = 0, mn = 0, stack = [];
    for (i = body; i < rows.length; i++) {
      var row = rows[i] || [];
      if (!String(row[0] == null ? '' : row[0]).trim()) continue;
      var L = bqLine(row[0]);
      if (!L.name || /^\[/.test(L.name)) continue;
      var sp = String(row[1] == null ? '' : row[1]).trim();
      var u = String(row[2] == null ? '' : row[2]).trim();
      var q = bqNum(row[3]);

      if (L.ind === 0 && L.no != null) {
        var tn = tocN[L.no];
        /* ★대분류는 **번호와 이름이 목차와 둘 다 맞아야** 한다 (v2.19.6 — 사용자 지적).
           종전에는 이름이 달라도 `번호가 앞 중분류+1이 아니면` 대분류로 올렸다.
           번호가 튀는 것만 보고 이름을 안 본 것이다. P3-2에서 이렇게 터졌다 :
             「6. 부대공」은 토공의 부대공(작업로·규준틀)이라 토공 아래 놓인다.
             그런데 앞이 「4. 잔토처리」여서 5를 건너뛴다
             → 목차[6]은 '공동구'로 이름이 전혀 다른데도 대분류로 올라간다
             → gn=6이 되어 뒤따르는 「2. 포장공」이 2 > 6에 걸려 아래로 밀린다
             → 포장공·우수공·오수공·상수공이 통째로 사라지고 전부 g='부대공'
           ★부대공은 토공·우수공·오수공·상수공에 **각각 하나씩** 있다
             (마스터도 같다 — T-08 토공›부대공›규준틀, SS-38 오수공›부대공›수압시험).
             그래서 목차에는 없고, 번호도 대분류와 겹친다. 이름을 봐야 갈린다.
           ★번호만 맞고 이름이 다르면 대분류가 아니다. 아래 단계는 번호가 얼마든
             건너뛸 수 있다 — 수량이 없는 항목은 내역서에서 그냥 빠진다.
           ★`L.no > gn`은 남긴다. 「1. 토공」은 대분류로도 나오고
             우수공·오수공 밑 중분류로도 나온다. 번호가 되돌아가면 중분류다. */
        if (tn != null && L.no > gn && bqz(tn) === bqz(L.name)) {
          g = L.name; gn = L.no; mn = 0; stack = [];
          continue;                       /* 대분류 줄은 수량을 갖지 않는다 */
        }
        mn = L.no; stack = [[0, L.name]];
      } else {
        while (stack.length && stack[stack.length - 1][0] >= L.ind) stack.pop();
        stack.push([L.ind, L.name]);
      }
      if (u && q != null) {
        var path = stack.map(function (x) { return x[1]; });
        out.push({
          g: g, m: path[0] || L.name, sub: path.slice(1, -1),
          n: path.length ? path[path.length - 1] : L.name,
          sp: sp, u: u, q: q, row: i + 1
        });
        if (L.ind !== 0) stack.pop();     /* 수량행은 부모가 되지 않는다 */
      }
    }
    return out;
  };

  /* 대분류 이름이 마스터와 조금 다를 때 맞춰 준다
     (내역서 '전기/통신/가로등(전기공사 제외)' ↔ 마스터 '전기/통신/가로등') */
  function bqMapG(x, site) {
    var n = bqz(x), gs = [], seen = {}, i;
    LIST.forEach(function (e) {
      if (e.site !== site) return;
      if (!seen[e.grp]) { seen[e.grp] = 1; gs.push(e.grp); }
    });
    for (i = 0; i < gs.length; i++) if (bqz(gs[i]) === n) return gs[i];
    gs.sort(function (a, b) { return b.length - a.length; });
    for (i = 0; i < gs.length; i++) {
      var z = bqz(gs[i]);
      if (n.indexOf(z) === 0 || z.indexOf(n) === 0) return gs[i];
    }
    return x;
  }

  /** 별칭 — 한 번 지정하면 다음 파일부터 자동으로 붙는다.
     ★두 벌을 기억한다 (v2.19.5 — 사용자 지시).
       정확 별칭 : 대분류까지 같아야 붙는다.
       느슨한 별칭 : **대분류를 뺀** 중분류|공종명|규격|단위.
     왜 필요한가 — 같은 공종이 파일마다 다른 대분류 아래 들어온다.
       P3-1 : 포장공 › 아스콘 포장 › 표층 › #78
       P3-2 : 부대공 › 아스콘 포장 › 표층 › #78      ← 대분류만 다르다
     정확 별칭만 있으면 한쪽에서 골라도 다른 페이즈에서 또 골라야 했다.
     ★느슨한 별칭은 **서로 다른 것에 붙는 순간 쓰지 않는다**('*'로 막는다).
       예 : 「토공 › 터파기 · m3」는 우수공(WS-01)·오수공(SS-01)·상수공(WW-01)에
       똑같이 있다. 하나를 고른 것을 나머지에 밀어 넣으면 조용히 틀린다. */
  A.aliasKey = function (it) { return bqz(it.g) + '|' + bqz(it.m) + '|' + bqz(it.n) + '|' + bqz(it.sp) + '|' + bqz(it.u); };
  A.aliasKey2 = function (it) { return bqz(it.m) + '|' + bqz(it.n) + '|' + bqz(it.sp) + '|' + bqz(it.u); };
  A.setAlias = function (it, code) {
    S.alias = S.alias || {}; S.alias2 = S.alias2 || {};
    var k = A.aliasKey(it), k2 = A.aliasKey2(it);
    if (code) {
      S.alias[k] = code;
      var prev = S.alias2[k2];
      if (prev === undefined) S.alias2[k2] = code;
      else if (prev !== code) S.alias2[k2] = '*';   /* 갈렸다 — 자동으로 안 쓴다 */
    } else {
      delete S.alias[k];
    }
    A.save();
  };

  /** 내역서 한 줄 → 공종코드. {code, how, cands} */
  /* ★부대토목에 없는 것은 부지토목에서 갖다 쓴다 — **한 방향만** (v2.19.8 — 사용자 지시).
       부대토목 마스터는 92개뿐이고, 거기 없는 공종은 부지토목 883개에서 같은
       것을 쓴다. 종전에는 후보 풀이 site로 양쪽 다 잠겨 있어, 부대토목
       내역서의 그런 줄은 후보조차 없이 확인필요로 떨어졌다.
     ★반대는 절대 열지 않는다. 부지토목 내역서가 부대토목(A-*) 코드에 붙으면
       블럭공사 수량과 뒤섞인다 — 검사 [62]가 그것을 막고 있다.
     ★부대토목 안에서 먼저 다 찾아보고, 아무것도 못 붙였을 때만 부지토목을 본다.
       순서가 바뀌면 부대토목에 제 짝이 있는 줄까지 부지토목이 가로챈다. */
  A.boqMatch = function (it, site) {
    S.alias = S.alias || {};
    var al = S.alias[A.aliasKey(it)];
    if (al && REG[al]) return { code: al, how: 'alias', cands: [] };

    var r = bqTry(it, site);
    if (r.code || site !== 'anc') return r;
    var r2 = bqTry(it, 'civil');
    if (r2.code) return { code: r2.code, how: r2.how + '@civil', cands: r2.cands };
    /* 못 붙였어도 부지토목 후보를 뒤에 붙여 준다 — 고를 거리가 있어야 한다 */
    return { code: '', how: '', cands: r.cands.concat(r2.cands).slice(0, 8) };
  };

  function bqTry(it, site) {
    var g = bqMapG(it.g, site);
    var pool = [], i;
    LIST.forEach(function (e) { if (e.site === site) pool.push(e); });

    function pick(fn) {
      var hit = [];
      for (i = 0; i < pool.length; i++) if (fn(pool[i])) hit.push(pool[i]);
      return hit;
    }
    var kg = bqz(g), km = bqz(it.m), kn = bqz(it.n), ksp = bqz(it.sp), ku = bqz(it.u);

    /* ★대분류 이름이 마스터에 없으면 대분류로 거르지 않는다 (v2.19.5 — 사용자 지적).
       P3-2(3-2공구 잔여·정산)는 아스콘포장·관로공·우수맨홀·상수관로를 전부
       「부대공」이라는 한 대분류 아래 묶어 놓았다. 마스터에 그런 대분류가 없어
       모든 단계가 0건이 됐고, 후보(cands)까지 비어 67줄을 261개 전체에서
       손으로 골라야 했다.
       ★부대토목이 아니다 — 같은 부지토목이다. 후보 풀은 site로 이미 잠겨 있어
         대분류를 풀어도 부대토목 마스터로는 넘어가지 않는다.
       ★마스터에서 「부대공」은 중분류다(토공›부대공›규준틀). 같은 이름이
         층만 다르게 쓰인 것이라 대분류 대조로는 영영 안 맞는다. */
    var gKnown = false;
    for (i = 0; i < pool.length; i++) if (bqz(pool[i].grp) === kg) { gKnown = true; break; }
    function gOK(e) { return !gKnown || bqz(e.grp) === kg; }

    /* 1) 대·중·공종명·규격·단위가 그대로 맞는다 */
    var h = pick(function (e) {
      return gOK(e) && bqz(e.mid) === km && bqz(e.name) === kn && bqz(e.spec) === ksp && bqz(e.unit) === ku;
    });
    if (h.length === 1) return { code: h[0].code, how: 'exact', cands: [] };

    /* 2) 규격+단위로 좁힌다 — 공종명 표기가 갈릴 때 */
    if (ksp) {
      h = pick(function (e) { return gOK(e) && bqz(e.mid) === km && bqz(e.spec) === ksp && bqz(e.unit) === ku; });
      if (h.length === 1) return { code: h[0].code, how: 'spec', cands: [] };
    }
    /* 3) 규격을 빼고 공종명+단위로 */
    h = pick(function (e) { return gOK(e) && bqz(e.mid) === km && bqz(e.name) === kn && bqz(e.unit) === ku; });
    if (h.length === 1) return { code: h[0].code, how: 'name', cands: [] };

    /* 4) 글자 다발 대조 — 마스터와 내역서가 다르게 쪼개 놓은 경우 */
    var narrow = pick(function (e) { return gOK(e) && bqz(e.mid) === km && bqz(e.unit) === ku; });
    if (!narrow.length) narrow = pick(function (e) { return gOK(e) && bqz(e.unit) === ku; });
    var fb = bqbag([it.m].concat(it.sub, [it.n, it.sp]).join(' '));
    function mbag(e) { return bqbag([e.mid, e.name, e.spec].join(' ')); }

    var eq = [], sub1 = [], sub2 = [];
    for (i = 0; i < narrow.length; i++) {
      var b = mbag(narrow[i]);
      if (bqScore(b, fb) === 1) eq.push(narrow[i]);
      if (bqSub(b, fb)) sub1.push(narrow[i]);
      if (bqSub(fb, b)) sub2.push(narrow[i]);
    }
    if (eq.length === 1) return { code: eq[0].code, how: 'bag', cands: [] };
    if (sub1.length === 1) return { code: sub1[0].code, how: 'bag+', cands: [] };
    if (sub2.length === 1) return { code: sub2[0].code, how: 'bag-', cands: [] };

    /* ★느슨한 별칭 — 구조적 일치가 전부 실패한 뒤에만 본다 (v2.19.5).
       순서가 핵심이다. 별칭을 맨 앞에서 보면
         「오수공 › 토공 › 터파기」가 구조적으로 SS-01에 정확히 붙는데도
         전에 골라 둔 WS-01(우수공)이 덮어써 버린다.
       구조로 붙는 것은 구조가 이기고, 아무것도 못 붙였을 때만 사람이
       골라 둔 것을 끌어온다. */
    var al2 = (S.alias2 || {})[A.aliasKey2(it)];
    if (al2 && al2 !== '*' && REG[al2]) return { code: al2, how: 'alias~', cands: [] };

    /* 5) 마지막 — 가장 가까운 것. 2등과 벌어져 있을 때만 쓴다 */
    var pl = sub1.length ? sub1 : (sub2.length ? sub2 : narrow), sc = [];
    for (i = 0; i < pl.length; i++) sc.push({ v: bqScore(mbag(pl[i]), fb), e: pl[i] });
    sc.sort(function (a, b) { return b.v - a.v; });
    /* ★대분류를 못 찾았으면 near를 쓰지 않는다 (v2.19.5).
       대분류를 풀면 후보 범위가 마스터 전체로 넓어져, 「가장 가까운 것」이
       엉뚱한 것을 집는다. 실제로 이렇게 틀렸다 :
         표지판설치 107·140·22 ea → 삼각/원형/방향 표지판 **기초설치**
       기초설치 수량이 두 배가 된다. 조용히 틀리는 것이라 확인필요로 남는
       것보다 훨씬 나쁘다. 구조로 못 붙이면 사람이 고르게 한다. */
    var cands = sc.slice(0, 6).map(function (x) { return x.e.code; });
    if (gKnown && sc.length && sc[0].v >= 0.6 && (sc.length === 1 || sc[0].v - sc[1].v >= 0.05)) {
      /* ★후보를 같이 실어 보낸다 (v2.19.6). readBoqRows가 겹침을 보고 near를
         물릴 수 있는데, 그때 후보가 비어 있으면 261개 전체에서 골라야 한다. */
      return { code: sc[0].e.code, how: 'near', cands: cands };
    }
    return { code: '', how: '', cands: cands };
  }

  /** 내역서를 설계수량으로 담는다. ★덮어쓰기 — 두 번 올려도 두 배가 되지 않는다. */
  A.readBoqRows = function (rows, loc) {
    var items = A.boqItems(rows), lk = A.locKey(loc);
    var put = {}, ok = 0, need = [], i, res = [];
    for (i = 0; i < items.length; i++) res.push(A.boqMatch(items[i], loc.s));

    /* ★한 코드를 두 줄이 차지하면 near 쪽을 물린다 (v2.19.6 — 사용자 지적).
       내역서가 마스터보다 잘게 쪼개져 있을 때 near가 남의 자리를 뺏는다 :
         내역서 : 삼각표지판 › 터파기 · 되메우기 · 기초설치 · **표지판설치**
         마스터 : 삼각표지판 — 터파기 · 되메우기 · 기초설치 (표지판설치는 없다)
       「표지판설치」에 맞는 코드가 없으니 near가 가장 가까운 P-13(기초설치)을
       집는다. 그런데 P-13은 바로 위 「기초설치」 줄이 이미 정확히 차지했다.
       → P-13에 107 + 107 = 214가 들어간다. 수량이 두 배가 된다.
       ★near는 짐작이고 나머지(exact·spec·name·bag)는 구조다. 겹치면 짐작이
         물러난다. 물린 줄은 후보를 달고 확인필요로 남는다 — 4-D와 같다. */
    var strong = {}, nearSeen = {};
    for (i = 0; i < res.length; i++) if (res[i].code && res[i].how !== 'near') strong[res[i].code] = 1;
    for (i = 0; i < res.length; i++) {
      if (res[i].code && res[i].how === 'near') {
        if (strong[res[i].code] || nearSeen[res[i].code]) res[i] = { code: '', how: '', cands: res[i].cands || [] };
        else nearSeen[res[i].code] = 1;
      }
    }

    for (i = 0; i < items.length; i++) {
      var it = items[i], m = res[i];
      if (m.code) { put[m.code] = (put[m.code] || 0) + it.q; ok++; it.code = m.code; it.how = m.how; }
      else { it.cands = m.cands; need.push(it); }
    }
    S.plan[lk] = put;              /* 누적이 아니라 교체 */
    A.save();
    return { ok: ok, total: items.length, need: need, codes: Object.keys(put).length };
  };

  /** 확인 필요분을 나중에 채워 넣는다(별칭도 같이 기억). */
  A.applyBoqPick = function (it, code, loc) {
    if (!code || !REG[code]) return false;
    var lk = A.locKey(loc);
    S.plan[lk] = S.plan[lk] || {};
    S.plan[lk][code] = (S.plan[lk][code] || 0) + it.q;
    A.setAlias(it, code);
    A.save();
    return true;
  };

  /* ══ 계획수량 파일 ════════════════════════════════════ */
  A.readPlanRows = function (rows, loc) {
    if (!rows.length) return { ok: 0, miss: [], skip: 0, wrongSite: [] };
    var head = rows[0].map(function (h) { return String(h || '').trim(); });
    var ci = -1, qi = -1;
    head.forEach(function (h, i) {
      if (ci < 0 && /^(코드|code|공종코드)$/i.test(h)) ci = i;
      if (qi < 0 && /(수량|물량|qty|quantity)/i.test(h)) qi = i;
    });
    if (ci < 0) ci = 0;
    if (qi < 0) {
      var best = -1, bn = 0;
      for (var c = 1; c < head.length; c++) {
        var n = 0;
        for (var r = 1; r < rows.length; r++) if (!isNaN(parseFloat(rows[r][c]))) n++;
        if (n > bn) { bn = n; best = c; }
      }
      qi = best;
    }
    if (qi < 0) return { ok: 0, miss: [], skip: rows.length - 1, wrongSite: [], err: A.T('e_qtycol') };
    var lk = A.locKey(loc);
    S.plan[lk] = S.plan[lk] || {};
    var ok = 0, miss = [], skip = 0, wrongSite = [];
    for (var i = 1; i < rows.length; i++) {
      var code = String(rows[i][ci] == null ? '' : rows[i][ci]).trim();
      var qty = parseFloat(String(rows[i][qi]).replace(/,/g, ''));
      if (!code || isNaN(qty)) { skip++; continue; }
      var e = REG[code];
      if (!e) { if (miss.indexOf(code) < 0) miss.push(code); continue; }
      if (e.site !== loc.s) { if (wrongSite.indexOf(code) < 0) wrongSite.push(code); continue; }
      S.plan[lk][code] = (S.plan[lk][code] || 0) + qty;
      ok++;
    }
    A.save();
    return { ok: ok, miss: miss, skip: skip, wrongSite: wrongSite };
  };

  /* ══ 장비 지급대장 파일 ═══════════════════════════════ */
  /** 열: 날짜 · 장비 · 규격 · 대수  (장비명은 오타 원문도 인식) */
  A.readIssueRows = function (rows, loc, co) {
    if (!rows.length) return { ok: 0, miss: [] };
    var head = rows[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
    function col(re, dflt) {
      for (var i = 0; i < head.length; i++) if (re.test(head[i])) return i;
      return dflt;
    }
    var di = col(/날짜|date/, 0), ci = col(/장비|equip|cat/, 1),
        si = col(/규격|사이즈|size/, 2), ni = col(/대수|수량|count|qty/, 3);
    var alias = {};
    A.EQ_TREE.forEach(function (t) { alias[t.cat.toLowerCase()] = t.cat; });
    Object.keys(A.EQ_TYPO).forEach(function (fix) { alias[A.EQ_TYPO[fix].toLowerCase()] = fix; });
    var ok = 0, miss = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      var cat = String(r[ci] == null ? '' : r[ci]).trim();
      var size = String(r[si] == null ? '' : r[si]).trim();
      var cnt = parseFloat(String(r[ni]).replace(/,/g, ''));
      if (!cat || isNaN(cnt)) continue;
      var fix = alias[cat.toLowerCase()];
      if (!fix) { if (miss.indexOf(cat) < 0) miss.push(cat); continue; }
      /* ★쌓지 않고 덮어쓴다 (v2.19.14) — 지급 대수는 그때그때의 상태값이다.
         같은 파일을 두 번 올려도 두 배가 되지 않는다. */
      eqPut(loc, fix, size, 'give', cnt, co, String(r[di] || A.today()).slice(0, 10));
      ok++;
    }
    A.save();
    return { ok: ok, miss: miss };
  };

  /* ══ 장비 이름 맞추기 — 파일 글자를 마스터 코드로 (v2.19.12) ══════
     ★현장 파일의 장비 이름은 마스터와 글자가 안 맞는다.
         파일  : Excavator2.9㎥(Crawler)   Dozer26 Ton      Fork Lift (16 Ton )
         마스터: Excavator(crawler) 2.9m3  Dozer(D7RⅡ) 27ton  Fork Lift 15ton
       글자 대조로는 하나도 안 붙는다. **낱말과 숫자를 따로 본다.**
       - 낱말이 겹치는 만큼 점수. 마스터에만 있는 낱말(d3k 같은 것)은 감점만 한다.
       - 숫자가 같으면 크게, 가까우면 조금.
     ★붙인 방법을 how로 돌려준다 — exact(정확) / near(근사).
       near는 짐작이므로 화면에 그대로 알린다(내역서 확인필요와 같은 태도). */
  /* ★글자와 숫자를 떼어 놓는다 — 「Dozer18 Ton」은 한 낱말로 붙어 있어
     그냥 자르면 dozer18이 되고 마스터의 dozer와 안 겹친다. */
  function eqTok(s) {
    return String(s || '').toLowerCase()
      .replace(/㎥|m³|m3/g, ' ')
      .replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2')
      .replace(/[^a-z0-9.]+/g, ' ').trim().split(/\s+/)
      .filter(function (w) { return w && !/^(ton|t|kg|ea|nr)$/.test(w); });
  }
  /* ★단위 m3는 먼저 지운다 — 안 지우면 3이 숫자로 잡혀
     「Excavator1.2㎥」가 1.2가 아니라 3으로 읽힌다(실제로 겪었다). */
  function eqNums(s) {
    var m = String(s || '').replace(/㎥|m³|m3/g, ' ').replace(/,/g, '')
      .match(/\d+(?:\.\d+)?/g);
    return (m || []).map(function (x) { return parseFloat(x); });
  }
  A.eqFindName = function (text) {
    var ht = eqTok(text), hn = eqNums(text);
    if (!ht.length) return { how: '' };
    var best = null;
    A.EQ_TREE.forEach(function (t) {
      var ct = eqTok(t.cat), hit = 0;
      ht.forEach(function (w) { if (ct.indexOf(w) >= 0) hit++; });
      if (!hit) return;
      var extra = ct.filter(function (w) { return ht.indexOf(w) < 0 && !/^\d/.test(w); }).length;
      (t.sizes.length ? t.sizes : ['']).forEach(function (sz) {
        var sn = eqNums(sz), sc = hit * 10 - extra, how = 'exact';
        if (hn.length && sn.length) {
          /* 숫자가 하나라도 정확히 겹치면 정확이다 — 「3.5~4.0m」처럼
             둘씩 든 규격도 있어 마지막 숫자끼리만 대면 근사로 밀린다 */
          var same = false;
          hn.forEach(function (a) {
            sn.forEach(function (b) { if (Math.abs(a - b) < 1e-9) same = true; });
          });
          if (same) sc += 20;
          else {
            var a2 = hn[hn.length - 1], b2 = sn[0];
            sc += Math.max(0, 8 - (Math.abs(a2 - b2) / Math.max(a2, b2)) * 20); how = 'near';
          }
        } else if (hn.length !== sn.length) { sc -= 1; how = 'near'; }
        if (!best || sc > best.sc) best = { sc: sc, cat: t.cat, size: sz, how: how };
      });
    });
    if (!best || best.sc <= 0) return { how: '' };
    return { cat: best.cat, size: best.size, how: best.how };
  };

  /* ══ 장비 파일 — 가로로 펼쳐진 일일 투입표 (v2.19.12 사용자 지시) ══
     ★현장에서 쓰는 표는 4열이 아니라 **장비 종류가 열 머리로 가로로 펼쳐진**
       팀별 일일 투입표다. 날짜 칸도 없다.
         (빈 줄) → 「사용 장비 현황」 → 열 머리 34종 → 팀별 줄, 값은 대수
       종전에는 이 파일을 올리면 한 줄도 안 읽혔다(사용자 지적).
     ★열 머리를 마스터에 맞추고 팀별 줄의 대수를 **종류별로 합친다.**
     ★파일 안 구역(부대토목현장·부지조성현장…)은 나누지 않는다 —
       구역을 위치(Phase/Town)로 옮길 근거가 파일에 없다. 화면에서 고른
       위치로 들어간다. 나누려면 사용자에게 규칙을 받아야 한다.
     ★날짜 칸도 없다 — 넘겨받은 날짜(없으면 오늘)로 넣는다. */
  A.eqWideHead = function (rows) {
    var bi = -1, bn = 0;
    for (var i = 0; i < Math.min(rows.length, 30); i++) {
      var n = 0;
      (rows[i] || []).forEach(function (c) {
        if (String(c || '').trim() && A.eqFindName(c).how) n++;
      });
      if (n > bn) { bn = n; bi = i; }
    }
    return bn >= 3 ? bi : -1;      /* 세 칸 넘게 장비로 읽히면 가로 표다 */
  };
  A.readEquipWide = function (rows, loc, date, co) {
    var hi = A.eqWideHead(rows);
    if (hi < 0) return { ok: 0, miss: [], near: [], wide: false };
    var head = rows[hi] || [], map = {}, miss = [], near = [];
    for (var c = 0; c < head.length; c++) {
      var raw = String(head[c] || '').trim();
      if (!raw) continue;
      var m = A.eqFindName(raw);
      if (!m.how) { if (miss.indexOf(raw) < 0) miss.push(raw); continue; }
      map[c] = m;
      if (m.how === 'near') near.push(raw + ' → ' + A.eqLabel(m.cat, m.size));
    }
    var sum = {};
    for (var r = hi + 1; r < rows.length; r++) {
      var row = rows[r] || [];
      for (var k in map) {
        var v = parseFloat(String(row[k] == null ? '' : row[k]).replace(/,/g, ''));
        if (isNaN(v) || v <= 0) continue;
        var id = map[k].cat + '|' + map[k].size;
        sum[id] = (sum[id] || 0) + v;
      }
    }
    var ids = Object.keys(sum);
    ids.forEach(function (id) {
      var p = id.split('|');
      /* ★쌓지 않고 덮어쓴다 (v2.19.14) — 종전에는 push라 같은 파일을 두 번
         올리면 보유가 두 배가 됐다. 업체 축이므로 자리는 업체+종류+규격이다. */
      eqPut(loc, p[0], p[1], 'give', sum[id], co, date || A.today());
    });
    if (ids.length) A.save();
    return { ok: ids.length, miss: miss, near: near, wide: true };
  };

  /* ★형식을 가리지 않는 입구 (사용자 지시 — 「좌던 우던간에 읽어야지」).
     4열 양식이면 4열로, 가로 표면 가로로 읽는다. 화면은 이것만 부른다. */
  A.readEquipFile = function (rows, loc, date, co) {
    var r = A.readIssueRows(rows, loc, co);
    if (r.ok) { r.wide = false; r.near = []; return r; }
    var w = A.readEquipWide(rows, loc, date, co);
    if (w.ok) return w;
    r.wide = false; r.near = [];
    return r.miss.length ? r : w;
  };
})();
