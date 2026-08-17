/* ══════════════════════════════════════════════════════════
   vendor.js — 협력업체 전용 입력 화면
   입력만 한다. 진행률·승인·집계·공정표는 보이지 않는다.
   라벨은 English / العربية 병기.
   저장소는 관리자 화면과 같다 (localStorage: bncp.dash.v2)
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var A = window.APP, S = A.S, $ = A.$, $$ = A.$$, esc = A.esc, nf = A.nf;

  /* ★ 협력업체 화면은 EN/AR 고정이다. 관리자 화면과 localStorage를 공유하므로
     S.lang이 'ko'로 저장돼 있을 수 있다 — 여기서는 언제나 영어로 강제한다.
     (이 화면에서 A.trW/A.trM을 인자 없이 부르지 말 것) */
  function tw(s) { return A.trW(s, 'en'); }
  function tm(s) { return A.trM(s, 'en'); }
  function ts(s) { return A.trS(s, 'en'); }
  function tu(s) { return A.trU(s, 'en'); }   /* 단위도 영어 강제 (v2.15.3) */

  /* 영어/아랍어 병기 라벨 */
  function bl(key) {
    var en = window.I18N.en[key] || key, ar = window.I18N.ar[key] || '';
    return '<span class="bi">' + esc(en) +
      (ar ? '<span class="sl">/</span><span class="ar">' + esc(ar) + '</span>' : '') + '</span>';
  }
  function fld(lab, inner) { return '<div><label class="fl">' + lab + '</label>' + inner + '</div>'; }
  function bfld(k, inner) { return fld(bl(k), inner); }
  function opts(list, sel, v, l) {
    return list.map(function (x) {
      var vv = v ? v(x) : x, ll = l ? l(x) : x;
      return '<option value="' + esc(vv) + '"' + (String(vv) === String(sel) ? ' selected' : '') + '>' + esc(ll) + '</option>';
    }).join('');
  }

  /* ── 화면 상태 ─────────────────────────────────────── */
  var V = {
    tab: 'work',                    // work | crew | insp | surv | mat
    s: 'civil', p: 1, c: 1, t: 'A', b: 1,
    grp: '', key: '', spot: -1,     // 공종 선택
    rw: '', rno: '', rmemo: '',     // 도로: 폭·번호·설명
    side: [], sta: {},              // 좌우 복수선택 + 쪽별 측점
    need: false,                    // 검측 필요 여부(기본 해제)
    stage: 'p1', layer: 1, pick: [], // 검측: 단계·되메우기 층·선택한 실적
    mgrp: '', msub: '', mmat: '',   // 자재 선택
    ppl: { eng: 0, fmn: 0, wkr: 0 },
    eq: [], eqcat: '', eqsize: '',
    by: '', comp: null, staff: ''   // 링크로 고정된 업체 / 선택한 담당자
  };
  function loc() {
    return V.s === 'civil' ? { s: 'civil', p: +V.p, c: +V.c } : { s: 'anc', t: V.t, b: +V.b };
  }

  /* ── 위치 선택 (항상 영문 — 층1) ───────────────────── */
  function locHTML() {
    var l = V.s === 'civil'
      ? '<select class="in" data-v="p">' + opts(A.PHASES, V.p, null, function (x) { return 'Phase ' + x; }) + '</select>' +
        '<select class="in" data-v="c">' + opts(A.SECTORS, V.c, null, function (x) { return 'Phase ' + V.p + '-' + x; }) + '</select>'
      : '<select class="in" data-v="t">' + opts(A.TOWNS, V.t, function (x) { return x.t; }, function (x) { return 'Town ' + x.t; }) + '</select>' +
        '<select class="in" data-v="b">' + opts(A.townBlocks(V.t), V.b, null, function (x) { return 'Block ' + x; }) + '</select>';
    return '<div class="vloc">' +
      '<select class="in" data-v="s">' + opts(A.SITES, V.s, function (x) { return x.id; }, function (x) { return x.en; }) + '</select>' +
      l + '<span class="vloc__now">' + esc(A.locLabel(loc())) + '</span></div>';
  }

  /* ── 업체 확인 ──────────────────────────────────────
     명부가 등록돼 있으면 링크(?c=)로 업체가 고정된다. 키가 없거나 틀리면 입력 차단.
     ★ 목록에서 고르게만 하면 남의 업체를 고를 수 있다. 링크로 고정해야 막힌다. */
  function vendGate() {
    if (!S.vend || !S.vend.length) return true;      // 명부 미등록 → 예전처럼 자유 입력
    if (V.comp) return true;
    var m = /[?&]c=([^&]+)/.exec(location.search);
    V.comp = m ? A.vendByKey(decodeURIComponent(m[1])) : null;
    return !!V.comp;
  }

  function gateHTML() {
    return '<div class="vgate"><b>Access link required</b>' +
      '<span class="sl">/</span><span class="ar">مطلوب رابط الدخول</span>' +
      '<div class="sp">Ask the site office for your company link.' +
      '<span class="sl">/</span><span class="ar">اطلب رابط شركتك من مكتب الموقع.</span></div></div>';
  }

  function compHTML() {
    if (!V.comp) return '';
    var st = V.comp.staff || [];
    return '<div class="vcomp"><span class="vcomp__n">' + esc(V.comp.name) + '</span>' +
      (st.length
        ? '<select class="in" data-v="staff"><option value="">Staff / الموظف</option>' +
          st.map(function (x) {
            return '<option value="' + esc(x) + '"' + (x === V.staff ? ' selected' : '') + '>' + esc(x) + '</option>';
          }).join('') + '</select>'
        : '') + '</div>';
  }

  /* ── 세부위치(도로) 입력 ────────────────────────────
     좌·중앙·우는 복수 선택. 고른 쪽마다 측점을 따로 받는다
     (같이 시공해도 시작·끝이 다를 수 있다). */
  function roadHTML() {
    var SP = window.BNCP_SPOT, ws = SP.widths(S.roadX);
    var wsel = '<select class="in" data-v="rw"><option value="">Width / العرض</option>' +
      ws.map(function (x) {
        return '<option value="' + esc(x.w) + '"' + (x.w === V.rw ? ' selected' : '') + '>' + esc(x.w) + 'm</option>';
      }).join('') + '</select>';

    var max = V.rw ? SP.maxNo(V.rw, S.roadX) : 0, nos = '';
    for (var i = 1; i <= max; i++) {
      nos += '<option value="' + i + '"' + (String(i) === String(V.rno) ? ' selected' : '') + '>' + i + '</option>';
    }
    var nsel = '<select class="in" data-v="rno"' + (max ? '' : ' disabled') + '>' +
      '<option value="">No. / رقم</option>' + nos + '</select>';

    var sides = SP.SIDES.map(function (x) {
      var on = V.side.indexOf(x.id) >= 0;
      return '<label class="ck"><input type="checkbox" data-side="' + x.id + '"' + (on ? ' checked' : '') + '> ' +
        esc(x.en) + '<span class="sl">/</span><span class="ar">' + esc(x.ar) + '</span></label>';
    }).join('');

    /* 고른 쪽마다 측점 한 줄씩 */
    var rows = V.side.map(function (id) {
      var v = V.sta[id] || {};
      return '<div class="starow"><span class="stalab">' + esc(SP.sideName(id)) + '</span>' +
        '<input class="in num" data-sta="' + id + '.fk" type="number" min="0" step="1" placeholder="0" value="' + esc(v.fk || '') + '">' +
        '<span class="staplus">+</span>' +
        '<input class="in num" data-sta="' + id + '.fm" type="number" min="0" step="any" placeholder="000" value="' + esc(v.fm || '') + '">' +
        '<span class="statil">~</span>' +
        '<input class="in num" data-sta="' + id + '.tk" type="number" min="0" step="1" placeholder="0" value="' + esc(v.tk || '') + '">' +
        '<span class="staplus">+</span>' +
        '<input class="in num" data-sta="' + id + '.tm" type="number" min="0" step="any" placeholder="000" value="' + esc(v.tm || '') + '">' +
        '<span class="stalen">' + esc(sideLenText(id)) + '</span></div>';
    }).join('');

    return '<div class="f-row" style="margin-top:12px">' +
      fld('Road / الطريق', '<div class="two">' + wsel + nsel + '</div>') +
      fld('Note / ملاحظة', '<input class="in" id="vMemo" value="' + esc(V.rmemo) + '" placeholder="School Entrance">') +
      '</div>' +
      '<div style="margin-top:10px">' + fld('Side / الجانب', '<div class="cks">' + sides + '</div>') + '</div>' +
      (rows ? '<div class="stas">' + rows + '</div>' : '') +
      (V.side.length ? '<div class="statot">Total ' + nf(totalLen(), 2) + ' m<span class="sl">/</span>' +
        '<span class="ar">الإجمالي</span></div>' : '');
  }

  function sideLen(id) {
    var SP = window.BNCP_SPOT, v = V.sta[id] || {};
    var f = SP.sta(v.fk, v.fm), t = SP.sta(v.tk, v.tm);
    return SP.len(f, t);
  }
  function sideLenText(id) {
    var L = sideLen(id);
    return L === null ? '—' : nf(L, 2) + ' m';
  }
  function totalLen() {
    var s = 0;
    V.side.forEach(function (id) { var L = sideLen(id); if (L !== null) s += L; });
    return s;
  }

  /* 검측 필요 — 기본 해제. 체크한 것만 나중에 검측 신청 목록에 뜬다 */
  function inspCk() {
    return '<label class="ck ck--em"><input type="checkbox" id="vNeed"' + (V.need ? ' checked' : '') + '> ' +
      'Inspection required<span class="sl">/</span><span class="ar">يتطلب فحص</span></label>';
  }

  /* ── 검측 신청 ──────────────────────────────────────
     위치·공종·날짜를 다시 고르지 않는다. 실적이 곧 신청 목록이다.
     같은 도로·같은 쪽끼리 묶여 나오고, 여러 날치를 한 번에 신청할 수 있다. */
  function inspPool() {
    var lk = A.locKey(loc()), out = {};
    S.work.forEach(function (w) {
      if (!w.need || w.insp) return;              // 검측 필요 표시 + 아직 신청 안 한 것만
      if (A.locKey(w.loc) !== lk) return;
      var sp = w.spot, gk = (sp && sp.kind === 'road')
        ? window.BNCP_SPOT.groupKey(sp) : ('k|' + w.key);
      gk = w.key + '||' + gk;
      (out[gk] = out[gk] || []).push(w);
    });
    return out;
  }

  function inspHTML() {
    var SP = window.BNCP_SPOT, pool = inspPool(), keys = Object.keys(pool);
    if (!keys.length) {
      return '<div class="empty">Nothing to apply / لا شيء للتقديم<br>' +
        '<span class="sp">Tick "Inspection required" when submitting output' +
        '<span class="sl">/</span><span class="ar">حدد "يتطلب فحص" عند إرسال الإنتاج</span></span></div>';
    }

    var h = '<div class="f-row">' +
      fld('Stage / المرحلة', '<select class="in" data-v="stage">' +
        SP.STAGES.map(function (x) {
          return '<option value="' + x.id + '"' + (x.id === V.stage ? ' selected' : '') + '>' + esc(x.en) + '</option>';
        }).join('') + '</select>') +
      (V.stage === 'bf'
        ? fld('Layer / الطبقة', '<input class="in num" id="vLayer" type="number" min="1" step="1" value="' + esc(V.layer) + '">')
        : '') +
      fld('Applied by / مقدم الطلب', '<input class="in" id="vBy" value="' + esc(V.by) + '" placeholder="Company / الشركة">') +
      '</div>';

    keys.forEach(function (gk) {
      var list = pool[gk].sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
      var e = A.item(list[0].key) || {}, sp = list[0].spot;
      var head = tw(e.name || list[0].key) +
        (sp && sp.kind === 'road' ? ' · ' + SP.roadName(sp) + ' · ' + SP.sideName(sp.side) : '');
      var sel = list.filter(function (w) { return V.pick.indexOf(w.id) >= 0; });

      h += '<div class="igrp"><div class="igrp__h">' + esc(head) + '</div>' +
        list.map(function (w) {
          var on = V.pick.indexOf(w.id) >= 0;
          return '<label class="irow"><input type="checkbox" data-pick="' + esc(w.id) + '"' + (on ? ' checked' : '') + '>' +
            '<span class="ird">' + esc(w.date) + '</span>' +
            '<span class="irs">' + esc(w.spot && w.spot.kind === 'road'
              ? SP.staText(w.spot.f) + '~' + SP.staText(w.spot.t) : '—') + '</span>' +
            '<span class="irq">' + nf(w.qty, 2) + ' ' + esc(tu(e.unit || '')) + '</span></label>';
        }).join('') +
        (sel.length ? '<div class="igrp__s">' + nf(sel.length) + ' selected · ' +
          nf(sel.reduce(function (a, w) { return a + (+w.qty || 0); }, 0), 2) + ' ' + esc(tu(e.unit || '')) +
          (SP.range(sel) ? ' · ' + esc(SP.range(sel)) : '') + '</div>' : '') +
        '</div>';
    });
    return h;
  }

  /* ── 공종 선택 ─────────────────────────────────────── */
  function workHTML() {
    var groups = A.groupsOf(V.s);
    var items = V.grp ? A.itemsOf(V.s, V.grp) : [];
    var e = V.key ? A.item(V.key) : null;
    var spot = '';
    if (e && e.kind === 'F') {
      var cols = A.facCols(e.fac);
      spot = bfld('spot', '<select class="in" data-v="spot"><option value="-1">' + esc(window.I18N.en.pick) + '</option>' +
        opts(cols, V.spot, function (x) { return cols.indexOf(x); }) + '</select>');
    }
    return '<div class="f-row">' +
      bfld('grp', '<select class="in" data-v="grp"><option value="">' + esc(window.I18N.en.pick) + '</option>' +
        opts(groups, V.grp, function (x) { return x.grp; }, function (x) { return tw(x.grp) + ' (' + x.items.length + ')'; }) + '</select>') +
      bfld('work', '<select class="in" data-v="key"' + (items.length ? '' : ' disabled') + '>' +
        '<option value="">' + esc(window.I18N.en.pick) + '</option>' +
        items.map(function (x) {
          return '<option value="' + esc(x.key) + '"' + (x.key === V.key ? ' selected' : '') + '>' +
            esc(tw(x.name) + (x.spec ? ' · ' + ts(x.spec) : '') + '  [' + tu(x.unit) + ']' +
                (x.code ? '  (' + x.code + ')' : '')) + '</option>';
        }).join('') + '</select>') +
      spot + '</div>';
  }
  function workGet() {
    if (!V.key) return null;
    var e = A.item(V.key); if (!e) return null;
    if (e.kind === 'F' && V.spot < 0) return null;
    return { loc: loc(), key: V.key, spot: e.kind === 'F' ? V.spot : null, e: e };
  }

  /* ── 인원 다이얼 ───────────────────────────────────── */
  var JOB_AR = { eng: 'مهندس', fmn: 'مشرف', wkr: 'عامل' };
  function dialHTML() {
    var opr = A.oprCount(V.eq);
    return '<div class="f-row">' + A.JOBS.map(function (j) {
      return '<div><label class="fl"><span class="bi">' + esc(j.en) +
        '<span class="sl">/</span><span class="ar">' + esc(JOB_AR[j.id] || '') + '</span></span></label>' +
        '<div class="dial"><button type="button" data-dl="' + j.id + '" data-d="-1">−</button>' +
        '<input class="in num" data-dv="' + j.id + '" type="number" min="0" step="1" value="' + (V.ppl[j.id] || 0) + '">' +
        '<button type="button" data-dl="' + j.id + '" data-d="1">+</button></div></div>';
    }).join('') +
      '<div><label class="fl">' + bl('opr_auto') + '</label>' +
      '<div class="in" style="background:var(--wash);text-align:center;font-weight:700" id="vOpr">' + nf(opr) + '</div></div>' +
      '</div><div class="hint">' + bl('total') + ' <b id="vSum">' + nf(A.pplSum(V.ppl) + opr) + '</b></div>';
  }

  /* ── 장비 선택 ─────────────────────────────────────── */
  function eqHTML() {
    var sizes = V.eqcat ? A.eqSizes(V.eqcat) : [];
    return '<div class="f-row">' +
      bfld('eqcat', '<select class="in" data-v="eqcat"><option value="">' + esc(window.I18N.en.pick) + '</option>' +
        opts(A.EQ_TREE, V.eqcat, function (x) { return x.cat; }, function (x) { return x.cat; }) + '</select>') +
      bfld('eqsize', '<select class="in" data-v="eqsize"' + (sizes.length ? '' : ' disabled') + '>' +
        opts(sizes, V.eqsize) + '</select>') + '</div>' +
      '<div class="f-row" style="margin-top:10px">' +
      bfld('run', '<input class="in num" data-eqn="run" type="number" min="0" step="1" value="0">') +
      bfld('brk', '<input class="in num" data-eqn="brk" type="number" min="0" step="1" value="0">') +
      fld('&nbsp;', '<button class="btn btn--g" id="vEqAdd">' + bl('eqadd') + '</button>') + '</div>' +
      (V.eq.length ? '<div style="margin-top:12px">' + V.eq.map(function (x, i) {
        return '<div class="eqrow"><span class="eqrow__n">' + esc(A.eqLabel(x.cat, x.size)) + '</span>' +
          '<span class="bd">' + esc(window.I18N.en.run) + ' ' + nf(x.run) + '</span>' +
          (x.brk ? '<span class="bd bd--d">' + esc(window.I18N.en.brk) + ' ' + nf(x.brk) + '</span>' : '') +
          '<button class="btn btn--g btn--sm" data-eqdel="' + i + '">✕</button></div>';
      }).join('') + '</div>' : '');
  }

  /* ── 자재 선택 ─────────────────────────────────────── */
  function matHTML() {
    var grps = A.matGroups();
    var subs = V.mgrp ? A.matSubs(V.mgrp) : [];
    var mats = (V.mgrp && V.msub) ? A.matItems(V.mgrp, V.msub) : [];
    var cur = (V.mmat !== '' && mats[V.mmat]) ? mats[V.mmat] : null;
    return '<div class="f-row">' +
      bfld('grp', '<select class="in" data-v="mgrp"><option value="">' + esc(window.I18N.en.pick) + '</option>' +
        opts(grps, V.mgrp) + '</select>') +
      bfld('sub', '<select class="in" data-v="msub"' + (subs.length ? '' : ' disabled') + '>' +
        '<option value="">' + esc(window.I18N.en.pick) + '</option>' + opts(subs, V.msub) + '</select>') +
      '</div><div style="margin-top:12px">' +
      bfld('m_mat', '<select class="in" data-v="mmat"' + (mats.length ? '' : ' disabled') + '>' +
        '<option value="">' + esc(window.I18N.en.pick) + '</option>' +
        mats.map(function (m, i) {
          return '<option value="' + i + '"' + (String(V.mmat) === String(i) ? ' selected' : '') + '>' +
            esc(tm(m.mat) + (m.spec ? ' · ' + ts(m.spec) : '') + '  [' + tu(m.unit) + ']') + '</option>';
        }).join('') + '</select>') + '</div>' +
      (cur ? '<div class="hint">' + (cur.plant
        ? '<span class="bd bd--o">Plant supplied / مواد المحطة</span>'
        : '<span class="bd">Store / مواد المخزن</span>') + '</div>' : '');
  }
  function matGet() {
    if (!V.mgrp || !V.msub || V.mmat === '') return null;
    var mats = A.matItems(V.mgrp, V.msub), m = mats[V.mmat];
    return m ? m : null;
  }

  /* ── 전송 상태 배지 ────────────────────────────────
     up: 1 전송됨 / 0·undefined 기기에만 있음 / null 전송 대상 아님 */
  function upBadge(up) {
    if (up === null || up === undefined) return '';
    return up ? '<span class="bd" title="Uploaded">✓</span>'
              : '<span class="bd bd--o" title="Not uploaded">↑</span>';
  }

  /* 전송 대상 5종 — 여기 한 곳만 고치면 배지·재전송이 함께 따라온다 */
  var SETS = [
    { t: 'work', get: function () { return S.work; } },
    { t: 'crew', get: function () { return S.crew; } },
    { t: 'insp', get: function () { return S.insp; } },
    { t: 'surv', get: function () { return S.surv; } },
    { t: 'mat',  get: function () { return S.mreq; } }
  ];

  /* 아직 서버로 못 보낸 것 (종류 무관) */
  function pending() {
    var out = [];
    SETS.forEach(function (s) {
      s.get().forEach(function (x) { if (!x.up) out.push({ t: s.t, row: x }); });
    });
    return out;
  }

  function retryHTML() {
    var n = pending().length;
    if (!n) return '';
    return '<div class="vretry"><span>Not uploaded <b>' + nf(n) + '</b>' +
      '<span class="sl">/</span><span class="ar">لم يُرفع <b>' + nf(n) + '</b></span></span>' +
      '<button class="btn btn--g btn--sm" id="vRetry">Retry<span class="sl">/</span>' +
      '<span class="ar">إعادة الإرسال</span></button></div>';
  }

  /* ── 재확인 요청 (v2.15.0) ─────────────────────────────
     현장에서 생산성이 기준을 크게 넘으면 관리자가 재확인을 건다.
     막지는 않는다 — 장비 증투·야간이면 정상이다. 다만 답은 받아야 한다.
     ★날짜와 무관하게 답이 올 때까지 남는다. */
  function rcHTML() {
    var lk = A.locKey(loc()), out = [];
    S.work.forEach(function (x) {
      if (x.st === 'recheck' && A.locKey(x.loc) === lk) out.push(x);
    });
    if (!out.length) return '';
    var WHY = { eqadd: 'Extra equipment / معدات إضافية', night: 'Night work / عمل ليلي',
                typo: 'Input error / خطأ إدخال', etc: 'Other / أخرى' };
    return '<div class="card card--d" style="margin-bottom:16px">' +
      '<div class="card__h"><b>Re-check requested<span class="sl">/</span>' +
      '<span class="ar">مطلوب إعادة التحقق</span></b></div>' +
      '<div class="tw"><table><tbody>' + out.map(function (x) {
        return '<tr><td class="sp">' + esc(x.date) + '</td>' +
          '<td class="nm">' + esc(tw((A.item(x.key) || {}).name || x.key)) + '</td>' +
          '<td class="r">' + nf(x.qty, 2) + '</td>' +
          '<td><span class="bd bd--o">' + esc(WHY[x.rcWhy] || WHY.etc) + '</span></td>' +
          '<td><input class="in" data-rcans="' + esc(x.id) + '" value="' + esc(x.rcAns || '') +
          '" placeholder="Reason / السبب"></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="hint">Enter the reason and it goes back for approval<span class="sl">/</span>' +
      '<span class="ar">أدخل السبب ليعاد للاعتماد</span></div></div>';
  }

  /* ── 오늘 내가 넣은 것 ─────────────────────────────── */
  function mineHTML() {
    var d = A.today(), lk = A.locKey(loc()), out = [];
    S.work.forEach(function (x) {
      if (x.date === d && A.locKey(x.loc) === lk)
        out.push(['Output / الإنتاج', tw((A.item(x.key) || {}).name || x.key), nf(x.qty, 2), x.st, x.up ? 1 : 0]);
    });
    S.crew.forEach(function (x) {
      if (x.date === d && A.locKey(x.loc) === lk)
        out.push(['Crew / العمالة', tw((A.item(x.key) || {}).name || x.key),
                  nf(x.teams) + ' crew / ' + nf(A.crewTotal(x)) + ' pax', x.st, x.up ? 1 : 0]);
    });
    S.insp.forEach(function (x) {
      if (x.date === d && A.locKey(x.loc) === lk)
        out.push(['Inspection / الفحص', tw((A.item(x.key) || {}).name || x.key), nf(x.qty, 2), x.st, x.up ? 1 : 0]);
    });
    S.surv.forEach(function (x) {
      if (x.date === d && A.locKey(x.loc) === lk)
        out.push(['Survey / المساحة', tw((A.item(x.key) || {}).name || x.key), '—', x.done ? 'done' : 'open', x.up ? 1 : 0]);
    });
    S.mreq.forEach(function (x) {
      if (x.date === d && A.locKey(x.loc) === lk)
        out.push(['Material / المادة', tm(x.mat), nf(x.qty, 2) + ' ' + tu(x.unit), x.st, x.up ? 1 : 0]);
    });
    if (!out.length) return '<div class="empty">No entries today / لا مدخلات اليوم</div>';
    return '<div class="tw"><table><tbody>' + out.map(function (r) {
      return '<tr><td class="sp">' + esc(r[0]) + '</td><td class="nm">' + esc(r[1]) + '</td>' +
        '<td class="r">' + esc(r[2]) + '</td><td class="c"><span class="bd">' + esc(r[3]) + '</span></td>' +
        '<td class="c">' + upBadge(r[4]) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }

  /* 목록만 다시 그린다(전체 render는 입력값을 날리므로 쓰지 않는다) */
  function paintMine() {
    var m = $('#vMine');
    if (!m) return;
    m.innerHTML = rcHTML() + retryHTML() + mineHTML();
    A.$$('[data-rcans]').forEach(function (el) {
      el.onchange = function () {
        S.work.forEach(function (w) {
          if (w.id === el.dataset.rcans) { w.rcAns = el.value; w.st = 'wait'; }
        });
        A.save(); V.render();
      };
    });
    var b = $('#vRetry');
    if (b) b.onclick = retryAll;
  }

  /* ── 탭 본문 ───────────────────────────────────────── */
  function body() {
    var t = V.tab;
    if (t === 'work') return workHTML() + roadHTML() +
      '<div class="f-row" style="margin-top:12px">' +
      bfld('date', '<input class="in" id="vDate" type="date" value="' + A.yday() + '">') +
      bfld('qty', '<input class="in num" id="vQty" type="number" step="any" placeholder="0"' +
           (V.side.length ? ' value="' + esc(totalLen() ? nf(totalLen(), 2).replace(/,/g, '') : '') + '" readonly' : '') + '>') +
      bfld('by', '<input class="in" id="vBy" value="' + esc(V.by) + '" placeholder="Company / الشركة">') +
      '</div>' +
      '<div style="margin-top:10px">' + inspCk() + '</div>';

    if (t === 'crew') return workHTML() +
      '<div class="f-row" style="margin-top:12px">' +
      bfld('date', '<input class="in" id="vDate" type="date" value="' + A.yday() + '">') +
      bfld('teams', '<input class="in num" id="vTeams" type="number" min="1" step="1" value="1">') +
      bfld('by', '<input class="in" id="vBy" value="' + esc(V.by) + '" placeholder="Company / الشركة">') +
      '</div>' +
      '<div class="vsec">' + bl('people') + '</div><div id="vDial">' + dialHTML() + '</div>' +
      '<div class="vsec">' + bl('equip') + '</div><div id="vEq">' + eqHTML() + '</div>';

    if (t === 'insp') return inspHTML();

    if (t === 'surv') return workHTML() +
      '<div class="f-row" style="margin-top:12px">' +
      bfld('date', '<input class="in" id="vDate" type="date" value="' + A.today() + '">') +
      bfld('by', '<input class="in" id="vBy" value="' + esc(V.by) + '" placeholder="Name / الاسم">') +
      '</div>' +
      '<div style="margin-top:12px">' + bfld('reason',
        '<textarea class="in" id="vWhy" rows="3" placeholder="TBM / CP point check ... / فحص نقطة"></textarea>') + '</div>';

    return matHTML() +
      '<div class="f-row" style="margin-top:12px">' +
      bfld('date', '<input class="in" id="vDate" type="date" value="' + A.today() + '">') +
      bfld('qty', '<input class="in num" id="vQty" type="number" step="any" placeholder="0">') +
      bfld('by', '<input class="in" id="vBy" value="' + esc(V.by) + '" placeholder="Company / الشركة">') +
      '</div>';
  }

  var TABS = [
    { id: 'work', en: 'Output', ar: 'الإنتاج' },
    { id: 'crew', en: 'Manpower & Equipment', ar: 'العمالة والمعدات' },
    { id: 'insp', en: 'Inspection', ar: 'الفحص' },
    { id: 'surv', en: 'Survey', ar: 'المساحة' },
    { id: 'mat', en: 'Material request', ar: 'طلب مادة' }
  ];

  function render() {
    /* 명부가 등록됐는데 업체 링크가 없으면 입력 자체를 막는다 */
    if (!vendGate()) {
      $('#vTabs').innerHTML = '';
      $('#vLoc').innerHTML = '';
      $('#vBody').innerHTML = gateHTML();
      $('#vMine').innerHTML = '';
      return;
    }
    $('#vTabs').innerHTML = TABS.map(function (t) {
      return '<button data-vt="' + t.id + '" aria-selected="' + (t.id === V.tab) + '">' +
        esc(t.en) + '<em>' + esc(t.ar) + '</em></button>';
    }).join('');
    $('#vLoc').innerHTML = locHTML() + compHTML();
    $('#vBody').innerHTML = body();
    paintMine();
    bind();
  }

  function num(id) { var e = $(id); var v = parseFloat(String(e ? e.value : '').replace(/,/g, '')); return isNaN(v) ? 0 : v; }
  function str(id) { var e = $(id); return e ? String(e.value).trim() : ''; }
  function say(t, ok) {
    var e = $('#vMsg'); if (!e) return;
    var cls = ok === 1 || ok === true ? 'ok' : (ok === 'wait' ? 'wait' : 'err');
    e.textContent = t; e.className = 'vmsg ' + cls;
    setTimeout(function () { if (e) { e.textContent = ''; e.className = 'vmsg'; } }, 5000);
  }

  function bind() {
    $$('[data-vt]').forEach(function (b) {
      b.onclick = function () { V.tab = b.dataset.vt; render(); window.scrollTo(0, 0); };
    });
    $$('[data-v]').forEach(function (el) {
      el.onchange = function () {
        var f = el.dataset.v;
        V[f] = (f === 'p' || f === 'c' || f === 'b' || f === 'spot') ? +el.value : el.value;
        if (f === 's') { V.grp = ''; V.key = ''; V.spot = -1; V.p = 1; V.c = 1; V.t = 'A'; V.b = 1; }
        if (f === 'grp') { V.key = ''; V.spot = -1; }
        if (f === 'key') V.spot = -1;
        if (f === 't') V.b = 1;
        if (f === 'mgrp') { V.msub = ''; V.mmat = ''; }
        if (f === 'msub') V.mmat = '';
        if (f === 'rw') V.rno = '';
        if (f === 'staff') V.by = el.value;
        if (f === 'eqcat') V.eqsize = (A.eqSizes(el.value) || [])[0] || '';
        render();
      };
    });
    /* 좌·중앙·우 체크 — 켤 때 측점 칸이 생기고, 끌 때 그 쪽 입력을 지운다 */
    $$('[data-side]').forEach(function (el) {
      el.onchange = function () {
        var id = el.dataset.side, i = V.side.indexOf(id);
        if (el.checked && i < 0) V.side.push(id);
        if (!el.checked && i >= 0) { V.side.splice(i, 1); delete V.sta[id]; }
        render();
      };
    });
    /* 측점 — 입력할 때마다 연장을 다시 계산해 보여준다 */
    $$('[data-sta]').forEach(function (el) {
      el.oninput = function () {
        var p = el.dataset.sta.split('.'), id = p[0], k = p[1];
        if (!V.sta[id]) V.sta[id] = {};
        V.sta[id][k] = el.value;
        var lab = el.parentNode.querySelector('.stalen');
        if (lab) lab.textContent = sideLenText(id);
        var tot = $('#vQty');
        if (tot) tot.value = totalLen() ? nf(totalLen(), 2).replace(/,/g, '') : '';
        var tt = document.querySelector('.statot');
        if (tt) tt.textContent = 'Total ' + nf(totalLen(), 2) + ' m';
      };
    });
    var memo = $('#vMemo');
    if (memo) memo.oninput = function () { V.rmemo = memo.value; };
    var need = $('#vNeed');
    if (need) need.onchange = function () { V.need = need.checked; };
    /* 검측 신청 — 실적 선택 */
    $$('[data-pick]').forEach(function (el) {
      el.onchange = function () {
        var id = el.dataset.pick, i = V.pick.indexOf(id);
        if (el.checked && i < 0) V.pick.push(id);
        if (!el.checked && i >= 0) V.pick.splice(i, 1);
        render();
      };
    });
    var lay = $('#vLayer');
    if (lay) lay.oninput = function () { V.layer = Math.max(1, parseInt(lay.value, 10) || 1); };
    // 다이얼
    function sync() {
      A.JOBS.forEach(function (j) {
        var el = $('[data-dv="' + j.id + '"]');
        if (el) V.ppl[j.id] = Math.max(0, parseInt(el.value, 10) || 0);
      });
      var opr = A.oprCount(V.eq);
      var o = $('#vOpr'); if (o) o.textContent = nf(opr);
      var s = $('#vSum'); if (s) s.textContent = nf(A.pplSum(V.ppl) + opr);
    }
    $$('[data-dl]').forEach(function (b) {
      b.onclick = function () {
        var el = $('[data-dv="' + b.dataset.dl + '"]');
        el.value = Math.max(0, (parseInt(el.value, 10) || 0) + (+b.dataset.d)); sync();
      };
    });
    $$('[data-dv]').forEach(function (el) { el.oninput = sync; });
    // 장비
    if ($('#vEqAdd')) $('#vEqAdd').onclick = function () {
      if (!V.eqcat) return;
      var g = function (f) { var e = $('[data-eqn="' + f + '"]'); return Math.max(0, parseInt(e && e.value, 10) || 0); };
      /* ★ 수리 칸은 없앴다 — 우리 입장에서 서 있는 건 서 있는 것이고,
         사유는 협력업체·정비팀 소관이다. rep은 옛 데이터 호환용으로만 남긴다. */
      var run = g('run'), brk = g('brk');
      if (!run && !brk) return;
      V.eq.push({ cat: V.eqcat, size: V.eqsize || '', run: run, brk: brk, rep: 0 });
      render();
    };
    $$('[data-eqdel]').forEach(function (b) {
      b.onclick = function () { V.eq.splice(+b.dataset.eqdel, 1); render(); };
    });
    $('#vSave').onclick = function () {
      var b = $('#vSave');
      if (b.disabled) return;          // 연타로 두 건 들어가는 것 차단
      b.disabled = true;
      try { submit(); } finally {
        setTimeout(function () { var x = $('#vSave'); if (x) x.disabled = false; }, 1200);
      }
    };
  }

  /* ── 서버 전송 ──────────────────────────────────────
     실패해도 로컬 저장은 유지된다. 입력이 날아가는 일은 없다.
     종류마다 담기는 항목이 달라 payload를 나눠 만든다.
     위치는 라벨을 되파싱하지 않도록 구성요소(s/p/c/t/b)를 함께 보낸다. */
  function locParts(L) {
    L = L || {};
    return { loc: A.locLabel(L), s: L.s, p: L.p, c: L.c, t: L.t, b: L.b };
  }
  function merge(a, b) {
    for (var k in b) if (Object.prototype.hasOwnProperty.call(b, k)) a[k] = b[k];
    return a;
  }

  function payload(type, row) {
    var e = A.item(row.key), base = merge({ id: row.id, date: row.date }, locParts(row.loc));
    base.by = row.by || '';
    base.st = row.st || '';
    if (type !== 'mat') {
      base.key = row.key;
      base.spot = row.spot;
      base.name = e ? e.name : '';
      base.unit = e ? e.unit : '';
    }

    if (type === 'work') {
      base.qty = row.qty;
      base.need = !!row.need;
      var sp = row.spot;
      if (sp && sp.kind === 'road') {
        base.road = window.BNCP_SPOT.roadName(sp);
        base.side = sp.side;
        base.sta = window.BNCP_SPOT.staText(sp.f) + '~' + window.BNCP_SPOT.staText(sp.t);
        base.spot = sp;
      }
    }

    else if (type === 'crew') {
      base.qty = row.teams;                 // 시트 수량칸엔 조 수를 넣는다
      base.teams = row.teams;
      base.ppl = row.ppl;
      base.eq = row.eq;
      base.pax = A.crewTotal(row);
    }

    else if (type === 'insp') {
      base.qty = row.qty;
      base.note = row.note || '';
      base.seq = row.seq || 1;
      base.stAt = row.stAt || '';
      base.reason = row.reason || '';
      base.stage = window.BNCP_SPOT.stageName(row.stage, row.layer);
      base.layer = row.layer || 0;
      base.range = row.range || '';
      base.from = row.from || '';
      base.to = row.to || '';
      base.src = row.src || [];
      if (row.spot) base.spot = row.spot;
    }

    else if (type === 'surv') {
      base.qty = '';
      base.why = row.why || '';
      base.done = !!row.done;
      base.st = row.done ? 'done' : 'open';
    }

    else if (type === 'mat') {
      base.qty = row.qty;
      base.grp = row.grp; base.sub = row.sub; base.mat = row.mat;
      base.spec = row.spec || ''; base.unit = row.unit || '';
      base.plant = !!row.plant;
      base.name = row.mat;
    }

    return base;
  }

  function toServer(type, row) {
    var api = window.BNCP_API;
    row.up = 0;
    if (!api || !api.on) { paintMine(); return; }
    say('Submitted · sending… / تم الإرسال · جارٍ الرفع', 'wait');
    try {
      api.send(type, payload(type, row)).then(function (r) {
        row.up = (r && r.ok) ? 1 : 0;
        A.save();
        paintMine();
        if (row.up) say('Uploaded ✓ / تم الرفع', 1);
        else say('Saved on device — not uploaded / محفوظ على الجهاز — لم يُرفع', 'wait');
      });
    } catch (err) {
      paintMine();   // 전송 실패는 무시 — 로컬 저장이 우선
    }
  }

  /* 못 올라간 것 모두 다시 보낸다.
     같은 id로 보내면 서버가 그 줄을 덮어쓰므로 중복이 생기지 않는다. */
  function retryAll() {
    var api = window.BNCP_API, list = pending();
    if (!api || !list.length) return;
    var b = $('#vRetry');
    if (b) { b.disabled = true; }
    say('Sending… / جارٍ الرفع', 'wait');

    var done = 0, okn = 0;
    list.forEach(function (it) {
      api.send(it.t, payload(it.t, it.row)).then(function (r) {
        if (r && r.ok) { it.row.up = 1; okn++; }
        if (++done === list.length) {
          A.save(); paintMine();
          if (okn === list.length) say('Uploaded ✓ / تم الرفع', 1);
          else say('Still not uploaded: ' + nf(list.length - okn) +
                   ' / لم يُرفع بعد: ' + nf(list.length - okn), 'wait');
        }
      });
    });
  }

  /* 같은 공종·도로·쪽에서 이미 올린 구간과 겹치는지.
     겹치면 그 실적을 돌려준다. 재시공이어도 일단 막고 사무실에서 판단한다. */
  function overlap(key, w, no, side, f, t) {
    var lo = Math.min(f, t), hi = Math.max(f, t), hit = null;
    S.work.forEach(function (x) {
      if (hit) return;
      var sp = x.spot;
      if (!sp || sp.kind !== 'road') return;
      if (x.key !== key) return;
      if (String(sp.w) !== String(w) || String(sp.no) !== String(no) || sp.side !== side) return;
      var a = Math.min(sp.f, sp.t), b = Math.max(sp.f, sp.t);
      if (lo < b && a < hi) hit = x;          // 접하는 것(끝점 일치)은 겹침 아님
    });
    return hit;
  }

  function submit() {
    V.by = str('#vBy');
    var t = V.tab, d = str('#vDate') || A.today();

    if (t === 'mat') {
      var m = matGet(); if (!m) return say('Select material / اختر المادة');
      var q = num('#vQty'); if (!q) return say('Enter quantity / أدخل الكمية');
      var mrow = A.addMreq({ date: d, loc: loc(), grp: m.grp, sub: m.sub, mat: m.mat, spec: m.spec,
                             unit: m.unit, plant: m.plant, qty: q, by: V.by });
      V.mmat = '';
      var mq = $('#vQty'); if (mq) mq.value = '';
      toServer('mat', mrow);
      return;
    }

    var g = workGet();
    if (!g) return say('Select work item / اختر البند');

    if (t === 'work') {
      var SP = window.BNCP_SPOT;
      /* 도로를 골랐으면 쪽마다 한 건씩 나눠 저장한다.
         ★ 검측이 한쪽만 불합격할 수 있으므로 묶어두면 처리가 곤란해진다. */
      if (V.side.length) {
        if (!V.rw || !V.rno) return say('Select road / اختر الطريق');
        var mk = [];
        for (var si = 0; si < V.side.length; si++) {
          var sid = V.side[si], sv = V.sta[sid] || {};
          var f = SP.sta(sv.fk, sv.fm), tt = SP.sta(sv.tk, sv.tm);
          var L = SP.len(f, tt);
          if (L === null || !L) return say('Enter station for ' + SP.sideName(sid) + ' / أدخل المحطة');
          /* ★ 이미 올린 구간과 겹치면 막는다 — 중복 청구가 실무에서 가장 흔하다.
             총연장을 몰라도 판정된다(구간끼리만 비교하므로). */
          var hit = overlap(g.key, V.rw, V.rno, sid, f, tt);
          if (hit) {
            return say('Overlaps ' + SP.staText(hit.spot.f) + '~' + SP.staText(hit.spot.t) +
                       ' (' + hit.date + ') / يتداخل مع مقطع مُقدَّم');
          }
          mk.push({
            id: A.uid(), date: d, loc: g.loc, key: g.key, spot: {
              kind: 'road', w: V.rw, no: V.rno, memo: V.rmemo, side: sid, f: f, t: tt
            },
            qty: L, by: V.by, st: 'sub', need: !!V.need, insp: '', up: 0
          });
        }
        mk.forEach(function (r) { S.work.push(r); });
        A.save();
        V.sta = {}; V.side = []; V.need = false;
        render();
        mk.forEach(function (r) { toServer('work', r); });
        return;
      }

      var q2 = num('#vQty'); if (!q2) return say('Enter quantity / أدخل الكمية');
      /* 같은 날·위치·공종·수량이 이미 있으면 실수로 두 번 누른 것일 수 있다 */
      var dup = S.work.some(function (w) {
        return w.date === d && w.key === g.key && w.qty === q2 &&
               A.locKey(w.loc) === A.locKey(g.loc);
      });
      if (dup && !confirm('Same entry already exists. Submit again? / يوجد إدخال مطابق. إرسال مرة أخرى؟')) return;
      var wrow = { id: A.uid(), date: d, loc: g.loc, key: g.key, spot: g.spot,
                   qty: q2, by: V.by, st: 'sub', need: !!V.need, insp: '', up: 0 };
      S.work.push(wrow);
      A.save();
      var qEl = $('#vQty'); if (qEl) qEl.value = '';   // 같은 값이 남아 또 눌리는 것 방지
      V.need = false;
      toServer('work', wrow);
      return;
    } else if (t === 'crew') {
      var tm = Math.max(0, parseInt(str('#vTeams'), 10) || 0);
      if (!tm) return say('Enter crews / أدخل عدد الأطقم');
      if (!A.pplSum(V.ppl) && !V.eq.length) return say('Enter manpower or equipment / أدخل العمالة أو المعدات');
      var crow = { id: A.uid(), date: d, loc: g.loc, key: g.key, spot: g.spot, teams: tm,
                   ppl: JSON.parse(JSON.stringify(V.ppl)), eq: JSON.parse(JSON.stringify(V.eq)),
                   by: V.by, st: 'sub', up: 0 };
      S.crew.push(crow);
      V.ppl = { eng: 0, fmn: 0, wkr: 0 }; V.eq = [];
      A.save(); render();
      toServer('crew', crow);
      return;
    } else if (t === 'insp') {
      var SP = window.BNCP_SPOT;
      if (!V.pick.length) return say('Select output to apply / اختر الإنتاج للتقديم');
      var rows = S.work.filter(function (w) { return V.pick.indexOf(w.id) >= 0; });
      if (!rows.length) return say('Select output to apply / اختر الإنتاج للتقديم');

      /* 서로 다른 공종·도로가 섞이면 검측 결과가 어디에 걸리는지 흐려진다 */
      var gk0 = rows[0].key + '||' + SP.groupKey(rows[0].spot);
      var mixed = rows.some(function (w) { return (w.key + '||' + SP.groupKey(w.spot)) !== gk0; });
      if (mixed) return say('Select one work item / group only / اختر بنداً واحداً فقط');

      var qsum = rows.reduce(function (a, w) { return a + (+w.qty || 0); }, 0);
      var dates = rows.map(function (w) { return w.date; }).sort();
      var irow = {
        id: A.uid(), date: A.today(), loc: rows[0].loc, key: rows[0].key,
        spot: rows[0].spot,
        qty: qsum, st: 'apply', stAt: A.today(), reason: '',
        by: V.by, note: '', seq: 1, hist: [], up: 0,
        /* ★ 단계(stage)와 차수(seq)는 다르다. 섞으면 통계가 흐려진다 */
        stage: V.stage, layer: V.stage === 'bf' ? V.layer : 0,
        src: rows.map(function (w) { return w.id; }),
        from: dates[0], to: dates[dates.length - 1],
        range: SP.range(rows)
      };
      S.insp.push(irow);
      rows.forEach(function (w) { w.insp = irow.id; });   // 신청한 실적은 목록에서 사라진다
      V.pick = [];
      A.save(); render();
      toServer('insp', irow);
      return;
    } else if (t === 'surv') {
      var why = str('#vWhy'); if (!why) return say('Enter reason / أدخل السبب');
      var srow = { id: A.uid(), date: d, loc: g.loc, key: g.key, spot: g.spot,
                   why: why, by: V.by, done: false, up: 0 };
      S.surv.push(srow);
      A.save();
      toServer('surv', srow);
      return;
    }
  }

  /* state는 검사(smoke)에서 화면 상태를 만들기 위해 노출한다.
     화면 코드는 내부 V를 쓰므로 이걸 통해 조작해도 동작이 달라지지 않는다. */
  window.VENDOR = { render: render, state: V };
})();
