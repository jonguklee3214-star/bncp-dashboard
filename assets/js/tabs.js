/* ══════════════════════════════════════════════════════════
   tabs.js v2 — 6개 탭
     1 작업현황 · 2 검측 · 3 측량 · 4 자재현황 · 5 알림·전파 · 6 공정표
   공통 선택 순서 : 공사구분 → 위치 → 대분류 → 공종 (시설물이면 개소)
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var A = window.APP, S = A.S, $ = A.$, $$ = A.$$, esc = A.esc, nf = A.nf, pf = A.pf;
  var T = function (k) { return esc(A.T(k)); };
  /* 층1(위치·시설)은 항상 영문 → ko 외 언어는 en 필드. 단 bn 필드가 있으면 그것을 쓴다 */
  var L = function () { return S.lang === 'ko' ? 'ko' : 'en'; };
  var LJ = function (o) { return (S.lang === 'ko' ? o.ko : (S.lang === 'bn' && o.bn) ? o.bn : o.en) || o.ko; };

  var flt = { s: 'civil', p: 0, c: 0, t: '', b: 0 };   // 상단 위치 필터
  var cur = 1;

  /* ══ 조각 ═══════════════════════════════════════════ */
  function kpi(cls, label, val, unit, note, bar) {
    return '<div class="kpi ' + cls + '"><div class="kpi__l">' + label + '</div>' +
      '<div class="kpi__v">' + val + (unit ? '<span>' + unit + '</span>' : '') + '</div>' +
      (bar != null ? '<div class="bar"><i style="width:' + Math.max(0, Math.min(100, bar)) + '%"></i></div>' : '') +
      '<div class="kpi__n">' + note + '</div></div>';
  }
  function card(title, sub, body, foot, extra) {
    return '<div class="card"><div class="card__h"><h2>' + title + '</h2>' +
      (sub ? '<span class="sub">' + sub + '</span>' : '') +
      '<span class="sp"></span>' + (extra || '') + '</div>' +
      '<div class="card__b' + (foot === 'flush' ? ' flush' : '') + '">' + body + '</div>' +
      (foot && foot !== 'flush' ? '<div class="card__f">' + foot + '</div>' : '') + '</div>';
  }
  function empty(t, m) { return '<div class="empty"><b>' + t + '</b>' + (m || '') + '</div>'; }
  function opts(list, sel, v, l) {
    return list.map(function (x) {
      var vv = v ? v(x) : x, ll = l ? l(x) : x;
      return '<option value="' + esc(vv) + '"' + (String(vv) === String(sel) ? ' selected' : '') + '>' + esc(ll) + '</option>';
    }).join('');
  }
  function fld(lab, inner, w) {
    return '<div' + (w ? ' style="' + w + '"' : '') + '><label class="fl">' + lab + '</label>' + inner + '</div>';
  }
  /* 파일 선택 — 네이티브 버튼(브라우저/OS 언어) 대신 커스텀 버튼으로 언어 제어 */
  function fileIn(id, accept) {
    return '<label class="filebtn">' +
      '<span class="btn btn--g btn--sm">' + T('file_pick') + '</span>' +
      '<span class="filebtn__n" id="' + id + '_n">' + T('file_none') + '</span>' +
      '<input type="file" id="' + id + '" accept="' + accept + '" hidden></label>';
  }
  /* 협력업체 입력 폼 라벨 — 영어 / 아랍어 병기 (화면언어 무관 고정) */
  function bl(key) {
    var en = window.I18N.en[key] || key, ar = window.I18N.ar[key] || '';
    return '<span class="bi">' + esc(en) +
      (ar ? '<span class="sl">/</span><span class="ar">' + esc(ar) + '</span>' : '') + '</span>';
  }
  function bfld(key, inner, w) { return fld(bl(key), inner, w); }

  /* ══ 공통 선택기 (공사구분 → 위치 → 대분류 → 공종 → 개소) ══ */
  var PK = {};
  function pk(px) {
    if (!PK[px]) PK[px] = { s: flt.s, p: flt.p || 1, c: flt.c || 1, t: flt.t || 'A', b: flt.b || 1, grp: '', key: '', spot: -1, eq: [] };
    return PK[px];
  }
  function pkLoc(px) {
    var o = pk(px);
    return o.s === 'civil' ? { s: 'civil', p: +o.p, c: +o.c } : { s: 'anc', t: o.t, b: +o.b };
  }
  /* locOnly=true → 위치만 (직영은 공종코드가 없다) */
  function pkHTML(px, locOnly) {
    var o = pk(px), site = o.s;
    var locSel = site === 'civil'
      ? fld('Phase', '<select class="in" data-pk="' + px + '" data-f="p">' +
          opts(A.PHASES, o.p, null, function (x) { return 'Phase ' + x; }) + '</select>') +
        fld('Section', '<select class="in" data-pk="' + px + '" data-f="c">' +
          opts(A.SECTORS, o.c, null, function (x) { return 'Phase ' + o.p + '-' + x; }) + '</select>')
      : fld('Town', '<select class="in" data-pk="' + px + '" data-f="t">' +
          opts(A.TOWNS, o.t, function (x) { return x.t; }, function (x) { return 'Town ' + x.t; }) + '</select>') +
        fld('Block', '<select class="in" data-pk="' + px + '" data-f="b">' +
          opts(A.townBlocks(o.t), o.b, null, function (x) { return 'Block ' + x; }) + '</select>');

    var groups = A.groupsOf(site);
    var items = o.grp ? A.itemsOf(site, o.grp) : [];
    var e = o.key ? A.item(o.key) : null;
    var spotSel = '';
    if (e && e.kind === 'F') {
      var cols = A.facCols(e.fac);
      spotSel = fld(T('spot') + ' <em>*</em>', '<select class="in" data-pk="' + px + '" data-f="spot">' +
        '<option value="-1">' + T('pick') + '</option>' +
        opts(cols, o.spot, function (x) { return cols.indexOf(x); }) + '</select>');
    }
    var head = '<div class="f-row">' +
      fld(T('site'), '<select class="in" data-pk="' + px + '" data-f="s">' +
        opts(A.SITES, site, function (x) { return x.id; }, function (x) { return x[L()]; }) + '</select>') +
      locSel + '</div>';
    if (locOnly) return head;
    return head +
      '<div class="f-row" style="margin-top:12px">' +
      fld(T('grp'), '<select class="in" data-pk="' + px + '" data-f="grp">' +
        '<option value="">' + T('pick') + '</option>' +
        opts(groups, o.grp, function (x) { return x.grp; }, function (x) { return A.trW(x.grp) + ' (' + x.items.length + ')'; }) +
        '</select>') +
      fld(T('work'), '<select class="in" data-pk="' + px + '" data-f="key"' + (items.length ? '' : ' disabled') + '>' +
        '<option value="">' + T('pick') + '</option>' +
        items.map(function (x) {
          return '<option value="' + esc(x.key) + '"' + (x.key === o.key ? ' selected' : '') + '>' +
            esc(A.trW(x.name) + (x.spec ? ' · ' + A.trS(x.spec) : '') + '  [' + x.unit + ']' +
                (x.code ? '  (' + x.code + ')' : '')) + '</option>';
        }).join('') + '</select>') +
      spotSel + '</div>';
  }
  function pkBind() {
    $$('[data-pk]').forEach(function (el) {
      el.onchange = function () {
        var o = pk(el.dataset.pk), f = el.dataset.f;
        o[f] = (f === 'p' || f === 'c' || f === 'b' || f === 'spot') ? +el.value : el.value;
        if (f === 's') { o.grp = ''; o.key = ''; o.spot = -1; o.p = 1; o.c = 1; o.t = 'A'; o.b = 1; }
        if (f === 'grp') { o.key = ''; o.spot = -1; }
        if (f === 'key') o.spot = -1;
        if (f === 't') o.b = 1;
        var box = $('#pk_' + el.dataset.pk);
        if (box) { box.innerHTML = pkHTML(el.dataset.pk); pkBind(); }
      };
    });
  }
  function pkBox(px) { return '<div id="pk_' + px + '">' + pkHTML(px) + '</div>'; }
  /** 유효성 검사 후 {loc,key,spot} 반환. 부족하면 null */
  function pkGet(px) {
    var o = pk(px); if (!o.key) return null;
    var e = A.item(o.key); if (!e) return null;
    if (e.kind === 'F' && o.spot < 0) return null;
    return { loc: pkLoc(px), key: o.key, spot: e.kind === 'F' ? o.spot : null, e: e };
  }
  function spotName(key, spot) {
    var e = A.item(key);
    if (!e || e.kind !== 'F' || spot == null || spot < 0) return '';
    return A.facCols(e.fac)[spot] || '';
  }
  function itemLine(key, spot) {
    var e = A.item(key); if (!e) return esc(key);
    /* ★규격도 반드시 A.trS()를 거친다 — 안 그러면 EN/BN 화면에 한글이 남는다
       (v2.15.3 사용자 지적). 공종명 trW만 걸고 규격을 빠뜨린 것이 원인이었다. */
    return '<span class="nm">' + esc(A.trW(e.name)) + '</span>' +
      (e.spec ? ' <span class="sp">' + esc(A.trS(e.spec)) + '</span>' : '') +
      (spot != null && spot >= 0 ? ' <span class="bd bd--mute">' + esc(spotName(key, spot)) + '</span>' : '');
  }

  /* ══ 상단 위치 필터 ══════════════════════════════════ */
  function fltHTML() {
    var civil = flt.s === 'civil';
    /* ★공구(Section)는 없앨 수 없다 — 설계수량·실적·인원·장비가 전부
       Phase+공구 단위로 저장된다(locKey). 없애면 3-1과 3-2 물량이 섞여
       진행률이 뜻을 잃는다. 대신 드롭다운 2개를 1개로 합쳤다(v2.15.0). */
    var pc = [];
    A.PHASES.forEach(function (p) {
      A.SECTORS.forEach(function (c) { pc.push({ v: p + '-' + c, t: 'Phase ' + p + '-' + c }); });
    });
    return '<select class="in" id="fSite" style="width:auto">' +
      opts(A.SITES, flt.s, function (x) { return x.id; }, function (x) { return x[L()]; }) + '</select>' +
      (civil
        ? '<select class="in" id="fPC" style="width:auto"><option value="">All Phase</option>' +
          pc.map(function (o) {
            return '<option value="' + o.v + '"' +
              (flt.p + '-' + flt.c === o.v ? ' selected' : '') + '>' + o.t + '</option>';
          }).join('') + '</select>'
        : '<select class="in" id="fT" style="width:auto"><option value="">All Town</option>' +
          opts(A.TOWNS, flt.t, function (x) { return x.t; }, function (x) { return 'Town ' + x.t; }) + '</select>' +
          '<select class="in" id="fB" style="width:auto"><option value="0">All Block</option>' +
          opts(flt.t ? A.townBlocks(flt.t) : [], flt.b, null, function (x) { return 'Block ' + x; }) + '</select>');
  }
  function fltLabel() {
    if (flt.s === 'civil') return 'Phase ' + (flt.p || '1-6') + (flt.c ? '-' + flt.c : '');
    return 'Town ' + (flt.t || 'A-H') + (flt.b ? ' · Block ' + flt.b : '');
  }

  /* ══ 인원 다이얼 ════════════════════════════════════ */
  function dialHTML(px) {
    var o = pk(px); o.ppl = o.ppl || { eng: 0, fmn: 0, opr: 0, wkr: 0 };
    var opr = A.oprCount(o.eq || []);
    return '<div class="f-row">' + A.JOBS.map(function (j) {
      return '<div><label class="fl">' + esc(LJ(j)) + '</label>' +
        '<div class="dial"><button type="button" data-dl="' + px + '" data-j="' + j.id + '" data-d="-1">−</button>' +
        '<input class="in num" data-dv="' + px + '_' + j.id + '" type="number" min="0" step="1" value="' + (o.ppl[j.id] || 0) + '">' +
        '<button type="button" data-dl="' + px + '" data-j="' + j.id + '" data-d="1">+</button></div></div>';
    }).join('') +
      '<div><label class="fl">' + T('opr_auto') + '</label>' +
      '<div class="in" style="background:var(--wash);text-align:center;font-weight:700" id="dlOpr_' + px + '">' + nf(opr) + '</div></div>' +
      '</div>' +
      '<div class="hint">' + T('total') + ' <b id="dlSum_' + px + '">' + nf(A.pplSum(o.ppl) + opr) + '</b> · ' + T('opr_auto') + ' = ' + T('run') + '</div>';
  }
  function dialBind(px) {
    function sync() {
      var o = pk(px);
      A.JOBS.forEach(function (j) {
        var el = $('[data-dv="' + px + '_' + j.id + '"]');
        if (el) o.ppl[j.id] = Math.max(0, parseInt(el.value, 10) || 0);
      });
      var opr = A.oprCount(o.eq || []);
      var oe = $('#dlOpr_' + px); if (oe) oe.textContent = nf(opr);
      var s = $('#dlSum_' + px); if (s) s.textContent = nf(A.pplSum(o.ppl) + opr);
    }
    $$('[data-dl="' + px + '"]').forEach(function (b) {
      b.onclick = function () {
        var el = $('[data-dv="' + px + '_' + b.dataset.j + '"]');
        el.value = Math.max(0, (parseInt(el.value, 10) || 0) + (+b.dataset.d));
        sync();
      };
    });
    $$('[data-dv^="' + px + '_"]').forEach(function (el) { el.oninput = sync; });
  }

  /* ══ 장비 선택 ══════════════════════════════════════ */
  function eqHTML(px) {
    var o = pk(px); o.eq = o.eq || [];
    var cat = o.eqcat || '', sizes = cat ? A.eqSizes(cat) : [];
    return '<div class="f-row">' +
      fld(T('eqcat'), '<select class="in" data-eq="' + px + '" data-f="cat">' +
        '<option value="">' + T('pick') + '</option>' +
        opts(A.EQ_TREE, cat, function (x) { return x.cat; }, function (x) { return x.cat; }) + '</select>') +
      fld(T('eqsize'), '<select class="in" data-eq="' + px + '" data-f="size"' + (sizes.length ? '' : ' disabled') + '>' +
        opts(sizes, o.eqsize) + '</select>') +
      '</div><div class="f-row" style="margin-top:10px">' +
      fld(T('run'), '<input class="in num" data-eqn="' + px + '_run" type="number" min="0" step="1" value="0">') +
      fld(T('brk'), '<input class="in num" data-eqn="' + px + '_brk" type="number" min="0" step="1" value="0">') +
      fld(T('rep'), '<input class="in num" data-eqn="' + px + '_rep" type="number" min="0" step="1" value="0">') +
      fld('&nbsp;', '<button class="btn btn--g" data-eqadd="' + px + '">' + T('eqadd') + '</button>') +
      '</div>' +
      (o.eq.length ? '<div style="margin-top:12px">' + o.eq.map(function (x, i) {
        return '<div class="eqrow"><span class="eqrow__n">' + esc(A.eqLabel(x.cat, x.size)) + '</span>' +
          '<span class="bd">' + T('run') + ' ' + nf(x.run) + '</span>' +
          (x.brk ? '<span class="bd bd--d">' + T('brk') + ' ' + nf(x.brk) + '</span>' : '') +
          (x.rep ? '<span class="bd bd--o">' + T('rep') + ' ' + nf(x.rep) + '</span>' : '') +
          '<button class="btn btn--g btn--sm" data-eqdel="' + px + '" data-i="' + i + '">' + T('del') + '</button></div>';
      }).join('') + '</div>' : '<div class="hint" style="margin-top:10px">' + T('h_eqlist') + '</div>');
  }
  function eqBind(px) {
    $$('[data-eq="' + px + '"]').forEach(function (el) {
      el.onchange = function () {
        var o = pk(px);
        if (el.dataset.f === 'cat') { o.eqcat = el.value; o.eqsize = (A.eqSizes(el.value) || [])[0] || ''; }
        else o.eqsize = el.value;
        var box = $('#eq_' + px); if (box) { box.innerHTML = eqHTML(px); eqBind(px); }
      };
    });
    var add = $('[data-eqadd="' + px + '"]');
    if (add) add.onclick = function () {
      var o = pk(px);
      if (!o.eqcat) return;
      var g = function (f) { var el = $('[data-eqn="' + px + '_' + f + '"]'); return Math.max(0, parseInt(el && el.value, 10) || 0); };
      var run = g('run'), brk = g('brk'), rep = g('rep');
      if (!run && !brk && !rep) return;
      o.eq.push({ cat: o.eqcat, size: o.eqsize || '', run: run, brk: brk, rep: rep });
      var box = $('#eq_' + px); if (box) { box.innerHTML = eqHTML(px); eqBind(px); }
      var db = $('#dial_' + px); if (db) { db.innerHTML = dialHTML(px); dialBind(px); }
    };
    $$('[data-eqdel="' + px + '"]').forEach(function (b) {
      b.onclick = function () {
        var o = pk(px); o.eq.splice(+b.dataset.i, 1);
        var box = $('#eq_' + px); if (box) { box.innerHTML = eqHTML(px); eqBind(px); }
        var db = $('#dial_' + px); if (db) { db.innerHTML = dialHTML(px); dialBind(px); }
      };
    });
  }
  function eqBox(px) { return '<div id="eq_' + px + '">' + eqHTML(px) + '</div>'; }

  /* ══════════════════════════════════════════════════
     탭 1 — 작업현황
     ══════════════════════════════════════════════════ */
  /* ══ 서버 수신 ═══════════════════════════════════════
     협력업체 기기에서 올라온 실적을 가져와 합친다.
     ★ 이미 있는 id는 손대지 않는다 — 스탭이 확인(st:'ok')한 것을
       서버의 'sub' 상태로 되돌리면 안 되기 때문이다. */
  var syncing = false;

  function syncLabel() {
    var api = window.BNCP_API;
    if (!api) return '';
    if (syncing) return T('sync_ing');
    if (api.rxErr) return T('sync_err');
    return T('sync_at') + ': ' + (api.rxAt ? new Date(api.rxAt).toLocaleString() : T('sync_never'));
  }

  /* 서버가 준 평평한 행을 화면 저장 형식으로 되돌린다.
     위치는 라벨을 되파싱하지 않고 구성요소(s/p/c/t/b)로 복원한다 — 파싱 실수 여지를 없앤다. */
  function rxLoc(r) {
    return r.s === 'civil' ? { s: 'civil', p: +r.p, c: +r.c }
         : r.s === 'anc'   ? { s: 'anc', t: r.t, b: +r.b } : null;
  }

  function unpack(r) {
    if (!r || !r.id) return null;
    var loc = rxLoc(r);
    if (!loc) return null;
    var base = { id: r.id, date: r.date, loc: loc, by: r.by || '', up: 1 };

    if (r.type === 'mat') {
      if (!r.mat) return null;
      return { box: 'mreq', row: merge(base, {
        grp: r.grp, sub: r.sub, mat: r.mat, spec: r.spec || '', unit: r.unit || '',
        plant: !!r.plant, qty: +r.qty || 0, st: r.st || 'req', reqAt: r.date || '',
        apvBy: '', apvAt: '', denyWhy: '', plantReqAt: '',
        iss: null, issAt: '', noissWhy: '', use: null, useAt: '' }) };
    }

    if (r.type === 'direct') return { box: 'direct', row: merge(base, {
      task: r.name || '', teams: +r.teams || 0,
      ppl: r.ppl || { eng: 0, fmn: 0, wkr: 0 }, eq: r.eq || [],
      note: r.note || '', st: r.st || 'sub' }) };

    if (!r.key) return null;
    base.key = r.key;
    base.spot = (r.spot === 0 || r.spot) ? r.spot : null;

    if (r.type === 'work') return { box: 'work', row: merge(base, { qty: +r.qty || 0, st: r.st || 'sub' }) };

    if (r.type === 'crew') return { box: 'crew', row: merge(base, {
      teams: +r.teams || 0,
      ppl: r.ppl || { eng: 0, fmn: 0, wkr: 0 },
      eq: r.eq || [], st: r.st || 'sub' }) };

    if (r.type === 'insp') return { box: 'insp', row: merge(base, {
      qty: +r.qty || 0, st: r.st || 'apply', stAt: r.stAt || r.date || '',
      reason: r.reason || '', note: r.note || '', seq: +r.seq || 1, hist: [] }) };

    if (r.type === 'surv') return { box: 'surv', row: merge(base, {
      why: r.why || '', done: !!r.done }) };

    return null;
  }

  function merge(a, b) {
    for (var k in b) if (Object.prototype.hasOwnProperty.call(b, k)) a[k] = b[k];
    return a;
  }

  /* 직영(탭7) 전송 — 수정 시에도 같은 id로 보내므로 서버가 그 줄을 덮어쓴다 */
  function txDirect(row) {
    var api = window.BNCP_API;
    if (!api || !api.on || !row) return;
    row.up = 0;
    var L = row.loc || {};
    try {
      api.send('direct', {
        id: row.id, date: row.date, loc: A.locLabel(L),
        s: L.s, p: L.p, c: L.c, t: L.t, b: L.b,
        name: row.task, qty: row.teams, teams: row.teams,
        ppl: row.ppl, eq: row.eq, pax: A.crewTotal(row),
        by: row.by, note: row.note, st: row.st || 'sub'
      }).then(function (r) {
        row.up = (r && r.ok) ? 1 : 0;
        A.save();
      });
    } catch (e) { /* 전송 실패는 무시 — 로컬 저장이 우선 */ }
  }

  function syncNow(quiet) {
    var api = window.BNCP_API;
    if (!api || syncing) return;
    syncing = true;
    paintSync();
    api.rows('').then(function (rows) {     // 종류 전부를 한 번에 받는다
      syncing = false;
      if (!rows) { paintSync(); return; }

      var box = { work: S.work, crew: S.crew, insp: S.insp, surv: S.surv,
                  mreq: S.mreq, direct: S.direct };
      var have = {}, add = 0, k;
      for (k in box) box[k].forEach(function (x) { have[x.id] = 1; });

      rows.forEach(function (r) {
        if (have[r.id]) return;             // 이미 있는 건은 건드리지 않는다
        var u = unpack(r);
        if (!u || !box[u.box]) return;
        box[u.box].push(u.row); have[u.row.id] = 1; add++;
      });

      if (add) { A.save(); A.render(); }
      else paintSync();
      var m = document.querySelector('#syncMsg');
      if (m && !quiet) m.textContent = add ? (T('sync_new') + ' ' + nf(add)) : T('sync_none');
    });
  }

  function paintSync() {
    var m = document.querySelector('#syncMsg');
    if (m) m.textContent = syncLabel();
  }

  /* ══ 확인 필요 ═══════════════════════════════════════
     이라크 기준 생산성 × 신고 조수 를 크게 넘는 실적만 골라 보여준다.
     ★ 막지 않는 이유: 장비를 늘리거나 야간작업을 하면 정상적으로 넘을 수 있다.
       막으면 정상 실적이 안 올라가고 결국 전화가 온다 — 그게 더 큰 낭비다. */
  function chkMul() { return +(S.ckMul || 1.5); }

  function chkRows() {
    var out = [];
    S.work.forEach(function (w) {
      if (w.ckOk) return;                       // 확인 완료한 건은 다시 뜨지 않는다
      var e = A.item(w.key); if (!e) return;
      var rate = e.pteam;                       // 팀당 1일 기준 생산량(prod.js)
      if (!rate) return;                        // 기준 없는 공종은 판정하지 않는다
      var teams = 0;
      S.crew.forEach(function (c) {
        if (c.date === w.date && c.key === w.key && A.locKey(c.loc) === A.locKey(w.loc)) teams += (+c.teams || 0);
      });
      if (!teams) teams = 1;                    // 인원장비 미제출 → 1조로 본다
      var cap = rate * teams, x = cap ? w.qty / cap : 0;
      if (x >= chkMul()) out.push({ w: w, e: e, cap: cap, x: x, teams: teams });
    });
    return out.sort(function (a, b) { return b.x - a.x; });
  }

  function chkHTML() {
    var rows = chkRows();
    if (!rows.length) return '';
    return '<div class="chk"><div class="chk__h">' + T('ck_t') + ' ' + nf(rows.length) +
      '<span class="sp"> · ' + T('ck_n') + '</span></div>' +
      rows.slice(0, 20).map(function (r) {
        var sp = r.w.spot && r.w.spot.kind === 'road' ? window.BNCP_SPOT.label(r.w.spot) : '';
        return '<div class="chk__r">' + esc(r.w.date) + ' · ' + esc(A.locLabel(r.w.loc)) +
          (sp ? ' · ' + esc(sp) : '') + ' · ' + esc(A.trW(r.e.name)) +
          '<br><span class="chk__w">' + nf(r.w.qty, 1) + ' ' + esc(A.trU(r.e.unit)) + ' · ' +
          T('ck_x').replace('%n', nf(r.x, 1)) + '</span>' +
          '<span class="sp"> (' + nf(r.cap, 1) + ' = ' + nf(r.teams) + ' crew)</span>' +
          ' <button class="btn btn--g btn--sm" data-ckok="' + esc(r.w.id) + '">OK</button></div>';
      }).join('') + '</div>';
  }

  /* ══ 준비 — 맨 아래 버튼 줄 (v2.15.4) ═══════════════════
     설계수량·협력업체 명부·서버 동기화는 한 번 해 두면 쓸 일이 드물다.
     화면 위를 크게 차지하고 있어 맨 아래로 내리고, 버튼으로만 연다.
     한 번에 하나만 열린다 — 여러 개가 동시에 펼쳐지면 다시 길어진다. */
  var setupTab = '';
  A._setup = function (v) { setupTab = v; };   /* 검사에서 패널을 여는 통로 (6-B) */

  function setupHTML() {
    var lastPlan = A.hasPlan(flt);
    var tabs = [
      { id: 'plan', t: T('sp_plan'), n: lastPlan ? nf(lastPlan) + T('u_ea') : T('sp_none') },
      { id: 'vend', t: T('vd_t'), n: S.vend.length ? nf(S.vend.length) + T('u_co') : T('sp_none') },
      { id: 'sync', t: T('sync_t'), n: syncLabel() }
    ];
    var bar = '<div class="stp__b">' + tabs.map(function (x) {
      return '<button class="btn btn--g btn--sm' + (setupTab === x.id ? ' btn--o' : '') +
        '" data-stp="' + x.id + '">' + esc(x.t) + '</button>' +
        '<span class="sp stp__n">' + esc(x.n) + '</span>';
    }).join('') +
      '<a class="btn btn--g btn--sm" href="vendor.html" target="_blank" style="text-decoration:none">' +
      T('h_vopen') + '</a></div>';

    var body = '';
    if (setupTab === 'plan') body = planPanel();
    else if (setupTab === 'vend') body = vendPanel();
    else if (setupTab === 'sync') body = syncPanel();

    return '<div style="margin-bottom:16px">' + card(T('sp_t'), T('sp_n'),
      bar + (body ? '<div class="stp__p">' + body + '</div>' : '')) + '</div>';
  }

  function planPanel() {
    return '<div class="f-row">' +
      fld(T('plan_up'), fileIn('planFile', '.csv,.xlsx,.xls')) +
      fld('&nbsp;', '<div class="btns"><button class="btn btn--g btn--sm" id="planTpl">' + T('tpl') + '</button>' +
        '<button class="btn btn--g btn--sm" id="facOpen">' + T('plan_fac') + '</button></div>') +
      '</div>' +
      '<div class="hint" style="margin-top:8px">' + T('h_applyloc') + ' <b>' + esc(fltLabel()) + '</b> — ' + T('h_pickloc') + '</div>' +
      '<div id="planMsg" class="hint"></div><div id="facBox" style="display:none;margin-top:14px"></div>';
  }

  /* ★손으로 한 곳씩 넣는 길을 연다 — 업체가 몇 곳뿐인데 CSV를 만드는 건
     번거롭다(사용자 지시). CSV는 여러 곳을 한 번에 넣을 때 쓴다. */
  function vendPanel() {
    var h = '<div class="f-row">' +
      fld(T('vd_code'), '<input class="in" id="vdCode" placeholder="KEW">') +
      fld(T('vd_name'), '<input class="in" id="vdName" placeholder="Al-Kawthar">') +
      fld(T('vd_staff'), '<input class="in" id="vdStaff" placeholder="Ahmed">') +
      fld('&nbsp;', '<button class="btn" id="vdAdd">' + T('vd_add') + '</button>') +
      '</div>';
    h += '<div class="btns" style="margin-top:10px"><label class="btn btn--g btn--sm">' + T('vd_up') +
      '<input type="file" id="vdFile" accept=".csv,text/csv" style="display:none"></label>' +
      '<span class="hint" id="vdMsg">' + T('vd_upn') + '</span></div>';

    if (!S.vend.length) return h + '<div class="hint" style="margin-top:10px">' + T('vd_none') + '</div>';
    h += '<div class="tw" style="margin-top:12px"><table><thead><tr>' +
      '<th>' + T('vd_name') + '</th><th>' + T('vd_staff') + '</th>' +
      '<th>' + T('vd_link') + '</th><th class="noprint"></th></tr></thead><tbody>' +
      S.vend.map(function (v) {
        return '<tr><td><span class="nm">' + esc(v.name) + '</span> <span class="code">' + esc(v.code) + '</span></td>' +
          '<td>' + (v.staff.length ? v.staff.map(function (s2) {
            return '<span class="bd">' + esc(s2) +
              ' <a href="#" data-vsdel="' + esc(v.code) + '" data-s="' + esc(s2) + '">×</a></span> ';
          }).join('') : '<span class="sp">—</span>') + '</td>' +
          '<td><code class="sp">' + esc('vendor.html?c=' + v.key) + '</code></td>' +
          '<td class="c noprint"><button class="btn btn--g btn--sm" data-vdel="' + esc(v.code) + '">' + T('del') + '</button></td></tr>';
      }).join('') + '</tbody></table></div>';
    return h;
  }

  function syncPanel() {
    return '<div class="btns"><button class="btn btn--g btn--sm" id="syncBtn">' + T('sync_btn') + '</button>' +
      '<span class="hint" id="syncMsg">' + syncLabel() + '</span></div>' +
      '<div class="hint" style="margin-top:8px">' + T('sync_n') + '</div>';
  }

  function setupBind() {
    $$('[data-stp]').forEach(function (b) {
      b.onclick = function () {
        setupTab = (setupTab === b.dataset.stp) ? '' : b.dataset.stp;
        A.render();
      };
    });
    if ($('#vdAdd')) $('#vdAdd').onclick = function () {
      var r = A.vendAdd(val('#vdCode'), val('#vdName'), val('#vdStaff'));
      if (!r.ok) { say('#vdMsg', T('vd_need'), false); return; }
      A.render();
      setTimeout(function () { say('#vdMsg', T('vd_added'), true); }, 30);
    };
    $$('[data-vdel]').forEach(function (b) {
      b.onclick = function () { A.vendDel(b.dataset.vdel); A.render(); };
    });
    $$('[data-vsdel]').forEach(function (a) {
      a.onclick = function (e) {
        e.preventDefault();
        A.vendStaffDel(a.dataset.vsdel, a.dataset.s);
        A.render();
      };
    });
  }

  /* 공종 상세 팝오버 — 누르면 뜨고, 마우스를 움직이면 사라진다.
     ★ 닫기 버튼을 두지 않는 이유: 훑어보는 중에 손이 멈추지 않게 하기 위함이다. */
  var dtBox = null, dtAt = null;
  function killDetail() {
    if (!dtBox) return;
    if (dtBox.parentNode) dtBox.parentNode.removeChild(dtBox);
    dtBox = null;
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('scroll', killDetail, true);
  }
  function onMove(ev) {
    if (!dtAt) return;
    var dx = ev.clientX - dtAt.x, dy = ev.clientY - dtAt.y;
    if (dx * dx + dy * dy > 900) killDetail();     // 30px 넘게 움직이면 닫는다
  }
  function bindDetail() {
    $$('[data-detail]').forEach(function (tr) {
      tr.onclick = function (ev) {
        killDetail();
        var html = detailHTML(tr.dataset.detail);
        if (!html) return;
        dtBox = document.createElement('div');
        dtBox.className = 'dt';
        dtBox.innerHTML = html;
        document.body.appendChild(dtBox);
        var w = dtBox.offsetWidth, h = dtBox.offsetHeight;
        var x = Math.min(ev.clientX + 14, window.innerWidth - w - 12);
        var y = Math.min(ev.clientY + 14, window.innerHeight - h - 12);
        dtBox.style.left = Math.max(8, x) + 'px';
        dtBox.style.top = Math.max(8, y) + 'px';
        dtAt = { x: ev.clientX, y: ev.clientY };
        setTimeout(function () {
          document.addEventListener('mousemove', onMove, true);
          document.addEventListener('scroll', killDetail, true);
        }, 60);
      };
    });
  }

  /* ══ 인원·장비 (탭8) ═════════════════════════════════
     ★ 실적과 탭을 나눈 이유: 진행률의 실적은 누계이고 인원·장비는 오늘 것이다.
       한 화면에 있으면 "이 인원이 저 실적을 냈나"로 잘못 읽힌다.
     ★ 장비 상태는 가동/고장 2단계로 본다. 옛 rep(수리) 값은 고장에 합산한다 —
       우리 입장에서 서 있는 건 서 있는 것이고, 사유는 협력업체·정비팀 소관이다. */
  function eqDown(x) { return (+x.brk || 0) + (+x.rep || 0); }

  function resAgg(from, to) {
    var co = {}, eq = {}, pax = 0, run = 0, down = 0, days = {};
    function feed(c, isDir) {
      if (!A.locMatch(c, flt) || !A.inCo(c, isDir)) return;
      if (from && String(c.date) < from) return;
      if (to && String(c.date) > to) return;
      days[c.date] = 1;
      var name = isDir ? T('res_dir') : (c.by || '—');
      var o = co[name] || (co[name] = { name: name, dir: !!isDir, pax: 0, teams: 0, run: 0, down: 0 });
      var p = A.crewTotal(c);
      o.pax += p; o.teams += (+c.teams || 0); pax += p;
      (c.eq || []).forEach(function (x) {
        var k = x.cat + (x.size ? ' ' + x.size : '');
        var g = eq[k] || (eq[k] = { name: k, run: 0, down: 0 });
        var r = +x.run || 0, d = eqDown(x);
        g.run += r; g.down += d; o.run += r; o.down += d; run += r; down += d;
      });
    }
    S.crew.forEach(function (c) { feed(c, false); });
    S.direct.forEach(function (c) { feed(c, true); });   // 직영도 현장 투입이다
    return {
      co: Object.keys(co).map(function (k) { return co[k]; }).sort(function (a, b) { return b.pax - a.pax; }),
      eq: Object.keys(eq).map(function (k) { return eq[k]; }).sort(function (a, b) { return b.down - a.down || b.run - a.run; }),
      pax: pax, run: run, down: down, days: Object.keys(days).length
    };
  }

  function resCoTable(r, cum) {
    if (!r.co.length) return '';
    var u = cum ? ' <span class="sp">' + T('res_md') + '</span>' : '';
    return '<div class="tw"><table><thead><tr><th>' + T('res_co') +
      '</th><th class="r">' + T('u_crew') + '</th><th class="r">' + T('res_pax') +
      '</th><th class="r">' + T('res_run') + '</th><th class="r">' + T('res_brk') +
      '</th></tr></thead><tbody>' +
      r.co.map(function (c) {
        return '<tr><td class="nm">' + esc(c.name) + (c.dir ? ' <span class="bd bd--mute">' + T('res_dir') + '</span>' : '') + '</td>' +
          '<td class="r">' + nf(c.teams) + '</td><td class="r">' + nf(c.pax) + u + '</td>' +
          '<td class="r">' + nf(c.run) + '</td>' +
          '<td class="r' + (c.down ? ' em' : '') + '">' + nf(c.down) + '</td></tr>';
      }).join('') +
      '</tbody><tfoot><tr class="tot"><td>' + T('tot_t') + '</td>' +
      '<td class="r">' + nf(r.co.reduce(function (a, c) { return a + c.teams; }, 0)) + '</td>' +
      '<td class="r">' + nf(r.pax) + '</td><td class="r">' + nf(r.run) + '</td>' +
      '<td class="r' + (r.down ? ' em' : '') + '">' + nf(r.down) + '</td></tr></tfoot></table></div>';
  }

  function resEqTable(r) {
    if (!r.eq.length) return '';
    return '<div class="tw"><table><tbody>' +
      r.eq.map(function (x) {
        return '<tr><td class="nm">' + esc(x.name) + '</td>' +
          '<td class="r">' + nf(x.run) + ' <span class="sp">' + T('res_run') + '</span></td>' +
          '<td class="r' + (x.down ? ' em' : '') + '">' + nf(x.down) + ' <span class="sp">' + T('res_brk') + '</span></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  var cumOpen = false, cumAll = false;

  /* ══ 정비 의뢰 ═══════════════════════════════════════
     ★ 협력업체는 고장 대수만 올린다. 사유는 우리 소관도 아니고 알 수도 없다.
       이라크 스탭이 확인해 '의뢰했는지'만 체크하고, 오래 서 있으면 그때 사유를 적는다.
     ★ 장비 개별 번호가 없으므로 회사+종류+규격 단위로 추적한다. */
  var MT_LONG = 7;   // 이 일수를 넘으면 장기로 본다

  function mtRows() {
    var by = {}, today = A.today();
    S.crew.forEach(function (c) {
      if (!A.hit(c, flt)) return;
      (c.eq || []).forEach(function (x) {
        var d = eqDown(x); if (!d) return;
        var id = (c.by || '—') + '|' + x.cat + '|' + (x.size || '');
        var o = by[id] || (by[id] = { id: id, co: c.by || '—', cat: x.cat, size: x.size || '', n: 0, first: c.date, last: c.date });
        o.n = Math.max(o.n, d);
        if (String(c.date) < String(o.first)) o.first = c.date;
        if (String(c.date) > String(o.last)) o.last = c.date;
      });
    });
    return Object.keys(by).map(function (k) {
      var o = by[k], m = (S.mt || {})[k] || {};
      o.step = A.mtStep(k); o.reqAt = m.reqAt || ''; o.why = m.why || '';
      o.days = Math.round((new Date(today) - new Date(o.first)) / 86400000) + 1;
      o.long = o.days >= MT_LONG;
      return o;
    }).filter(function (o) { return o.step !== 'done' && o.last >= addDays(today, -3); })
      /* ★완료건은 목록에서 내려간다 — 종전에는 체크해도 계속 떠 있었다(v2.15.0) */
      .sort(function (a, b) { return b.days - a.days; });
  }
  function addDays(d, n) {
    var x = new Date(d); x.setDate(x.getDate() + n);
    return x.toISOString().slice(0, 10);
  }

  /* ══ 장비현황 — 지급대조 + 정비의뢰를 하나로 (v2.15.0) ══
     ★ 종전에는 「정비 의뢰」와 「장비 지급대조」가 따로였다.
       같은 장비를 다른 각도로 보던 것이라 합쳤다(사용자 지시).
     ★ 종전 정비의뢰는 체크박스뿐이라 끝나는 지점이 없었다.
       체크해 두면 계속 떠 있었다(사용자 지적).
       → 의뢰→접수→수리중→완료 단계로 바꾸고, 완료건은 목록에서 내린다. */

  var eqOpen = {};                       /* 펼쳐 둔 장비 종류 */

  function mtHTML() {
    if (!A.can('recon')) return '';      /* 업체별 판정이라 스탭에게 감춘다 */
    var st = A.eqStatus(flt), mt = mtRows();
    var mtBy = {};
    mt.forEach(function (o) { (mtBy[o.cat] = mtBy[o.cat] || []).push(o); });

    var tot = { given: 0, run: 0, down: 0, mt: 0 }, anyGiven = 0;
    st.forEach(function (o) {
      if (o.given != null) { tot.given += o.given; anyGiven = 1; }
      tot.run += o.run; tot.down += o.brk + o.rep; tot.mt += o.mt;
    });

    var body = st.map(function (o) {
      var down = o.brk + o.rep, op = !!eqOpen[o.cat];
      var rows = '<tr class="gr' + (op ? ' gr--on' : '') + '" data-eqo="' + esc(o.cat) + '">' +
        '<td><span class="gr__c">' + (op ? '▾' : '▸') + '</span> ' +
        '<span class="ab">' + esc(o.abbr) + '</span> <span class="nm">' + esc(o.cat) + '</span></td>' +
        '<td class="r sp">' + (o.given == null ? '—' : nf(o.given)) + '</td>' +
        '<td class="r em">' + nf(o.run) + '</td>' +
        '<td class="r' + (down ? ' em' : '') + '">' + (down ? nf(down) : '·') + '</td>' +
        '<td class="r">' + (o.mt ? '<span class="bd bd--o">' + nf(o.mt) + '</span>' : '·') + '</td></tr>';
      if (!op) return rows;

      /* 규격별 상세 */
      o.rows.forEach(function (r) {
        var d2 = r.brk + r.rep;
        rows += '<tr class="sub"><td class="ind sp">' + esc(r.size || '—') + '</td>' +
          '<td class="r sp">' + (r.given == null ? '—' : nf(r.given)) + '</td>' +
          '<td class="r">' + nf(r.run) + '</td>' +
          '<td class="r' + (d2 ? ' em' : '') + '">' + (d2 ? nf(d2) : '·') + '</td>' +
          '<td class="r sp">' + (r.idle == null ? '—' : T('e_idle') + ' ' + nf(r.idle)) + '</td></tr>';
      });
      /* 이 종류의 정비 건 — 업체·경과일·단계 */
      (mtBy[o.cat] || []).forEach(function (m) {
        rows += '<tr class="sub"><td class="ind" colspan="2">' +
          '<span class="sp">' + esc(m.co) + ' · ' + esc(m.size || '—') + ' · ' +
          nf(m.n) + T('u_unitq') + ' · ' + esc(m.first) + ' · ' + nf(m.days) + T('mt_days') + '</span>' +
          (m.long ? ' <span class="bd bd--d">' + T('mt_long') + '</span>' : '') +
          (m.long && m.step && m.step !== 'done'
            ? '<input class="in" style="margin-top:6px" data-mtwhy="' + esc(m.id) + '" value="' + esc(m.why) + '" placeholder="' + T('mt_why') + '">'
            : '') + '</td>' +
          '<td colspan="3"><select class="in" data-mtstep="' + esc(m.id) + '">' +
          '<option value="">' + T('mt_none_s') + '</option>' +
          A.MT_STEPS.map(function (s2) {
            return '<option value="' + s2 + '"' + (m.step === s2 ? ' selected' : '') + '>' + T('mt_' + s2) + '</option>';
          }).join('') + '</select></td></tr>';
      });
      return rows;
    }).join('');

    var note = anyGiven ? '' : '<div class="hint" style="margin-top:8px">' + T('h_nogiven') + '</div>';

    return '<div style="margin-bottom:16px">' + card(T('eq_st'),
      T('eq_st_n'),
      (st.length
        ? '<div class="tw"><table><thead><tr><th>' + T('eqcat') + '</th>' +
          '<th class="r">' + T('e_given') + '</th><th class="r">' + T('run') + '</th>' +
          '<th class="r">' + T('brk') + '</th><th class="r">' + T('mt_t') + '</th>' +
          '</tr></thead><tbody>' + body +
          '</tbody><tfoot><tr class="tot"><td>' + T('tot_t') + '</td>' +
          '<td class="r">' + (anyGiven ? nf(tot.given) : '—') + '</td>' +
          '<td class="r">' + nf(tot.run) + '</td>' +
          '<td class="r' + (tot.down ? ' em' : '') + '">' + nf(tot.down) + '</td>' +
          '<td class="r">' + nf(tot.mt) + '</td></tr></tfoot></table></div>' + note
        : empty(T('z_norecon'), T('z_norecon_n'))) +
      '<div class="f-row" style="margin-top:14px">' +
      fld(T('e_upload'), fileIn('isFile', '.csv,.xlsx,.xls')) +
      fld('&nbsp;', '<div class="btns"><button class="btn btn--g btn--sm" id="isTpl">' + T('tpl') + '</button>' +
        (S.issue.length ? '<button class="btn btn--d btn--sm" id="isClr">' + T('h_clrgiven') + '</button>' : '') + '</div>') +
      '</div><div class="hint" id="isMsg"></div>', 'flush') + '</div>';
  }

  /* ★조회 기준(A.dateFlt)을 따른다. v2.15.0 초판에서 여기만 A.today()로
     고정돼 있어, 위 집계는 가동 15대인데 이 카드는 0대로 나왔다(사용자 지적). */
  function todayHTML() {
    var t = resAgg(A.dateFlt.from, A.dateFlt.to);
    var lb = A.dateFlt.from || A.dateFlt.to
      ? (A.dateFlt.from === A.dateFlt.to ? A.dateFlt.from
         : (A.dateFlt.from || '…') + ' ~ ' + (A.dateFlt.to || '…'))
      : T('qb_all');
    var h = '<div class="grid g3" style="margin-bottom:16px">' +
      kpi('kpi--lead', T('res_pax'), nf(t.pax), T('u_pax'), esc(lb)) +
      kpi('', T('res_run'), nf(t.run), T('u_unitq'), '') +
      kpi(t.down ? 'kpi--warn' : '', T('res_brk'), nf(t.down), T('u_unitq'), '') +
      '</div>';

    if (!t.co.length && !t.eq.length) {
      h += '<div class="empty">' + T('res_none') + '</div>';
    } else {
      h += '<div style="margin-bottom:16px">' + card(T('res_co'), T('res_n'), resCoTable(t, false)) + '</div>';
      if (t.eq.length) h += '<div style="margin-bottom:16px">' + card(T('equip'), '', resEqTable(t)) + '</div>';
    }

    return h;
  }

  /* 누계 — 매일 보는 건 오늘 것이므로 접어 둔다 */
  function cumCard() {
    return '<div style="margin-bottom:16px">' + card(T('res_cum'), '',
      '<div class="btns"><button class="btn btn--g btn--sm" id="cumTgl">' +
      (cumOpen ? T('dt_close') : T('res_open')) + '</button>' +
      (cumOpen ? '<button class="btn btn--g btn--sm" id="cumMode">' +
        (cumAll ? T('res_all') : T('res_mon')) + '</button>' : '') + '</div>' +
      (cumOpen ? cumHTML() : '')) + '</div>';
  }

  function cumHTML() {
    var from = '', to = '';
    if (!cumAll) { var d = A.today(); from = d.slice(0, 8) + '01'; to = d; }
    var r = resAgg(from, to);
    if (!r.co.length) return '<div class="empty">' + T('res_none') + '</div>';
    return '<div class="hint" style="margin:10px 0">' +
      (cumAll ? T('res_all') : T('res_mon')) + ' · ' + nf(r.days) + T('u_day') +
      ' · ' + nf(r.pax) + ' ' + T('res_md') + ' · ' + nf(r.run) + ' ' + T('res_ed') + '</div>' +
      resCoTable(r, true) + (r.eq.length ? '<div class="dt__l" style="margin-top:14px">' + T('equip') + '</div>' + resEqTable(r) : '');
  }

  /* ══ 로그인 ══════════════════════════════════════════
     비밀번호로 스탭/관리자를 가른다. 화면은 하나이고 보이는 것만 달라진다. */
  function loginHTML() {
    return '<div class="lg"><div class="lg__t">' + T('lg_t') + '</div>' +
      '<div class="lg__n">' + T('lg_n') + '</div>' +
      '<input class="in" id="lgPw" type="password" autocomplete="current-password">' +
      '<button class="btn btn--o" id="lgGo">' + T('lg_in') + '</button>' +
      '<div class="lg__m" id="lgMsg"></div></div>';
  }
  function bindLogin() {
    var go = $('#lgGo'), pw = $('#lgPw'), msg = $('#lgMsg');
    if (!go) return;
    function tryIn() {
      if (!pw.value) return;
      go.disabled = true; msg.textContent = T('lg_wait');
      var api = window.BNCP_API;
      if (!api || !api.login) { msg.textContent = T('lg_off'); go.disabled = false; return; }
      api.login(pw.value).then(function (r) {
        go.disabled = false;
        if (r && r.ok && r.role) { A.setRole(r.role); A.render(); return; }
        msg.textContent = r && r.err === 'offline' ? T('lg_off') : T('lg_bad');
        pw.value = '';
      });
    }
    go.onclick = tryIn;
    pw.onkeydown = function (e) { if (e.key === 'Enter') tryIn(); };
    pw.focus();
  }

  /* ══ 조회 기준 줄 (v2.15.0) ══════════════════════════
     탭1 전체가 이 날짜를 따른다. 종전에는 '오늘'로 고정돼 있어
     지난 날짜를 볼 방법이 없었다(사용자 지시). */
  function qbarHTML() {
    var d = A.dateFlt;
    var cos = {}, list = [];
    S.crew.forEach(function (c) { if (c.st === 'ok' && A.locMatch(c, flt) && A.inDate(c) && c.by) cos[c.by] = 1; });
    Object.keys(cos).forEach(function (k) { list.push(k); });
    list.sort();
    return '<div style="margin-bottom:16px">' + card(T('qb_t'), T('qb_n'),
      '<div class="f-row">' +
      fld(T('qb_from'), '<input class="in" type="date" id="qbFrom" value="' + esc(d.from) + '">') +
      fld(T('qb_to'), '<input class="in" type="date" id="qbTo" value="' + esc(d.to) + '">') +
      fld('&nbsp;', '<div class="btns">' +
        '<button class="btn btn--g btn--sm" id="qbPrev">◀</button>' +
        '<button class="btn btn--g btn--sm" id="qbToday">' + T('qb_today') + '</button>' +
        '<button class="btn btn--g btn--sm" id="qbNext">▶</button>' +
        '<button class="btn btn--g btn--sm" id="qbAll">' + T('qb_all') + '</button></div>') +
      '</div>' +
      '<div class="chips" style="margin-top:12px">' +
      '<button class="chip' + (A.coFlt ? '' : ' chip--on') + '" data-co="">' + T('qb_allco') + '</button>' +
      '<button class="chip' + (A.coFlt === '@dir' ? ' chip--on' : '') + '" data-co="@dir">' + T('res_dir') + '</button>' +
      list.map(function (n) {
        return '<button class="chip' + (A.coFlt === n ? ' chip--on' : '') + '" data-co="' + esc(n) + '">' + esc(n) + '</button>';
      }).join('') + '</div>') + '</div>';
  }
  function qbarBind() {
    function setD(f, t) { A.dateFlt.from = f; A.dateFlt.to = t; A.render(); }
    if ($('#qbFrom')) $('#qbFrom').onchange = function () { setD(this.value, A.dateFlt.to); };
    if ($('#qbTo')) $('#qbTo').onchange = function () { setD(A.dateFlt.from, this.value); };
    if ($('#qbToday')) $('#qbToday').onclick = function () { setD(A.today(), A.today()); };
    if ($('#qbAll')) $('#qbAll').onclick = function () { setD('', ''); };
    function shift(n) {
      var base = A.dateFlt.from || A.today();
      var d = new Date(base); d.setDate(d.getDate() + n);
      var s = d.toISOString().slice(0, 10);
      setD(s, s);
    }
    if ($('#qbPrev')) $('#qbPrev').onclick = function () { shift(-1); };
    if ($('#qbNext')) $('#qbNext').onclick = function () { shift(1); };
    $$('[data-co]').forEach(function (b) {
      b.onclick = function () { A.coFlt = b.dataset.co; A.render(); };
    });
    $$('[data-ro]').forEach(function (r) {
      r.onclick = function () {
        roOpen[r.dataset.ro] = !roOpen[r.dataset.ro];
        A.render();
      };
    });
  }

  function v1() {
    var w = A.warn(flt), rows = A.progressRows(flt), avg = A.avgRate(flt);
    var h = '';
    if (w.noPlan) h += '<div class="alert alert--o"><b>' + T('plan_none') + '</b>' +
      '<span class="sp">' + T('h_noplan') + '</span></div>';
    if (w.eqOver) h += '<div class="alert alert--d"><b>' + T('w_eqover_n') + ' ' + nf(w.eqOver) + T('u_kind') + '</b>' +
      '<span class="sp">' + T('h_seerecon') + '</span></div>';

    h += '<div class="grid g4" style="margin-bottom:16px">' +
      kpi('kpi--lead', T('k_rate'), avg == null ? '—' : pf(avg).replace('%', ''), avg == null ? '' : '%',
        T('k_rate_n') + ' · ' + nf(A.hasPlan(flt)) + T('u_ea'), avg || 0) +
      kpi(w.pendWork + w.pendCrew ? 'kpi--warn' : '', T('k_pend'), nf(w.pendWork + w.pendCrew), T('u_case'),
        T('c_act') + ' ' + nf(w.pendWork) + ' · ' + T('blk_crew') + ' ' + nf(w.pendCrew)) +
      kpi(w.repLong ? 'kpi--warn' : '', T('e_long'), nf(w.repLong), T('u_kind'),
        A.LONG + T('h_brklong')) +
      kpi(w.short ? 'kpi--warn' : '', T('k_short'), nf(w.short), T('u_item'), T('h_shortiss')) +
      '</div>';

    /* 조회 기준 — 날짜·업체. 탭1 전체가 이걸 따른다 (v2.15.0) */
    h += qbarHTML();

    /* ★설계수량·협력업체 명부·서버 동기화는 맨 아래로 내렸다 (v2.15.4).
       한 번 올리고 나면 쓸 일이 드문데 화면 위를 크게 차지하고 있었다(사용자 지시).
       매일 보는 것(확인대기·진행률·집계)이 먼저 와야 한다. */

    /* 내역서에서 코드를 못 붙인 줄 — 이건 손봐야 하는 것이라 위에 남긴다 */
    h += boqNeedHTML();

    h += chkHTML();

    /* 확인 대기 */
    var pw = A.pendWork(flt), pc = A.pendCrew(flt);
    if (pw.length || pc.length) h += '<div style="margin-bottom:16px">' +
      card(T('pend'), nf(pw.length + pc.length) + T('u_case') + ' — ' + T('h_forprog'),
        '<div class="tw"><table><thead><tr><th>' + T('th_kind') + '</th><th>' + T('date') + '</th><th>' + T('loc') + '</th>' +
        '<th>' + T('work') + '</th><th class="r">' + T('th_body') + '</th><th>' + T('by') + '</th><th class="noprint"></th></tr></thead><tbody>' +
        pw.map(function (x) {
          return '<tr><td><span class="bd bd--k">' + T('blk_work') + '</span></td><td class="sp">' + esc(x.date) + '</td>' +
            '<td class="code">' + esc(A.locLabel(x.loc)) + '</td><td>' + itemLine(x.key, x.spot) + '</td>' +
            '<td class="r">' + nf(x.qty, 2) + ' <span class="sp">' + esc(A.trU((A.item(x.key) || {}).unit || '')) + '</span></td>' +
            '<td class="sp">' + esc(x.by || '') + '</td>' +
            '<td class="c noprint"><button class="btn btn--o btn--sm" data-ok="w" data-id="' + esc(x.id) + '">' + T('confirm') + '</button> ' +
            '<button class="btn btn--g btn--sm" data-rc="' + esc(x.id) + '">' + T('rc_ask') + '</button> ' +
            '<button class="btn btn--g btn--sm" data-del="w" data-id="' + esc(x.id) + '">' + T('del') + '</button></td></tr>';
        }).join('') +
        pc.map(function (x) {
          return '<tr><td><span class="bd bd--o">' + T('blk_crew') + '</span></td><td class="sp">' + esc(x.date) + '</td>' +
            '<td class="code">' + esc(A.locLabel(x.loc)) + '</td><td>' + itemLine(x.key, x.spot) + '</td>' +
            '<td class="r sp">' + nf(x.teams) + T('u_crew') + ' · ' + nf(A.pplSum(x.ppl)) + T('u_pax') + ' · ' + T('equip') + ' ' + nf(A.eqSum(x.eq, 'run')) + T('u_unitq') + '</td>' +
            '<td class="sp">' + esc(x.by || '') + '</td>' +
            '<td class="c noprint"><button class="btn btn--o btn--sm" data-ok="c" data-id="' + esc(x.id) + '">' + T('confirm') + '</button> ' +
            '<button class="btn btn--g btn--sm" data-del="c" data-id="' + esc(x.id) + '">' + T('del') + '</button></td></tr>';
        }).join('') + '</tbody></table></div>', 'flush') + '</div>';

    /* 재확인 요청 중 — 업체 답이 올 때까지 남는다 (v2.15.0) */
    var rcs = A.rechecks(flt);
    if (rcs.length) h += '<div style="margin-bottom:16px">' +
      card(T('rc_t'), nf(rcs.length) + T('u_case') + ' — ' + T('rc_n'),
        '<div class="tw"><table><thead><tr><th>' + T('date') + '</th><th>' + T('loc') + '</th>' +
        '<th>' + T('work') + '</th><th class="r">' + T('th_body') + '</th>' +
        '<th>' + T('rc_why') + '</th><th>' + T('by') + '</th><th class="noprint"></th></tr></thead><tbody>' +
        rcs.map(function (x) {
          return '<tr><td class="sp">' + esc(x.date) + '</td>' +
            '<td class="code">' + esc(A.locLabel(x.loc)) + '</td>' +
            '<td>' + itemLine(x.key, x.spot) + '</td>' +
            '<td class="r">' + nf(x.qty, 2) + ' <span class="sp">' + esc(A.trU((A.item(x.key) || {}).unit || '')) + '</span></td>' +
            '<td><span class="bd bd--o">' + esc(T('rcw_' + (x.rcWhy || 'etc'))) + '</span> ' +
            '<span class="sp">' + esc(x.rcAt || '') + '</span></td>' +
            '<td class="sp">' + esc(x.by || '') + '</td>' +
            '<td class="c noprint"><button class="btn btn--o btn--sm" data-ok="w" data-id="' + esc(x.id) + '">' + T('confirm') + '</button></td></tr>';
        }).join('') + '</tbody></table></div>', 'flush') + '</div>';

    /* 진행률 · 생산성 */
    h += '<div class="grid g-11" style="margin-bottom:16px">' +
      card(T('progress'), esc(fltLabel()),
        rows.length ? progTable(rows) : empty(T('z_norate'), T('z_norate_n')),
        'flush', '<button class="btn btn--g btn--sm noprint" id="pgCsv">' + T('csv') + '</button>') +
      (A.can('prod')
        ? card(T('prod'), T('h_prod'),
            (function () { var p = A.prodRows(flt); return p.length ? prodTable(p) : empty(T('z_none'), T('z_prod_n')); })(),
            'flush')
        : '') + '</div>';

    /* 공종별 집계 — 작업량 / 인원 / 장비 세 구획으로 나눈다.
       ★ 한 표에 다 넣으면 열이 10개를 넘어 눈이 못 따라간다(사용자 지시). */
    var ru = A.rollup(flt);
    if (!ru.length) {
      h += '<div style="margin-bottom:16px">' + card(T('rollup'), T('h_roll'),
        empty(T('z_noconf'), ''), 'flush') + '</div>';
    } else {
      h += '<div style="margin-bottom:16px">' + card(T('ro_out'), T('ro_n_out'),
        rollOut(ru), 'flush',
        '<button class="btn btn--g btn--sm noprint" id="ruCsv">' + T('csv') + '</button>') + '</div>';
      h += '<div style="margin-bottom:16px">' + card(T('ro_ppl'), T('ro_n_ppl'),
        rollPpl(ru), 'flush') + '</div>';
      h += '<div style="margin-bottom:16px">' + card(T('ro_eq'), T('ro_n_eq'),
        rollEq(ru), 'flush') + '</div>';
    }

    /* 오늘 투입 · 정비 의뢰 · 누계 — 탭8을 없애고 여기로 합쳤다(v2.13.0) */
    h += todayHTML();
    h += mtHTML();
    h += cumCard();

    /* 준비 — 자주 쓰지 않는 것은 맨 아래 버튼으로 (v2.15.4) */
    h += setupHTML();

    return h;
  }

  /* ★ v2.15.2 — 진행률도 대분류로 접는다.
       v2.15.0에서 작업량·인원·장비만 손보고 여기를 빠뜨렸다(사용자 지적).
       공종이 1,000개 가까이 되므로 펼쳐 두면 아무것도 안 보인다.
     ★ 합계 행에 실적·설계 수량은 넣지 않는다 — 공종마다 단위가 달라(m3/m/m2/ea)
       더한 값이 아무 의미가 없다. 공종 수와 진행률 평균만 낸다. */
  function progTable(rows) {
    var gs = [], seen = {};
    rows.forEach(function (r) {
      var g = r.e.grp;
      if (!seen[g]) { seen[g] = { grp: g, rows: [] }; gs.push(seen[g]); }
      seen[g].rows.push(r);
    });

    var hasPlan = 0, done = 0, sum = 0;
    rows.forEach(function (r) {
      if (r.plan) hasPlan++;
      if (r.rate != null) { sum += r.rate; done++; }
    });
    var avg = done ? sum / done : null;

    var body = '';
    gs.forEach(function (G) {
      var gp = 0, gd = 0, gs2 = 0;
      G.rows.forEach(function (r) {
        if (r.plan) gp++;
        if (r.rate != null) { gs2 += r.rate; gd++; }
      });
      var ga = gd ? gs2 / gd : null;
      var op = roIsOpen('prog', G.grp);
      body += '<tr class="gr' + (op ? ' gr--on' : '') + '" data-ro="' + esc(roKey('prog', G.grp)) + '">' +
        '<td><span class="gr__c">' + (op ? '▾' : '▸') + '</span> <b>' + esc(A.trW(G.grp)) + '</b>' +
        ' <span class="sp">' + T('u_nwork').replace('{n}', nf(G.rows.length)) + '</span></td>' +
        '<td class="r sp">' + nf(gp) + T('u_ea') + '</td>' +
        '<td class="r sp">—</td><td class="r sp">—</td>' +
        '<td class="r">' + (ga == null ? '—' : '<span class="em">' + pf(ga) + '</span>') + '</td></tr>';
      if (!op) return;
      G.rows.slice().sort(function (a, b) {
        var ar = a.rate == null ? -1 : a.rate, br = b.rate == null ? -1 : b.rate; return ar - br;
      }).forEach(function (r) {
        var e = r.e, rt = r.rate;
        body += '<tr class="prow sub" data-detail="' + esc(e.key) + '">' +
          '<td class="ind"><span class="code">' + esc(e.code || A.trW(e.grp)) + '</span> ' + itemLine(e.key) + '</td>' +
          '<td class="r">' + (r.plan ? nf(r.plan, 1) + ' <span class="sp">' + esc(A.trU(e.unit)) + '</span>' :
            '<span class="bd bd--mute">' + T('noplan') + '</span>') + '</td>' +
          '<td class="r">' + nf(r.act, 1) + '</td><td class="r">' + (r.left == null ? '—' : nf(r.left, 1)) + '</td>' +
          '<td class="r">' + (rt == null ? '—' : '<span class="' + (rt >= 100 ? 'em' : '') + '">' + pf(rt) + '</span>') +
          '</td></tr>';
      });
    });

    return '<div class="tw"><table><thead><tr><th>' + T('work') + '</th><th class="r">' + T('target') +
      '</th><th class="r">' + T('done') + '</th><th class="r">' + T('remain') +
      '</th><th class="r">' + T('rate') + '</th></tr></thead><tbody>' + body +
      '</tbody><tfoot><tr class="tot"><td>' + T('tot_t') +
      ' <span class="sp">' + T('u_nwork').replace('{n}', nf(rows.length)) + ' · ' + T('tot_n') + '</span></td>' +
      '<td class="r sp">' + nf(hasPlan) + T('u_ea') + '</td>' +
      '<td class="r sp">—</td><td class="r sp">—</td>' +
      '<td class="r">' + (avg == null ? '—' : '<span class="em">' + pf(avg) + '</span>') +
      '</td></tr></tfoot></table></div>';
  }

  /* ── 공종 상세 — 행을 누르면 뜨고, 마우스를 움직이면 사라진다 ── */
  function detailHTML(key) {
    var e = A.item(key); if (!e) return '';
    var r = null;
    A.progressRows(flt).forEach(function (x) { if (x.e.key === key) r = x; });
    var acts = S.work.filter(function (w) { return w.key === key && A.locMatch(w, flt); })
      .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, 8);
    var p = A.prod(key, flt);

    var h = '<div class="dt__h">' + esc(A.trW(e.name)) +
      (e.spec ? ' <span class="sp">' + esc(A.trS(e.spec)) + '</span>' : '') +
      (e.code ? ' <span class="code">' + esc(e.code) + '</span>' : '') + '</div>';

    h += '<div class="dt__g">' +
      '<div><b>' + (r && r.plan ? nf(r.plan, 1) : '—') + '</b><span>' + T('target') + ' ' + esc(A.trU(e.unit)) + '</span></div>' +
      '<div><b>' + (r ? nf(r.act, 1) : '—') + '</b><span>' + T('done') + '</span></div>' +
      '<div><b>' + (r && r.left != null ? nf(r.left, 1) : '—') + '</b><span>' + T('remain') + '</span></div>' +
      '<div><b>' + (r && r.rate != null ? pf(r.rate) : '—') + '</b><span>' + T('rate') + '</span></div>' +
      '</div>';

    if (p) h += '<div class="dt__p">' + T('h_percrew') + ' ' + nf(p.perTeam, 1) + ' ' + esc(A.trU(e.unit)) +
      (p.base ? ' <span class="sp">/ ' + T('prod_base') + ' ' + nf(p.base, 1) + '</span>' : '') + '</div>';

    h += '<div class="dt__l">' + T('dt_recent') + '</div>';
    h += acts.length
      ? acts.map(function (w) {
          var sp = w.spot && w.spot.kind === 'road' ? window.BNCP_SPOT.label(w.spot) : '';
          return '<div class="dt__r"><span>' + esc(w.date) + '</span>' +
            '<span class="sp">' + esc(A.locLabel(w.loc)) + (sp ? ' · ' + esc(sp) : '') + '</span>' +
            '<b>' + nf(w.qty, 1) + ' ' + esc(A.trU(e.unit)) + '</b>' +
            '<span class="bd">' + esc(w.st) + '</span></div>';
        }).join('')
      : '<div class="dt__r sp">' + T('dt_noact') + '</div>';
    return h;
  }
  function prodTable(list) {
    return '<div class="tw"><table><thead><tr><th>' + T('work') + '</th><th class="r">' + T('prod_real') +
      T('h_percrew') + '</th><th class="r">' + T('prod_base') + '</th><th class="r">' + T('prod_gap') +
      '</th><th class="r">' + T('th_n') + '</th></tr></thead><tbody>' +
      list.map(function (x) {
        var e = x.e, p = x.p, g = p.gap;
        return '<tr><td>' + itemLine(e.key) + '</td>' +
          '<td class="r em">' + nf(p.perTeam, 2) + ' <span class="sp">' + esc(A.trU(e.unit)) + '</span></td>' +
          '<td class="r">' + (p.base == null ? '<span class="bd bd--mute">' + T('h_unmapped') + '</span>' : nf(p.base, 2)) + '</td>' +
          '<td class="r">' + (g == null ? '—' : '<span class="bd ' + (Math.abs(g) <= 15 ? 'bd--ok' : (g < 0 ? 'bd--d' : 'bd--o')) + '">' +
            (g > 0 ? '+' : '') + pf(g) + '</span>') + '</td>' +
          '<td class="r sp">' + nf(p.n) + T('u_case') + ' / ' + nf(p.days) + T('u_day') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  /* ══ 공종별 집계 — 작업량 / 인원투입 / 장비투입현황 ══════
     ★ v2.15.0에서 대분류로 접었다.
       종전에는 공종(leaf)만 늘어놓아 우수공의 되메우기인지
       오수공의 되메우기인지 구분이 안 됐다(사용자 지적).
       이제 대분류가 접힌 상태가 기본이고, 눌러야 안이 펼쳐진다.
     ★ 막대그래프는 뺐다 — 단위가 다른 공종을 막대로 견주는 것은
       뜻이 없고 복잡하기만 했다(사용자 지시). 숫자와 진행률만 남긴다. */

  var roOpen = {};            /* 펼쳐 둔 대분류 — 화면을 다시 그려도 유지한다 */
  A._roOpen = roOpen;         /* 검사에서 펼침 상태를 만들기 위해 노출 (인수인계서 6-B) */
  function roKey(kind, grp) { return kind + '|' + grp; }
  function roIsOpen(kind, grp) { return !!roOpen[roKey(kind, grp)]; }

  /* 공종(leaf) 묶음을 대분류로 모은다 */
  function byGrp(ru) {
    var o = [], seen = {};
    ru.forEach(function (x) {
      var g = x.e.grp;
      if (!seen[g]) { seen[g] = { grp: g, rows: [] }; o.push(seen[g]); }
      seen[g].rows.push(x);
    });
    return o;
  }
  function roHead(kind, grp, n, right) {
    var op = roIsOpen(kind, grp);
    return '<tr class="gr' + (op ? ' gr--on' : '') + '" data-ro="' + esc(roKey(kind, grp)) + '">' +
      '<td><span class="gr__c">' + (op ? '▾' : '▸') + '</span> <b>' + esc(A.trW(grp)) + '</b>' +
      ' <span class="sp">' + T('u_nwork').replace('{n}', nf(n)) + '</span></td>' + right + '</tr>';
  }

  /* ── 작업량 ── 단위가 달라 합계를 낼 수 없다. 진행률로만 견준다 */
  function rollOut(ru) {
    var gs = byGrp(ru), body = '';
    gs.forEach(function (G) {
      var done = 0, cnt = 0;
      G.rows.forEach(function (x) {
        var pl = A.planQty(x.e.key, flt);
        if (pl) { done += Math.min(100, x.qty / pl * 100); cnt++; }
      });
      var avg = cnt ? done / cnt : null;
      body += roHead('out', G.grp, G.rows.length,
        '<td class="r sp">—</td><td class="r sp">—</td>' +
        '<td class="r">' + (avg == null ? '—' : '<span class="em">' + pf(avg) + '</span>') + '</td>');
      if (!roIsOpen('out', G.grp)) return;
      G.rows.slice().sort(function (a, b) { return b.qty - a.qty; }).forEach(function (x) {
        var plan = A.planQty(x.e.key, flt);
        var rt = plan ? x.qty / plan * 100 : null;
        body += '<tr class="prow sub" data-detail="' + esc(x.e.key) + '">' +
          '<td class="ind">' + itemLine(x.e.key) + '</td>' +
          '<td class="r em">' + nf(x.qty, 1) + ' <span class="sp">' + esc(A.trU(x.e.unit)) + '</span></td>' +
          '<td class="r sp">' + (plan ? nf(plan, 1) : '—') + '</td>' +
          '<td class="r">' + (rt == null ? '<span class="sp">—</span>'
            : '<span class="' + (rt >= 100 ? 'em' : '') + '">' + pf(rt) + '</span>') + '</td></tr>';
      });
    });
    return '<div class="tw"><table><thead><tr><th>' + T('work') + '</th>' +
      '<th class="r">' + T('th_out') + '</th><th class="r">' + T('target') + '</th>' +
      '<th class="r">' + T('rate') + '</th></tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  /* ── 인원투입 ── 대분류별 소계를 먼저 보이고, 펼치면 공종별로 */
  function rollPpl(ru) {
    var gs = byGrp(ru), body = '';
    var tot = { teams: 0, pplT: 0, opr: 0 };
    A.JOBS.forEach(function (j) { tot[j.id] = 0; });

    gs.forEach(function (G) {
      var s = { teams: 0, pplT: 0, opr: 0 };
      A.JOBS.forEach(function (j) { s[j.id] = 0; });
      G.rows.forEach(function (x) {
        s.teams += x.teams; s.pplT += x.pplT; s.opr += x.opr;
        A.JOBS.forEach(function (j) { s[j.id] += (x.ppl[j.id] || 0); });
      });
      tot.teams += s.teams; tot.pplT += s.pplT; tot.opr += s.opr;
      A.JOBS.forEach(function (j) { tot[j.id] += s[j.id]; });

      body += roHead('ppl', G.grp, G.rows.length,
        '<td class="r">' + nf(s.teams) + '</td>' +
        A.JOBS.map(function (j) { return '<td class="r">' + (s[j.id] ? nf(s[j.id]) : '·') + '</td>'; }).join('') +
        '<td class="r">' + (s.opr ? nf(s.opr) : '·') + '</td>' +
        '<td class="r em">' + nf(s.pplT) + '</td>');
      if (!roIsOpen('ppl', G.grp)) return;
      G.rows.slice().sort(function (a, b) { return b.pplT - a.pplT; }).forEach(function (x) {
        body += '<tr class="sub"><td class="ind">' + itemLine(x.e.key) + '</td>' +
          '<td class="r">' + nf(x.teams) + '</td>' +
          A.JOBS.map(function (j) { return '<td class="r">' + (x.ppl[j.id] ? nf(x.ppl[j.id]) : '·') + '</td>'; }).join('') +
          '<td class="r">' + (x.opr ? nf(x.opr) : '·') + '</td>' +
          '<td class="r">' + nf(x.pplT) + '</td></tr>';
      });
    });

    return '<div class="tw"><table><thead><tr><th>' + T('work') + '</th>' +
      '<th class="r">' + T('u_crew') + '</th>' +
      A.JOBS.map(function (j) { return '<th class="r">' + esc(LJ(j)) + '</th>'; }).join('') +
      '<th class="r">' + T('opr_auto') + '</th><th class="r">' + T('th_pplt') + '</th>' +
      '</tr></thead><tbody>' + body +
      '</tbody><tfoot><tr class="tot"><td>' + T('tot_t') + '</td>' +
      '<td class="r">' + nf(tot.teams) + '</td>' +
      A.JOBS.map(function (j) { return '<td class="r">' + nf(tot[j.id]) + '</td>'; }).join('') +
      '<td class="r">' + nf(tot.opr) + '</td><td class="r">' + nf(tot.pplT) + '</td>' +
      '</tr></tfoot></table></div>';
  }

  /* ── 장비투입현황 ── 대분류별로 약어 요약. 펼치면 규격까지
     ★ 한 대가 하루에 여러 공종을 돌면 공종별로 각각 세어진다.
       그래서 여기 숫자는 '연대수'다. 실대수는 장비현황 카드를 본다. */
  function rollEq(ru) {
    var gs = byGrp(ru), body = '';
    if (!ru.length) return empty(T('z_none'), '');

    gs.forEach(function (G) {
      var by = {}, run = 0, down = 0;
      G.rows.forEach(function (x) {
        Object.keys(x.eq).forEach(function (k) {
          var q = x.eq[k];
          var o = by[q.cat] || (by[q.cat] = { cat: q.cat, abbr: A.eqAbbr(q.cat), run: 0, down: 0, sz: {} });
          var d = (+q.brk || 0) + (+q.rep || 0);
          o.run += (+q.run || 0); o.down += d;
          var sk = q.size || '—';
          o.sz[sk] = o.sz[sk] || { size: sk, run: 0, down: 0 };
          o.sz[sk].run += (+q.run || 0); o.sz[sk].down += d;
          run += (+q.run || 0); down += d;
        });
      });
      var list = Object.keys(by).map(function (k) { return by[k]; })
        .sort(function (a, b) { return b.down - a.down || b.run - a.run; });
      if (!list.length) return;

      body += roHead('eq', G.grp, G.rows.length,
        '<td>' + list.map(function (o) {
          return '<span class="ab" title="' + esc(o.cat) + '">' + esc(o.abbr) + ' ' + nf(o.run) +
            (o.down ? '<b class="dn">▾' + nf(o.down) + '</b>' : '') + '</span>';
        }).join(' ') + '</td>' +
        '<td class="r em">' + nf(run) + '</td>' +
        '<td class="r' + (down ? ' em' : '') + '">' + (down ? nf(down) : '·') + '</td>');
      if (!roIsOpen('eq', G.grp)) return;
      list.forEach(function (o) {
        Object.keys(o.sz).forEach(function (k) {
          var z = o.sz[k];
          body += '<tr class="sub"><td class="ind"><span class="ab">' + esc(o.abbr) + '</span> ' +
            '<span class="nm">' + esc(o.cat) + '</span> <span class="sp">' + esc(z.size) + '</span></td>' +
            '<td></td><td class="r">' + nf(z.run) + '</td>' +
            '<td class="r' + (z.down ? ' em' : '') + '">' + (z.down ? nf(z.down) : '·') + '</td></tr>';
        });
      });
    });
    if (!body) return empty(T('z_none'), '');
    return '<div class="tw"><table><thead><tr><th>' + T('work') + '</th>' +
      '<th>' + T('equip') + '</th><th class="r">' + T('run') + '</th>' +
      '<th class="r">' + T('brk') + '</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="hint" style="margin-top:8px">' + T('ro_eq_dup') + '</div>';
  }

  function rollTable(ru) {
    return '<div class="tw"><table><thead><tr><th>' + T('work') + '</th>' +
      '<th class="r">' + T('th_out') + '</th><th class="r">' + T('u_crew') + '</th>' +
      A.JOBS.map(function (j) { return '<th class="r">' + esc(LJ(j)) + '</th>'; }).join('') +
      '<th class="r">' + T('opr_auto') + '</th>' +
      '<th class="r">' + T('th_pplt') + '</th><th>' + T('equip') + '</th></tr></thead><tbody>' +
      ru.map(function (x) {
        var eq = Object.keys(x.eq).map(function (k) { return x.eq[k]; })
          .sort(function (a, b) { return b.run - a.run; });
        return '<tr><td>' + itemLine(x.e.key) + '</td>' +
          '<td class="r em">' + nf(x.qty, 1) + ' <span class="sp">' + esc(A.trU(x.e.unit)) + '</span></td>' +
          '<td class="r">' + nf(x.teams) + '</td>' +
          A.JOBS.map(function (j) { return '<td class="r">' + (x.ppl[j.id] ? nf(x.ppl[j.id]) : '·') + '</td>'; }).join('') +
          '<td class="r">' + (x.opr ? nf(x.opr) : '·') + '</td>' +
          '<td class="r">' + nf(x.pplT) + '</td>' +
          '<td>' + (eq.length ? eq.map(function (q) {
            return '<span class="bd">' + esc(A.eqLabel(q.cat, q.size)) + ' ' + nf(q.run) +
              (q.brk ? ' <b style="color:var(--danger)">' + T('h_brk_s') + nf(q.brk) + '</b>' : '') +
              (q.rep ? ' <b style="color:var(--orange)">' + T('h_rep_s') + nf(q.rep) + '</b>' : '') + '</span> ';
          }).join('') : '<span class="sp">—</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  /* ══ 내역서 확인 필요 목록 (v2.14.0) ═══════════════════
     자동으로 못 붙인 줄만 남는다. 한 번 고르면 별칭에 남아
     다음 공구 파일부터는 손댈 일이 없다. */
  var boqNeed = [], boqLoc = null;

  function boqNeedHTML() {
    if (!boqNeed.length) return '';
    var site = boqLoc ? boqLoc.s : 'civil';
    var all = A.itemsOf(site, '');
    return '<div style="margin-bottom:16px">' + card(T('bq_t'),
      nf(boqNeed.length) + T('u_case') + ' — ' + T('bq_n'),
      '<div class="tw"><table><thead><tr>' +
      '<th>' + T('bq_line') + '</th><th class="r">' + T('th_body') + '</th>' +
      '<th style="min-width:260px">' + T('work') + '</th><th class="noprint"></th>' +
      '</tr></thead><tbody>' +
      boqNeed.map(function (it, i) {
        var cand = (it.cands || []).slice();
        var opt = '<option value="">' + T('pick') + '</option>';
        if (cand.length) {
          opt += '<optgroup label="' + esc(T('bq_cand')) + '">' +
            cand.map(function (c) {
              var e = A.item(c); if (!e) return '';
              return '<option value="' + esc(c) + '">' + esc(c + ' · ' + A.trW(e.name) +
                (e.spec ? ' · ' + A.trS(e.spec) : '') + ' [' + e.unit + ']') + '</option>';
            }).join('') + '</optgroup>';
        }
        opt += '<optgroup label="' + esc(T('bq_allw')) + '">' +
          all.map(function (e) {
            return '<option value="' + esc(e.code || e.key) + '">' +
              esc((e.code ? e.code + ' · ' : '') + A.trW(e.name) +
                  (e.spec ? ' · ' + A.trS(e.spec) : '') + ' [' + e.unit + ']') + '</option>';
          }).join('') + '</optgroup>';
        return '<tr><td><span class="sp">' + esc(it.g) + ' › ' + esc(it.m) + '</span><br>' +
          '<span class="nm">' + esc(it.n) + '</span>' +
          (it.sp ? ' <span class="sp">' + esc(it.sp) + '</span>' : '') + '</td>' +
          '<td class="r em">' + nf(it.q, 1) + ' <span class="sp">' + esc(it.u) + '</span></td>' +
          '<td><select class="in" data-bq="' + i + '">' + opt + '</select></td>' +
          '<td class="c noprint"><button class="btn btn--g btn--sm" data-bqskip="' + i + '">' + T('bq_skip') + '</button></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="btns" style="margin-top:12px">' +
      '<button class="btn" id="bqSave">' + T('save') + '</button>' +
      '<span class="hint">' + T('bq_learn') + '</span></div>', 'flush') + '</div>';
  }

  function bindBoq() {
    $$('[data-bqskip]').forEach(function (b) {
      b.onclick = function () { boqNeed.splice(+b.dataset.bqskip, 1); A.render(); };
    });
    if ($('#bqSave')) $('#bqSave').onclick = function () {
      var left = [], n = 0;
      $$('[data-bq]').forEach(function (sel) {
        var it = boqNeed[+sel.dataset.bq];
        if (!it) return;
        if (sel.value && A.applyBoqPick(it, sel.value, boqLoc)) n++;
        else left.push(it);
      });
      boqNeed = left;
      A.render();
      setTimeout(function () {
        say('#planMsg', T('bq_saved') + ' ' + n + T('u_ea') +
          (left.length ? ' · ' + T('bq_need') + ' ' + left.length + T('u_ea') : ''), n > 0);
      }, 30);
    };
  }

  function facBox() {
    var lk = A.locKey(pkLoc('w'));
    return '<div class="hint" style="margin-bottom:10px">' + T('h_applyloc') + ' <b>' + esc(A.locLabel(pkLoc('w'))) + '</b> (' + T('h_followwork') + ')</div>' +
      A.FACS.map(function (f) {
        var Tb = window.BNCP[f.id]; if (!Tb) return '';
        var cnt = (S.fac[lk] && S.fac[lk][f.id]) || [];
        return '<div style="margin-bottom:14px"><div class="fl">' + esc(f[L()]) + '</div><div class="f-row">' +
          Tb.cols.map(function (c, i) {
            return '<div><label class="fl" style="font-weight:500;color:var(--faint)">' + esc(c) + '</label>' +
              '<input class="in num" type="number" step="any" min="0" data-fac="' + f.id + '" data-ci="' + i + '" value="' + (cnt[i] || '') + '" placeholder="0"></div>';
          }).join('') + '</div></div>';
      }).join('') +
      '<div class="btns"><button class="btn" id="facSave">' + T('save') + '</button>' +
      '<span class="hint">' + T('plan_auto') + '</span></div>';
  }

  /* ══════════════════════════════════════════════════
     탭 2 — 검측
     ══════════════════════════════════════════════════ */
  var IST = { apply: ['i_apply', 'bd'], ready: ['i_ready', 'bd bd--k'], sub: ['i_sub', 'bd bd--k'],
              pass: ['i_pass', 'bd bd--ok'], fail: ['i_fail', 'bd bd--d'], delay: ['i_delay', 'bd bd--o'] };
  function v2() {
    var list = A.inspList(flt);
    var h = '<div class="alert alert--o"><b>' + T('i_rule') + '</b>' +
      '<span class="sp">' + T('h_inspflow') + '</span></div>';

    h += '<div class="grid g4" style="margin-bottom:16px">' +
      ['apply', 'ready', 'pass', 'fail'].map(function (st) {
        var n = list.filter(function (r) { return r.st === st; }).length;
        return kpi(st === 'fail' && n ? 'kpi--warn' : (st === 'pass' ? 'kpi--lead' : ''),
          T(IST[st][0]), nf(n), T('u_case'), '');
      }).join('') + '</div>';

    h += card(T('h_inspq'), nf(list.length) + T('u_case') + ' — ' + T('h_reqvendor'),
        list.length ? inspTable(list) : empty(T('z_noreq'), T('z_fromvendor')), 'flush',
        '<button class="btn btn--g btn--sm noprint" id="iCsv">' + T('csv') + '</button>');
    return h;
  }
  function inspTable(list) {
    var o = { apply: 0, ready: 1, delay: 2, fail: 3, sub: 4, pass: 5 };
    list = list.slice().sort(function (a, b) { return o[a.st] - o[b.st] || (a.date < b.date ? -1 : 1); });
    return '<div class="tw"><table><thead><tr><th>' + T('status') + '</th><th>' + T('date') + '</th>' +
      '<th>' + T('loc') + '</th><th>' + T('work') + '</th><th class="r">' + T('qty') + '</th>' +
      '<th>' + T('reason') + '</th><th class="noprint">' + T('th_act') + '</th></tr></thead><tbody>' +
      list.map(function (r) {
        var st = IST[r.st] || IST.apply;
        return '<tr><td><span class="' + st[1] + '">' + T(st[0]) + '</span>' +
          (r.seq > 1 ? ' <span class="bd bd--mute">' + T('i_seq') + ' ' + r.seq + '</span>' : '') + '</td>' +
          '<td class="sp">' + esc(r.date) + '</td>' +
          '<td class="code">' + esc(A.locLabel(r.loc)) + '</td>' +
          '<td>' + itemLine(r.key, r.spot) + (r.note ? '<br><span class="sp">' + esc(r.note) + '</span>' : '') + '</td>' +
          '<td class="r">' + nf(r.qty, 2) + '</td>' +
          '<td class="sp" style="max-width:220px">' + esc(r.reason || '') + '</td>' +
          '<td class="c noprint">' +
          (r.st === 'apply' ? '<button class="btn btn--o btn--sm" data-iready="' + esc(r.id) + '">' + T('i_ready_do') + '</button> ' : '') +
          '<select class="in btn--sm" data-ist="' + esc(r.id) + '" style="width:auto;padding:3px 6px">' +
          A.INSP_ST.map(function (s) {
            return '<option value="' + s + '"' + (s === r.st ? ' selected' : '') + '>' + T(IST[s][0]) + '</option>';
          }).join('') + '</select>' +
          (r.st === 'fail' ? ' <button class="btn btn--o btn--sm" data-ire="' + esc(r.id) + '">' + T('i_re') + '</button>' : '') +
          ' <button class="btn btn--g btn--sm" data-idel="' + esc(r.id) + '">' + T('del') + '</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ══════════════════════════════════════════════════
     탭 3 — 측량
     ══════════════════════════════════════════════════ */
  function v3() {
    var list = A.survList(flt), open = list.filter(function (r) { return !r.done; });
    var h = '<div class="grid g4" style="margin-bottom:16px">' +
      kpi('', T('total'), nf(list.length), T('u_case'), '') +
      kpi(open.length ? 'kpi--warn' : '', T('s_open'), nf(open.length), T('u_case'), '') +
      kpi('kpi--lead', T('s_done'), nf(list.length - open.length), T('u_case'), '') +
      kpi('', T('h_oldest'), open.length ? nf(Math.max.apply(null, open.map(function (r) { return A.dayGap(r.date); }))) : '—',
        open.length ? T('u_day') : '', '') + '</div>';

    h += card(T('h_survq'), nf(list.length) + T('u_case') + ' — ' + T('h_reqvendor'),
        list.length ? survTable(list) : empty(T('z_noreq2'), T('z_fromvendor')), 'flush',
        '<button class="btn btn--g btn--sm noprint" id="sCsv">' + T('csv') + '</button>');
    return h;
  }
  function survTable(list) {
    list = list.slice().sort(function (a, b) { return (a.done ? 1 : 0) - (b.done ? 1 : 0) || (a.date < b.date ? -1 : 1); });
    return '<div class="tw"><table><thead><tr><th>' + T('status') + '</th><th>' + T('date') + '</th>' +
      '<th>' + T('loc') + '</th><th>' + T('work') + '</th><th>' + T('reason') + '</th>' +
      '<th class="r">' + T('th_open') + '</th><th class="noprint"></th></tr></thead><tbody>' +
      list.map(function (r) {
        var d = A.dayGap(r.date);
        return '<tr><td><span class="bd ' + (r.done ? 'bd--ok' : 'bd--o') + '">' + T(r.done ? 's_done' : 's_open') + '</span></td>' +
          '<td class="sp">' + esc(r.date) + '</td>' +
          '<td class="code">' + esc(A.locLabel(r.loc)) + '</td>' +
          '<td>' + itemLine(r.key, r.spot) + '</td>' +
          '<td style="max-width:300px">' + esc(r.why || '') + (r.by ? '<br><span class="sp">' + esc(r.by) + '</span>' : '') + '</td>' +
          '<td class="r' + (!r.done && d >= A.LONG ? ' em' : ' sp') + '">' + (r.done ? '—' : d + 'd') + '</td>' +
          '<td class="c noprint"><button class="btn ' + (r.done ? 'btn--g' : 'btn--o') + ' btn--sm" data-sdone="' + esc(r.id) + '">' +
          T(r.done ? 's_open' : 's_done') + '</button> ' +
          '<button class="btn btn--g btn--sm" data-sdel="' + esc(r.id) + '">' + T('del') + '</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ══════════════════════════════════════════════════
     탭 4 — 자재현황
     ══════════════════════════════════════════════════ */
  function v4() {
    var seg = pk('m').mseg || 'store';        // store | plant
    var plant = seg === 'plant';
    var vr = A.mVariance(flt, plant);
    var list = A.mreqList(flt, plant);
    var pend = list.filter(function (r) { return r.st === 'req'; });
    var useMiss = A.mUseMissing(flt).filter(function (r) { return !!r.plant === plant; });
    var h = '';

    if (pend.length) h += '<div class="alert alert--o"><b>' + nf(pend.length) + T('u_case') + ' ' + T('h_apvwait2') + '</b>' +
      '<span class="sp">' + T('h_apvflow') + '</span></div>';
    if (plant && useMiss.length) h += '<div class="alert alert--d"><b>' + nf(useMiss.length) + T('u_case') + ' ' + T('h_usemiss') + '</b>' +
      '<span class="sp">' + T('h_useflow') + '</span></div>';

    // 세그먼트
    h += '<div class="seg noprint" style="margin-bottom:16px">' +
      '<button data-mseg="store" aria-pressed="' + (!plant) + '">' + T('m_store') + '</button>' +
      '<button data-mseg="plant" aria-pressed="' + plant + '">' + T('m_plant') + '</button></div>';

    // KPI
    var issSum = vr.reduce(function (a, x) { return a + x.iss; }, 0);
    var overShort = vr.filter(function (x) { return x.gapIss != null && x.gapIss < -0.0001; }).length;
    h += '<div class="grid g4" style="margin-bottom:16px">' +
      kpi('', T('m_design') + ' ' + T('u_item'), nf(vr.filter(function (x) { return x.design > 0; }).length), T('u_item'), esc(fltLabel())) +
      kpi(pend.length ? 'kpi--warn' : '', T('m_req'), nf(list.length), T('u_case'), T('h_apvwait') + ' ' + nf(pend.length)) +
      kpi('', T('m_iss'), nf(list.filter(function (r) { return r.st === 'iss'; }).length), T('u_case'), '') +
      kpi(overShort ? 'kpi--warn' : '', T('m_gap'), nf(overShort), T('u_item'), T('h_issless')) +
      '</div>';

    // 설계수량 업로드 (관리자)
    if (A.can('stock'))
    h += '<div style="margin-bottom:16px">' + card(T('m_design'), T('m_civil') + ' / ' + T('m_anc') + ' ' + T('h_sepupload'),
        '<div class="f-row">' +
        fld(T('m_civil'), fileIn('dsCivil', '.csv,.xlsx,.xls')) +
        fld(T('m_anc'), fileIn('dsAnc', '.csv,.xlsx,.xls')) +
        fld('&nbsp;', '<div class="btns"><button class="btn btn--g btn--sm" id="dsTplC">' + T('m_civil') + ' ' + T('tpl') + '</button>' +
          '<button class="btn btn--g btn--sm" id="dsTplA">' + T('m_anc') + ' ' + T('tpl') + '</button></div>') + '</div>' +
        '<div class="hint" id="dsMsg" style="margin-top:8px">' + T('h_dsnote') + '</div>') + '</div>';

    // 신청 처리 목록
    h += '<div style="margin-bottom:16px">' + card(T('m_req') + ' — ' + T('m_' + (plant ? 'plant' : 'store')),
      nf(list.length) + T('u_case'),
      list.length ? mreqTable(list, plant) : empty(T('z_noreq'), T('h_reqvendor')), 'flush',
      '<button class="btn btn--g btn--sm noprint" id="mqCsv">' + T('csv') + '</button>') + '</div>';

    // 증감표
    /* 증감(설계 vs 지급 vs 실사용) — 재고가 드러나므로 스탭에게 감춘다.
       ★ 자재가 없다는 사실이 협력업체에 새면 공기 지연 클레임 근거가 된다(사용자 지시).
       스탭은 신청 건의 규격·수량 확인만 하면 되므로 업무에 지장이 없다. */
    if (A.can('stock'))
    h += card(T('m_gap') + ' — ' + T('m_' + (plant ? 'plant' : 'store')), esc(fltLabel()) + ' · ' + T('h_vsdesign') + (plant ? ' · ' + T('m_use') : ''),
      vr.length ? varTable(vr, plant) : empty(T('z_nothing'), T('z_nothing_n')),
      'flush', '<button class="btn btn--g btn--sm noprint" id="vrCsv">' + T('csv') + '</button>');

    return h;
  }

  /* 자재 선택기 (공사구분→위치→대분류→세부공종→자재) */
  function pkMatBox(px) { return '<div id="pkm_' + px + '">' + pkMatHTML(px) + '</div>'; }
  function pkMatHTML(px) {
    var o = pk(px), plant = (o.mseg === 'plant');
    var site = o.s || flt.s;
    var locSel = site === 'civil'
      ? bfld('loc', '<select class="in" data-pkm="' + px + '" data-f="p">' +
          opts(A.PHASES, o.p || 1, null, function (x) { return 'Phase ' + x; }) + '</select>' +
          '<select class="in" data-pkm="' + px + '" data-f="c" style="margin-top:6px">' +
          opts(A.SECTORS, o.c || 1, null, function (x) { return 'Phase ' + (o.p || 1) + '-' + x; }) + '</select>')
      : bfld('loc', '<select class="in" data-pkm="' + px + '" data-f="t">' +
          opts(A.TOWNS, o.t || 'A', function (x) { return x.t; }, function (x) { return 'Town ' + x.t; }) + '</select>' +
          '<select class="in" data-pkm="' + px + '" data-f="b" style="margin-top:6px">' +
          opts(A.townBlocks(o.t || 'A'), o.b || 1, null, function (x) { return 'Block ' + x; }) + '</select>');

    var grps = A.matGroups();
    var subs = o.mgrp ? A.matSubs(o.mgrp) : [];
    var mats = (o.mgrp && o.msub) ? A.matItems(o.mgrp, o.msub).filter(function (m) { return !!m.plant === plant; }) : [];
    return '<div class="f-row">' +
      bfld('site', '<select class="in" data-pkm="' + px + '" data-f="s">' +
        opts(A.SITES, site, function (x) { return x.id; }, function (x) { return x.en; }) + '</select>') +
      locSel + '</div>' +
      '<div class="f-row" style="margin-top:12px">' +
      bfld('grp', '<select class="in" data-pkm="' + px + '" data-f="mgrp"><option value="">' + T('pick') + '</option>' +
        opts(grps, o.mgrp, null, function (x) { return x; }) + '</select>') +
      bfld('sub', '<select class="in" data-pkm="' + px + '" data-f="msub"' + (subs.length ? '' : ' disabled') + '>' +
        '<option value="">' + T('pick') + '</option>' + opts(subs, o.msub) + '</select>') +
      '</div>' +
      '<div style="margin-top:12px">' + bfld('m_mat', '<select class="in" data-pkm="' + px + '" data-f="mmat"' + (mats.length ? '' : ' disabled') + '>' +
        '<option value="">' + T('pick') + '</option>' +
        mats.map(function (m, i) {
          var v = i;
          return '<option value="' + v + '"' + (o.mmat === v ? ' selected' : '') + '>' +
            esc(A.trM(m.mat) + (m.spec ? ' · ' + A.trS(m.spec) : '') + '  [' + m.unit + ']') + '</option>';
        }).join('') + '</select>') + '</div>' +
      (mats.length && o.mmat !== '' && o.mmat != null && mats[o.mmat]
        ? '<div class="hint">' + (mats[o.mmat].plant ? '<span class="bd bd--o">' + T('m_plant') + '</span>' : '<span class="bd">' + T('m_store') + '</span>') + '</div>' : '');
  }
  function pkMatGet(px) {
    var o = pk(px), plant = (o.mseg === 'plant');
    if (!o.mgrp || !o.msub || o.mmat === '' || o.mmat == null) return null;
    var mats = A.matItems(o.mgrp, o.msub).filter(function (m) { return !!m.plant === plant; });
    var m = mats[o.mmat]; if (!m) return null;
    var loc = (o.s || flt.s) === 'civil'
      ? { s: 'civil', p: +(o.p || 1), c: +(o.c || 1) } : { s: 'anc', t: o.t || 'A', b: +(o.b || 1) };
    return { loc: loc, grp: m.grp, sub: m.sub, mat: m.mat, spec: m.spec, unit: m.unit, plant: m.plant };
  }

  var MST = { req: ['m_req', 'bd'], apv: ['m_apv', 'bd bd--k'], deny: ['m_deny', 'bd bd--d'],
              plantReq: ['m_plantreq', 'bd bd--o'], iss: ['m_iss', 'bd bd--ok'], noiss: ['m_noiss', 'bd bd--d'] };
  function mreqTable(list, plant) {
    var o = { req: 0, apv: 1, plantReq: 2, deny: 3, noiss: 4, iss: 5 };
    list = list.slice().sort(function (a, b) { return o[a.st] - o[b.st] || (a.date < b.date ? -1 : 1); });
    return '<div class="tw"><table><thead><tr><th>' + T('status') + '</th><th>' + T('date') + '</th>' +
      '<th>' + T('loc') + '</th><th>' + T('m_mat') + '</th><th class="r">' + T('m_req') + '</th>' +
      '<th class="r">' + T('m_iss') + '</th>' + (plant ? '<th class="r">' + T('m_use') + '</th>' : '') +
      '<th>' + T('reason') + '</th><th class="noprint">' + T('th_act') + '</th></tr></thead><tbody>' +
      list.map(function (r) {
        var st = MST[r.st] || MST.req;
        var act = '';
        if (r.st === 'req') act = '<button class="btn btn--o btn--sm" data-mapv="' + esc(r.id) + '">' + T('m_apv') + '</button> ' +
          (A.can('deny') ? '<button class="btn btn--d btn--sm" data-mdeny="' + esc(r.id) + '">' + T('m_deny') + '</button>' : '');
        else if (r.st === 'apv' && plant) act = '<button class="btn btn--o btn--sm" data-mplant="' + esc(r.id) + '">' + T('m_plantreq') + '</button>';
        else if (r.st === 'apv' || r.st === 'plantReq') act = '<button class="btn btn--o btn--sm" data-miss="' + esc(r.id) + '">' + T('m_iss') + '</button> ' +
          (A.can('deny') ? '<button class="btn btn--d btn--sm" data-mnoiss="' + esc(r.id) + '">' + T('m_noiss') + '</button>' : '');
        else if (r.st === 'iss' && plant) act = '<button class="btn btn--g btn--sm" data-muse="' + esc(r.id) + '">' + T('m_use') + '</button>';
        return '<tr><td><span class="' + st[1] + '">' + T(st[0]) + '</span></td>' +
          '<td class="sp">' + esc(r.date) + '</td><td class="code">' + esc(A.locLabel(r.loc)) + '</td>' +
          '<td><span class="nm">' + esc(A.trM(r.mat)) + '</span>' + (r.spec ? ' <span class="sp">' + esc(A.trS(r.spec)) + '</span>' : '') +
          ' <span class="sp">' + esc(A.trU(r.unit)) + '</span></td>' +
          '<td class="r">' + nf(r.qty, 2) + '</td>' +
          '<td class="r">' + (r.iss == null ? '—' : nf(r.iss, 2)) + '</td>' +
          (plant ? '<td class="r">' + (r.use == null ? (r.st === 'iss' ? '<span class="bd bd--d">' + T('m_useno') + '</span>' : '—') : nf(r.use, 2)) + '</td>' : '') +
          '<td class="sp" style="max-width:180px">' + esc(r.denyWhy || r.noissWhy || '') + '</td>' +
          '<td class="c noprint">' + act + ' <button class="btn btn--g btn--sm" data-mqdel="' + esc(r.id) + '">' + T('del') + '</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function varTable(vr, plant) {
    return '<div class="tw"><table><thead><tr><th>' + T('m_mat') + '</th>' +
      '<th class="r">' + T('m_design') + '</th><th class="r">' + T('m_req') + '</th>' +
      '<th class="r">' + T('m_iss') + '</th>' + (plant ? '<th class="r">' + T('m_use') + '</th>' : '') +
      '<th class="r">' + T('m_gap') + '</th></tr></thead><tbody>' +
      vr.map(function (a) {
        var g = a.gapIss, sh = g != null && g < -0.0001;
        return '<tr><td' + (sh ? ' class="wmark"' : '') + '><span class="nm">' + esc(A.trM(a.mat)) + '</span>' +
          (a.spec ? ' <span class="sp">' + esc(A.trS(a.spec)) + '</span>' : '') + ' <span class="sp">' + esc(A.trU(a.unit)) + '</span>' +
          '<br><span class="sp">' + esc(A.trM(a.grp) + ' · ' + A.trM(a.sub)) + '</span></td>' +
          '<td class="r">' + (a.design ? nf(a.design, 1) : '<span class="bd bd--mute">' + T('noplan') + '</span>') + '</td>' +
          '<td class="r">' + nf(a.req, 1) + '</td><td class="r">' + nf(a.iss, 1) + '</td>' +
          (plant ? '<td class="r">' + (a.use ? nf(a.use, 1) : '·') + '</td>' : '') +
          '<td class="r">' + (g == null ? '—' : '<span class="' + (sh ? 'bd bd--d' : 'bd bd--ok') + '">' +
            (g > 0 ? '+' : '') + nf(g, 1) + '</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ══════════════════════════════════════════════════
     탭 5 — 알림·전파
     ══════════════════════════════════════════════════ */
  function v5() {
    var w = A.warn(flt);
    var h = '<div class="grid g-11" style="margin-bottom:16px">' +
      card(T('h_send'), T('h_msghere'),
        '<div class="f-row">' +
        fld(T('th_type'), '<select class="in" id="nKind"><option value="morning">' + T('n_morning') + '</option>' +
          '<option value="urgent">' + T('n_urgent') + '</option><option value="delay">' + T('n_delay') + '</option></select>') +
        fld(T('n_ch'), '<select class="in" id="nCh"><option value="wa">' + T('n_wa') + '</option>' +
          '<option value="kt">' + T('n_kt') + '</option></select>') + '</div>' +
        '<div style="margin-top:12px">' + fld(T('n_to'), '<input class="in" id="nTo" placeholder="' + T('h_toph') + '">') + '</div>' +
        '<div style="margin-top:12px">' + fld(T('n_body'), '<textarea class="in" id="nBody" rows="8"></textarea>') + '</div>' +
        '<div class="btns" style="margin-top:14px">' +
        '<button class="btn btn--g btn--sm" id="nGen">' + T('h_autotext') + '</button>' +
        '<button class="btn btn--g btn--sm" id="nCopy">' + T('h_copy') + '</button>' +
        '<button class="btn" id="nSend">' + T('n_send') + '</button>' +
        '<span class="hint" id="nMsg"></span></div>',
        T('h_testmode')) +
      card(T('h_openitems'), esc(fltLabel()),
        '<div style="display:grid;gap:8px">' +
        aRow(w.pendWork + w.pendCrew, T('pend'), nf(w.pendWork + w.pendCrew) + T('u_case')) +
        aRow(w.inspFail, T('w_inspfail'), nf(w.inspFail) + T('u_case')) +
        aRow(w.survOpen, T('w_survopen'), nf(w.survOpen) + T('u_case')) +
        aRow(w.repLong, T('h_eqbrk') + ' ' + A.LONG + T('u_day') + ' ' + T('h_ormore'), nf(w.repLong) + T('u_kind')) +
        aRow(w.eqOver, T('w_eqover'), nf(w.eqOver) + T('u_kind')) +
        aRow(w.eqNoRec, T('w_eqnorec'), nf(w.eqNoRec) + T('u_kind')) +
        aRow(w.short, T('h_shortdesign'), nf(w.short) + T('u_item')) +
        aRow(w.useMiss, T('w_usemiss'), nf(w.useMiss) + T('u_case')) +
        aRow(w.noPlan, T('w_noplan'), w.noPlan ? T('w_norate') : T('h_okstate')) +
        '</div>') + '</div>';

    h += card(T('n_log'), nf(S.msg.length) + T('u_case'),
      S.msg.length ? '<div class="tw"><table><thead><tr><th>' + T('th_time') + '</th><th>' + T('th_type') + '</th><th>' + T('n_ch') + '</th>' +
      '<th>' + T('n_to') + '</th><th>' + T('n_body') + '</th><th class="noprint"></th></tr></thead><tbody>' +
      S.msg.slice().reverse().map(function (m) {
        return '<tr><td class="sp">' + esc(m.at.replace('T', ' ').slice(0, 16)) + '</td>' +
          '<td><span class="bd">' + T('n_' + m.kind) + '</span></td>' +
          '<td class="sp">' + T(m.ch === 'wa' ? 'n_wa' : 'n_kt') + '</td>' +
          '<td>' + esc(m.to || '—') + '</td>' +
          '<td class="sp" style="white-space:pre-wrap;max-width:520px">' + esc(m.body) + '</td>' +
          '<td class="c noprint"><button class="btn btn--g btn--sm" data-ndel="' + esc(m.id) + '">' + T('del') + '</button></td></tr>';
      }).join('') + '</tbody></table></div>' : empty(T('z_nosent'), ''), 'flush');
    return h;
  }
  function aRow(on, label, val) {
    return '<div style="display:flex;gap:10px;align-items:center;padding:9px 12px;border:1px solid ' +
      (on ? 'var(--danger)' : 'var(--line)') + ';border-radius:2px;background:' + (on ? 'var(--danger-w)' : 'var(--bg)') + '">' +
      '<span class="bd ' + (on ? 'bd--d' : 'bd--ok') + '">' + (on ? T('h_flagged') : T('h_okstate')) + '</span>' +
      '<span style="flex:1;font-weight:600">' + esc(label) + '</span><span class="sp">' + esc(val) + '</span></div>';
  }
  function genMsg(kind) {
    var w = A.warn(flt), Ls = [], d = new Date().toLocaleDateString('ko-KR');
    if (kind === 'morning') {
      Ls.push('[BNCP ' + A.T('n_morning') + ' ' + d + ' · ' + fltLabel() + ']');
      var rows = A.progressRows(flt).filter(function (r) { return r.left > 0; })
        .sort(function (a, b) { return a.rate - b.rate; }).slice(0, 8);
      if (!rows.length) Ls.push('· ' + T('h_nostock'));
      rows.forEach(function (r) {
        Ls.push('· ' + A.trW(r.e.name) + (r.e.spec ? ' ' + A.trS(r.e.spec) : '') + ' — ' + T('h_left') + ' ' + nf(r.left, 1) + r.e.unit + ' (' + T('h_inprog') + ' ' + pf(r.rate) + ')');
      });
    } else if (kind === 'delay') {
      Ls.push('[BNCP ' + A.T('n_delay') + ' ' + d + ']');
      A.inspList(flt).filter(function (r) { return r.st === 'delay' || r.st === 'fail'; }).forEach(function (r) {
        Ls.push('· ' + T('t2') + ' ' + A.trW((A.item(r.key) || {}).name) + ' — ' + A.T(({delay:'i_delay',fail:'i_fail'})[r.st]) + ' (' + A.locLabel(r.loc) + ') ' + (r.reason || T('h_noreason')));
      });
      A.longRepair(flt).forEach(function (r) {
        Ls.push('· ' + T('equip') + ' ' + A.eqLabel(r.cat, r.size) + ' — ' + r.n + T('h_brklong') + ' (' + A.locLabel(r.loc) + ')');
      });
      if (w.pendWork + w.pendCrew) Ls.push('· ' + T('pend') + ' ' + (w.pendWork + w.pendCrew) + T('u_case'));
      if (Ls.length === 1) Ls.push('· ' + T('h_nolate'));
    } else {
      Ls.push('[BNCP ' + A.T('n_urgent') + ' ' + d + ']');
      A.mVariance(flt).filter(function (x) { return x.gapIss != null && x.gapIss < -0.0001; }).slice(0, 10).forEach(function (r) {
        Ls.push('· ' + A.trM(r.mat) + ' ' + T('h_shortby') + ' ' + nf(Math.abs(r.gapIss), 1) + r.unit + ' (' + T('m_design') + ' ' + nf(r.design, 1) + ' / ' + T('m_iss') + ' ' + nf(r.iss, 1) + ')');
      });
      A.eqRecon(flt).filter(function (r) { return r.flag === 'over'; }).slice(0, 8).forEach(function (r) {
        Ls.push('· ' + T('w_eqover') + ' ' + A.eqLabel(r.cat, r.size) + ' ' + T('h_recorded') + ' ' + r.used + ' / ' + T('m_iss') + ' ' + r.given);
      });
      if (Ls.length === 1) Ls.push('· ' + T('h_nourgent'));
    }
    return Ls.join('\n');
  }

  /* ══════════════════════════════════════════════════
     탭 6 — 공정표
     ══════════════════════════════════════════════════ */
  function v6() {
    /* 자재성 항목(WATER STOP·SLEEVE·SPACER 등)은 구조물 콘크리트에 딸려 들어가는 것이라
       별도 공정이 아니다 → 공정표·소요일 집계에서 뺀다. */
    var rows = A.progressRows(flt).filter(function (r) {
      return r.plan > 0 && !A.isMat(r.e);
    });
    if (!rows.length) return card(T('t6'), '', empty(T('z_nosched'),
      T('z_nosched_n')), 'flush');
    var data = rows.map(function (r) {
      var pr = A.prod(r.e.key, flt);
      var rate = pr && pr.perTeam ? pr.perTeam : r.e.pteam;
      var src = pr && pr.perTeam ? T('c_meas') : (r.e.pteam ? T('c_base') : null);
      return { r: r, rate: rate, src: src,
               doneD: rate ? r.act / rate : null, totD: rate ? r.plan / rate : null };
    });
    var known = data.filter(function (d) { return d.totD; });
    var maxD = known.length ? Math.ceil(Math.max.apply(null, known.map(function (d) { return d.totD; }))) : 0;
    var cols = Math.min(60, Math.max(12, maxD)), unitD = maxD / cols || 1;

    var h = '<div class="grid g4" style="margin-bottom:16px">' +
      kpi('kpi--lead', T('rate'), pf(A.avgRate(flt)).replace('%', ''), '%', T('k_rate_n'), A.avgRate(flt)) +
      kpi('', T('work'), nf(rows.length), T('u_ea'), T('h_planned')) +
      kpi('', T('h_haveprod'), nf(known.length), T('u_ea'), T('h_prodsrc')) +
      kpi(rows.length - known.length ? 'kpi--warn' : '', T('h_nodur'), nf(rows.length - known.length), T('u_ea'), '') +
      '</div>';

    h += card(T('t6'), esc(fltLabel()) + ' · ' + T('h_cell') + ' ' + nf(unitD, 1) + T('h_gantt'),
      '<div class="gantt"><table><thead><tr><th class="lab">' + T('work') + '</th>' +
      '<th class="r" style="min-width:60px">' + T('rate') + '</th><th class="r" style="min-width:64px">' + T('th_dur') + '</th>' +
      Array.apply(null, Array(cols)).map(function (_, i) {
        return '<th class="c" style="min-width:14px;padding:6px 0;font-size:9px">' +
          ((i % 5 === 4) ? Math.round((i + 1) * unitD) : '') + '</th>';
      }).join('') + '</tr></thead><tbody>' +
      data.sort(function (a, b) { return (b.totD || 0) - (a.totD || 0); }).map(function (d) {
        var r = d.r, plc = d.totD ? Math.round(d.totD / unitD) : 0, acc = d.doneD ? Math.round(d.doneD / unitD) : 0;
        return '<tr><td class="lab">' + itemLine(r.e.key) +
          '<br><span class="sp">' + esc(r.e.code || A.trW(r.e.grp)) +
          (d.src ? ' · ' + d.src + ' ' + nf(d.rate, 1) + T('h_percrew') : ' · ' + T('h_noprod')) + '</span></td>' +
          '<td class="r">' + (r.rate == null ? '—' : pf(r.rate)) + '</td>' +
          '<td class="r">' + (d.totD ? nf(Math.ceil(d.totD)) + 'd' : '—') + '</td>' +
          Array.apply(null, Array(cols)).map(function (_, i) {
            return '<td class="' + (i < acc ? 'cell ac' : (i < plc ? 'cell pl' : 'cell')) + '"></td>';
          }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>',
      T('h_dur'),
      '<button class="btn btn--g btn--sm noprint" onclick="window.print()">' + T('print') + '</button>' +
      '<button class="btn btn--g btn--sm noprint" id="gtCsv" style="margin-left:6px">' + T('csv') + '</button>');
    return h;
  }

  /* ══ 렌더 ═══════════════════════════════════════════ */
  /* ══ 탭7 직영 작업 ═══════════════════════════════════
     기성과 무관한 현장정리·폐기물처리 등. 공종코드 없이 작업내용을 자유 입력한다.
     진행률·생산성 집계에는 넣지 않는다(저장소 S.direct로 분리). */
  var dEdit = '';                      // 수정 중인 기록 id
  var dPpl = { eng: 0, fmn: 0, wkr: 0 };
  var dEq = [];
  var dCat = '', dSize = '';

  function v7() {
    var rows = A.directRows(flt), sum = A.directSum(flt);
    var allEq = [].concat.apply([], rows.map(function (x) { return x.eq || []; }));
    var opr = A.oprCount(allEq);                 // 장비기사(자동 산입)
    var tot = A.pplSum(sum.ppl) + opr;           // 총 투입인원 = 직군 3 + 장비기사
    var h = '';

    /* ── 한눈에 보는 투입 ── */
    var mx = Math.max(1, A.pplSum(sum.ppl));
    h += '<div class="grid g3" style="margin-bottom:16px">' +
      kpi('', T('d_sum'), nf(tot), T('u_pax'), T('d_rows') + ' ' + nf(sum.rows)) +
      kpi('', T('d_teams'), nf(sum.teams), '', T('d_title')) +
      kpi('', T('equip'), nf(sum.eq), T('u_unitq'), T('opr_auto') + ' ' + nf(opr)) +
      '</div>';

    /* ── 인원 구성 (색은 여기서만 — 의미가 있는 곳) ── */
    if (A.pplSum(sum.ppl)) {
      h += '<div style="margin-bottom:16px">' + card(T('people'), '',
        '<div class="dbar">' + A.JOBS.map(function (j, i) {
          var v = sum.ppl[j.id] || 0, pc = Math.round(v / mx * 100);
          return '<div class="dbar__r"><span class="dbar__l">' + esc(LJ(j)) + '</span>' +
            '<span class="dbar__t"><i class="lv' + (i + 1) + '" style="width:' + pc + '%"></i></span>' +
            '<b class="dbar__v">' + nf(v) + '</b></div>';
        }).join('') + '</div>') + '</div>';
    }

    /* ── 입력 ── */
    var pk = dEdit ? T('d_save') : T('d_add');
    h += '<div style="margin-bottom:16px">' + card(T('d_open'), T('d_sub'),
      pkHTML('d', true) +
      '<div class="f-row" style="margin-top:12px">' +
        fld(T('date'), '<input class="in" id="dDate" type="date" value="' + esc(A.today()) + '">') +
        fld(T('d_teams'), '<input class="in num" id="dTeams" type="number" min="0" step="1" value="1">') +
        fld(T('d_by'), '<input class="in" id="dBy">') +
      '</div>' +
      '<div style="margin-top:12px">' + fld(T('d_task'),
        '<input class="in" id="dTask" placeholder="' + esc(T('d_task_ph')) + '">') + '</div>' +
      '<div style="margin-top:12px">' + fld(T('d_note'), '<input class="in" id="dNote">') + '</div>' +
      '<div class="vsec">' + T('people') + '</div>' + dDial() +
      '<div class="vsec">' + T('equip') + '</div>' + dEqHTML(),
      '<button class="btn btn--o" id="dSave">' + pk + '</button>' +
      (dEdit ? ' <button class="btn btn--g" id="dCancel">' + T('d_cancel') + '</button>' : '') +
      ' <span class="vmsg" id="dMsg"></span>') + '</div>';

    /* ── 기록 ── */
    h += card(T('d_list'), esc(fltLabel()),
      rows.length
        ? '<table class="tb"><thead><tr><th>' + T('date') + '</th><th>' + T('loc') + '</th>' +
          '<th>' + T('d_task') + '</th><th class="r">' + T('d_teams') + '</th>' +
          '<th class="r">' + T('total') + '</th><th>' + T('d_by') + '</th>' +
          '<th class="noprint"></th></tr></thead><tbody>' +
          rows.map(function (x) {
            var n = A.pplSum(x.ppl) + A.oprCount(x.eq || []);
            return '<tr' + (dEdit === x.id ? ' class="on"' : '') + '>' +
              '<td>' + esc(x.date) + '</td><td>' + esc(A.locLabel(x.loc)) + '</td>' +
              '<td class="nm">' + esc(x.task) +
              (x.note ? '<span class="sp"> · ' + esc(x.note) + '</span>' : '') + '</td>' +
              '<td class="r">' + nf(x.teams) + '</td><td class="r"><b>' + nf(n) + '</b></td>' +
              '<td>' + esc(x.by || '') + '</td>' +
              '<td class="noprint"><button class="btn btn--g btn--sm" data-ded="' + x.id + '">' + T('d_edit') + '</button> ' +
              '<button class="btn btn--g btn--sm" data-ddel="' + x.id + '">' + T('d_del') + '</button></td></tr>';
          }).join('') + '</tbody></table>'
        : empty(T('d_none'), T('t7d')),
      'flush');
    return h;
  }

  function dDial() {
    var opr = A.oprCount(dEq);
    return '<div class="f-row">' + A.JOBS.map(function (j) {
      return '<div><label class="fl">' + esc(LJ(j)) + '</label>' +
        '<div class="dial"><button type="button" data-ddl="' + j.id + '" data-n="-1">−</button>' +
        '<input class="in num" data-ddv="' + j.id + '" type="number" min="0" step="1" value="' + (dPpl[j.id] || 0) + '">' +
        '<button type="button" data-ddl="' + j.id + '" data-n="1">+</button></div></div>';
    }).join('') +
      '<div><label class="fl">' + T('opr_auto') + '</label>' +
      '<div class="in" style="background:var(--wash);text-align:center;font-weight:700" id="dOpr">' + nf(opr) + '</div></div>' +
      '</div><div class="hint">' + T('total') + ' <b id="dSum">' + nf(A.pplSum(dPpl) + opr) + '</b></div>';
  }

  function dEqHTML() {
    var sizes = dCat ? A.eqSizes(dCat) : [];
    return '<div class="f-row">' +
      fld(T('eqcat'), '<select class="in" id="dCat"><option value="">' + esc(T('pick')) + '</option>' +
        opts(A.EQ_TREE, dCat, function (x) { return x.cat; }, function (x) { return x.cat; }) + '</select>') +
      fld(T('eqsize'), '<select class="in" id="dSize"' + (sizes.length ? '' : ' disabled') + '>' +
        opts(sizes, dSize) + '</select>') +
      fld(T('run'), '<input class="in num" id="dRun" type="number" min="0" step="1" value="0">') +
      fld('&nbsp;', '<button class="btn btn--g" id="dEqAdd">' + T('eqadd') + '</button>') + '</div>' +
      (dEq.length ? '<div style="margin-top:12px">' + dEq.map(function (x, i) {
        return '<div class="eqrow"><span class="eqrow__n">' + esc(A.eqLabel(x.cat, x.size)) + '</span>' +
          '<span class="bd">' + esc(T('run')) + ' ' + nf(x.run) + '</span>' +
          '<button class="btn btn--g btn--sm" data-deqd="' + i + '">✕</button></div>';
      }).join('') + '</div>' : '');
  }

  var V = { 1: v1, 2: v2, 3: v3, 4: v4, 5: v5, 6: v6, 7: v7 };
  A.render = function () {
    var w = A.warn(flt), I = window.I18N[S.lang];
    document.documentElement.lang = S.lang;
    document.documentElement.dir = 'ltr';   // 아랍어는 협력업체 폼 라벨 병기로만 씀
    $('#logo').src = 'assets/img/logo-' + (S.lang === 'ko' ? 'ko' : 'en') + '.svg';
    document.title = A.T('app');
    $('#appt').innerHTML = T('app') + '<small>' + T('appsub') +
      (window.BNCP_VER ? '  ·  v' + window.BNCP_VER.v : '') + '</small>';
    var _vb = $('#vendorBtn'); if (_vb) _vb.textContent = A.T('vendorBtn');
    var _wp = $('#wipe'); if (_wp) { _wp.textContent = A.T('wipe'); _wp.title = A.T('wipeTitle'); }
    var _rl = $('#roleBox');
    if (_rl) _rl.innerHTML = '<span class="rolebd">' + T(A.isAdmin() ? 'lg_admin' : 'lg_staff') + '</span>' +
      '<button class="btn btn--g btn--sm" id="lgOut">' + T('lg_out') + '</button>';
    $('#fltBox').innerHTML = fltHTML();
    $('#hmeta').innerHTML = '<b>' + esc(fltLabel()) + '</b><br>' +
      nf(A.hasPlan(flt)) + ' items planned · ' + nf(S.work.length) + ' records';

    /* 로그인 안 했으면 아무것도 보여주지 않는다 */
    if (!A.isStaff()) {
      $('#tabs').innerHTML = '';
      $('#fltBox').innerHTML = '';
      $('#hmeta').innerHTML = '';
      $('#view').innerHTML = loginHTML();
      bindLogin();
      return;
    }
    /* 스탭 화면은 인쇄·복사를 막는다. 캡처까지는 못 막지만 무심코 퍼가는 건 줄인다 */
    if (document.body && document.body.classList) document.body.classList.toggle('nocopy', !A.can('print'));

    var bd = { 1: w.pendWork + w.pendCrew + resAgg(A.today(), A.today()).down,
               2: w.inspFail, 3: w.survOpen, 4: w.short, 5: 0, 6: 0, 7: 0 };
    var TABS_ON = [1, 2, 3, 4, 5, 6, 7].filter(function (i) {
      if (i === 5) return A.can('notice');
      if (i === 6) return A.can('sched');
      return true;
    });
    if (TABS_ON.indexOf(cur) < 0) cur = 1;
    $('#tabs').innerHTML = TABS_ON.map(function (i) {
      return '<button role="tab" data-tab="' + i + '" aria-selected="' + (i === cur) + '">' +
        T('t' + i) + (bd[i] ? '<span class="cnt warn">' + bd[i] + '</span>' : '') + '</button>';
    }).join('');

    $('#view').innerHTML = '<div class="ph"><h1>' + T('t' + cur) + '</h1><p>' + T('t' + cur + 'd') + '</p></div>' + V[cur]();
    bind();
  };
  A.go = function (i) { cur = i; A.render(); window.scrollTo(0, 0); };
  A.sync = function (quiet) { syncNow(quiet !== false); };   // 화면 진입 시 1회 수신
  A.flt = function () { return flt; };
  A.setFlt = function (o) { for (var k in o) flt[k] = o[k]; A.render(); };

  /* ══ 이벤트 ═════════════════════════════════════════ */
  function val(id) { var e = $(id); return e ? String(e.value).trim() : ''; }
  function numv(id) { var v = parseFloat(val(id).replace(/,/g, '')); return isNaN(v) ? 0 : v; }
  function say(id, t, ok) {
    var e = $(id); if (!e) return;
    e.textContent = t; e.style.color = ok ? 'var(--ok)' : 'var(--danger)';
    setTimeout(function () { if (e) e.textContent = ''; }, 5000);
  }

  function bind() {
    pkBind(); dialBind('c'); eqBind('c');

    /* 상단 필터 */
    if ($('#fSite')) $('#fSite').onchange = function () {
      A.setFlt({ s: this.value, p: 0, c: 0, t: '', b: 0 });
    };
    if ($('#fPC')) $('#fPC').onchange = function () {
      var v = this.value.split('-');
      A.setFlt({ p: +v[0] || 0, c: +v[1] || 0 });
    };
    if ($('#fT')) $('#fT').onchange = function () { A.setFlt({ t: this.value, b: 0 }); };
    if ($('#fB')) $('#fB').onchange = function () { A.setFlt({ b: +this.value }); };

    /* ── 탭1 : 실적 ── */
    if ($('#wSave')) $('#wSave').onclick = function () {
      var g = pkGet('w');
      if (!g) return say('#wMsg', A.isFac(pk('w').key) ? T('h_pickspot') : T('v_work'));
      var q = numv('#wQty'); if (!q) return say('#wMsg', T('v_qty'));
      S.work.push({ id: A.uid(), date: val('#wDate') || A.yday(), loc: g.loc, key: g.key,
                    spot: g.spot, qty: q, by: val('#wBy'), st: 'sub' });
      A.save(); A.render();
    };
    /* ── 탭1 : 인원·장비 ── */
    if ($('#cSave')) $('#cSave').onclick = function () {
      var g = pkGet('c');
      if (!g) return say('#cMsg', A.isFac(pk('c').key) ? T('h_pickspot') : T('v_work'));
      var o = pk('c');
      var t = Math.max(0, parseInt(val('#cTeams'), 10) || 0);
      if (!t) return say('#cMsg', T('h_teamsq'));
      if (!A.pplSum(o.ppl) && !(o.eq || []).length) return say('#cMsg', T('h_pplq'));
      S.crew.push({ id: A.uid(), date: val('#cDate') || A.yday(), loc: g.loc, key: g.key,
                    spot: g.spot, teams: t,
                    ppl: JSON.parse(JSON.stringify(o.ppl || {})),
                    eq: JSON.parse(JSON.stringify(o.eq || [])),
                    by: val('#cBy'), st: 'sub' });
      o.ppl = { eng: 0, fmn: 0, wkr: 0 }; o.eq = [];
      A.save(); A.render();
    };
    $$('[data-ok]').forEach(function (b) {
      b.onclick = function () {
        var arr = b.dataset.ok === 'w' ? S.work : S.crew;
        arr.forEach(function (x) {
          if (x.id === b.dataset.id) { x.st = 'ok'; x.ckAt = A.today(); }
        });
        A.save(); A.render();
      };
    });
    $$('[data-ddel]').forEach(function (b) {
      b.onclick = function () { A.delDirect(b.dataset.ddel); A.render(); };
    });
    /* ── 탭7 직영 ── */
    (function () {
      function dsay(t, good) {
        var e = $('#dMsg'); if (!e) return;
        e.textContent = t; e.className = 'vmsg' + (good ? ' vmsg--ok' : ' vmsg--no');
      }
      function dsync() {
        A.JOBS.forEach(function (j) {
          var el = $('[data-ddv="' + j.id + '"]');
          if (el) dPpl[j.id] = Math.max(0, parseInt(el.value, 10) || 0);
        });
        var opr = A.oprCount(dEq);
        var o = $('#dOpr'); if (o) o.textContent = nf(opr);
        var s2 = $('#dSum'); if (s2) s2.textContent = nf(A.pplSum(dPpl) + opr);
      }
      $$('[data-ddl]').forEach(function (b) {
        b.onclick = function () {
          var el = $('[data-ddv="' + b.dataset.ddl + '"]');
          if (el) { el.value = Math.max(0, (parseInt(el.value, 10) || 0) + (+b.dataset.n)); dsync(); }
        };
      });
      $$('[data-ddv]').forEach(function (el) { el.oninput = dsync; });
      if ($('#dCat')) $('#dCat').onchange = function () {
        dCat = this.value; dSize = (A.eqSizes(dCat) || [])[0] || ''; A.render();
      };
      if ($('#dSize')) $('#dSize').onchange = function () { dSize = this.value; };
      if ($('#dEqAdd')) $('#dEqAdd').onclick = function () {
        if (!dCat) return;
        var r = Math.max(0, parseInt(val('#dRun'), 10) || 0);
        if (!r) return;
        dEq.push({ cat: dCat, size: dSize, run: r, brk: 0, rep: 0 });
        A.render();
      };
      $$('[data-deqd]').forEach(function (b) {
        b.onclick = function () { dEq.splice(+b.dataset.deqd, 1); A.render(); };
      });
      if ($('#dSave')) $('#dSave').onclick = function () {
        var task = val('#dTask');
        if (!task) return dsay(T('d_need_task'));
        dsync();
        if (!A.pplSum(dPpl) && !dEq.length) return dsay(T('d_need_ppl'));
        var rec = { date: val('#dDate') || A.today(), loc: pkLoc('d'), task: task,
                    teams: Math.max(0, parseInt(val('#dTeams'), 10) || 0),
                    ppl: JSON.parse(JSON.stringify(dPpl)), eq: JSON.parse(JSON.stringify(dEq)),
                    by: val('#dBy'), note: val('#dNote') };
        var drow;
        if (dEdit) { drow = A.updDirect(dEdit, rec); dEdit = ''; }
        else drow = A.addDirect(rec);
        txDirect(drow);
        dPpl = { eng: 0, fmn: 0, wkr: 0 }; dEq = [];
        A.render();
      };
      if ($('#dCancel')) $('#dCancel').onclick = function () {
        dEdit = ''; dPpl = { eng: 0, fmn: 0, wkr: 0 }; dEq = []; A.render();
      };
      $$('[data-ded]').forEach(function (b) {
        b.onclick = function () {
          var r = S.direct.filter(function (x) { return x.id === b.dataset.ded; })[0];
          if (!r) return;
          dEdit = r.id;
          dPpl = JSON.parse(JSON.stringify(r.ppl || { eng: 0, fmn: 0, wkr: 0 }));
          dEq = JSON.parse(JSON.stringify(r.eq || []));
          A.render();
          if ($('#dDate')) $('#dDate').value = r.date;
          if ($('#dTask')) $('#dTask').value = r.task;
          if ($('#dNote')) $('#dNote').value = r.note || '';
          if ($('#dTeams')) $('#dTeams').value = r.teams || 0;
          if ($('#dBy')) $('#dBy').value = r.by || '';
          window.scrollTo(0, 0);
        };
      });
      $$('[data-ddel]').forEach(function (b) {
        b.onclick = function () {
          A.delDirect(b.dataset.ddel);
          if (dEdit === b.dataset.ddel) { dEdit = ''; dPpl = { eng: 0, fmn: 0, wkr: 0 }; dEq = []; }
          A.render();
        };
      });
    })();

    $$('[data-del]').forEach(function (b) {
      b.onclick = function () {
        if (b.dataset.del === 'w') S.work = S.work.filter(function (x) { return x.id !== b.dataset.id; });
        else S.crew = S.crew.filter(function (x) { return x.id !== b.dataset.id; });
        A.save(); A.render();
      };
    });

    /* 계획수량 */
    bindBoq(); qbarBind(); setupBind();
    if ($('#planFile')) $('#planFile').onchange = function (ev) {
      var f = ev.target.files[0]; if (!f) return;
      var loc = pkLoc('w');
      var done = function (rows) {
        /* 내역서 원본이면 계층을 펴서 읽는다 (v2.14.0) */
        if (A.isBoq(rows)) {
          var b = A.readBoqRows(rows, loc);
          boqNeed = b.need; boqLoc = loc;
          var bm = A.locLabel(loc) + ' — ' + T('bq_read') + ' ' + b.ok + '/' + b.total + T('u_row');
          if (b.need.length) bm += ' · ' + T('bq_need') + ' ' + b.need.length + T('u_ea');
          A.render(); setTimeout(function () { say('#planMsg', bm, b.ok > 0); }, 30);
          return;
        }
        var r = A.readPlanRows(rows, loc);
        var m = A.locLabel(loc) + ' — ' + T('r_read') + ' ' + r.ok + T('u_row');
        if (r.wrongSite && r.wrongSite.length) m += ' · ' + T('r_wrongsite') + ' ' + r.wrongSite.length + T('u_ea');
        if (r.miss.length) m += ' · ' + T('r_nocode') + ' ' + r.miss.length + T('u_ea');
        if (r.skip) m += ' · ' + T('r_skip') + ' ' + r.skip;
        A.render(); setTimeout(function () { say('#planMsg', m, r.ok > 0); }, 30);
      };
      readFile(f, done, '#planMsg');
    };
    if ($('#syncBtn')) $('#syncBtn').onclick = function () { syncNow(false); };
    bindDetail();
    if ($('#lgOut')) $('#lgOut').onclick = function () { A.setRole(''); A.render(); };
    $$('[data-mtstep]').forEach(function (el) {
      el.onchange = function () { A.mtSet(el.dataset.mtstep, el.value, null); A.render(); };
    });
    $$('[data-eqo]').forEach(function (el) {
      el.onclick = function () { eqOpen[el.dataset.eqo] = !eqOpen[el.dataset.eqo]; A.render(); };
    });
    $$('[data-mtwhy]').forEach(function (el) {
      el.onchange = function () { A.mtSet(el.dataset.mtwhy, null, el.value); };
    });
    $$('[data-rc]').forEach(function (b) {
      b.onclick = function () {
        var box = $('#rcSel_' + b.dataset.rc);
        if (box) return;
        var sel = document.createElement('select');
        sel.className = 'in';
        sel.id = 'rcSel_' + b.dataset.rc;
        sel.innerHTML = A.RECHECK_WHY.map(function (w) {
          return '<option value="' + w.id + '">' + esc(w[L()] || w.en) + '</option>';
        }).join('');
        sel.onchange = function () {
          if (A.askRecheck(b.dataset.rc, sel.value)) A.render();
        };
        b.parentNode.appendChild(sel);
      };
    });
    if ($('#cumTgl')) $('#cumTgl').onclick = function () { cumOpen = !cumOpen; A.render(); };
    if ($('#cumMode')) $('#cumMode').onclick = function () { cumAll = !cumAll; A.render(); };
    $$('[data-ckok]').forEach(function (b) {
      b.onclick = function () {
        var w = null;
        S.work.forEach(function (x) { if (x.id === b.dataset.ckok) w = x; });
        if (w) { w.ckOk = 1; A.save(); A.render(); }
      };
    });
    if ($('#vdFile')) $('#vdFile').onchange = function () {
      var f = this.files && this.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        var r = A.vendLoad(rd.result);
        A.render();
        setTimeout(function () { say('#vdMsg', T('vd_ok').replace('%c', nf(r.comp)).replace('%s', nf(r.staff)), r.comp > 0); }, 30);
      };
      rd.readAsText(f, 'utf-8');
    };
    if ($('#planTpl')) $('#planTpl').onclick = function () {
      var site = pk('w').s;
      var rows = A.LIST.filter(function (e) { return e.kind === 'C' && e.site === site; })
        .map(function (e) { return [e.code, e.grp, e.name, e.spec, e.unit, '']; });
      A.dl(T('f_plan') + '_' + site + '.csv', A.toCSV([T('c_code'), T('c_grp'), T('c_work'), T('c_spec'), T('c_unit'), T('c_qty')], rows));
    };
    if ($('#facOpen')) $('#facOpen').onclick = function () {
      var b = $('#facBox');
      if (b.style.display === 'none') { b.innerHTML = facBox(); b.style.display = ''; bindFac(); }
      else b.style.display = 'none';
    };
    function bindFac() {
      $('#facSave').onclick = function () {
        var lk = A.locKey(pkLoc('w'));
        S.fac[lk] = S.fac[lk] || {};
        A.FACS.forEach(function (f) { S.fac[lk][f.id] = S.fac[lk][f.id] || []; });
        $$('[data-fac]').forEach(function (i) {
          var v = parseFloat(i.value); if (isNaN(v)) v = 0;
          S.fac[lk][i.dataset.fac][+i.dataset.ci] = v;
        });
        A.save(); A.render();
      };
    }

    /* 장비 지급대장 */
    if ($('#isFile')) $('#isFile').onchange = function (ev) {
      var f = ev.target.files[0]; if (!f) return;
      var loc = pkLoc('c');
      readFile(f, function (rows) {
        var r = A.readIssueRows(rows, loc);
        var m = A.locLabel(loc) + ' — ' + T('r_read') + ' ' + r.ok + T('u_row');
        if (r.miss.length) m += ' · ' + T('r_noeq') + ' ' + r.miss.length + T('u_ea') + ' (' + r.miss.slice(0, 3).join(', ') + ')';
        A.render(); setTimeout(function () { say('#isMsg', m, r.ok > 0); }, 30);
      }, '#isMsg');
    };
    if ($('#isTpl')) $('#isTpl').onclick = function () {
      var rows = [];
      A.EQ_TREE.forEach(function (t) {
        t.sizes.forEach(function (s) { rows.push([A.today(), t.cat, s, '']); });
      });
      A.dl(T('f_eqtpl') + '.csv', A.toCSV([T('c_date'), T('c_eq'), T('c_spec'), T('c_cnt')], rows));
    };
    if ($('#isClr')) $('#isClr').onclick = function () {
      if (confirm(T('p_clrgiven'))) { S.issue = []; A.save(); A.render(); }
    };

    if ($('#pgCsv')) $('#pgCsv').onclick = function () {
      A.dl(T('f_rate') + '.csv', A.toCSV([T('c_code'), T('c_grp'), T('work'), T('c_spec'), T('c_unit'), T('c_target'), T('c_act'), T('c_left'), T('c_rate')],
        A.progressRows(flt).map(function (r) {
          return [r.e.code, r.e.grp, r.e.name, r.e.spec, r.e.unit, r.plan, r.act, r.left,
                  r.rate == null ? '' : Math.round(r.rate * 10) / 10];
        })));
    };
    if ($('#ruCsv')) $('#ruCsv').onclick = function () {
      A.dl(T('f_roll') + '.csv', A.toCSV(
        [T('c_code'), T('work'), T('c_spec'), T('c_unit'), T('th_out'), T('c_crews')].concat(A.JOBS.map(function (j) { return LJ(j); }))
          .concat([T('c_opr'), T('th_pplt'), T('c_eqrun'), T('c_brk'), T('c_rep')]),
        A.rollup(flt).map(function (x) {
          return [x.e.code, x.e.name, x.e.spec, x.e.unit, x.qty, x.teams]
            .concat(A.JOBS.map(function (j) { return x.ppl[j.id]; }))
            .concat([x.opr, x.pplT, x.run, x.brk, x.rep]);
        })));
    };

    /* ── 탭2 검측 ── */
    if ($('#iSave')) $('#iSave').onclick = function () {
      var g = pkGet('i'); if (!g) return say('#iMsg', T('v_work'));
      var q = numv('#iQty');
      var d = val('#iDate') || A.today();
      // 당일 작업완료분만 — 같은 날·위치·공종에 실적(제출 이상)이 있어야 신청 가능
      var hasWork = S.work.some(function (w) {
        return w.date === d && w.key === g.key && A.locKey(w.loc) === A.locKey(g.loc);
      });
      if (!hasWork) return say('#iMsg', T('h_noworkday'));
      S.insp.push({ id: A.uid(), date: d, loc: g.loc, key: g.key,
                    spot: g.spot, qty: q, st: 'apply', stAt: A.today(), reason: '',
                    by: val('#iBy'), note: val('#iNote'), seq: 1, hist: [] });
      A.save(); A.render();
    };
    $$('[data-iready]').forEach(function (b) {
      b.onclick = function () { A.setInsp(b.dataset.iready, 'ready'); A.render(); };
    });
    $$('[data-ist]').forEach(function (sel) {
      sel.onchange = function () {
        var st = sel.value, reason = '';
        if (A.inspNeedReason(st)) {
          reason = prompt(st === 'fail' ? T('p_fail') : T('p_delay'), '');
          if (reason == null || !reason.trim()) { A.render(); return; }
        }
        A.setInsp(sel.dataset.ist, st, reason); A.render();
      };
    });
    $$('[data-ire]').forEach(function (b) {
      b.onclick = function () { A.reInsp(b.dataset.ire); A.render(); };
    });
    $$('[data-idel]').forEach(function (b) {
      b.onclick = function () {
        S.insp = S.insp.filter(function (x) { return x.id !== b.dataset.idel; });
        A.save(); A.render();
      };
    });
    if ($('#iCsv')) $('#iCsv').onclick = function () {
      A.dl(T('f_insp') + '.csv', A.toCSV([T('c_st'), T('c_seq'), T('c_date'), T('c_loc'), T('c_code'), T('work'), T('c_spot'), T('c_qty'), T('c_reason'), T('c_by')],
        A.inspList(flt).map(function (r) {
          var e = A.item(r.key) || {};
          return [A.T((IST[r.st]||IST.apply)[0]), r.seq || 1, r.date, A.locLabel(r.loc), e.code || '', e.name || r.key,
                  spotName(r.key, r.spot), r.qty, r.reason || '', r.by || ''];
        })));
    };

    /* ── 탭3 측량 ── */
    if ($('#sSave')) $('#sSave').onclick = function () {
      var g = pkGet('s'); if (!g) return say('#sMsg', T('v_work'));
      var why = val('#sWhy'); if (!why) return say('#sMsg', T('h_reasonq'));
      S.surv.push({ id: A.uid(), date: val('#sDate') || A.today(), loc: g.loc, key: g.key,
                    spot: g.spot, why: why, by: val('#sBy'), done: false });
      A.save(); A.render();
    };
    $$('[data-sdone]').forEach(function (b) {
      b.onclick = function () {
        S.surv.forEach(function (x) { if (x.id === b.dataset.sdone) x.done = !x.done; });
        A.save(); A.render();
      };
    });
    $$('[data-sdel]').forEach(function (b) {
      b.onclick = function () {
        S.surv = S.surv.filter(function (x) { return x.id !== b.dataset.sdel; });
        A.save(); A.render();
      };
    });
    if ($('#sCsv')) $('#sCsv').onclick = function () {
      A.dl(T('f_surv') + '.csv', A.toCSV([T('c_st'), T('c_date'), T('c_loc'), T('work'), T('c_reason'), T('c_by')],
        A.survList(flt).map(function (r) {
          var e = A.item(r.key) || {};
          return [A.T(r.done ? 's_done' : 's_open'), r.date, A.locLabel(r.loc), e.name || r.key, r.why, r.by || ''];
        })));
    };

    /* ── 탭4 자재 워크플로 ── */
    // 세그먼트 (창고/플랜트)
    $$('[data-mseg]').forEach(function (b) {
      b.onclick = function () { pk('m').mseg = b.dataset.mseg; pk('m').mmat = ''; A.render(); };
    });
    // 자재 선택기
    $$('[data-pkm="m"]').forEach(function (el) {
      el.onchange = function () {
        var o = pk('m'), f = el.dataset.f;
        o[f] = (f === 'p' || f === 'c' || f === 'b') ? +el.value : (f === 'mmat' ? (el.value === '' ? '' : +el.value) : el.value);
        if (f === 's') { o.mgrp = ''; o.msub = ''; o.mmat = ''; o.p = 1; o.c = 1; o.t = 'A'; o.b = 1; }
        if (f === 'mgrp') { o.msub = ''; o.mmat = ''; }
        if (f === 'msub') o.mmat = '';
        if (f === 't') o.b = 1;
        var box = $('#pkm_m'); if (box) { box.innerHTML = pkMatHTML('m'); bindPkm(); }
      };
    });
    function bindPkm() {
      $$('[data-pkm="m"]').forEach(function (el) {
        el.onchange = $$('[data-pkm="m"]')[0].onchange;  // 위 핸들러 재사용
      });
    }
    // 설계수량 업로드
    if ($('#dsCivil')) $('#dsCivil').onchange = function (ev) { uploadDesign(ev, 'civil'); };
    if ($('#dsAnc')) $('#dsAnc').onchange = function (ev) { uploadDesign(ev, 'anc'); };
    function uploadDesign(ev, site) {
      var f = ev.target.files[0]; if (!f) return;
      readFile(f, function (rows) {
        var r = A.readDesignRows(rows, site);
        var m = (site === 'civil' ? T('c_civil') : T('c_anc')) + ' — ' + T('r_read') + ' ' + r.ok + T('u_row') + (r.skip ? ' · ' + T('r_skip') + ' ' + r.skip : '') + (r.err ? ' · ' + r.err : '');
        A.render(); setTimeout(function () { say('#dsMsg', m, r.ok > 0); }, 30);
      }, '#dsMsg');
    }
    if ($('#dsTplC')) $('#dsTplC').onclick = function () {
      A.dl(T('f_dscivil') + '.csv', A.toCSV(['Phase', 'Section', T('c_grp'), T('c_sub'), T('c_matname'), T('c_spec'), T('c_unit'), T('c_designq')], []));
    };
    if ($('#dsTplA')) $('#dsTplA').onclick = function () {
      A.dl(T('f_dsanc') + '.csv', A.toCSV(['Town', 'Block', T('c_grp'), T('c_sub'), T('c_matname'), T('c_spec'), T('c_unit'), T('c_designq')], []));
    };
    // 자재 신청
    if ($('#mqSave')) $('#mqSave').onclick = function () {
      var g = pkMatGet('m'); if (!g) return say('#mqMsg', T('v_mat'));
      var q = numv('#mqQty'); if (!q) return say('#mqMsg', T('v_reqqty'));
      A.addMreq({ date: val('#mqDate'), loc: g.loc, grp: g.grp, sub: g.sub, mat: g.mat,
                  spec: g.spec, unit: g.unit, plant: g.plant, qty: q, by: val('#mqBy') });
      A.render();
    };
    // 승인 흐름
    $$('[data-mapv]').forEach(function (b) { b.onclick = function () { A.mApprove(b.dataset.mapv, ''); A.render(); }; });
    $$('[data-mdeny]').forEach(function (b) {
      b.onclick = function () { var w = prompt(T('p_deny'), ''); if (w == null) return; A.mDeny(b.dataset.mdeny, w); A.render(); };
    });
    $$('[data-mplant]').forEach(function (b) { b.onclick = function () { A.mPlantReq(b.dataset.mplant); A.render(); }; });
    $$('[data-miss]').forEach(function (b) {
      b.onclick = function () { var r = A.mreqById(b.dataset.miss); var q = prompt(T('p_issqty'), r ? r.qty : ''); if (q == null) return; A.mIssue(b.dataset.miss, parseFloat(q) || 0); A.render(); };
    });
    $$('[data-mnoiss]').forEach(function (b) {
      b.onclick = function () { var w = prompt(T('p_noiss'), ''); if (w == null) return; A.mNoIssue(b.dataset.mnoiss, w); A.render(); };
    });
    $$('[data-muse]').forEach(function (b) {
      b.onclick = function () { var q = prompt(T('p_use'), ''); if (q == null) return; A.mUse(b.dataset.muse, parseFloat(q) || 0); A.render(); };
    });
    $$('[data-mqdel]').forEach(function (b) {
      b.onclick = function () { S.mreq = S.mreq.filter(function (x) { return x.id !== b.dataset.mqdel; }); A.save(); A.render(); };
    });
    if ($('#mqCsv')) $('#mqCsv').onclick = function () {
      var plant = pk('m').mseg === 'plant';
      A.dl(T('f_mreq') + '.csv', A.toCSV([T('c_st'), T('c_date'), T('c_loc'), T('c_grp'), T('c_sub'), T('c_mat'), T('c_spec'), T('c_unit'), T('c_req'), T('c_iss'), T('c_use'), T('c_reason')],
        A.mreqList(flt, plant).map(function (r) {
          return [A.T((MST[r.st] || MST.req)[0]), r.date, A.locLabel(r.loc), r.grp, r.sub, r.mat, r.spec, r.unit,
                  r.qty, r.iss == null ? '' : r.iss, r.use == null ? '' : r.use, r.denyWhy || r.noissWhy || ''];
        })));
    };
    if ($('#vrCsv')) $('#vrCsv').onclick = function () {
      var plant = pk('m').mseg === 'plant';
      A.dl(T('f_mvar') + '.csv', A.toCSV([T('c_grp'), T('c_sub'), T('c_mat'), T('c_spec'), T('c_unit'), T('c_design'), T('c_req'), T('c_iss'), T('c_use'), T('c_var')],
        A.mVariance(flt, plant).map(function (a) {
          return [a.grp, a.sub, a.mat, a.spec, a.unit, a.design, a.req, a.iss, a.use, a.gapIss == null ? '' : a.gapIss];
        })));
    };

    /* ── 탭5 알림 ── */
    if ($('#nGen')) $('#nGen').onclick = function () { $('#nBody').value = genMsg(val('#nKind')); };
    if ($('#nCopy')) $('#nCopy').onclick = function () {
      var t = $('#nBody').value; if (!t) return say('#nMsg', T('v_empty'));
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { say('#nMsg', T('v_copied'), 1); });
      else { $('#nBody').select(); document.execCommand('copy'); say('#nMsg', T('v_copied'), 1); }
    };
    if ($('#nSend')) $('#nSend').onclick = function () {
      var t = $('#nBody').value.trim(); if (!t) return say('#nMsg', T('v_writebody'));
      S.msg.push({ id: A.uid(), at: new Date().toISOString(), kind: val('#nKind'),
                   ch: val('#nCh'), to: val('#nTo'), body: t });
      A.save(); A.render();
    };
    $$('[data-ndel]').forEach(function (b) {
      b.onclick = function () { S.msg = S.msg.filter(function (x) { return x.id !== b.dataset.ndel; }); A.save(); A.render(); };
    });

    /* ── 탭6 ── */
    if ($('#gtCsv')) $('#gtCsv').onclick = function () {
      A.dl(T('f_sched') + '.csv', A.toCSV([T('c_code'), T('work'), T('c_spec'), T('c_unit'), T('c_target'), T('c_act'), T('c_rate'), T('c_prod'), T('c_src'), T('th_dur')],
        A.progressRows(flt).filter(function (r) { return r.plan > 0; }).map(function (r) {
          var pr = A.prod(r.e.key, flt), rate = pr && pr.perTeam ? pr.perTeam : r.e.pteam;
          return [r.e.code, r.e.name, r.e.spec, r.e.unit, r.plan, r.act,
                  r.rate == null ? '' : Math.round(r.rate * 10) / 10,
                  rate == null ? '' : Math.round(rate * 100) / 100,
                  pr && pr.perTeam ? T('c_meas') : (r.e.pteam ? T('c_base') : ''),
                  rate ? Math.ceil(r.plan / rate) : ''];
        })));
    };
  }

  /* CSV 글자코드 자동 판별 (v2.14.0)
     현장에서 나오는 내역서는 대개 ANSI(CP949)로 저장돼 있다.
     UTF-8로 강제로 읽으면 한글이 전부 깨져 한 줄도 못 읽는다.
     → 엄격 UTF-8로 먼저 시도하고, 실패하면 euc-kr로 다시 읽는다. */
  function decodeCsv(buf) {
    var u8 = new Uint8Array(buf);
    if (u8.length > 2 && u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) {
      u8 = u8.subarray(3);                       /* BOM 제거 */
    }
    if (window.TextDecoder) {
      try {
        return new TextDecoder('utf-8', { fatal: true }).decode(u8);
      } catch (e) {
        try { return new TextDecoder('euc-kr').decode(u8); } catch (e2) { }
      }
      try { return new TextDecoder('utf-8').decode(u8); } catch (e3) { }
    }
    var s = '';
    for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return s;
  }

  function readFile(f, done, msgId) {
    if (/\.csv$/i.test(f.name)) {
      var fr = new FileReader();
      fr.onload = function () { done(A.parseCSV(decodeCsv(fr.result))); };
      fr.readAsArrayBuffer(f);
    } else if (window.XLSX) {
      var f2 = new FileReader();
      f2.onload = function () {
        var wb = XLSX.read(new Uint8Array(f2.result), { type: 'array' });
        done(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true }));
      };
      f2.readAsArrayBuffer(f);
    } else say(msgId, T('v_noxlsx'));
  }
})();
