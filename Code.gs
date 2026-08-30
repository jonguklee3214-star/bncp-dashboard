/**
 * BNCP 대시보드 API — 5단계 (종류별 시트)
 *   · 저장(doPost)  : id가 이미 있으면 그 줄을 덮어쓴다(upsert)
 *   · 조회(doGet)   : ?action=rows&type=work
 *   · 증분(doGet)   : ?action=rows&since=2026-08-19T05:30:00.000Z
 *   · 확인(doGet)   : ?action=meta   → 마지막 수신시각·줄 수
 *   · 로그인(doPost): {type:'login', pw:'...'} → {ok:true, role:'staff'|'admin'|'surv'}
 *
 * ★ 비밀번호는 이 코드에 적지 않는다. 스크립트 속성에 넣는다.
 *   Apps Script 편집기 → 왼쪽 톱니바퀴(프로젝트 설정) → 스크립트 속성 → 속성 추가
 *      PW_STAFF   스탭용 비밀번호
 *      PW_ADMIN   관리자용 비밀번호
 *      PW_SURVEY  측량팀용 비밀번호  ★v2.20.0 신설 — 등록해야 측량팀이 들어온다
 *
 * ★ 코드를 바꾼 뒤에는 [배포] → [배포 관리] → 연필(수정) → 버전 '새 버전' → [배포]
 *   ([새 배포]를 누르면 주소가 바뀌므로 절대 누르지 말 것)
 *
 * ══ v5에서 바뀐 것 — 종류별 시트 (인수인계서 0-Z-3) ════════
 *  ★종전에는 'data' 한 장에 전부 쌓였다. 조회는 시트를 통째로 읽은 뒤
 *    골라냈다. 자재만 봐도 측량·검측·실적을 다 읽었다. 그래서 전체 행수가
 *    늘면 **모든 종류가 같이 느려졌다.** 작업현황은 매일 대량이고 자재·측량은
 *    적은데, 한 통에 섞여 있어 **적게 쌓이는 것이 큰 것에 발목 잡혔다.**
 *  ★이제 종류마다 시트가 따로다. type을 지정한 조회는 그 시트만 읽는다.
 *  ★type이 없는 조회는 여러 시트를 합쳐서 준다 — 화면의 증분 수신이
 *    type 없이 부르므로 이 길이 막히면 아무것도 안 내려간다.
 *  ★upsert는 그대로다. 찾는 범위가 그 종류의 시트 안으로 좁아질 뿐이다.
 *    id는 종류별로 안 겹치므로 갈라도 문제가 없다.
 *  ★옛 'data' 시트는 **이관 전까지 같이 읽는다.** 배포와 이관 사이에
 *    자료가 안 보이는 틈이 생기면 안 된다. 이관(splitRun)이 끝나면
 *    이름이 바뀌므로 그 뒤로는 안 읽는다.
 *  ★이관은 editor에서 손으로 돌린다 — splitCheck() 먼저, splitRun() 나중.
 *    ★돌리기 전에 스프레드시트를 통째로 복제해 둘 것.
 */

/* ★스프레드시트 하나가 담을 수 있는 셀 수. 구글이 정한 한도다.
   ★줄 수가 아니라 **셀** 수다 — 열이 늘면 담을 줄 수가 준다. */
var CELL_CAP = 10000000;

var LEGACY_SHEET = 'data';        /* 옛 통합 시트 — 이관 전까지만 읽는다 */
var ETC_SHEET = 'etc';            /* 아래 표에 없는 종류가 오면 여기로 */

/* ★화면이 실제로 보내는 종류다(assets/js: work·crew·insp·surv·mat·direct·plan).
   ※'mreq'는 화면 안 상자 이름이고 서버로는 'mat'으로 온다 — 헷갈리지 말 것. */
var TYPE_SHEET = {
  work: 'work',      /* 실적            */
  crew: 'crew',      /* 인원·장비       */
  insp: 'insp',      /* 검측            */
  surv: 'surv',      /* 측량            */
  mat: 'mat',        /* 자재신청        */
  direct: 'direct',  /* 직영            */
  plan: 'plan'       /* 설계수량        */
};

