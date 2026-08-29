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
    tag: '',                        // 표기(도면 라벨) — 관로·전기 계열 (v2.26.0)
    why: '', whyEtc: '',            // 측량 사유: 고른 항목 / 「기타」 직접입력 (v2.27.0)
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

  /* ★소속 회사명 (v2.30.0 · 요청 ①).
     담당자 배정(v2.19.2) 이후 `by`는 **담당자 이름**이 됐다. 그런데 장비현황
     「업체별」 집계(rollupCo)는 `by`를 회사로 보고 묶는다 — 그래서 보유는
     회사명 줄, 가동은 담당자 이름 줄로 갈렸다.
     → crew에 회사명을 담을 `co`를 따로 둔다. 링크로 업체가 고정돼 있으면
       그 정식 업체명(V.comp.name), 명부 미등록 자유입력 현장이면 `by`가
       종전대로 곧 회사명이므로 그것을 쓴다. */
  function vco() {
    return (V.comp && V.comp.name) ? V.comp.name : (V.by || '');
  }

  /* ── 측량 요청 사유 (요청 1 · v2.27.0) ────────────────
     ★우리는 시공측량을 하지 않는다 (0-V). CP·TBM을 내려주고, **내려준
       점이 틀리거나 이상하다**고 협력업체가 알려올 때 나간다. 그래서
       사유도 그 범위 안에서만 나온다 — 도로·구간을 재달라는 것이 아니다.
     ★종전에는 빈 칸에 자유입력이었다. 업체마다 말이 달라 같은 사유가
       열 가지로 적혔고, 무엇이 잦은지 셀 수가 없었다.
     ★★목록이 실제 현장 말과 다르면 **여기만 고치면 된다.** 화면·저장·
       집계가 전부 이 표를 따라간다. 사용자 확인 필요.
     ★저장은 **고른 항목의 영문 글**을 그대로 `why`에 넣는다. 관리자 화면과
       독촉 문안이 종전부터 `why`를 글로 읽고 있어, 코드값으로 바꾸면
       그쪽을 전부 손봐야 한다. 글로 넣으면 아무 데도 안 깨진다. */
  var SURV_WHY = [
    { id: 'cp_lost',  en: 'CP point lost or damaged',        ar: 'نقطة التحكم مفقودة أو تالفة' },
    { id: 'cp_bad',   en: 'CP coordinates do not match',     ar: 'إحداثيات نقطة التحكم غير مطابقة' },
    { id: 'tbm_lost', en: 'TBM lost or damaged',             ar: 'نقطة المنسوب مفقودة أو تالفة' },
    { id: 'tbm_bad',  en: 'TBM level does not match',        ar: 'منسوب النقطة غير مطابق' },
    { id: 'need_pt',  en: 'No control point in work area',   ar: 'لا توجد نقطة تحكم في منطقة العمل' },
    { id: 'add_pt',   en: 'Additional point requested',      ar: 'مطلوب نقطة إضافية' },
    { id: 'dwg_diff', en: 'Drawing does not match site',     ar: 'المخطط لا يطابق الموقع' },
    { id: 'center',   en: 'Centreline check',                ar: 'فحص المحور' },
    { id: 'level',    en: 'Level / gradient check',          ar: 'فحص المنسوب والميل' },
    { id: 'struct',   en: 'Structure setting-out check',     ar: 'فحص توقيع المنشأ' },
    { id: 'obstr',    en: 'Existing utility position check', ar: 'فحص موقع المرافق القائمة' },
    { id: 'recheck',  en: 'Re-check after correction',       ar: 'إعادة الفحص بعد التصحيح' }
  ];
  var WHY_ETC = 'etc';
  /** 고른 사유의 저장용 글. 「기타」면 직접 친 글 */
  function whyText() {
    if (V.why === WHY_ETC) return String(V.whyEtc || '').trim();
    var t = '';
    SURV_WHY.forEach(function (x) { if (x.id === V.why) t = x.en; });
    return t;
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
  /* ── 표기 (요청 12·13 · 0-P 확정) ─────────────────────
     ★관로·전기 계열은 **도로·측점 대신 도면 라벨**을 위치로 쓴다.
       협력업체가 도면에 적힌 표기를 그대로 친다 → 스탭이 틀리면 반려 →
       재입력. 관리자 화면에는 입력한 표기 그대로 뜬다.
     ★자리표시(placeholder)에 그 공종의 실제 예시를 넣는다 — 안내 문구를
       따로 두면 아무도 안 읽는다. 부지와 부대는 표기가 달라 예시도 다르다. */
  function tagHTML() {
    var SP = window.BNCP_SPOT, ex = SP.tagHint(V.s, V.grp);
    if (!ex) return '';
    return '<div class="f-row" style="margin-top:12px">' +
      fld('Marking / الترميز',
        '<input class="in" id="vTag" value="' + esc(V.tag) + '" placeholder="' + esc(ex) + '">') +
      '</div>' +
      '<div class="sp" style="margin-top:6px">' + esc(ex) + '</div>';
  }

  /* ★도로 칸과 표기 칸은 **동시에 뜨지 않는다.** 관로에 도로를 물으면
     업체가 억지로 아무 도로나 고르게 되고, 그러면 겹침 검사가 엉뚱한
     구간을 막는다. 고른 공종이 어느 쪽인지에 따라 하나만 보인다. */
  function placeHTML() {
    return window.BNCP_SPOT.needTag(V.s, V.grp) ? tagHTML() : roadHTML();
  }

  function roadHTML() {
    var SP = window.BNCP_SPOT, anc = V.s === 'anc';
    var wsel, nsel, i;

    if (anc) {
      /* ★부대토목은 **블록-번호**다 (2026-08-23 확정). 도로폭 기준이 없다.
         블록코드는 이미 고른 위치에서 나오므로 따로 묻지 않는다 —
         업체는 번호 하나만 고른다(B6 → B6-1~B6-30, 30개 고정). */
      var blk = SP.blkCode(loc());
      V.rw = blk;                       /* 저장 모양은 부지와 같다 — w에 블록코드 */
      wsel = '<input class="in" value="' + esc(blk) + '" readonly>';
      var anos = '';
      for (i = 1; i <= SP.ANC_ROADS; i++) {
        anos += '<option value="' + i + '"' + (String(i) === String(V.rno) ? ' selected' : '') + '>' +
          esc(blk) + '-' + i + '</option>';
      }
      nsel = '<select class="in" data-v="rno"><option value="">Road / الطريق</option>' + anos + '</select>';
    } else {
      var ws = SP.widths(S.roadX);
      wsel = '<select class="in" data-v="rw"><option value="">Width / العرض</option>' +
        ws.map(function (x) {
          return '<option value="' + esc(x.w) + '"' + (x.w === V.rw ? ' selected' : '') + '>' + esc(x.w) + 'm</option>';
        }).join('') + '</select>';

      var max = V.rw ? SP.maxNo(V.rw, S.roadX) : 0, nos = '';
      for (i = 1; i <= max; i++) {
        nos += '<option value="' + i + '"' + (String(i) === String(V.rno) ? ' selected' : '') + '>' + i + '</option>';
      }
      nsel = '<select class="in" data-v="rno"' + (max ? '' : ' disabled') + '>' +
        '<option value="">No. / رقم</option>' + nos + '</select>';
    }

    var sides = SP.SIDES.map(function (x) {
      var on = V.side.indexOf(x.id) >= 0;
      return '<label class="ck"><input type="checkbox" data-side="' + x.id + '"' + (on ? ' checked' : '') + '> ' +
        esc(x.en) + '<span class="sl">/</span><span class="ar">' + esc(x.ar) + '</span></label>';
    }).join('');

    /* 고른 쪽마다 측점 한 줄씩
       ★뒤 칸은 스테이션 **안에서의 미터(0~19)** 다 — 1스테이션=20m이므로
         0+19 다음은 1+00이다. max=19로 막아 0+20이 들어오는 것을 미리 끊는다
         (SPOT.sta도 20 이상이면 null을 낸다 — 두 겹으로 막는다). */
    /* ★★측점은 **고르는 것이다 — 직접입력 금지** (2026-08-23 사용자 확정).
       손으로 치면 1+20 같은 **없는 측점**이 들어온다. 그러면 같은 지점이 두
       가지로 적혀 겹침 검사도 연장 계산도 조용히 어긋난다.
       ★뒤 칸은 0~19까지만 만든다 — 20은 목록에 아예 없다(다음 스테이션이다). */
    /* ★스테이션 번호(앞 칸)는 **숫자로 친다** — 10km 도로면 No.500까지 간다.
         500개짜리 드롭다운은 못 쓴다(사용자 지적 「400번대 어떻게 입력해」).
         SPOT.sta는 어떤 정수든 받으므로(k≥0) 번호 타이핑은 안전하다.
       ★뒤 +칸(미터)만 0~19 드롭다운으로 남긴다 — 「1+20」 같은 없는 측점은
         여전히 원천 차단된다(인수인계서가 지킨 안전장치는 여기다). */
    function staSel(id, f, val) {
      if (f === 'fk' || f === 'tk') {
        return '<input class="in sta-no" type="number" min="0" step="1" inputmode="numeric" ' +
          'data-sta="' + id + '.' + f + '" value="' + (val == null ? '' : esc(val)) +
          '" placeholder="No.">';
      }
      return '<select class="in" data-sta="' + id + '.' + f + '"><option value="">–</option>' +
        SP.staMs().map(function (n) {
          var t = ('0' + n).slice(-2);
          return '<option value="' + n + '"' +
            (String(n) === String(val) ? ' selected' : '') + '>' + t + '</option>';
        }).join('') + '</select>';
    }
    /* ★측점 줄 — 좌우센터를 골랐으면 그 쪽마다, 안 골랐으면 「전폭」 한 줄 */
    var rows = rowIds().map(function (id) {
      var v = V.sta[id] || {};
      var lab = (id === 'F') ? 'Full width' + '<span class="sl">/</span><span class="ar">كامل العرض</span>'
                             : esc(SP.sideName(id));
      return '<div class="starow"><span class="stalab">' + lab + '</span>' +
        staSel(id, 'fk', v.fk) + '<span class="staplus">+</span>' + staSel(id, 'fm', v.fm) +
        '<span class="statil">~</span>' +
        staSel(id, 'tk', v.tk) + '<span class="staplus">+</span>' + staSel(id, 'tm', v.tm) +
        '<span class="stalen">' + esc(sideLenText(id)) + '</span></div>';
    }).join('');

    return '<div class="f-row" style="margin-top:12px">' +
      fld('Road / الطريق', '<div class="two">' + wsel + nsel + '</div>') +
      fld('Note / ملاحظة', '<input class="in" id="vMemo" value="' + esc(V.rmemo) + '" placeholder="School Entrance">') +
      '</div>' +
      /* ★좌우센터는 **선택**이다 — 경계석·보도블럭처럼 쪽마다 하는 일에만 고른다.
         성토·보조기층 같은 전폭 작업은 안 골라도 위 측점이 그대로 뜬다. */
      '<div style="margin-top:10px">' + fld('Side (curb/sidewalk) / الجانب', '<div class="cks">' + sides + '</div>') + '</div>' +
      (rows ? '<div class="stas">' + rows + '</div>' : '') +
      '<div class="statot">Total ' + nf(totalLen(), 2) + ' m<span class="sl">/</span>' +
        '<span class="ar">الإجمالي</span></div>';
  }

  /* ★측점 줄의 열쇠 — 좌우센터를 골랐으면 그 쪽들, 안 골랐으면 「전폭」 한 줄.
     'F'는 전폭(Full width)이고 저장할 때 side=''로 나간다.
     ★종전에는 좌우센터를 골라야만 측점 칸이 떴다(사용자 지적 「반대다」).
       성토·보조기층은 전폭 작업이라 side가 없다 — 이제 측점이 기본으로 뜨고
       경계석·보도블럭 할 때만 좌우센터를 고른다. */
  function rowIds() { return V.side.length ? V.side.slice() : ['F']; }

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
    rowIds().forEach(function (id) { var L = sideLen(id); if (L !== null) s += L; });
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
      /* ★오전 마무리 예외라도 협력업체 화면에서는 막지 않는다 (v2.31.0 · 요청 ⑤).
         협력업체 기기는 서버에서 실적을 받아오지 않아, 관리자의 확인(admOK)
         해제 신호가 이 화면에 내려오지 않는다. 여기서 막으면 관리자가
         확인해 줘도 영영 신청을 못 한다. → 차단은 관리자 검측 탭에서 한다.
         협력업체가 올린 검측 신청은 오전 예외면 관리자 확인 전까지 검측
         흐름의 다음 단계(제출→합격)로 넘어가지 못한다. */
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

  /* ── 진행 중 작업 고르기 (v2.37.0 · 2단계) ────────────
     ★인력·장비를 올렸는데 수량이 아직 안 들어온 작업(A.openTasks)을
       이 업체 것만 추려 보여준다. 고르면 공종·위치·도로·측점이 폼에
       그대로 채워져, 작업량 입력(work)이나 이어하기(crew)를 바로 잇는다.
     ★업체 거르기는 명부(Master)를 거친다 — 담당자 이름으로 올린 옛 줄도
       그 사람의 업체로 걸린다(A.coOf, v2.32.0과 같은 길). */
  var OT_AGE = 3;                       /* 며칠 방치되면 경고 — 관리자 카드와 같은 기준 */
  function myOpenTasks() {
    var me = A.coOf({ co: vco() }, false);
    return A.openTasks(null).filter(function (t) {
      return A.coOf(t.lastCrew, false) === me;
    });
  }
  /* 작업이 걸친 구간(spot) — task.seg에 맞는 조각을 lastCrew에서 되찾는다 */
  function taskSpot(t) {
    var c = t.lastCrew;
    if (!c) return null;
    var arr = (c.spots && c.spots.length) ? c.spots : [c.spot];
    for (var i = 0; i < arr.length; i++) {
      if (A.segOf({ spot: arr[i], tag: c.tag }) === t.seg) return arr[i];
    }
    return c.spot;
  }
  /* 고른 작업을 폼 상태(V)에 되살린다 — 인원·장비(ppl·eq)는 건드리지 않는다.
     이어하기는 「변경된 인원·장비만」 새로 넣는 것이라, 지난 값을 끌어오면
     안 된다(사용자 지시). */
  function applyTask(t) {
    var c = t.lastCrew, sp = taskSpot(t), e = A.item(t.key), STEP = window.BNCP_SPOT.STA_STEP;
    V.s = t.loc.s;
    if (t.loc.s === 'civil') { V.p = +t.loc.p; V.c = +t.loc.c; }
    else { V.t = t.loc.t; V.b = +t.loc.b; }
    V.grp = e ? e.grp : '';
    V.key = t.key;
    V.spot = -1; V.tag = ''; V.rw = ''; V.rno = ''; V.rmemo = ''; V.side = []; V.sta = {};
    if (sp && sp.kind === 'road') {
      V.rw = sp.w || ''; V.rno = sp.no || ''; V.rmemo = sp.memo || '';
      if (sp.side) V.side = [sp.side];
      var id = sp.side || 'F';
      if (sp.f !== null && sp.f !== undefined && sp.t !== null && sp.t !== undefined) {
        V.sta[id] = { fk: Math.floor(sp.f / STEP), fm: sp.f % STEP,
                      tk: Math.floor(sp.t / STEP), tm: sp.t % STEP };
      }
    } else if (typeof sp === 'number' && sp >= 0) {
      V.spot = sp;
    } else if (c && c.tag) {
      V.tag = c.tag;
    }
  }
  /* {n} 치환 병기 — 메타 한 줄 안에 들어가는 인라인 글자 (bi 블록이 아니다) */
  function blN(key, n) {
    var en = String(window.I18N.en[key] || key).replace('{n}', n);
    var ar = String(window.I18N.ar[key] || '').replace('{n}', n);
    return esc(en + (ar ? ' / ' + ar : ''));
  }
  function otLabel(t) {
    var e = A.item(t.key), sp = taskSpot(t), SP = window.BNCP_SPOT;
    var nm = e ? tw(e.name) : t.key, detail = '';
    if (sp && sp.kind === 'road') {
      detail = SP.roadName(sp);
      if (sp.side) detail += ' · ' + SP.sideName(sp.side);
      if (sp.f !== null && sp.f !== undefined)
        detail += ' · STA ' + SP.staText(sp.f) + '~' + SP.staText(sp.t);
    } else if (typeof sp === 'number' && sp >= 0) {
      var cols = e && e.fac ? A.facCols(e.fac) : [];
      detail = cols[sp] || ('#' + (sp + 1));
    } else if (t.lastCrew && t.lastCrew.tag) {
      detail = t.lastCrew.tag;
    }
    return { nm: nm, where: A.locShort(t.loc), detail: detail };
  }
  function openPickHTML(mode) {
    var list = myOpenTasks();
    var hint = mode === 'crew'
      ? 'Tap unfinished work to continue — enter only today’s manpower & equipment' +
        ' / اضغط لمتابعة العمل — أدخل عمالة ومعدات اليوم فقط'
      : 'Tap uploaded work to enter its quantity / اضغط على عمل مرفوع لإدخال كميته';
    var h = '<div class="votp"><div class="votp__h">' + bl('ot_t') +
      '<span class="votp__c">' + list.length + '</span></div>' +
      '<div class="votp__hint">' + esc(hint) + '</div>';
    if (!list.length) return h + '<div class="votp__none">' + bl('ot_none') + '</div></div>';
    h += list.map(function (t, i) {
      var L = otLabel(t), aged = !t.isNew && !t.stopped && t.age >= OT_AGE;
      /* 배지 우선순위 : 중단 > NEW > 방치 */
      var badge = t.stopped ? '<span class="votp__stop">' + bl('ot_stopped') + '</span>'
        : (t.isNew ? '<span class="votp__new">NEW</span>'
        : (aged ? '<span class="votp__aged">' + bl('ot_aged') + '</span>' : ''));
      /* 중단이면 사유·중단일수, 아니면 며칠째 */
      var tail = t.stopped
        ? esc(A.stopWhyText(t.stopWhy, 'en') + ' · ') + blN('ot_stopdays', t.stopDays)
        : blN('ot_since', t.dayN);
      /* 오른쪽 조작 : 진행중이면 중단 고르개, 중단중이면 재개 버튼 */
      var act = t.stopped
        ? '<button type="button" class="votp__resume" data-vresume="' + i + '">' +
            esc(window.I18N.en.ot_resume + ' / ' + (window.I18N.ar.ot_resume || '')) + '</button>'
        : '<select class="votp__stopsel" data-vstop="' + i + '"><option value="">' +
            esc(window.I18N.en.ot_stop + ' / ' + (window.I18N.ar.ot_stop || '')) + '…</option>' +
            A.STOP_WHY.map(function (x) {
              return '<option value="' + esc(x.id) + '">' + esc(x.en + ' / ' + x.ar) + '</option>';
            }).join('') + '</select>';
      return '<div class="votp__wrap' + (aged ? ' is-aged' : '') + (t.stopped ? ' is-stop' : '') + '">' +
        '<button type="button" class="votp__row" data-otk="' + i + '">' + badge +
        '<span class="votp__nm">' + esc(L.nm) + '</span>' +
        '<span class="votp__mt">' + esc(L.where + (L.detail ? ' · ' + L.detail : '')) +
        ' · ' + tail + '</span></button>' +
        '<div class="votp__act">' + act + '</div></div>';
    }).join('') + '</div>';
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
      /* ★대분류·세부공종도 번역을 건다 (v2.18.3 사용자 지적).
         자재명·규격·단위는 tm/ts/tu로 걸려 있었는데 이 둘만 한국어 원문이
         그대로 나갔다. 방글라 인력이 읽는 화면이다.
         ★값(value)은 한국어 원문 그대로 둔다 — 값을 바꾸면 matItems 조회가
           어긋나 자재 목록이 통째로 빈다. 보이는 글자만 바꾼다. */
      bfld('grp', '<select class="in" data-v="mgrp"><option value="">' + esc(window.I18N.en.pick) + '</option>' +
        opts(grps, V.mgrp, null, tm) + '</select>') +
      bfld('sub', '<select class="in" data-v="msub"' + (subs.length ? '' : ' disabled') + '>' +
        '<option value="">' + esc(window.I18N.en.pick) + '</option>' +
        opts(subs, V.msub, null, tm) + '</select>') +
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
  /* ★공종을 고르면 담당자가 자동으로 뜬다 (v2.19.2 사용자 지시).
     명부에 「공종|이름」으로 넣어 둔 것을 읽는다. 틀리면 목록에서 고른다.
     ★명부에 담당자가 없으면 종전처럼 자유 입력이다 — 명부를 안 채운
       현장이 막히면 안 된다. */
  function byFld() {
    var info = (V.comp && A.staffFor) ? A.staffFor(V.comp.name, curGrp()) : { pick: '', all: [] };
    if (!info.all.length) {
      return bfld('by', '<input class="in" id="vBy" value="' + esc(V.by) + '" placeholder="Name / الاسم">');
    }
    if (!V.by && info.pick) V.by = info.pick;
    var list = info.all.slice();
    if (V.by && list.indexOf(V.by) < 0) list.unshift(V.by);
    return bfld('by', '<select class="in" id="vBy" data-v="staff">' +
      list.map(function (n2) {
        return '<option value="' + esc(n2) + '"' + (V.by === n2 ? ' selected' : '') + '>' + esc(n2) + '</option>';
      }).join('') + '</select>');
  }
  function curGrp() {
    var e = A.item(V.key);
    return e ? e.grp : (V.grp || '');
  }

  function mineHTML() {
    var d = A.today(), lk = A.locKey(loc()), out = [];
    /* ★반려된 것은 날짜와 무관하게 맨 위에 띄운다 (v2.18.8).
       어제 올린 것을 오늘 반려하면 「오늘 것」에 안 걸려 업체가 영영 못 본다.
       고쳐서 다시 올려야 하는 쪽은 업체이므로 반드시 보여야 한다. */
    S.work.forEach(function (x) {
      if (x.st === 'rej' && A.locKey(x.loc) === lk)
        out.push(['⚠ Rejected / مرفوض', tw((A.item(x.key) || {}).name || x.key),
                  nf(x.qty, 2) + (x.rejWhy ? ' — ' + x.rejWhy : ''), 'rej', x.up ? 1 : 0]);
    });
    S.work.forEach(function (x) {
      if (x.st !== 'rej' && x.date === d && A.locKey(x.loc) === lk)
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
    /* ★결재 단계를 그대로 보여 준다 (v2.20.0).
       종전에는 측량이 done/open 둘뿐이라, 업체는 「우리 신청이 지금 어디에
       걸려 있나」를 알 수 없었다. 자재도 마찬가지였다.
       ★돌아온 것(back)은 **날짜와 무관하게 맨 위에 뜬다** — 업체가 고쳐서
         다시 올려야 하는데, 어제 것이 오늘 목록에서 빠지면 영영 못 본다.
         v2.18.8에서 반려 실적에 적용한 규칙과 같다. */
    S.surv.forEach(function (x) {
      var f = A.fst('surv', x);
      if (f !== 'back' && !(x.date === d && A.locKey(x.loc) === lk)) return;
      if (f === 'back' && A.locKey(x.loc) !== lk) return;
      out.push(['Survey / المساحة', tw((A.item(x.key) || {}).name || x.key),
                (x.fwhy ? '— ' + x.fwhy : '—'), FSTV.surv[f] || f, x.up ? 1 : 0,
                f === 'back' ? 'surv|' + x.id : '']);
    });
    S.mreq.forEach(function (x) {
      var f = A.fst('mat', x);
      /* ★수령확인이 걸린 줄(recv)도 날짜와 무관하게 뜬다 — 어제 받은 자재를
         오늘 확인하는 일이 흔한데, 오늘 목록에서 빠지면 영영 못 누른다.
         v2.18.8의 반려 규칙과 같다. */
      var recv = A.flowMineVendor('mat', x);
      if (f !== 'back' && !recv && !(x.date === d && A.locKey(x.loc) === lk)) return;
      if ((f === 'back' || recv) && A.locKey(x.loc) !== lk) return;
      out.push(['Material / المادة', tm(x.mat),
                nf(x.iss != null ? x.iss : x.qty, 2) + ' ' + tu(x.unit) + (x.fwhy ? ' — ' + x.fwhy : ''),
                FSTV.mat[f] || f, x.up ? 1 : 0,
                f === 'back' ? 'mat|' + x.id : (recv ? 'recv|mat|' + x.id : '')]);
    });
    if (!out.length) return '<div class="empty">No entries today / لا مدخلات اليوم</div>';
    return '<div class="tw"><table><tbody>' + out.map(function (r) {
      return '<tr><td class="sp">' + esc(r[0]) + '</td><td class="nm">' + esc(r[1]) + '</td>' +
        '<td class="r">' + esc(r[2]) + '</td><td class="c"><span class="bd">' + esc(r[3]) + '</span></td>' +
        '<td class="c">' + upBadge(r[4]) +
        /* ★돌아온 줄은 업체가 스스로 되올린다. 안 그러면 이 줄이 영영
           목록 맨 위에 남는다 — 아무의 차례도 아닌 상태이기 때문이다. */
        (r[5]
          ? (r[5].indexOf('recv|') === 0
            /* ★서로 확인되어야 끝난다 — 업체가 눌러야 스탭 확인과 짝이 맞는다.
               한쪽만 누르면 그 자리에 그대로 남고 경고가 계속 뜬다. */
            ? ' <button class="btn btn--sm" data-vre="' + esc(r[5]) + '">Received / تم الاستلام</button>'
            : ' <button class="btn btn--sm" data-vre="' + esc(r[5]) + '">Resubmit / إعادة الإرسال</button>')
          : '') +
        '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }

  /* 결재 단계 이름 — 이 화면은 영어/아랍어 병기다(i18n 사전을 쓰지 않는다).
     ★관리자 쪽 세부 단계를 그대로 보여 주지 않는다. 업체가 알아야 하는 것은
       「우리 차례인가 / 기다리면 되는가 / 끝났는가」 셋뿐이다. */
  var FSTV = {
    surv: {
      req:  'With staff / لدى الطاقم',      rej:  'With staff / لدى الطاقم',
      chk:  'With manager / لدى المدير',    ord:  'Survey team / فريق المساحة',
      sdone:'Surveyed / تم المسح',          sfail:'Not surveyed / لم يتم المسح',
      delay:'Delayed / متأخر',              fin:  'Closed / منتهي',
      none: 'Not needed / غير مطلوب',       back: 'Returned to you / أُعيد إليك'
    },
    mat: {
      req:  'With staff / لدى الطاقم',      rej:  'With staff / لدى الطاقم',
      chk:  'With manager / لدى المدير',    ord:  'To be issued / قيد الصرف',
      iss:  'Confirm receipt / أكد الاستلام', fin: 'Closed / منتهي',
      back: 'Returned to you / أُعيد إليك'
    }
  };

  /* 목록만 다시 그린다(전체 render는 입력값을 날리므로 쓰지 않는다) */
  function paintMine() {
    var m = $('#vMine');
    if (!m) return;
    m.innerHTML = rcHTML() + retryHTML() + mineHTML();
    A.$$('[data-vre]').forEach(function (b2) {
      b2.onclick = function () {
        var q = String(b2.dataset.vre).split('|');
        var recv = (q[0] === 'recv');
        if (recv) q.shift();
        var kind = q[0], id = q[1];
        var r = kind === 'mat'
          ? S.mreq.filter(function (x) { return x.id === id; })[0]
          : S.surv.filter(function (x) { return x.id === id; })[0];
        if (!r) return;
        /* ★as:'vendor'를 반드시 실어 보낸다. 이름(by)으로는 누가 눌렀는지
           가릴 수 없다 — 비어 있을 수도, 스탭 이름과 같을 수도 있다. */
        A.flowGo(kind, r, 'ok', { by: V.by || '', as: 'vendor' });
        toServer(kind, r);
        paintMine();
      };
    });
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
    /* ★실적도 오늘이다 (v2.19.13 사용자 지시). 종전 기본값은 어제였다.
       작업량 표를 오늘로 통일했으므로 폼도 같이 바꾼다 — 한쪽만 바꾸면
       올린 실적이 표에 안 나온다(0-H와 같은 사고). 날짜는 손으로 고칠 수 있다. */
    if (t === 'work') return openPickHTML('work') + workHTML() + placeHTML() +
      '<div class="f-row" style="margin-top:12px">' +
      bfld('date', '<input class="in" id="vDate" type="date" value="' + A.today() + '">') +
      /* ★도로 작업은 수량 = 측점 연장(자동·읽기전용). 표기 공종만 손입력이다.
         종전엔 「좌우센터를 골랐을 때만」 자동이라, 전폭 작업은 손입력이었다. */
      bfld('qty', '<input class="in num" id="vQty" type="number" step="any" placeholder="0"' +
           (!window.BNCP_SPOT.needTag(V.s, V.grp)
             ? ' value="' + esc(totalLen() ? nf(totalLen(), 2).replace(/,/g, '') : '') + '" readonly' : '') + '>') +
      byFld() +
      '</div>' +
      '<div style="margin-top:10px">' + inspCk() + '</div>';

    /* ★인원·장비는 「오늘」이다 (v2.19.12 — v2.18.9에서 빠진 짝).
       v2.18.9에서 「실적은 어제 · 투입은 오늘」로 갈랐는데, 관리자 표만
       오늘로 바꾸고 **업체 입력 폼은 어제로 남겨 뒀다.** 업체가 기본값
       그대로 올리면 어제 날짜로 저장돼, 오늘 기준인 관리자 인원·장비 표에
       영영 안 나온다 — 「오늘 투입 인원 0명 · 장비 0대」의 원인이다.
       실적(work) 폼은 어제 그대로다. 그쪽은 어제 한 일을 오늘 올리는 것이 맞다. */
    /* ★★측점을 인원·장비 폼에서도 받는다 (v2.19.19 사용자 확정 「가」).
       ★종전에는 측점이 **실적 폼에만** 있었다. 그런데 관리자 화면의
         「작업위치」는 인원·장비(S.crew)를 본다(v2.18.9 — 「오늘 어디에
         나와 있나는 투입이 답한다」). 받는 곳과 보는 곳이 어긋나
         **작업위치 칸이 자료가 아무리 들어와도 항상 「—」였다.**
       → 보는 곳에서 받게 한다. 뜻에도 맞는다 — 오늘 어느 측점에 나와
         있는지는 투입이 답할 일이다.
       ★측점은 **선택**이다. 도로가 아닌 공종에서 막으면 안 된다.
         도로·쪽만 골라도 그만큼은 뜬다. */
    if (t === 'crew') return openPickHTML('crew') + workHTML() + placeHTML() +
      '<div class="f-row" style="margin-top:12px">' +
      bfld('date', '<input class="in" id="vDate" type="date" value="' + A.today() + '">') +
      bfld('teams', '<input class="in num" id="vTeams" type="number" min="1" step="1" value="1">') +
      byFld() +
      '</div>' +
      '<div class="vsec">' + bl('people') + '</div><div id="vDial">' + dialHTML() + '</div>' +
      '<div class="vsec">' + bl('equip') + '</div><div id="vEq">' + eqHTML() + '</div>';

    if (t === 'insp') return inspHTML();

    /* ★측량 요청 — 사유는 고르는 것이다 (v2.27.0 · 요청 1).
       ★「기타」를 골랐을 때만 직접입력 칸이 나온다. 늘 띄워 두면 고른
         사람도 습관처럼 거기에 또 적어, 같은 사유가 두 군데로 갈린다.
       ★측량에는 도로·측점을 안 받는다 (0-V) — placeHTML을 부르지 않는다.
       ★★공종(Category/Work item)도 안 받는다 (v2.30.0 · 요청 ④). 우리는
         시공측량을 하지 않는다 — CP·TBM 문제는 특정 공종에 걸리지 않는다.
         종전엔 workHTML()이 남아 공종 드롭다운 두 칸이 그대로 떴다. */
    if (t === 'surv') return '' +
      '<div class="f-row">' +
      bfld('date', '<input class="in" id="vDate" type="date" value="' + A.today() + '">') +
      byFld() +
      '</div>' +
      '<div style="margin-top:12px">' + fld('Reason / السبب',
        '<select class="in" data-v="why"><option value="">— select / اختر —</option>' +
        SURV_WHY.map(function (x) {
          return '<option value="' + esc(x.id) + '"' + (x.id === V.why ? ' selected' : '') + '>' +
            esc(x.en + ' / ' + x.ar) + '</option>';
        }).join('') +
        '<option value="' + WHY_ETC + '"' + (V.why === WHY_ETC ? ' selected' : '') + '>' +
        'Other / أخرى</option></select>') + '</div>' +
      (V.why === WHY_ETC
        ? '<div style="margin-top:12px">' + fld('Details / التفاصيل',
            '<textarea class="in" id="vWhy" rows="3" placeholder="Describe / اشرح">' +
            esc(V.whyEtc) + '</textarea>') + '</div>'
        : '');

    return matHTML() +
      '<div class="f-row" style="margin-top:12px">' +
      bfld('date', '<input class="in" id="vDate" type="date" value="' + A.today() + '">') +
      bfld('qty', '<input class="in num" id="vQty" type="number" step="any" placeholder="0">') +
      byFld() +
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
    /* 진행 중 작업 고르기 — 폼에 공종·위치·측점을 되살린다 (v2.37.0) */
    $$('[data-otk]').forEach(function (b) {
      b.onclick = function () {
        var t = myOpenTasks()[+b.dataset.otk];
        if (t) { applyTask(t); render(); window.scrollTo(0, 0); }
      };
    });
    /* 작업 중단·재개 (v2.38.0) — 사유를 고르면 그 자리에서 세운다.
       업체가 세운 것은 서버로 보내 스탭·관리자 화면에도 뜬다. */
    $$('[data-vstop]').forEach(function (sel) {
      sel.onchange = function () {
        if (!sel.value) return;
        var t = myOpenTasks()[+sel.dataset.vstop]; if (!t) return;
        var r = A.addStop({ tk: t.tk, loc: t.loc, key: t.key, seg: t.seg, why: sel.value,
                            by: V.by || '', co: vco() });
        if (r) toServer('stop', r);
        render();
      };
    });
    $$('[data-vresume]').forEach(function (b) {
      b.onclick = function () {
        var t = myOpenTasks()[+b.dataset.vresume]; if (!t) return;
        var s = A.resumeStop(t.tk, A.today());
        if (s) toServer('stop', s);
        render();
      };
    });
    $$('[data-v]').forEach(function (el) {
      el.onchange = function () {
        var f = el.dataset.v;
        V[f] = (f === 'p' || f === 'c' || f === 'b' || f === 'spot') ? +el.value : el.value;
        if (f === 's') { V.grp = ''; V.key = ''; V.spot = -1; V.p = 1; V.c = 1; V.t = 'A'; V.b = 1; }
        /* ★공종이 바뀌면 담당자를 다시 잡는다 — 공종별로 사람이 다르다 */
        if (f === 'grp' || f === 'key') {
          var q = (V.comp && A.staffFor) ? A.staffFor(V.comp.name, curGrp()) : { pick: '', all: [] };
          if (q.all.length && q.pick) V.by = q.pick;
        }
        /* ★공종군이 바뀌면 표기와 도로를 **함께 비운다** (v2.26.0).
           안 비우면 도로 공종에서 고른 쪽·측점이 관로 공종으로 넘어가
           화면에는 표기 칸만 뵈는데 저장은 도로로 나간다. */
        if (f === 's' || f === 'grp') { V.tag = ''; V.side = []; V.sta = {}; V.rw = ''; V.rno = ''; V.rmemo = ''; }
        if (f === 'grp') { V.key = ''; V.spot = -1; }
        if (f === 'key') V.spot = -1;
        if (f === 't') V.b = 1;
        if (f === 'mgrp') { V.msub = ''; V.mmat = ''; }
        if (f === 'msub') V.mmat = '';
        if (f === 'rw') V.rno = '';
        /* ★사유가 바뀌면 다시 그린다 — 「기타」 칸이 나타나거나 사라져야 한다.
           ★기타에서 다른 항목으로 옮기면 직접입력 글도 버린다. 남겨 두면
             화면엔 안 보이는 글이 저장될 수 있다. */
        if (f === 'why' && el.value !== 'etc') V.whyEtc = '';
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
    /* 측점 — 고를 때마다 연장을 다시 계산해 보여준다
       ★`oninput`만 걸면 안 된다 — 측점이 <select>로 바뀌었고(v2.29.0),
         브라우저에 따라 select에서는 input 이벤트가 안 온다. 그러면 고른
         뒤에도 연장이 「—」로 남고, 실적 폼의 작업량이 빈 채로 제출된다.
         ★둘 다 건다. */
    $$('[data-sta]').forEach(function (el) {
      el.oninput = el.onchange = function () {
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
      base.subAt = row.subAt || '';        /* 제출 시각 — 오전 예외 판정 (요청 ⑤) */
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
      base.co = row.co || '';               // ★소속 회사 (v2.30.0 · 요청 ①)
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
      base.subAt = row.subAt || '';           /* 오전 예외 판정용 (요청 ⑤) */
      if (row.admOK) base.admOK = 1;
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

    else if (type === 'stop') {          /* 작업 중단 (v2.38.0) — tk·seg가 식별자 */
      base.tk = row.tk || '';
      base.seg = row.seg || '';
      base.to = row.to || '';
      base.why = row.why || '';
      base.co = row.co || '';
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
    /* ★표기(도면 라벨)를 읽어 둔다 (v2.26.0 · 요청 12·13).
       표기를 받는 공종군일 때만 값이 있다 — 아니면 빈 문자열이다. */
    var tagEl = $('#vTag'); if (tagEl) V.tag = String(tagEl.value || '').trim();
    var needTag = window.BNCP_SPOT.needTag(V.s, V.grp);

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

    /* ★측량 요청은 공종을 받지 않는다 (v2.30.0 · 요청 ④ · 0-V).
       우리는 시공측량을 하지 않는다 — CP·TBM이 틀리거나 이상할 때 나가는
       것이라 특정 공종·도로에 걸리지 않는다. 위치와 사유만 받는다.
       ★workGet() **위**에 둔다 — 아래로 내려가면 공종이 없어 늘 막힌다. */
    if (t === 'surv') {
      var wEl = $('#vWhy'); if (wEl) V.whyEtc = String(wEl.value || '').trim();
      if (!V.why) return say('Select reason / اختر السبب');
      var why = whyText();
      if (!why) return say('Enter reason / أدخل السبب');
      var srow = { id: A.uid(), date: d, loc: loc(), key: '', spot: null,
                   why: why, by: V.by, done: false, at: A.nowISO(), up: 0 };
      S.surv.push(srow);
      A.save();
      V.why = ''; V.whyEtc = '';        /* 같은 사유가 또 눌리는 것 방지 */
      render();
      toServer('surv', srow);
      return;
    }

    var g = workGet();
    if (!g) return say('Select work item / اختر البند');

    if (t === 'work') {
      var SP = window.BNCP_SPOT;
      /* ★도로/측점 작업(표기 공종이 아닌 것 — 토공·포장)은 측점에서 연장을
         계산해 저장한다. 좌우센터를 골랐으면 쪽마다 한 건씩(검측이 한쪽만
         불합격할 수 있어 묶으면 곤란), 안 골랐으면 「전폭」 한 건.
         ★종전에는 좌우센터를 골라야만 이 길로 왔고, 안 고르면 아래 손입력
           수량으로 빠져 성토·보조기층이 연장 없이 저장됐다(사용자 지적). */
      if (!SP.needTag(V.s, V.grp)) {
        if (!V.rw || !V.rno) return say('Select road / اختر الطريق');
        var ids = rowIds(), mk = [];
        for (var si = 0; si < ids.length; si++) {
          var rid = ids[si], side = (rid === 'F') ? '' : rid, sv = V.sta[rid] || {};
          var f = SP.sta(sv.fk, sv.fm), tt = SP.sta(sv.tk, sv.tm);
          var L = SP.len(f, tt);
          if (L === null || !L) return say('Enter station' +
            (rid === 'F' ? '' : ' for ' + SP.sideName(rid)) + ' / أدخل المحطة');
          /* ★ 이미 올린 구간과 겹치면 막는다 — 중복 청구가 실무에서 가장 흔하다.
             총연장을 몰라도 판정된다(구간끼리만 비교하므로). */
          var hit = overlap(g.key, V.rw, V.rno, side, f, tt);
          if (hit) {
            return say('Overlaps ' + SP.staText(hit.spot.f) + '~' + SP.staText(hit.spot.t) +
                       ' (' + hit.date + ') / يتداخل مع مقطع مُقدَّم');
          }
          mk.push({
            id: A.uid(), date: d, loc: g.loc, key: g.key, spot: {
              kind: 'road', w: V.rw, no: V.rno, memo: V.rmemo, side: side, f: f, t: tt
            },
            qty: L, by: V.by, subAt: A.nowISO(), st: 'sub', need: !!V.need, insp: '', up: 0
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
      /* ★표기 공종은 표기가 곧 위치다 — 비면 어디서 한 일인지 알 수 없다 */
      if (needTag && !V.tag) return say('Enter marking / أدخل الترميز');
      var wrow = { id: A.uid(), date: d, loc: g.loc, key: g.key, spot: g.spot,
                   tag: V.tag || '',
                   qty: q2, by: V.by, subAt: A.nowISO(), st: 'sub', need: !!V.need, insp: '', up: 0 };
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
      /* ★고른 쪽마다 측점 하나씩 — 그러나 **행은 하나다** (v2.19.19).
         실적(work)은 쪽마다 행을 쪼갠다(쪽마다 수량이 다르므로). 인원·장비를
         똑같이 쪼개면 **같은 사람이 쪽 수만큼 중복 계상된다.**
         그래서 행은 하나로 두고 측점만 여러 개 담는다. */
      var SP = window.BNCP_SPOT;
      /* ★측점은 「전폭」(좌우센터 안 고름)도 담는다 — F는 side=''로 나간다.
         측점을 골랐어야 담는다(f·t가 있어야) — 안 골랐으면 이 줄은 빠진다. */
      var sps = rowIds().map(function (id) {
        var sv = V.sta[id] || {};
        return { kind: 'road', w: V.rw, no: V.rno, memo: V.rmemo, side: (id === 'F') ? '' : id,
                 f: SP.sta(sv.fk, sv.fm), t: SP.sta(sv.tk, sv.tm) };
      }).filter(function (x) { return x.w && x.no && x.f !== null && x.t !== null; });
      if (needTag && !V.tag) return say('Enter marking / أدخل الترميز');
      var crow = { id: A.uid(), date: d, loc: g.loc, key: g.key, spot: g.spot,
                   tag: V.tag || '',
                   spots: sps.length ? sps : null, teams: tm,
                   ppl: JSON.parse(JSON.stringify(V.ppl)), eq: JSON.parse(JSON.stringify(V.eq)),
                   by: V.by, co: vco(), st: 'sub', up: 0 };
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
      /* ★오전 마무리 예외를 검측 신청에 물려준다 (v2.31.0 · 요청 ⑤).
         원본 실적 중 하나라도 오전 제출이면 이 신청도 예외다. 가장 이른
         제출 시각을 함께 실어, 관리자가 무엇 때문에 예외인지 볼 수 있게 한다.
         관리자가 확인(admOK)하기 전엔 검측 흐름의 다음 단계로 못 넘어간다. */
      var subs = rows.map(function (w) { return w.subAt || ''; }).filter(Boolean).sort();
      var excSub = '';
      rows.forEach(function (w) { if (A.isMorningExc(w) && !excSub) excSub = w.subAt || subs[0] || ''; });
      var irow = {
        id: A.uid(), date: A.today(), loc: rows[0].loc, key: rows[0].key,
        spot: rows[0].spot,
        /* ★표기도 물려받는다 — 검측은 실적을 그대로 올리는 것이다 */
        tag: rows[0].tag || '',
        qty: qsum, st: 'apply', stAt: A.today(), at: A.nowISO(), reason: '',
        by: V.by, note: '', seq: 1, hist: [], up: 0,
        subAt: excSub || subs[0] || '', admOK: 0,     /* 오전 예외 판정용 (요청 ⑤) */
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
    }
  }

  /* ★모바일 복귀·네트워크 복귀 시 자동 재전송 (v2.39.0 · 사용자 지적
       「모바일로 보면 서버와 통신이 안 되어 반영이 안 되는 것들이 있다」).
     ★협력업체 폰은 현장에서 신호가 오락가락한다. 전송이 실패하면 로컬엔
       남지만 서버로는 안 올라간 채로 있고, 종전엔 사람이 [재전송]을 눌러야만
       올라갔다 — 안 누르면 관리자 화면엔 영영 안 뜬다(「반영 안 됨」).
     ★고침 : 네트워크가 돌아오거나(online) 앱으로 돌아오면(focus·visible·
       pageshow) 안 올라간 것을 자동으로 다시 보낸다. 같은 id라 서버가
       덮어써 중복은 안 생긴다. */
  function autoRetry() {
    var api = window.BNCP_API;
    if (!api || !api.on) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    if (pending().length) retryAll();
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('online', autoRetry);
    window.addEventListener('focus', autoRetry);
    window.addEventListener('pageshow', autoRetry);
  }
  if (typeof document !== 'undefined' && document.addEventListener)
    document.addEventListener('visibilitychange', autoRetry);
  window.__vAutoRetry = autoRetry;   /* 검사(smoke)에서 부른다 */

  /* state는 검사(smoke)에서 화면 상태를 만들기 위해 노출한다.
     화면 코드는 내부 V를 쓰므로 이걸 통해 조작해도 동작이 달라지지 않는다. */
  window.VENDOR = { render: render, state: V };
})();
