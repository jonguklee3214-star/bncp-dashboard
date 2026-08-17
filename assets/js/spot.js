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
     km과 m을 나눠 받는다. 한 칸 자유입력은 표기가 흔들려(0+000 / 0-000 / STA 0+000)
     연장 자동계산이 깨진다. */
  SPOT.sta = function (km, m) {
    var k = parseInt(km, 10), mm = parseFloat(m);
    if (isNaN(k) || isNaN(mm)) return null;
    if (k < 0 || mm < 0) return null;
    return k * 1000 + mm;
  };
  SPOT.staText = function (n) {
    if (n === null || n === undefined || isNaN(n)) return '';
    var k = Math.floor(n / 1000), m = Math.round((n - k * 1000) * 100) / 100;
    var s = String(m.toFixed(m % 1 ? 2 : 0));
    while (s.replace(/\..*$/, '').length < 3) s = '0' + s;
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

  G.BNCP_SPOT = SPOT;
})(typeof window !== 'undefined' ? window : this);