var COLS = ['수신시각', '종류', 'ID', '작업일', '위치', '공종', '공종명',
            '단위', '수량', '입력자', '상태', '원본JSON'];
var COL_RX = 1;   // 수신시각
var COL_TYPE = 2;
var COL_ID = 3;
var COL_DATE = 4; // 작업일
var COL_JSON = 12;

/** 종류 → 시트이름. 모르는 종류는 etc로 보낸다(버리지 않는다). */
function sheetName_(type) {
  var t = String(type || '');
  return TYPE_SHEET[t] || ETC_SHEET;
}

/** 이름으로 시트를 얻는다. 없으면 머리글과 함께 만든다. */
function getSheetByName_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(COLS);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** 저장할 시트 — 없으면 만든다 */
function sheetFor_(type) {
  return getSheetByName_(sheetName_(type));
}

/** ★읽을 시트들 — **있는 것만** 준다. 조회하다가 빈 시트를 만들지 않는다.
    옛 'data'가 아직 남아 있으면 같이 읽는다(이관 전 안전장치). */
function readSheets_(type) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var names = [], out = [], i, sh;
  if (type) {
    names.push(sheetName_(type));
  } else {
    for (var k in TYPE_SHEET) {
      if (Object.prototype.hasOwnProperty.call(TYPE_SHEET, k)) names.push(TYPE_SHEET[k]);
    }
    names.push(ETC_SHEET);
  }
  names.push(LEGACY_SHEET);       /* 이관이 끝나면 이름이 바뀌어 여기서 빠진다 */

  var seen = {};
  for (i = 0; i < names.length; i++) {
    if (seen[names[i]]) continue;
    seen[names[i]] = 1;
    sh = ss.getSheetByName(names[i]);
    if (sh) out.push(sh);
  }
  return out;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** 날짜/문자 무엇이 오든 ISO 문자열로 맞춘다.
 *  ★시트의 수신시각은 Date 객체다. 문자열과 그냥 비교하면 엉뚱하게 걸린다. */
function iso_(v) {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString();
  var d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toISOString();
}

/* ── ID → 행번호 캐시 ────────────────────────────────────
   ★종전에는 저장할 때마다 전체 ID 열을 읽었다. 하루 100건이 쌓이면
     몇 만 줄을 매번 읽게 되어 저장이 눈에 띄게 느려진다.
   ★캐시는 6시간만 산다. 틀리면 시트를 다시 읽어 바로잡으므로,
     캐시가 없어지거나 어긋나도 결과는 항상 맞는다.
   ★v5 — 캐시 열쇠를 **시트마다** 따로 둔다. 하나로 쓰면 갈라 놓은 시트끼리
     행번호가 섞여 엉뚱한 줄을 덮어쓴다. */
function cacheKey_(sh) { return 'idmap:' + sh.getName(); }

function idMap_(sh) {
  var cache = CacheService.getScriptCache();
  var key = cacheKey_(sh);
  var hit = cache.get(key);
  if (hit) {
    try { return JSON.parse(hit); } catch (e) { }
  }
  var map = {}, last = sh.getLastRow();
  if (last >= 2) {
    var ids = sh.getRange(2, COL_ID, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      var k = String(ids[i][0]);
      if (k) map[k] = i + 2;
    }
  }
  try { cache.put(key, JSON.stringify(map), 21600); } catch (e2) { }
  return map;
}

