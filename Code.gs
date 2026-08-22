/**
 * BNCP 대시보드 API — 4단계 (증분 수신)
 *   · 저장(doPost)  : id가 이미 있으면 그 줄을 덮어쓴다(upsert)
 *   · 조회(doGet)   : ?action=rows&type=work
 *   · 증분(doGet)   : ?action=rows&since=2026-08-19T05:30:00.000Z
 *   · 확인(doGet)   : ?action=meta   → 마지막 수신시각만 돌려준다
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
 * ══ v4에서 바뀐 것 ═══════════════════════════════════════
 *  ★since가 「작업일」을 보고 있었다 → 「수신시각」을 보도록 고쳤다.
 *    어제 작업한 것을 오늘 확인 처리하면 작업일은 어제 그대로다. 그래서
 *    작업일로 걸러내면 그 확인이 다른 PC로 영영 전달되지 않았다.
 *    증분 수신에 필요한 것은 「언제 시트에 들어왔나」이지 「언제 작업했나」가 아니다.
 *  ★action=meta 신설 — 마지막 수신시각만 돌려준다. 내가 가진 것과 같으면
 *    본문을 아예 안 받는다. 응답이 수십 바이트로 끝난다.
 *  ★작업일로 거르는 길은 dateFrom·dateTo로 따로 뒀다(과거 조회용).
 *    since와 뜻이 다르므로 이름을 갈랐다.
 *  ★findRow_가 매번 전체 ID를 읽던 것을 캐시로 바꿨다. 3~4만 줄이 쌓이면
 *    저장할 때마다 시트를 통째로 읽어 눈에 띄게 느려진다.
 */

var SHEET_NAME = 'data';
var COLS = ['수신시각', '종류', 'ID', '작업일', '위치', '공종', '공종명',
            '단위', '수량', '입력자', '상태', '원본JSON'];
var COL_RX = 1;   // 수신시각
var COL_TYPE = 2;
var COL_ID = 3;
var COL_DATE = 4; // 작업일
var COL_JSON = 12;

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(COLS);
    sh.setFrozenRows(1);
  }
  return sh;
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
     캐시가 없어지거나 어긋나도 결과는 항상 맞는다. */
function idMap_(sh) {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('idmap');
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
  try { cache.put('idmap', JSON.stringify(map), 21600); } catch (e2) { }
  return map;
}

function findRow_(sh, id) {
  if (!id) return 0;
  var map = idMap_(sh);
  var at = map[String(id)];
  if (!at) return 0;
  /* 캐시가 어긋났을 수 있으니 그 자리를 한 번 확인한다 */
  if (String(sh.getRange(at, COL_ID).getValue()) === String(id)) return at;
  CacheService.getScriptCache().remove('idmap');
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

    lock.waitLock(20000);
    var sh = getSheet_();
    var row = rowOf_(b, raw);
    var at = findRow_(sh, b.id);

    if (at) {
      sh.getRange(at, 1, 1, COLS.length).setValues([row]);
      return json_({ ok: true, row: at, mode: 'update', rx: iso_(row[0]) });
    }
    sh.appendRow(row);
    var newRow = sh.getLastRow();
    /* 새 줄은 캐시에도 넣어 둔다 — 다음 저장 때 다시 안 읽는다 */
    try {
      var cache = CacheService.getScriptCache();
      var m = cache.get('idmap');
      if (m) {
        var map = JSON.parse(m);
        map[String(b.id)] = newRow;
        cache.put('idmap', JSON.stringify(map), 21600);
      }
    } catch (e4) { }
    return json_({ ok: true, row: newRow, mode: 'insert', rx: iso_(row[0]) });

  } catch (err) {
    return json_({ ok: false, err: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) { }
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};

  /* ── 확인만 — 마지막 수신시각과 줄 수 ──────────────────
     ★바뀐 게 없으면 화면이 본문을 아예 안 받는다. 응답이 수십 바이트다. */
  if (p.action === 'meta') {
    try {
      var sh0 = getSheet_();
      var last0 = sh0.getLastRow();
      if (last0 < 2) return json_({ ok: true, last: '', count: 0 });
      /* 수신시각은 늘 마지막에 쓰인 것이 가장 크지는 않다(덮어쓰기 때문).
         그래서 열 전체에서 가장 큰 값을 찾는다. */
      var rx = sh0.getRange(2, COL_RX, last0 - 1, 1).getValues();
      var mx = '';
      for (var j = 0; j < rx.length; j++) {
        var s = iso_(rx[j][0]);
        if (s > mx) mx = s;
      }
      return json_({ ok: true, last: mx, count: last0 - 1 });
    } catch (err0) {
      return json_({ ok: false, err: String(err0) });
    }
  }

  if (p.action === 'rows') {
    try {
      var sh = getSheet_();
      var last = sh.getLastRow();
      if (last < 2) return json_({ ok: true, count: 0, rows: [], last: '' });

      var vals = sh.getRange(2, 1, last - 1, COLS.length).getValues();
      var out = [], maxRx = '';

      for (var i = 0; i < vals.length; i++) {
        var v = vals[i];
        var rxs = iso_(v[COL_RX - 1]);
        if (rxs > maxRx) maxRx = rxs;

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
      return json_({ ok: true, count: out.length, rows: out, last: maxRx });

    } catch (err) {
      return json_({ ok: false, err: String(err) });
    }
  }

  return json_({ ok: true, msg: 'BNCP API alive', time: new Date().toISOString() });
}
