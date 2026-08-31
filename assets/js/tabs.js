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
  /* ★마지막으로 보던 탭에서 다시 시작한다 (v2.16.2 — 사용자 지시).
     종전에는 새로 고칠 때마다 탭1로 돌아가, 검측을 보다 새로 고치면
     처음부터 다시 찾아 들어가야 했다. */
  var cur = +(S.tab || 1);

  /* ══ 조각 ═══════════════════════════════════════════ */
  function kpi(cls, label, val, unit, note, bar) {
    return '<div class="kpi ' + cls + '"><div class="kpi__l">' + label + '</div>' +
      '<div class="kpi__v">' + val + (unit ? '<span>' + unit + '</span>' : '') + '</div>' +
      (bar != null ? '<div class="bar"><i style="width:' + Math.max(0, Math.min(100, bar)) + '%"></i></div>' : '') +
      '<div class="kpi__n">' + note + '</div></div>';
  }
  /* ★anchor — 요약 띠에서 눌러 찾아갈 수 있게 카드에 이름표를 단다 (v2.19.17) */
  function card(title, sub, body, foot, extra, anchor) {
    return '<div class="card"' + (anchor ? ' id="' + anchor + '"' : '') +
      '><div class="card__h"><h2>' + title + '</h2>' +
      (sub ? '<span class="sub">' + sub + '</span>' : '') +
      '<span class="sp"></span>' + (extra || '') + '</div>' +
      '<div class="card__b' + (foot === 'flush' ? ' flush' : '') + '">' + body + '</div>' +
      (foot && foot !== 'flush' ? '<div class="card__f">' + foot + '</div>' : '') + '</div>';
  }
  function empty(t, m) { return '<div class="empty"><b>' + t + '</b>' + (m || '') + '</div>'; }

  /* 진행 중 작업의 구간 라벨 — 도로=측점범위 · 관로=표기 · 구조물=개소 */
  function segLabel(t) {
    var SP = window.BNCP_SPOT, seg = t.seg || '';
    if (seg.indexOf('road|') === 0) {
      var p = seg.split('|'), fr = (p[4] || '').split('~');
      var sp = { kind: 'road', w: p[1], no: p[2], side: p[3], f: +fr[0], t: +fr[1] };
      return SP.roadName(sp) + (p[3] ? ' · ' + SP.sideName(p[3]) : '') +
        ' · ' + SP.staText(sp.f) + '~' + SP.staText(sp.t);
    }
    if (seg.indexOf('tag|') === 0) return seg.slice(4);
    if (seg.indexOf('fac|') === 0) return A.T('u_sec') + ' ' + (Number(seg.slice(4)) + 1);
    return A.locShort(t.loc);
  }
  var OT_AGE_WARN = 3;   /* 진행 중인데 이 일수 넘게 방치되면 경고 */
  /* ★진행 중 작업 카드 — A.openTasks(core)가 뽑는다. 0건이면 안 그린다.
     ★중단(v2.38.0)된 작업은 방치로 몰지 않고 따로 「중단」으로 묶는다.
       스탭·관리자는 사유를 골라 세우고(중단), 버튼으로 다시 잇는다(재개). */
  function stopCanEdit() { var r = A.role(); return r === 'admin' || r === 'staff'; }
  /* 중단 사유 고르는 칸 — 칸(td)까지 만든 꼴 */
  function stopSelCell(idx) {
    if (!stopCanEdit()) return '';
    return '<td class="r">' + stopSelBare(idx) + '</td>';
  }
  /* ★칸 없이 고르개만 (v2.49.1) — 한 표로 합치면서 칸은 부르는 쪽이 만든다 */
  function stopSelBare(idx) {
    if (!stopCanEdit()) return '';
    return '<select class="in in--sm" data-stop="' + idx + '">' +
      '<option value="">' + T('ot_stop') + '…</option>' +
      A.STOP_WHY.map(function (x) {
        return '<option value="' + esc(x.id) + '">' + esc(x[S.lang] || x.en) + '</option>';
      }).join('') + '</select>';
  }
  /* ★bare면 **카드 껍데기 없이 표 하나만** 돌려준다 (v2.49.1 사용자 지적
     「제목이 몇 개야 · 소제목은 하나만」). 3번 카드 안에 넣을 때 쓴다 —
     종전에는 이 함수가 제 카드(제목 「진행 중 작업」)를 만들어 돌려줘서,
     구획 소제목 밑에 카드 제목이 또 붙어 제목이 네 겹이 됐다.
     ★진행 중과 중단을 **한 표**로 합친다. 중단은 따로 머리(「중단됨 5」)를 세우지
       않고 **상태 칸에 「중단 · 사유」로만** 보인다(사용자 지시).
     ★머리글(thead)을 붙인다 — 없으니 무슨 칸인지 안 보였다. */
  function openTaskRows() {
    var list = A.openTasks(flt);
    if (!list.length) return { html: '', n: 0, stop: 0, aged: 0 };
    var aged = 0, stop = 0, ong = 0;
    list.forEach(function (t, i) { t._i = i; });
    var body = list.map(function (t) {
      var old = !t.stopped && t.age >= OT_AGE_WARN;
      if (old) aged++;
      if (t.stopped) stop++; else ong++;
      var stCell = t.stopped
        ? '<span class="bd bd--d">' + T('ot_stop') + '</span> ' +
          '<span class="sp">' + esc(A.stopWhyText(t.stopWhy, S.lang) || '') + '</span>'
        : (old ? '<span class="bd bd--d">' + T('ot_aged') + '</span>'
               : (t.isNew ? '<span class="bd bd--o">NEW</span>' : '<span class="sp">·</span>'));
      var age = t.stopped
        ? esc(t.stopFrom) + ' · ' + T('ot_stopdays').replace('{n}', nf(t.stopDays))
        : T('ot_since').replace('{n}', nf(t.age));
      return '<tr' + (old ? ' class="gr"' : '') + '><td>' + itemLine(t.key) +
        ' <span class="sp">' + esc(segLabel(t)) + '</span></td>' +
        '<td>' + stCell + '</td>' +
        '<td class="r sp">' + age + '</td>' +
        (t.stopped
          ? (stopCanEdit()
              ? '<td class="c noprint"><button class="btn btn--g btn--sm" data-resume="' + t._i + '">' +
                T('ot_resume') + '</button></td>'
              : '<td class="c noprint"></td>')
          : '<td class="c noprint">' + stopSelBare(t._i) + '</td>') + '</tr>';
    }).join('');
    return {
      html: '<div class="tw"><table><thead><tr>' +
        '<th>' + T('work') + '</th><th>' + T('status') + '</th>' +
        '<th class="r">' + T('date') + '</th><th class="noprint"></th>' +
        '</tr></thead><tbody>' + body + '</tbody></table></div>',
      n: ong, stop: stop, aged: aged
    };
  }
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
    /* ★설계수량이 올라온 공구만 남긴다 (v2.50.0 사용자 지시 「매번 고르기 불편하고
       누락된다 — 설계수량 있는 곳만」). 없는 곳은 애초에 작업 대상이 아니다.
       ★하나도 없으면 목록 대신 **먼저 올리라고 알린다** — 빈 드롭다운만 두면
         왜 못 고르는지 알 수 없다. */
    var pls = planLocs(flt.s);
    if (!pls.length) {
      return '<select class="in" id="fSite" style="width:auto">' +
        opts(A.SITES, flt.s, function (x) { return x.id; }, function (x) { return x[L()]; }) +
        '</select><span class="pbg">' + T('z_noplan_t') + '</span>';
    }
    return '<select class="in" id="fSite" style="width:auto">' +
      opts(A.SITES, flt.s, function (x) { return x.id; }, function (x) { return x[L()]; }) + '</select>' +
      (civil
        ? '<select class="in" id="fPC" style="width:auto"><option value="">All Phase</option>' +
          pls.map(function (l) {
            var v = l.p + '-' + l.c;
            return '<option value="' + v + '"' +
              (flt.p + '-' + flt.c === v ? ' selected' : '') + '>Phase ' + v + '</option>';
          }).join('') + '</select>' + planBadge()
        : '<select class="in" id="fT" style="width:auto"><option value="">All Town</option>' +
          opts(uniq(pls.map(function (l) { return l.t; })), flt.t, null,
               function (x) { return 'Town ' + x; }) + '</select>' +
          '<select class="in" id="fB" style="width:auto"><option value="0">All Block</option>' +
          opts(pls.filter(function (l) { return !flt.t || l.t === flt.t; })
                 .map(function (l) { return l.b; }), flt.b, null,
               function (x) { return 'Block ' + x; }) + '</select>' + planBadge());
  }
  function uniq(a) {
    var seen = {}, o = [];
    a.forEach(function (x) { if (!seen[x]) { seen[x] = 1; o.push(x); } });
    return o;
  }
  /* ★설계수량이 있는 곳이 하나뿐이면 그곳으로 자동으로 맞춘다 (v2.50.0) —
     매번 고르지 않아도 되고 누락도 없다. 여럿이면 사람이 고른다. */
  function fltAuto() {
    var pls = planLocs(flt.s);
    if (pls.length !== 1) return;
    var l = pls[0];
    if (l.s === 'civil') { if (flt.p === l.p && flt.c === l.c) return; flt.p = l.p; flt.c = l.c; }
    else { if (flt.t === l.t && flt.b === l.b) return; flt.t = l.t; flt.b = l.b; }
  }

  /* ★설계수량이 올라온 구간인지 위치 선택 옆에서 바로 보인다 (v2.17.2 사용자 지시).
     종전에는 골라 들어가서 진행률이 0.0%로 비는 것을 보고서야 알았다. */
  /* ★위치 필터 옆에서 인원투입·장비현황 카드 머리로 옮겼다 (v2.17.6 사용자 지적).
     위치 선택 줄에 얹으니 「이게 뭘 고르는 건지, 어느 업체인지」 알 수 없었다.
     해당 카드 제목 옆에 두면 무엇을 바꾸는 단추인지 스스로 설명된다.
     ★표마다 따로 고른다 (v2.18.1) — 인원은 업체별, 장비는 공종별로
       보고 싶을 수 있다. 종전에는 하나로 묶여 같이 바뀌었다. */
  /* ★축은 무엇을 세느냐에 따라 다르다 (v2.49.0 사용자 지적 「공종별 보기가 아니라고,
     공종을 보는 것 같잖아 — 장비 구분·분류·종류 중에 골라라」).
     · 인원은 **공종별/업체별** — 사람은 공종에 붙는다.
     · 장비는 **장비종류별/업체별** — 장비 자료가 가진 축이 종류(cat)·규격(size)다.
       장비에 공종 축을 두면 「장비가 공종을 돈다」는 딴 이야기가 섞인다. */
  function grpBtn(which) {
    var opt = which === 'eq'
      ? [['cat', 't_bykind'], ['co', 't_byco']]
      : [['work', 't_bywork'], ['co', 't_byco']];
    return '<span class="seg seg--sm noprint">' +
      opt.map(function (x) {
        return '<button data-gb="' + which + '|' + x[0] +
          '" aria-pressed="' + (grpBy[which] === x[0]) + '">' + T(x[1]) + '</button>';
      }).join('') + '</span>';
  }

  /* ★설계수량이 올라온 위치만 (v2.50.0). 셋(상단 공구·진행률 선택·업체 입력)이
     같은 기준을 쓰도록 **여기 한 곳**에서 낸다. */
  function planLocs(site) {
    return A.allLocs(site).filter(function (l) { return A.hasPlan(l) > 0; });
  }
  /* ★공정별 진행률의 위치 선택 (v2.50.0 사용자 지시).
     부지토목 → Phase-공구 / 부대토목 → 타운-블록. **설계수량이 올라온 곳만** 나온다.
     ★고른 한 곳만 계산한다 — 부지토목·부대토목이 갈리고 페이즈·블록마다 따로 난다.
       그래서 **합계 공정률은 없다**(사용자 지시). */
  function progPickHTML() {
    var ls = planLocs();
    if (!ls.length) return '';
    var cur = progLocKey();
    return '<select class="in in--sm noprint" id="pgLoc" style="width:auto">' +
      ls.map(function (l) {
        var k = A.locKey(l);
        return '<option value="' + esc(k) + '"' + (k === cur ? ' selected' : '') + '>' +
          esc(A.locLabel(l)) + '</option>';
      }).join('') + '</select>';
  }
  /* 고른 위치의 열쇠 — 없거나 설계수량이 사라졌으면 있는 첫 곳으로 */
  function progLocKey() {
    var ls = planLocs();
    if (!ls.length) return '';
    var keys = ls.map(function (l) { return A.locKey(l); });
    if (progLoc && keys.indexOf(progLoc) >= 0) return progLoc;
    /* 상단 필터가 가리키는 곳에 설계수량이 있으면 그곳부터 */
    var hit = '';
    ls.forEach(function (l) { if (!hit && A.locMatch({ loc: l }, flt)) hit = A.locKey(l); });
    return hit || keys[0];
  }

  /* ★올린 뒤 얼마나 기다렸나 한 칸 (v2.51.0). 확인 전이면 지금까지, 확인 뒤면
     걸린 시간이다. 옛 줄(subAt 없음)은 '—' — 없는 것을 지어내지 않는다.
     ★하루를 넘겨 밀린 것은 붉게 — 밀린 것이 눈에 걸려야 처리가 된다. */
  var WAIT_WARN_H = 24;
  function waitCell(x) {
    var h = A.procH(x);
    if (h == null) return '<td class="r sp">—</td>';
    var t = A.procText(x);
    return '<td class="r' + (h >= WAIT_WARN_H ? ' em' : ' sp') + '">' + esc(t) + '</td>';
  }

  function planBadge() {
    var n = A.hasPlan(flt);
    return '<span class="pbg' + (n ? ' pbg--y' : '') + '">' +
      (n ? T('sp_plan') + ' ' + nf(n) + T('u_ea') : T('sp_plan') + ' ' + T('sp_none')) + '</span>';
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

  /* ★검사에서 직접 돌리려고 내보낸다. 글자 대조만으로는 「갈래가 있다」까지만
     알 수 있고 「그 갈래가 실제로 도는가」는 못 본다 — 0-J가 바로 그 함정이었다. */
  function unpack(r) {
    if (!r || !r.id) return null;
    var loc = rxLoc(r);
    if (!loc) return null;
    var base = { id: r.id, date: r.date, loc: loc, by: r.by || '', up: 1 };

    /* ★자재 신청 수신 — 갈래는 **하나뿐이어야 한다** (v2.22.4에서 합쳤다).
       v2.20.0에서 결재 단계를 담은 갈래를 아래쪽에 새로 넣었는데, 위쪽에
       이미 있던 갈래가 `return`으로 끊어 **아래것이 영영 안 돌았다.**
       그래서 `fst`·`fat`·`fby`·`fwhy`·`okS`·`okV`가 받을 때 **통째로 버려졌다** —
       스탭이 검토·확인한 자재 신청이 다른 PC에서는 안 눌린 채로 보였다.
       결재는 여러 사람이 이어서 누르는 것이라 이대로면 흐름이 성립하지 않는다.
       ★보내는 쪽(485행)은 처음부터 그 칸들을 보내고 있었다. 받는 쪽만 못 받았다.
       ★자재는 공종코드(key)가 없다 — 아래 `if (!r.key) return null`보다
         **위에** 있어야 한다. 밑에 두면 전부 걸러진다.
       ★`if (!r.mat) return null`은 그대로 둔다. 자재명이 없으면 화면에서
         이름 없는 줄이 되어 손을 댈 수가 없다. (시트의 그런 줄은 0-L) */
    if (r.type === 'mat') {
      if (!r.mat && !r.name) return null;
      return { box: 'mreq', row: merge(base, {
        grp: r.grp || '', sub: r.sub || '', mat: r.mat || r.name || '',
        spec: r.spec || '', unit: r.unit || '', plant: !!r.plant,
        qty: +r.qty || 0, st: r.st || 'req',
        /* 결재 단계 — ★이 여섯이 v2.20.0부터 유실되고 있던 것이다 */
        fst: r.fst || '', fat: r.fat || '', fby: r.fby || '', fwhy: r.fwhy || '',
        okS: r.okS ? 1 : 0, okV: r.okV ? 1 : 0,
        /* 신청·지급 이력 — 위쪽 갈래에만 있던 칸이다. 빠뜨리면 addMreq가
           만드는 줄과 모양이 달라져, 화면이 없는 칸을 읽게 된다. */
        reqAt: r.reqAt || r.date || '',
        apvBy: r.apvBy || '', apvAt: r.apvAt || '', denyWhy: r.denyWhy || '',
        plantReqAt: r.plantReqAt || '',
        iss: (r.iss == null || r.iss === '') ? null : +r.iss,
        issAt: r.issAt || '', noissWhy: r.noissWhy || '',
        use: (r.use == null || r.use === '') ? null : +r.use,
        useAt: r.useAt || '',
        hist: [] }) };
    }

    /* ★설계량 (v2.18.4) — S.plan은 배열이 아니라 {위치키:{공종코드:수량}}이라
       다른 종류처럼 box에 밀어 넣을 수 없다. 여기서 바로 반영하고 null을 준다.
       ★id는 '위치키|공종코드'로 고정한다. 같은 칸을 다시 보내면 서버가
         그 줄을 덮어쓰고, 받을 때도 같은 자리에 다시 앉는다. */
    if (r.type === 'plan') {
      if (!r.key) return null;
      var lk = A.locKey(loc);
      S.plan[lk] = S.plan[lk] || {};
      var q = +r.qty || 0;
      if (q > 0) S.plan[lk][r.key] = q; else delete S.plan[lk][r.key];
      return { box: '_plan' };          /* 이미 반영됨 — 호출부가 세기만 한다 */
    }

    if (r.type === 'direct') return { box: 'direct', row: merge(base, {
      task: r.name || '', teams: +r.teams || 0,
      ppl: r.ppl || { eng: 0, fmn: 0, wkr: 0 }, eq: r.eq || [],
      note: r.note || '', st: r.st || 'sub' }) };

    /* ★작업 중단(v2.38.0) — 종류를 모르는 서버 시트(etc)에 원문으로 쌓였다가
       무type 수신으로 되돌아온다. tk·seg가 곧 작업 식별자다(공종코드가 없어도
       성립하므로 아래 `if (!r.key)`보다 **위**에 둔다). 재개는 같은 id에 to를
       채워 다시 보내므로, 서버 upsert가 그 줄을 덮고 여기서 to가 갱신된다. */
    if (r.type === 'stop') {
      if (!r.tk) return null;
      return { box: 'stop', row: merge(base, {
        type: 'stop', tk: r.tk, key: r.key || '', seg: r.seg || '',
        to: r.to || '', why: r.why || '', co: r.co || '' }) };
    }

    if (!r.key) return null;
    base.key = r.key;
    base.spot = (r.spot === 0 || r.spot) ? r.spot : null;
    /* ★표기(도면 라벨)도 받는다 (v2.26.0 · 요청 12·13).
       ★보내는 쪽만 고치고 받는 쪽을 빠뜨리면 0-J와 똑같은 사고가 난다 —
         내 PC에선 보이는데 다른 PC에선 통째로 비어 있게 된다. 짝으로 고친다. */
    base.tag = r.tag || '';

    if (r.type === 'work') return { box: 'work', row: merge(base, { qty: +r.qty || 0, subAt: r.subAt || '', admOK: r.admOK ? 1 : 0, st: r.st || 'sub' }) };

    if (r.type === 'crew') return { box: 'crew', row: merge(base, {
      teams: +r.teams || 0,
      ppl: r.ppl || { eng: 0, fmn: 0, wkr: 0 },
      eq: r.eq || [], co: r.co || '', st: r.st || 'sub' }) };

    if (r.type === 'insp') return { box: 'insp', row: merge(base, {
      qty: +r.qty || 0, st: r.st || 'apply', stAt: r.stAt || r.date || '',
      reason: r.reason || '', note: r.note || '', seq: +r.seq || 1,
      subAt: r.subAt || '', admOK: r.admOK ? 1 : 0, hist: [] }) };

    if (r.type === 'surv') return { box: 'surv', row: merge(base, {
      why: r.why || '', done: !!r.done,
      fst: r.fst || '', fat: r.fat || '', fby: r.fby || '', fwhy: r.fwhy || '',
      hist: [] }) };

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

  /* ★협력업체 명부 서버 전송 (v2.45.1 사용자 지적 「모바일엔 등록 업체가 없다」).
     명부(S.vend)는 기기별 localStorage라, PC에서만 등록하면 모바일은 회사명을
     못 풀어 사람 이름이 그대로 뜬다. 명부도 서버로 올려 모든 기기가 같은 것을
     쓰게 한다. id를 'vend|코드'로 고정해 다시 올리면 그 줄을 덮어쓴다(upsert).
     ★모르는 종류라 서버 etc 시트에 원문으로 쌓이고 무type 수신으로 되돌아온다
       (Code.gs 재배포 불필요 — 'stop'과 같은 길). */
  /* ★묶음 전송을 줄 세운다 (v2.47.0). 설계수량은 **칸 하나가 한 줄**이라 한 현장에
     수백~수천 건이다. 종전에는 전부 동시에 쐈는데, 서버(Code.gs doPost)는
     LockService.waitLock(20000)으로 쓰기를 한 줄로 세운다 — 뒤쪽은 20초 잠금 대기를
     넘겨 실패하고, 전송 실패는 무시하도록 돼 있어 **조용히 사라진다.** 모바일
     설계수량이 「일부만」 맞던 자리다.
     ★동시 3건까지만 보내고 나머지는 차례를 기다린다. 느려지는 게 아니라, 버려지지
       않는다. txBack·txDirect(응답으로 row.up을 찍는 갈래)는 건드리지 않는다. */
  var txQ = [], txRun = 0, TX_MAX = 3;
  function txPump() {
    var api = window.BNCP_API;
    if (!api || !api.on) { txQ.length = 0; txRun = 0; return; }
    /* ★서버가 묶음을 받을 줄 알면 한 요청에 여러 줄을 실어 보낸다 (v2.48.0).
       한 줄에 한 요청이면 설계수량 수천 건이 수천 왕복이 된다 — 사용자가 겪은 느림.
       ★재배포 전(canBatch 거짓)에는 종전대로 한 줄씩 — 모르는 종류로 보내면
         etc 시트에 통째로 쌓여 자료가 뭉개지므로 **절대 먼저 쓰지 않는다.** */
    var many = api.canBatch && typeof api.sendMany === 'function';
    while (txRun < TX_MAX && txQ.length) {
      txRun++;
      try {
        if (many) {
          var pack = txQ.splice(0, api.BATCH_MAX || 100).map(function (x) {
            var b = x[1]; b.type = b.type || x[0]; return b;
          });
          api.sendMany(pack).then(fin, fin);
        } else {
          var it = txQ.shift();
          api.send(it[0], it[1]).then(fin, fin);
        }
      } catch (e) { fin(); }
    }
    function fin() { txRun--; txPump(); }
  }
  /** 묶음 전송 한 줄을 줄에 세운다. 보내는 내용은 부르는 쪽이 정한다.
      ★txHold 동안에는 줄에 쌓기만 한다 (v2.48.0). 한 줄 넣을 때마다 곧바로 보내면
        묶음이 **한 줄짜리**가 되어 묶는 뜻이 없다. 묶음 전송(txCfgAll)은 다 쌓은 뒤
        한 번만 깨운다. */
  var txHold = false;
  function txSend(type, body) {
    var api = window.BNCP_API;
    if (!api || !api.on) return;
    txQ.push([type, body]);
    if (!txHold) txPump();
  }
  A._txQlen = function () { return txQ.length; };     /* 검사에서 본다 */
  A._txRun = function () { return txRun; };
  A._txPeek = function () {                            /* 아직 줄에 선 것 */
    return txQ.map(function (x) { return { type: x[0], body: x[1] }; });
  };
  A._txReset = function () { txQ.length = 0; txRun = 0; };

  function txVend(v) {
    if (!v || !v.code) return;
    txSend('vend', { id: 'vend|' + v.code, type: 'vend', code: v.code,
      name: v.name || '', staff: v.staff || [], key: v.key || '', tel: v.tel || '' });
  }
  function txVendAll() { S.vend.forEach(txVend); }
  /* ★서버에서 받은 명부 한 줄을 S.vend에 code로 upsert. 바뀌면 회사명 색인을
     다시 만든다(coDirty) — 사람 이름으로 올라온 것도 곧바로 회사로 묶인다.
     반환 : 실제로 바뀌었으면 true(수신 건수에 센다). */
  function mergeVend(r) {
    if (!r || !r.code) return false;
    /* ★지운 것 표식 (v2.48.0) — del이 **참일 때만** 지운다. 빈 값·없는 칸은 절대
       지움으로 보지 않는다(v2.46의 교훈 : 빈 값을 뜻 있는 값으로 읽으면 사고가 난다). */
    if (r.del) {
      var had = S.vend.some(function (v) { return v.code === r.code; });
      if (!had) return false;
      S.vend = S.vend.filter(function (v) { return v.code !== r.code; });
      A.coDirty();
      return true;
    }
    if (!r.name) return false;
    var hit = null;
    S.vend.forEach(function (v) { if (v.code === r.code) hit = v; });
    var stf = Array.isArray(r.staff) ? r.staff : (r.staff ? [String(r.staff)] : []);
    if (hit) {
      var ch = hit.name !== r.name || JSON.stringify(hit.staff || []) !== JSON.stringify(stf);
      hit.name = r.name;
      if (stf.length) hit.staff = stf;
      if (r.tel) hit.tel = r.tel;
      if (!hit.key && r.key) hit.key = r.key;
      if (!ch) return false;
    } else {
      S.vend.push({ code: r.code, name: r.name, tel: r.tel || '',
        staff: stf, key: r.key || A.vendKey(r.code) });
    }
    A.coDirty();
    return true;
  }
  A._mergeVend = mergeVend;   /* 검사에서 부른다 */

  /* ★설정·명부 전 항목 서버 동기화 (v2.46.0 사용자 지시 「모든 정보를 PC·모바일이
     같이 봐야 한다」). 종전에는 담당자(staff)·지급장비(issue)·내역서매칭(alias)·
     자재재고(stock)·정비대장(mt)이 기기별 localStorage에만 있어, 한쪽에서 등록해도
     다른 쪽은 못 봤다 — vend(v2.45.1)로 명부만 맞춰 놨던 것을 나머지로 넓힌다.
     ★vend·plan과 같은 길 — 한 줄 = 한 레코드로 보낸다(blob 금지 : 마지막 writer가
       blob을 덮어써 다른 키를 잃는 사고를 막는다). 모르는 type이라 서버 etc 시트에
       쌓였다가 무type 수신으로 원문 그대로 돌아온다(Code.gs 재배포 불필요).
     ★id를 '종류|키'로 고정해 다시 보내면 그 줄을 덮어쓴다(upsert). */
  function txCfg(type, id, body) {
    body.type = type; body.id = id;
    txSend(type, body);          /* ★줄 세워 보낸다 (v2.47.0) */
  }
  function txStaffAll() {
    S.staff.forEach(function (m) {
      txCfg('staff', 'staff|' + m.id,
        { sid: m.id, name: m.name || '', tel: m.tel || '', grps: (m.grps || []).slice() });
    });
  }
  function txIssueAll() {
    S.issue.forEach(function (g) {
      /* ★업체는 `by`에 있다 (core.eqPut : by:co). coOf가 co||by로 읽는다.
         v2.46.0에서 없는 co를 보내 업체가 빈 채 넘어가 지급대조가 어긋났다(v2.46.1).
         ★업체가 빈(깨진) 줄은 아예 올리지 않는다 (v2.46.2) — 올리면 남의 기기에서
           멀쩡한 업체를 덮어 「미등록 업체」를 만든다. 정상 지급 줄엔 업체가 늘 있다. */
      var by = g.by || g.co || '';
      if (!by) return;
      txCfg('issue', 'issue|' + g.id,
        { iid: g.id, date: g.date || '', loc: g.loc || '', cat: g.cat || '',
          size: g.size || '', kind: g.kind || '', cnt: g.cnt, by: by });
    });
  }
  function txAliasAll() {
    var a = S.alias || {}, a2 = S.alias2 || {}, k;
    for (k in a) if (Object.prototype.hasOwnProperty.call(a, k) && a[k])
      txCfg('alias', 'alias|' + k, { k: k, code: a[k] });
    for (k in a2) if (Object.prototype.hasOwnProperty.call(a2, k) && a2[k])
      txCfg('alias2', 'alias2|' + k, { k: k, code: a2[k] });
  }
  function txStockAll() {
    var st = S.stock || {}, lk, mid;
    for (lk in st) if (Object.prototype.hasOwnProperty.call(st, lk)) {
      for (mid in st[lk]) if (Object.prototype.hasOwnProperty.call(st[lk], mid))
        txCfg('stock', 'stock|' + lk + '|' + mid, { lk: lk, mid: mid, qty: st[lk][mid] });
    }
  }
  /* ★시설 계수(v2.47.0) — {위치키:{시설id:[숫자…]}}. **설계량 계산에 쓰인다**
     (core.js planQty) → 안 맞으면 진행률이 기기마다 다르다. 값이 배열이라 그대로
     싣는다(원본JSON으로 왕복 — Code.gs 무수정). */
  function txFacAll() {
    var fc = S.fac || {}, lk, id;
    for (lk in fc) if (Object.prototype.hasOwnProperty.call(fc, lk)) {
      for (id in fc[lk]) if (Object.prototype.hasOwnProperty.call(fc[lk], id)) {
        var v = fc[lk][id];
        if (!v || !v.length) continue;          /* 빈 것은 안 올린다 — 남의 것을 덮는다 */
        txCfg('fac', 'fac|' + lk + '|' + id, { lk: lk, fid: id, cnt: v });
      }
    }
  }
  /* ★자재 설계수량 (v2.47.0) — {위치키:{자재id:수량}} (core.js setDesign) */
  function txMdesAll() {
    var md = S.mdesign || {}, lk, id;
    for (lk in md) if (Object.prototype.hasOwnProperty.call(md, lk)) {
      for (id in md[lk]) if (Object.prototype.hasOwnProperty.call(md[lk], id))
        txCfg('mdes', 'mdes|' + lk + '|' + id, { lk: lk, mid: id, qty: md[lk][id] });
    }
  }
  /* ★지운 것 표식을 보낸다 (v2.48.0). 같은 id에 del:1을 실어 보내면 서버가 그 줄을
     덮고, 다른 기기가 받아서 지운다. id는 각 종류가 올릴 때 쓰는 것과 **같아야** 한다 —
     달라지면 서버에 줄이 둘이 되어 지운 것이 되살아난다. */
  function txGoneAll() {
    (S.gone || []).forEach(function (g) {
      if (!g || !g.t || !g.k) return;
      if (g.t === 'vend')  return txCfg('vend',  'vend|' + g.k,  { code: g.k, del: 1 });
      if (g.t === 'staff') return txCfg('staff', 'staff|' + g.k, { sid: g.k, del: 1 });
      if (g.t === 'issue') return txCfg('issue', 'issue|' + g.k, { iid: g.k, del: 1 });
      if (g.t === 'stock') {
        var p = String(g.k).split('|');            /* 위치키(C|3|1) + 자재id */
        var mid = p.pop(), lk = p.join('|');
        return txCfg('stock', 'stock|' + lk + '|' + mid, { lk: lk, mid: mid, del: 1 });
      }
    });
  }
  function txMtAll() {
    var mt = S.mt || {}, id;
    for (id in mt) if (Object.prototype.hasOwnProperty.call(mt, id)) {
      var m = mt[id] || {};
      txCfg('mt', 'mt|' + id, { mid: id, step: m.step || '', why: m.why || '',
        reqAt: m.reqAt || '', doneAt: m.doneAt || '' });
    }
  }
  /* ★서명 게이트 — 바뀐 항목만 보낸다. 같은 자료를 매 분 다시 올리지 않는다.
     서명은 그 상태를 통째로 JSON 문자열로 만든 것이다(항목 수가 적어 가볍다).
     syncNow가 매 주기 부르므로, 어느 기기에서 등록해도 1분 안에 서버로 올라간다. */
  function txCfgAll() {
    var api = window.BNCP_API;
    if (!api || !api.on) return;
    txHold = true;               /* ★다 쌓은 뒤 한 번에 보낸다 — 묶음이 커진다 */
    try { txCfgCollect(); } finally { txHold = false; txPump(); }
  }
  function txCfgCollect() {
    S.cfgTx = S.cfgTx || {};
    /* ★전송 형식이 바뀌면 SIG_V를 올린다 — 옛 서명과 안 맞아 모든 기기가 다음
       주기에 config 전부를 한 번 다시 보낸다(같은 id upsert라 서버 옛 줄을
       올바른 값으로 덮는다). v2.46.1 : issue 업체 필드(co→by) 고침 재전송.
       v2.46.2 : 빈 by 줄을 안 올리도록 고친 뒤 서버의 옛(빈 by) 줄을 덮으러 재전송.
       v2.47.0 : 명부·설계수량·시설계수·자재설계수량을 새로 담아 1회 전송. */
    var SIG_V = 'v4';
    /* ★v2.47.0 — 여기 담기지 않은 것은 「등록하는 그 순간」에만 올라간다. 그래서
       그 전에 등록해 둔 자료는 서버에 한 번도 안 올라가 다른 기기가 못 받았다.
       사람이 넣는 기준자료는 **빠짐없이 여기에 담는다.** */
    var sig = {
      staff: SIG_V + JSON.stringify(S.staff || []),
      issue: SIG_V + JSON.stringify(S.issue || []),
      alias: SIG_V + JSON.stringify([S.alias || {}, S.alias2 || {}]),
      stock: SIG_V + JSON.stringify(S.stock || {}),
      mt: SIG_V + JSON.stringify(S.mt || {}),
      vend: SIG_V + JSON.stringify(S.vend || []),
      plan: SIG_V + JSON.stringify(S.plan || {}),
      fac: SIG_V + JSON.stringify(S.fac || {}),
      mdes: SIG_V + JSON.stringify(S.mdesign || {}),
      gone: SIG_V + JSON.stringify(S.gone || [])
    };
    var changed = false;
    if (sig.staff !== S.cfgTx.staff) { txStaffAll(); S.cfgTx.staff = sig.staff; changed = true; }
    if (sig.issue !== S.cfgTx.issue) { txIssueAll(); S.cfgTx.issue = sig.issue; changed = true; }
    if (sig.alias !== S.cfgTx.alias) { txAliasAll(); S.cfgTx.alias = sig.alias; changed = true; }
    if (sig.stock !== S.cfgTx.stock) { txStockAll(); S.cfgTx.stock = sig.stock; changed = true; }
    if (sig.mt !== S.cfgTx.mt) { txMtAll(); S.cfgTx.mt = sig.mt; changed = true; }
    if (sig.vend !== S.cfgTx.vend) { txVendAll(); S.cfgTx.vend = sig.vend; changed = true; }
    if (sig.plan !== S.cfgTx.plan) { txPlanEvery(); S.cfgTx.plan = sig.plan; changed = true; }
    if (sig.fac !== S.cfgTx.fac) { txFacAll(); S.cfgTx.fac = sig.fac; changed = true; }
    if (sig.mdes !== S.cfgTx.mdes) { txMdesAll(); S.cfgTx.mdes = sig.mdes; changed = true; }
    if (sig.gone !== S.cfgTx.gone) { txGoneAll(); S.cfgTx.gone = sig.gone; changed = true; }
    if (changed) A.save();
  }
  A._txCfgAll = txCfgAll;   /* 검사에서 부른다 */

  /* ★설정·명부 수신 — 종류별 additive upsert (v2.46.0). 빈/부분 수신이 로컬을
     절대 지우지 않는다(union — incoming이 실은 키만 갱신·추가, 없는 키는 보존).
     삭제 전파는 하지 않는다(vend·plan과 동일 — tombstone 미구현).
     각 함수 반환 : 실제로 바뀌었으면 true(수신 건수에 센다). */
  function mergeStaff(r) {
    if (!r || !r.sid) return false;
    if (r.del) {                       /* ★지운 것 표식 (v2.48.0) */
      var hadS = S.staff.some(function (m) { return m.id === r.sid; });
      if (!hadS) return false;
      S.staff = S.staff.filter(function (m) { return m.id !== r.sid; });
      if (S.me === r.sid) S.me = '';
      return true;
    }
    if (!r.name) return false;
    var hit = null;
    S.staff.forEach(function (m) { if (m.id === r.sid) hit = m; });
    var grps = Array.isArray(r.grps) ? r.grps : (r.grps ? [String(r.grps)] : []);
    if (hit) {
      var ch = hit.name !== r.name ||
               (r.tel && hit.tel !== r.tel) ||
               (grps.length && JSON.stringify(hit.grps || []) !== JSON.stringify(grps));
      if (!ch) return false;
      hit.name = r.name;
      if (r.tel) hit.tel = r.tel;
      if (grps.length) hit.grps = grps;
    } else {
      S.staff.push({ id: r.sid, name: r.name, tel: r.tel || '', grps: grps });
    }
    return true;
  }
  function mergeIssue(r) {
    if (!r || !r.iid) return false;
    if (r.del) {                       /* ★지운 것 표식 (v2.48.0) */
      var hadI = S.issue.some(function (g) { return g.id === r.iid; });
      if (!hadI) return false;
      S.issue = S.issue.filter(function (g) { return g.id !== r.iid; });
      return true;
    }
    var hit = null;
    S.issue.forEach(function (g) { if (g.id === r.iid) hit = g; });
    var cnt = (r.cnt === 0 || r.cnt) ? (Number(r.cnt) || 0) : 0;
    /* ★업체는 `by`다 (coOf가 co||by로 읽는다). 옛 형식(co)도 받아 준다.
       ★빈 by는 로컬 업체를 덮지 않는다 (v2.46.2 사용자 지적 「미등록 업체가 생겼다」).
         v2.46.0이 업체 없이 올린 옛 줄을 되받으면, 채워진 로컬 업체가 빈 값으로
         지워져 「미등록 업체」가 됐다. 업체 정보는 줄지 않는다(빈→회사만, 회사→빈은 안 됨). */
    var by = r.by || r.co || '';
    if (hit) {
      /* loc은 표시에 안 쓰고 객체라 비교가 불안정하므로 변경 감지에서 뺀다 */
      var ch = hit.date !== (r.date || '') || hit.cat !== (r.cat || '') ||
               hit.size !== (r.size || '') || hit.kind !== (r.kind || '') ||
               hit.cnt !== cnt || (by && (hit.by || '') !== by);
      if (!ch) return false;
      hit.date = r.date || ''; hit.loc = r.loc || hit.loc; hit.cat = r.cat || '';
      hit.size = r.size || ''; hit.kind = r.kind || ''; hit.cnt = cnt;
      if (by) hit.by = by;                    /* ★빈 by는 무시 — 로컬 업체를 지키다 */
    } else {
      if (!by) return false;                  /* ★업체 없는 새 줄은 안 받는다 — 미등록 업체를 만든다 */
      S.issue.push({ id: r.iid, date: r.date || '', loc: r.loc || '', cat: r.cat || '',
                     size: r.size || '', kind: r.kind || '', cnt: cnt, by: by });
    }
    return true;
  }
  function mergeAlias(r) {
    if (!r || !r.k || !r.code) return false;
    S.alias = S.alias || {};
    if (S.alias[r.k] === r.code) return false;
    S.alias[r.k] = r.code;
    return true;
  }
  function mergeAlias2(r) {
    if (!r || !r.k || !r.code) return false;
    S.alias2 = S.alias2 || {};
    var prev = S.alias2[r.k];
    /* learnAlias와 같은 규칙 — 처음 보면 채우고, 다른 코드면 '*'(갈린 것) */
    var nv = (prev === undefined) ? r.code : (prev === r.code ? r.code : '*');
    if (prev === nv) return false;
    S.alias2[r.k] = nv;
    return true;
  }
  function mergeStock(r) {
    if (!r || !r.lk || !r.mid) return false;
    S.stock = S.stock || {};
    if (r.del) {                       /* ★지운 것 표식 (v2.48.0) */
      if (!S.stock[r.lk] || S.stock[r.lk][r.mid] == null) return false;
      delete S.stock[r.lk][r.mid];
      return true;
    }
    S.stock[r.lk] = S.stock[r.lk] || {};
    var qty = Number(r.qty) || 0;
    if (S.stock[r.lk][r.mid] === qty) return false;
    S.stock[r.lk][r.mid] = qty;
    return true;
  }
  /* ★시설 계수 수신 (v2.47.0). 값이 **배열**이다. 빈 배열은 무시한다 —
     v2.46의 교훈 : 빈 값으로 덮으면 멀쩡한 자료가 지워진다(「미등록 업체」 사고). */
  function mergeFac(r) {
    if (!r || !r.lk || !r.fid) return false;
    var cnt = Array.isArray(r.cnt) ? r.cnt : null;
    if (!cnt || !cnt.length) return false;
    S.fac = S.fac || {};
    S.fac[r.lk] = S.fac[r.lk] || {};
    if (JSON.stringify(S.fac[r.lk][r.fid] || []) === JSON.stringify(cnt)) return false;
    S.fac[r.lk][r.fid] = cnt.slice();
    return true;
  }
  /* ★자재 설계수량 수신 (v2.47.0) — 수치 하나. 빈 값은 무시한다. */
  function mergeMdes(r) {
    if (!r || !r.lk || !r.mid) return false;
    if (r.qty == null || r.qty === '') return false;
    S.mdesign = S.mdesign || {};
    S.mdesign[r.lk] = S.mdesign[r.lk] || {};
    var q = Number(r.qty) || 0;
    if (S.mdesign[r.lk][r.mid] === q) return false;
    S.mdesign[r.lk][r.mid] = q;
    return true;
  }
  function mergeMt(r) {
    if (!r || !r.mid) return false;
    S.mt = S.mt || {};
    var m = S.mt[r.mid] = S.mt[r.mid] || {};
    var ch = false;
    if (r.step && m.step !== r.step) {
      m.step = r.step;
      m.req = (r.step !== 'done');   /* 옛 필드 유지 — core.mtSet과 같은 규칙 */
      ch = true;
    }
    if (r.why != null && r.why !== '' && m.why !== r.why) { m.why = r.why; ch = true; }
    if (r.reqAt && m.reqAt !== r.reqAt) { m.reqAt = r.reqAt; ch = true; }
    if (r.doneAt && m.doneAt !== r.doneAt) { m.doneAt = r.doneAt; ch = true; }
    return ch;
  }
  A._mergeStaff = mergeStaff; A._mergeIssue = mergeIssue;
  A._mergeAlias = mergeAlias; A._mergeAlias2 = mergeAlias2;
  A._mergeStock = mergeStock; A._mergeMt = mergeMt;
  A._mergeFac = mergeFac; A._mergeMdes = mergeMdes;

  /* ★설계량 서버 전송 (v2.18.4 사용자 지적).
     종전에는 브라우저 localStorage에만 있었다. 다른 PC에서 열면 안 보이고
     브라우저를 정리하면 사라졌다 — 힘들게 올린 자료가 없어지는 자리다.
     ★한 칸이 한 줄이다. id는 '위치키|공종코드'로 고정해, 수량을 고쳐 다시
       보내면 서버가 그 줄을 덮어쓴다(upsert). */
  function txPlan(loc, code, qty) {
    var L = loc || {};
    txSend('plan', {                     /* ★줄 세워 보낸다 (v2.47.0) */
      id: A.locKey(loc) + '|' + code,
      date: A.today(), loc: A.locLabel(L),
      s: L.s, p: L.p, c: L.c, t: L.t, b: L.b,
      key: code, qty: Number(qty) || 0
    });
  }
  /* 한 위치를 통째로 보낸다 — 파일 업로드 직후 */
  function txPlanAll(loc) {
    var pl = S.plan[A.locKey(loc)] || {};
    Object.keys(pl).forEach(function (k) { txPlan(loc, k, pl[k]); });
  }
  /* ★모든 위치의 설계량을 보낸다 (v2.47.0 사용자 지적 「설계수량이 다르다」).
     종전에는 txPlanAll이 **업로드·저장하는 그 순간에만** 돌았다. 그래서 그 기능이
     생기기 전에 올려 둔 설계량, 또는 그 뒤로 손대지 않은 설계량은 **서버에 한 번도
     올라간 적이 없어** 다른 기기가 영영 못 받았다.
     ★locKey의 역함수 A.keyLoc(core.js)로 위치를 되찾아 기존 txPlan을 그대로 쓴다. */
  function txPlanEvery() {
    Object.keys(S.plan || {}).forEach(function (lk) {
      var loc = A.keyLoc(lk);
      if (!loc) return;                         /* 알 수 없는 열쇠는 건너뛴다 */
      var pl = S.plan[lk] || {};
      Object.keys(pl).forEach(function (k) { txPlan(loc, k, pl[k]); });
    });
  }

  /* ★스탭이 처리한 것을 서버로 되돌려 보낸다 (v2.18.6 사용자 지적).
     ★증상 : 대시보드를 열 때마다 이미 확인한 것이 확인 대기로 다시 올라온다.
     ★원인 : 확인·검측상태·측량완료가 브라우저 안에서만 바뀌고 서버에는
       그대로 'sub' / 'apply' / done=false로 남아 있었다. 다른 PC에서 열거나
       저장소를 비우면 서버 값이 돌아오므로 처리한 적이 없는 것이 된다.
       협력업체 화면은 보낼 줄 아는데 관리자 화면에 되돌려 보내는 길이
       아예 없었다 — direct·mat·plan만 있고 work·crew·insp·surv는 없었다.
     ★같은 id로 보내면 서버가 그 줄을 덮어쓴다(upsert). */
  function txBack(type, row) {
    var api = window.BNCP_API;
    if (!api || !api.on || !row) return;
    var L = row.loc || {};
    /* ★공종명·단위를 함께 보낸다 (v2.18.7 사용자 지적).
       종전에는 key만 보내서, 확인 처리를 하면 시트의 「공종명·단위」 칸이
       빈 값으로 덮어써졌다. 화면은 key로 조회하니 지장이 없었지만,
       시트를 직접 보면 무슨 공종인지 알아볼 수 없었다.
       ★협력업체 화면(payload)은 처음부터 name·unit을 채워 보내고 있었다.
         되돌려 보내는 쪽만 빠져 있었던 것이라, 그쪽과 같은 꼴로 맞춘다. */
    var e = A.item(row.key);
    var b = {
      id: row.id, date: row.date, loc: A.locLabel(L),
      s: L.s, p: L.p, c: L.c, t: L.t, b: L.b,
      key: row.key || '', by: row.by || '', st: row.st || '',
      name: e ? e.name : '', unit: e ? e.unit : ''
    };
    if (e && e.spec) b.spec = e.spec;
    if (row.spot === 0 || row.spot) b.spot = row.spot;
    if (row.tag) b.tag = row.tag;      /* 표기 — 관로·전기 계열의 위치다 */
    /* 구간(STA)도 협력업체 쪽과 같은 이름으로 실어 보낸다 */
    if (row.spot && row.spot.kind === 'road' && window.BNCP_SPOT) {
      b.road = window.BNCP_SPOT.roadName(row.spot);
      b.side = row.spot.side;
      b.sta = window.BNCP_SPOT.staText(row.spot.f) + '~' + window.BNCP_SPOT.staText(row.spot.t);
    }
    if (type === 'work') {
      b.qty = row.qty; b.ckAt = row.ckAt || '';
      if (row.subAt) b.subAt = row.subAt;                              /* 제출 시각 유지 (요청 ⑤) */
      if (row.admOK) { b.admOK = 1; b.admOKAt = row.admOKAt || ''; }   /* 오전 예외 확인 (요청 ⑤) */
      if (row.st === 'rej') { b.rejWhy = row.rejWhy || ''; b.rejAt = row.rejAt || ''; }
    }
    if (type === 'crew') {
      b.qty = row.teams;                  /* 시트 수량칸엔 조 수 — 협력업체와 같은 규칙 */
      b.teams = row.teams; b.ppl = row.ppl; b.eq = row.eq;
      b.pax = A.crewTotal(row); b.ckAt = row.ckAt || '';
    }
    if (type === 'insp') { b.qty = row.qty; b.stAt = row.stAt || ''; b.reason = row.reason || ''; b.seq = row.seq || 1;
      if (row.subAt) b.subAt = row.subAt;                              /* 제출 시각 유지 (요청 ⑤) */
      if (row.admOK) { b.admOK = 1; b.admOKAt = row.admOKAt || ''; } }  /* 오전 예외 확인 (요청 ⑤) */
    if (type === 'surv') { b.done = !!row.done; b.why = row.why || ''; }
    if (type === 'mat') { b.qty = row.qty; b.mat = row.mat || ''; b.spec = row.spec || ''; b.unit = row.unit || ''; if (row.iss != null) b.iss = row.iss; }
    /* ★결재 단계를 함께 보낸다 (v2.20.0). 안 보내면 다른 PC에서는
       스탭이 검토한 것이 여전히 「검토 대기」로 보인다 — v2.18.6에서
       확인 처리가 서버로 안 가 되살아나던 것과 **똑같은 사고**다. */
    if (type === 'mat' || type === 'surv') {
      b.fst = A.fst(type, row); b.fat = row.fat || ''; b.fby = row.fby || ''; b.fwhy = row.fwhy || '';
      /* ★양쪽 확인 표시도 같이 보낸다. 안 보내면 다른 PC에서는 스탭이 확인한
         것이 안 눌린 채로 보여, 업체가 눌러도 종료되지 않는다. */
      b.okS = row.okS ? 1 : 0; b.okV = row.okV ? 1 : 0;
    }
    /* ★작업 중단(v2.38.0) — tk·seg가 식별자, to(재개일)·why가 바뀌는 값이다.
       공종코드가 없어도 성립하도록 tk/seg를 반드시 싣는다. */
    if (type === 'stop') {
      b.tk = row.tk || ''; b.seg = row.seg || ''; b.to = row.to || '';
      b.why = row.why || ''; b.co = row.co || '';
    }
    row.up = 0;
    try {
      api.send(type, b).then(function (r) { row.up = (r && r.ok) ? 1 : 0; A.save(); });
    } catch (e) { /* 전송 실패는 무시 — 로컬 저장이 우선 */ }
  }

  /* ★증분 수신 (v2.19.3 사용자 지시).
     ★종전에는 열 때마다 전체를 받았다. 하루 100건이 몇 년 쌓이면 몇 만 줄을
       매번 내려받는다.
     ★이제 「바뀐 게 있나」만 먼저 묻고(수십 바이트), 있을 때만 그 뒤에
       들어온 줄만 받는다.
     ★force=true면 처음부터 다시 받는다 — 저장소를 비웠거나 자료가
       어긋났을 때 쓴다. */
  A._unpack = unpack;

  function syncNow(quiet, force) {
    var api = window.BNCP_API;
    if (!api || syncing) return;
    syncing = true;
    paintSync();
    txCfgAll();   /* ★내가 등록·업로드한 설정·명부를 서버로 밀어 올린다 — 서명이 바뀐 것만 (v2.46.0) */
    if (force) { api.last = ''; S.rxLast = ''; }
    else if (!api.last && S.rxLast) api.last = S.rxLast;   /* 새로 고쳐도 이어 받는다 */

    api.changed().then(function (rows) {
      syncing = false;
      if (!rows) { paintSync(); return; }
      if (api.last) { S.rxLast = api.last; A.save(); }
      if (!rows.length) { paintSync(); return; }            /* 바뀐 게 없다 */

      var box = { work: S.work, crew: S.crew, insp: S.insp, surv: S.surv,
                  mreq: S.mreq, direct: S.direct, stop: S.stop };
      var have = {}, mine = {}, add = 0, k;
      for (k in box) box[k].forEach(function (x) { have[x.id] = 1; mine[x.id] = x; });

      /* ★내가 처리해 둔 것을 서버의 옛 값으로 되돌리지 않는다 (v2.18.6).
         전송이 실패했거나 아직 안 올라간 사이에 수신이 돌면, 서버에는
         아직 'sub'/'apply'인 줄이 내 'ok'를 덮어쓴다. 그러면 확인한 것이
         확인 대기로 되살아난다 — 사용자가 겪은 그 증상이다. */
      function older(local, r) {
        if (!local) return false;
        /* ★rej(반려)는 sub와 같은 층이다 — 업체가 다시 올려야 하는 상태다.
           다만 반려는 스탭이 방금 내린 판정이므로 서버의 sub가 덮으면 안 된다.
           그래서 rej를 sub보다 한 칸 위에 둔다. */
        var rank = { sub: 0, apply: 0, rej: 0.5, ready: 1, ok: 2, pass: 2, iss: 2 };
        /* ★결재 단계도 같은 규칙을 따른다 (v2.20.0).
           안 그러면 스탭이 방금 올린 검토가 서버의 옛 'req'에 덮여
           검토 대기로 되살아난다 — v2.18.6에서 겪은 그 증상이다.
           ★되돌아간 것(back·rej)은 **앞선 판정**이다. 방금 누군가 반려한
             것이므로 서버의 낮은 단계가 덮으면 안 된다. */
        var frank = { req: 0, back: 0.5, rej: 0.5, chk: 1, ord: 2,
                      sdone: 3, sfail: 3, delay: 3, iss: 3, fin: 4, none: 4 };
        if (local.fst || r.fst) {
          var fa = frank[local.fst || ''], fb = frank[r.fst || ''];
          if (fa !== undefined && fb !== undefined && fb < fa) return true;
          /* ★같은 단계에 서 있어도 **양쪽 확인은 켜진 쪽이 이긴다.**
             스탭과 업체가 각자 다른 기기에서 누르므로, 서로의 확인이
             상대를 지우면 영영 종료되지 않는다. */
          if (fa === fb) {
            if (local.okS && !r.okS) return true;
            if (local.okV && !r.okV) return true;
          }
        }
        if (local.done === true && r.done === false) return true;
        var a = rank[local.st], b = rank[r.st];
        return (a !== undefined && b !== undefined && b < a);
      }

      rows.forEach(function (r) {
        /* ★설계량은 덮어쓰기가 정상이다 — 수량을 고쳐 다시 올릴 수 있어야 한다.
           그래서 have[] 검사를 건너뛴다. 나머지 종류는 종전대로 한 번만 받는다. */
        if (r.type === 'plan') {
          var up = unpack(r);
          if (up && up.box === '_plan') add++;
          return;
        }
        /* ★협력업체 명부 (v2.45.1) — code로 upsert. 링크(key)는 기존 것을 지킨다. */
        if (r.type === 'vend') { if (mergeVend(r)) add++; return; }
        /* ★설정·명부 나머지 (v2.46.0) — 종류별 additive upsert. 빈 수신이 로컬을 안 지운다. */
        if (r.type === 'staff')  { if (mergeStaff(r))  add++; return; }
        if (r.type === 'issue')  { if (mergeIssue(r))  add++; return; }
        if (r.type === 'alias')  { if (mergeAlias(r))  add++; return; }
        if (r.type === 'alias2') { if (mergeAlias2(r)) add++; return; }
        if (r.type === 'stock')  { if (mergeStock(r))  add++; return; }
        if (r.type === 'mt')     { if (mergeMt(r))     add++; return; }
        if (r.type === 'fac')    { if (mergeFac(r))    add++; return; }
        if (r.type === 'mdes')   { if (mergeMdes(r))   add++; return; }
        /* ★중단 기록은 상태(st)가 아니라 **재개일(to)**이 바뀐다 (v2.38.0).
           한쪽에서 재개하면 to가 찍혀 되돌아온다 — 그것만 반영한다.
           빈 to가 채워진 to를 덮지 않게, 채워진 쪽만 받는다. */
        if (r.type === 'stop' && have[r.id]) {
          var cs = mine[r.id];
          if (r.to && cs.to !== r.to) { cs.to = r.to; add++; }
          if (r.why && !cs.why) cs.why = r.why;
          return;
        }
        /* 이미 있는 줄 — 서버 쪽이 더 진행된 상태일 때만 반영한다 */
        if (have[r.id]) {
          var cur = mine[r.id];
          if (older(cur, r)) return;              /* 내 것이 더 앞서 있다 */
          var u2 = unpack(r);
          if (!u2 || !u2.row) return;
          if (cur.st !== u2.row.st || cur.done !== u2.row.done) {
            cur.st = u2.row.st;
            if ('done' in u2.row) cur.done = u2.row.done;
            add++;
          }
          return;
        }
        var u = unpack(r);
        if (!u || !u.row || !box[u.box]) return;
        box[u.box].push(u.row); have[u.row.id] = 1; mine[u.row.id] = u.row; add++;
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
          /* ★반려 추가 (v2.18.8 사용자 지시). 종전에는 OK뿐이라, 과다 실적을
             보고도 「맞다」고만 할 수 있었고 되돌려 보낼 길이 없었다.
             반려하면 협력업체 화면에서 고쳐 다시 올린다. */
          ' <button class="btn btn--g btn--sm" data-ckok="' + esc(r.w.id) + '">' + T('ck_ok') + '</button>' +
          ' <button class="btn btn--d btn--sm" data-ckno="' + esc(r.w.id) + '">' + T('ck_no') + '</button></div>';
      }).join('') + '</div>';
  }

  /* ══ 준비 — 맨 아래 버튼 줄 (v2.15.4) ═══════════════════
     설계수량·협력업체 명부·서버 동기화는 한 번 해 두면 쓸 일이 드물다.
     화면 위를 크게 차지하고 있어 맨 아래로 내리고, 버튼으로만 연다.
     한 번에 하나만 열린다 — 여러 개가 동시에 펼쳐지면 다시 길어진다. */
  var setupTab = '';
  /* ★수정 중인 담당자 (v2.21.0) — {code, raw}. 비어 있으면 「넣기」 모드다. */
  var vdEdit = null;
  A._setup = function (v) { setupTab = v; };   /* 검사에서 패널을 여는 통로 (6-B) */

  function setupHTML() {
    var lastPlan = A.hasPlan(flt);
    var tabs = [
      { id: 'plan', t: T('sp_plan'), n: lastPlan ? nf(lastPlan) + T('u_ea') : T('sp_none') },
      { id: 'eqgv', t: T('sp_eq'), n: eqGivenN() ? nf(eqGivenN()) + T('u_unitq') : T('sp_none') },
      { id: 'vend', t: T('vd_t'), n: S.vend.length ? nf(S.vend.length) + T('u_co') : T('sp_none') },
      /* ★우리 스탭 — 협력업체 명부 바로 뒤다. 둘은 다른 명부이나 성격이 붙어 있다 */
      { id: 'stff', t: T('st_t'), n: S.staff.length
          ? nf(S.staff.length) + T('u_person') + (A.me() ? ' · ' + A.me().name : '')
          : T('sp_none') },
      { id: 'sync', t: T('sync_t'), n: syncLabel() },
      { id: 'cap', t: T('cap_t'), n: A.usage().pct + '%' }
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
    else if (setupTab === 'eqgv') body = eqGvPanel();
    else if (setupTab === 'vend') body = vendPanel();
    else if (setupTab === 'stff') body = staffPanel();
    else if (setupTab === 'sync') body = syncPanel();
    else if (setupTab === 'cap') body = capPanel();

    return '<div style="margin-bottom:16px">' + card(T('sp_t'), '',
      bar + (body ? '<div class="stp__p">' + body + '</div>' : '')) + '</div>';
  }

  /* ★설계수량이 들어간 위치 — 파일명으로 정해진다(v2.18.2).
     상단 필터(flt)도, pkLoc('w')도 보지 않는다. 종전에 목록이 pkLoc('w')를
     보는 바람에 「적용 위치 Phase 3-2」라고 적어 놓고 정작 목록은 1-1 것을
     보여주던 결함이 있었다 — 안내와 실제가 서로 다른 변수를 봤다. */
  var planLoc = null;
  var planAskFile = null, planAskDet = null;

  function planAsk(f, det) {
    planAskFile = f; planAskDet = det;
    A.render();
    setTimeout(function () { say('#planMsg', T('pk_ask'), false); }, 30);
  }

  function planReadInto(f, loc) {
    readFile(f, function (rows) {
      if (A.isBoq(rows)) {
        var b = A.readBoqRows(rows, loc);
        boqNeed = b.need; boqLoc = loc; boqStore();
        var bm = A.locLabel(loc) + ' — ' + T('bq_read') + ' ' + b.ok + '/' + b.total + T('u_row');
        if (b.need.length) bm += ' · ' + T('bq_need') + ' ' + b.need.length + T('u_ea');
        A.render(); setTimeout(function () { say('#planMsg', bm, b.ok > 0); }, 30);
        return;
      }
      var r = A.readPlanRows(rows, loc);
      txPlanAll(loc);                    /* ★올린 즉시 서버로 */
      var m = A.locLabel(loc) + ' — ' + T('r_read') + ' ' + r.ok + T('u_row');
      if (r.wrongSite && r.wrongSite.length) m += ' · ' + T('r_wrongsite') + ' ' + r.wrongSite.length + T('u_ea');
      if (r.miss.length) m += ' · ' + T('r_nocode') + ' ' + r.miss.length + T('u_ea');
      if (r.skip) m += ' · ' + T('r_skip') + ' ' + r.skip;
      A.render(); setTimeout(function () { say('#planMsg', m, r.ok > 0); }, 30);
    }, '#planMsg');
  }

  /* 못 정했을 때 고르게 하는 줄 — 후보가 있으면 후보만, 없으면 전체 */
  function planAskHTML() {
    if (!planAskFile) return '';
    var list = (planAskDet && planAskDet.hits && planAskDet.hits.length)
      ? planAskDet.hits
      : (planAskDet && planAskDet.blockOnly
          ? A.TOWNS.filter(function (t) { return A.townBlocks(t.t).indexOf(planAskDet.blockOnly) >= 0; })
              .map(function (t) { return { s: 'anc', t: t.t, b: planAskDet.blockOnly }; })
          : A.allLocs());
    var why = planAskDet && planAskDet.many ? T('pk_many')
            : (planAskDet && planAskDet.blockOnly ? T('pk_blk') : T('pk_none'));
    return '<div class="ask"><div class="ask__h"><b>' + esc(planAskFile.name) + '</b> — ' + why + '</div>' +
      '<div class="f-row f-row--sm"><select class="in" id="pkAskSel">' +
      list.map(function (l) {
        return '<option value=\'' + esc(JSON.stringify(l)) + '\'>' + esc(A.locLabel(l)) + '</option>';
      }).join('') + '</select>' +
      '<div class="btns"><button class="btn btn--o btn--sm" id="pkAskGo">' + T('pk_go') + '</button>' +
      '<button class="btn btn--g btn--sm" id="pkAskNo">' + T('cancel') + '</button></div></div></div>';
  }

  /* ★저장 용량 (v2.18.5 사용자 지적).
     하루 100건이면 1~2년 안에 브라우저 한도(보통 5MB)에 부딪힌다.
     터지면 저장이 실패해 방금 입력한 것이 날아간다 — 미리 보여야 한다. */
  function capPanel() {
    var u = A.usage();
    var cls = u.pct >= 80 ? ' cap--d' : (u.pct >= 60 ? ' cap--w' : '');
    var n = 0;
    ['work', 'crew', 'insp', 'surv', 'mreq', 'direct'].forEach(function (b) {
      n += (S[b] || []).length;
    });
    return '<div class="cap' + cls + '">' +
      '<div class="cap__b"><i style="width:' + u.pct + '%"></i></div>' +
      '<div class="cap__t"><b>' + u.pct + '%</b> ' +
      '<span class="sp">' + nf(Math.round(u.bytes / 1024)) + 'KB · ' +
      T('cap_rec').replace('{n}', nf(n)) + '</span></div></div>' +
      '<div class="hint" style="margin-top:8px">' +
      T('cap_n').replace('{d}', A.KEEP_DAYS) + '</div>' +
      (S.trimMsg ? '<div class="alert alert--o" style="margin-top:10px">' + esc(S.trimMsg) + '</div>' : '') +
      srvCapHTML() +
      '<div class="f-row f-row--sm" style="margin-top:10px">' +
      '<div class="btns"><button class="btn btn--g btn--sm" id="capTrim">' +
      T('cap_trim').replace('{d}', A.KEEP_DAYS) + '</button></div></div>' +
      '<div id="capMsg" class="hint"></div>';
  }

  /* ★서버 용량 계기판 (v2.22.5 · 0-Z-4).
     ★위의 것은 **이 기기**의 저장 용량이고, 이것은 **구글 시트**의 용량이다.
       둘은 전혀 다른 한도다 — 기기는 5MB, 시트는 셀 1,000만 개다.
     ★사용자 물음 : 「용량이 80% 찰 경우 경고하고 파일 추가하는 거 가능하겠어?」
       경고는 여기서 한다. **파일 추가는 아직 안 만들었다** — 12열 기준 약 83만
       줄이라, 하루 100줄이면 22년·500줄이라도 4년이 걸린다. 필요해지는 때를
       이 숫자가 알려준다. 그때 0-Z-4의 나머지를 만들면 된다.
     ★서버와 통신한 적이 없으면 아무것도 안 그린다 — 모르는 것을 0%로
       보여주면 안 찼다고 오해한다. */
  function srvCapHTML() {
    var c = (window.BNCP_API && window.BNCP_API.cap) || null;
    if (!c || c.pct == null) return '';
    var cls = c.pct >= 80 ? ' cap--d' : (c.pct >= 60 ? ' cap--w' : '');
    return '<div style="margin-top:14px">' +
      '<div class="hint" style="margin-bottom:6px"><b>' + T('scap_t') + '</b></div>' +
      '<div class="cap' + cls + '">' +
      '<div class="cap__b"><i style="width:' + Math.max(c.pct, 1) + '%"></i></div>' +
      '<div class="cap__t"><b>' + c.pct + '%</b> ' +
      '<span class="sp">' + T('scap_n')
        .replace('{r}', nf(c.rows || 0)).replace('{c}', nf(c.cells || 0)) + '</span>' +
      '</div></div>' +
      (c.pct >= 80
        ? '<div class="alert alert--o" style="margin-top:10px">' + T('scap_w') + '</div>'
        : '<div class="hint" style="margin-top:8px">' + T('scap_h') + '</div>') +
      '</div>';
  }

  function planPanel() {
    return '<div class="f-row">' +
      fld(T('plan_up'), fileIn('planFile', '.csv,.xlsx,.xls')) +
      fld('&nbsp;', '<div class="btns"><button class="btn btn--g btn--sm" id="planTpl">' + T('tpl') + '</button>' +
        '<button class="btn btn--g btn--sm" id="facOpen">' + T('plan_fac') + '</button></div>') +
      '</div>' +
      '<div class="hint" style="margin-top:8px">' + T('h_byname') + '</div>' +
      planAskHTML() +
      '<div id="planMsg" class="hint"></div><div id="facBox" style="display:none;margin-top:14px"></div>' +
      planListHTML();
  }

  /* ★올린 설계량을 여기서 확인한다 (v2.16.8 — 사용자 물음).
     종전에는 「109개」라는 수만 보이고 무엇이 들어갔는지 볼 데가 없었다.
     진행률 표는 실적이 있는 것만 보여 주므로 대조가 안 됐다. */
  function planListHTML() {
    /* ★파일명으로 정해진 위치를 따라간다. 아직 아무것도 안 올렸으면
       화면에서 고른 위치를 보여준다. */
    var loc = planLoc || pkLoc('w');
    var lk = A.locKey(loc), pl = S.plan[lk] || {};
    var keys = Object.keys(pl);
    if (!keys.length) {
      return '<div class="hint" style="margin-top:10px">' + T('sp_none') + '</div>' + planAddHTML(loc);
    }
    keys.sort();
    /* ★한 번에 지울 수 있게 (v2.17.6 사용자 지시) */
    return '<div class="dp"><div class="dp__h"><b>' + T('pl_list') + '</b> ' +
      '<span class="sp">' + esc(A.locLabel(loc)) + ' · ' + nf(keys.length) + T('u_ea') + '</span>' +
      '<span class="sp"></span><button class="btn btn--g btn--sm noprint" id="plClrAll">' +
      T('pl_clrall') + '</button></div>' +
      '<div class="tw" style="max-height:300px"><table><thead><tr>' +
      '<th>' + T('work') + '</th><th class="r">' + T('target') + '</th>' +
      '<th class="noprint"></th></tr></thead><tbody>' +
      keys.map(function (k) {
        var e = A.item(k) || {};
        return '<tr><td><span class="code">' + esc(k) + '</span> ' +
          esc(A.trW(e.name || k)) + (e.spec ? ' <span class="sp">' + esc(A.trS(e.spec)) + '</span>' : '') + '</td>' +
          '<td class="r"><input class="in num pl__q" type="number" step="0.01" ' +
            'data-plq="' + esc(k) + '" value="' + nf(pl[k], 2) + '"></td>' +
          '<td class="c noprint"><button class="btn btn--g btn--sm" data-pld="' + esc(k) + '">' +
            T('d_del') + '</button></td></tr>';
      }).join('') + '</tbody></table></div>' + planAddHTML(loc) + '</div>';
  }

  /* ★빠진 공종을 손으로 넣는다 (v2.19.2 사용자 지시).
     내역서에 없거나 코드가 안 붙은 공종은 설계수량이 통째로 비어 진행률이
     안 나온다. 파일을 다시 만들 것 없이 여기서 채운다.
     ★있는 코드를 다시 넣으면 덮어쓴다 — 중복 줄을 만들지 않는다.
       삭제는 목록의 [삭제]로 한다(이미 있다). */
  var planAddOpen = false;
  function planAddHTML(loc) {
    var h = '<div class="eqadd"><button class="eqadd__t" id="plAddT" aria-expanded="' + planAddOpen + '">' +
      (planAddOpen ? '▾' : '▸') + ' ' + T('pl_add') + '</button>';
    if (planAddOpen) {
      var site = loc && loc.s === 'anc' ? 'anc' : 'civil';
      /* 이미 올라온 공종은 뺀다 — 중복해서 넣을 일이 없다 */
      var has = S.plan[A.locKey(loc)] || {};
      var items = A.itemsOf(site).filter(function (e) { return !has[e.key]; });
      h += '<div class="eqadd__row">' +
        '<select class="in" id="plKey" style="width:340px">' +
        '<option value="">' + T('pick') + '</option>' +
        items.map(function (e) {
          return '<option value="' + esc(e.key) + '">' +
            esc((e.code ? e.code + ' · ' : '') + A.trW(e.name) +
                (e.spec ? ' · ' + A.trS(e.spec) : '') + ' [' + e.unit + ']') + '</option>';
        }).join('') + '</select>' +
        '<input class="in num" id="plQty" type="number" step="0.01" placeholder="0">' +
        '<button class="btn btn--sm" id="plAdd">' + T('add') + '</button>' +
        '</div><div class="hint" id="plAddMsg">' + T('pl_add_n') + '</div>';
    }
    return h + '</div>';
  }

  function eqGivenN() {
    var n = 0;
    S.issue.forEach(function (g) { if (g.kind !== 'take') n += Number(g.cnt) || 0; });
    return n;
  }
  /* ★지급대장 CSV — 처리기(#isFile)는 살아 있었는데 화면에 칸이 없었다.
     옛 탭이 없어지면서 UI만 사라져, 손으로 한 종류씩 넣는 길밖에 없었다. */
  /* ★업체 고르는 칸 — 지급대장은 업체 축이다 (v2.19.14).
     ★파일 안에 업체명이 없다. 행은 공종·팀이라 뽑아낼 방법이 없으므로
       올릴 때 사람이 고른다. 고르지 않으면 올리지 않는다. */
  var coPick = {};                       /* 고른 업체 — 다시 그려도 남는다 */
  function coSel(id) {
    return '<select class="in" data-copick="' + id + '" id="' + id + '"><option value="">' + T('pick') + '</option>' +
      S.vend.map(function (v) {
        return '<option value="' + esc(v.name) + '"' + (coPick[id] === v.name ? ' selected' : '') + '>' +
          esc(v.name) + '</option>';
      }).join('') + '</select>';
  }
  function eqGvPanel() {
    return '<div class="f-row">' +
      fld(T('vd_name'), coSel('isCo')) +
      fld(T('sp_eq_up'), fileIn('isFile', '.csv,.xlsx,.xls')) +
      fld('&nbsp;', '<div class="btns"><button class="btn btn--g btn--sm" id="isTpl">' + T('tpl') + '</button></div>') +
      '</div>' +
      '<div class="hint" style="margin-top:8px">' + T('h_applyloc') + ' <b>' + esc(fltLabel()) + '</b> — ' + T('sp_eq_n') + '</div>' +
      '<div class="hint">' + T('e_coneed') + '</div>' +
      '<div id="isMsg" class="hint"></div>';
  }

  /* ★명부를 **두 단계**로 나눈다 (v2.21.0 사용자 지시).
       「업체만 입력하고, 업체가 생성되면 생성된 업체에 담당자만 입력」
     ★종전에는 한 폼에서 업체코드·업체명·담당자를 **매번 다시** 적었다.
       업체명을 그때그때 타이핑하다 한 글자만 달라도(KEW / K.E.W) 같은
       업체가 둘로 갈라진다. 이제 업체는 한 번 만들고, 담당자는 **골라 붙인다.**
     ★전화번호는 담당자마다 따로다 — 독촉이 **사람에게** 가야 한다.
       대표번호로만 보내면 누가 처리할지 모른 채 업체 안에서 돌기만 한다. */
  /* ══ 우리 스탭 명부 (v2.23.0) ═══════════════════════════
     사용자 확정 : 공종그룹 단위(토공·우수공·오수공…) · 이름+전화 ·
                   「내 차례」에 걸리게 · **중복지정 가능**
     ★협력업체 명부와 **다른 것**이다. 저쪽은 업체 직원, 이쪽은 우리 직원이다. */
  var stEdit = null;                      /* 고치는 중인 스탭 id */

  function staffPanel() {
    var ed = stEdit ? A.staffById(stEdit) : null;
    if (stEdit && !ed) stEdit = null;
    var grps = A.staffGrps();

    /* ── 나는 누구 ─────────────────────────────────────
       ★로그인은 역할로만 되어 있어 사람을 못 가린다. 기기가 기억한다. */
    var me = A.me();
    var h = '<div class="hint" style="margin-bottom:6px"><b>' + T('st_me') + '</b> — ' +
      T('st_me_n') + '</div>' +
      '<div class="f-row">' +
      fld(T('st_me'), '<select class="in" id="stMe"><option value="">' + T('st_me_no') + '</option>' +
        S.staff.map(function (m) {
          return '<option value="' + esc(m.id) + '"' + (me && me.id === m.id ? ' selected' : '') +
            '>' + esc(m.name) + '</option>';
        }).join('') + '</select>') +
      '</div>' +
      (me && !(me.grps || []).length
        ? '<div class="hint">' + T('st_me_nogrp') + '</div>'
        : '') +
      '<div class="sb__sp" style="margin:14px 0"></div>';

    /* ── 명부 넣기 ─────────────────────────────────── */
    h += '<div class="hint" style="margin-bottom:6px"><b>' + T('st_add') + '</b> — ' + T('st_add_n') +
      (ed ? ' <span class="bd bd--o">' + T('vd_editing') + ': ' + esc(ed.name) + '</span>' : '') +
      '</div>' +
      '<div class="f-row">' +
      fld(T('st_name'), '<input class="in" id="stName" placeholder="Kim" value="' +
        (ed ? esc(ed.name) : '') + '">') +
      fld(T('st_tel'), '<input class="in" id="stTel" placeholder="821000000000" value="' +
        (ed ? esc(ed.tel) : '') + '">') +
      '</div>' +
      /* ★그룹은 여러 개를 고른다 — 한 사람이 토공·우수공을 같이 맡는 일이 흔하다 */
      '<div class="hint" style="margin:8px 0 6px"><b>' + T('st_grps') + '</b> — ' + T('st_grps_n') + '</div>' +
      '<div class="btns">' + grps.map(function (g) {
        var on = ed && (ed.grps || []).indexOf(g) >= 0;
        return '<label class="btn btn--g btn--sm' + (on ? ' btn--o' : '') + '">' +
          '<input type="checkbox" data-stg="' + esc(g) + '"' + (on ? ' checked' : '') +
          ' style="margin-right:6px">' + esc(A.trW(g)) + '</label>';
      }).join('') + '</div>' +
      '<div class="btns" style="margin-top:10px">' +
      '<button class="btn" id="stAdd">' + T(ed ? 'st_save' : 'st_mk') + '</button>' +
      (ed ? ' <button class="btn btn--g" id="stCancel">' + T('vd_cancel') + '</button>' : '') +
      '</div>';

    /* ── 명부 표 ───────────────────────────────────── */
    h += '<div class="sb__sp" style="margin:14px 0"></div>';
    if (!S.staff.length) {
      h += '<div class="hint">' + T('st_none') + '</div>';
      return h;
    }
    h += '<div class="tw"><table><thead><tr>' +
      '<th>' + T('st_name') + '</th><th>' + T('st_tel') + '</th>' +
      '<th>' + T('st_grps') + '</th><th class="noprint">' + T('th_act') + '</th>' +
      '</tr></thead><tbody>' +
      S.staff.map(function (m) {
        var gl = (m.grps || []);
        return '<tr><td><b class="nm">' + esc(m.name) + '</b>' +
          (me && me.id === m.id ? ' <span class="bd bd--o">' + T('st_isme') + '</span>' : '') + '</td>' +
          '<td class="sp">' + (m.tel ? esc(m.tel) : '<span class="sp">—</span>') + '</td>' +
          '<td>' + (gl.length
            ? gl.map(function (g) { return '<span class="bd">' + esc(A.trW(g)) + '</span>'; }).join(' ')
            : '<span class="sp">' + T('st_nogrp') + '</span>') + '</td>' +
          '<td class="c noprint">' +
          '<button class="btn btn--g btn--sm" data-sted="' + esc(m.id) + '">' + T('edit') + '</button> ' +
          '<button class="btn btn--g btn--sm" data-stdel="' + esc(m.id) + '">' + T('del') + '</button>' +
          '</td></tr>';
      }).join('') + '</tbody></table></div>';

    /* ★담당이 아무도 없는 그룹을 알려준다 — 주인 없는 일은 아무도 안 한다 */
    var orphan = grps.filter(function (g) { return !A.staffOf(g).length; });
    if (orphan.length) {
      h += '<div class="hint" style="margin-top:10px">' + T('st_orphan')
        .replace('{n}', nf(orphan.length)) + '</div>';
    }
    return h;
  }

  function vendPanel() {
    var ed = vdEdit, edV = null, edQ = null;
    if (ed) {
      S.vend.forEach(function (v) { if (v.code === ed.code) edV = v; });
      if (edV) A.vendStaffList(edV).forEach(function (q) { if (q.raw === ed.raw) edQ = q; });
      if (!edQ) { vdEdit = ed = null; }
    }

    /* ── 1단계 : 업체 만들기 ─────────────────────────── */
    var h = '<div class="hint" style="margin-bottom:6px"><b>' + T('vd_step1') + '</b> — ' + T('vd_step1n') + '</div>' +
      '<div class="f-row">' +
      fld(T('vd_code'), '<input class="in" id="vdCode" placeholder="KEW">') +
      fld(T('vd_name'), '<input class="in" id="vdName" placeholder="Al-Kawthar">') +
      fld('&nbsp;', '<button class="btn" id="vdMk">' + T('vd_mk') + '</button>') +
      '</div>';

    /* ── 2단계 : 담당자 넣기 ────────────────────────── */
    h += '<div class="sb__sp" style="margin:14px 0"></div>' +
      '<div class="hint" style="margin-bottom:6px"><b>' + T('vd_step2') + '</b> — ' + T('vd_step2n') +
      (ed ? ' <span class="bd bd--o">' + T('vd_editing') + ': ' + esc(edQ.name) + '</span>' : '') + '</div>';
    if (!S.vend.length) {
      /* ★업체가 없으면 담당자 폼을 **아예 그리지 않는다.** 빈 드롭다운을
         띄워 두면 눌러 보고 나서야 안 된다는 걸 안다. */
      h += '<div class="hint">' + T('vd_first') + '</div>';
    } else {
      h += '<div class="f-row">' +
        fld(T('vd_pick'), '<select class="in" id="vdCo">' + S.vend.map(function (v) {
          return '<option value="' + esc(v.code) + '"' +
            (ed && ed.code === v.code ? ' selected' : '') + '>' +
            esc(v.name) + ' (' + esc(v.code) + ')</option>';
        }).join('') + '</select>') +
        fld(T('work'), '<select class="in" id="vdGrp"><option value="">' + T('all') + '</option>' +
          A.groupsOf(flt.s === 'anc' ? 'anc' : 'civil').map(function (g) {
            return '<option value="' + esc(g.grp) + '"' +
              (edQ && edQ.grp === g.grp ? ' selected' : '') + '>' + esc(A.trW(g.grp)) + '</option>';
          }).join('') + '</select>') +
        fld(T('vd_staff'), '<input class="in" id="vdStaff" placeholder="Ahmed" value="' +
          (edQ ? esc(edQ.name) : '') + '">') +
        fld(T('vd_tel'), '<input class="in" id="vdTel" placeholder="964770000000" value="' +
          (edQ ? esc(edQ.tel) : '') + '">') +
        fld('&nbsp;', '<button class="btn" id="vdAdd">' + T(ed ? 'vd_ssave' : 'vd_sadd') + '</button>' +
          (ed ? ' <button class="btn btn--g" id="vdCancel">' + T('vd_cancel') + '</button>' : '')) +
        '</div>';
    }

    h += '<div class="btns" style="margin-top:10px"><label class="btn btn--g btn--sm">' + T('vd_up') +
      '<input type="file" id="vdFile" accept=".csv,text/csv" style="display:none"></label>' +
      (S.vend.length ? '<button class="btn btn--d btn--sm" id="vdReset">' + T('vd_reset') + '</button>' : '') +
      '<span class="hint" id="vdMsg">' + T('vd_upn') + '</span></div>';
    if (S.vend.length) h += '<div class="hint">' + T('vd_reset_n') + '</div>';

    if (!S.vend.length) return h + '<div class="hint" style="margin-top:10px">' + T('vd_none') + '</div>';

    /* ── 명부 ─────────────────────────────────────── */
    h += '<div class="tw" style="margin-top:12px"><table><thead><tr>' +
      '<th>' + T('vd_name') + '</th><th>' + T('vd_staff') + '</th>' +
      '<th>' + T('vd_link') + '</th><th class="noprint"></th></tr></thead><tbody>' +
      S.vend.map(function (v) {
        var st = A.vendStaffList(v);
        return '<tr><td><span class="nm">' + esc(v.name) + '</span> <span class="code">' + esc(v.code) + '</span></td>' +
          '<td>' + (st.length ? st.map(function (q) {
            /* ★번호 없는 담당자는 **눈에 띄게** 둔다. 독촉이 못 가는 사람이라
               모르고 지나가면 그 자리에서 결재가 멈춘다. */
            return '<div class="mta"><span class="bd">' +
              (q.grp ? '<i class="sp">' + esc(A.trW(q.grp)) + '</i> ' : '') + esc(q.name) + '</span> ' +
              (q.tel ? '<span class="sp">+' + esc(q.tel) + '</span>'
                     : '<span class="bd bd--d">' + T('vd_notel') + '</span>') +
              ' <button class="btn btn--g btn--sm noprint" data-vsed="' + esc(v.code) +
              '" data-s="' + esc(q.raw) + '">' + T('vd_edit') + '</button>' +
              ' <button class="btn btn--g btn--sm noprint" data-vsdel="' + esc(v.code) +
              '" data-s="' + esc(q.raw) + '">' + T('del') + '</button></div>';
          }).join('') : '<span class="sp">' + T('vd_nostaff') + '</span>') + '</td>' +
          '<td><code class="vlink" title="' + esc(A.vendUrl(v.key)) + '">' + esc(A.vendUrl(v.key)) + '</code> ' +
          '<button class="btn btn--g btn--sm noprint" data-vcopy="' + esc(v.key) + '">' + T('copy') + '</button></td>' +
          '<td class="c noprint"><button class="btn btn--g btn--sm" data-vdel="' + esc(v.code) + '">' + T('del') + '</button></td></tr>';
      }).join('') + '</tbody></table></div>';
    return h;
  }

  function syncPanel() {
    /* ★[전체 다시 받기]가 따로 필요하다 (v2.19.3).
       증분만 받으면 90일 정리로 덜어낸 것이나, 저장소를 비운 뒤에는
       빈 화면으로 남는다. 처음부터 다시 받는 길을 열어 둔다. */
    return '<div class="btns"><button class="btn btn--g btn--sm" id="syncBtn">' + T('sync_btn') + '</button>' +
      '<button class="btn btn--g btn--sm" id="syncAll">' + T('sync_all') + '</button>' +
      '<span class="hint" id="syncMsg">' + syncLabel() + '</span></div>' +
      '<div class="hint" style="margin-top:8px">' + T('sync_n') + '</div>' +
      '<div class="hint">' + T('sync_inc') + '</div>';
  }

  function setupBind() {
    $$('[data-stp]').forEach(function (b) {
      b.onclick = function () {
        setupTab = (setupTab === b.dataset.stp) ? '' : b.dataset.stp;
        A.render();
      };
    });
    /* 1단계 — 업체만 만든다 */
    /* ── 우리 스탭 명부 (v2.23.0) ─────────────────────── */
    if ($('#stMe')) $('#stMe').onchange = function () { A.setMe(this.value); A.render(); };
    if ($('#stAdd')) $('#stAdd').onclick = function () {
      /* 고른 공종그룹을 모은다 — 여럿이어도 되고 하나도 없어도 된다 */
      var gs = [];
      $$('[data-stg]').forEach(function (c) { if (c.checked) gs.push(c.dataset.stg); });
      var nm = val('#stName'), tel = val('#stTel');
      var r = stEdit ? A.staffUpd(stEdit, { name: nm, tel: tel, grps: gs })
                     : A.staffAdd({ name: nm, tel: tel, grps: gs });
      if (!r) { alert(T('st_need')); return; }   /* ★이름이 없으면 안 만든다 */
      txCfgAll();                                 /* ★담당자도 서버로 — 다른 기기도 받는다 (v2.46.0) */
      stEdit = null; A.render();
    };
    if ($('#stCancel')) $('#stCancel').onclick = function () { stEdit = null; A.render(); };
    $$('[data-sted]').forEach(function (b) {
      b.onclick = function () { stEdit = b.dataset.sted; A.render(); };
    });
    $$('[data-stdel]').forEach(function (b) {
      b.onclick = function () {
        var m = A.staffById(b.dataset.stdel); if (!m) return;
        if (!confirm(T('st_del_c').replace('{n}', m.name))) return;
        A.staffDel(b.dataset.stdel); txCfgAll(); stEdit = null; A.render();
      };
    });

    if ($('#vdMk')) $('#vdMk').onclick = function () {
      var r = A.vendCreate(val('#vdCode'), val('#vdName'));
      if (!r.ok) { say('#vdMsg', T('vd_need'), false); return; }
      txVendAll();                       /* ★명부를 서버로 — 모바일도 같은 회사명을 쓴다 */
      vdEdit = null; A.render();
      setTimeout(function () { say('#vdMsg', T(r.dup ? 'vd_upd' : 'vd_made'), true); }, 30);
    };
    /* 2단계 — 고른 업체에 담당자를 붙이거나 고친다 */
    if ($('#vdAdd')) $('#vdAdd').onclick = function () {
      var code = val('#vdCo'), g = val('#vdGrp'), nm = val('#vdStaff'), tel = val('#vdTel');
      var r = vdEdit
        ? A.vendStaffSet(vdEdit.code, vdEdit.raw, g, nm, tel)
        : A.vendStaffAdd(code, g, nm, tel);
      if (!r.ok) { say('#vdMsg', T(r.why === 'sname' ? 'vd_sneed' : 'vd_first'), false); return; }
      var was = !!vdEdit || r.edit;
      txVendAll();                       /* ★담당자 추가·수정도 서버로 (v2.45.1) */
      vdEdit = null; A.render();
      setTimeout(function () { say('#vdMsg', T(was ? 'vd_sedit' : 'vd_sok'), true); }, 30);
    };
    if ($('#vdCancel')) $('#vdCancel').onclick = function () { vdEdit = null; A.render(); };
    $$('[data-vsed]').forEach(function (b) {
      b.onclick = function () { vdEdit = { code: b.dataset.vsed, raw: b.dataset.s }; A.render(); };
    });
    /* ★명부 초기화 — 되돌릴 수 없으므로 반드시 확인을 받는다 */
    if ($('#vdReset')) $('#vdReset').onclick = function () {
      if (!confirm(T('vd_reset_ask'))) return;
      var n = A.vendReset();
      vdEdit = null; A.render();
      setTimeout(function () { say('#vdMsg', T('vd_reset_done') + ' (' + nf(n) + ')', true); }, 30);
    };
    /* 알림 — 업체별 문안·전체 요약 복사 (v2.16.1) */
    function cp(txt, msgId) {
      var done = 0;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt); done = 1; }
      } catch (e) { }
      if (!done) {
        try {
          var ta = document.createElement('textarea');
          ta.value = txt; document.body.appendChild(ta); ta.select();
          document.execCommand('copy'); document.body.removeChild(ta); done = 1;
        } catch (e2) { }
      }
      say(msgId, done ? T('vd_copied') : T('vd_copyfail'), !!done);
    }
    $$('[data-ncopy]').forEach(function (b) {
      b.onclick = function () {
        var rs = noticeRows(), o = rs[+b.dataset.ncopy];
        if (o) cp(noticeOne(o, S.lang === 'ko' ? 'ko' : 'en'), '#nMsg');
      };
    });
    $$('[data-ducp]').forEach(function (b) {
      b.onclick = function () { cp(b.dataset.ducp, '#nMsg'); };
    });
    if ($('#duAll')) $('#duAll').onclick = function () {
      var d = A.dueList(flt), t = [];
      d.co.forEach(function (c) { t.push(dueMsgCo(c)); });
      d.staff.forEach(function (x) { t.push(dueMsgStaff(x)); });
      cp(t.join('\n'), '#nMsg');
    };
    if ($('#nSumCopy')) $('#nSumCopy').onclick = function () { cp(noticeAll(noticeRows()), '#nMsg'); };

    $$('[data-vcopy]').forEach(function (b) {
      b.onclick = function () {
        var url = A.vendUrl(b.dataset.vcopy), done = 0;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url); done = 1;
          }
        } catch (e) { }
        if (!done) {                      /* 옛 브라우저·http 환경 대비 */
          try {
            var ta = document.createElement('textarea');
            ta.value = url; document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); document.body.removeChild(ta); done = 1;
          } catch (e2) { }
        }
        say('#vdMsg', done ? T('vd_copied') : T('vd_copyfail'), !!done);
      };
    });
    /* ★지우기는 확인을 받는다 (v2.21.0). 종전에는 × 를 스치기만 해도
       담당자가 사라졌다 — 되돌릴 길이 없다. */
    $$('[data-vdel]').forEach(function (b) {
      b.onclick = function () {
        if (!confirm(T('vd_del_ask'))) return;
        A.vendDel(b.dataset.vdel); vdEdit = null; A.render();
      };
    });
    $$('[data-vsdel]').forEach(function (a) {
      a.onclick = function (e) {
        e.preventDefault();
        if (!confirm(T('vd_sdel_ask'))) return;
        A.vendStaffDel(a.dataset.vsdel, a.dataset.s);
        vdEdit = null; A.render();
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
      var name = A.coOf(c, isDir) || '—';   /* ★업체 Master 기준 — core.js A.coOf */
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
        var cco = A.coOf(c, false) || '—';   /* ★업체 Master 기준 — core.js A.coOf */
        var id = cco + '|' + x.cat + '|' + (x.size || '');
        var o = by[id] || (by[id] = { id: id, co: cco, cat: x.cat, size: x.size || '', n: 0, first: c.date, last: c.date });
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

  /* ══ 장비 — 한 표로 합쳤다 (v2.16.1) ═══════════════════
     ★종전에는 「장비투입현황」(공종별)과 「장비현황」(종류별)이 따로였다.
       둘 다 같은 자료를 각도만 바꿔 뽑은 것이라 나눌 이유가 없었다(사용자 지적).
     종류로 시작해 누르면 규격·공종·정비까지 파고든다.
     ★전체 = 가동 + 고장 + 유휴. '가동 34대'만으로는 놀고 있는 장비가 안 보인다.

     ★★이름 주의 (v2.16.2) — 위쪽 `eqHTML(px)`는 **직영 입력폼**이다.
       v2.16.1에서 여기를 같은 이름으로 만들어 앞의 것을 덮어썼다.
       표 쪽은 반드시 `eqTable*`로 둔다. */

  var eqOpen = {};                       /* 펼쳐 둔 장비 종류 */

  function eqTableHTML() {
    if (!A.can('recon')) return '';        /* 업체별 판정이라 스탭에게 감춘다 */
    return '<div style="margin-bottom:16px">' + card(T('eq_st'), '',
      withRng('eq', function () { return eqBody(); }), 'flush',
      grpBtn('eq') + rngBtn('eq'), 'cdEq') + '</div>';
  }

  function eqBody() {
    if (grpBy.eq === 'co') return eqCoHTML() + eqAddHTML();
    var st = A.eqStatus(flt), mt = mtRows();
    if (!st.length) return empty(T('z_norecon'), T('z_norecon_n')) + eqAddHTML();

    var mtBy = {};
    mt.forEach(function (o) { (mtBy[o.cat] = mtBy[o.cat] || []).push(o); });

    var tot = { g: 0, gv: 0, tk: 0, run: 0, down: 0, idle: 0, mt: 0 }, anyG = 0;
    st.forEach(function (o) {
      var d = o.brk + o.rep;
      tot.run += o.run; tot.down += d; tot.mt += o.mt;
      tot.gv += (o.gv || 0); tot.tk += (o.tk || 0);
      if (o.given != null) { tot.g += o.given; anyG = 1; }
    });
    tot.idle = anyG ? Math.max(0, tot.g - tot.run - tot.down) : 0;

    var body = st.map(function (o) {
      var down = o.brk + o.rep, op = !!eqOpen[o.cat];
      var idle = o.given == null ? null : Math.max(0, o.given - o.run - down);
      var have = (o.gv || 0) - (o.tk || 0);
      idle = Math.max(0, have - o.run - down);
      var h = '<tr class="gr' + (op ? ' gr--on' : '') + '" data-eqo="' + esc(o.cat) + '">' +
        '<td><span class="gr__c">' + (op ? '▾' : '▸') + '</span> ' +
        '<span class="ab">' + esc(o.abbr) + '</span> <span class="nm">' + esc(o.cat) + '</span></td>' +
        '<td class="r sp">' + nf(o.gv || 0) + '</td>' +
        '<td class="r sp">' + (o.tk ? nf(o.tk) : '·') + '</td>' +
        '<td class="r"><b>' + nf(have) + '</b></td>' +
        '<td class="r em">' + nf(o.run) + '</td>' +
        '<td class="r' + (down ? ' em' : '') + '">' + (down ? nf(down) : '·') + '</td>' +
        '<td class="r sp">' + nf(idle) + '</td>' +
        '<td class="r">' + (o.mt ? '<span class="bd bd--o">' + nf(o.mt) + '</span>' : '·') + '</td></tr>';
      if (!op) return h;

      /* ★규격별 — 지급·회수를 여기서 직접 고친다 (v2.16.5 사용자 지시).
         회수해서 대수가 줄면 보유가 그 자리에서 줄어든다. 줄은 안 늘어난다. */
      o.rows.forEach(function (r) {
        var d2 = r.brk + r.rep, hv = (r.gv || 0) - (r.tk || 0);
        /* 규격 줄은 합계다 — 읽기만 한다. 고치는 것은 아래 업체 줄이다. */
        h += '<tr class="sub"><td class="ind sp">' + esc(r.size || '—') + '</td>' +
          '<td class="r sp">' + nf(r.gv || 0) + '</td>' +
          '<td class="r sp">' + (r.tk ? nf(r.tk) : '·') + '</td>' +
          '<td class="r"><b>' + nf(hv) + '</b></td>' +
          '<td class="r">' + nf(r.run) + '</td>' +
          '<td class="r' + (d2 ? ' em' : '') + '">' + (d2 ? nf(d2) : '·') + '</td>' +
          '<td class="r sp">' + nf(Math.max(0, hv - r.run - d2)) + '</td><td></td></tr>';
        /* ★업체 줄 — 지급·회수를 여기서 직접 고친다 (v2.19.14).
           종전에는 규격 줄 하나에 입력칸이 있었는데, 보유가 업체 축이 되면서
           「어느 업체의 대수인가」가 정해지지 않으면 고칠 수가 없다.
           업체 없이 들어간 옛 줄은 「미지정」으로 나온다 — 지우지 않는다. */
        var cos = Object.keys(r.gby || {});
        if (!cos.length) cos = [''];
        cos.sort();
        cos.forEach(function (c) {
          var v = (r.gby || {})[c] || { give: 0, take: 0 };
          var k = esc(o.cat) + '|' + esc(r.size || '');
          var ck = esc(c);
          h += '<tr class="sub"><td class="ind2 sp" style="padding-left:32px">' +
            (c ? esc(c) : T('e_noco')) + '</td>' +
            '<td class="r"><input class="in num eq__q" type="number" min="0" step="1" ' +
              'data-eqq="' + k + '|give|' + ck + '" value="' + nf(v.give || 0) + '"></td>' +
            '<td class="r"><input class="in num eq__q" type="number" min="0" step="1" ' +
              'data-eqq="' + k + '|take|' + ck + '" value="' + nf(v.take || 0) + '"></td>' +
            '<td class="r"><b>' + nf((v.give || 0) - (v.take || 0)) + '</b></td>' +
            '<td class="r sp">·</td><td class="r sp">·</td><td class="r sp">·</td><td></td></tr>';
        });
      });
      /* ★「공종별 투입」 줄을 지웠다 (v2.49.0) — 장비 표에서 공종을 보여 주니
         공종을 보는 화면처럼 읽혔다(사용자 지적). 장비의 축은 종류와 규격이다. */
      /* 정비 건 */
      (mtBy[o.cat] || []).forEach(function (m) {
        h += '<tr class="sub"><td class="ind" colspan="3">' +
          '<span class="sp">' + esc(m.co) + ' · ' + esc(m.size || '—') + ' · ' + nf(m.n) + T('u_unitq') +
          ' · ' + nf(m.days) + T('mt_days') + '</span>' +
          (m.long ? ' <span class="bd bd--d">' + T('mt_long') + '</span>' : '') +
          (m.long && m.step && m.step !== 'done'
            ? '<input class="in" style="margin-top:6px" data-mtwhy="' + esc(m.id) + '" value="' + esc(m.why) + '" placeholder="' + T('mt_why') + '">'
            : '') + '</td>' +
          '<td colspan="5"><select class="in" data-mtstep="' + esc(m.id) + '">' +
          '<option value="">' + T('mt_none_s') + '</option>' +
          A.MT_STEPS.map(function (s2) {
            return '<option value="' + s2 + '"' + (m.step === s2 ? ' selected' : '') + '>' + T('mt_' + s2) + '</option>';
          }).join('') + '</select></td></tr>';
      });
      return h;
    }).join('');

    return '<div class="tw"><table><thead><tr><th>' + T('eqcat') + '</th>' +
      '<th class="r">' + T('e_given') + '</th><th class="r">' + T('e_back') + '</th>' +
      '<th class="r">' + T('e_have') + '</th><th class="r">' + T('run') + '</th>' +
      '<th class="r">' + T('brk') + '</th><th class="r">' + T('e_idle') + '</th>' +
      '<th class="r">' + T('mt_t') + '</th></tr></thead><tbody>' + body +
      '</tbody><tfoot><tr class="tot"><td>' + T('tot_t') + '</td>' +
      '<td class="r">' + nf(tot.gv) + '</td>' +
      '<td class="r">' + (tot.tk ? nf(tot.tk) : '·') + '</td>' +
      '<td class="r"><b>' + nf(tot.gv - tot.tk) + '</b></td>' +
      '<td class="r">' + nf(tot.run) + '</td>' +
      '<td class="r' + (tot.down ? ' em' : '') + '">' + nf(tot.down) + '</td>' +
      '<td class="r">' + (anyG ? nf(tot.idle) : '—') + '</td>' +
      '<td class="r">' + nf(tot.mt) + '</td></tr></tfoot></table></div>' + eqAddHTML();
  }

  /* ★v2.16.2에 붙였던 「지급 기록 목록」은 삭제했다 (v2.16.5 사용자 지적).
     지급할 때마다 한 줄씩 밑으로 쌓여, 약어와 공종별 분류로 접어 둔 표 밑에
     접히지 않는 목록을 다시 매다는 꼴이었다.
     수정·회수는 표 안 규격 줄에서 직접 한다 — A.setEqQty. */

  /* ★업체별 장비 (v2.17.5 사용자 지시).
     ★★v2.19.14 — 보유가 업체 축이 되면서 「보유」 칸이 생겼다.
       종전 주석은 「지급·회수·보유는 위치에 걸린 값이라 업체로 못 가른다」였다.
       이제 갈린다. 지급만 있고 아직 실적이 없는 업체도 줄이 선다.
     ★가동·고장은 종전대로 실적(S.crew) 기준 — 위치 필터를 따른다.
       한 표에 축이 둘이라 칸 머리에 그 사실을 적는다(공구 표와 같은 방식). */
  function eqCoHTML() {
    var gs = A.rollupCo(flt);
    var have = {}, rec = A.eqRecon(flt);
    rec.forEach(function (r) {
      Object.keys(r.gby || {}).forEach(function (c) {
        var v = r.gby[c];
        have[c] = (have[c] || 0) + (v.give - v.take);
      });
    });
    var body = '', tot = { run: 0, down: 0, have: 0 }, seen = {};
    function line(co, list, s, hv) {
      tot.run += s.run; tot.down += s.down; tot.have += hv;
      var op = !!eqOpen['co|' + co];
      body += '<tr class="gr' + (op ? ' gr--on' : '') + '" data-eqo="co|' + esc(co) + '">' +
        '<td><span class="gr__c">' + (op ? '▾' : '▸') + '</span> ' +
        '<span class="nm">' + (co ? esc(co) : T('e_noco')) + '</span> ' +
        /* ★「3개 공종」이라고 나오던 자리다 (요청 ⑭ 사용자 지적).
           여기서 세는 것은 공종이 아니라 **장비 종류**다(list는 cat별로 묶은 것).
           장비현황에서 「3개 공종」을 보면 세 공종이 도는 줄로 읽힌다. */
        '<span class="sp">' + T('u_neq').replace('{n}', nf(list.length)) + '</span></td>' +
        '<td class="r"><b>' + nf(hv) + '</b></td>' +
        '<td class="r em">' + nf(s.run) + '</td>' +
        '<td class="r' + (s.down ? ' em' : '') + '">' + (s.down ? nf(s.down) : '·') + '</td></tr>';
      if (!op) return;
      list.forEach(function (o) {
        body += '<tr class="sub"><td class="ind"><span class="ab">' + esc(A.eqAbbr(o.cat)) + '</span> ' +
          '<span class="sp">' + esc(o.cat) + '</span></td>' +
          '<td class="r sp">' + (o.have ? nf(o.have) : '·') + '</td>' +
          '<td class="r">' + nf(o.run) + '</td>' +
          '<td class="r' + (o.down ? ' em' : '') + '">' + (o.down ? nf(o.down) : '·') + '</td></tr>';
      });
    }
    gs.forEach(function (g) {
      var cat = {}, s = { run: 0, down: 0 };
      g.rows.forEach(function (x) {
        Object.keys(x.eq).forEach(function (k) {
          var q = x.eq[k], o = cat[q.cat] || (cat[q.cat] = { cat: q.cat, run: 0, down: 0, have: 0 });
          var r = +q.run || 0, d = (+q.brk || 0) + (+q.rep || 0);
          o.run += r; o.down += d; s.run += r; s.down += d;
        });
      });
      /* 그 업체가 받아 둔 종류도 줄에 세운다 — 받았는데 안 돌린 것이 유휴다 */
      rec.forEach(function (r) {
        var v = (r.gby || {})[g.co]; if (!v) return;
        var o = cat[r.cat] || (cat[r.cat] = { cat: r.cat, run: 0, down: 0, have: 0 });
        o.have += v.give - v.take;
      });
      var list = Object.keys(cat).map(function (k) { return cat[k]; })
        .sort(function (a, b) { return b.run - a.run || b.have - a.have; });
      if (!list.length) return;
      seen[g.co] = 1;
      line(g.co, list, s, have[g.co] || 0);
    });
    /* ★지급만 있고 실적이 아직 없는 업체 — 종전에는 표에서 통째로 빠졌다 */
    Object.keys(have).sort().forEach(function (c) {
      if (seen[c]) return;
      var cat = {};
      rec.forEach(function (r) {
        var v = (r.gby || {})[c]; if (!v) return;
        var o = cat[r.cat] || (cat[r.cat] = { cat: r.cat, run: 0, down: 0, have: 0 });
        o.have += v.give - v.take;
      });
      var list = Object.keys(cat).map(function (k) { return cat[k]; })
        .sort(function (a, b) { return b.have - a.have; });
      if (!list.length) return;
      line(c, list, { run: 0, down: 0 }, have[c] || 0);
    });
    if (!body) return empty(T('z_norecon'), T('z_norecon_n'));
    return '<div class="tw"><table><thead><tr><th>' + T('vd_name') + '</th>' +
      '<th class="r">' + T('e_have') + '</th>' +
      '<th class="r">' + T('run') + '</th><th class="r">' + T('brk') + '</th></tr></thead><tbody>' +
      body + '</tbody><tfoot><tr class="tot"><td>' + T('tot_t') + '</td>' +
      '<td class="r"><b>' + nf(tot.have) + '</b></td>' +
      '<td class="r">' + nf(tot.run) + '</td>' +
      '<td class="r">' + (tot.down ? nf(tot.down) : '·') + '</td></tr></tfoot></table></div>';
    /* ★설명 문구(eq_co_n)를 뺐다 (요청 ⑭ 사용자 지시).
       「보유는 업체 축이라 위치 필터를 따르지 않는다…」는 **만든 사람의 사정**이지
       보는 사람이 입력하거나 확인할 것이 아니다. 화면에는 관리에 필요한 숫자만
       남기고, 이런 설명은 사용자 매뉴얼로 뺀다. */
  }

  /* 손으로 한 종류씩 넣기 — 지급대장 CSV를 만들 것도 없는 현장이 있다 */
  /* ★입력폼을 표 아래로 내리고, 가운데로 모으고, 더 줄였다 (v2.17.6 사용자 지적).
     종전에는 표 위에서 왼쪽부터 자리를 채워 너비만 넓어지고(1fr 균등분배라
     칸 하나하나가 쓸데없이 커졌다), 표(주인공)보다 입력이 먼저 눈에 들어왔다.
     ★새 종류를 넣는 일은 자주 없다 — 접어 둔 토글로 감추고, 열면 가운데
       정렬된 좁은 줄만 나온다.
     ★"지급대장 없음 — 대조 대기" 같은 문장 대신, 토글 자체에 지급기록
       유무를 배지로 보인다(사용자 지시 — 문구 대신 표시로). */
  var eqAddOpen = false;
  function eqAddHTML() {
    var n = A.issueRows(flt).length;
    var h = '<div class="eqadd">' +
      '<button class="eqadd__t" id="eqAddT" aria-expanded="' + eqAddOpen + '">' +
      (eqAddOpen ? '▾' : '▸') + ' ' + T('e_addnew') +
      ' <span class="bd' + (n ? ' bd--o' : '') + '">' + (n ? T('e_hasrec') + ' ' + nf(n) : T('e_norec')) + '</span>' +
      '</button>';
    if (eqAddOpen) {
      var cats = [], seen = {};
      A.EQ_TREE.forEach(function (t) { if (!seen[t.cat]) { seen[t.cat] = 1; cats.push(t.cat); } });
      var sizes = A.eqSizes(eqAddCat) || [];
      h += '<div class="eqadd__row">' +
        coSel('eqCo') +                    /* ★업체 축 (v2.19.14) */
        '<select class="in" id="eqCat"><option value="">' + T('pick') + '</option>' +
          cats.map(function (c) {
            return '<option value="' + esc(c) + '"' + (eqAddCat === c ? ' selected' : '') + '>' +
              esc(A.eqAbbr(c) + ' · ' + c) + '</option>';
          }).join('') + '</select>' +
        '<select class="in" id="eqSize"' + (sizes.length ? '' : ' disabled') + '>' +
          (sizes.length ? sizes.map(function (z) { return '<option value="' + esc(z) + '">' + esc(z) + '</option>'; }).join('')
                        : '<option value="">—</option>') + '</select>' +
        '<select class="in" id="eqKind">' +
          '<option value="give">' + T('e_given') + '</option>' +
          '<option value="take">' + T('e_back') + '</option></select>' +
        '<input class="in num" id="eqCnt" type="number" min="0" step="1" placeholder="0">' +
        '<button class="btn btn--sm" id="eqAdd">' + T('add') + '</button>' +
        '</div><div class="hint" id="eqMsg"></div>';
    }
    return h + '</div>';
  }
  var eqAddCat = '';

  function eqTableBind() {
    $$('[data-eqo]').forEach(function (el) {
      el.onclick = function () { eqOpen[el.dataset.eqo] = !eqOpen[el.dataset.eqo]; A.render(); };
    });
    if ($('#eqAddT')) $('#eqAddT').onclick = function () { eqAddOpen = !eqAddOpen; A.render(); };
    if ($('#eqCat')) $('#eqCat').onchange = function () { eqAddCat = this.value; A.render(); };
    $$('[data-copick]').forEach(function (el) {
      el.onchange = function () { coPick[el.dataset.copick] = el.value; };
    });
    $$('[data-eqq]').forEach(function (el) {
      el.onchange = function () {
        var v = el.dataset.eqq.split('|');
        /* v = 종류|규격|지급여부|업체 — ★업체가 자리를 가른다 (v2.19.14) */
        A.setEqQty(pkLoc('w'), v[0], v[1], v[2], el.value, v[3] || '');
        A.render();
      };
    });
    if ($('#eqAdd')) $('#eqAdd').onclick = function () {
      var cat = val('#eqCat'), size = val('#eqSize'), n = numv('#eqCnt');
      var co = val('#eqCo');
      if (!cat || !n) { say('#eqMsg', T('eq_need'), false); return; }
      /* ★업체를 고르지 않으면 넣지 않는다 (v2.19.14) — 보유가 업체 축이다.
         업체 없이 들어가면 어느 업체 것인지 나중에 알 수 없다. */
      if (!co) { say('#eqMsg', T('e_pickco'), false); return; }
      /* ★쌓지 않고 덮어쓴다 — 같은 자리를 두 번 넣어도 두 배가 되지 않는다 */
      A.setEqQty(pkLoc('w'), cat, size, val('#eqKind'), n, co);
      eqAddCat = ''; A.render();
      setTimeout(function () { say('#eqMsg', T('eq_added'), true); }, 30);
    };
    $$('[data-mtstep]').forEach(function (el) {
      el.onchange = function () { A.mtSet(el.dataset.mtstep, el.value, null); txCfgAll(); A.render(); };
    });
    $$('[data-mtwhy]').forEach(function (el) {
      el.onchange = function () { A.mtSet(el.dataset.mtwhy, null, el.value); txCfgAll(); };
    });
  }

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
  /* ══ 기간 선택 (v2.16.1) ═══════════════════════════════
     ★맨 위 「조회 기준」 카드를 없애고 각 표 머리로 옮겼다.
       표마다 보고 싶은 기간이 다른데 카드 하나가 전부를 지배했다(사용자 지시).
     ★「누계」 카드도 없앴다. 누계는 기간이 '전체'일 뿐이다.
     달력과 지름길 버튼을 같이 둔다 — 버튼만 있으면 특정 기간을 못 잡고,
     달력만 있으면 '이번 달'을 보려고 매번 두 번 입력해야 한다. */

  var rngOpen = '';                    /* 지금 열려 있는 기간 창 */
  var rgPick = '';                     /* 달력을 펼친 표 (v2.16.7) */
  /* ★묶기 기준 — 공종별 / 업체별 (v2.17.5 사용자 지시).
     인원·장비 두 표에만 건다. 수량(진행률·작업량)은 설계수량이 위치에
     걸려 있어 업체별 분모를 가를 근거가 없다(사용자 확인). */
  /* ★표마다 따로 고른다 (v2.18.1 사용자 지적).
     v2.17.5에서 상태 하나를 두 카드가 같이 보게 묶었는데, 인원은 업체별로
     보면서 장비는 공종별로 보고 싶은 경우를 막고 있었다. */
  /* ★장비는 **업체별이 기본**이다 (v2.49.0 사용자 지시 「장비현황 기본은 업체별이야」).
     장비의 다른 축은 'cat'(장비종류)다 — 'work'(공종)가 아니다. */
  var grpBy = { ppl: 'work', eq: 'co' };
  var progLoc = '';        /* ★진행률만의 위치 선택 — 상단 필터와 따로 논다(v2.50.0) */
  /* 검사에서 진행률 위치를 고르는 통로 — 단추 처리기는 브라우저에만 붙는다 */
  A._pgLoc = function (k) { if (k !== undefined) progLoc = k; return progLoc; };
  A._grpBy = function (which, v) {
    if (typeof which === 'string' && v === undefined && (which === 'work' || which === 'co')) {
      grpBy.ppl = which;
      /* 장비에는 공종 축이 없다 — 옛 호출의 'work'는 장비종류로 받는다(호환) */
      grpBy.eq = (which === 'work') ? 'cat' : which;
      return which;
    }
    /* 장비에 'work'가 들어오면 'cat'으로 받는다 — 부르는 데가 옛 이름을 쓸 수 있다 */
    if (which === 'eq' && v === 'work') v = 'cat';
    if (v) grpBy[which] = v;
    return grpBy[which];
  };
  var RNG = {};                        /* 표별 기간: {from,to} */
  /* ★검사에서 기간 단추를 누를 통로 (인수인계서 6-B).
     단추 처리기는 브라우저에만 붙으므로, 이 통로가 없으면 「기간을 넓히면
     옛 기록도 보인다」를 검사할 길이 없다. 화면 동작은 바꾸지 않는다. */
  A._rng = function (id, r) {
    if (r) RNG[id] = { from: r.from, to: r.to };
    return rngOf(id);
  };

  /* ★표마다 기본 기간이 다르다 (v2.18.1 사용자 지적).
     작업위치는 「지금 어디서 하고 있나」를 보는 표라 기본이 오늘이어야 한다.
     종전에는 전부 기본 「전체」라 두 주 전 기록이 섞여 나왔다.
     ※withRng 자체는 정상이었다 — 기본값이 전체였을 뿐이다. */
  /* ★기간 있는 표는 전부 오늘이다 (v2.19.13 사용자 지시 —
     「반영된 날짜 기준이니 오늘로 통일하자, 작업량도」).
     v2.18.9에서는 작업량·작업위치만 어제였다(「작업도 안 끝났는데 수량을
     어떻게 알아?」). 그런데 **실적은 오늘 올라온다.** 업체가 오늘 올린 실적이
     어제로 걸러져 표에서 안 보였다 — 기준은 「일한 날」이 아니라 「반영된 날」이다.
     ★협력업체 실적 입력 폼의 기본 날짜도 같이 오늘로 바꿨다(vendor.js).
       한쪽만 바꾸면 0-H와 똑같은 사고가 난다 — 폼은 어제, 표는 오늘이 되어
       올린 것이 화면에 영영 안 나온다. 날짜는 손으로 고칠 수 있다.
     ★진행률·생산성은 **누계 그대로**다(사용자 확정). RNG_DEF에 없으므로
       기본이 전 기간이다 — 설계 대비 누적이라 기간을 자르면 뜻이 없다.
     ★확인 대기·검측·측량은 이 표와 별개로 「오늘 + 미처리」 규칙을 따른다. */
  var RNG_DEF = { out: 'today', loc: 'today', ppl: 'today', eq: 'today',
                  insp: 'today', surv: 'today', mat: 'today', dir: 'today' };
  /* ★「작업위치」는 여전히 두 뜻이다. 헷갈리지 말 것.
     작업량 밑 loc = 실적(S.work)이 어디서 얼마나 — spotTable
     현장 현황 칸  = 투입(S.crew·S.direct)이 어디에 — A.siteRows가 따로 센다. */
  function rngOf(id) {
    if (!RNG[id]) {
      var d = RNG_DEF[id];
      if (d === 'today') RNG[id] = { from: A.today(), to: A.today() };
      else if (d === 'yday') {
        var y = addDays(A.today(), -1);
        RNG[id] = { from: y, to: y };
      } else RNG[id] = { from: '', to: '' };
    }
    return RNG[id];
  }

  function ymd(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  /* ★rngPreset(일·주·월·년 + ◀▶)은 v2.16.7에서 없앴다 — 지름길 넷으로 갈음한다. */
  function rngLabel(r) {
    if (!r.from && !r.to) return T('rg_all');
    if (r.from === r.to) return r.from.slice(5);
    return (r.from || '…').slice(5) + '~' + (r.to || '…').slice(5);
  }
  /* 표 머리에 붙는 단추 + 열렸을 때의 창 */
  function rngBtn(id) {
    var r = rngOf(id), on = rngOpen === id;
    var h = '<span class="rg"><button class="btn btn--g btn--sm' + (on ? ' btn--o' : '') +
      '" data-rg="' + esc(id) + '">' + T('rg_t') + ' ' + esc(rngLabel(r)) + ' ▾</button>';
    if (on) {
      /* ★단순화 (v2.16.7 — 사용자 지시).
         종전에는 지름길(일·주·월·년)과 ◀▶와 달력 두 칸과 [전 기간]이
         한꺼번에 떠 있었다. 고르는 수단이 네 갈래라 무엇부터 눌러야 할지
         알 수 없었다. 현장에서 실제로 보는 기간은 넷뿐이다.
         나머지(특정 구간)는 [직접] 뒤에 숨긴다. */
      h += '<span class="rg__p"><span class="rg__u">' +
        RG_Q.map(function (q) {
          var p = rngQuick(q[0]);
          var sel = (r.from === p.from && r.to === p.to);
          return '<button class="btn btn--g btn--sm' + (sel ? ' btn--o' : '') +
            '" data-rgq="' + esc(id) + '|' + q[0] + '">' + T(q[1]) + '</button>';
        }).join('') +
        '<button class="btn btn--g btn--sm' + (rgPick === id ? ' btn--o' : '') +
        '" data-rgp="' + esc(id) + '">' + T('rg_pick') + '</button>' +
        '<button class="btn btn--g btn--sm" data-rgx="1">' + T('close') + '</button></span>' +
        (rgPick === id
          ? '<span class="rg__d"><input class="in" type="date" data-rgf="' + esc(id) + '" value="' + esc(r.from) + '">' +
            '<i>~</i><input class="in" type="date" data-rgt="' + esc(id) + '" value="' + esc(r.to) + '"></span>'
          : '') + '</span>';
    }
    return h + '</span>';
  }
  /* 지름길 넷 — 오늘 / 최근 7일 / 최근 30일 / 전체 */
  var RG_Q = [['n', 'rg_now'], ['7', 'rg_7'], ['30', 'rg_30'], ['a', 'rg_all']];
  function rngQuick(q) {
    if (q === 'a') return { from: '', to: '' };
    if (q === 'n') return { from: A.today(), to: A.today() };
    var d = new Date(A.today());
    d.setDate(d.getDate() - (+q - 1));
    return { from: ymd(d), to: A.today() };
  }
  function rngBind() {
    $$('[data-rg]').forEach(function (b) {
      b.onclick = function () { rngOpen = (rngOpen === b.dataset.rg) ? '' : b.dataset.rg; A.render(); };
    });
    $$('[data-rgq]').forEach(function (b) {
      b.onclick = function () {
        var v = b.dataset.rgq.split('|'), r = rngOf(v[0]), p = rngQuick(v[1]);
        r.from = p.from; r.to = p.to; r.unit = ''; r.step = 0;
        rgPick = '';
        A.render();
      };
    });
    $$('[data-rgp]').forEach(function (b) {
      b.onclick = function () { rgPick = (rgPick === b.dataset.rgp) ? '' : b.dataset.rgp; A.render(); };
    });
    $$('[data-rgf]').forEach(function (e) {
      e.onchange = function () { var r = rngOf(e.dataset.rgf); r.from = e.value; r.unit = ''; r.step = 0; A.render(); };
    });
    $$('[data-rgt]').forEach(function (e) {
      e.onchange = function () { var r = rngOf(e.dataset.rgt); r.to = e.value; r.unit = ''; r.step = 0; A.render(); };
    });
    $$('[data-rgx]').forEach(function (b) { b.onclick = function () { rngOpen = ''; rgPick = ''; A.render(); }; });
  }
  /* 표를 그리는 동안만 그 표의 기간을 적용한다 */
  /* ★하루치로 잘라서 센다 (v2.19.9).
     withRng는 표마다 걸린 기간 단추(RNG)를 따르지만, 요약 띠에는 기간
     단추가 없다. 띠는 언제나 「오늘」이므로 날짜를 직접 박아 쓴다. */
  function withDay(d, fn) {
    var save = { from: A.dateFlt.from, to: A.dateFlt.to };
    A.dateFlt.from = d; A.dateFlt.to = d;
    var out;
    try { out = fn(); } finally { A.dateFlt.from = save.from; A.dateFlt.to = save.to; }
    return out;
  }

  function withRng(id, fn) {
    var save = { from: A.dateFlt.from, to: A.dateFlt.to }, r = rngOf(id);
    A.dateFlt.from = r.from; A.dateFlt.to = r.to;
    var out;
    try { out = fn(); } finally { A.dateFlt.from = save.from; A.dateFlt.to = save.to; }
    return out;
  }

  function v1() {
    var w = A.warn(flt), rows = A.progressRows(flt);   /* 현황판(오른쪽 띠)은 상단 필터를 따른다 */
    /* ★진행률 카드만 **진행률 선택**을 따른다 (v2.50.0) — 고른 한 곳만 계산한다 */
    var pgLoc = progLocKey();
    var pgRows = pgLoc ? A.progressRows(A.keyLoc(pgLoc)) : [];
    var h = '';
    if (w.noPlan) h += '<div class="alert alert--o"><b>' + T('plan_none') + '</b>' +
      '<span class="sp">' + T('h_noplan') + '</span></div>';
    if (w.eqOver) h += '<div class="alert alert--d"><b>' + T('w_eqover_n') + ' ' + nf(w.eqOver) + T('u_kind') + '</b>' +
      '<span class="sp">' + T('h_seerecon') + '</span></div>';

    /* ★상단 KPI 4개(평균진행률·확인대기·장기고장·자재부족) 삭제 — 사용자 지시.
       넷 다 오른쪽 현황판·아래 표·장비 표에 이미 있는 숫자였다. 중복이다.
       ★경고 줄(alert)은 남긴다 — 그건 숫자가 아니라 「손봐야 한다」는 신호다. */

    /* ★설계수량·협력업체 명부·서버 동기화는 맨 아래로 내렸다 (v2.15.4).
       한 번 올리고 나면 쓸 일이 드문데 화면 위를 크게 차지하고 있었다(사용자 지시).
       매일 보는 것(확인대기·진행률·집계)이 먼저 와야 한다. */

    /* ★내역서 확인필요는 요약 띠·현장 현황 **아래**로 내렸다 (v2.19.10 사용자 지시).
       종전에는 이 자리(맨 위)였다. 확인필요가 50건 뜨면 카드 하나가 화면을
       가득 채워, 오늘 몇 명 나왔는지 보려고 한참 내려야 했다(사용자 캡처).
       손봐야 하는 것은 맞지만 **매일 보는 것이 먼저**다. 요약 띠의
       「손봐야 할 것」이 어차피 눈에 걸린다.
       ★현장 현황(siteTable)은 v2.49.0에서 지웠다 — 현황판과 겹쳤다. 이 카드는
         확인 대기 무리와 함께 맨 위에 남는다(스탭의 「내 차례」). */
    h += chkHTML();

    /* 확인 대기 */
    var pw = A.pendWork(flt), pc = A.pendCrew(flt);
    if (pw.length || pc.length) h += '<div style="margin-bottom:16px">' +
      card(T('pend'), nf(pw.length + pc.length) + T('u_case'),
        '<div class="tw"><table><thead><tr><th>' + T('th_kind') + '</th><th>' + T('date') + '</th><th>' + T('loc') + '</th>' +
        '<th>' + T('work') + '</th><th class="r">' + T('th_body') + '</th><th>' + T('by') + '</th>' +
        /* ★올린 뒤 얼마나 기다렸나 (v2.51.0 사용자 요청 「처리시간 표시」) —
           확인 전이므로 지금까지 밀린 시간이다. 오래 밀린 것은 붉게 보인다. */
        '<th class="r">' + T('pt_t') + '</th><th class="noprint"></th></tr></thead><tbody>' +
        pw.map(function (x) {
          return '<tr><td><span class="bd bd--k">' + T('blk_work') + '</span></td><td class="sp">' + esc(x.date) + '</td>' +
            '<td class="code">' + esc(A.locLabel(x.loc)) + '</td><td>' + itemLine(x.key, x.spot) + '</td>' +
            '<td class="r">' + nf(x.qty, 2) + ' <span class="sp">' + esc(A.trU((A.item(x.key) || {}).unit || '')) + '</span></td>' +
            '<td class="sp">' + esc(x.by || '') + '</td>' + waitCell(x) +
            '<td class="c noprint"><button class="btn btn--o btn--sm" data-ok="w" data-id="' + esc(x.id) + '">' + T('confirm') + '</button> ' +
            '<button class="btn btn--g btn--sm" data-rc="' + esc(x.id) + '">' + T('rc_ask') + '</button> ' +
            '<button class="btn btn--g btn--sm" data-del="w" data-id="' + esc(x.id) + '">' + T('del') + '</button></td></tr>';
        }).join('') +
        pc.map(function (x) {
          return '<tr><td><span class="bd bd--o">' + T('blk_crew') + '</span></td><td class="sp">' + esc(x.date) + '</td>' +
            '<td class="code">' + esc(A.locLabel(x.loc)) + '</td><td>' + itemLine(x.key, x.spot) + '</td>' +
            '<td class="r sp">' + nf(x.teams) + T('u_crew') + ' · ' + nf(A.pplSum(x.ppl)) + T('u_pax') + ' · ' + T('equip') + ' ' + nf(A.eqSum(x.eq, 'run')) + T('u_unitq') + '</td>' +
            '<td class="sp">' + esc(x.by || '') + '</td>' + waitCell(x) +
            '<td class="c noprint"><button class="btn btn--o btn--sm" data-ok="c" data-id="' + esc(x.id) + '">' + T('confirm') + '</button> ' +
            '<button class="btn btn--g btn--sm" data-del="c" data-id="' + esc(x.id) + '">' + T('del') + '</button></td></tr>';
        }).join('') + '</tbody></table></div>', 'flush') + '</div>';

    /* 재확인 요청 중 — 업체 답이 올 때까지 남는다 (v2.15.0) */
    var rcs = A.rechecks(flt);
    if (rcs.length) h += '<div style="margin-bottom:16px">' +
      card(T('rc_t'), nf(rcs.length) + T('u_case'),
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

    /* ── ⓪ 공구 표 ──
       ★현황판은 여기 없다. **오른쪽 기둥으로 옮겼다** (v2.19.21 사용자 확정
         「세로로 바꾸자」). 아래 return에서 붙인다. */

    /* 내역서에서 코드를 못 붙인 줄 — 손봐야 하는 것이라 표 앞에 둔다 */
    h += boqNeedHTML();

    /* ★순서 (v2.49.0 사용자 지시) :
         ① 협력업체 인원 및 장비현황  ② 직영 인원 및 장비현황
         ③ 협력업체·직영 작업내용     ④ 작업량   ⑤ 진행률   ⑥ 생산성   ⑦ 준비
       ★인원과 장비를 **한 카드**로 합쳤다 — 같은 업체를 두 표에서 찾던 것을 없앤다.
       ★확인 대기·재검측·내역서 확인필요는 위에 그대로 둔다(스탭의 「내 차례」). */
    var ru = A.rollup(flt);

    /* ── ① 협력업체 인원 및 장비현황 ── */
    h += '<div style="margin-bottom:16px">' + card(T('pn_co_ce'), '',
      withRng('ppl', function () { return crewEqHTML('co'); }), 'flush',
      rngBtn('ppl'), 'cdPpl') + '</div>';

    /* ── ② 직영 인원 및 장비현황 — 협력업체와 같은 꼴 ── */
    h += '<div style="margin-bottom:16px">' + card(T('pn_dir_ce'), '',
      withRng('ppl', function () { return crewEqHTML('dir'); }), 'flush', '', 'cdDir') + '</div>';

    /* ── ③ 협력업체, 직영 작업현황 ──────────────────────────
       ★제목은 **하나**, 소제목도 **한 겹**이다 (v2.49.1 사용자 지적 「제목이 몇 개야」).
         안쪽 카드(진행 중 작업·직영작업현황)를 벗기고 표만 넣는다.
       ★직영 기간 단추는 소제목 줄 오른쪽에 둔다 — 카드를 벗기며 잃으면 안 된다.
       ★관리자가 [수정]을 누르면 dEdit가 서므로 그때는 고칠 폼도 함께 낸다. */
    var otR = openTaskRows();
    h += '<div style="margin-bottom:16px">' + card(T('pn_work_ct'), '',
      '<div class="wc">' +
        '<div class="wc__s"><div class="wc__t"><span>' + T('t_co') + '</span></div>' +
          (otR.html || '<div class="ce__z sp">' + T('z_none') + '</div>') + '</div>' +
        '<div class="wc__s"><div class="wc__t"><span>' + T('res_dir') + '</span>' +
          '<span class="wc__a noprint">' + rngBtn('dir') + '</span></div>' +
          (dEdit ? directFormHTML() : '') + directListHTML() + '</div>' +
      '</div>', 'flush') + '</div>';

    /* 장비 표(장비종류·규격·정비)는 준비 위쪽에 그대로 둔다 — 지급대조가 여기 붙어 있다 */
    h += eqTableHTML();

    /* ── ④ 작업량 ── */
    if (ru.length) {
      h += '<div style="margin-bottom:16px">' + card(T('ro_out'), '',
        withRng('out', function () { return rollOutByLoc(); }), 'flush',
        rngBtn('out') + '<button class="btn btn--g btn--sm noprint" id="ruCsv">' + T('csv') + '</button>') + '</div>';

      /* ── ④-2 작업위치 — 작업량 바로 밑 (v2.17.9 사용자 지시) ── */
      h += '<div style="margin-bottom:16px">' + card(T('sp_loc'), '',
        withRng('loc', function () { return spotTable(); }), 'flush',
        rngBtn('loc') + '<button class="btn btn--g btn--sm noprint" id="locCsv">' + T('csv') + '</button>') + '</div>';
    }

    /* 진행률 — 현황판은 화면 오른쪽 기둥으로 뺐다(v2.16.2) */
    h += '<div style="margin-bottom:16px">' +
      /* ★설계수량 올림 표시 — KPI 카드를 지우면서 같이 사라졌다(사용자 지적).
         진행률은 설계수량이 있어야 나오므로 여기가 제 자리다.
         안 올렸으면 붉게 먼저 보인다 — 진행률이 비는 이유가 그것이기 때문이다. */
      /* ★설계수량 뱃지는 위치 필터 옆(planBadge)에 이미 있다 — 여기서 또
         보이면 같은 정보가 두 번이다. 위치명만 남긴다. */
      /* ★진행률은 **고른 한 곳만** 계산한다 (v2.50.0 사용자 지시) — 부지토목·부대토목이
         갈리고 페이즈·블록마다 따로 난다. 그래서 합계 공정률은 내지 않는다.
         설계수량이 올라온 곳이 없으면 먼저 올리라고만 알린다. */
      card(T('progress'), esc(pgLoc ? A.locLabel(A.keyLoc(pgLoc)) : ''),
        pgLoc
          ? (pgRows.length ? progTable(pgRows) : empty(T('z_norate'), T('z_norate_n')))
          : empty(T('z_noplan_t'), T('z_noplan_n')),
        'flush', progPickHTML() + rngBtn('prog') +
        '<button class="btn btn--g btn--sm noprint" id="pgCsv">' + T('csv') + '</button>') +
      '</div>';

    /* 실측 생산성 — 현황판에 자리를 내주고 아래로 내렸다 (v2.16.0) */
    if (A.can('prod')) {
      var pr = A.prodRows(flt);
      h += '<div style="margin-bottom:16px">' + card(T('prod'), '',
        pr.length ? prodTable(pr) : empty(T('z_none'), T('z_prod_n')), 'flush') + '</div>';
    }

    /* 준비 — 자주 쓰지 않는 것은 맨 아래 버튼으로 (v2.15.4)
       ★관리자 전용이다 (요청 : 스탭화면 작업현황). 준비의 여섯 갈래(설계수량·
         지급장비·협력업체 명부·우리 스탭·동기화·저장용량)는 전부 **셋업**이라
         관리자만 넣어야 한다. 종전에는 스탭 화면에도 그대로 떠서 스탭이
         설계수량·지급장비까지 손댈 수 있었다.
       ★표시만 감추는 것이 아니라 입력 기능이 통째로 안 그려진다 — 스탭 화면에는
         data-stp·planPanel·eqGvPanel 등이 아예 없다.
       ★measure: 「나는 누구」(우리 스탭 자기지정)도 준비 안에 있었다. 관리자
         전용이 되면 스탭 기기에서 그것을 못 고른다 — 사용자 확인 뒤 필요하면
         그 조각만 따로 낼 것. */
    if (A.role() === 'admin') h += setupHTML();

    /* ★★오른쪽 기둥이 **돌아왔다** (v2.19.21 사용자 확정 「세로로 바꾸자」).
       v2.18.0에서 철거했던 자리다. 왜 돌아왔는지 남겨 둔다 —

       가로 띠는 **고정하는 순간 반드시 뭔가를 덮는다.** 세로로 아무리 깎아도
       (v2.19.15→17→18→20, 네 판을 썼다) 화면 위쪽을 그만큼 영구히 먹는 것은
       변하지 않았다. 사용자가 같은 캡처를 **네 번** 보냈다.
       ★기둥은 **덮지 않는다.** 자기 칸 안에 있으므로 본문과 자리를 다투지
         않는다. 가로 폭을 내주는 대신 **세로를 하나도 안 먹는다.**
       ★v2.18.0의 철거 사유(「가로 29%를 늘 먹고 회색 막대만 아홉 줄」)는
         그때 기둥이 **막대 그림**이었기 때문이다. 지금 담기는 것은 숫자·날씨·
         그래프라 세로로 쌓는 편이 오히려 자연스럽다. 도넛은 되살리지 않는다.
       ★비율은 **5:2** (사용자가 먼저 꺼낸 숫자다).
       ★기둥은 sticky라 스크롤을 따라오되, 본문 머리행은 화면 맨 위(top:0)에
         그대로 붙는다 — **--sbh 같은 기준점이 이제 필요 없다.**
         v2.19.17~20을 헛돌게 만든 그 변수가 사라진다. */
    /* ★날씨는 탭바 오른쪽 끝(알림·전파 옆)으로 옮겼다 (v2.42.0 사용자 지시).
       render()에서 #tabs에 붙인다 — 여기 본문에는 두지 않는다. */
    return '<div class="pg"><div class="pg__main">' + h + '</div>' +
      '<aside class="pg__side">' + summaryHTML(rows) + '</aside></div>';
  }

  /* ★ v2.15.2 — 진행률도 대분류로 접는다.
       v2.15.0에서 작업량·인원·장비만 손보고 여기를 빠뜨렸다(사용자 지적).
       공종이 1,000개 가까이 되므로 펼쳐 두면 아무것도 안 보인다.
     ★ 합계 행에 실적·설계 수량은 넣지 않는다 — 공종마다 단위가 달라(m3/m/m2/ea)
       더한 값이 아무 의미가 없다. 공종 수와 진행률 평균만 낸다. */
  /* ══ 현황판 (v2.16.0) ═══════════════════════════════════
     진행률 표 오른쪽 1/4 남짓을 채운다. 스크롤해도 따라온다.
     ★차트 라이브러리를 쓰지 않는다 — SVG를 직접 그린다.
       외부 파일을 받아오면 현장 인터넷이 느릴 때 화면이 비어 보인다.
     ★항목마다 제목을 붙인다. 만든 사람은 알아도 처음 보는 사람은
       도넛이 무엇을 뜻하는지 모른다(사용자 지시). */


  /* 최근 7일 인원 추이
     ★v2.19.15 — 눈금을 넣었다 (사용자 지시 「숫자 넣어야 100명 200명 300명」).
       종전에는 눈금도 숫자도 없어 선의 높낮이만 보였다. 몇 명인지 알 수 없었다.
     ★가로축은 **오늘 기준 7일 전까지**다 — 맨 오른쪽이 오늘이다.
     ★눈금 간격은 최대값을 보고 정한다(50/100/200/500…). 사람이 읽는 숫자다. */
  function niceStep(mx) {
    var cand = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    for (var i = 0; i < cand.length; i++) if (mx / cand[i] <= 4) return cand[i];
    return cand[cand.length - 1];
  }
  function sparkSVG(vals, days, mini) {
    if (vals.length < 2) return '';
    /* ★칸을 키웠다 (v2.19.18) — 8px 눈금은 띠에서 읽으라고 만든 크기가
       아니었다. 글씨를 키운 만큼 눈금·날짜 자리도 같이 넓힌다. */
    /* ★세로를 줄였다 (v2.19.20) — 띠가 화면을 너무 많이 먹었다.
       글씨는 그대로 두고 **높이만** 깎는다. 눈금은 최대·중간·0 셋이면 된다. */
    /* ★mini (v2.44.0) — 인원·장비를 반반으로 나란히 두려고 폭·글씨를 줄인다.
       높이(H)는 종전과 비슷하게 유지해 전체가 안 길어진다(사용자 「늘리지마」). */
    var W = mini ? 150 : 250, H = mini ? 56 : 62,
        PL = mini ? 22 : 34, PB = mini ? 14 : 15, PT = mini ? 5 : 6,
        LF = mini ? 9 : 11, TF = mini ? 11 : 14;
    var raw = Math.max.apply(null, vals);
    var step = niceStep(raw || 1);
    var top = Math.max(step, Math.ceil((raw || 1) / step) * step);   /* 0에서 시작한다 */
    /* ★칸이 낮아졌으므로(v2.19.20) 눈금줄이 셋을 넘지 않게 간격을 벌린다 */
    while (top / step > 2) step *= 2;
    var iw = W - PL, ih = H - PB - PT;
    var st = iw / (vals.length - 1);
    function y(v) { return PT + ih - (v / top) * ih; }
    var pts = vals.map(function (v, i) {
      return (PL + i * st).toFixed(1) + ',' + y(v).toFixed(1);
    });
    var g = '';
    for (var t = 0; t <= top; t += step) {
      g += '<line x1="' + PL + '" y1="' + y(t).toFixed(1) + '" x2="' + W + '" y2="' + y(t).toFixed(1) +
        '" stroke="var(--line-2)" stroke-width="1"/>' +
        '<text x="' + (PL - 5) + '" y="' + (y(t) + 4).toFixed(1) + '" text-anchor="end" ' +
        'font-size="' + LF + '" fill="var(--mute)">' + t + '</text>';
    }
    /* 날짜 — 처음·가운데·오늘 셋만. 일곱 개를 다 적으면 겹친다 */
    var lab = '';
    /* mini는 가운데 날짜를 뺀다 — 좁아서 겹친다 (처음·오늘만) */
    (mini ? [0, vals.length - 1] : [0, Math.floor((vals.length - 1) / 2), vals.length - 1]).forEach(function (i, k, arr) {
      var d = (days && days[i]) || '';
      lab += '<text x="' + (PL + i * st).toFixed(1) + '" y="' + (H - 4) + '" font-size="' + LF + '" ' +
        'text-anchor="' + (i === 0 ? 'start' : (i === vals.length - 1 ? 'end' : 'middle')) + '" ' +
        'fill="var(--mute)">' + esc(d.slice(5)) + '</text>';
    });
    /* 값 — 오늘 한 점만 숫자를 붙인다. 일곱 개를 다 붙이면 선이 안 보인다 */
    var last = vals[vals.length - 1];
    var tip = '<circle cx="' + (PL + (vals.length - 1) * st).toFixed(1) + '" cy="' + y(last).toFixed(1) +
      '" r="3" fill="var(--orange)"/>' +
      '<text x="' + W + '" y="' + Math.max(12, y(last) - 7).toFixed(1) + '" text-anchor="end" ' +
      'font-size="' + TF + '" font-weight="800" fill="var(--orange)">' + nf(last) + '</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" role="img" aria-hidden="true">' +
      g +
      '<polygon points="' + PL + ',' + (PT + ih) + ' ' + pts.join(' ') + ' ' + W + ',' + (PT + ih) + '" fill="var(--orange-w)"/>' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="var(--orange)" stroke-width="2"' +
      ' stroke-linejoin="round" stroke-linecap="round"/>' + tip + lab + '</svg>';
  }

  /* ══ 요약 띠 + 공구 표 (v2.18.0) ═══════════════════════
     ★오른쪽 기둥(현황판)을 철거하고 가로로 눕혔다(사용자 지시).
       기둥은 가로 29%를 늘 먹었고, 세로로 회색 막대만 아홉 줄이었다.
     ★고정하지 않는다 — 아래로 내리면 자리를 완전히 비켜준다.
       위로 조금 올리면 요약 띠 한 줄만 도로 내려온다(sticky + 스크롤 방향).
       세로도 가로도 내주지 않는 자리다. */
  function summaryHTML(rows) {
    var w = A.warn(flt);
    var t = resAgg(A.today(), A.today());
    /* ★장비도 「오늘」로 센다 (v2.19.9 — 사용자 지시).
       종전에는 여기만 기간을 안 잘라 상단 필터 기간(기본 전체 누계)으로 셌다.
       같은 띠의 인원은 오늘(resAgg(today,today))인데 장비만 누계라 축이 달랐다.
       그래서 ① 오늘 장비 입력이 없으면 아래 장비현황 카드(withRng('eq')=오늘)는
       「대조할 게 없습니다」인데 띠에는 숫자가 남고, ② 보유(오늘 지급대장)보다
       가동(누계)이 큰, 애초에 뺄 수 없는 두 숫자가 한 칸에 나왔다(사용자 캡처). */
    var st = withDay(A.today(), function () { return A.eqStatus(flt); });
    var run = 0, down = 0, gv = 0, tk = 0;
    st.forEach(function (o) {
      run += o.run; down += o.brk + o.rep;
      gv += (o.gv || 0); tk += (o.tk || 0);
    });
    var have = gv - tk, idle = Math.max(0, have - run - down);
    var sr = A.siteRows(flt);

    /* 최근 7일 — 인원(pax)과 장비 가동(run)을 나란히. 오늘이 맨 오른쪽 */
    var vals = [], eqv = [], days = [];
    for (var i = 6; i >= 0; i--) {
      var d = addDays(A.today(), -i), ra = resAgg(d, d);
      days.push(d); vals.push(ra.pax); eqv.push(ra.run);
    }

    var n = 0, sum = 0;
    (rows || []).forEach(function (r) { if (r.rate != null) { sum += Math.min(100, r.rate); n++; } });

    return '<div class="sb"><div class="sb__t">' + T('pn_t') + '</div><div class="sb__in">' +
      sbCell(nf(t.pax), T('u_pax'), T('pn_pax'), '', 'cdPpl') +
      sbCell(nf(have || run + down), T('u_unitq'), T('pn_eq'),
        '<span class="sb__d"><i class="ok"></i>' + nf(run) +
        '<i class="bad"></i>' + nf(down) +
        (have ? '<i class="idle"></i>' + nf(idle) : '') + '</span>', 'cdEq') +
      /* ★위치를 숫자가 아니라 이름으로 보인다 (v2.19.15 사용자 지적).
         「2 공구」로 나와 **2공구에서 작업 중**인 것처럼 읽혔다.
         실제로는 「작업 중인 자리가 두 곳」이라는 뜻이었다.
         → Phase·Block 이름을 그대로 늘어놓는다. 헷갈릴 여지가 없다. */
      sbLocs(sr) +
      (n ? sbCell(pf(sum / n).replace('%', ''), '%', T('pn_rate')) : '') +
      /* ★「손봐야 할 것」 → 「미확인 · 확인요청」 (v2.19.15 사용자 지시).
         0이면 회색으로 조용히, 있으면 색이 붙어 눈에 걸린다.
         숫자를 누르면 그 탭으로 간다 — 보고 끝내지 말고 처리로 이어져야 한다. */
      sbTodo(w, sr) +
      /* ★결재가 멈춰 있으면 현황판에서 바로 보인다 (v2.20.1 사용자 지시).
         「현황판만 봐도 승인이 안 되고 있는 것을 경고할 수 있게.」 */
      sbAppr() +
      '<div class="sb__sp"></div>' +
      /* ★날씨는 현황판에서 빼내 본문 위 가로 띠로 옮겼다 (v2.41.0 사용자 지시
         「내리면 움직여 가려진다 · 날씨를 빼내 이동하자」). 날씨+7일예보가 세로로
         제일 긴 덩어리라, 빼내니 현황판이 짧아져 고정해도 안 잘린다.
         → wxBox(가로 띠)는 v1에서 .pg 위에 그린다. wxInit은 같은 #wxBox를 찾는다. */
      /* ★인원·장비 추이를 반반으로 나란히 (v2.44.0 사용자 지시) — 높이는 안 늘린다 */
      '<div class="sb__k"><span class="sb__l">' + T('pn_trend') + '</span>' +
      '<div class="sb__tw">' +
        '<div class="sb__thalf"><span class="sb__tl">' + T('people') + '</span>' + sparkSVG(vals, days, 1) + '</div>' +
        '<div class="sb__thalf"><span class="sb__tl">' + T('equip') + '</span>' + sparkSVG(eqv, days, 1) + '</div>' +
      '</div></div>' +
      '</div>' +
      /* ★업체가 둘 이상이면 업체별로 갈라 보인다 (v2.19.15 사용자 지시).
         한 곳뿐이면 위 칸과 같은 숫자라 줄을 만들지 않는다. */
      sbCoRow() +
      '</div>';
  }

  /* 작업 중인 자리 — Phase·Block 이름 그대로 */
  function sbLocs(sr) {
    if (!sr.length) {
      return '<div class="sb__k"><span class="sb__l">' + T('sb_sec') + '</span>' +
        '<span class="sb__v"><b class="sp">—</b></span></div>';
    }
    var names = sr.map(function (o) { return A.locLabel(o.loc); });
    var show = names.slice(0, 3).join(' · ');
    if (names.length > 3) show += ' +' + (names.length - 3);
    return '<div class="sb__k sb__k--go" data-sbcd="cdSite" tabindex="0" role="button">' +
      '<span class="sb__l">' + T('sb_sec') + '</span>' +
      '<span class="sb__loc">' + esc(show) + '</span></div>';
  }

  /* ══ 업체별 줄 (v2.19.15 사용자 지시) ═══════════════════
     ★「업체가 2개면 업체별로 표시하고 합계를 표시」.
       인원은 오늘 투입, 장비는 그 업체가 오늘 돌린 대수 + 보유(업체 축)다.
     ★한 곳뿐이면 줄을 만들지 않는다 — 위 칸과 같은 숫자가 두 번 나온다. */
  function sbCoRow() {
    var day = A.today(), by = {}, list = [];
    function slot(co) {
      if (!by[co]) { by[co] = { co: co, pax: 0, run: 0, have: 0 }; list.push(by[co]); }
      return by[co];
    }
    S.crew.forEach(function (c) {
      if (c.st !== 'ok' || c.date !== day || !A.locMatch(c, flt)) return;
      var o = slot(A.coOf(c, false) || T('e_noco'));   /* ★업체 Master 기준 — core.js A.coOf */
      o.pax += A.pplSum(c.ppl || {}) + A.oprCount(c.eq || []);
      (c.eq || []).forEach(function (x) { o.run += Number(x.run) || 0; });
    });
    /* ★직영도 한 줄로 넣는다 (v2.44.0 사용자 지시 「협력업체만 있는데 직영도」).
       직영은 지급 보유(have)가 없다 — 지급대장은 협력업체 것이다. 인원·가동만 뜬다. */
    S.direct.forEach(function (c) {
      if (c.date !== day || !A.locMatch(c, flt)) return;
      var o = slot(T('res_dir'));
      o.pax += A.pplSum(c.ppl || {}) + A.oprCount(c.eq || []);
      (c.eq || []).forEach(function (x) { o.run += Number(x.run) || 0; });
    });
    /* 보유는 업체 축이라 위치·기간을 안 본다 (v2.19.14) */
    A.eqRecon(flt).forEach(function (r) {
      Object.keys(r.gby || {}).forEach(function (c) {
        var v = r.gby[c];
        slot(c || T('e_noco')).have += (v.give - v.take);
      });
    });
    list = list.filter(function (o) { return o.pax || o.run || o.have; });
    if (list.length < 2) return '';
    list.sort(function (a, b) { return b.pax - a.pax || b.have - a.have; });
    var tot = { pax: 0, run: 0, have: 0 };
    list.forEach(function (o) { tot.pax += o.pax; tot.run += o.run; tot.have += o.have; });
    function cell(o, isTot) {
      return '<div class="sb__co' + (isTot ? ' sb__co--t' : '') + '">' +
        '<span class="sb__con">' + esc(o.co) + '</span>' +
        '<span class="sb__cov">' + nf(o.pax) + '<i>' + T('u_pax') + '</i></span>' +
        '<span class="sb__cov">' + nf(o.have) + '<i>' + T('u_unitq') + '</i></span>' +
        '<span class="sb__cor">' + T('run') + ' ' + nf(o.run) + '</span></div>';
    }
    return '<div class="sb__cos">' + list.map(function (o) { return cell(o, false); }).join('') +
      cell({ co: T('tot_t'), pax: tot.pax, run: tot.run, have: tot.have }, true) + '</div>';
  }
  /* 확인 대기 · 검측 · 측량 · 자재신청 · 반려 — 오늘 손봐야 할 것 */
  function sbTodo(w, sr) {
    var rej = S.work.filter(function (x) {
      return x.st === 'rej' && A.locMatch(x, flt);
    }).length;
    var pend = w.pendWork + w.pendCrew;
    var insp = 0, surv = 0, mat = 0;
    sr.forEach(function (o) { insp += o.insp; surv += o.surv; mat += o.mat; });

    var items = [
      ['pend', pend, T('k_pend'), 1],
      ['insp', insp, T('t2'), 2],
      ['surv', surv, T('t3'), 3],
      ['mat', mat, T('t4'), 4],
      ['rej', rej, T('ck_no'), 1]
    ].filter(function (x) { return x[1] > 0; });

    if (!items.length) {
      return '<div class="sb__k"><span class="sb__l">' + T('sb_todo') + '</span>' +
        '<span class="sb__v"><b class="ok">' + T('sb_clear') + '</b></span></div>';
    }
    return '<div class="sb__k"><span class="sb__l">' + T('sb_todo') + '</span>' +
      '<span class="sb__td">' + items.map(function (x) {
        return '<button class="td" data-sbgo="' + x[3] + '">' +
          '<b>' + nf(x[1]) + '</b><i>' + esc(x[2]) + '</i></button>';
      }).join('') + '</span></div>';
  }

  /* ★현황판 — 결재 대기 (v2.20.1 사용자 지시)
     ★0이면 **칸 자체를 만들지 않는다.** 늘 「0」이 떠 있으면 눈이 그 자리를
       건너뛰게 되고, 정작 숫자가 붙었을 때도 안 보인다.
     ★멈춘 것(60분 초과)이 있으면 빨강, 아직 안 늦었으면 주황이다.
     ★누르면 그 탭으로 간다 — 보고 끝내지 말고 처리로 이어져야 한다.
       자재가 더 많으면 자재(4), 아니면 측량(3)으로 보낸다. */
  function sbAppr() {
    var a = A.flowWarn(flt);
    if (!a.wait) return '';
    var goTab = (a.byOwn.surv || 0) > 0 ? 3 : 4;
    var items = [];
    items.push(['<b class="' + (a.late ? 'bad' : '') + '">' + nf(a.wait) + '</b>',
                T('sb_appr_l'), goTab]);
    if (a.late) items.push(['<b class="bad">' + nf(a.late) + '</b>', T('fl_late1'), goTab]);
    if (a.recv) items.push(['<b>' + nf(a.recv) + '</b>', T('fl_recv'), 4]);
    return '<div class="sb__k"><span class="sb__l">' + T('sb_appr') + '</span>' +
      '<span class="sb__td">' + items.map(function (x) {
        return '<button class="td" data-sbgo="' + x[2] + '">' +
          x[0] + '<i>' + esc(x[1]) + '</i></button>';
      }).join('') + '</span></div>';
  }

  /* ══ 날씨 칸 (v2.19.16) ════════════════════════════════
     ★그리는 것만 여기 있다. 받아오는 것은 wx.js다 — 밖에서 자료를 받는
       유일한 자리라 한 파일에 몰아 둔다.
     ★못 받아도 칸만 조용히 「받아오지 못했습니다」가 된다. */
  A.wxHTML = function () {
    var W = A.WX || { st: 'idle' };
    if (W.st === 'wait' || W.st === 'idle') {
      return '<span class="sb__l">' + T('wx_t') + '</span>' +
        '<span class="wx__off">' + T('wx_wait') + '</span>';
    }
    if (W.st !== 'ok' || !W.cur) {
      return '<span class="sb__l">' + T('wx_t') + '</span>' +
        '<span class="wx__off">' + T('wx_off') + '</span>';
    }
    var c = W.cur;
    function d0(v) { return v == null ? '—' : Math.round(v); }
    function d1(v) { return v == null ? '—' : (Math.round(v * 10) / 10); }
    var bits = [
      T('wx_feel') + ' ' + d0(c.ft) + '°',
      T('wx_wind') + ' ' + d1(c.wind) + T('u_ms'),
      T('wx_hum') + ' ' + d0(c.hum) + '%',
      T('wx_rain') + ' ' + d1(c.rain) + T('u_mm')
    ];
    if (c.vis != null) bits.push(T('wx_vis') + ' ' + d1(c.vis / 1000) + T('u_km'));

    var dow = String(T('wx_dow')).split(',');
    var fc = (W.days || []).map(function (x) {
      var wd = new Date(x.d + 'T00:00:00').getDay();
      var bad = (x.rain > 0) || A.wxKind(x.code) === 'wx_fog';
      /* ★강수·바람 줄을 뺐다 (v2.19.20 — 띠 높이). 자료를 뺀 것이 아니라
         짚었을 때 나오게 옮겼다. 매일 훑는 것은 기온이고, 강수·바람은
         궁금할 때 보는 것이다. */
      var tip = x.d + ' · ' + T(A.wxKind(x.code)) +
        ' · ' + T('wx_rain') + ' ' + d1(x.rain) + T('u_mm') +
        ' · ' + T('wx_wind') + ' ' + d0(x.wind) + T('u_ms');
      return '<i class="wx__d' + (bad ? ' wx__d--w' : '') + '" title="' + esc(tip) + '">' +
        '<em>' + esc(dow[wd] || '') + '</em>' +
        '<s>' + A.wxGlyph(x.code) + '</s>' +
        '<b>' + d0(x.hi) + '<u>' + d0(x.lo) + '</u></b></i>';
    }).join('');

    return '<span class="sb__l"' + (W.fb ? ' title="' + esc(T('wx_site')) + '"' : '') + '>' +
        T('wx_t') + (W.place ? ' · ' + esc(W.place) : '') +
        (W.fb ? ' <b class="wx__fb">*</b>' : '') + '</span>' +
      '<span class="wx__now"><b>' + d0(c.t) + '°</b>' +
        '<s>' + A.wxGlyph(c.code) + '</s>' +
        '<em>' + T(A.wxKind(c.code)) + '</em>' +
        '<i>' + bits.join(' · ') + '</i></span>' +
      (A.wxLowVis(c.vis) ? '<span class="wx__warn">' + T('wx_dust') + '</span>' : '') +
      (fc ? '<span class="wx__fc">' + fc + '</span>' : '');
  };

  /* ★띠 칸을 누르면 그 카드로 간다 (v2.19.17 사용자 지시).
     인원·장비·작업위치는 전부 작업현황(탭1) 안에 있는 카드다. 탭을 옮기는
     것이 아니라 **그 자리까지 굴려 준다.** 띠가 고정돼 있으므로
     scroll-margin-top(.card)이 띠 높이만큼 비켜서게 한다 —
     ★이번에는 scrollIntoView라서 그 속성이 실제로 먹는다. v2.19.15에서
       손 스크롤에 안 먹는 줄 모르고 썼던 것이 「전부 가린다」의 원인이었다. */
  function sbCell(v, u, label, extra, go) {
    return '<div class="sb__k' + (go ? ' sb__k--go" data-sbcd="' + go + '" tabindex="0" role="button' : '') +
      '"><span class="sb__l">' + label + '</span>' +
      '<span class="sb__v"><b>' + v + '</b><em>' + u + '</em>' + (extra || '') + '</span></div>';
  }

  /* 공구 표 — 한 줄 = 한 공구 */

  /* ★panelHTML(오른쪽 현황판)과 donutSVG는 v2.18.0에서 지웠다.
     기둥을 철거하고 요약 띠 + 공구 표로 눕혔다(사용자 지시).
     쓰지 않는 함수를 남겨 두면 다음 사람이 되살릴 자리로 착각한다. */

  function progTable(rows) {
    var gs = [], seen = {};
    rows.forEach(function (r) {
      var g = r.e.grp;
      if (!seen[g]) { seen[g] = { grp: g, rows: [] }; gs.push(seen[g]); }
      seen[g].rows.push(r);
    });

    var hasPlan = 0;
    rows.forEach(function (r) {
      if (r.plan) hasPlan++;
    });

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
      /* ★합계 진행률을 내지 않는다 (v2.50.0 사용자 지시 「각각 표시하는 것이므로
         합계 공정률 계산은 없음」). 단위가 다른 공종의 진행률을 평균 내면 뜻이
         없기도 하다 — 곳마다 따로 본다. */
      '<td class="r sp">—</td></tr></tfoot></table></div>';
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

  /* ★대분류를 눌러 펼치는 처리기 (v2.16.6 — 사용자 지적).
     roOpen을 읽는 곳(진행률·작업량·인원)은 셋 다 있었는데, 그 값을 바꾸는
     처리기가 어디에도 없었다. 검사용 통로 A._roOpen으로만 켜지고 있어서
     smoke는 통과하고 실제 화면에서는 한 번도 안 펼쳐졌다.
     ※장비표는 data-eqo로 따로 처리기가 있어 그쪽만 동작했다. */
  function bindRo() {
    $$('[data-ro]').forEach(function (el) {
      el.onclick = function () {
        var k = el.dataset.ro;
        roOpen[k] = !roOpen[k];
        A.render();
      };
    });
  }

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
  /* ★f(위치 필터)를 인자로 받는다 (v2.50.0) — 위치마다 따로 부르려면 설계량도 그
     위치 것을 봐야 한다. 안 주면 종전대로 화면 필터를 쓴다. */
  function rollOut(ru, f) {
    f = f || flt;
    var gs = byGrp(ru), body = '';
    gs.forEach(function (G) {
      var done = 0, cnt = 0;
      G.rows.forEach(function (x) {
        var pl = A.planQty(x.e.key, f);
        if (pl) { done += Math.min(100, x.qty / pl * 100); cnt++; }
      });
      var avg = cnt ? done / cnt : null;
      body += roHead('out', G.grp, G.rows.length,
        '<td class="r sp">—</td><td class="r sp">—</td>' +
        '<td class="r">' + (avg == null ? '—' : '<span class="em">' + pf(avg) + '</span>') + '</td>');
      if (!roIsOpen('out', G.grp)) return;
      G.rows.slice().sort(function (a, b) { return b.qty - a.qty; }).forEach(function (x) {
        var plan = A.planQty(x.e.key, f);
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

  /* ★작업량을 **위치별로 갈라** 낸다 (v2.50.0 사용자 지시 「Phase별 1,2 / 타운
     Block별로 구분하여 표시」). 입력이 이미 그 단위(locKey)로 저장돼 있으므로
     그 자료를 그대로 쓴다 — 위치마다 A.rollup(loc)을 부를 뿐이다.
     ★위치가 하나뿐이면 제목 없이 표 하나만 낸다(군더더기 방지). */
  function rollOutByLoc() {
    var locs = A.allLocs(flt.s).filter(function (l) { return A.locMatch({ loc: l }, flt); });
    var out = [];
    locs.forEach(function (l) {
      var ru = A.rollup(l);
      if (!ru.length) return;                 /* 자료 없는 위치는 건너뛴다 */
      out.push({ loc: l, ru: ru });
    });
    if (!out.length) return empty(T('z_noconf'), '');
    if (out.length === 1) return rollOut(out[0].ru, out[0].loc);
    return out.map(function (o) {
      return '<div class="lc"><div class="lc__t">' + esc(A.locLabel(o.loc)) + '</div>' +
        rollOut(o.ru, o.loc) + '</div>';
    }).join('');
  }

  /* ★작업위치 — 작업량 표에 칸으로 끼워 넣던 것을 표 하나로 떼어냈다
     (v2.17.9 사용자 지시). 한 공종이 여러 구간에 걸치는데 칸 안에 여러 줄을
     쑤셔 넣으니 작업량 표의 줄 높이가 들쭉날쭉했다.
     ★여기서는 「어디서 얼마나 했나」가 주인공이므로 구간마다 한 줄이다. */
  function spotTable() {
    var m = {}, list = [];
    S.work.forEach(function (w) {
      if (w.st !== 'ok' || !A.locMatch(w, flt) || !A.inDate(w) || !A.inCo(w)) return;
      var e = A.item(w.key); if (!e) return;
      /* ★관로·전기는 도로가 아니라 **표기(도면 라벨)** 가 위치다
         (v2.26.0 · 요청 12·13). 둘은 배타적이라 한 줄에 같이 뜰 일이 없다. */
      var sp = (w.spot && w.spot.kind === 'road' && window.BNCP_SPOT)
        ? window.BNCP_SPOT.label(w.spot) : (w.tag || '');
      /* ★2026-08-23 요청 2 진단 — 「Road/Station이 관리자 화면에 안 뜬다」는
         **단순 표시 버그**였다. 입력 구조는 멀쩡했다. 협력업체가 올린
         w.spot에는 {kind:'road', w, no, side, f, t}가 다 들어오고, 검측
         그룹핑·상세보기·CSV·초과경고 — 다른 어디서도 문제없이 쓴다.
         여기 딱 한 곳(A.locLabel(w.loc) + sp)만 구분자 없이 그냥 이어
         붙여서 「Phase 3-118-2」처럼 위치코드와 도로명이 한 숫자로
         읽혔다 — 관리자 눈에는 없는 것처럼 보였을 것이다.
         ★아래 주석(label이 ' · '를 달고 나온다는 가정)이 틀렸다.
         실제 SPOT.label()은 안 단다 — 다른 4곳은 맞게 ' · '+sp로 짰다.
         → 3군(위치 입력체계 개편) 크기는 안 커진다. 저장 구조는 온전하다. */
      var loc = A.locLabel(w.loc) + (sp ? ' · ' + sp : '');
      var k = w.key + '|' + loc;
      if (!m[k]) { m[k] = { e: e, loc: loc, qty: 0, n: 0, last: '', by: {} }; list.push(m[k]); }
      m[k].qty += Number(w.qty) || 0;
      m[k].n++;
      if (w.date > m[k].last) m[k].last = w.date;
      if (w.by) m[k].by[w.by] = 1;
    });
    if (!list.length) return empty(T('z_noconf'), '');
    list.sort(function (a, b) { return a.loc < b.loc ? -1 : (a.loc > b.loc ? 1 : b.qty - a.qty); });
    return '<div class="tw"><table><thead><tr>' +
      '<th>' + T('loc') + '</th><th>' + T('work') + '</th>' +
      '<th>' + T('vd_name') + '</th>' +
      '<th class="r">' + T('th_out') + '</th><th class="r">' + T('date') + '</th>' +
      '</tr></thead><tbody>' +
      list.map(function (x) {
        return '<tr class="prow" data-detail="' + esc(x.e.key) + '">' +
          '<td class="code">' + esc(x.loc) + '</td>' +
          '<td>' + itemLine(x.e.key) + '</td>' +
          '<td class="nm">' + esc(Object.keys(x.by).join(', ') || '—') + '</td>' +
          '<td class="r em">' + nf(x.qty, 1) + ' <span class="sp">' + esc(A.trU(x.e.unit)) + '</span></td>' +
          '<td class="r sp">' + esc(x.last) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ★인원과 장비를 **한 카드**로 합친다 (v2.49.0 사용자 지시).
     종전에는 「인원 투입 현황」과 「장비 현황」이 따로 있어, 같은 업체를 두 표에서
     따로 찾아야 했다. 이제 한 자리에서 업체별로 인원과 장비를 함께 본다.
     ★mode 'co' = 협력업체 · 'dir' = 직영. **둘은 서로 섞이지 않는다** —
       rollupCo가 직영에 dir 표를 달아 주므로 그것으로 가른다.
     ★표는 새로 쓰지 않는다 — 인원은 rollPpl, 장비는 eqCoHTML이 이미 업체 축이다. */
  function ceGroups(mode) {
    return A.rollupCo(flt).filter(function (g) { return mode === 'dir' ? g.dir : !g.dir; });
  }
  function crewEqHTML(mode) {
    var gs = ceGroups(mode);
    if (!gs.length) return empty(T('z_noconf'), '');
    var h = '';
    gs.forEach(function (G) {
      var s = { teams: 0, pplT: 0, opr: 0, run: 0, down: 0 };
      A.JOBS.forEach(function (j) { s[j.id] = 0; });
      var eqBy = {};
      G.rows.forEach(function (x) {
        s.teams += x.teams; s.pplT += x.pplT; s.opr += x.opr;
        A.JOBS.forEach(function (j) { s[j.id] += (x.ppl[j.id] || 0); });
        Object.keys(x.eq || {}).forEach(function (k) {
          var q = x.eq[k], o = eqBy[q.cat] || (eqBy[q.cat] = { cat: q.cat, run: 0, brk: 0, rep: 0 });
          o.run += (+q.run || 0); o.brk += (+q.brk || 0); o.rep += (+q.rep || 0);
        });
      });
      Object.keys(eqBy).forEach(function (k) { s.run += eqBy[k].run; s.down += eqBy[k].brk + eqBy[k].rep; });

      /* 업체 한 칸 — 인원 줄과 장비 줄을 나란히 */
      h += '<div class="ce">' +
        '<div class="ce__h"><b class="nm">' + esc(G.co) + '</b>' +
        '<span class="sp">' + T('res_pax') + ' ' + nf(s.pplT) + ' · ' +
        T('res_run') + ' ' + nf(s.run) + (s.down ? ' · ' + T('res_brk') + ' ' + nf(s.down) : '') +
        '</span></div>' +
        '<div class="ce__b">' +
          '<div class="ce__c"><div class="ce__t">' + T('ro_ppl') + '</div>' +
            '<div class="tw"><table><thead><tr>' +
            '<th>' + T('u_crew') + '</th>' +
            A.JOBS.map(function (j) { return '<th class="r">' + LJ(j) + '</th>'; }).join('') +
            '<th class="r">' + T('res_pax') + '</th></tr></thead><tbody><tr>' +
            '<td class="r">' + nf(s.teams) + '</td>' +
            A.JOBS.map(function (j) { return '<td class="r">' + (s[j.id] ? nf(s[j.id]) : '·') + '</td>'; }).join('') +
            '<td class="r em">' + nf(s.pplT) + '</td>' +
            '</tr></tbody></table></div></div>' +
          /* ★장비는 **장비종류**로 가른다 — 공종이 아니다(사용자 지적) */
          '<div class="ce__c"><div class="ce__t">' + T('eq_st') + '</div>' +
            (Object.keys(eqBy).length
              ? '<div class="tw"><table><thead><tr><th>' + T('t_bykind') + '</th>' +
                '<th class="r">' + T('res_run') + '</th><th class="r">' + T('res_brk') + '</th>' +
                '</tr></thead><tbody>' +
                Object.keys(eqBy).sort(function (a, b) { return eqBy[b].run - eqBy[a].run; })
                  .map(function (k) {
                    var o = eqBy[k], dn = o.brk + o.rep;
                    return '<tr><td><span class="ab">' + esc(A.eqAbbr(o.cat)) + '</span> ' +
                      '<span class="sp">' + esc(o.cat) + '</span></td>' +
                      '<td class="r em">' + nf(o.run) + '</td>' +
                      '<td class="r' + (dn ? ' em' : '') + '">' + (dn ? nf(dn) : '·') + '</td></tr>';
                  }).join('') + '</tbody></table></div>'
              : '<div class="ce__z sp">' + T('z_none') + '</div>') +
          '</div>' +
        '</div></div>';
    });
    return h;
  }

  /* ── 인원투입 ── 대분류별 소계를 먼저 보이고, 펼치면 공종별로 */
  function rollPpl(ru) {
    /* ★업체별일 때는 업체 기준 집계를 따로 쓴다 — A.rollup은 공종키로만
       합쳐 업체가 사라지기 때문이다(v2.17.5). */
    var gs = (grpBy.ppl === 'co')
      ? A.rollupCo(flt).map(function (g) { return { grp: g.co, rows: g.rows }; })
      : byGrp(ru);
    var body = '';
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
        body += '<tr class="sub"><td class="ind">' +
          (x.key === '_dir' ? esc(T('t7')) : itemLine(x.e.key)) + '</td>' +
          '<td class="r">' + nf(x.teams) + '</td>' +
          A.JOBS.map(function (j) { return '<td class="r">' + (x.ppl[j.id] ? nf(x.ppl[j.id]) : '·') + '</td>'; }).join('') +
          '<td class="r">' + (x.opr ? nf(x.opr) : '·') + '</td>' +
          '<td class="r">' + nf(x.pplT) + '</td></tr>';
      });
    });

    return '<div class="tw"><table><thead><tr><th>' +
      (grpBy.ppl === 'co' ? T('vd_name') : T('work')) + '</th>' +
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
  /* ══ 내역서 확인 필요 목록 (v2.14.0) ═══════════════════
     자동으로 못 붙인 줄만 남는다. 한 번 고르면 별칭에 남아
     다음 공구 파일부터는 손댈 일이 없다. */
  /* ★내가 지우지 않으면 초기화 금지 (v2.16.2 — 사용자 지시).
     종전에는 boqNeed·boqLoc이 메모리에만 있어, 창을 닫거나 새로 고치면
     올려 둔 내역서의 확인 목록이 통째로 사라졌다. 저장을 안 눌렀다고
     불러온 것까지 없애면 안 된다. 저장소에 담아 그대로 되살린다. */
  var boqNeed = (S.boq && S.boq.need) || [], boqLoc = (S.boq && S.boq.loc) || null;
  function boqStore() {
    S.boq = boqNeed.length ? { need: boqNeed, loc: boqLoc } : null;
    A.save();
  }

  /* ★파일명으로 정해진 위치를 따른다 (v2.19.4 — 사용자 지적).
     v2.16.2에서는 `A.locKey(boqLoc) === A.locKey(pkLoc('w'))`로 막았다.
     의도는 「화면과 저장처가 어긋나는 것을 막는다」였는데, 대조 상대인
     pkLoc('w')가 **화면이 처음 열릴 때 한 번 정해지고 상단 필터를 안 따라가는**
     변수라 실제로는 이렇게 됐다 :
       P3-2.csv를 올림 → boqLoc = Phase 3-2 (파일명으로 정확히 판별)
       pk('w')는 열릴 때 잡힌 Phase 1-1 그대로
       → boqHere() false → b.need 67개가 S.boq에 **정상으로 저장돼 있는데도**
         화면에 영영 안 뜬다. 확인 필요 목록 자체가 사라진 것과 같다.
     ★v2.18.2에서 같은 뿌리의 결함을 planListHTML(planLoc || pkLoc('w'))로
       고쳤는데 여기를 빠뜨렸다.
     ★감추는 대신 **적용 위치를 카드에 적는다.** 저장은 어차피 boqLoc으로
       들어가므로(applyBoqPick 3번째 인자) 엉뚱한 곳에 들어갈 위험은 없다.
       못 붙인 줄은 4-D의 「미처리는 날짜 무관하게 남긴다」와 같은 성격이다 —
       안 보이게 하는 쪽이 훨씬 나빴다. */
  function boqHere() {
    return !!(boqNeed.length && boqLoc);
  }
  function boqNeedHTML() {
    if (!boqHere()) return '';
    var site = boqLoc ? boqLoc.s : 'civil';
    var all = A.itemsOf(site, '');
    /* ★부대토목이면 부지토목도 고를 수 있어야 한다 (v2.19.8 — 사용자 지시).
       「부대토목에 없는 것은 부지토목에서 갖다 쓴다」가 자동매칭에서만
       되고 손으로 고를 때는 92개에 갇혀 있으면 반쪽이다.
       ★반대는 없다. 부지토목 화면에는 부대토목이 안 나온다. */
    var all2 = site === 'anc' ? A.itemsOf('civil', '') : [];
    return '<div style="margin-bottom:16px">' + card(T('bq_t'),
      A.locLabel(boqLoc) + ' · ' + nf(boqNeed.length) + T('u_case'),
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
              return '<option value="' + esc(c) + '"' + (it.pick === c ? ' selected' : '') + '>' +
                esc(c + ' · ' + A.trW(e.name) +
                (e.spec ? ' · ' + A.trS(e.spec) : '') + ' [' + e.unit + ']') + '</option>';
            }).join('') + '</optgroup>';
        }
        opt += '<optgroup label="' + esc(T('bq_allw')) + '">' +
          all.map(function (e) {
            var _c = e.code || e.key;
            return '<option value="' + esc(_c) + '"' + (it.pick === _c ? ' selected' : '') + '>' +
              esc((e.code ? e.code + ' · ' : '') + A.trW(e.name) +
                  (e.spec ? ' · ' + A.trS(e.spec) : '') + ' [' + e.unit + ']') + '</option>';
          }).join('') + '</optgroup>';
        if (all2.length) {
          opt += '<optgroup label="' + esc(T('bq_allc')) + '">' +
            all2.map(function (e) {
              var _c = e.code || e.key;
              return '<option value="' + esc(_c) + '"' + (it.pick === _c ? ' selected' : '') + '>' +
                esc((e.code ? e.code + ' · ' : '') + A.trW(e.name) +
                    (e.spec ? ' · ' + A.trS(e.spec) : '') + ' [' + e.unit + ']') + '</option>';
            }).join('') + '</optgroup>';
        }
        /* ★고른 값을 it.pick에 담아 둔다 (v2.16.2 — 사용자 지적).
           종전에는 <select>에만 있어서 [제외]를 누르는 순간 다시 그려지며
           고른 것이 전부 날아갔다. 한 줄 빼자고 스무 줄을 다시 고르게 했다. */
        return '<tr><td><span class="sp">' + esc(it.g) + ' › ' + esc(it.m) + '</span><br>' +
          '<span class="nm">' + esc(it.n) + '</span>' +
          (it.sp ? ' <span class="sp">' + esc(it.sp) + '</span>' : '') + '</td>' +
          '<td class="r em">' + nf(it.q, 1) + ' <span class="sp">' + esc(it.u) + '</span></td>' +
          '<td><select class="in" data-bq="' + i + '">' + opt + '</select></td>' +
          '<td class="c noprint"><button class="btn btn--g btn--sm" data-bqskip="' + i + '">' + T('bq_skip') + '</button></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="btns" style="margin-top:12px">' +
      '<button class="btn" id="bqSave">' + T('save') + '</button>' +
      /* ★목록을 통째로 지우는 길 (v2.19.7 — 사용자 지적).
         v2.19.4에서 「저장돼 있으면 무조건 보인다」로 바꾼 뒤, 예전에 만들어진
         목록이 브라우저에 남아 계속 떠 있었다. 매칭 규칙을 고쳐도 그 목록은
         저장된 옛 결과라 그대로다 — 나아졌는지 확인할 길이 막혔다.
         파일을 다시 올리기 전에는 빠져나갈 방법이 없었다. */
      '<button class="btn btn--g" id="bqDrop">' + T('bq_drop') + '</button>' +
      '<span class="hint">' + T('bq_learn') + '</span></div>', 'flush') + '</div>';
  }

  /* 화면에 떠 있는 고른 값을 먼저 거둬들인다 — 다시 그리기 전에 반드시 부른다 */
  function boqKeep() {
    $$('[data-bq]').forEach(function (sel) {
      var it = boqNeed[+sel.dataset.bq];
      if (it) it.pick = sel.value || '';
    });
  }

  function bindBoq() {
    $$('[data-bq]').forEach(function (sel) {
      sel.onchange = function () {
        var it = boqNeed[+sel.dataset.bq];
        if (it) { it.pick = sel.value || ''; boqStore(); }
      };
    });
    $$('[data-bqskip]').forEach(function (b) {
      b.onclick = function () {
        boqKeep();                       /* ★빼기 전에 고른 것부터 챙긴다 */
        boqNeed.splice(+b.dataset.bqskip, 1);
        boqStore();
        A.render();
      };
    });
    if ($('#bqDrop')) $('#bqDrop').onclick = function () {
      /* ★되돌릴 수 없으므로 반드시 묻는다. 고른 것도 같이 날아간다. */
      if (!confirm(T('bq_dropq'))) return;
      boqNeed = []; boqLoc = null; boqStore();
      A.render();
      setTimeout(function () { say('#planMsg', T('bq_dropped'), true); }, 30);
    };
    if ($('#bqSave')) $('#bqSave').onclick = function () {
      boqKeep();
      var left = [], n = 0;
      boqNeed.forEach(function (it) {
        if (it.pick && A.applyBoqPick(it, it.pick, boqLoc)) n++;
        else left.push(it);
      });
      /* ★방금 배운 별칭으로 남은 줄을 한 번 더 훑는다 (v2.16.2 — 사용자 지적).
         종전에는 고른 줄만 처리하고 끝나서, 같은 파일 안에 똑같은 항목이
         여러 줄 있으면 그 수만큼 손으로 다시 골라야 했다.
         「한 번 고르면 다음부터 자동으로 붙는다」가 같은 파일 안에서는
         전혀 동작하지 않았던 것이다. */
      var auto = 0, rest = [];
      left.forEach(function (it) {
        var m = A.boqMatch(it, boqLoc.s);
        if (m.code && /^alias/.test(m.how) && A.applyBoqPick(it, m.code, boqLoc)) auto++;
        else { it.pick = ''; rest.push(it); }
      });
      boqNeed = rest;
      if (boqLoc) txPlanAll(boqLoc);     /* ★공종을 붙인 것도 서버로 */
      txCfgAll();                        /* ★방금 배운 내역서 별칭(alias)도 서버로 (v2.46.0) */
      boqStore();
      A.render();
      setTimeout(function () {
        say('#planMsg', T('bq_saved') + ' ' + (n + auto) + T('u_ea') +
          (auto ? ' (' + T('bq_auto') + ' ' + auto + T('u_ea') + ')' : '') +
          (rest.length ? ' · ' + T('bq_need') + ' ' + rest.length + T('u_ea') : ''), (n + auto) > 0);
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
  /* ★검측 「처리완료」 칸을 펼쳤는가 (v2.24.0 · 요청 10).
     기본은 접힘이다. 화면 상태일 뿐이므로 저장하지 않는다 — 새로 열면
     다시 접힌다. 끝난 것이 매번 펼쳐진 채로 뜨면 가른 뜻이 없다. */
  var iDone = false;

  function v2() {
    var list = A.inspList(flt);
    var h = '<div class="alert alert--o"><b>' + T('i_rule') + '</b>' +
      '<span class="sp">' + T('h_inspflow') + '</span></div>';

    /* ★오전 마무리 예외 — 관리자가 확인해야 검측이 다음 단계로 넘어간다
       (v2.31.0 · 요청 ⑤). 협력업체가 오전(현지 13시 이전)에 올린 실적에서
       나온 검측 신청만 여기 뜬다. 0건이면 카드를 그리지 않는다. */
    var exc = A.excList(flt);
    if (exc.length) {
      h += '<div class="chk" style="margin-bottom:16px">' +
        '<div class="chk__h">' + T('exc_t') + ' · ' + nf(exc.length) + T('u_case') + '</div>' +
        '<div class="chk__r"><span class="sp">' + T('exc_n').replace('{n}', nf(exc.length)) + '</span></div>' +
        '<div class="tw"><table><thead><tr><th>' + T('date') + '</th><th>' + T('exc_rx') + '</th>' +
        '<th>' + T('loc') + '</th><th>' + T('work') + '</th><th class="r">' + T('th_body') + '</th>' +
        '<th class="noprint"></th></tr></thead><tbody>' +
        exc.map(function (r) {
          var hh = A.subHour(r.subAt);
          var rxt = hh == null ? '—' : (hh < 10 ? '0' + hh : hh) + ':00~';
          return '<tr class="wmark"><td class="sp">' + esc(r.date) + '</td>' +
            '<td class="sp em">' + esc(rxt) + '</td>' +
            '<td class="code">' + esc(A.locLabel(r.loc)) + '</td>' +
            '<td>' + itemLine(r.key, r.spot) + '</td>' +
            '<td class="r">' + nf(r.qty, 2) + ' <span class="sp">' + esc(A.trU((A.item(r.key) || {}).unit || '')) + '</span></td>' +
            '<td class="c noprint"><button class="btn btn--o btn--sm" data-excok="' + esc(r.id) + '">' + T('exc_ok') + '</button></td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }

    h += '<div class="grid g4" style="margin-bottom:16px">' +
      ['apply', 'ready', 'pass', 'fail'].map(function (st) {
        var n = list.filter(function (r) { return r.st === st; }).length;
        return kpi(st === 'fail' && n ? 'kpi--warn' : (st === 'pass' ? 'kpi--lead' : ''),
          T(IST[st][0]), nf(n), T('u_case'), '');
      }).join('') + '</div>';

    /* ★날짜별 조회 (v2.19.0 사용자 지시). 기본은 오늘이고, 미처리는
       날짜와 무관하게 늘 뜬다(inspList 규칙). 기간을 넓히면 지난 것도 본다.
       ★v2.24.0 (현장 요청 10) — 표를 **미처리 / 처리완료 둘로 가른다.**
         종전에는 한 표에 섞여 있고 합격이 맨 아래로 밀려 있을 뿐이라,
         날이 갈수록 끝난 줄이 쌓여 오늘 손댈 것을 찾는 데 스크롤이 필요했다.
       ★처리완료는 **기본이 접힘**이다. 끝난 것은 평소에 볼 일이 없다.
       ★목록은 **한 번만** 구해서 가른다 — withRng를 두 번 부르면 그 사이에
         기간이 바뀔 여지가 생기고, 같은 계산을 두 번 하게 된다.
       ★기간 단추는 **처리완료 쪽**에 둔다. 미처리는 inspList 규칙상 날짜와
         무관하게 늘 뜨므로, 미처리 카드 머리에 붙여 두면 눌러도 아무 일이
         안 일어나는 단추가 된다(4-C).
       ★카드 머리는 접혀 있어도 보인다 — 그래서 접은 채로도 기간을 고를 수 있다. */
    var L = withRng('insp', function () { return A.inspList(flt); });
    var iOpen = L.filter(function (r) { return r.st !== 'pass'; });
    var iDoneL = L.filter(function (r) { return r.st === 'pass'; });

    h += '<div style="margin-bottom:16px">' +
      card(T('s_open'), nf(iOpen.length) + T('u_case'),
        iOpen.length ? inspTable(iOpen) : empty(T('z_noreq'), T('z_fromvendor')), 'flush',
        '<button class="btn btn--g btn--sm noprint" id="iCsv">' + T('csv') + '</button>') +
      '</div>';

    /* ★제목은 `i_done_t`(처리완료)다. KPI가 쓰는 `s_done`은 「처리」 한 마디라
       카드 제목으로는 무엇이 처리됐다는 것인지 읽히지 않는다. */
    h += card(T('i_done_t'), nf(iDoneL.length) + T('u_case'),
        iDone
          ? (iDoneL.length ? inspTable(iDoneL) : empty(T('z_noreq'), T('z_fromvendor')))
          : '',
        'flush',
        rngBtn('insp') +
        '<button class="btn btn--g btn--sm noprint" data-idone="1">' +
        T(iDone ? 'i_dhide' : 'i_dshow') + '</button>');
    return h;
  }
  function inspTable(list) {
    var o = { apply: 0, ready: 1, delay: 2, fail: 3, sub: 4, pass: 5 };
    list = list.slice().sort(function (a, b) { return o[a.st] - o[b.st] || (a.date < b.date ? -1 : 1); });
    /* ★공구를 첫 칸으로 (v2.18.1 사용자 지시) — 화면마다 축이 달라
       머릿속에서 다시 맞춰야 했다. 공구가 전 화면의 공통 축이다. */
    return '<div class="tw"><table><thead><tr><th>' + T('u_sec') + '</th>' +
      '<th>' + T('status') + '</th><th>' + T('date') + '</th>' +
      '<th>' + T('work') + '</th><th class="r">' + T('qty') + '</th>' +
      '<th>' + T('reason') + '</th><th class="noprint">' + T('th_act') + '</th></tr></thead><tbody>' +
      list.map(function (r) {
        var st = IST[r.st] || IST.apply;
        return '<tr><td><b class="code">' + esc(A.locShort(r.loc)) + '</b></td>' +
          '<td><span class="' + st[1] + '">' + T(st[0]) + '</span>' +
          (r.seq > 1 ? ' <span class="bd bd--mute">' + T('i_seq') + ' ' + r.seq + '</span>' : '') + '</td>' +
          '<td class="sp">' + esc(r.date) + '</td>' +
          '<td>' + itemLine(r.key, r.spot) + (r.note ? '<br><span class="sp">' + esc(r.note) + '</span>' : '') + '</td>' +
          '<td class="r">' + nf(r.qty, 2) + '</td>' +
          '<td class="sp" style="max-width:220px">' + esc(r.reason || '') + '</td>' +
          '<td class="c noprint">' +
          (r.st === 'apply'
            ? (A.inspBlocked(r)
                ? '<span class="bd bd--warn">' + T('exc_lock') + '</span> '
                : '<button class="btn btn--o btn--sm" data-iready="' + esc(r.id) + '">' + T('i_ready_do') + '</button> ')
            : '') +
          '<select class="in btn--sm" data-ist="' + esc(r.id) + '"' + (A.inspBlocked(r) ? ' disabled' : '') + ' style="width:auto;padding:3px 6px">' +
          A.INSP_ST.map(function (s) {
            return '<option value="' + s + '"' + (s === r.st ? ' selected' : '') + '>' + T(IST[s][0]) + '</option>';
          }).join('') + '</select>' +
          (r.st === 'fail' ? ' <button class="btn btn--o btn--sm" data-ire="' + esc(r.id) + '">' + T('i_re') + '</button>' : '') +
          ' <button class="btn btn--g btn--sm" data-idel="' + esc(r.id) + '">' + T('del') + '</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ══════════════════════════════════════════════════
     결재 흐름 화면 — 자재·측량 공용 (v2.20.0 사용자 지시)
     ══════════════════════════════════════════════════
     ★엔진은 core.js의 A.FLOW 하나다. 여기서는 그리기만 한다.
       자재 화면과 측량 화면이 같은 함수를 쓰므로, 한쪽만 고쳐져
       서로 어긋나는 일이 생기지 않는다.
     ★버튼은 언제나 최대 셋이고, 그중 둘은 [승인][반려]다.
       셋째(alt)는 측량의 「측량 불필요」 하나뿐이다 —
       스탭 선에서 끝내고 관리자까지 안 올리는 길이다. */

  var FPRE = { mat: 'fm_', surv: 'fs_' };
  function fLabel(kind, r) {
    var st = A.fst(kind, r), d = A.flowDef(kind, r);
    /* ★양쪽 확인 단계는 「누가 남았는가」까지 적는다. 「지급됨」만 쓰면
       스탭이 안 누른 건지 업체가 안 누른 건지 화면에서 알 수 없다. */
    if (d && d.dual) {
      if (!r.okS && !r.okV) return T('fm_iss_b');
      if (!r.okS) return T('fm_iss_s');
      if (!r.okV) return T('fm_iss_v');
    }
    return T(FPRE[kind] + st);
  }

  var FBTN = {
    mat: {
      req:   { ok: 'b_mreq', no: 'b_back' },
      chk:   { ok: 'b_mord', no: 'b_rej'  },
      ord:   { ok: 'b_miss' },
      iss:   { ok: 'b_mfin' },
      rej:   { ok: 'b_mreq', no: 'b_back' }
    },
    surv: {
      req:   { ok: 'b_sreq',  no: 'b_back',   alt: 'b_snone' },
      chk:   { ok: 'b_sord',  no: 'b_rej'   },
      ord:   { ok: 'b_sdone', no: 'b_sfail' },
      sdone: { ok: 'b_sfin',  no: 'b_sdelay' },
      sfail: { ok: 'b_sfin',  no: 'b_sdelay' },
      delay: { ok: 'b_sfin' },
      rej:   { ok: 'b_sreq',  no: 'b_back'  }
    }
  };
  /* 무엇을 물어보고 넘길 것인가 — 수량이냐 사유냐 */
  var FASK = {
    'mat|req|no':    { why: 'p_back'  },
    'mat|rej|no':    { why: 'p_back'  },
    'mat|chk|no':    { why: 'p_rej'   },
    'mat|ord|ok':    { qty: 'p_mqty'  },
    'mat|iss|ok':    { qty: 'p_mfin'  },
    'surv|req|no':   { why: 'p_back'  },
    'surv|rej|no':   { why: 'p_back'  },
    'surv|req|alt':  { why: 'p_snone' },
    'surv|chk|no':   { why: 'p_rej'   },
    'surv|ord|no':   { why: 'p_sfail' },
    'surv|sdone|no': { why: 'p_delay' },
    'surv|sfail|no': { why: 'p_delay' }
  };

  function fRow(kind, id) {
    return kind === 'mat' ? A.mreqById(id)
      : S.surv.filter(function (x) { return x.id === id; })[0];
  }
  /** 버튼 — ★「내 차례」가 아니면 아무것도 안 그린다.
      남의 차례 버튼을 보여 주면 누를 수 있는 줄 알고 누른다. */
  function fBtns(kind, r) {
    if (!A.flowMine(kind, r)) return '';
    var st = A.fst(kind, r), d = (A.FLOW[kind] || {})[st] || {};
    var B = (FBTN[kind] || {})[st] || {};
    var h = '', tag = kind + '|' + esc(r.id) + '|';
    if (d.ok && B.ok)   h += '<button class="btn btn--o btn--sm" data-fgo="' + tag + 'ok">' + T(B.ok) + '</button> ';
    if (d.no && B.no)   h += '<button class="btn btn--d btn--sm" data-fgo="' + tag + 'no">' + T(B.no) + '</button> ';
    if (d.alt && B.alt) h += '<button class="btn btn--g btn--sm" data-fgo="' + tag + 'alt">' + T(B.alt) + '</button>';
    return h;
  }
  /** 지금 단계 배지 — 늦었으면 색이 바뀐다(화면 독촉) */
  function fBadge(kind, r) {
    var late = A.flowLate(kind, r);
    var cls = A.flowEnd(kind, r) ? 'bd bd--ok' : (late ? 'bd bd--d' : 'bd bd--o');
    return '<span class="' + cls + '">' + esc(fLabel(kind, r)) + '</span>' +
      (late ? ' <span class="bd bd--d">' + T('fl_late' + late) + '</span>' : '');
  }
  function fWhy(r) {
    return r.fwhy ? '<br><span class="sp">' + esc(r.fwhy) + '</span>' : '';
  }
  function fWho(kind, r) {
    var own = A.flowOwn(kind, r);
    return own ? '<span class="sp">' + T('fl_own_' + own) + '</span>' : '<span class="sp">—</span>';
  }
  function fWhat(kind, r) {
    return kind === 'mat'
      ? '<span class="nm">' + esc(A.trM(r.mat)) + '</span>' +
        (r.spec ? ' <span class="sp">' + esc(A.trS(r.spec)) + '</span>' : '') +
        ' <span class="sp">' + nf(r.qty, 2) + ' ' + esc(A.trU(r.unit)) + '</span>'
      : itemLine(r.key, r.spot) + (r.why ? '<br><span class="sp">' + esc(r.why) + '</span>' : '');
  }

  /** ★「내 차례」 카드 — 역할이 무엇이든 이 카드부터 본다.
      단계가 다섯이어도 각자에겐 한 줄이다. */
  /* ★kinds — 이 탭에서 볼 「내 차례」 종류. 안 주면 전부(작업현황 탭).
     v2.23.0 — 측량 탭에 자재가 섞여 나오던 것을 여기서 가른다. */
  /** ★지금 누구 손에 걸려 있는가 (v2.24.1 · 요청 11).
      「내 차례」가 0건일 때 종전에는 「내 차례인 것 없음」 한 줄뿐이었다.
      관리자 화면에서 특히 문제였다 — 업체가 올린 요청은 **스탭 확인**이
      먼저라 관리자 차례가 아니고, 그래서 화면이 통째로 비어 보였다.
      「들어오긴 했는데 지금 어디서 멈춰 있는지」를 알 길이 없었다.
      → 빈 칸에 **누구 앞에 몇 건**인지를 적는다. 관리자는 그것을 보고
        스탭에게 말하거나, 아래 표에서 직접 확인한다. */
  function fWhoWait(a) {
    var t = ['staff', 'admin', 'surv', 'vendor'].filter(function (k) { return a.byOwn[k]; })
      .map(function (k) { return T('fl_own_' + k) + ' ' + nf(a.byOwn[k]) + T('u_case'); })
      .join(' · ');
    return t ? T('fl_wait_who') + ' — ' + t : T('fl_mine_n');
  }

  function mineCard(kinds) {
    var list = A.flowMineList(flt, null, null, kinds);
    var late = list.filter(function (x) { return x.late; });
    /* ★`a`를 body보다 **먼저** 구한다 — 빈 칸 문구가 이 값을 쓴다. */
    var a = A.flowWarn(flt, null, kinds);
    var h = '';
    if (late.length) h += '<div class="alert alert--d"><b>' + nf(late.length) + T('u_case') + ' ' +
      T('fl_due_t') + '</b><span class="sp">' + T('fl_late_n') + '</span></div>';
    var body = list.length
      ? '<div class="tw"><table><thead><tr><th>' + T('u_sec') + '</th><th>' + T('fl_step') + '</th>' +
        '<th>' + T('date') + '</th><th>' + T('work') + '</th>' +
        '<th class="noprint">' + T('th_act') + '</th></tr></thead><tbody>' +
        list.map(function (x) {
          var r = x.row;
          return '<tr' + (x.late ? ' class="wmark"' : '') + '>' +
            '<td><b class="code">' + esc(A.locShort(r.loc)) + '</b></td>' +
            '<td>' + fBadge(x.kind, r) + fWhy(r) + '</td>' +
            '<td class="sp">' + esc(r.date || '') + '</td>' +
            '<td>' + fWhat(x.kind, r) + '</td>' +
            '<td class="c noprint">' + fBtns(x.kind, r) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      : empty(T('fl_none'), fWhoWait(a));
    /* ★지급받고도 서로 확인이 안 된 것은 따로 알린다 — 지급은 끝났는데
       확인이 안 걸려 있으면 나중에 「받은 적 없다」가 된다. */
    if (a.recv) h += '<div class="alert alert--o"><b>' + nf(a.recv) + T('u_case') + ' ' +
      T('fl_recv') + '</b><span class="sp">' + T('fl_dual_n') + '</span></div>';
    return h + '<div style="margin-bottom:16px">' +
      card(T('fl_mine'), nf(list.length) + T('u_case'), body, 'flush') + '</div>';
  }

  /* ══════════════════════════════════════════════════
     탭 3 — 측량
     ══════════════════════════════════════════════════
     신청(업체) → 확인(스탭) → 측량지시(관리자) → 측량팀 완료/미완료
     → 스탭이 확인·조치 후 최종완료 또는 지연
     ★측량팀에게는 「내 차례」 카드 하나만 보인다. 전체 표를 주면
       남의 단계까지 눌러 보게 된다. */
  function v3() {
    if (A.isSurv()) return mineCard(['surv']);

    /* ★v2.22.2 — 종전에는 기간 단추가 **없었다.** RNG_DEF에 surv가 있는데도
       화면에 그리는 곳도, withRng로 감싸는 곳도 없어 A.dateFlt가 늘 비었다.
       그래서 끝난 측량은 「오늘 것」만 남고 어제 완료한 것은 볼 길이 아예 없었다.
       ★기본은 종전 그대로 오늘이다(RNG_DEF.surv='today'). 단추가 생겼을 뿐이다. */
    var list = withRng('surv', function () { return A.survList(flt); });
    var open = list.filter(function (r) { return !A.flowEnd('surv', r); });
    var late = list.filter(function (r) { return A.flowLate('surv', r); });
    /* ★흐름 안내 띠 (v2.24.1 · 요청 11 — 사용자 지적)
       「측량이 어디로 들어오는데, 들어와서 어디에서 처리를 해야 되는지가 없다」
       ★검측 탭(v2)에는 종전부터 이 띠가 있었다. **측량 탭에만 없었다.**
         그래서 요청이 협력업체 화면에서 들어온다는 것도, 내 앞 단계가
         무엇인지도 화면에서 읽을 수 없었다.
       ★t3d 같은 탭 부제는 v2.17.8에서 없앤 것이다 — 되살리지 않는다.
         이것은 부제가 아니라 **흐름 한 줄**이고, 검측 탭과 짝을 맞춘 것이다. */
    var h = '<div class="alert alert--o"><b>' + T('h_survin') + '</b>' +
      '<span class="sp">' + T('h_survflow') + '</span></div>';

    h += '<div class="grid g4" style="margin-bottom:16px">' +
      kpi('', T('total'), nf(list.length), T('u_case'), '') +
      kpi(open.length ? 'kpi--warn' : '', T('s_open'), nf(open.length), T('u_case'), '') +
      kpi('kpi--lead', T('s_done'), nf(list.length - open.length), T('u_case'), '') +
      kpi(late.length ? 'kpi--warn' : '', T('fl_due_t'), nf(late.length), T('u_case'), '') + '</div>';

    h += mineCard(['surv']);
    h += card(T('h_survq'), nf(list.length) + T('u_case'),
        list.length ? survTable(list) : empty(T('z_noreq2'), T('z_fromvendor')), 'flush',
        rngBtn('surv') + '<button class="btn btn--g btn--sm noprint" id="sCsv">' + T('csv') + '</button>');
    return h;
  }
  function survTable(list) {
    var ord = { req: 0, rej: 1, chk: 2, ord: 3, sdone: 4, sfail: 5, delay: 6, back: 7, none: 8, fin: 9 };
    list = list.slice().sort(function (a, b) {
      return (ord[A.fst('surv', a)] || 0) - (ord[A.fst('surv', b)] || 0) || (a.date < b.date ? -1 : 1);
    });
    return '<div class="tw"><table><thead><tr><th>' + T('u_sec') + '</th>' +
      '<th>' + T('fl_step') + '</th><th>' + T('fl_wait') + '</th><th>' + T('date') + '</th>' +
      '<th>' + T('reason') + '</th>' +
      '<th class="r">' + T('th_open') + '</th><th class="noprint"></th></tr></thead><tbody>' +
      list.map(function (r) {
        var d = A.dayGap(r.date), end = A.flowEnd('surv', r);
        return '<tr' + (A.flowLate('surv', r) ? ' class="wmark"' : '') + '>' +
          '<td><b class="code">' + esc(A.locShort(r.loc)) + '</b></td>' +
          '<td>' + fBadge('surv', r) + fWhy(r) + '</td>' +
          '<td>' + fWho('surv', r) + '</td>' +
          '<td class="sp">' + esc(r.date) + '</td>' +
          '<td style="max-width:280px">' + esc(r.why || '') + (r.by ? '<br><span class="sp">' + esc(r.by) + '</span>' : '') + '</td>' +
          '<td class="r' + (!end && d >= A.LONG ? ' em' : ' sp') + '">' + (end ? '—' : d + 'd') + '</td>' +
          '<td class="c noprint">' + fBtns('surv', r) +
          ' <button class="btn btn--g btn--sm" data-sdel="' + esc(r.id) + '">' + T('del') + '</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ══════════════════════════════════════════════════
     탭 4 — 자재현황
     ══════════════════════════════════════════════════ */
  /* ══ 자재 — 설계 · 재고 · 지급 (v2.17.1 사용자 지시) ═══
     ★신청→승인→플랜트신청→지급→실사용 5단계를 화면에서 뺐다.
       그 절차는 시스템 밖(창고 대장·플랜트 전화)에서 이미 끝나 있었고,
       화면에서 한 번 더 밟느라 스탭 손만 갔다.
     ★플랜트 자재는 목록에서 뺐다 — 플랜트 신청은 시스템 밖 일이다(4-F).
     ★재고는 사람이 넣는다. 계산으로 갈음할 수 없다 —
       설계−지급으로 잡으면 반입분과 잔재가 빠져 창고와 안 맞는다.
     ★옛 화면은 v4Full로 남겼다. MAT_FLOW_ON=true면 되살아난다. */
  var MAT_FLOW_ON = false;

  function v4() {
    if (MAT_FLOW_ON) return v4Full();
    var rows = A.matRows(flt);
    var h = mineCard(['mat']);   /* ★자재 탭이니 자재만 (v2.23.0) */
    if (!rows.length) {
      return h + card(T('t4'), esc(fltLabel()),
        empty(T('z_nomat'), T('z_nomat_n')) + matAddHTML(), 'flush', rngBtn('mat'));
    }
    h += '<div style="margin-bottom:16px">' + card(T('t4'),
      esc(fltLabel()) + ' · ' + nf(rows.length) + T('u_item'),
      '<div class="tw"><table><thead><tr><th>' + T('u_sec') + '</th>' +
      '<th>' + T('m_mat') + '</th>' +
      '<th class="r">' + T('sp_plan') + '</th>' +
      '<th class="r">' + T('m_req') + '</th>' +
      '<th class="r">' + T('m_stock') + '</th>' +
      '<th class="r">' + T('m_iss') + '</th>' +
      '<th class="r">' + T('m_gap') + '</th>' +
      '<th class="noprint">' + T('th_act') + '</th></tr></thead><tbody>' +
      rows.map(function (a) {
        var gap = a.design ? a.iss - a.design : null;
        /* ★v2.22.3 — 종전에는 `pkLoc('w')`(화면 선택기 위치)를 찍었다.
           어느 줄이든 선택기 값으로 보여, 시트가 Phase 3-1인데 화면은 P1-1이었다.
           이제 표가 위치별로 갈리므로 **그 줄의 위치**를 찍는다. */
        return '<tr><td><b class="code">' + esc(A.locShort(a.loc)) + '</b></td>' +
          '<td><span class="sp">' + esc(A.trM(a.grp)) + ' › ' + esc(A.trM(a.sub)) + '</span><br>' +
          '<b class="nm">' + esc(A.trM(a.mat)) + '</b>' +
          (a.spec ? ' <span class="sp">' + esc(A.trS(a.spec)) + '</span>' : '') +
          /* ★플랜트 자재는 표를 단다 (v2.22.2). 안 달면 레미콘과 창고 자재가
             같은 줄처럼 보인다 — 받는 곳도 처리도 다르다. */
          (a.plant ? ' <span class="bd bd--o">' + T('m_plant') + '</span>' : '') + '</td>' +
          '<td class="r sp">' + (a.design ? nf(a.design, 2) + ' <span class="sp">' + esc(A.trU(a.unit)) + '</span>' : '—') + '</td>' +
          /* ★신청 — 협력업체가 올린 것. 지급 전이라 다른 칸이 다 비어 있어도
             여기만 차 있다. 스탭이 가장 먼저 봐야 할 칸이다. */
          '<td class="r">' + (a.req ? '<span class="bd bd--o">' + nf(a.req, 2) + '</span>' : '<span class="sp">·</span>') + '</td>' +
          /* ★플랜트 자재는 재고 칸을 만들지 않는다 (요청 ⑯ 사용자 지시).
             「플랜트 인원이 아닌 사용자가 정확한 재고수량을 확인하기 어렵다.
               신청·지급하고 지급수량만 집계하면 된다.」
             ★창고 자재는 종전대로 넣는다 — 그쪽은 우리가 세는 것이다.
             ★이미 들어가 있는 값은 지우지 않는다. 칸만 안 만든다. */
          (a.plant
            ? '<td class="r"><span class="sp">—</span></td>'
            : '<td class="r"><input class="in num mt__q" type="number" step="0.01" ' +
                'data-mst="' + esc(a.id) + '" data-mstl="' + esc(A.locKey(a.loc)) +
                '" value="' + (a.stock == null ? '' : nf(a.stock, 2)) + '"></td>') +
          '<td class="r em">' + nf(a.iss, 2) + '</td>' +
          '<td class="r">' + (gap == null ? '<span class="sp">—</span>'
            : '<span class="' + (gap > 0 ? 'bd bd--d' : 'sp') + '">' + (gap > 0 ? '+' : '') + nf(gap, 2) + '</span>') +
          '</td>' +
          '<td class="noprint">' + mtActs(a) + '</td></tr>';
      }).join('') + '</tbody></table></div>', 'flush',
      rngBtn('mat') + '<button class="btn btn--g btn--sm noprint" id="mtCsv">' + T('csv') + '</button>') +
      matAddHTML() + '</div>';
    return h;
  }

  /* ★신청 건마다 결재 흐름을 그린다 (v2.20.0 사용자 지시).
       신청(업체) → 검토(스탭) → 확인(관리자) → 지급 → 최종입력
     ★미지급·반려는 사유와 함께 계속 남는다 — 지우지 않는다.
       「누구 잘못인지 알아야 되잖아」(v2.19.1 원칙 그대로).
     ★버튼은 「내 차례」인 사람에게만 나온다. 남의 단계는 배지만 보인다. */
  function mtActs(a) {
    var list = A.mreqOf(flt, a.id);
    if (!list.length) return '<span class="sp">·</span>';
    return list.map(function (r) {
      var btn = fBtns('mat', r);
      return '<div class="mta">' + fBadge('mat', r) +
        (r.iss != null ? ' <span class="sp">' + nf(r.iss, 2) + '</span>' : '') +
        (r.fwhy ? ' <span class="sp">' + esc(r.fwhy) + '</span>' : '') +
        (btn ? ' ' + btn : '') + '</div>';
    }).join('');
  }

  /* ★설계에 없는 자재도 지급한다 (v2.19.0 사용자 지시).
     마스터에 없는 이름도 손으로 적을 수 있어야 한다 — 현장에서 급히 쓰는
     자재는 설계서에 없는 경우가 많다.
     ★접어 둔다. 자주 하는 일이 아닌데 늘 펴 두면 표가 밀린다. */
  var matAddOpen = false;
  function matAddHTML() {
    var n = A.matExtraCount(flt);
    var h = '<div class="eqadd"><button class="eqadd__t" id="mtAddT" aria-expanded="' + matAddOpen + '">' +
      (matAddOpen ? '▾' : '▸') + ' ' + T('m_add') +
      (n ? ' <span class="bd bd--o">' + nf(n) + '</span>' : '') + '</button>';
    if (matAddOpen) {
      h += '<div class="eqadd__row">' +
        '<input class="in" id="mtName" placeholder="' + esc(T('m_mat')) + '">' +
        '<input class="in" id="mtSpec" placeholder="' + esc(T('c_spec')) + '">' +
        '<input class="in" id="mtUnit" placeholder="' + esc(T('c_unit')) + '" style="width:90px">' +
        '<input class="in num" id="mtQty" type="number" step="0.01" placeholder="0">' +
        '<button class="btn btn--sm" id="mtAdd">' + T('add') + '</button>' +
        '</div><div class="hint" id="mtMsg">' + T('m_add_n') + '</div>';
    }
    return h + '</div>';
  }

  function v4Full() {
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
    h += '<div style="margin-bottom:16px">' + card(T('m_design'), '',
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
    h += card(T('m_gap') + ' — ' + T('m_' + (plant ? 'plant' : 'store')), esc(fltLabel()),
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
  /* ══ 탭5 알림 (v2.16.1) ═══════════════════════════════
     ★자유 게시판이 아니라 「보낼 문안을 만들어 주는 도구」다(사용자 지시).
       업체별로 인원·장비·작업내용을 묶어 문안을 만든다.
       · 협력업체(이라크 현지) → 왓츠앱. wa.me 링크를 열면 문안이 채워진 채 뜬다.
       · 본사·한국인 → 한국어 요약을 [복사]해 카톡에 붙인다.
     ★작업수량·진행률·미처리는 넣지 않는다(사용자 지시). 공종명만 적는다.
     ★왓츠앱 자동 발송은 Meta 법인 인증이 있어야 한다. 인증이 나오면
       [왓츠앱] 버튼 옆에 자동 발송을 붙이면 되고, 문안은 그대로 쓴다. */

  function noticeRows() {
    var d = { from: A.dateFlt.from || A.today(), to: A.dateFlt.to || A.today() };
    var by = {};
    function slot(name) {
      return by[name] || (by[name] = { co: name, pax: 0, run: 0, brk: 0, works: [], seen: {} });
    }
    S.crew.forEach(function (c) {
      if (c.st !== 'ok' || !A.locMatch(c, flt)) return;
      if (c.date < d.from || c.date > d.to) return;
      var o = slot(A.coOf(c, false) || T('res_dir'));   /* ★업체 Master 기준 — core.js A.coOf */
      o.pax += A.crewTotal(c);
      (c.eq || []).forEach(function (q) { o.run += (+q.run || 0); o.brk += (+q.brk || 0) + (+q.rep || 0); });
    });
    S.work.forEach(function (w) {
      if (w.st !== 'ok' || !A.locMatch(w, flt)) return;
      if (w.date < d.from || w.date > d.to) return;
      var o = slot(w.by || T('res_dir')), e = A.item(w.key);
      var nm = e ? e.name : w.key;
      if (!o.seen[nm]) { o.seen[nm] = 1; o.works.push(nm); }
    });
    var out = [];
    Object.keys(by).forEach(function (k) { out.push(by[k]); });
    return out.sort(function (a, b) { return b.pax - a.pax; });
  }

  /* 업체 한 곳 문안 — 그 업체가 읽을 언어로 */
  function noticeOne(o, lg) {
    var L = {
      ko: { hd: '작업현황', pax: '인원', eq: '장비', run: '가동', brk: '고장', wk: '작업', u: '명', v: '대' },
      en: { hd: 'Daily report', pax: 'Workers', eq: 'Equipment', run: 'running', brk: 'down', wk: 'Works', u: '', v: '' }
    }[lg] || null;
    var ar = lg === 'ar';
    var t = L || { hd: 'تقرير يومي', pax: 'العمال', eq: 'المعدات', run: 'تشغيل', brk: 'معطل', wk: 'الأعمال', u: '', v: '' };
    var loc = A.locLabel(pkLoc('w'));
    var day = A.dateFlt.from || A.today();
    var wk = o.works.map(function (n) { return lg === 'ko' ? n : A.trW(n, ar ? 'en' : lg); });
    return '[BNCP] ' + o.co + ' · ' + loc + ' · ' + day + '\n' +
      t.hd + '\n' +
      '· ' + t.pax + ' ' + nf(o.pax) + t.u + '\n' +
      '· ' + t.eq + ' ' + nf(o.run) + t.v + ' (' + t.run + ')' +
      (o.brk ? ' · ' + nf(o.brk) + t.v + ' (' + t.brk + ')' : '') + '\n' +
      (wk.length ? '· ' + t.wk + ': ' + wk.join(', ') + '\n' : '') +
      A.vendUrl((A.vendByName ? (A.vendByName(o.co) || {}).key : '') || '');
  }

  /* 전체 요약 — 과장님이 복사해 카톡에 붙인다 */
  function noticeAll(rows) {
    var loc = A.locLabel(pkLoc('w')), day = A.dateFlt.from || A.today();
    var pax = 0, run = 0, brk = 0;
    rows.forEach(function (o) { pax += o.pax; run += o.run; brk += o.brk; });
    var st = A.eqStatus(flt), given = 0, anyG = 0;
    st.forEach(function (o) { if (o.given != null) { given += o.given; anyG = 1; } });
    var idle = anyG ? Math.max(0, given - run - brk) : 0;
    var tot = anyG ? given : run + brk;

    var s = '[BNCP ' + loc + '] ' + day.slice(5) + ' ' + T('t1') + '\n\n';
    s += '■ ' + T('n_in') + '\n';
    s += ' ' + T('u_crew2') + ' ' + nf(pax) + T('u_pax') + ' · ' + T('equip') + ' ' + nf(tot) + T('u_unitq') +
      ' (' + T('run') + ' ' + nf(run) + '/' + T('brk') + ' ' + nf(brk) +
      (anyG ? '/' + T('e_idle') + ' ' + nf(idle) : '') + ')\n\n';
    s += '■ ' + T('n_byco') + '\n';
    rows.forEach(function (o) {
      s += ' ' + o.co + '  ' + T('u_crew2') + ' ' + nf(o.pax) + ' · ' + T('equip') + ' ' + nf(o.run) +
        (o.works.length ? ' · ' + o.works.slice(0, 4).join(', ') : '') + '\n';
    });
    return s;
  }

  /* ★독촉 — 마감 08:00, 30분 간격 두 번 (사용자 확정 사양).
     문안은 업체 언어를 따른다. 왓츠앱은 눌러서 보내고, 카톡용은 통째로 복사한다.
     ※무인 발송은 WhatsApp Business API가 붙어야 한다 — 대상 추출은 여기서
       끝내 두었으므로 서버는 이 결과만 가져다 쓰면 된다. */
  function dueHTML() {
    var d = A.dueList(flt);
    /* ★결재가 멈춘 것도 독촉한다 (v2.20.0 사용자 지시).
       「확인이 늦어지면 화면에서 독촉할 수 있게 해줘. 화면하고 문자로.」
       화면 쪽은 mineCard()의 경고 줄과 줄 주황이 맡고, 여기는 문자 쪽이다. */
    var fd = A.flowDue(flt);
    var n = d.co.length + d.staff.length + fd.length;
    var body = '';
    if (!n) body = empty(T('du_none'), T('du_none_n'));
    else {
      body = '<div class="tw"><table><tbody>';
      d.co.forEach(function (c) {
        var msg = dueMsgCo(c);
        body += '<tr><td><span class="bd bd--o">' + T('du_' + c.stage) + '</span> ' +
          '<b class="nm">' + esc(c.name) + '</b><br><span class="sp">' +
          c.miss.map(function (m) { return T('du_m_' + m); }).join(' · ') + '</span></td>' +
          '<td class="r noprint">' +
          (c.tel ? '<a class="btn btn--g btn--sm" target="_blank" rel="noopener" href="https://wa.me/' +
            esc(String(c.tel).replace(/[^0-9]/g, '')) + '?text=' + encodeURIComponent(msg) + '">' + T('n_wa') + '</a> ' : '') +
          '<button class="btn btn--g btn--sm" data-ducp="' + esc(msg) + '">' + T('copy') + '</button></td></tr>';
      });
      d.staff.forEach(function (x) {
        var msg = dueMsgStaff(x);
        body += '<tr><td><span class="bd bd--o">' + T('du_' + x.stage) + '</span> ' +
          '<b class="nm">' + esc(x.who || T('du_staff')) + '</b><br><span class="sp">' +
          (x.insp ? T('t2') + ' ' + nf(x.insp) + T('u_case') : '') +
          (x.insp && x.surv ? ' · ' : '') +
          (x.surv ? T('t3') + ' ' + nf(x.surv) + T('u_case') : '') + '</span></td>' +
          '<td class="r noprint"><button class="btn btn--g btn--sm" data-ducp="' + esc(msg) + '">' +
          T('copy') + '</button></td></tr>';
      });
      fd.forEach(function (x) {
        var msg = dueMsgFlow(x);
        var who = x.own === 'vendor' ? (x.name || T('fl_own_vendor')) : T('fl_own_' + x.own);
        var tel = x.tel ? String(x.tel).replace(/[^0-9]/g, '') : '';
        body += '<tr><td><span class="bd bd--d">' + T('du_' + x.stage) + '</span> ' +
          '<b class="nm">' + esc(who) + '</b><br><span class="sp">' +
          (x.mat ? T('t4') + ' ' + nf(x.mat) + T('u_case') : '') +
          (x.mat && x.surv ? ' · ' : '') +
          (x.surv ? T('t3') + ' ' + nf(x.surv) + T('u_case') : '') + '</span></td>' +
          '<td class="r noprint">' +
          (tel ? '<a class="btn btn--g btn--sm" target="_blank" rel="noopener" href="https://wa.me/' +
            esc(tel) + '?text=' + encodeURIComponent(msg) + '">' + T('n_wa') + '</a> ' : '') +
          '<button class="btn btn--g btn--sm" data-ducp="' + esc(msg) + '">' +
          T('copy') + '</button></td></tr>';
      });
      body += '</tbody></table></div>';
    }
    return '<div style="margin-bottom:16px">' + card(T('du_t'),
      T('du_n').replace('{h}', A.DUE.hour).replace('{g}', A.DUE.gap),
      body, '',
      n ? '<button class="btn btn--g btn--sm" id="duAll">' + T('du_all') + '</button>' : '') + '</div>';
  }
  function dueMsgCo(c) {
    /* ★반려는 문안이 달라야 한다 (v2.18.8 사용자 지시).
       「입력이 없다」와 「올린 것을 고쳐 달라」는 전혀 다른 요구다.
       둘 다면 반려를 먼저 적는다 — 고치는 쪽이 더 급하다. */
    var R = { ko: '님, 반려된 실적 {n}건이 있습니다. 확인 후 고쳐서 다시 올려 주세요.',
              en: ' — {n} rejected item(s). Please correct and resubmit.',
              bn: ' — {n}টি ফেরত পাঠানো হয়েছে। ঠিক করে আবার জমা দিন।',
              ar: ' — {n} بند مرفوض. يرجى التصحيح وإعادة الإرسال.' };
    var M = { ko: '님, 오늘 작업 입력이 아직 없습니다. 확인 부탁드립니다.',
              en: ' — today\'s entry is still missing. Please submit.',
              bn: ' — আজকের এন্ট্রি এখনও নেই। জমা দিন।',
              ar: ' — لم يتم إدخال بيانات اليوم بعد. يرجى الإدخال.' };
    var lg = R[c.lang] ? c.lang : 'en';
    var out = [];
    if (c.rej) out.push(c.name + R[lg].replace('{n}', c.rej));
    if (c.miss.filter(function (m) { return m !== 'rej'; }).length) out.push(c.name + M[lg]);
    return out.join('\n') || (c.name + M[lg]);
  }
  function dueMsgStaff(x) {
    return (x.who || '') + ' — ' + T('du_wait') + ' ' + nf(x.insp + x.surv) + T('u_case');
  }
  /* ★역할 앞으로 보내는 문안이다 — 사람 이름이 아니라 「관리자」·「측량팀」이다.
     결재는 자리에 걸린 일이지 특정 개인에게 걸린 일이 아니다. */
  function dueMsgFlow(x) {
    /* ★업체는 역할이 아니라 **이름** 앞으로 간다 — 그래야 보낼 곳이 있다.
       스탭·관리자·측량팀은 자리에 걸린 일이라 역할 이름을 쓴다. */
    var who = x.own === 'vendor' ? (x.name || T('fl_own_vendor')) : T('fl_own_' + x.own);
    return who + ' — ' + T('fl_due_t') + ' ' +
      nf(x.mat + x.surv) + T('u_case') + ' (' + T('fl_late' + x.stage) + ')';
  }

  function v5() {
    var rows = noticeRows();
    var h = dueHTML();
    h += '<div style="margin-bottom:16px">' + card(T('n_co'), '',
      (rows.length
        ? '<div class="tw"><table><thead><tr><th>' + T('vd_name') + '</th>' +
          '<th class="r">' + T('u_crew2') + '</th><th class="r">' + T('equip') + '</th>' +
          '<th>' + T('work') + '</th><th class="noprint"></th></tr></thead><tbody>' +
          rows.map(function (o, i) {
            var v = A.vendByName ? A.vendByName(o.co) : null;
            var tel = v && v.tel ? String(v.tel).replace(/[^0-9]/g, '') : '';
            return '<tr><td><span class="nm">' + esc(o.co) + '</span>' +
              (tel ? ' <span class="sp">+' + esc(tel) + '</span>' : '') + '</td>' +
              '<td class="r em">' + nf(o.pax) + '</td>' +
              '<td class="r">' + nf(o.run) + (o.brk ? ' <span class="sp">/' + nf(o.brk) + '</span>' : '') + '</td>' +
              '<td class="sp">' + esc(o.works.slice(0, 3).join(', ')) + '</td>' +
              '<td class="c noprint">' +
              (tel ? '<a class="btn btn--g btn--sm" target="_blank" style="text-decoration:none" href="https://wa.me/' +
                esc(tel) + '?text=' + encodeURIComponent(noticeOne(o, 'en')) + '">' + T('n_wa') + '</a> ' : '') +
              '<button class="btn btn--g btn--sm" data-ncopy="' + i + '">' + T('copy') + '</button></td></tr>';
          }).join('') + '</tbody></table></div>' +
          (rows.some(function (o) { return !(A.vendByName && (A.vendByName(o.co) || {}).tel); })
            ? '<div class="hint" style="margin-top:8px">' + T('n_notel') + '</div>' : '')
        : empty(T('z_none'), T('n_co_z'))), 'flush', rngBtn('ntc')) + '</div>';

    /* 전체 요약 — 카톡용 */
    h += '<div style="margin-bottom:16px">' + card(T('n_sum'), '',
      '<pre class="npre" id="nSum">' + esc(noticeAll(rows)) + '</pre>' +
      '<div class="btns" style="margin-top:12px">' +
      '<button class="btn" id="nSumCopy">' + T('copy') + '</button>' +
      '<span class="hint" id="nMsg"></span></div>') + '</div>';
    return h;
  }
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
  /* ★날짜·입력자·작업내용·설명을 모듈 상태로 든다 (v2.43.1 사용자 지적
     「장비종류를 고르면 작업내용·입력자가 초기화된다」). 종전엔 이 값들이
     DOM에만 있어, 장비 선택 등으로 A.render()가 돌면 통째로 날아갔다. */
  var dF = { date: '', by: '', task: '', note: '' };
  var dPpl = { eng: 0, fmn: 0, wkr: 0 };
  var dEq = [];
  var dCat = '', dSize = '';

  /* ★직영 입력·수정 폼만 (v2.49.1) — v7에서 떼어냈다. 3번 카드에서 관리자가
     [수정]을 눌렀을 때도 고칠 폼이 있어야 한다(없으면 고칠 수가 없다). */
  function directFormHTML() {
    var form = '';
    var canAdd = (A.role() !== 'admin');
    if (canAdd || dEdit) {
    var pk = dEdit ? T('d_save') : T('d_add');
    /* ★입력자(담당자)는 스탭 명부에서 **고른다** (v2.43.1 사용자 지적 「담당자는
       선택하면 되지 왜 입력하나」). 명부(S.staff)가 비었으면 종전처럼 자유입력.
       ★편집 중인 옛 이름이 명부에 없어도 그 값이 안 사라지게 목록에 끼워 준다. */
    var dStaff = A.staffAll().map(function (s) { return s.name; });
    if (dF.by && dStaff.indexOf(dF.by) < 0) dStaff.unshift(dF.by);
    var dByField = dStaff.length
      ? '<select class="in" id="dBy"><option value="">' + T('pick') + '</option>' +
          dStaff.map(function (n) {
            return '<option value="' + esc(n) + '"' + (n === dF.by ? ' selected' : '') + '>' + esc(n) + '</option>';
          }).join('') + '</select>'
      : '<input class="in" id="dBy" value="' + esc(dF.by) + '">';
    form += '<div style="margin-bottom:16px">' + card(dEdit ? T('d_edit') : T('d_open'), '',
      pkHTML('d', true) +
      '<div class="f-row" style="margin-top:12px">' +
        /* ★조 수(팀 수) 입력을 없앴다(사용자 지시 — 무슨 뜻인지도 모호했다).
           저장은 여전히 teams:1로 고정해 둔다 — A.pplSum·현황판 등 다른 계산이
           teams 값을 참조하는 자리가 있어 값 자체를 지우면 그쪽이 깨진다. */
        fld(T('date'), '<input class="in" id="dDate" type="date" value="' + esc(dF.date || A.today()) + '">') +
        fld(T('d_by'), dByField) +
      '</div>' +
      '<div style="margin-top:12px">' + fld(T('d_task'),
        '<input class="in" id="dTask" value="' + esc(dF.task) + '" placeholder="' + esc(T('d_task_ph')) + '">') + '</div>' +
      '<div style="margin-top:12px">' + fld(T('d_note'), '<input class="in" id="dNote" value="' + esc(dF.note) + '">') + '</div>' +
      '<div class="vsec">' + T('people') + '</div>' + dDial() +
      '<div class="vsec">' + T('equip') + '</div>' + dEqHTML(),
      '<button class="btn btn--o" id="dSave">' + pk + '</button>' +
      (dEdit ? ' <button class="btn btn--g" id="dCancel">' + T('d_cancel') + '</button>' : '') +
      ' <span class="vmsg" id="dMsg"></span>') + '</div>';
    }
    return form;
  }

  function v7() {
    var h = '';

    /* ★상단 집계 카드(직영투입집계·조 수·장비)와 인원 그래프는 삭제했다
       (사용자 지시). 같은 숫자가 아래 기록 표와 오른쪽 현황판에 이미 있었고,
       그래프는 직군 셋을 막대로 늘여 놓은 것이라 읽을 것이 없었다. */

    /* ★입력은 스탭, 관리자는 확인·수정만 (v2.16.9 — 사용자 지시).
       ★관리자도 [수정]을 누르면 폼이 열린다. 안 그러면 「수정 기능만」이라는
         지시가 성립하지 않는다 — 고칠 폼이 없으면 고칠 수가 없다.
       ★A.can('direct')를 새로 만들지 않고 역할을 직접 본다.
         권한 표(can)는 관리자 ⊇ 스탭 구조라, 「스탭만」은 그 표로 표현이 안 된다. */
    h += directFormHTML();

    /* ── 기록 ── */
    /* ★기간 단추를 달았다 (v2.19.11 사용자 지시). 기본은 오늘.
       종전에는 이 표만 기간이 없어 전 기간이 다 나왔다 — 표가 끝없이 길어졌다. */
    /* ★아래 여백 (v2.19.15 사용자 지적) — 이 카드만 감싸는 div가 없어
       바로 밑 작업량 카드와 선이 맞붙어 한 카드처럼 보였다. */
    h += '<div style="margin-bottom:16px">' + card(T('d_list'), esc(fltLabel()),
      directListHTML(), 'flush', rngBtn('dir')) + '</div>';
    return h;
  }
  /* ★직영 기록 표만 (v2.49.1) — 카드 껍데기 없이. 3번 카드가 이것만 쓴다.
     종전에는 v7()이 제 카드(제목 「직영작업현황」)를 만들어 돌려줘서, 구획
     소제목 밑에 카드 제목이 또 붙었다(사용자 지적 「제목이 몇 개야」).
     ★탭7(스탭 화면)은 위에서 이 함수를 카드로 감싸 쓰므로 종전 그대로다. */
  function directListHTML() {
    return withRng('dir', function () {
      var rows = A.directRows(flt);
      return rows.length
        /* ★.tw로 감싼다 (v2.16.2 — 사용자 지적).
           이 표만 class="tb"(정의도 없는 이름)로 맨몸이라, .tw 아래에 걸린
           font-size:12px · td padding · .r(오른쪽 정렬) · .nm · .sp가 하나도
           안 먹었다. 그래서 글씨가 크고 날짜와 아래 내용의 축이 어긋났다. */
        ? '<div class="tw"><table><thead><tr><th>' + T('date') + '</th><th>' + T('loc') + '</th>' +
          '<th>' + T('d_task') + '</th>' +
          '<th class="r">' + T('total') + '</th><th>' + T('d_by') + '</th>' +
          '<th class="noprint"></th></tr></thead><tbody>' +
          rows.map(function (x) {
            var n = A.pplSum(x.ppl) + A.oprCount(x.eq || []);
            return '<tr' + (dEdit === x.id ? ' class="on"' : '') + '>' +
              '<td>' + esc(x.date) + '</td><td>' + esc(A.locLabel(x.loc)) + '</td>' +
              '<td class="nm">' + esc(x.task) +
              (x.note ? '<span class="sp"> · ' + esc(x.note) + '</span>' : '') + '</td>' +
              '<td class="r"><b>' + nf(n) + '</b></td>' +
              '<td>' + esc(x.by || '') + '</td>' +
              '<td class="noprint"><button class="btn btn--g btn--sm" data-ded="' + x.id + '">' + T('d_edit') + '</button> ' +
              '<button class="btn btn--g btn--sm" data-ddel="' + x.id + '">' + T('d_del') + '</button></td></tr>';
          }).join('') + '</tbody></table></div>'
        : empty(T('d_none'), T('t7d'));
    });
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
      /* ★고장(brk)·정비중(rep)도 받는다 (v2.43.0 · 18-스펙 「직영 … 고장장비」).
         종전엔 가동(run)만 있어 직영 장비 고장이 장비현황·지급대조·정비에
         전혀 안 잡혔다. 협력업체 인원장비 입력과 같은 세 칸으로 맞춘다. */
      fld(T('run'), '<input class="in num" id="dRun" type="number" min="0" step="1" value="0">') +
      fld(T('brk'), '<input class="in num" id="dBrk" type="number" min="0" step="1" value="0">') +
      fld(T('rep'), '<input class="in num" id="dRep" type="number" min="0" step="1" value="0">') +
      fld('&nbsp;', '<button class="btn btn--g" id="dEqAdd">' + T('eqadd') + '</button>') + '</div>' +
      (dEq.length ? '<div style="margin-top:12px">' + dEq.map(function (x, i) {
        return '<div class="eqrow"><span class="eqrow__n">' + esc(A.eqLabel(x.cat, x.size)) + '</span>' +
          '<span class="bd">' + esc(T('run')) + ' ' + nf(x.run) + '</span>' +
          (x.brk ? '<span class="bd bd--d">' + esc(T('brk')) + ' ' + nf(x.brk) + '</span>' : '') +
          (x.rep ? '<span class="bd bd--o">' + esc(T('rep')) + ' ' + nf(x.rep) + '</span>' : '') +
          '<button class="btn btn--g btn--sm" data-deqd="' + i + '">✕</button></div>';
      }).join('') + '</div>' : '');
  }

  var V = { 1: v1, 2: v2, 3: v3, 4: v4, 5: v5, 6: v6, 7: v7 };
  /* ★스크롤 방향 감시(body.scr-dn)는 v2.19.9에서 지웠다.
     요약 띠를 sticky로 두고 「위로 올릴 때만 내려오게」 하려고 만든 것인데,
     내려온 띠가 바로 밑 공구 표의 머리행을 덮었다(app.css의 .sb 주석 참조).
     띠가 더는 고정이 아니므로 이 감시는 아무 데도 쓰이지 않는다.
     ★되살리려면 표 머리행과 겹치는 문제부터 풀 것. 그냥 되돌리면 증상도 돌아온다. */

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
    if (_rl) _rl.innerHTML = '<span class="rolebd">' + T(A.isAdmin() ? 'lg_admin' : (A.isSurv() ? 'lg_surv' : 'lg_staff')) + '</span>' +
      '<button class="btn btn--g btn--sm" id="lgOut">' + T('lg_out') + '</button>';
    fltAuto();                      /* ★한 곳뿐이면 자동으로 맞춘다 (v2.50.0) */
    $('#fltBox').innerHTML = fltHTML();
    $('#hmeta').innerHTML = '<b>' + esc(fltLabel()) + '</b><br>' +
      nf(A.hasPlan(flt)) + ' items planned · ' + nf(S.work.length) + ' records';

    /* 로그인 안 했으면 아무것도 보여주지 않는다
       ★isStaff()가 아니라 isIn()이다 (v2.20.0) — 측량팀은 스탭이 아니라서
         isStaff()로 막으면 비밀번호가 맞아도 영영 못 들어온다. */
    if (!A.isIn()) {
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
    /* ★탭6 공정표는 감춘다 (v2.16.0, 사용자 지시)
       실적 기반 자동계산만 있고 계획 날짜를 넣을 수 없어 여기서 할 일이 아니다.
       ★코드는 남겨 둔다 — 계획 날짜 입력을 붙이면 쓸 수 있는 물건이다.
         되살리려면 아래 SCHED_ON을 true로 바꾸면 된다. */
    var SCHED_ON = false;
    /* ★측량팀은 측량 탭 하나뿐이다 (v2.20.0 사용자 지시).
       들어와서 할 일이 「완료 / 완료 못한 사유」 입력 하나이므로,
       나머지를 보여 주면 볼 것만 늘고 실수할 자리만 는다. */
    var TABS_ON = A.isSurv() ? [3] : [1, 2, 3, 4, 5, 6, 7].filter(function (i) {
      if (i === 5) return A.can('notice');
      if (i === 6) return SCHED_ON && A.can('sched');
      if (i === 7) return A.role() !== 'admin';   /* 관리자는 작업현황에서 본다 */
      return true;
    });
    if (TABS_ON.indexOf(cur) < 0) cur = 1;
    $('#tabs').innerHTML = TABS_ON.map(function (i) {
      return '<button role="tab" data-tab="' + i + '" aria-selected="' + (i === cur) + '">' +
        T('t' + i) + (bd[i] ? '<span class="cnt warn">' + bd[i] + '</span>' : '') + '</button>';
    }).join('') +
      /* ★날씨를 탭바 오른쪽 끝(마지막 탭 옆)에 붙인다 (v2.42.0 사용자 지시).
         margin-left:auto로 멀찍이 떨어뜨리고, 가로로 눕혀 컴팩트하게. 같은
         id="wxBox"라 wxInit이 늦게 온 자료로 이 칸만 갈아 끼운다(렌더 다시 안 함). */
      '<div class="wxtab" id="wxBox">' + A.wxHTML() + '</div>';

    /* ★탭 제목 옆 설명문(t1d·t2d…)을 없앴다 (v2.17.8 사용자 지시).
       「업체가 올린 실적을 스탭이 확인하면…」 같은 안내는 처음 한 번 읽고
       나면 매일 자리만 차지한다. 제목만 남긴다. */
    $('#view').innerHTML = '<div class="ph"><h1>' + T('t' + cur) + '</h1></div>' + V[cur]();
    bind();
    if (A.wxInit) A.wxInit();       /* ★날씨 — 늦게 와도 칸 하나만 갈아 끼운다 */
  };

  /* ★`--sbh`(띠 높이 기준점)와 그것을 재던 sbHeight를 **지웠다** (v2.19.21).
     현황판이 오른쪽 기둥으로 가면서 **본문 위에 아무것도 없다.** 머리행은
     화면 맨 위(top:0)에 그대로 붙으면 된다.
     ★이 변수가 v2.19.17~20을 헛돌게 만든 장본인이다 — 한 번만 재고 날씨가
       늦게 도착하면 낡은 값으로 남았다. 되살리지 말 것. 되살릴 이유가 있다면
       그것은 가로 띠로 돌아간다는 뜻이고, 그러면 덮는 문제도 같이 돌아온다. */
  A.go = function (i) { cur = i; S.tab = i; A.save(); A.render(); window.scrollTo(0, 0); };
  A.sync = function (quiet) { syncNow(quiet !== false); };   // 화면 진입 시 1회 수신

  /* ★자동 수신 (v2.23.0 · 요청 8) — 1분마다 서버를 확인한다.
     사용자 확정 : 「1분마다 · 바뀜 게 있으면 자동으로 바로 받는다」
     ★어느 탭에 있든 돈다. 종전에는 화면 열 때 한 번뿐이라, 검측·측량 탭을
       보고 있으면 새 자료가 올라와도 몰랐다.
     ★syncNow는 quiet=true로 부른다 — 자동 수신이 화면을 시끄럽게 흔들면 안 된다.
       바뀐 게 없으면 meta(수십 바이트)만 오가고 끝난다.
     ★syncing이면 건너뛴다(syncNow 안에서 막지만, 타이머가 헛불리는 것도 막는다).
     ★한 번만 건다 — 여러 번 걸면 같은 수신이 겹친다. */
  var autoSyncTimer = null, syncHooked = false;
  A.AUTO_SYNC_MS = 60000;
  /* ★모바일 복귀 즉시 수신 (v2.39.0 · 사용자 지적 「모바일로 보면 서버와
       통신이 안 되어 반영이 안 되는 것들이 있다」).
     ★원인 : 자동수신은 1분 setInterval인데, **모바일 브라우저는 화면을 끄거나
       앱을 뒤로 돌리면 이 타이머를 멈춘다(throttle·suspend).** 그래서 현장에서
       폰을 다시 켜도 최대 1분(혹은 영영) 낡은 화면이 남는다 — 서버엔 올라와
       있는데 이 폰에만 안 뜨는 「반영 안 됨」의 정체다.
     ★고침 : 돌아오는 순간(visibilitychange·focus·online·pageshow)을 잡아
       그 자리에서 한 번 당긴다. pageshow는 모바일 뒤로가기(bfcache 복귀)를
       잡는다 — 그때는 스크립트가 다시 안 도므로 이 이벤트가 유일한 신호다. */
  function wakeSync() {
    if (!window.BNCP_API || syncing) return;
    if (typeof document !== 'undefined' && document.hidden) return;  /* 아직 안 보이면 쉰다 */
    syncNow(true);
  }
  function hookWake() {
    if (syncHooked) return;
    syncHooked = true;
    if (typeof document !== 'undefined' && document.addEventListener)
      document.addEventListener('visibilitychange', wakeSync);
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('focus', wakeSync);
      window.addEventListener('online', wakeSync);
      window.addEventListener('pageshow', wakeSync);
    }
  }
  A.startAutoSync = function () {
    hookWake();                    /* ★타이머와 별개로 늘 건다 — 이미 돌고 있어도 복귀 수신은 필요하다 */
    if (autoSyncTimer) return;
    autoSyncTimer = setInterval(function () {
      if (!window.BNCP_API || syncing) return;
      if (typeof document !== 'undefined' && document.hidden) return;  /* 안 보는 탭이면 쉰다 */
      syncNow(true);
    }, A.AUTO_SYNC_MS);
  };
  A.stopAutoSync = function () {
    if (autoSyncTimer) { clearInterval(autoSyncTimer); autoSyncTimer = null; }
    syncing = false;   /* 자동수신을 끄면 진행중 표시도 턴다 — 다음 수신이 옛 플래그에 막히지 않게 */
  };

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
        var kind = b.dataset.ok === 'w' ? 'work' : 'crew';
        var arr = kind === 'work' ? S.work : S.crew;
        arr.forEach(function (x) {
          if (x.id === b.dataset.id) {
            /* ★확인 시각을 **시각까지** 찍는다 (v2.51.0) — 종전에는 날짜뿐이라
               「올린 뒤 처리까지 걸린 시간」을 낼 수 없었다. subAt과 같은 꼴(UTC ISO).
               ckAt은 읽는 데가 없던 칸이라 꼴을 바꿔도 깨질 것이 없다. */
            x.st = 'ok'; x.ckAt = A.ckStamp();
            txBack(kind, x);              /* ★확인한 사실을 서버에도 남긴다 */
          }
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
      /* ★날짜·입력자·작업내용·설명을 칠 때마다 모듈 상태에 담는다 — 그래야
         장비 선택 등으로 다시 그려도 안 날아간다 (v2.43.1). */
      if ($('#dDate')) $('#dDate').onchange = function () { dF.date = this.value; };
      if ($('#dBy')) $('#dBy').oninput = $('#dBy').onchange = function () { dF.by = this.value; };
      if ($('#dTask')) $('#dTask').oninput = function () { dF.task = this.value; };
      if ($('#dNote')) $('#dNote').oninput = function () { dF.note = this.value; };
      if ($('#dCat')) $('#dCat').onchange = function () {
        dCat = this.value; dSize = (A.eqSizes(dCat) || [])[0] || ''; A.render();
      };
      if ($('#dSize')) $('#dSize').onchange = function () { dSize = this.value; };
      if ($('#dEqAdd')) $('#dEqAdd').onclick = function () {
        if (!dCat) return;
        var r = Math.max(0, parseInt(val('#dRun'), 10) || 0);
        var bk = Math.max(0, parseInt(val('#dBrk'), 10) || 0);
        var rp = Math.max(0, parseInt(val('#dRep'), 10) || 0);
        if (!r && !bk && !rp) return;   /* ★고장만 있어도 담는다(run=0 허용) */
        dEq.push({ cat: dCat, size: dSize, run: r, brk: bk, rep: rp });
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
        /* ★조 수 입력을 없앴으므로 1로 고정한다 — teams를 참조하는 다른
           계산(A.pplSum 등과는 무관하지만 rollup·집계 쪽 일부)이 있어
           값 자체를 지우지 않는다. */
        var rec = { date: val('#dDate') || A.today(), loc: pkLoc('d'), task: task, teams: 1,
                    ppl: JSON.parse(JSON.stringify(dPpl)), eq: JSON.parse(JSON.stringify(dEq)),
                    by: val('#dBy'), note: val('#dNote') };
        var drow;
        if (dEdit) { drow = A.updDirect(dEdit, rec); dEdit = ''; }
        else drow = A.addDirect(rec);
        txDirect(drow);
        dPpl = { eng: 0, fmn: 0, wkr: 0 }; dEq = [];
        dF = { date: '', by: '', task: '', note: '' };
        A.render();
      };
      if ($('#dCancel')) $('#dCancel').onclick = function () {
        dEdit = ''; dPpl = { eng: 0, fmn: 0, wkr: 0 }; dEq = [];
        dF = { date: '', by: '', task: '', note: '' }; A.render();
      };
      $$('[data-ded]').forEach(function (b) {
        b.onclick = function () {
          var r = S.direct.filter(function (x) { return x.id === b.dataset.ded; })[0];
          if (!r) return;
          dEdit = r.id;
          dPpl = JSON.parse(JSON.stringify(r.ppl || { eng: 0, fmn: 0, wkr: 0 }));
          dEq = JSON.parse(JSON.stringify(r.eq || []));
          /* ★값을 모듈 상태에 담아 두면 렌더가 알아서 채운다 — 종전엔 렌더 뒤에
             DOM에 직접 꽂았는데(장비 선택 등으로 다시 그리면 또 날아갔다). */
          dF = { date: r.date, by: r.by || '', task: r.task, note: r.note || '' };
          A.render();
          window.scrollTo(0, 0);
        };
      });
      $$('[data-ddel]').forEach(function (b) {
        b.onclick = function () {
          A.delDirect(b.dataset.ddel);
          if (dEdit === b.dataset.ddel) {
            dEdit = ''; dPpl = { eng: 0, fmn: 0, wkr: 0 }; dEq = [];
            dF = { date: '', by: '', task: '', note: '' };
          }
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
    $$('[data-plq]').forEach(function (el) {
      el.onchange = function () {
        var lk = A.locKey(planLoc || pkLoc('w')), v = Number(el.value);
        S.plan[lk] = S.plan[lk] || {};
        if (v > 0) S.plan[lk][el.dataset.plq] = v; else delete S.plan[lk][el.dataset.plq];
        txPlan(planLoc || pkLoc('w'), el.dataset.plq, v);
        A.save(); A.render();
      };
    });
    $$('[data-pld]').forEach(function (b) {
      b.onclick = function () {
        var lk = A.locKey(planLoc || pkLoc('w'));
        if (S.plan[lk]) delete S.plan[lk][b.dataset.pld];
        txPlan(planLoc || pkLoc('w'), b.dataset.pld, 0);   /* 0 = 지움 */
        A.save(); A.render();
      };
    });
    if ($('#plClrAll')) $('#plClrAll').onclick = function () {
      if (!confirm(T('pl_clrall_c'))) return;
      var lk = A.locKey(planLoc || pkLoc('w')), _l = planLoc || pkLoc('w');
      Object.keys(S.plan[lk] || {}).forEach(function (k) { txPlan(_l, k, 0); });
      delete S.plan[lk];
      A.save(); A.render();
    };
    $$('[data-mst]').forEach(function (el) {
      /* ★v2.22.3 — 종전에는 필터(flt)에 저장했다. 표가 위치별로 갈린 지금
         그러면 P3-1 줄에 넣은 재고가 필터 위치에 들어간다. 그 줄의 위치에 넣는다. */
      el.onchange = function () {
        A.setStock(A.keyLoc(el.dataset.mstl) || flt, el.dataset.mst, el.value);
        txCfgAll();                        /* ★재고도 서버로 (v2.46.0) */
        A.render();
      };
    });
    if ($('#mtCsv')) $('#mtCsv').onclick = function () {
      A.dl(T('t4') + '.csv', A.toCSV(
        [T('u_sec'), T('c_grp'), T('c_sub'), T('c_mat'), T('c_spec'), T('c_unit'),
         T('sp_plan'), T('m_req'), T('m_stock'), T('m_iss')],
        A.matRows(flt).map(function (a) {
          return [A.locShort(a.loc), a.grp, a.sub, a.mat, a.spec, a.unit, a.design, a.req,
                  a.stock == null ? '' : a.stock, a.iss];
        })));
    };
    $$('[data-gb]').forEach(function (b) {
      b.onclick = function () {
        var v = b.dataset.gb.split('|');
        A._grpBy(v[0], v[1]);
        A.render();
      };
    });
    if ($('#locCsv')) $('#locCsv').onclick = function () {
      var out = [];
      S.work.forEach(function (w) {
        if (w.st !== 'ok' || !A.locMatch(w, flt) || !A.inDate(w) || !A.inCo(w)) return;
        var e = A.item(w.key); if (!e) return;
        var sp = (w.spot && w.spot.kind === 'road' && window.BNCP_SPOT)
          ? window.BNCP_SPOT.label(w.spot) : (w.tag || '');   /* 표기도 내려받는다 */
        out.push([w.date, A.locLabel(w.loc), sp, e.code || w.key, A.trW(e.name), e.unit, w.qty, w.by || '']);
      });
      A.dl(T('sp_loc') + '.csv', A.toCSV(
        [T('date'), T('loc'), 'STA', T('c_code'), T('work'), T('c_unit'), T('th_out'), T('vd_name')], out));
    };
    /* 공구 줄을 누르면 그 공구로 조회가 걸린다 — 상세는 아래 표에서 본다 */
    $$('[data-sloc]').forEach(function (el) {
      el.onclick = function (ev) {
        if (ev.target.closest && ev.target.closest('.lk')) return;   /* 숫자는 탭 이동 */
        var r = A.siteRows(flt).filter(function (o) { return o.key === el.dataset.sloc; })[0];
        if (!r) return;
        A.setFlt({ s: r.loc.s, p: r.loc.p || 0, c: r.loc.c || 0, t: r.loc.t || '', b: r.loc.b || 0 });
        A.render(); window.scrollTo(0, 0);
      };
    });
    /* 밀린 건수를 누르면 그 공구가 걸린 채 해당 탭으로 간다 */
    $$('[data-sgo]').forEach(function (b) {
      b.onclick = function (ev) {
        ev.stopPropagation();
        var v = b.dataset.sgo.split('|');
        var r = A.siteRows(flt).filter(function (o) { return o.key === v[0]; })[0];
        if (r) A.setFlt({ s: r.loc.s, p: r.loc.p || 0, c: r.loc.c || 0, t: r.loc.t || '', b: r.loc.b || 0 });
        A.go(+v[1]);
      };
    });
    if ($('#capTrim')) $('#capTrim').onclick = function () {
      if (!confirm(T('cap_trim_c').replace('{d}', A.KEEP_DAYS))) return;
      var r = A.trim(A.KEEP_DAYS);
      S.trimMsg = T('cap_trimmed').replace('{n}', r.n).replace('{d}', r.cut);
      A.save(); A.render();
    };
    if ($('#mtAddT')) $('#mtAddT').onclick = function () { matAddOpen = !matAddOpen; A.render(); };
    if ($('#mtAdd')) $('#mtAdd').onclick = function () {
      var nm = val('#mtName'), q = numv('#mtQty');
      if (!nm || !q) return say('#mtMsg', T('eq_need'), false);
      var row = A.addExtraMat({ loc: pkLoc('w'), mat: nm, spec: val('#mtSpec'),
                                unit: val('#mtUnit'), qty: q });
      txBack('mat', row);
      A.render();
      setTimeout(function () { say('#mtMsg', T('eq_added'), true); }, 30);
    };
    $$('[data-sbgo]').forEach(function (b) {
      b.onclick = function () { A.go(+b.dataset.sbgo); };
    });
    /* ★띠 칸 → 그 카드로 굴려 준다 (v2.19.17). 탭은 안 옮긴다 — 셋 다 탭1이다.
       카드가 없으면(자료가 없어 안 그려졌으면) 아무 일도 안 한다. */
    $$('[data-sbcd]').forEach(function (b) {
      function go() {
        var el = $('#' + b.dataset.sbcd);
        if (!el || !el.scrollIntoView) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      b.onclick = go;
      b.onkeydown = function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
      };
    });
    /* ★옛 [지급]/[미지급] 직행 단추(data-mtiss·data-mtno)를 없앴다 (v2.20.0).
       스탭 검토도 관리자 확인도 건너뛰고 곧바로 지급되던 자리다.
       남겨 두면 흐름을 우회하는 뒷문이 된다 — 결재는 data-fgo 하나로만 간다. */
    if ($('#plAddT')) $('#plAddT').onclick = function () { planAddOpen = !planAddOpen; A.render(); };
    if ($('#plAdd')) $('#plAdd').onclick = function () {
      var k = val('#plKey'), q = numv('#plQty');
      if (!k || !q) return say('#plAddMsg', T('eq_need'), false);
      var loc = planLoc || pkLoc('w'), lk = A.locKey(loc);
      S.plan[lk] = S.plan[lk] || {};
      S.plan[lk][k] = q;                 /* 있으면 덮어쓴다 — 중복 줄을 안 만든다 */
      txPlan(loc, k, q);
      A.save(); A.render();
      setTimeout(function () { say('#plAddMsg', T('eq_added'), true); }, 30);
    };
    bindBoq(); setupBind(); rngBind(); eqTableBind();
    /* ★bindRo는 따로 부른다 — 장비표 안에 두면 그 표를 감출 때 같이 죽는다 */
    bindRo();
    if ($('#planFile')) $('#planFile').onchange = function (ev) {
      var f = ev.target.files[0]; if (!f) return;
      /* ★파일명으로 위치를 정한다 (v2.18.2 사용자 지시).
         상단 필터는 보지 않는다 — 위를 안 바꾸고 올려 엉뚱한 곳에
         저장되던 사고가 있었다. 못 정하면 묻고, 답하기 전에는 안 넣는다. */
      var det = A.locFromName(f.name);
      if (!det.ok) { planAsk(f, det); ev.target.value = ''; return; }
      /* ★읽는 일은 planReadInto 한 곳에만 둔다 (v2.18.4).
         종전에는 같은 로직이 여기와 planReadInto 두 벌 있었다. 한쪽만
         고치면 「파일명으로 바로 들어간 것」과 「물어보고 들어간 것」이
         서로 다르게 동작한다. 실제로 서버 전송이 한쪽에만 붙을 뻔했다. */
      planLoc = det.loc;
      planReadInto(f, det.loc);
    };
    /* 물어본 위치를 고르면 그때 읽는다 */
    if ($('#pkAskGo')) $('#pkAskGo').onclick = function () {
      var v = val('#pkAskSel');
      if (!v || !planAskFile) return;
      planLoc = A.locFromKey ? A.locFromKey(v) : JSON.parse(v);
      var f = planAskFile;
      planAskFile = null; planAskDet = null;
      planReadInto(f, planLoc);
    };
    if ($('#pkAskNo')) $('#pkAskNo').onclick = function () {
      planAskFile = null; planAskDet = null; A.render();
    };
    if ($('#syncAll')) $('#syncAll').onclick = function () {
      if (!confirm(T('sync_all_c'))) return;
      syncNow(false, true);
    };
    if ($('#syncBtn')) $('#syncBtn').onclick = function () { syncNow(false); };
    bindDetail();
    if ($('#lgOut')) $('#lgOut').onclick = function () { A.setRole(''); A.render(); };
    $$('[data-mtstep]').forEach(function (el) {
      el.onchange = function () { A.mtSet(el.dataset.mtstep, el.value, null); txCfgAll(); A.render(); };
    });
    $$('[data-eqo]').forEach(function (el) {
      el.onclick = function () { eqOpen[el.dataset.eqo] = !eqOpen[el.dataset.eqo]; A.render(); };
    });
    $$('[data-mtwhy]').forEach(function (el) {
      el.onchange = function () { A.mtSet(el.dataset.mtwhy, null, el.value); txCfgAll(); };
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
    $$('[data-ckok]').forEach(function (b) {
      b.onclick = function () {
        var w = null;
        S.work.forEach(function (x) { if (x.id === b.dataset.ckok) w = x; });
        if (w) { w.ckOk = 1; txBack('work', w); A.save(); A.render(); }
      };
    });
    /* ★반려 — 협력업체가 고쳐서 다시 올린다 (v2.18.8 사용자 지시).
       ★지우지 않는다. st를 'rej'로 되돌리고 사유를 남긴다. 지워 버리면
         업체가 무엇을 왜 고쳐야 하는지 알 수 없고, 기록도 사라진다.
       ★ckOk를 세워 이 목록에서는 빠진다 — 반려도 「처리한 것」이다.
         대신 확인 대기와 독촉 대상으로 넘어간다. */
    $$('[data-ckno]').forEach(function (b) {
      b.onclick = function () {
        var w = null;
        S.work.forEach(function (x) { if (x.id === b.dataset.ckno) w = x; });
        if (!w) return;
        var why = prompt(T('ck_no_ask'), w.rejWhy || '');
        if (why === null) return;
        w.st = 'rej'; w.ckOk = 1; w.rejWhy = why || ''; w.rejAt = A.today();
        txBack('work', w);
        A.save(); A.render();
      };
    });
    /* ★진행 중 작업을 세우고(중단) 다시 잇는다(재개) — 스탭·관리자 (v2.38.0).
       사유를 고르면 그 자리에서 중단된다. 목록은 openTasks가 결정적이라
       렌더 때와 같은 색인으로 그 작업을 다시 집는다. */
    $$('[data-stop]').forEach(function (sel) {
      sel.onchange = function () {
        if (!sel.value) return;
        var t = A.openTasks(flt)[+sel.dataset.stop]; if (!t) return;
        var r = A.addStop({ tk: t.tk, loc: t.loc, key: t.key, seg: t.seg, why: sel.value, by: S.me || '' });
        if (r) txBack('stop', r);
        A.render();
      };
    });
    $$('[data-resume]').forEach(function (b) {
      b.onclick = function () {
        var t = A.openTasks(flt)[+b.dataset.resume]; if (!t) return;
        var s = A.resumeStop(t.tk, A.today());
        if (s) txBack('stop', s);
        A.render();
      };
    });
    if ($('#vdFile')) $('#vdFile').onchange = function () {
      var f = this.files && this.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        var r = A.vendLoad(rd.result);
        txVendAll();                     /* ★CSV 업로드도 서버로 — 모바일도 받는다 (v2.45.1) */
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
        A.save(); txCfgAll();            /* ★시설 계수도 서버로 (v2.47.0) */
        A.render();
      };
    }

    /* 장비 지급대장 */
    $$('[data-copick]').forEach(function (el) {
      el.onchange = function () { coPick[el.dataset.copick] = el.value; };
    });
    if ($('#isFile')) $('#isFile').onchange = function (ev) {
      var f = ev.target.files[0]; if (!f) return;
      var loc = pkLoc('w');            /* ★준비는 화면에 고른 위치를 따른다 */
      /* ★업체를 고르지 않으면 올리지 않는다 (v2.19.14) — 파일에 업체명이
         없어 나중에 붙일 방법이 없다. 업체 없이 들어간 줄은 어느 업체 것인지
         영영 알 수 없게 된다. */
      var co = val('#isCo');
      if (!co) { ev.target.value = ''; say('#isMsg', T('e_pickco'), false); return; }
      readFile(f, function (rows) {
        /* ★형식을 가리지 않는다 (v2.19.12 사용자 지시) — 4열 양식이든
           장비가 가로로 펼쳐진 현장 일일표든 읽는다. */
        var r = A.readEquipFile(rows, loc, A.today(), co);
        var m = co + ' · ' + A.locLabel(loc) + ' — ' + T('r_read') + ' ' + r.ok + T('u_row');
        if (r.wide) m += ' · ' + T('r_wide');
        if (r.near && r.near.length) m += ' · ' + T('r_near') + ' ' + r.near.length + T('u_ea') +
          ' (' + r.near.slice(0, 2).join(' / ') + ')';
        if (r.miss.length) m += ' · ' + T('r_noeq') + ' ' + r.miss.length + T('u_ea') + ' (' + r.miss.slice(0, 3).join(', ') + ')';
        txCfgAll();                      /* ★지급장비 대장도 서버로 (v2.46.0) */
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

    if ($('#pgLoc')) $('#pgLoc').onchange = function () { progLoc = this.value; A.render(); };
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
    /* ★처리완료 펼치기/접기 (v2.24.0 · 요청 10) */
    $$('[data-idone]').forEach(function (b) {
      b.onclick = function () { iDone = !iDone; A.render(); };
    });
    $$('[data-iready]').forEach(function (b) {
      b.onclick = function () { txBack('insp', A.setInsp(b.dataset.iready, 'ready')); A.render(); };
    });
    /* ★오전 마무리 예외 확인 (v2.31.0 · 요청 ⑤) — 검측 신청의 딱지를 풀어
       다음 단계로 넘어갈 수 있게 한다. 확인 사실을 서버에도 남긴다. */
    $$('[data-excok]').forEach(function (b) {
      b.onclick = function () {
        A.excOK(b.dataset.excok);
        var r = S.insp.filter(function (x) { return x.id === b.dataset.excok; })[0];
        if (r) txBack('insp', r);
        A.render();
      };
    });
    $$('[data-ist]').forEach(function (sel) {
      sel.onchange = function () {
        var st = sel.value, reason = '';
        if (A.inspNeedReason(st)) {
          reason = prompt(st === 'fail' ? T('p_fail') : T('p_delay'), '');
          if (reason == null || !reason.trim()) { A.render(); return; }
        }
        txBack('insp', A.setInsp(sel.dataset.ist, st, reason)); A.render();
      };
    });
    $$('[data-ire]').forEach(function (b) {
      b.onclick = function () { txBack('insp', A.reInsp(b.dataset.ire)); A.render(); };
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
    /* ★옛 [완료] 토글(data-sdone)을 없앴다 (v2.20.0).
       참·거짓 하나로는 「측량팀이 못 했다」와 「스탭이 조치 중이다」를
       구분할 수 없다. 이제 결재 흐름(data-fgo) 하나로 처리한다. */
    $$('[data-fgo]').forEach(function (b) {
      b.onclick = function () {
        var p = String(b.dataset.fgo).split('|');
        var kind = p[0], id = p[1], dir = p[2];
        var r = fRow(kind, id); if (!r) return;
        /* ★어디로 갈지는 여기서 고르지 않는다 — A.FLOW가 정한다(규칙 ①).
           여기서는 「무엇을 물어볼지」만 안다. */
        var ask = FASK[kind + '|' + A.fst(kind, r) + '|' + dir] || {};
        var o = { by: A.role(), as: A.role() };
        if (ask.qty) {
          var q = prompt(T(ask.qty), String(r.iss != null ? r.iss : (r.qty != null ? r.qty : '')));
          if (q === null) return;
          o.qty = Number(q) || 0;
        }
        if (ask.why) {
          var w = prompt(T(ask.why), r.fwhy || '');
          if (w === null) return;
          o.why = w;
        }
        A.flowGo(kind, r, dir, o);
        txBack(kind, fRow(kind, id));
        A.render();
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
        withRng('surv', function () { return A.survList(flt); }).map(function (r) {
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
