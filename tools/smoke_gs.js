/* 서버(Code.gs) 자체 감사 — node tools/smoke_gs.js
   ★Apps Script를 흉내 낸 자리에서 **실제로 돌려 본다.** 글자 대조가 아니다.
     시트를 갈라 놓으면 조회·저장·이관이 모두 달라지므로, 눈으로 못 보는
     서버 쪽은 이렇게라도 돌려 봐야 한다. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; };

/* ── Apps Script 흉내 ─────────────────────────────────── */
function Sheet(name) {
  this._n = name; this._v = [];              /* _v[0]이 머리글 */
}
Sheet.prototype.getName = function () { return this._n; };
Sheet.prototype.setName = function (n) { this._n = n; return this; };
Sheet.prototype.getLastRow = function () { return this._v.length; };
Sheet.prototype.setFrozenRows = function () { return this; };
Sheet.prototype.appendRow = function (r) { this._v.push(r.slice()); };
Sheet.prototype.getRange = function (r, c, nr, nc) {
  const sh = this;
  if (nr == null) { nr = 1; nc = 1; }
  if (nc == null) nc = 1;
  return {
    getValues() {
      const out = [];
      for (let i = 0; i < nr; i++) {
        const row = sh._v[r - 1 + i] || [];
        out.push(row.slice(c - 1, c - 1 + nc));
      }
      return out;
    },
    getValue() { const row = sh._v[r - 1] || []; return row[c - 1]; },
    setValues(vals) {
      for (let i = 0; i < vals.length; i++) {
        while (sh._v.length < r - 1 + i + 1) sh._v.push([]);
        const row = sh._v[r - 1 + i];
        for (let j = 0; j < vals[i].length; j++) row[c - 1 + j] = vals[i][j];
      }
    }
  };
};

function SS() { this._s = []; }
SS.prototype.getSheetByName = function (n) {
  for (const s of this._s) if (s.getName() === n) return s;
  return null;
};
SS.prototype.insertSheet = function (n) { const s = new Sheet(n); this._s.push(s); return s; };
SS.prototype.deleteSheet = function (s) { this._s = this._s.filter(x => x !== s); };
SS.prototype.names = function () { return this._s.map(s => s.getName()); };

const book = new SS();
const cache = {};
const sb = {
  console,
  SpreadsheetApp: { getActiveSpreadsheet: () => book },
  CacheService: {
    getScriptCache: () => ({
      get: k => (k in cache ? cache[k] : null),
      put: (k, v) => { cache[k] = v; },
      remove: k => { delete cache[k]; }
    })
  },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: k => ({ PW_ADMIN: 'A1', PW_STAFF: 'S1', PW_SURVEY: 'V1' }[k] || null)
    })
  },
  ContentService: {
    MimeType: { JSON: 'json' },
    createTextOutput: t => ({ _t: t, setMimeType() { return this; }, getContent() { return this._t; } })
  },
  Utilities: { formatDate: () => '20260822_1200' },
  Session: { getScriptTimeZone: () => 'Asia/Baghdad' },
  Logger: { log() {} }
};
sb.globalThis = sb;
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'Code.gs'), 'utf8'), sb, { filename: 'Code.gs' });

/* ── 심부름 함수 ──────────────────────────────────────── */
const post = b => JSON.parse(sb.doPost({ postData: { contents: JSON.stringify(b) } }).getContent());
const get = p => JSON.parse(sb.doGet({ parameter: p }).getContent());
const sheetRows = n => { const s = book.getSheetByName(n); return s ? s.getLastRow() - 1 : -1; };

/* ══ 1 저장이 종류별 시트로 간다 ═══════════════════════ */
console.log('\n[G1] 저장 — 종류마다 제 시트로 간다');
post({ type: 'work', id: 'w1', date: '2026-08-20', key: 'T-01', qty: 10 });
post({ type: 'work', id: 'w2', date: '2026-08-21', key: 'T-01', qty: 20 });
post({ type: 'crew', id: 'c1', date: '2026-08-21', key: 'T-01', teams: 2 });
post({ type: 'insp', id: 'i1', date: '2026-08-21', key: 'T-01' });
post({ type: 'surv', id: 's1', date: '2026-08-21', key: 'T-01' });
post({ type: 'mat', id: 'm1', date: '2026-08-21', mat: '레미콘' });
post({ type: 'direct', id: 'd1', date: '2026-08-21' });
post({ type: 'plan', id: 'P3-1|T-01', date: '2026-08-21', key: 'T-01', qty: 500 });

ok(sheetRows('work') === 2, `work 시트 2줄 (실제 ${sheetRows('work')})`);
ok(sheetRows('crew') === 1 && sheetRows('insp') === 1 && sheetRows('surv') === 1,
   'crew·insp·surv 각 1줄');
