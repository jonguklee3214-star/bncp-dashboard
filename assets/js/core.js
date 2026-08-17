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
    alias: {}                     /* 내역서 항목 → 공종코드. 한 번 지정하면 계속 쓴다(v2.14.0) */
  };
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.v === 2) { for (var k in BLANK) if (!(k in s)) s[k] = BLANK[k]; return s; }
    } catch (e) { }
    return JSON.parse(JSON.stringify(BLANK));
  }
  var S = A.S = load();
  A.save = function () {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { alert(A.T('e_full')); }
  };
  A.wipe = function () { localStorage.removeItem(KEY); location.reload(); };

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

  /* 관리자에게만 보이는 것 */
  A.can = function (what) {
    if (A.isAdmin()) return true;
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
  A.vendAdd = function (code, name, staff) {
    code = String(code || '').trim();
    name = String(name || '').trim();
    staff = String(staff || '').trim();
    if (!code || !name) return { ok: false, why: 'need' };
    var hit = null;
    S.vend.forEach(function (v) { if (v.code === code) hit = v; });
    if (hit) {
      hit.name = name;
      if (staff && hit.staff.indexOf(staff) < 0) hit.staff.push(staff);
    } else {
      hit = { code: code, name: name, staff: staff ? [staff] : [], key: A.vendKey(code) };
      S.vend.push(hit);
    }
    A.save();
    return { ok: true, v: hit };
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

  A.vendByKey = function (key) {
    var hit = null;
    S.vend.forEach(function (v) { if (v.key === key) hit = v; });
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
  A.directRows = function (f) {
    return S.direct.filter(function (x) { return A.locMatch(x, f); })
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
        cat: r.cat, abbr: a, given: null, run: 0, brk: 0, rep: 0, mt: 0, rows: []
      });
      o.run += r.run; o.brk += r.brk; o.rep += r.rep;
      if (r.given != null) o.given = (o.given || 0) + r.given;
      var st = A.mtStep(r.id);
      if (st && st !== 'done') o.mt++;
      o.rows.push(r);
    });
    return Object.keys(by).map(function (k) { return by[k]; })
      .sort(function (a, b) { return (b.brk + b.rep) - (a.brk + a.rep) || b.run - a.run; });
  };

  /* ══ 공종별 집계 ══════════════════════════════════════ */
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
    var used = {}, given = {};
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
    S.issue.forEach(function (g) {
      if (!A.hit(g, f)) return;
      if (date && g.date !== date) return;
      var id = g.cat + '|' + g.size;
      given[id] = (given[id] || 0) + (Number(g.cnt) || 0);
    });
    var ids = {};
    Object.keys(used).forEach(function (k) { ids[k] = 1; });
    Object.keys(given).forEach(function (k) { ids[k] = 1; });
    return Object.keys(ids).map(function (id) {
      var p = id.split('|');
      var u = used[id] || { cat: p[0], size: p[1], run: 0, brk: 0, rep: 0 };
      var tot = u.run + u.brk + u.rep, g = given[id] == null ? null : given[id];
      var flag = '';
      if (g == null) flag = 'nogive';
      else if (tot > g) flag = 'over';
      else if (tot === 0 && g > 0) flag = 'norec';
      else if (tot < g) flag = 'idle';
      return { id: id, cat: u.cat, size: u.size, run: u.run, brk: u.brk, rep: u.rep,
               used: tot, given: g, idle: g == null ? null : g - tot, flag: flag };
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
  A.inspList = function (f) { return S.insp.filter(function (r) { return A.locMatch(r, f); }); };
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

  /* ══ 측량 ═════════════════════════════════════════════ */
  A.survList = function (f) { return S.surv.filter(function (r) { return A.locMatch(r, f); }); };

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
  A.matRows = function (f) {
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
    return A.matRows(f).filter(function (r) { return r.gap != null && r.gap < -0.0001; });
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
        var isG = L.no > gn && tn != null && bqz(tn) === bqz(L.name);
        if (isG || (L.no !== mn + 1 && tn != null && L.no > gn)) {
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

  /** 별칭 — 한 번 지정하면 다음 파일부터 자동으로 붙는다. */
  A.aliasKey = function (it) { return bqz(it.g) + '|' + bqz(it.m) + '|' + bqz(it.n) + '|' + bqz(it.sp) + '|' + bqz(it.u); };
  A.setAlias = function (it, code) {
    S.alias = S.alias || {};
    if (code) S.alias[A.aliasKey(it)] = code; else delete S.alias[A.aliasKey(it)];
    A.save();
  };

  /** 내역서 한 줄 → 공종코드. {code, how, cands} */
  A.boqMatch = function (it, site) {
    S.alias = S.alias || {};
    var al = S.alias[A.aliasKey(it)];
    if (al && REG[al]) return { code: al, how: 'alias', cands: [] };

    var g = bqMapG(it.g, site);
    var pool = [], i;
    LIST.forEach(function (e) { if (e.site === site) pool.push(e); });

    function pick(fn) {
      var hit = [];
      for (i = 0; i < pool.length; i++) if (fn(pool[i])) hit.push(pool[i]);
      return hit;
    }
    var kg = bqz(g), km = bqz(it.m), kn = bqz(it.n), ksp = bqz(it.sp), ku = bqz(it.u);

    /* 1) 대·중·공종명·규격·단위가 그대로 맞는다 */
    var h = pick(function (e) {
      return bqz(e.grp) === kg && bqz(e.mid) === km && bqz(e.name) === kn && bqz(e.spec) === ksp && bqz(e.unit) === ku;
    });
    if (h.length === 1) return { code: h[0].code, how: 'exact', cands: [] };

    /* 2) 규격+단위로 좁힌다 — 공종명 표기가 갈릴 때 */
    if (ksp) {
      h = pick(function (e) { return bqz(e.grp) === kg && bqz(e.mid) === km && bqz(e.spec) === ksp && bqz(e.unit) === ku; });
      if (h.length === 1) return { code: h[0].code, how: 'spec', cands: [] };
    }
    /* 3) 규격을 빼고 공종명+단위로 */
    h = pick(function (e) { return bqz(e.grp) === kg && bqz(e.mid) === km && bqz(e.name) === kn && bqz(e.unit) === ku; });
    if (h.length === 1) return { code: h[0].code, how: 'name', cands: [] };

    /* 4) 글자 다발 대조 — 마스터와 내역서가 다르게 쪼개 놓은 경우 */
    var narrow = pick(function (e) { return bqz(e.grp) === kg && bqz(e.mid) === km && bqz(e.unit) === ku; });
    if (!narrow.length) narrow = pick(function (e) { return bqz(e.grp) === kg && bqz(e.unit) === ku; });
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

    /* 5) 마지막 — 가장 가까운 것. 2등과 벌어져 있을 때만 쓴다 */
    var pl = sub1.length ? sub1 : (sub2.length ? sub2 : narrow), sc = [];
    for (i = 0; i < pl.length; i++) sc.push({ v: bqScore(mbag(pl[i]), fb), e: pl[i] });
    sc.sort(function (a, b) { return b.v - a.v; });
    if (sc.length && sc[0].v >= 0.6 && (sc.length === 1 || sc[0].v - sc[1].v >= 0.05)) {
      return { code: sc[0].e.code, how: 'near', cands: [] };
    }
    return { code: '', how: '', cands: sc.slice(0, 6).map(function (x) { return x.e.code; }) };
  };

  /** 내역서를 설계수량으로 담는다. ★덮어쓰기 — 두 번 올려도 두 배가 되지 않는다. */
  A.readBoqRows = function (rows, loc) {
    var items = A.boqItems(rows), lk = A.locKey(loc);
    var put = {}, ok = 0, need = [], i;
    for (i = 0; i < items.length; i++) {
      var it = items[i], m = A.boqMatch(it, loc.s);
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
  A.readIssueRows = function (rows, loc) {
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
      S.issue.push({
        id: A.uid(), date: String(r[di] || A.today()).slice(0, 10),
        loc: loc, cat: fix, size: size, cnt: cnt
      });
      ok++;
    }
    A.save();
    return { ok: ok, miss: miss };
  };
})();
