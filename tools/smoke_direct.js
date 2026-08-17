/* 직영 작업(탭7) 자체감사 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fail = 0;
const ok = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fail++; };

const bag = {};
function El(id) {
  return { id, innerHTML: '', textContent: '', value: '', src: '', className: '', style: {}, dataset: {},
    options: [{ text: '' }], files: [], setAttribute() { }, getAttribute() { return null },
    addEventListener() { }, appendChild() { }, remove() { }, select() { },
    closest() { return null }, querySelector() { return null }, querySelectorAll() { return [] } };
}
['logo', 'appt', 'hmeta', 'tabs', 'view', 'fltBox', 'wipe', 'vendorBtn'].forEach(i => bag[i] = El(i));
const sb = {
  console, localStorage: (function(){var st={};return{ getItem:k=>(k in st?st[k]:null), setItem:(k,v)=>{st[k]=String(v);}, removeItem:k=>{delete st[k];} };})(),
  navigator: {}, location: { reload() { } }, alert() { }, confirm: () => false, prompt: () => '',
  Blob: function () { }, URL: { createObjectURL: () => '', revokeObjectURL() { } },
  setTimeout: () => 0, XLSX: null, scrollTo() { },
  document: { documentElement: {}, addEventListener() { }, createElement: () => El('t'),
    body: { appendChild() { } },
    querySelector(s) { const m = /^#([A-Za-z0-9_-]+)$/.exec(s); return m && bag[m[1]] ? bag[m[1]] : null; },
    querySelectorAll() { return []; } }
};
sb.window = sb; vm.createContext(sb);
['version', 'i18n', 'data', 'master', 'materials', 'materials2', 'work_i18n', 'prod',
 'equip', 'core', 'spot', 'api', 'matmaster_api', 'tabs']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js', f + '.js'), 'utf8'), sb, { filename: f }));

const A = sb.APP, S = A.S;
const L1 = { s: 'civil', p: 1, c: 1 };

console.log('\n[D1] 직영 저장소가 협력업체 실적과 분리되어 있다');
ok(Array.isArray(S.direct), 'S.direct 배열 존재');
const w0 = S.work.length, c0 = S.crew.length;
A.addDirect({ date: '2026-07-28', loc: L1, task: '3구간 현장정리 및 폐기물 반출',
              teams: 2, ppl: { eng: 0, fmn: 1, wkr: 6 }, eq: [], by: '이과장' });
ok(S.direct.length === 1, '직영 기록 저장');
ok(S.work.length === w0 && S.crew.length === c0, '협력업체 실적(work/crew)에 섞이지 않음');

console.log('\n[D2] 진행률·생산성 집계에 직영이 들어가지 않는다');
const rate = A.rateRows ? A.rateRows({ s: 'civil', p: 1, c: 1 }) : [];
ok(!rate.some(r => String(r.name || '').includes('현장정리')), '진행률 표에 직영 작업내용 없음');

console.log('\n[D3] 직영 투입 집계');
const sum = A.directSum(null);
ok(sum.rows === 1, '건수 1');
ok(sum.ppl.wkr === 6 && sum.ppl.fmn === 1, '인원 집계 정확 (워커6·포맨1)');

console.log('\n[D4] 수정 · 삭제');
const id = S.direct[0].id;
A.updDirect(id, { task: '4구간 정리', teams: 3 });
ok(S.direct[0].task === '4구간 정리' && S.direct[0].teams === 3, '수정 반영');
ok(S.direct.length === 1, '수정이 새 기록을 만들지 않음');
A.delDirect(id);
ok(S.direct.length === 0, '삭제됨');

console.log('\n[D5] 탭7 렌더 · 언어 전환');
A.addDirect({ date: '2026-07-29', loc: L1, task: '폐기물 반출',
              teams: 1, ppl: { eng: 0, fmn: 0, wkr: 4 }, eq: [], by: 'staff' });
['ko', 'en', 'bn'].forEach(lg => {
  A.setRole('admin'); S.lang = lg; A.go(7);
  const h = bag.view.innerHTML;
  ok(h.length > 200, `${lg} 탭7 렌더됨`);
  ok(h.includes('폐기물 반출'), `${lg} 기록 표시`);
  if (lg !== 'ko') {
    const ui = h.replace(/<[^>]+>/g, ' ').replace(/폐기물|반출/g, '');
    ok(!/[\uac00-\ud7a3]/.test(ui), `${lg} UI 라벨에 한국어 없음`);
  }
});

console.log('\n[D6] 탭7에 공종·검측·측량이 없다 (직영은 검측 대상이 아님)');
A.setRole('admin'); S.lang = 'ko'; A.go(7);
const all = bag.view.innerHTML;
['검측', '측량', '자재'].forEach(w => ok(!new RegExp(w).test(all), `'${w}' 탭7에 없음`));

console.log('\n[D7] 탭 목록에 직영 탭이 노출된다');
ok(/data-tab="7"/.test(bag.tabs.innerHTML), '탭7 버튼 존재');
ok(bag.tabs.innerHTML.includes(A.T('t7')), '탭 이름 표시');

console.log('\n[D8] 별도 직영 화면 파일이 남아 있지 않다 (탭으로 통합)');
ok(!fs.existsSync(path.join(ROOT, 'direct.html')), 'direct.html 없음');
ok(!fs.existsSync(path.join(ROOT, 'assets/js/direct.js')), 'direct.js 없음');

console.log(fail ? `\n✗ 실패 ${fail}건\n` : '\n✓ 전부 통과\n');
process.exit(fail ? 1 : 0);