ok(sheetRows('mat') === 1 && sheetRows('direct') === 1 && sheetRows('plan') === 1,
   '★자재는 mat 시트다 — 화면 상자 이름(mreq)과 다르다');

/* ★모르는 종류를 버리지 않는다 */
post({ type: 'zzz', id: 'z1', date: '2026-08-21' });
ok(sheetRows('etc') === 1, '★모르는 종류는 etc로 간다 — 버리지 않는다');

/* ══ 2 upsert가 시트를 갈라도 살아 있다 ═══════════════ */
console.log('\n[G2] upsert — 같은 id면 그 줄을 덮어쓴다');
const up = post({ type: 'work', id: 'w1', date: '2026-08-20', key: 'T-01', qty: 99 });
ok(up.mode === 'update' && sheetRows('work') === 2, '같은 id는 줄이 안 늘어난다');
ok(up.sheet === 'work', '어느 시트에 썼는지 알려준다');
const w1 = get({ action: 'rows', type: 'work' }).rows.filter(r => r.id === 'w1')[0];
ok(w1 && w1.qty === 99, '덮어쓴 값이 조회된다');

/* ★시트마다 캐시가 따로여야 한다. 하나로 쓰면 행번호가 섞여
   **다른 종류의 엉뚱한 줄을 덮어쓴다.** 같은 id를 일부러 두 종류에 넣어 본다. */
post({ type: 'work', id: 'X', date: '2026-08-21', key: 'T-01', qty: 1 });
post({ type: 'insp', id: 'X', date: '2026-08-21', key: 'T-01', qty: 2 });
post({ type: 'work', id: 'X', date: '2026-08-21', key: 'T-01', qty: 7 });
const gx = get({ action: 'rows' }).rows.filter(r => r.id === 'X');
ok(gx.length === 2, `★같은 id라도 종류가 다르면 따로 산다 (${gx.length})`);
ok(gx.filter(r => r.type === 'work')[0].qty === 7 &&
   gx.filter(r => r.type === 'insp')[0].qty === 2,
   '★한쪽을 고쳐도 다른 종류의 줄이 안 다친다 (시트별 캐시)');

/* ══ 3 조회 ═══════════════════════════════════════════ */
console.log('\n[G3] 조회 — type을 주면 그 시트만, 안 주면 합쳐서');
const rw = get({ action: 'rows', type: 'work' });
ok(rw.rows.every(r => r.type === 'work'), 'type=work는 실적만');
ok(rw.rows.length === 3, `work 3줄 (실제 ${rw.rows.length})`);
const all = get({ action: 'rows' });
ok(all.rows.length === 11, `★type 없는 조회가 전부를 합쳐서 준다 (${all.rows.length})`);
ok(all.rows.filter(r => r.type === 'mat').length === 1, '합친 것에 자재도 들어 있다');
ok(get({ action: 'rows', type: 'mat' }).rows.length === 1, 'type=mat은 자재만');

/* ★화면의 증분 수신은 type 없이 부른다. 이 길이 막히면 아무것도 안 내려간다 */
ok(all.count === all.rows.length && all.last, 'count·last가 함께 온다');

/* ══ 4 증분(since) ════════════════════════════════════ */
console.log('\n[G4] 증분 — 수신시각 뒤엣것만');
const mark = get({ action: 'meta' }).last;
ok(!!mark, 'meta가 마지막 수신시각을 준다');
ok(get({ action: 'meta' }).count === 11, `meta의 줄 수가 전체다 (${get({ action: 'meta' }).count})`);
ok(get({ action: 'rows', since: mark }).rows.length === 0, '★그 뒤로 바뀐 게 없으면 0줄');
post({ type: 'surv', id: 's2', date: '2026-08-22', key: 'T-01' });
const inc = get({ action: 'rows', since: mark });
ok(inc.rows.length === 1 && inc.rows[0].id === 's2', '★새로 들어온 것만 내려온다');

/* ══ 5 옛 'data' 시트를 같이 읽는다 (이관 전) ═════════ */
console.log('\n[G5] 이관 전 — 옛 data 시트를 같이 읽는다 (자료가 안 보이는 틈을 안 만든다)');
{
  const old = book.insertSheet('data');
  old.appendRow(sb.COLS);
  const mk = (type, id, date, qty) => ([
    new Date('2026-08-01T00:00:00Z'), type, id, date, 'P3-1', 'T-01', '터파기', 'm3', qty,
    'old', 'ok', JSON.stringify({ id: id, type: type, date: date, qty: qty, loc: { s: 'civil', p: 3, c: 1 } })
  ]);
  old.appendRow(mk('work', 'o1', '2026-08-01', 5));
  old.appendRow(mk('mat', 'o2', '2026-08-01', 6));
  old.appendRow(mk('surv', 'o3', '2026-08-01', 0));

  ok(get({ action: 'rows' }).rows.length === 15, '★옛 줄이 합친 조회에 같이 나온다');
  const ow = get({ action: 'rows', type: 'work' }).rows;
  ok(ow.filter(r => r.id === 'o1').length === 1, '★옛 시트에서도 type으로 걸러진다');
  ok(ow.filter(r => r.id === 'o2').length === 0,
     '★★옛 시트는 종류가 섞여 있으므로 한 번 더 거른다 — 자재가 실적에 안 섞인다');
  ok(get({ action: 'meta' }).count === 15, 'meta도 옛 줄을 센다');
}