function findRow_(sh, id) {
  if (!id) return 0;
  var map = idMap_(sh);
  var at = map[String(id)];
  if (!at) return 0;
  /* 캐시가 어긋났을 수 있으니 그 자리를 한 번 확인한다 */
  if (String(sh.getRange(at, COL_ID).getValue()) === String(id)) return at;
  CacheService.getScriptCache().remove(cacheKey_(sh));
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var ids = sh.getRange(2, COL_ID, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return 0;
}

function rowOf_(b, raw) {
  return [
    new Date(), b.type || '', b.id || '', b.date || '', b.loc || '',
    b.key || '', b.name || '', b.unit || '',
    (b.qty === 0 || b.qty) ? b.qty : '',
    b.by || '', b.st || '', raw
  ];
}

/** 로그인 — 스크립트 속성의 비밀번호와 대조한다 */
function login_(pw) {
  var P = PropertiesService.getScriptProperties();
  var admin = P.getProperty('PW_ADMIN');
  var staff = P.getProperty('PW_STAFF');
  var surv  = P.getProperty('PW_SURVEY');   /* 측량팀 (v2.20.0) */
  pw = String(pw || '');
  if (admin && pw === admin) return { ok: true, role: 'admin' };
  if (staff && pw === staff) return { ok: true, role: 'staff' };
  if (surv  && pw === surv)  return { ok: true, role: 'surv'  };
  return { ok: false };
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json_({ ok: false, err: 'no body' });
    }
    var raw = e.postData.contents;
    var b = JSON.parse(raw);

    /* 로그인은 시트를 건드리지 않으므로 잠금 없이 먼저 처리한다 */
    if (b.type === 'login') return json_(login_(b.pw));

    /* ══ 묶음 저장 (v6 · v2.48.0) ═══════════════════════════
       ★한 줄에 요청 하나였다. 설계수량은 **칸 하나가 한 줄**이라 한 현장에 수백~수천
         요청이 되고, 아래 doPost는 waitLock으로 쓰기를 한 줄로 세운다. 그래서
         받는 데 아주 오래 걸렸다(사용자 확인).
       ★이제 여러 줄을 한 요청으로 받는다. **잠금을 한 번만 잡고**, 시트마다 id 지도를
         한 번만 읽고, 새 줄은 모아서 한 번에 붙인다. 왕복도 잠금도 한 번이다.
       ★단건 갈래(아래)는 그대로 둔다 — 옛 화면이 계속 돌아야 한다.
       ★화면은 meta의 batch:true를 보고서야 이 길을 쓴다. 재배포 전이면 안 쓴다 —
         모르는 종류로 왔다가 etc 시트에 통째로 쌓이면 자료가 뭉개지기 때문이다. */
    if (b.type === 'batch') {
      var rows = b.rows || [];
      if (!rows.length) return json_({ ok: true, n: 0 });
      lock.waitLock(30000);
      var bag = {}, i, r, nm;
      for (i = 0; i < rows.length; i++) {
        r = rows[i];
        if (!r || !r.id) continue;
        nm = sheetName_(r.type);
        if (!bag[nm]) bag[nm] = [];
        bag[nm].push(r);
      }
      var n = 0;
      for (nm in bag) {
        if (!Object.prototype.hasOwnProperty.call(bag, nm)) continue;
        var sh2 = getSheetByName_(nm);
        var map2 = idMap_(sh2);
        var add = [], last2 = sh2.getLastRow();
        for (i = 0; i < bag[nm].length; i++) {
          r = bag[nm][i];
          var row2 = rowOf_(r, JSON.stringify(r));
          var at2 = map2[String(r.id)];
          if (at2) {
            sh2.getRange(at2, 1, 1, COLS.length).setValues([row2]);
          } else {
            add.push(row2);
            /* ★같은 묶음 안에 같은 id가 또 오면 방금 붙일 자리를 가리키게 해 둔다 —
               안 그러면 한 묶음에서 같은 id가 두 줄이 된다. */
            map2[String(r.id)] = last2 + add.length;
          }
          n++;
        }
        if (add.length) {
          sh2.getRange(last2 + 1, 1, add.length, COLS.length).setValues(add);
        }
        /* 행번호가 달라졌다 — 캐시를 지운다(다음에 다시 읽어 바로잡는다) */
        try { CacheService.getScriptCache().remove(cacheKey_(sh2)); } catch (eB) { }
      }
      return json_({ ok: true, n: n, batch: true });
    }

    lock.waitLock(20000);
    var sh = sheetFor_(b.type);          /* ★v5 — 종류에 맞는 시트 */
    var row = rowOf_(b, raw);
    var at = findRow_(sh, b.id);

    if (at) {
      sh.getRange(at, 1, 1, COLS.length).setValues([row]);
      return json_({ ok: true, row: at, sheet: sh.getName(), mode: 'update', rx: iso_(row[0]) });
    }
    sh.appendRow(row);
    var newRow = sh.getLastRow();
    /* 새 줄은 캐시에도 넣어 둔다 — 다음 저장 때 다시 안 읽는다 */
    try {
      var cache = CacheService.getScriptCache();
      var ck = cacheKey_(sh);
      var m = cache.get(ck);
      if (m) {
        var map = JSON.parse(m);
        map[String(b.id)] = newRow;
        cache.put(ck, JSON.stringify(map), 21600);
      }
    } catch (e4) { }
    return json_({ ok: true, row: newRow, sheet: sh.getName(), mode: 'insert', rx: iso_(row[0]) });

  } catch (err) {
    return json_({ ok: false, err: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) { }
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};

  /* ── 확인만 — 마지막 수신시각과 줄 수 ──────────────────
     ★바뀐 게 없으면 화면이 본문을 아예 안 받는다. 응답이 수십 바이트다.
     ★v5 — 시트가 여럿이므로 **전부 훑어** 가장 큰 수신시각을 찾는다.
       읽는 것은 수신시각 한 열뿐이라 본문 조회보다 훨씬 가볍다. */
  if (p.action === 'meta') {
    try {
      var shs0 = readSheets_(p.type || '');
      var mx = '', cnt = 0, s0, last0, rx0, j;
      for (var a = 0; a < shs0.length; a++) {
        s0 = shs0[a];
        last0 = s0.getLastRow();
        if (last0 < 2) continue;
        cnt += last0 - 1;
        rx0 = s0.getRange(2, COL_RX, last0 - 1, 1).getValues();
        for (j = 0; j < rx0.length; j++) {
          var t0 = iso_(rx0[j][0]);
          if (t0 > mx) mx = t0;
        }
      }
      /* ★용량 계기판 (v2.22.5 · 0-Z-4) — 셀 수를 함께 준다.
         ★스프레드시트 한도는 **셀 1,000만 개**다. 12열이니 약 83만 줄이다.
           하루 100줄이면 22년, 500줄이라도 4년이 걸린다 — 그래서 「파일 자동
           추가」는 **아직 만들지 않았다.** 필요해지는 때를 이 숫자가 알려준다.
         ★읽는 것은 시트 크기뿐이다. 자료를 안 읽으므로 거의 공짜다.
         ★한도에 다가가면 무엇을 할지는 0-Z-4에 적어 뒀다. */
      var cells = 0;
      for (var b0 = 0; b0 < shs0.length; b0++) {
        cells += shs0[b0].getMaxRows() * shs0[b0].getMaxColumns();
      }
      /* ★batch:true — 「나는 묶음 저장을 받을 줄 안다」는 알림 (v6 · v2.48.0).
         화면은 이것을 보고서야 묶음으로 보낸다. 재배포하지 않은 서버는 이 칸이
         없으므로 화면이 종전대로 한 줄씩 보낸다 — 재배포 전에도 안 깨진다. */
      return json_({ ok: true, last: mx, count: cnt, batch: true,
                     cells: cells, cellCap: CELL_CAP,
                     cellPct: Math.min(100, Math.round(cells / CELL_CAP * 100)) });
    } catch (err0) {
      return json_({ ok: false, err: String(err0) });
    }
  }

  if (p.action === 'rows') {
    try {
      var shs = readSheets_(p.type || '');
      var out = [], maxRx = '', i, sh, last, vals;

      for (var b2 = 0; b2 < shs.length; b2++) {
        sh = shs[b2];
        last = sh.getLastRow();
        if (last < 2) continue;
        vals = sh.getRange(2, 1, last - 1, COLS.length).getValues();

        for (i = 0; i < vals.length; i++) {
          var v = vals[i];
          var rxs = iso_(v[COL_RX - 1]);
          if (rxs > maxRx) maxRx = rxs;

          /* ★옛 'data' 시트는 종류가 섞여 있으므로 여기서 한 번 더 거른다.
             갈라 놓은 시트는 이미 종류가 하나뿐이라 이 줄을 그냥 지나간다. */
          if (p.type && String(v[COL_TYPE - 1]) !== String(p.type)) continue;

          /* ★since = 수신시각 기준(증분 수신).
             작업일이 아니다 — 어제 작업한 것을 오늘 확인해도 받아야 한다. */
          if (p.since && rxs <= String(p.since)) continue;

          /* 작업일 범위 — 과거 조회용. since와 뜻이 다르므로 이름을 갈랐다. */
          var wd = String(v[COL_DATE - 1] || '');
          if (p.dateFrom && wd && wd < String(p.dateFrom)) continue;
          if (p.dateTo && wd && wd > String(p.dateTo)) continue;

          var o = {};
          try { o = JSON.parse(v[COL_JSON - 1]); } catch (e3) { o = {}; }
          o.id = o.id || v[COL_ID - 1];
          o.type = o.type || v[COL_TYPE - 1];
          o.rx = rxs;                       /* 화면이 다음 since로 쓴다 */
          out.push(o);
        }
      }
      return json_({ ok: true, count: out.length, rows: out, last: maxRx });

    } catch (err) {
      return json_({ ok: false, err: String(err) });
    }
  }

  return json_({ ok: true, msg: 'BNCP API alive', time: new Date().toISOString() });
}

