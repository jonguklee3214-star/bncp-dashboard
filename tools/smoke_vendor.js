/* 협력업체 입력 화면 자체 감사 — node tools/smoke_vendor.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const bag = {};
function El(id) {
  return { id, innerHTML: '', textContent: '', value: '', className: '', style: {}, dataset: {},
    options: [{ text: '' }], files: [], setAttribute() {}, getAttribute() { return null; },
    addEventListener() {}, appendChild() {}, remove() {}, select() {},
    closest() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; } };
}
['vTabs','vLoc','vBody','vMine','vMsg','vSave','vVer','vDate','vQty','vBy','vTeams','vNote','vWhy']
  .forEach(i => bag[i] = El(i));
const store = {};
const sb = { console,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k,v)=>{store[k]=String(v);}, removeItem: k=>{delete store[k];} },
  navigator:{}, location:{reload(){}}, alert(m){throw new Error(m);}, confirm:()=>false, prompt:()=>'x',
  Blob:function(){}, URL:{createObjectURL:()=>'',revokeObjectURL(){}}, setTimeout:()=>0, XLSX:null, scrollTo(){},
  document:{ documentElement:{}, addEventListener(){}, createElement:()=>El('t'), body:{appendChild(){}},
    querySelector(s){ const m=/^#([A-Za-z0-9_-]+)$/.exec(s); return m && bag[m[1]] ? bag[m[1]] : null; },
    querySelectorAll(){ return []; } } };
sb.window = sb; vm.createContext(sb);
['version','i18n','data','master','materials','materials2','work_i18n','prod','equip','core','spot','api','matmaster_api','vendor']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT,'assets/js',f+'.js'),'utf8'), sb, {filename:f}));

const A = sb.APP, S = A.S, V = sb.VENDOR;
let fail = 0;
const ok = (c,m)=>{ console.log((c?'  ok   ':'  FAIL ')+m); if(!c) fail++; };

console.log('\n[V1] 협력업체 화면 렌더');
const TABS = ['work','crew','insp','surv','mat'];
TABS.forEach(t => {
  try {
    // 탭 전환은 내부 상태라 render 후 innerHTML 확인
    V.render();
    ok(bag.vBody.innerHTML.length > 100, `기본 탭 렌더 ${bag.vBody.innerHTML.length}자`);
  } catch(e){ ok(false, `렌더 예외: ${e.message}`); }
});

console.log('\n[V2] 영어/아랍어 병기');
V.render();
const h = bag.vBody.innerHTML + bag.vTabs.innerHTML;
ok(/class="bi"/.test(h), '병기 라벨 구조 있음');
ok(/class="ar"/.test(h), '아랍어 span 있음');
ok(/[\u0600-\u06FF]/.test(h), '아랍 문자 실제 출력됨');
ok(!/[가-힣]/.test(bag.vBody.innerHTML.replace(/<option[^>]*>[^<]*<\/option>/g,'')),
   '입력 라벨에 한국어 없음');

/* ★드롭다운 안까지 본다 (v2.18.3 사용자 지적).
   종전 검사는 <option>을 통째로 빼고 봤다. 그런데 자재 대분류·세부공종이
   바로 그 <option>이라, 한국어 원문이 그대로 나가는 것을 못 잡았다.
   검사가 문제 지점을 비껴가고 있었다. */
/* ★탭은 V.state.tab이다 — V.tab에 넣으면 아무 일도 안 일어난다.
   종전 검사가 이걸 몰라 늘 첫 탭만 보고 통과했다. */
TABS.forEach(function (t) {
  V.state.tab = t; V.render();
  /* ★보이는 글자만 본다. value 속성의 한국어는 조회 키라 바꾸면 안 된다 —
     값을 영어로 바꾸면 matItems·itemsOf 조회가 어긋나 목록이 통째로 빈다. */
  const labels = [...bag.vBody.innerHTML.matchAll(/<option[^>]*>([^<]*)<\/option>/g)]
    .map(m => m[1]);
  const kr = labels.filter(x => /[가-힣]/.test(x));
  ok(kr.length === 0,
     `${t} 탭 드롭다운 글자에 한국어 없음${kr.length ? ' ★' + [...new Set(kr)].slice(0,5).join(' / ') : ''}`);
});
V.state.tab = 'work';