/* ══ 6 이관 ═══════════════════════════════════════════ */
console.log('\n[G6] 이관 — splitCheck는 보기만, splitRun이 옮긴다');
{
  const before = book.names().slice();
  const chk = sb.splitCheck();
  ok(/3줄/.test(chk), 'splitCheck가 옛 줄 수를 센다');
  ok(book.getSheetByName('data') != null && sheetRows('data') === 3,
     '★splitCheck는 아무것도 안 바꾼다');
  ok(String(before) === String(book.names()), '★시트 목록도 그대로다');

  const wBefore = sheetRows('work'), all1 = get({ action: 'rows' }).rows.length;
  const log = sb.splitRun();
  ok(/옮긴 줄 3/.test(log), `splitRun이 3줄을 옮긴다 — ${log.split('\n')[0]}`);
  ok(sheetRows('work') === wBefore + 1, '★실적 한 줄이 work 시트로 갔다');
  ok(book.getSheetByName('data') === null, '★옛 이름 data가 사라졌다 — 두 번 안 읽는다');
  ok(book.getSheetByName('data_구판_20260822_1200') != null,
     '★지우지 않고 이름만 바꾼다 — 되돌릴 것이 남아야 한다');

  const all2 = get({ action: 'rows' }).rows.length;
  ok(all2 === all1, `★이관해도 줄 수가 그대로다 (${all1} → ${all2}) — 겹치지도 없어지지도 않는다`);
  ok(get({ action: 'rows', type: 'mat' }).rows.filter(r => r.id === 'o2').length === 1,
     '★옛 자재 줄이 mat 시트에서 조회된다');

  /* ★두 번 돌려도 안 겹친다 */
  ok(/없다/.test(sb.splitRun()), '★다시 돌려도 옮길 것이 없다고 한다');
  ok(get({ action: 'rows' }).rows.length === all1, '★두 번 돌려도 줄 수가 안 는다');
}

/* ══ 7 이관을 되돌린다 ════════════════════════════════ */
console.log('\n[G7] 되돌리기 — 손대기 무섭지 않게');
{
  const un = sb.splitUndo('data_구판_20260822_1200');
  ok(/되돌렸다/.test(un), 'splitUndo가 돈다');
  ok(book.getSheetByName('data') != null, '★옛 이름이 돌아왔다');
  ok(book.getSheetByName('work') === null, '★갈라 놓은 시트는 치워졌다');
  ok(sb.splitUndo() && /이름을 넣어라/.test(sb.splitUndo()), '이름을 안 주면 안 돈다');
}

/* ══ 8 로그인은 그대로 ════════════════════════════════ */
console.log('\n[G8] 로그인 — 종전 그대로 (v2.21.1 [초기화]가 이 길을 쓴다)');
ok(post({ type: 'login', pw: 'A1' }).role === 'admin', '관리자');
ok(post({ type: 'login', pw: 'S1' }).role === 'staff', '스탭');
ok(post({ type: 'login', pw: 'V1' }).role === 'surv', '측량팀');
ok(post({ type: 'login', pw: 'x' }).ok === false, '틀린 비밀번호는 거절');
{
  const gs = fs.readFileSync(path.join(ROOT, 'Code.gs'), 'utf8');
  ok(/PropertiesService/.test(gs) && !/PW_ADMIN\s*=\s*['"]/.test(gs),
     '★서버 코드에 비밀번호가 적혀 있지 않다');
  /* ★배포본과 저장소 사본이 어긋나면 다음 사람이 옛 파일을 올린다.
     실제로 tools/AppsScript_Code.gs가 3단계에 멈춰 있었다. */
  const cp = fs.readFileSync(path.join(ROOT, 'tools/AppsScript_Code.gs'), 'utf8');
  ok(cp === gs, '★tools/AppsScript_Code.gs가 Code.gs와 같다 (사본이 낡지 않았다)');
}

console.log(fail ? `\n✗ 실패 ${fail}건\n` : '\n✓ 전부 통과\n');
process.exit(fail ? 1 : 0);