/* ══════════════════════════════════════════════════════════
   이관 — 옛 'data' 시트를 종류별로 옮긴다 (1회성)
   ★editor에서 손으로 돌린다. 웹앱 주소로는 부를 수 없다(일부러 그렇게 뒀다).
   ★순서
       1. 스프레드시트를 통째로 복제해 둔다 (파일 → 사본 만들기)
       2. splitCheck()  — 무엇이 몇 줄인지 **보기만** 한다. 아무것도 안 바꾼다.
       3. splitRun()    — 실제로 옮긴다.
   ★splitRun은 옮긴 뒤 옛 시트 이름을 'data_구판_yyyyMMdd_HHmm'로 바꾼다.
     이름이 바뀌면 readSheets_가 더는 읽지 않는다 — 같은 줄이 두 번 나오지 않는다.
     ★지우지 않고 이름만 바꾼다. 잘못돼도 되돌릴 것이 남아 있어야 한다.
   ══════════════════════════════════════════════════════════ */

/** 옛 시트를 종류별로 세어 본다 — 바꾸는 것 없음 */
function splitCheck() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(LEGACY_SHEET);
  if (!sh) return say_('옛 "' + LEGACY_SHEET + '" 시트가 없다 — 이관할 것이 없거나 이미 끝났다.');

  var last = sh.getLastRow();
  if (last < 2) return say_('옛 시트가 비어 있다 (머리글만).');

  var vals = sh.getRange(2, COL_TYPE, last - 1, 1).getValues();
  var cnt = {}, i, t;
  for (i = 0; i < vals.length; i++) {
    t = String(vals[i][0] || '(빈칸)');
    cnt[t] = (cnt[t] || 0) + 1;
  }
  var lines = ['옛 시트 ' + (last - 1) + '줄 — 옮겨 갈 곳'];
  for (t in cnt) {
    if (Object.prototype.hasOwnProperty.call(cnt, t)) {
      lines.push('  ' + t + '  ' + cnt[t] + '줄  →  시트 "' +
        sheetName_(t === '(빈칸)' ? '' : t) + '"');
    }
  }
  lines.push('');
  lines.push('★이대로 옮기려면 splitRun()을 돌린다. 그 전에 스프레드시트를 복제해 둘 것.');
  return say_(lines.join('\n'));
}