console.log('\n[V2-2] 입력 폼 기본 날짜 — 전부 오늘 (v2.19.13)');
{
  /* ★v2.18.9에서 「실적은 어제 · 투입은 오늘」로 갈랐는데 **업체 폼은
     둘 다 어제**로 남아 있었다. 업체가 기본값 그대로 인원·장비를 올리면
     어제 날짜로 저장돼, 오늘 기준인 관리자 인원·장비 표에 영영 안 나온다
     (「오늘 투입 인원 0명 · 장비 0대」의 원인 — 사용자 캡처). */
  function dateVal(tab) {
    V.state.tab = tab; V.render();
    const m = /id="vDate"[^>]*value="([\d-]+)"/.exec(bag.vBody.innerHTML);
    return m ? m[1] : '';
  }
  /* ★v2.19.13에서 오늘로 바꿨다 — 작업량 표를 오늘로 통일했으므로 폼도 같이다.
     한쪽만 바꾸면 올린 실적이 표에 안 나온다(0-H와 같은 사고). */
  ok(dateVal('work') === A.today(), '★실적도 오늘이다 (반영된 날이 기준)');
  ok(dateVal('crew') === A.today(), '★인원·장비는 오늘이다 (투입은 아침에 정해진다)');
  ok(dateVal('surv') === A.today(), '측량은 종전대로 오늘');
  ok(dateVal('mat') === A.today(), '자재는 종전대로 오늘');
  V.state.tab = 'work';
}

console.log('\n[V3] 위치는 항상 영문');
ok(/Phase 1/.test(bag.vLoc.innerHTML), 'Phase 표기');
ok(/Site Civil|Ancillary/.test(bag.vLoc.innerHTML), '공사구분 영문');

console.log('\n[V4] 입력 → 저장 (관리자 화면과 같은 저장소)');
const before = { w:S.work.length, c:S.crew.length, i:S.insp.length, s:S.surv.length, m:S.mreq.length };
// 실적
const item = A.itemsOf('civil','토공')[0];
S.work.push({ id:A.uid(), date:'2026-07-27', loc:{s:'civil',p:1,c:1}, key:item.key, qty:100, by:'업체', st:'sub' });
ok(S.work.length === before.w+1, '실적 저장 st=sub (스탭 확인 전)');
ok(S.work[S.work.length-1].st === 'sub', '기본 상태는 제출(sub) — 확인 전엔 진행률 미반영');
ok(A.actQty(item.key, {s:'civil',p:1,c:1}) === 0, '확인 전 진행률 0');
S.work[S.work.length-1].st = 'ok';
ok(A.actQty(item.key, {s:'civil',p:1,c:1}) === 100, '스탭 확인 후 100 반영');

console.log('\n[V5] 검측 신청 규칙 (당일 실적 있어야)');
const hasWork = S.work.some(w => w.date==='2026-07-27' && w.key===item.key);
ok(hasWork, '같은 날 실적 존재 → 검측 신청 가능 조건 충족');
S.insp.push({ id:A.uid(), date:'2026-07-27', loc:{s:'civil',p:1,c:1}, key:item.key, qty:100, st:'apply', seq:1, hist:[] });
ok(S.insp[S.insp.length-1].st === 'apply', '검측은 신청(apply)로 들어감 — 스탭 완료확인 대기');

console.log('\n[V6] 자재 신청');
const m = A.MAT2[0];
A.addMreq({ date:'2026-07-27', loc:{s:'civil',p:1,c:1}, grp:m.grp, sub:m.sub, mat:m.mat,
            spec:m.spec, unit:m.unit, plant:m.plant, qty:50, by:'업체' });
ok(S.mreq.length === before.m+1, '자재 신청 저장');
ok(S.mreq[S.mreq.length-1].st === 'req', '상태 req — 스탭 승인 대기');

console.log('\n[V7] 관리 기능 노출 안 됨');
const all = bag.vBody.innerHTML + bag.vTabs.innerHTML + bag.vMine.innerHTML;
['진행률','공정표','승인','증감','생산성','지급대조'].forEach(w => {
  ok(!new RegExp(w).test(all), `'${w}' 협력업체 화면에 없음`);
});

