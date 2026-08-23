/* ══════════════════════════════════════════════════════════
   세부위치 (층4) — 1차: 도로(Road)만
   · 실적을 어디서 했는지 남긴다. 이게 있어야 검측을 구간으로 묶을 수 있다.
   · 관로·맨홀·스판·변실은 2차에서 붙인다.
   ══════════════════════════════════════════════════════════ */
(function (G) {
  'use strict';

  /* 도로폭별 번호 상한. 현장에서 폭을 추가할 수 있다(추가분은 S.roadX에 쌓인다). */
  var ROAD_W = [
    { w: '50',   max: 5 },
    { w: '27',   max: 30 },
    { w: '22',   max: 5 },
    { w: '18',   max: 50 },
    { w: '17.5', max: 5 },
    { w: '15',   max: 5 },
    { w: '14',   max: 120 }
  ];

  /* 경계석·보도블럭은 도로 양쪽과 중앙분리대에 각각 시공된다.
     ★ 저장은 side별로 나눈다 — 검측이 한쪽만 불합격할 수 있기 때문이다. */
  var SIDES = [
    { id: 'L', en: 'Left',   ar: 'يسار' },
    { id: 'C', en: 'Center', ar: 'وسط' },
    { id: 'R', en: 'Right',  ar: 'يمين' }
  ];

  var SPOT = { ROAD_W: ROAD_W, SIDES: SIDES };

  /* 기본 폭 + 현장 추가분 */
  SPOT.widths = function (extra) {
    var out = [], seen = {};
    ROAD_W.forEach(function (r) { out.push({ w: r.w, max: r.max }); seen[r.w] = 1; });
    (extra || []).forEach(function (r) {
      if (r && r.w && !seen[String(r.w)]) { out.push({ w: String(r.w), max: +r.max || 50 }); seen[String(r.w)] = 1; }
    });
    return out.sort(function (a, b) { return parseFloat(b.w) - parseFloat(a.w); });
  };

  SPOT.maxNo = function (w, extra) {
    var list = SPOT.widths(extra), i;
    for (i = 0; i < list.length; i++) if (list[i].w === String(w)) return list[i].max;
    return 50;
  };

  SPOT.sideName = function (id) {
    var n = '';
    SIDES.forEach(function (x) { if (x.id === id) n = x.en; });
    return n;
  };

  /* 도로 이름 — '50-1', '18-2 (School Entrance)' */
  SPOT.roadName = function (sp) {
    if (!sp || !sp.w || !sp.no) return '';
    return sp.w + '-' + sp.no + (sp.memo ? ' (' + sp.memo + ')' : '');
  };

  /* ── 측점 ─────────────────────────────────────────────
     ★1스테이션 = 20m다 (2026-08-23 현장 확정).
       0+00 · 0+01 … 0+19 **다음이 1+00**이다. 0+20은 없다.
       뒤 두 자리는 그 스테이션 안에서의 미터(0~19)다.
     ★종전 코드는 흔한 1km 기준(km+m, 0+000~0+999)으로 짜여 있었다.
       그래서 「0+19 다음 1+00」을 넣으면 1m 구간을 **981m로 계산**했다.
       실적 폼에서 이 연장이 작업량에 자동으로 박히고 손으로 못 고치므로,
       ★표기만 틀린 것이 아니라 **작업량 자체가 틀어지는** 문제였다.
     km과 m을 나눠 받는 이유는 그대로다 — 한 칸 자유입력은 표기가 흔들려
     (0+000 / 0-000 / STA 0+000) 연장 자동계산이 깨진다. */
  var STA_STEP = 20;
  SPOT.STA_STEP = STA_STEP;

  SPOT.sta = function (st, m) {
    var k = parseInt(st, 10), mm = parseFloat(m);
    if (isNaN(k) || isNaN(mm)) return null;
    if (k < 0 || mm < 0) return null;
    /* ★0+20은 없다 — 1+00이다. 막지 않으면 같은 지점이 두 가지로 적혀
       겹침 검사도 연장 계산도 조용히 어긋난다. */
    if (mm >= STA_STEP) return null;
    return k * STA_STEP + mm;
  };
  SPOT.staText = function (n) {
    if (n === null || n === undefined || isNaN(n)) return '';
    var k = Math.floor(n / STA_STEP), m = Math.round((n - k * STA_STEP) * 100) / 100;
    var s = String(m.toFixed(m % 1 ? 2 : 0));
    while (s.replace(/\..*$/, '').length < 2) s = '0' + s;
    return k + '+' + s;
  };
  /* 연장 = |To − From|. 입력 순서를 바꿔 넣어도 흡수한다. */
  SPOT.len = function (a, b) {
    if (a === null || b === null || a === undefined || b === undefined) return null;
    var d = b - a;
    return d < 0 ? -d : d;
  };

  /* ── 라벨 — 화면·검측서·시트에 공통 ─────────────────── */
  SPOT.label = function (sp) {
    if (!sp || sp.kind !== 'road') return '';
    var t = SPOT.roadName(sp), s = SPOT.sideName(sp.side);
    if (s) t += ' · ' + s;
    if (sp.f !== null && sp.f !== undefined) {
      t += ' · STA ' + SPOT.staText(sp.f) + '~' + SPOT.staText(sp.t);
    }
    return t;
  };

  /* 검측 묶음 키 — 같은 도로·같은 쪽끼리만 묶인다.
     ★ side를 키에 넣는 이유: 좌우가 따로 검측되므로 섞이면 안 된다. */
  SPOT.groupKey = function (sp) {
    if (!sp || sp.kind !== 'road') return '';
    return 'road|' + (sp.w || '') + '|' + (sp.no || '') + '|' + (sp.side || '');
  };

  /* 묶은 실적들의 측점 범위 */
  SPOT.range = function (list) {
    var lo = null, hi = null;
    (list || []).forEach(function (x) {
      var sp = x.spot;
      if (!sp || sp.f === null || sp.f === undefined) return;
      if (lo === null || sp.f < lo) lo = sp.f;
      if (hi === null || sp.t > hi) hi = sp.t;
    });
    if (lo === null) return '';
    return 'STA ' + SPOT.staText(lo) + ' ~ ' + SPOT.staText(hi);
  };

  /* ── 검측 단계 ────────────────────────────────────────
     ★ 단계(stage)와 차수(seq)는 다르다. 섞으면 통계가 흐려진다.
       단계 = 정상 시공 순서 (1차 → 2차 → 되메우기 N층)
       차수 = 그 단계에서 불합격해 다시 받은 횟수 */
  SPOT.STAGES = [
    { id: 'p1',   en: 'Stage 1 — pipe laid',        ar: 'المرحلة 1 — تركيب الأنبوب' },
    { id: 'p2',   en: 'Stage 2 — sand backfill',    ar: 'المرحلة 2 — ردم رملي' },
    { id: 'bf',   en: 'Backfill layer (30cm)',      ar: 'طبقة ردم (30سم)' }
  ];
  SPOT.stageName = function (id, layer) {
    var n = '';
    SPOT.STAGES.forEach(function (x) { if (x.id === id) n = x.en; });
    if (id === 'bf' && layer) n += ' #' + layer;
    return n;
  };

  /* ── 공종별 표기 (요청 12·13 · 0-P 확정) ──────────────
     ★사용자 확정 : 표기는 **전부 수동입력**이다 («틀리면 스탭이 반려하면
       되잖아»). 목록·다이얼은 버렸다 — 번호를 1~1000으로 깔면 없는
       번호도 골라져 오입력 차단이 안 되고, 스크롤이 타이핑보다 느리다.
     ★관로·전기 계열은 **도로·측점을 안 쓴다.** 도면 라벨이 곧 위치다
       (0-P 우수공 규칙 : 「도로명 불필요」). 토공·포장은 종전대로 도로다.
     ★부지와 부대블록은 표기가 다르다 — 부대는 쉼표 구분(`M1,D315`).
       그래서 안내 문구를 갈라 둔다. */
  var TAGS = [
    { s: 'civil', grp: '우수공',                  ex: 'C2-55 D1100 · CM4-66 · CSM6-10' },
    { s: 'civil', grp: '오수공',                  ex: 'C61 D700 L=319m · CM2-14' },
    { s: 'civil', grp: '상수공',                  ex: 'P156-D300 L=140m · CH-type2' },
    { s: 'civil', grp: 'Irrigation공(메인관로)',  ex: 'IR286-D110 L=419.30m · IRR TANK-3' },
    { s: 'civil', grp: '전기/통신/가로등',        ex: 'L3-8a1 · P3C3-2 · P3D3-1 · EM3-15' },
    { s: 'anc',   grp: '단지내 부대토목-우수공',   ex: 'M1,D315 L=18.25M · SM3-04' },
    { s: 'anc',   grp: '단지내 부대토목-오수공',   ex: 'M7,D315 L=67.76M · S5,D315' },
    { s: 'anc',   grp: '단지내 부대토목-상수공',   ex: 'B3,D225 L=135.51M · A1,D280' },
    /* ★부대블록 전기 — B8-E-1001 ELECTRICAL POWER SYSTEM PLAN 도면 기준
       (2026-08-23 사용자가 도면 사진으로 확정).
       ★부지 전기(P3C3-2·EM3-15)와 **표기가 전혀 다르다.** 부지 것을
         임시로 쓰고 있던 것을 도면 표기로 바꿨다.
         핸드홀 H-8 · H-9-1 / 맨홀 M-5 / 가로등 LP2-6 / 관로 100*4 */
    { s: 'anc',   grp: '단지내 부대토목-전기/통신/가로등', ex: 'H-8 · H-9-1 · M-5 · LP2-6 · 100*4' }
  ];

  /* ── 부대토목 도로 (2026-08-23 사용자 확정) ────────────
     ★부지와 **체계가 다르다.**
       부지 : 폭-번호   (18-2)  — 폭 7종, 폭마다 번호 상한이 다르다
       부대 : 블록-번호 (B6-3)  — ★**도로폭 기준이 없다.** 블록마다 30개 고정.
     ★저장은 부지와 **같은 모양**을 쓴다 — `w`에 블록코드(B6), `no`에 1~30.
       그래야 `roadName`·`groupKey`·`overlap`이 그대로 돈다(B6-3으로 읽힌다).
       모양을 새로 만들면 겹침 검사·검측 묶음을 전부 다시 짜야 한다.
     ★블록코드는 위치에서 나온다 — Town B · Block 6 → `B6`. 업체가 위치를
       이미 골랐으므로 따로 물을 것이 없다. */
  var ANC_ROADS = 30;
  SPOT.ANC_ROADS = ANC_ROADS;

  /** 위치 → 블록코드. Town B · Block 6 → 'B6' */
  SPOT.blkCode = function (loc) {
    if (!loc || loc.s !== 'anc' || !loc.t || !loc.b) return '';
    return String(loc.t) + String(loc.b);
  };

  /* ★측점은 **고르는 것이다** — 직접입력 금지(사용자 확정).
     손으로 치면 1+20 같은 없는 측점이 들어오고, 그러면 같은 지점이 두
     가지로 적혀 겹침 검사도 연장도 조용히 어긋난다.
     ★스테이션 번호 상한 — 도면상 블록 내 도로 최대 연장을 모른다.
       넉넉히 30(=600m)으로 뒀다. ★모자라면 여기만 고치면 된다. */
  var STA_NO_MAX = 30;
  SPOT.STA_NO_MAX = STA_NO_MAX;
  /** 고를 수 있는 스테이션 번호 [0..STA_NO_MAX] */
  SPOT.staNos = function () {
    var a = [], i;
    for (i = 0; i <= STA_NO_MAX; i++) a.push(i);
    return a;
  };
  /** 고를 수 있는 스테이션 내 미터 [0..19] — ★20은 없다. 다음 스테이션이다 */
  SPOT.staMs = function () {
    var a = [], i;
    for (i = 0; i < STA_STEP; i++) a.push(i);
    return a;
  };

  /** 그 공종군이 표기를 받는가. 받으면 도면 라벨 예시, 아니면 '' */
  SPOT.tagHint = function (sector, grp) {
    var ex = '';
    TAGS.forEach(function (x) {
      if (x.s === sector && x.grp === grp) ex = x.ex;
    });
    return ex;
  };
  /** 표기를 받는 공종군인가 = 도로·측점 대신 도면 라벨을 쓴다 */
  SPOT.needTag = function (sector, grp) {
    return !!SPOT.tagHint(sector, grp);
  };

  G.BNCP_SPOT = SPOT;
})(typeof window !== 'undefined' ? window : this);
