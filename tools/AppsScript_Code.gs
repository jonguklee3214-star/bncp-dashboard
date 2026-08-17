/**
 * BNCP 대시보드 API — 3단계 (로그인 추가)
 *   · 저장(doPost)  : id가 이미 있으면 그 줄을 덮어쓴다(upsert)
 *   · 조회(doGet)   : ?action=rows&type=work
 *   · 로그인(doPost): {type:'login', pw:'...'} → {ok:true, role:'staff'|'admin'}
 *
 * ★ 비밀번호는 이 코드에 적지 않는다. 스크립트 속성에 넣는다.
 *   Apps Script 편집기 → 왼쪽 톱니바퀴(프로젝트 설정) → 스크립트 속성 → 속성 추가
 *      PW_STAFF   스탭용 비밀번호
 *      PW_ADMIN   관리자용 비밀번호
 *   이렇게 하면 화면 소스를 뜯어봐도 비밀번호가 나오지 않는다.
 *   비밀번호를 바꿀 때도 속성만 고치면 되고 재배포가 필요 없다.
 *
 * ★ 코드를 바꾼 뒤에는 [배포] → [배포 관리] → 연필(수정) → 버전 '새 버전' → [배포]
 *   ([새 배포]를 누르면 주소가 바뀌므로 절대 누르지 말 것)
 */

var SHEET_NAME = 'data';
var COLS = ['수신시각', '종류', 'ID', '작업일', '위치', '공종', '공종명',
            '단위', '수량', '입력자', '상태', '원본JSON'];
var COL_ID = 3;

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

function findRow_(sh, id) {
  if (!id) return 0;
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
  pw = String(pw || '');
  if (admin && pw === admin) return { ok: true, role: 'admin' };
  if (staff && pw === staff) return { ok: true, role: 'staff' };
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
      return json_({ ok: true, row: at, mode: 'update' });
    }
    sh.appendRow(row);
    return json_({ ok: true, row: sh.getLastRow(), mode: 'insert' });

  } catch (err) {
    return json_({ ok: false, err: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};

  if (p.action === 'rows') {
    try {
      var sh = getSheet_();
      var last = sh.getLastRow();
      if (last < 2) return json_({ ok: true, count: 0, rows: [] });

      var vals = sh.getRange(2, 1, last - 1, COLS.length).getValues();
      var out = [];
      for (var i = 0; i < vals.length; i++) {
        var v = vals[i];
        if (p.type && String(v[1]) !== String(p.type)) continue;
        if (p.since && String(v[3]) < String(p.since)) continue;
        var o = {};
        try { o = JSON.parse(v[11]); } catch (e3) { o = {}; }
        o.id = o.id || v[2];
        o.type = o.type || v[1];
        out.push(o);
      }
      return json_({ ok: true, count: out.length, rows: out });

    } catch (err) {
      return json_({ ok: false, err: String(err) });
    }
  }

  return json_({ ok: true, msg: 'BNCP API alive', time: new Date().toISOString() });
}