/** 실제로 옮긴다 */
function splitRun() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(LEGACY_SHEET);
    if (!sh) return say_('옛 "' + LEGACY_SHEET + '" 시트가 없다 — 이미 끝났거나 옮길 것이 없다.');

    var last = sh.getLastRow();
    if (last < 2) return say_('옛 시트가 비어 있다 — 옮길 것이 없다.');

    var vals = sh.getRange(2, 1, last - 1, COLS.length).getValues();

    /* 종류별로 모은다 */
    var bag = {}, i, t, name;
    for (i = 0; i < vals.length; i++) {
      name = sheetName_(vals[i][COL_TYPE - 1]);
      if (!bag[name]) bag[name] = [];
      bag[name].push(vals[i]);
    }

    /* ★이미 그 시트에 있는 id는 건너뛴다. 두 번 돌려도 안 겹친다. */
    var log = [], moved = 0, skipped = 0;
    for (name in bag) {
      if (!Object.prototype.hasOwnProperty.call(bag, name)) continue;
      var to = getSheetByName_(name);
      var have = idMap_(to);
      var put = [];
      for (i = 0; i < bag[name].length; i++) {
        var id = String(bag[name][i][COL_ID - 1]);
        if (id && have[id]) { skipped++; continue; }
        put.push(bag[name][i]);
      }
      if (put.length) {
        to.getRange(to.getLastRow() + 1, 1, put.length, COLS.length).setValues(put);
        CacheService.getScriptCache().remove(cacheKey_(to));   /* 행번호가 달라졌다 */
      }
      moved += put.length;
      log.push('  ' + name + '  ' + put.length + '줄');
    }

    /* ★옮긴 뒤에야 이름을 바꾼다. 위에서 터지면 옛 시트가 그대로 남는다. */
    var stamp = Utilities.formatDate(new Date(),
      Session.getScriptTimeZone() || 'Asia/Baghdad', 'yyyyMMdd_HHmm');
    sh.setName(LEGACY_SHEET + '_구판_' + stamp);

    log.unshift('옮긴 줄 ' + moved + ' · 이미 있어 건너뛴 줄 ' + skipped);
    log.push('');
    log.push('옛 시트 이름을 "' + sh.getName() + '"으로 바꿨다. 지우지는 않았다.');
    log.push('★화면에서 [전체 다시 받기]를 한 번 눌러 확인할 것.');
    return say_(log.join('\n'));

  } catch (err) {
    return say_('실패 — ' + String(err) + '\n★옛 시트는 그대로 있다. 다시 돌려도 된다.');
  } finally {
    try { lock.releaseLock(); } catch (e2) { }
  }
}