console.log('\n[V8] 공종·자재·규격 — 협력업체 화면은 저장된 언어와 무관하게 항상 영문');
{
  /* ★ v2.8.2 이전에는 규격(spec)을 '치수는 원문' 이라며 예외로 빼두었다.
     실제로는 '모래기초360˚' 처럼 공법 설명이 섞여 있어 한국어가 그대로 노출됐다.
     예외를 없애고 규격도 번역 대상으로 본다. 순수 치수·기호만 남아야 한다. */
  /* ★ 'ko'가 핵심이다. 협력업체 화면은 관리자 화면과 localStorage를 공유하므로
     관리자가 한국어로 쓰면 S.lang='ko'가 저장된다. 그 상태에서도 영문이어야 한다. */
  ['ko', 'en', 'bn'].forEach(lg => {
    S.lang = lg; V.render();
    const h = bag.vBody.innerHTML.replace(/<[^>]+>/g, ' ');
    const words = [...new Set(h.match(/[가-힣]+/g) || [])];
    ok(words.length === 0, `S.lang=${lg} 일 때 협력업체 화면 한국어 ${words.length ? words.slice(0, 8).join(',') : '없음'}`);
  });
  S.lang = 'ko'; V.render();

  // 재발 방지 — 이 화면에서 인자 없는 trW/trM/trS 호출이 남아 있으면 안 된다
  const vsrc = fs.readFileSync(path.join(ROOT, 'assets/js/vendor.js'), 'utf8');
  const bare = (vsrc.match(/A\.tr[WMS]\((?!\s*[a-zA-Z_$][\w$.()\[\] ]*,\s*'en')/g) || []);
  ok(bare.length === 0, bare.length ? `인자 없는 trW/trM/trS ${bare.length}곳 남음` : '표시 번역은 전부 영어 강제(tw/tm/ts)');

  // 규격 번역 자체가 제대로 도는지 — 마스터 전수
  const left = A.LIST.filter(e => /[가-힣]/.test(A.trS(e.spec, 'en') || ''));
  ok(left.length === 0, left.length ? `규격 미번역 ${left.length}건 (예: ${left[0].spec})` : `규격 ${A.LIST.length}건 전부 번역됨`);
}

console.log('\n[V9] 서버 전송 계층 — 전송이 안 돼도 로컬 저장은 남아야 한다');
{
  const API = sb.BNCP_API;
  ok(!!API, 'BNCP_API 로드됨');
  ok(/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(API.url), '배포 주소 형식 정상');
  ok(typeof API.send === 'function', 'send() 있음');

  // 전송 수단이 없는 환경(fetch 없음)에서도 예외 없이 넘어가야 한다
  const n0 = S.work.length;
  let threw = false;
  try { API.send('work', { id: 'x', qty: 1 }); } catch (e) { threw = true; }
  ok(!threw, 'fetch 없는 환경에서 예외 없음');
  ok(API.log.length > 0, '전송 시도가 로그에 남음');
  ok(API.log[API.log.length - 1].ok === false, '전송 수단 없으면 실패로 기록');
  ok(S.work.length === n0, '전송 실패가 로컬 저장을 건드리지 않음');

  // 협력업체 화면의 실적 제출이 서버 전송을 호출하는지 (소스 확인)
  const vsrc = fs.readFileSync(path.join(ROOT, 'assets/js/vendor.js'), 'utf8');
  ok(/toServer\('work'/.test(vsrc), '실적 제출에 서버 전송 연결됨');
  ok(/try\s*{[\s\S]*api\.send/.test(vsrc), '전송이 try로 감싸져 입력이 날아가지 않음');
}

console.log('\n[V10] 전송 상태 표시·재전송·중복 차단');
{
  const vsrc = fs.readFileSync(path.join(ROOT, 'assets/js/vendor.js'), 'utf8');
  ok(/function\s+upBadge/.test(vsrc), '전송 상태 배지 있음');
  ok(/function\s+pending/.test(vsrc), '미전송 목록 집계 있음');
  ok(/function\s+retryAll/.test(vsrc), '재전송 기능 있음');
  ok(/id="vRetry"/.test(vsrc), '재전송 버튼 있음');
  ok(/b\.disabled\s*=\s*true/.test(vsrc), '제출 버튼 연타 차단');
  ok(/confirm\(/.test(vsrc), '동일 제출 확인 있음');
  ok(/up:\s*0/.test(vsrc), '저장 시 미전송(up:0)으로 시작');

  // 재전송은 같은 id로 보내야 서버가 덮어쓴다(중복 방지의 핵심)
  ok(/payload\(it\.t, it\.row\)/.test(vsrc) && /id:\s*row\.id/.test(vsrc), '재전송이 같은 id를 유지함');
  ok(/s:\s*L\.s/.test(vsrc), '위치 구성요소를 함께 보냄(수신 복원용)');

  // 상태값이 집계를 오염시키지 않아야 한다
  const it2 = A.LIST.find(e => e.kind === 'C');
  const lc = { s: 'civil', p: 2, c: 1 };
  const before = A.actQty(it2.key, lc);
  S.work.push({ id: A.uid(), date: '2026-08-13', loc: lc, key: it2.key, qty: 50, by: 'x', st: 'sub', up: 0 });
  ok(A.actQty(it2.key, lc) === before, 'up 필드가 진행률 집계에 영향 없음(st만 본다)');

  // 협력업체 화면에 서버 관련 관리 기능이 새로 새지 않았는지
  S.lang = 'ko'; V.render();
  ok(!/동기화|불러오기/.test(bag.vBody.innerHTML + bag.vMine.innerHTML), '수신(관리) 기능은 협력업체 화면에 없음');
}

console.log('\n[V11] 공종 표시 — 코드는 뒤에 괄호로 (현장에서 "이게 뭐예요" 소리 안 나오게)');
{
  S.lang = 'ko';                      // 관리자가 한국어로 써도 협력업체 화면은 영문
  /* 기본 화면엔 그룹 목록만 뜬다. 그룹을 골라야 공종 항목이 렌더된다. */
  const grp = A.LIST.find(e => e.code && A.itemsOf(e.site, e.grp).length);
  V.state.s = grp.site; V.state.grp = grp.grp; V.render();
  const h = bag.vBody.innerHTML;
  const opts = [...h.matchAll(/<option[^>]*>([^<]+)<\/option>/g)].map(m => m[1].trim());
  const coded = opts.filter(t => /\([A-Z][A-Z0-9-]*-\d+\)$/.test(t));
  ok(coded.length > 0, coded.length ? `코드 표시 ${coded.length}건 — 예: ${coded[0]}` : '코드 붙은 항목 없음');

  // 코드가 맨 앞에 오면 협력업체가 "이게 뭐냐"고 묻는다 → 앞자리 금지
  const front = opts.filter(t => /^[A-Z][A-Z0-9-]*-\d+\s/.test(t));
  ok(front.length === 0, front.length ? `코드가 앞에 온 항목 ${front.length}건 (예: ${front[0]})` : '코드가 맨 앞에 오지 않음');

  // 코드 없는 공종에 빈 괄호가 붙으면 안 된다
  ok(!/\(\)\s*(\[|<\/option>)/.test(h), '코드 없는 항목에 빈 괄호 없음');
}

console.log('\n[V12] 도로 세부위치 — 측점→연장 자동, 좌우는 따로 저장');
{
  const SP = sb.BNCP_SPOT;
  ok(!!SP, 'BNCP_SPOT 로드됨');
  ok(SP.widths().length === 7, `기본 도로폭 7종 (${SP.widths().map(x => x.w).join(',')})`);
  ok(SP.maxNo('50') === 5 && SP.maxNo('27') === 30 && SP.maxNo('14') === 120, '폭별 번호 상한 정상');
  ok(SP.maxNo('22') === 5 && SP.maxNo('17.5') === 5 && SP.maxNo('15') === 5, '22·17.5·15는 5번까지');
  ok(SP.widths([{ w: '30', max: 9 }]).length === 8, '현장에서 폭 추가 가능');

  /* 측점 → 연장
     ★1스테이션 = 20m다 (2026-08-23 현장 확정). 0+19 다음이 1+00이고
       0+20은 없다. 종전 검사는 흔한 1km 기준(0+000~0+999)을 기대하고
       있었다 — 그래서 「0+19 다음 1+00」이 **1m가 아니라 981m**로
       계산되는 것을 못 잡았다. 실적 폼은 이 연장을 작업량에 그대로
       박아 넣으므로 표기가 아니라 **수량이 틀어지는** 문제였다. */
  ok(SP.STA_STEP === 20, '★1스테이션 = 20m');
  ok(SP.sta(0, 0) === 0 && SP.sta(1, 0) === 20 && SP.sta(0, 19) === 19,
     '★★측점 환산 — 1+00은 20m, 0+19는 19m');
  ok(SP.len(SP.sta(0, 19), SP.sta(1, 0)) === 1,
     '★★0+19 ~ 1+00 은 1m다 (종전엔 981m로 셌다)');
  ok(SP.sta(0, 20) === null && SP.sta(3, 25) === null,
     '★0+20은 없다 — 1+00으로 적어야 하므로 막는다');
  ok(SP.sta('', 120) === null && SP.sta(0, 'x') === null, '빈 칸은 null');
  ok(SP.len(SP.sta(0, 0), SP.sta(6, 0)) === 120, '연장 자동계산 120m (=6스테이션)');
  ok(SP.len(SP.sta(6, 0), SP.sta(0, 0)) === 120, '순서를 바꿔 넣어도 흡수');
  ok(SP.staText(0) === '0+00' && SP.staText(19) === '0+19' &&
     SP.staText(20) === '1+00' && SP.staText(500) === '25+00',
     '★★측점 표기 복원 — 뒤는 두 자리, 20에서 넘어간다');

  // 묶음 키 — 좌우가 섞이면 안 된다
  const L = { kind: 'road', w: '50', no: '1', side: 'L', f: 0, t: 120 };
  const R = { kind: 'road', w: '50', no: '1', side: 'R', f: 0, t: 120 };
  ok(SP.groupKey(L) !== SP.groupKey(R), '좌우는 다른 묶음(한쪽만 불합격 가능)');
  ok(SP.groupKey(L) === SP.groupKey({ kind: 'road', w: '50', no: '1', side: 'L', f: 500, t: 620 }),
     '같은 도로·같은 쪽은 날짜가 달라도 한 묶음');

  // 범위 계산
  const rng = SP.range([{ spot: { f: 0, t: 120 } }, { spot: { f: 230, t: 350 } }, { spot: { f: 120, t: 230 } }]);
  ok(rng === 'STA 0+00 ~ 17+10', `묶음 범위 자동 (${rng})`);

  // 단계와 차수는 다르다
  ok(SP.STAGES.length === 3, '검측 단계 3종(관설치·모래되메우기·되메우기층)');
  ok(SP.stageName('bf', 3).indexOf('#3') > 0, '되메우기는 층 번호가 붙는다');
}

console.log('\n[V13] 검측 신청 — 실적을 골라 묶는다 (다시 고르지 않는다)');
{
  const vsrc = fs.readFileSync(path.join(ROOT, 'assets/js/vendor.js'), 'utf8');
  ok(/function inspPool/.test(vsrc) && /function inspHTML/.test(vsrc), '실적 목록에서 선택하는 화면 있음');
  ok(/!w\.need \|\| w\.insp/.test(vsrc), '검측 필요 표시 + 미신청 건만 목록에 뜬다');
  ok(/w\.insp = irow\.id/.test(vsrc), '신청한 실적은 목록에서 사라진다(중복 신청 차단)');
  ok(/stage: V\.stage/.test(vsrc) && /seq: 1/.test(vsrc), '단계(stage)와 차수(seq)를 따로 저장');
  ok(/mixed/.test(vsrc), '다른 공종·도로가 섞이면 막는다');
  ok(!/No output recorded/.test(vsrc), '옛 "해당 날짜 실적 없음" 차단 제거됨');
  ok(/need: !!V\.need/.test(vsrc), '실적에 검측 필요 여부가 저장된다');
  ok(/need: false/.test(vsrc), '검측 필요는 기본 해제');

  // 좌우 분리 저장 — 소스 확인
  ok(/V\.side\.length/.test(vsrc) && /mk\.push/.test(vsrc), '좌·중앙·우를 건별로 나눠 저장');
  ok(/qty: L/.test(vsrc), '수량은 측점에서 계산한 연장');
}

console.log('\n[V14] 협력업체 명부 · 링크 고정 · 겹침 차단');
{
  const vsrc = fs.readFileSync(path.join(ROOT, 'assets/js/vendor.js'), 'utf8');

  // 명부 — 표기 흩어짐 차단
  const r = A.vendLoad('업체코드,업체명,담당자\nKEW,Al-Kawthar Co.,Ali\nKEW,Al-Kawthar Co.,Omar\nBSR,Basra Civil,Mahmood');
  ok(r.comp === 2 && r.staff === 3, `명부 로드 업체 ${r.comp} 담당자 ${r.staff}`);
  ok(S.vend[0].staff.length === 2, '한 업체에 담당자 여럿');
  const k1 = S.vend[0].key;
  ok(/^KEW-[0-9a-f]{8}$/.test(k1), `업체 링크키 발급 (${k1})`);
  ok(!!A.vendByKey(k1) && !A.vendByKey('KEW-00000000'), '키로만 업체가 조회된다');

  // 다시 올려도 링크가 바뀌면 안 된다 — 현장에 재배포해야 하므로
  A.vendLoad('KEW,Al-Kawthar Co.,Ali\nBSR,Basra Civil,Mahmood');
  ok(S.vend[0].key === k1, '재업로드해도 기존 링크 유지');

  // 링크 게이트
  ok(/function vendGate/.test(vsrc), '링크 검사 있음');
  ok(/S\.vend \|\| !S\.vend\.length/.test(vsrc) || /!S\.vend\.length/.test(vsrc),
     '명부 미등록이면 예전처럼 동작(기존 현장 안 막힘)');
  ok(/gateHTML/.test(vsrc), '링크 없으면 입력 화면 대신 안내');

  // 겹침 차단 — 중복 청구가 실무에서 가장 흔하다
  ok(/function overlap/.test(vsrc), '겹침 판정 있음');
  ok(/Overlaps /.test(vsrc), '겹치면 제출을 막는다');
  ok(/lo < b && a < hi/.test(vsrc), '접하는 구간(끝점 일치)은 겹침이 아니다');
}

/* ── V-TAG 공종별 표기 (v2.26.0 · 요청 12·13 · 0-P 확정) ── */
console.log('\n[V-TAG] 표기 — 관로·전기는 도로 대신 도면 라벨을 쓴다');
{
  const SP = sb.window.BNCP_SPOT, VD = sb.window.VENDOR, VS = VD.state;

  /* ★함수 존재를 먼저 가린다. 없는 채로 부르면 예외가 나서 검사가 통째로
     죽고, 어느 줄이 왜 실패했는지 안 보인다 — 옛 파일로 되돌려 확인할 때
     실제로 그랬다. 없으면 여기서 깨끗이 실패시키고 아래는 건너뛴다. */
  const hasTag = typeof SP.needTag === 'function' && typeof SP.tagHint === 'function';
  ok(hasTag, '★SPOT.needTag / tagHint 가 있다 (요청 12·13)');
  if (!hasTag) { console.log('  (표기 검사 건너뜀 — 위가 실패했다)'); }
  else {

  /* 표를 직접 본다 — 부지와 부대는 표기가 다르다 */
  ok(SP.needTag('civil', '우수공') && SP.needTag('civil', '전기/통신/가로등'),
     '★관로·전기 계열은 표기를 받는다');
  ok(!SP.needTag('civil', '토공') && !SP.needTag('civil', '포장공'),
     '★토공·포장은 종전대로 도로·측점이다');
  ok(SP.tagHint('civil', '우수공').indexOf('C2-55') >= 0,
     '부지 우수공 예시 (C2-55 D1100 · CM4-66 · CSM6-10)');
  ok(SP.tagHint('anc', '단지내 부대토목-우수공').indexOf('M1,D315') >= 0,
     '★부대블록은 쉼표 표기라 예시가 다르다');
  ok(SP.tagHint('civil', '우수공') !== SP.tagHint('anc', '단지내 부대토목-우수공'),
     '★부지와 부대 안내가 갈려 있다');
  /* ★부대블록 전기는 도면(B8-E-1001)에서 확정했다 — 부지 전기와 표기가
     전혀 다르다. 임시로 부지 것을 쓰고 있던 자리다(v2.28.0). */
  ok(SP.tagHint('anc', '단지내 부대토목-전기/통신/가로등').indexOf('LP2-6') >= 0,
     '★★부대 전기는 도면 표기다 (H-8 · M-5 · LP2-6 · 100*4)');
  ok(SP.tagHint('anc', '단지내 부대토목-전기/통신/가로등') !==
     SP.tagHint('civil', '전기/통신/가로등'),
     '★★부대 전기와 부지 전기가 서로 다른 예시를 쓴다');

  /* ★원문 검사로 끝내지 않는다 — 실제로 그려서 어느 칸이 뜨는지 본다.
     ★앞 검사들이 업체 명부를 등록해 두면 vendGate()가 입력 화면 대신
       안내 화면을 내놓는다. 여기서는 입력 폼 자체를 봐야 하므로 명부를
       비워 문을 연다(명부 미등록이면 종전처럼 동작 — 기존 현장 안 막힘). */
  const saveVend = S.vend; S.vend = [];
  VS.tab = 'work'; VS.s = 'civil'; VS.grp = '우수공'; VS.key = ''; VS.tag = '';
  VD.render();
  const hT = bag.vBody.innerHTML;
  ok(hT.indexOf('id="vTag"') >= 0, '★★표기 공종을 고르면 표기 칸이 뜬다');
  ok(hT.indexOf('data-sta=') < 0,
     '★★표기 공종에는 측점 칸이 안 뜬다 (둘은 배타적이다)');
  ok(hT.indexOf('C2-55') >= 0, '자리표시에 그 공종의 실제 예시가 들어간다');

  VS.grp = '토공'; VS.side = ['L']; VD.render();
  const hR = bag.vBody.innerHTML;
  ok(hR.indexOf('id="vTag"') < 0, '★★도로 공종에는 표기 칸이 안 뜬다');
  ok(hR.indexOf('data-sta=') >= 0, '★★도로 공종은 종전대로 측점 칸이 뜬다');
  VS.side = []; VS.sta = {}; S.vend = saveVend;

  /* 공종군이 바뀌면 표기와 도로를 함께 비운다 —
     안 비우면 화면엔 표기 칸만 뵈는데 저장은 도로로 나간다 */
  const vs2 = fs.readFileSync(path.join(ROOT, 'assets/js/vendor.js'), 'utf8');
  ok(/f === 's' \|\| f === 'grp'\) \{ V\.tag = ''; V\.side = \[\]/.test(vs2),
     "★공종군이 바뀌면 표기·도로를 함께 비운다");

  /* 표기가 저장되고 동기화 양쪽에 실린다 (0-J 사고 재발 방지) */
  ok(/tag: V\.tag \|\| ''/.test(vs2), '실적·인원장비 줄에 표기가 저장된다');
  ok(/tag: rows\[0\]\.tag \|\| ''/.test(vs2), '검측은 실적의 표기를 물려받는다');
  const ts2 = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  ok(/if \(row\.tag\) b\.tag = row\.tag;/.test(ts2), '★보내는 쪽에 표기가 실린다');
  ok(/base\.tag = r\.tag \|\| '';/.test(ts2),
     '★★받는 쪽도 표기를 푼다 — 한쪽만 고치면 0-J와 같은 사고가 난다');
  }
}

/* ── V-WHY 측량 사유 선택식 (v2.27.0 · 요청 1) ── */
console.log('\n[V-WHY] 측량 사유 — 고르는 것이다 (자유입력은 「기타」뿐)');
{
  const VD = sb.window.VENDOR, VS = VD.state;
  const saveVend2 = S.vend; S.vend = [];
  const saveSurv = S.surv; S.surv = [];

  VS.tab = 'surv'; VS.why = ''; VS.whyEtc = ''; VD.render();
  const h1 = bag.vBody.innerHTML;
  ok(h1.indexOf('data-v="why"') >= 0, '★★사유가 고르는 칸이다');
  /* 12항목 + 기타 = 13 (0-P 우선순위표의 「사유 12항목 + 기타」) */
  const opts = (h1.match(/<option value="[a-z_]+"/g) || []).length;
  ok(opts === 13, `★12항목 + 기타 = 13 (${opts})`);
  ok(h1.indexOf('id="vWhy"') < 0,
     '★★안 골랐을 때는 직접입력 칸이 없다 — 같은 사유가 두 군데로 갈리지 않게');

  /* ★측량은 도로를 재지 않는다 (0-V) */
  ok(h1.indexOf('data-sta=') < 0 && h1.indexOf('data-side=') < 0,
     '★★측량 폼에 도로·측점 칸이 없다 (0-V — 우리는 시공측량을 안 한다)');
  ok(h1.indexOf('id="vTag"') < 0, '표기 칸도 없다 — 측량은 위치와 사유면 족하다');

  VS.why = 'etc'; VD.render();
  ok(bag.vBody.innerHTML.indexOf('id="vWhy"') >= 0,
     '★★「기타」를 골라야 직접입력 칸이 나온다');

  /* 저장은 고른 항목의 **글**이다 — 관리자 화면·독촉 문안이 why를 글로 읽는다 */
  const vs3 = fs.readFileSync(path.join(ROOT, 'assets/js/vendor.js'), 'utf8');
  ok(/function whyText/.test(vs3) && /x\.id === V\.why/.test(vs3),
     '★고른 항목의 영문 글을 why에 넣는다 (코드값이 아니다)');
  ok(/if \(!V\.why\) return say/.test(vs3), '안 고르면 제출을 막는다');
  ok(/f === 'why' && el\.value !== 'etc'\) V\.whyEtc = ''/.test(vs3),
     "★기타에서 다른 항목으로 옮기면 직접입력 글을 버린다");
  ok(/var wEl = \$\('#vWhy'\); if \(wEl\) V\.whyEtc/.test(vs3),
     '★제출 직전에 직접입력 글을 거둔다 (화면 상태에만 남지 않게)');

  VS.why = ''; VS.whyEtc = '';
  S.vend = saveVend2; S.surv = saveSurv;
}

/* ── V-ANC 부대토목 Road/Station (v2.29.0 · 요청 3·4·5) ── */
console.log('\n[V-ANC] 부대토목 — 블록-번호 도로 · 측점은 고르는 것');
{
  const SP = sb.window.BNCP_SPOT, VD = sb.window.VENDOR, VS = VD.state;
  const saveVend3 = S.vend; S.vend = [];

  /* ★새 API는 **존재 확인을 앞에 둔다** — 없는 채로 부르면 예외가 나서
     검사가 통째로 죽고, 어느 줄이 왜 실패했는지 안 보인다(0-W에서 배운 것). */
  const hasAnc = typeof SP.blkCode === 'function' && typeof SP.staNos === 'function';
  ok(hasAnc, '★SPOT.blkCode / staNos 가 있다 (부대토목 도로·측점)');
  if (!hasAnc) { console.log('  (부대토목 검사 건너뜀 — 위가 실패했다)'); }
  else {

  ok(SP.blkCode({ s: 'anc', t: 'B', b: 6 }) === 'B6', '★위치에서 블록코드가 나온다 (Town B · Block 6 → B6)');
  ok(SP.blkCode({ s: 'civil', p: 3, c: 1 }) === '', '부지 위치에는 블록코드가 없다');
  ok(SP.ANC_ROADS === 30, '★블록마다 도로 30개 고정');

  /* ★저장 모양은 부지와 같다 — w에 블록코드. 그래야 이름·묶음·겹침이 그대로 돈다 */
  const anc = { kind: 'road', w: 'B6', no: 3, side: 'L', f: 0, t: 40 };
  ok(SP.roadName(anc) === 'B6-3', '★★B6-3으로 읽힌다 (모양을 새로 만들지 않았다)');
  ok(SP.groupKey(anc) === 'road|B6|3|L', '★검측 묶음 키가 그대로 선다');
  ok(SP.label(anc) === 'B6-3 · Left · STA 0+00~2+00', '★화면 표기도 그대로');

  VS.tab = 'work'; VS.s = 'anc'; VS.t = 'B'; VS.b = 6;
  VS.grp = '단지내 부대토목-토공'; VS.key = ''; VS.side = ['L']; VS.sta = {}; VS.rno = '';
  VD.render();
  const hA = bag.vBody.innerHTML;
  ok(hA.indexOf('>B6-1<') >= 0 && hA.indexOf('>B6-30<') >= 0,
     '★★도로가 B6-1 ~ B6-30으로 나온다');
  ok(hA.indexOf('>B6-31<') < 0, '★31번은 없다');
  ok(hA.indexOf('data-v="rw"') < 0,
     '★★부대에는 도로폭 목록이 안 뜬다 (폭 기준이 없다)');
  ok(hA.indexOf('value="B6" readonly') >= 0, '블록코드는 위치에서 나와 고정이다');

  /* ★★측점은 고르는 것 — 직접입력 금지 */
  ok(/<select class="in" data-sta=/.test(hA), '★★측점이 고르는 칸이다');
  ok(!/data-sta="[LCR]\.[ft][km]" type="number"/.test(hA),
     '★★직접입력(number) 칸이 남아 있지 않다');
  /* 0~19만 있고 20은 없다 — 1+20은 존재하지 않는 측점이다 */
  const mSel = /data-sta="L\.fm"[\s\S]*?<\/select>/.exec(hA);
  ok(!!mSel && mSel[0].indexOf('>19<') >= 0 && mSel[0].indexOf('>20<') < 0,
     '★★뒤 칸은 0~19뿐 — 20은 목록에 아예 없다 (다음 스테이션이다)');

  /* 부지는 종전대로 폭-번호 */
  VS.s = 'civil'; VS.p = 3; VS.c = 1; VS.grp = '토공'; VS.rw = '18'; VD.render();
  const hC = bag.vBody.innerHTML;
  ok(hC.indexOf('data-v="rw"') >= 0 && hC.indexOf('>18m<') >= 0,
     '★부지는 종전대로 폭-번호다');
  ok(/<select class="in" data-sta=/.test(hC), '측점은 부지·부대 모두 고르는 칸이다');

  /* select에는 input 이벤트가 안 오는 브라우저가 있다 — 둘 다 걸어야 한다 */
  const vs4 = fs.readFileSync(path.join(ROOT, 'assets/js/vendor.js'), 'utf8');
  ok(/el\.oninput = el\.onchange = function/.test(vs4),
     '★★측점에 oninput·onchange를 함께 건다 (select는 input이 안 올 수 있다)');

  VS.side = []; VS.sta = {}; VS.rw = ''; VS.rno = ''; S.vend = saveVend3;
  }
}

console.log(fail ? `\n✗ 실패 ${fail}건\n` : '\n✓ 전부 통과\n');
process.exit(fail ? 1 : 0);