/** 이관을 되돌린다 — 갈라 놓은 시트를 지우고 옛 시트 이름을 되돌린다.
 *  ★쓸 일이 없기를 바라지만, 되돌릴 길이 없으면 손대기가 무섭다.
 *  ★되돌린 뒤에는 **옛 코드(v4)로 되돌려 배포**해야 앞뒤가 맞는다. */
function splitUndo(oldSheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!oldSheetName) return say_('되돌릴 시트 이름을 넣어라 — 예: splitUndo("data_구판_20260822_1530")');
  var sh = ss.getSheetByName(oldSheetName);
  if (!sh) return say_('"' + oldSheetName + '" 시트를 찾을 수 없다.');
  if (ss.getSheetByName(LEGACY_SHEET)) return say_('"' + LEGACY_SHEET + '"가 이미 있다 — 먼저 치울 것.');

  var names = [], k;
  for (k in TYPE_SHEET) {
    if (Object.prototype.hasOwnProperty.call(TYPE_SHEET, k)) names.push(TYPE_SHEET[k]);
  }
  names.push(ETC_SHEET);
  var gone = [];
  for (var i = 0; i < names.length; i++) {
    var s = ss.getSheetByName(names[i]);
    if (s) { ss.deleteSheet(s); gone.push(names[i]); }
  }
  sh.setName(LEGACY_SHEET);
  try { CacheService.getScriptCache().remove('idmap:' + LEGACY_SHEET); } catch (e) { }
  return say_('되돌렸다. 지운 시트 : ' + (gone.join(', ') || '없음'));
}

function say_(msg) {
  Logger.log(msg);
  return msg;
}

/* ══════════════════════════════════════════════════════════
   ★진단 전용 — 아무것도 바꾸지 않는다. 읽기만 한다.
   화면(assets/js/tabs.js의 unpack)이 줄 하나를 받아들이려면
     0) r.id 가 있어야 한다
     1) r.s 가 'civil' 또는 'anc' 여야 한다 (위치 종류 — 없으면 조용히 버려진다)
     2) type별로 : plan/work/crew/insp/surv는 r.key 필요, mat은 r.mat 필요
   이 중 하나라도 없으면 화면이 그 줄을 **조용히 버린다.** (실측 : surv 5건 중
   1건만 화면에 들어옴 — 2026-08-22 확인)
   ★etc 시트는 애초에 화면에 받는 갈래가 없다. type을 모르는 줄이라 여기
   왔을 뿐이고, 조건을 갖췄어도 화면은 절대 안 받는다 — 따로 표시한다. */
function auditUnpack() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var names = ['work', 'crew', 'insp', 'surv', 'mat', 'direct', 'plan', 'etc'];
  var lines = ['시트별 진단 — 화면이 받아들이는 조건으로 세어 봤다 (아무것도 안 바꿈)'];
  var total = { rows: 0, noId: 0, noS: 0, noKey: 0, ok: 0 };

  for (var n = 0; n < names.length; n++) {
    var sh = ss.getSheetByName(names[n]);
    if (!sh) { continue; }
    var last = sh.getLastRow();
    if (last < 2) { lines.push('  ' + names[n] + '  0줄'); continue; }

    var vals = sh.getRange(2, 1, last - 1, COLS.length).getValues();
    var rows = 0, noId = 0, noS = 0, noKey = 0, ok = 0, sample = null;

    for (var i = 0; i < vals.length; i++) {
      rows++;
      var o = {};
      try { o = JSON.parse(vals[i][COL_JSON - 1]); } catch (e) { o = {}; }

      if (!o.id) { noId++; continue; }

      var hasS = (o.s === 'civil' || o.s === 'anc');
      if (!hasS) {
        noS++;
        if (!sample) sample = o.id + ' → ' + JSON.stringify(o).slice(0, 220);
        continue;
      }

      var needKey = (names[n] === 'plan' || names[n] === 'work' ||
                     names[n] === 'crew' || names[n] === 'insp' || names[n] === 'surv');
      var needMat = (names[n] === 'mat');
      if (needKey && !o.key) { noKey++; continue; }
      if (needMat && !(o.mat)) { noKey++; continue; }
      ok++;
    }

    var tag = (names[n] === 'etc') ? ' (★화면이 애초에 안 받는 시트)' : '';
    lines.push('  ' + names[n] + tag + '  ' + rows + '줄  →  받아들여짐 ' + ok +
      '  ·  위치정보(r.s)없음 ' + noS + '  ·  필수값없음 ' + noKey +
      (noId ? '  ·  id없음 ' + noId : '') +
      (sample ? '\n      예시(위치정보 없는 첫 줄) : ' + sample : ''));

    total.rows += rows; total.noId += noId; total.noS += noS;
    total.noKey += noKey; total.ok += ok;
  }

  lines.push('');
  lines.push('합계 — 전체 ' + total.rows + '줄 · 받아들여짐 ' + total.ok +
    ' · 위치정보 없음 ' + total.noS + ' · 필수값 없음 ' + total.noKey +
    (total.noId ? ' · id 없음 ' + total.noId : ''));
  return say_(lines.join('\n'));
}
