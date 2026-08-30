/* 브라우저 없이 도는 자체 감사 —  node tools/smoke.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

/* ── DOM 스텁 ─────────────────────────────────────────── */
const bag = {};
function El(id) {
  return { id, innerHTML: '', textContent: '', value: '', src: '', style: {}, dataset: {},
    options: [{ text: '' }], files: [], setAttribute() {}, getAttribute() { return null; },
    addEventListener() {}, appendChild() {}, remove() {}, select() {},
    closest() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; } };
}
['logo','appt','hmeta','tabs','view','fltBox','wipe','vendorBtn',
 /* 직영 입력 폼 — [98]이 실제 클릭·타이핑으로 상태 유지까지 확인한다 */
 'dCat','dSize','dRun','dBrk','dRep','dEqAdd','dTask','dBy','dNote','dDate'].forEach(i => bag[i] = El(i));
const store = {};
const sb = {
  console,
  localStorage: { getItem: k => (k in store ? store[k] : null),
                  setItem: (k, v) => { store[k] = String(v); },
                  removeItem: k => { delete store[k]; } },
  navigator: {}, location: { reload() {} }, alert(m) { throw new Error('alert: ' + m); },
  confirm: () => false, prompt: () => 'test', Blob: function () {},
  URL: { createObjectURL: () => '', revokeObjectURL() {} },
  setTimeout: () => 0, XLSX: null, scrollTo() {}, TextDecoder,
  setInterval: (fn) => { sb.__ivFn = fn; return 7; }, clearInterval: (id) => { if (id === 7) sb.__ivFn = null; },
  /* ★window 리스너를 잡아 둔다 — 모바일 복귀 수신(v2.39.0)을 시험이 직접 불러 본다 */
  addEventListener(type, fn) { (sb.__evt = sb.__evt || {})['win:' + type] = fn; },
  document: { documentElement: {}, hidden: false,
    /* ★document 리스너도 잡아 둔다(visibilitychange) */
    addEventListener(type, fn) { (sb.__evt = sb.__evt || {})[type] = fn; },
    createElement: () => El('t'), body: { appendChild() {} },
    querySelector(s) { const m = /^#([A-Za-z0-9_-]+)$/.exec(s); return m && bag[m[1]] ? bag[m[1]] : null; },
    querySelectorAll() { return []; } }
};
sb.window = sb; vm.createContext(sb);
['version','i18n','data','master','materials','materials2','work_i18n','prod','equip','core','spot','api','matmaster_api','wx','tabs']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js', f + '.js'), 'utf8'), sb, { filename: f }));

const A = sb.APP, S = A.S;
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; };
const near = (a, b, t) => Math.abs(a - b) <= (t == null ? 1e-6 : t);

/* ── 1 위치체계 ───────────────────────────────────────── */
/* ★작업량·작업위치는 기본이 어제다(v2.18.9) — 검사 자료도 어제로 넣는다 */
function yday() { const d = new Date(A.today()); d.setDate(d.getDate() - 1);
  return d.getFullYear() + '-' + ('0'+(d.getMonth()+1)).slice(-2) + '-' + ('0'+d.getDate()).slice(-2); }

console.log('\n[1] 위치체계 (층1 — 항상 영문)');
ok(A.PHASES.length === 6, 'Phase 1~6');
ok(A.SECTORS.length === 2, '공구 1/2 (전 페이즈 공통)');
const blocks = A.TOWNS.reduce((s, t) => s + t.n, 0);
ok(A.TOWNS.length === 8 && blocks === 59, `Town A~H 8개 / Block 합계 ${blocks}개`);
ok(A.locLabel({s:'civil',p:6,c:2}) === 'Phase 6-2', 'Phase 6-2 표기');
ok(A.locLabel({s:'anc',t:'B',b:5}) === 'Town B · Block 5', 'Town B · Block 5 표기');
ok(A.allLocs().length === 12 + 59, `전체 위치 ${A.allLocs().length}개 (부지12 + 부대59)`);
S.lang = 'en';
ok(A.locLabel({s:'civil',p:1,c:1}) === 'Phase 1-1', 'EN 모드에서도 동일');
S.lang = 'ko';

/* ── 2 공종 레지스트리 ────────────────────────────────── */
console.log('\n[2] 공종 레지스트리 (시설물은 부지토목 하위)');
const civ = A.itemsOf('civil'), anc = A.itemsOf('anc');
const civC = civ.filter(e => e.kind === 'C'), civF = civ.filter(e => e.kind === 'F');
ok(civC.length === 261, `부지토목 코드 261 (실제 ${civC.length})`);
ok(civF.length === 231, `시설물 원단위행 231 (실제 ${civF.length})`);
ok(anc.length === 92, `부대토목 코드 92 (실제 ${anc.length})`);
const grpC = A.groupsOf('civil').map(g => g.grp);
ok(grpC.includes('갤러리') && grpC.includes('토공'), `부지토목 대분류 ${grpC.length}개에 시설물 포함`);
ok(A.groupsOf('anc').every(g => /부대토목|기타공\(부대토목\)/.test(g.grp)), '부대토목 대분류 분리');
const facA = civF.filter(e => e.cls === 'A');
ok(facA.length === facA.filter(e => e.pteam != null).length,
   `시설물 A분류 ${facA.length}개 전부 팀당 생산성 확보`);

/* ── 3 장비 마스터 ────────────────────────────────────── */
console.log('\n[3] 장비 마스터');
const rows = A.EQ_TREE.reduce((s, t) => s + t.sizes.length, 0);
ok(A.EQ_TREE.length === 62 && rows === 97, `${A.EQ_TREE.length}종 / ${rows}행`);
const kr = A.EQ_TREE.filter(t => /[가-힣]/.test(t.cat) || t.sizes.some(s => /[가-힣]/.test(s)));
ok(kr.length === 0, '한글 0건 — 층1 영문 고정 지켜짐');
ok(A.eqSizes('Fork Lift').length === 5, 'Fork Lift 5개 규격 (오타 수정 반영)');
ok(A.EQ_TYPO['Fork Lift'] === 'Folk Lift', '지급대장 대조용 원문 철자 보존');
const excluded = ['Canopy','Generator Electric Panel','고압살수차','Boiler(급탕용)',
                  'Padfoot kit','Wheel loader-Bucket','Crusher for Excavator','Steel Plate'];
ok(excluded.every(c => !A.EQ_TREE.some(t => t.cat === c)), '캠프설비·어태치먼트 제외됨');
ok(A.EQ_TREE.some(t => t.cat === 'Aerial Work Platform'), '고소작업차 → Aerial Work Platform');
ok(A.EQ_TREE.some(t => t.cat === 'Asphalt Finisher (Premium)'), '고급형 → (Premium)');
ok(A.EQ_TREE.some(t => t.cat === 'Line Marker (Cold-applied)'), '상온식 → (Cold-applied)');

/* ── 4 자재 ───────────────────────────────────────────── */
console.log('\n[4] 자재원단위 정리');
const mats = sb.BNCP_MAT.rows;
ok(!mats.some(r => /거푸집/.test(r.mat)), '거푸집 전량 제외');
ok(!mats.some(r => /외경|저폭|상단폭|토피고/.test(r.mat)), '치수값 제외');
ok(!mats.some(r => /터파기|되메우기|잔토/.test(r.mat)), '토공 물량 제외');
ok(!mats.some(r => !r.mat || r.mat === '-'), '이름 없는 행 없음');
ok(A.MAT_REF.length === 11, `관경 치수 참조표 ${A.MAT_REF.length}개 별도 보존`);
console.log('\n[4b] 새 자재 마스터 (사용자 최종본)');
ok(A.matGroups().length === 12, `공종그룹 ${A.matGroups().length}개`);
ok(A.matSubs('부지토목').length === 9, `부지토목 세부공종 ${A.matSubs('부지토목').length}개`);
const paveMats = A.matItems('부지토목', '도로포장(아스팔트)');
ok(paveMats.length > 0 && paveMats.every(m => m.grp==='부지토목'), '공종 선택 시 그 공종 자재만');
ok(!A.MAT2.some(m => /^철근/.test(m.mat) || /거푸집/.test(m.mat)), '철근단독·거푸집 제외');
ok(!A.MAT2.some(m => /^(중앙선|황색|백색|적색|팽창줄눈)$/.test(m.mat)), '차선종류·색상 제외');
ok(A.MAT2.some(m => /레미콘/.test(m.mat) && /fck=\d+MPa/.test(m.spec)), '레미콘 fck=NMPa 통일');
ok(A.MAT2.some(m => /몰탈/.test(m.mat) && /1:2/.test(m.spec)), '몰탈 (1:2) 통일');
const plantN = A.MAT2.filter(m => m.plant).length;
ok(plantN > 0, `플랜트 지급자재 ${plantN}행 분류`);
ok(A.MAT2.some(m => m.plant && /레미콘/.test(m.mat)) && A.MAT2.some(m => m.plant && /모래/.test(m.mat)),
   '레미콘·모래 플랜트 분류됨');
ok(A.MAT2.some(m => !m.plant), '창고자재도 있음');
console.log(`       자재 ${mats.length}행(구) · 새마스터 ${A.MAT2.length}행/${A.matGroups().length}그룹`);

/* ── 5 설계목표 ───────────────────────────────────────── */
console.log('\n[5] 설계목표');
const L1 = { s:'civil', p:3, c:1 }, L2 = { s:'anc', t:'B', b:5 };
let r = A.readPlanRows(A.parseCSV('코드,수량\nT-01,120000\nT-04,80000\nA-T-01,999\nZZ-99,10\n'), L1);
ok(r.ok === 2, `유효 2행 반영 (실제 ${r.ok})`);
ok(r.wrongSite.length === 1 && r.wrongSite[0] === 'A-T-01', '부대토목 코드를 부지 위치에 넣으면 걸러냄');
ok(r.miss.length === 1, '마스터에 없는 코드 걸러냄');
ok(A.planQty('T-01', L1) === 120000, 'Phase 3-1 설계목표');
ok(A.planQty('T-01', { s:'civil', p:4 }) === 0, '다른 페이즈에는 안 들어감');
A.readPlanRows(A.parseCSV('코드,수량\nA-T-01,5000\n'), L2);
ok(A.planQty('A-T-01', L2) === 5000, 'Town B · Block 5 설계목표');

const lk = A.locKey(L1);
S.fac[lk] = { GL: [] }; S.fac[lk].GL[0] = 100;
const glRow = sb.BNCP.GL.rows[0];
ok(near(A.planQty('GL|콘크리트|fck=31MPa', L1), glRow.v[0] * 100, 0.01),
   `시설물 개소수 100 × 원단위 ${glRow.v[0]} = ${glRow.v[0] * 100}`);

/* ── 6 실적 → 확인 → 진행률 ───────────────────────────── */
console.log('\n[6] 실적(업체 제출 → 스탭 확인)');
S.work.push({ id:'w1', date:'2026-07-20', loc:L1, key:'T-01', qty:30000, st:'sub' });
ok(A.actQty('T-01', L1) === 0, '제출만 한 실적은 진행률에 안 들어감');
ok(A.pendWork(L1).length === 1, '확인 대기 1건');
S.work[0].st = 'ok';
ok(A.actQty('T-01', L1) === 30000, '확인하면 반영됨');
S.work.push({ id:'w2', date:'2026-07-21', loc:L1, key:'T-01', qty:30000, st:'ok' });
ok(near(A.rate('T-01', L1) || (A.actQty('T-01',L1)/A.planQty('T-01',L1)*100), 50), '진행률 50%');

/* ── 7 인원·장비 → 실측 생산성 ────────────────────────── */
console.log('\n[7] 인원·장비 (분리 입력 → 날짜·위치·공종으로 짝지음)');
const mkEq = (run, brk, rep) => [{ cat:'Excavator(crawler)', size:'1.2m3', run, brk, rep }];
S.crew.push({ id:'c1', date:'2026-07-20', loc:L1, key:'T-01', teams:3,
              ppl:{eng:1,fmn:3,wkr:20}, eq:mkEq(6,1,1), st:'sub' });
ok(A.prod('T-01', L1) === null, '확인 안 된 인원·장비는 생산성에 안 들어감');
S.crew[0].st = 'ok';
S.crew.push({ id:'c2', date:'2026-07-21', loc:L1, key:'T-01', teams:3,
              ppl:{eng:1,fmn:3,wkr:20}, eq:mkEq(6,0,2), st:'ok' });
const p = A.prod('T-01', L1);
ok(p.teamDays === 6, `조·일 6 (실제 ${p.teamDays})`);
ok(near(p.perTeam, 10000), `팀당 1일 생산량 60000÷6 = 10,000 (실제 ${p.perTeam})`);
ok(p.people === 60, `인원 합계 (24다이얼+6기사)×2 = 60 (실제 ${p.people})`);
ok(p.run === 12 && near(p.perEq, 5000), `가동 장비만 분모 — 12대 → ${p.perEq}/대`);
ok(A.pplSum({eng:1,fmn:3,wkr:20}) === 24, '인원 다이얼 3직군 합계 24');
ok(A.oprCount(mkEq(6,0,2)) === 6, '장비기사 = 가동대수 자동 (6)');
ok(A.crewTotal({ppl:{eng:1,fmn:3,wkr:20},eq:mkEq(6,0,0)}) === 30, '총인원 = 3직군24 + 기사6 = 30');

/* ── 7-B 생산성 왜곡 — 완료일에 수량이 몰려도 부풀려지지 않는다 ──
   ★사고 : 여러 날 걸린 작업의 수량이 완료일 하루에 올라오면, 종전 계산은
     수량과 인원을 **같은 날끼리** 짝지어 그날 인원으로만 나눠 몇 배로
     부풀렸다(사용자 지적, 사실상 모든 작업). 이제 분자·분모를 각각 기간
     전체로 합쳐(누계) 그 왜곡을 없앤다. */
console.log('\n[7-B] 생산성 — 수량이 완료일 하루에 몰려도 정확');
{
  const LB = { s: 'civil', p: 4, c: 1 };   /* 다른 공구 — [7]과 안 섞이게 */
  /* 거푸집류를 흉내 — 아무 key 하나에 2조×3일 투입, 수량은 완료일(3일차)에 300 */
  const pk = 'T-01';
  S.crew.push({ id: 'pb1', date: '2026-08-25', loc: LB, key: pk, teams: 2, ppl: { eng: 0, fmn: 1, wkr: 8 }, eq: [], st: 'ok' });
  S.crew.push({ id: 'pb2', date: '2026-08-26', loc: LB, key: pk, teams: 2, ppl: { eng: 0, fmn: 1, wkr: 8 }, eq: [], st: 'ok' });
  S.crew.push({ id: 'pb3', date: '2026-08-27', loc: LB, key: pk, teams: 2, ppl: { eng: 0, fmn: 1, wkr: 8 }, eq: [], st: 'ok' });
  S.work.push({ id: 'pbw', date: '2026-08-27', loc: LB, key: pk, qty: 300, st: 'ok' });
  const pb = A.prod(pk, LB);
  ok(pb.teamDays === 6, `★팀-일이 6이다 (2조×3일, 완료일 하루로 안 쪼그라듦) — 실제 ${pb.teamDays}`);
  ok(pb.perTeam === 50, `★팀당 생산성 300÷6 = 50 (종전엔 300÷2=150로 부풀었다) — 실제 ${pb.perTeam}`);
  /* 진행 중(수량 아직 없음)이면 분모만 쌓여 낮게 보이고, 절대 부풀지 않는다 */
  S.work = S.work.filter(w => w.id !== 'pbw');
  const wip = A.prod(pk, LB);
  ok(wip.perTeam === 0, '진행 중(수량 없음)이면 0 — 부풀리지 않는다');
  S.crew = S.crew.filter(c => ['pb1', 'pb2', 'pb3'].indexOf(c.id) < 0);
}

/* ── 8 공종별 집계 (작업량/인원/장비 분리) ────────────── */
console.log('\n[8] 공종별 집계');
const ru = A.rollup(L1).filter(x => x.e.key === 'T-01')[0];
ok(ru.qty === 60000, `작업량 ${ru.qty}`);
ok(ru.ppl.eng === 2 && ru.ppl.fmn === 6 && ru.ppl.wkr === 40 && ru.opr === 12,
   `직군 eng2/fmn6/wkr40 + 자동기사 opr12`);
ok(ru.run === 12 && ru.brk === 1 && ru.rep === 3, `장비 가동12 / 고장1 / 수리3`);

/* ── 9 장비 지급대조 ──────────────────────────────────── */
console.log('\n[9] 장비 지급대조');
let ir = A.readIssueRows(A.parseCSV(
  '날짜,장비,규격,대수\n2026-07-20,Folk Lift,15ton,2\n2026-07-20,Excavator(crawler),1.2m3,10\n2026-07-20,NoSuchMachine,1,1\n'), L1);
ok(ir.ok === 2, `지급대장 2행 반영 (실제 ${ir.ok})`);
ok(ir.miss.length === 1, '마스터에 없는 장비명 걸러냄');
const rec = A.eqRecon(L1, '2026-07-20');
const ex = rec.filter(x => x.cat === 'Excavator(crawler)')[0];
ok(ex && ex.used === 8 && ex.given === 10 && ex.idle === 2, `입력8 / 지급10 / 유휴2 → ${ex && ex.flag}`);
ok(ex.flag === 'idle', '유휴는 경고 아님');
const fk = rec.filter(x => x.cat === 'Fork Lift')[0];
ok(fk && fk.flag === 'norec', '지급됐는데 기록 없음 → 미기록 경고');
S.crew.push({ id:'c3', date:'2026-07-20', loc:L1, key:'T-01', teams:1, ppl:{},
              eq:[{cat:'Excavator(crawler)',size:'1.2m3',run:5,brk:0,rep:0}], st:'ok' });
ok(A.eqRecon(L1,'2026-07-20').filter(x=>x.cat==='Excavator(crawler)')[0].flag === 'over',
   '입력이 지급을 넘으면 과다입력 경고');
S.crew.pop();
const lr = A.longRepair(L1);
ok(lr.length === 1 && lr[0].n === 2, `고장·수리 ${A.LONG}일 이상 → 장기 ${lr.length}종 (${lr[0] && lr[0].n}일)`);

/* ── 10 검측 5상태 ────────────────────────────────────── */
console.log('\n[10] 검측');
ok(A.INSP_ST.join() === 'apply,ready,sub,pass,fail,delay', '상태 6단계: 신청·완료확인·제출·합격·불합격·검측지연');
S.insp.push({ id:'i1', date:'2026-07-24', loc:L1, key:'T-04', qty:5000, st:'apply', stAt:'2026-07-24', seq:1, hist:[] });
ok(A.inspList(L1).length === 1, '검측 신청');
A.setInsp('i1', 'ready');
ok(S.insp[0].st === 'ready', '스탭 완료확인 단계');
A.setInsp('i1', 'sub');
A.setInsp('i1', 'fail', '다짐도 미달');
ok(S.insp[0].st === 'fail' && S.insp[0].reason === '다짐도 미달', '불합격 + 사유 기록');
ok(S.insp[0].hist.length === 3, );
const re = A.reInsp('i1');
ok(re && re.seq === 2 && re.re === 'i1', `재검측 생성 — ${re.seq}차, 원건 연결`);
A.setInsp(re.id, 'delay', '측량팀 대기');
ok(A.inspNeedReason('fail') && A.inspNeedReason('delay') && !A.inspNeedReason('pass'),
   '불합격·지연만 사유 필수');
ok(A.inspLong() === 0, '검측 장기경고 제거됨(항상 0)');

/* ── 11 측량 (연동 없음) ──────────────────────────────── */
console.log('\n[11] 측량');
S.surv.push({ id:'s1', date:'2026-07-25', loc:L1, key:'T-01', why:'TBM-7 표고 확인', done:false });
ok(A.survList(L1).length === 1, '측량 등록 — 수량 없음');
ok(A.actQty('T-01', L1) === 60000, '측량은 실적에 영향 없음');
ok(!('qty' in S.surv[0]), '측량 기록에 수량 필드 자체가 없음');

/* ── 12 자재 워크플로 v2 ─────────────────────────────── */
console.log('\n[12] 자재 워크플로 (설계→신청→승인→지급→실사용→증감)');
// 창고자재 설계수량 업로드
const dcsv = 'Phase,Section,대분류,세부공종,자재명,규격,단위,설계수량\n3,1,오수관,오수맨홀,레미콘,fck=31MPa,㎥,100\n';
// 창고자재 하나 골라서 테스트 (플랜트 아닌 것)
const storeM = A.MAT2.filter(m => !m.plant)[0];
const plantM = A.MAT2.filter(m => m.plant)[0];
ok(!!storeM && !!plantM, `창고자재 ${storeM&&storeM.mat} / 플랜트자재 ${plantM&&plantM.mat}`);

// 설계수량 직접 세팅
const idS = A.matId(storeM);
A.setDesign(L1, idS, 500); S.mdesign[A.locKey(L1)][idS]=500;
ok(A.designQty(idS, L1) === 500, '설계수량 위치별 반영 500');

// 창고 신청 → 승인 → 지급
A.addMreq({date:'2026-07-25',loc:L1,grp:storeM.grp,sub:storeM.sub,mat:storeM.mat,spec:storeM.spec,unit:storeM.unit,plant:false,qty:480,by:'업체'});
let mr = A.mreqList(L1,false); ok(mr.length===1 && mr[0].st==='req','창고 신청 → req');
A.mApprove(mr[0].id,'스탭'); ok(mr[0].st==='apv','승인 → apv');
A.mIssue(mr[0].id,450); ok(mr[0].st==='iss' && mr[0].iss===450,'지급 → iss 450');
const vS = A.mVariance(L1,false).filter(x=>x.id===idS)[0];
ok(vS && near(vS.gapIss, 450-500), `창고 증감 지급450−설계500 = ${vS&&vS.gapIss}`);

// 플랜트 신청 → 승인 → 플랜트신청 → 지급 → 실사용
const idP = A.matId(plantM);
S.mdesign[A.locKey(L1)][idP]=300;
A.addMreq({date:'2026-07-25',loc:L1,grp:plantM.grp,sub:plantM.sub,mat:plantM.mat,spec:plantM.spec,unit:plantM.unit,plant:true,qty:280,by:'업체'});
let mp = A.mreqList(L1,true); ok(mp.length===1,'플랜트 신청 1건');
A.mApprove(mp[0].id,'스탭');
A.mPlantReq(mp[0].id); ok(mp[0].st==='plantReq','스탭이 플랜트 신청 → plantReq');
A.mIssue(mp[0].id,290); ok(mp[0].st==='iss','플랜트 지급 → iss');
ok(A.mUseMissing(L1).some(x=>x.id===mp[0].id),'지급됐는데 실사용 미입력 → 경고 대상');
A.mUse(mp[0].id,295); ok(mp[0].use===295,'시공후 실사용 입력 295');
ok(!A.mUseMissing(L1).some(x=>x.id===mp[0].id),'실사용 입력하면 경고 해제');
const vP = A.mVariance(L1,true).filter(x=>x.id===idP)[0];
ok(vP && near(vP.gapUse, 295-300) && vP.use===295, `플랜트 실사용 증감 295−설계300 = ${vP&&(vP.use-vP.design)}`);

// 미승인 / 미지급 사유
A.addMreq({date:'2026-07-25',loc:L1,grp:storeM.grp,sub:storeM.sub,mat:storeM.mat,spec:storeM.spec,unit:storeM.unit,plant:false,qty:10,by:'업체'});
let d2 = A.mreqList(L1,false).filter(x=>x.qty===10)[0];
A.mDeny(d2.id,'설계 초과'); ok(d2.st==='deny' && d2.denyWhy==='설계 초과','미승인 + 사유');
// 메시지 자동전송(테스트 대기열)
ok(S.msgq.length>0 && S.msgq.every(m=>m.test===true), `승인단계 자동전송 대기열 ${S.msgq.length}건(테스트모드)`);

/* ── 13 경고 ──────────────────────────────────────────── */
console.log('\n[13] 경고');
const w = A.warn(L1);
ok(w.inspFail === 1, `불합격 ${w.inspFail}건`);
ok(w.survOpen === 1, `측량 미처리 ${w.survOpen}건`);
ok(w.repLong === 1, `장비 장기 고장·수리 ${w.repLong}종`);
ok(w.eqNoRec === 1, `장비 미기록 ${w.eqNoRec}종`);
ok(w.short >= 1, `자재 지급부족(설계대비) ${w.short}품목`);

/* ── 14 렌더 ──────────────────────────────────────────── */
console.log('\n[14] 6개 탭 렌더');
A.setRole('admin');            // 로그인 없이는 로그인 화면만 뜬다
A.setFlt({ s:'civil', p:3, c:1 });
for (let i = 1; i <= 6; i++) {
  bag.view.innerHTML = '';
  try {
    A.go(i);
    const h = bag.view.innerHTML;
    const bad = /undefined|NaN|\[object Object\]|null%/.test(h);
    const dO = (h.match(/<div\b/g)||[]).length, dC = (h.match(/<\/div>/g)||[]).length;
    const tO = (h.match(/<table\b/g)||[]).length, tC = (h.match(/<\/table>/g)||[]).length;
    ok(h.length > 400 && !bad && dO === dC && tO === tC,
      `탭${i} ${A.T('t'+i)} — ${h.length}자 · div ${dO}/${dC} · table ${tO}/${tC}${bad ? ' ← undefined/NaN' : ''}`);
    if (bad) console.log('        ', (h.match(/.{0,70}(undefined|NaN|\[object Object\]|null%).{0,70}/)||[])[0]);
  } catch (e) { ok(false, `탭${i} 예외: ${e.message}`); }
}

console.log('\n[15] 부대토목 위치 렌더');
A.setFlt({ s:'anc', t:'B', b:5 });
for (let i = 1; i <= 6; i++) {
  try { A.go(i); ok(bag.view.innerHTML.length > 200, `탭${i} Town B · Block 5 정상`); }
  catch (e) { ok(false, `탭${i} 예외: ${e.message}`); }
}

console.log('\n[16] 빈 상태 · 영문 렌더');
['plan','fac','matmap'].forEach(k => S[k] = {});
['work','crew','insp','surv','mat','issue','msg'].forEach(k => S[k] = []);
A.setFlt({ s:'civil', p:0, c:0 });
for (let i = 1; i <= 6; i++) {
  try { A.go(i); ok(bag.view.innerHTML.length > 200, `탭${i} 빈 상태`); }
  catch (e) { ok(false, `탭${i} 빈 상태 예외: ${e.message}`); }
}
S.lang = 'en';
for (let i = 1; i <= 6; i++) {
  try { A.go(i); ok(bag.view.innerHTML.length > 200, `탭${i} EN`); }
  catch (e) { ok(false, `탭${i} EN 예외: ${e.message}`); }
}


console.log('\n[17] 언어 순수성 — UI 라벨에 한국어가 남아 있으면 안 된다');
// 층3(사전 미구축: 공종명·자재명)과 사용자 입력 원문은 한국어가 맞다 → 제외 목록을 만든다
const allowKR = new Set();
function feed(t) {
  String(t || '').split(/[\s·/(),\[\]|=+-]+/).forEach(w => { if (/[가-힣]/.test(w)) allowKR.add(w); });
}
// 층3 중 번역 완료분(공종 grp·mid·name / 자재 grp·sub·mat)은 예외에서 제외 → 미번역 잔존 시 잡는다
// spec(규격·치수)·사용자 입력·위치(SITES)·시설(FACS)은 원문 유지 → 예외
A.LIST.forEach(e => { feed(e.spec); });
(A.MAT2 || []).forEach(m => { feed(m.spec); });
A.FACS.forEach(f => feed(f.ko));
A.SITES.forEach(x => feed(x.ko));
S.mreq.forEach(r => { feed(r.denyWhy); feed(r.noissWhy); feed(r.by); });
S.insp.forEach(r => { feed(r.reason); feed(r.by); feed(r.note); });
S.surv.forEach(r => { feed(r.why); feed(r.by); });
S.work.forEach(r => feed(r.by));
S.crew.forEach(r => feed(r.by));

['en','bn'].forEach(lg => {
  S.lang = lg;
  for (let i = 1; i <= 6; i++) {
    A.go(i);
    const h = bag.view.innerHTML.replace(/<[^>]+>/g, ' ');
    const words = (h.match(/[가-힣]+/g) || []).filter(w => !allowKR.has(w));
    ok(words.length === 0,
      `${lg} 탭${i} UI 한국어 ${words.length ? [...new Set(words)].slice(0,8).join(',') : '없음'}`);
  }
});
S.lang = 'ko';

/* ── 18 헤더 버튼 언어전환 (index 정적 헤더가 tabs.js로 갱신되는지) ── */
console.log('\n[18] 헤더 버튼 언어전환 — EN/BN 헤더 버튼에 한국어가 남으면 안 된다');
['en', 'bn'].forEach(lg => {
  S.lang = lg; A.render();
  [['협력업체입력 버튼', 'vendorBtn'], ['초기화 버튼', 'wipe']].forEach(([nm, id]) => {
    const t = String(bag[id].textContent || '');
    ok(!/[가-힣]/.test(t), `${lg} ${nm} 한국어 없음${t ? ' (' + t + ')' : ''}`);
  });
});
S.lang = 'ko'; A.render();

/* ── 19 i18n 키 무결성 (T('키')가 사전에 다 있어야 — plan_n류 키노출 차단) ── */
console.log('\n[19] i18n 키 무결성 — 소스에서 쓰는 T() 키가 사전에 전부 있어야');
{
  const koKeys = new Set(Object.keys(sb.I18N.ko));
  const miss = new Set();
  ['tabs', 'core'].forEach(f => {
    const src = fs.readFileSync(path.join(ROOT, 'assets/js', f + '.js'), 'utf8');
    let m; const re = /(?:A\.)?T\(\s*'([A-Za-z_][\w]*)'\s*\)/g;   // 완전 리터럴 키만 (동적 'm_'+ 등 제외)
    while ((m = re.exec(src))) { if (!koKeys.has(m[1])) miss.add(m[1]); }
  });
  ok(miss.size === 0, miss.size ? '미등록 키: ' + [...miss].join(',') : '모든 T() 키가 사전에 있음');
}

/* ── 20 index.html 정적 한국어 0 (헤더/버튼 하드코딩 재발 방지) ── */
console.log('\n[20] index.html 정적 한국어 0 — 하드코딩 한국어 재발 방지');
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const kr = html.match(/[가-힣]+/g) || [];
  ok(kr.length === 0, kr.length ? '정적 한국어 잔존: ' + [...new Set(kr)].slice(0, 8).join(',') : '정적 한국어 없음');
}

/* ── 21 다운로드 파일명 언어전환 (EN/BN에서 한국어 파일명으로 저장되면 안 된다) ── */
console.log('\n[21] 다운로드 파일명 — EN/BN에서 한국어 파일명이 나오면 안 된다');
{
  const src = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  const hard = [...src.matchAll(/A\.dl\(\s*'([^']*[가-힣][^']*)'/g)].map(m => m[1]);
  ok(hard.length === 0, hard.length ? '하드코딩 한국어 파일명: ' + hard.join(',') : 'A.dl() 파일명 하드코딩 없음');
  const keys = ['f_plan','f_eqtpl','f_rate','f_roll','f_insp','f_surv','f_dscivil','f_dsanc','f_mreq','f_mvar','f_sched'];
  ['en','bn'].forEach(lg => {
    S.lang = lg;
    const kr = keys.filter(k => /[가-힣]/.test(A.T(k)));
    ok(kr.length === 0, `${lg} 파일명 한국어 ${kr.length ? kr.join(',') : '없음'}`);
  });
  S.lang = 'ko';
}

/* ── 22 소스 하드코딩 한국어 리터럴 (표시 문자열이 코드에 박히면 안 된다) ── */
console.log('\n[22] 하드코딩 한국어 리터럴 — 표시 문자열은 i18n/번역표에 있어야');
{
  // 데이터 정의(ko: 필드)·로직 비교값은 정상 → 허용 목록
  const allow = /(?:\bko\s*:|===|!==|\.src\s*===)/;
  const hits = [];
  ['tabs', 'core', 'vendor'].forEach(f => {
    const raw = fs.readFileSync(path.join(ROOT, 'assets/js', f + '.js'), 'utf8');
    // 블록 주석은 줄 수를 보존하며 제거(행번호 유지), 이후 줄 주석 제거
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
    src.split('\n').forEach((line, i) => {
      const code = line.split('//')[0];
      if (allow.test(code)) return;
      const m = code.match(/'(?:[^'\\]|\\.)*[\uac00-\ud7a3](?:[^'\\]|\\.)*'/g);
      if (m) m.forEach(v => hits.push(`${f}.js:${i + 1} ${v}`));
    });
  });
  ok(hits.length === 0, hits.length ? '하드코딩: ' + hits.slice(0, 6).join(' | ') : '하드코딩 한국어 없음');
}

console.log('\n[23] 서버 수신·병합 — 중복 없이 합치고, 확인한 것은 되돌리지 않는다');
{
  const API = sb.BNCP_API;
  ok(!!API && typeof API.rows === 'function', 'rows() 있음');
  ok(typeof A.sync === 'function', 'A.sync() 노출됨');

  // 병합 규칙을 tabs.js의 unpack/syncNow와 같은 방식으로 재현해 검증한다
  const merge = (store, rows) => {
    const have = {}; store.forEach(w => { have[w.id] = 1; });
    let add = 0;
    rows.forEach(r => {
      if (have[r.id]) return;
      const loc = r.s === 'civil' ? { s: 'civil', p: +r.p, c: +r.c }
                : r.s === 'anc'   ? { s: 'anc', t: r.t, b: +r.b } : null;
      if (!loc || !r.id || !r.key) return;
      store.push({ id: r.id, date: r.date, loc, key: r.key, qty: +r.qty || 0, st: r.st || 'sub', up: 1 });
      have[r.id] = 1; add++;
    });
    return add;
  };

  const it = A.LIST.find(e => e.kind === 'C');
  const box = [{ id: 'A1', date: '2026-08-13', loc: { s: 'civil', p: 1, c: 1 }, key: it.key, qty: 10, st: 'ok' }];
  const srv = [
    { id: 'A1', type: 'work', date: '2026-08-13', s: 'civil', p: 1, c: 1, key: it.key, qty: 10, st: 'sub' },
    { id: 'B2', type: 'work', date: '2026-08-13', s: 'civil', p: 1, c: 1, key: it.key, qty: 25, st: 'sub' },
    { id: 'C3', type: 'work', date: '2026-08-13', s: 'anc', t: 'B', b: 5, key: it.key, qty: 7, st: 'sub' }
  ];
  const n = merge(box, srv);
  ok(n === 2, `새 건만 추가 (${n}건)`);
  ok(box.length === 3, '중복 id는 추가되지 않음');
  ok(box[0].st === 'ok', '이미 확인(ok)한 건이 sub로 되돌아가지 않음');
  ok(A.locKey(box[2].loc) === A.locKey({ s: 'anc', t: 'B', b: 5 }), '부대토목 위치 복원 정상');
  ok(merge(box, srv) === 0, '같은 응답을 또 받아도 늘지 않음(멱등)');

  // 위치 구성요소가 없으면 버린다(라벨 파싱에 기대지 않는다)
  const bad = [{ id: 'D4', type: 'work', date: '2026-08-13', loc: 'Phase 1-1', key: it.key, qty: 1 }];
  ok(merge(box, bad) === 0, '위치 구성요소 없는 행은 버림');

  // 수신 실패(전송수단 없음)해도 예외 없이 넘어가야 한다
  let threw = false;
  try { A.sync(true); } catch (e) { threw = true; }
  ok(!threw, '수신 실패해도 예외 없음');
}

console.log('\n[24] 종류 확장 — 6종(실적·인원장비·검측·측량·자재·직영) 전송·수신');
{
  const vsrc = fs.readFileSync(path.join(ROOT, 'assets/js/vendor.js'), 'utf8');
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');

  // 협력업체 5종이 모두 전송에 연결되어 있어야
  ['work', 'crew', 'insp', 'surv', 'mat'].forEach(t => {
    ok(new RegExp(`toServer\\('${t}'`).test(vsrc), `협력업체 ${t} 전송 연결됨`);
  });
  ok(/txDirect\(drow\)/.test(tsrc), '직영(탭7) 전송 연결됨');

  // 관리자 수신이 6종을 복원해야
  ['work', 'crew', 'insp', 'surv', 'mat', 'direct'].forEach(t => {
    ok(new RegExp(`r\\.type === '${t}'`).test(tsrc), `수신 ${t} 복원 있음`);
  });
  /* ★v2.19.3 — 전체를 매번 받지 않는다. 바뀐 게 있는지 먼저 묻고,
     있을 때만 그 뒤에 들어온 줄만 받는다(api.changed). */
  ok(/api\.changed\(\)/.test(tsrc), '★바뀐 것만 받는다');
  {
    const asrc = fs.readFileSync(path.join(ROOT, 'assets/js/api.js'), 'utf8');
    ok(/API\.changed = function/.test(asrc) && /API\.meta = function/.test(asrc),
       'meta 확인 + 증분 조회가 있다');
    ok(/return API\.rows\('', API\.last \|\| ''\)/.test(asrc), '한 번의 요청으로 전 종류를 받는다');
    ok(/m\.last === API\.last\) return \[\]/.test(asrc),
       '★바뀐 게 없으면 본문을 안 받는다');
    ok(/if \(d\.last\) API\.last = d\.last;/.test(asrc),
       '★서버 시계를 쓴다 — 내 시계와 어긋나면 그 사이 줄을 건너뛴다');
  }

  // 수신 병합이 6개 저장소를 모두 다뤄야
  ['work', 'crew', 'insp', 'surv', 'mreq', 'direct'].forEach(b => {
    ok(new RegExp(`${b}:\\s*S\\.${b}`).test(tsrc), `병합 대상에 S.${b} 포함`);
  });

  // 미전송 집계가 5종을 훑어야(협력업체)
  ok(/S\.mreq;/.test(vsrc) && /SETS/.test(vsrc), '미전송 집계가 5종 전체를 훑음');

  // addMreq가 생성 항목을 돌려줘야 전송에 연결된다
  const before = S.mreq.length;
  const m2 = A.addMreq({ date: '2026-08-13', loc: { s: 'civil', p: 1, c: 1 },
                         grp: 'g', sub: 's', mat: 'm', unit: 'ea', qty: 3, by: 'x' });
  ok(!!(m2 && m2.id), 'addMreq가 생성 항목을 반환함');
  ok(S.mreq.length === before + 1, '자재 신청 저장됨');

  // 자재·직영 수신 복원 형태 확인(병합 규칙 재현)
  const rows = [
    { id: 'M1', type: 'mat', date: '2026-08-13', s: 'civil', p: 1, c: 1,
      grp: 'g', sub: 's', mat: 'm', unit: 'ea', qty: 5, st: 'req' },
    { id: 'X1', type: 'direct', date: '2026-08-13', s: 'anc', t: 'C', b: 2,
      name: 'site clearing', teams: 2, ppl: { eng: 0, fmn: 1, wkr: 4 }, eq: [], st: 'sub' }
  ];
  ok(rows.every(r => (r.s === 'civil' || r.s === 'anc')), '자재·직영도 위치 구성요소를 갖는다');
  ok(/box\[u\.box\]\.push/.test(tsrc), '종류별 저장소로 나눠 넣는다');
  /* ★v2.18.6 — 「한 번만 받는다」에서 「상태가 앞선 쪽을 남긴다」로 바뀌었다.
     내가 확인해 둔 것을 서버의 옛 값이 되돌리면 확인 대기로 되살아난다. */
  ok(/function older\(local, r\)/.test(tsrc), '★서버 값이 더 오래됐는지 본다');
  ok(/if \(older\(cur, r\)\) return;/.test(tsrc), '★내 것이 앞서면 안 덮어쓴다');
  ok(/if \(cur\.st !== u2\.row\.st \|\| cur\.done !== u2\.row\.done\)/.test(tsrc),
     '서버가 더 앞서면 상태만 갱신한다');
}

console.log('\n[25] 확인 필요 — 기준 생산성 대비 과다 실적만 골라낸다');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  ok(/function chkRows/.test(tsrc), '과다 판정 있음');
  ok(/e\.pteam/.test(tsrc), '이라크 기준 생산성(pteam)을 기준으로 삼는다');
  ok(/if \(!teams\) teams = 1/.test(tsrc), '인원장비 미제출은 1조로 본다(미제출도 함께 잡힌다)');
  ok(/if \(!rate\) return/.test(tsrc), '기준 없는 공종은 판정하지 않는다');
  ok(/w\.ckOk/.test(tsrc), '확인 완료한 건은 다시 뜨지 않는다');
  ok(/S\.ckMul \|\| 1\.5/.test(tsrc), '경고 배수 기본 1.5배·조정 가능');
  ok(!/return say|blocked/.test(tsrc.slice(tsrc.indexOf('function chkRows'), tsrc.indexOf('function chkHTML'))),
     '과다는 막지 않고 표시만 한다(장비 증투·야간작업은 정상)');

  // 실제 판정
  const it = A.LIST.find(e => e.pteam);
  ok(!!it, `기준 생산성 있는 공종 존재 (${it && it.name} ${it && it.pteam})`);
  ok(!!A.vendLoad, '명부 로더 노출됨');
  ok(/function vendPanel/.test(tsrc) && /A\.vendUrl/.test(tsrc), '업체별 링크를 관리자 화면에서 확인');
  // v2.16.0 — 링크는 전체 주소로. 'vendor.html?c=..'만 보내면 상대 휴대폰에서 안 열린다
  ok(typeof A.vendUrl === 'function', '전체 주소 생성 함수 있음');
  ok(/vendor\.html\?c=/.test(A.vendUrl('AB-1')), '주소에 업체키가 붙는다');
  ok(A.vendUrl('AB-1').indexOf('vendor.html') > 0 || A.vendUrl('AB-1').indexOf('vendor.html') === 0,
     '경로가 현재 화면 위치에서 나온다');
  ok(!/esc\('vendor\.html\?c=' \+ v\.key\)/.test(tsrc), '반쪽 링크를 그대로 보여주지 않는다');
  ok(/data-vcopy=/.test(tsrc), '복사 버튼 있음');
  ok(/document\.execCommand\('copy'\)/.test(tsrc), '옛 브라우저에서도 복사된다');
  // v2.15.4 — 명부는 손으로도 넣을 수 있어야 한다(사용자 지시)
  ok(typeof A.vendAdd === 'function' && typeof A.vendDel === 'function', '명부 수동 추가·삭제 있음');
  {
    const before = S.vend.length;
    ok(A.vendAdd('', 'X').ok === false, '코드 없이는 안 들어간다');
    ok(A.vendAdd('TCO', 'Test Co', 'Ali').ok === true, '손으로 한 곳 추가');
    const v = A.vendByCode('TCO');
    ok(!!v && v.key && v.staff[0] === 'Ali', '링크 키가 발급되고 담당자가 붙는다');
    const k0 = v.key;
    A.vendAdd('TCO', 'Test Co', 'Omar');
    ok(A.vendByCode('TCO').staff.length === 2, '같은 코드면 담당자만 더한다');
    ok(A.vendByCode('TCO').key === k0, '★링크는 바뀌지 않는다 — 현장이 쓰던 주소가 죽으면 안 된다');
    A.vendStaffDel('TCO', 'Omar');
    ok(A.vendByCode('TCO').staff.length === 1, '담당자만 지운다');
    A.vendDel('TCO');
    ok(S.vend.length === before, '업체를 지운다');
  }
}

console.log('\n[26] 탭 분리 · 합계 · 공종 상세');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');

  // 탭 분리 — 실적(누계)과 인원·장비(오늘)가 섞이면 잘못 읽힌다
  ok(!/8: v8/.test(tsrc), '탭8 삭제됨 — 내용은 탭1로 흡수(v2.13.0)');
  ok(/\[1, 2, 3, 4, 5, 6, 7\]\.filter/.test(tsrc), '탭 버튼 7개');
  ok(/ro_out/.test(tsrc) && /ro_ppl/.test(tsrc) && /eq_st/.test(tsrc), '작업량·인원투입·장비 세 표');
  ok(/panelHTML/.test(tsrc) && /function eqHTML/.test(tsrc), '현황판·장비가 탭1에 있다');
  // v2.15.0 — 막대는 뺐다. 단위가 다른 공종을 막대로 견주는 건 뜻이 없었다(사용자 지시)
  ok(!/barCell/.test(tsrc), '막대 그래프 없음 (v2.15.0에서 제거)');
  ok(/roIsOpen/.test(tsrc) && /byGrp/.test(tsrc), '대분류로 접힌다 — 우수/오수 되메우기 구분');
  ok(/data-ro=/.test(tsrc), '대분류 행을 눌러 펼친다');

  // 합계 행 — 단위가 다른 수량은 더하지 않는다
  ok(/<tfoot><tr class="tot">/.test(tsrc), '합계 행 있음');
  const pt = tsrc.slice(tsrc.indexOf('function progTable'), tsrc.indexOf('function detailHTML'));
  const foot = pt.slice(pt.indexOf('<tfoot>'));
  ok(!/nf\(sumPlan|nf\(sumAct/.test(foot), '합계 행에 수량 합계를 넣지 않는다(단위 상이)');
  ok(/hasPlan/.test(foot) && /pf\(avg\)/.test(foot), '항목 수와 진행률 평균만 낸다');
  ok(/T\('done'\)/.test(tsrc), '실적 열은 그대로 있다');

  // 장비 상태 2단계
  ok(/function eqDown/.test(tsrc), '고장 = brk + rep 합산');
  ok(/x\.brk \|\| 0\) \+ \(\+x\.rep/.test(tsrc), '옛 수리(rep) 값도 고장으로 센다');

  // 누계
  ok(/function resAgg/.test(tsrc), '기간 집계 함수 있음');
  ok(/S\.direct\.forEach/.test(tsrc), '직영도 투입에 포함');

  // 상세 팝오버
  ok(/function detailHTML/.test(tsrc) && /function bindDetail/.test(tsrc), '공종 상세 있음');
  ok(/mousemove/.test(tsrc) && /> 900/.test(tsrc), '마우스가 30px 움직이면 닫힌다');
  ok(/data-detail=/.test(tsrc), '행 클릭으로 열린다');
}

console.log('\n[27] 정비 의뢰 — 스탭이 의뢰 여부만 체크, 장기건은 사유');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  ok(/function mtRows/.test(tsrc), '고장 장비 추적 있음');
  /* v2.30.0 — 회사 기준이 `by`(담당자)에서 `co`(회사, by 폴백)로 바뀌었다 (요청 ①)
     ★이후 `co || by` 폴백이 담당자 이름을 업체로 세우는 사고를 냈다([91]).
       이제 업체는 명부(Master)를 거쳐 A.coOf가 정한다 — 검사도 그리로 옮긴다.
       ★통과시키려고 고친 것이 아니라 **업체를 읽는 길이 바뀌어** 고친 것이다.
         이 검사의 뜻은 종전 그대로다 : 묶는 단위가 회사+종류+규격이고
         장비 **개별 번호로는 추적하지 않는다.** */
  ok(/A\.coOf\(c[\s\S]{0,80}\+ '\|' \+ x\.cat/.test(tsrc), '회사+종류+규격 단위로 추적(개별 번호 없음)');
  ok(/cco \+ '\|' \+ x\.cat \+ '\|' \+ \(x\.size/.test(tsrc), '묶는 열쇠에 규격까지 들어간다');
  ok(/MT_LONG = 7/.test(tsrc), '7일 이상이면 장기');
  // v2.15.0 — 체크박스는 끝나는 지점이 없어 계속 떠 있었다(사용자 지적) → 단계로 바꿈
  ok(!/data-mtreq=/.test(tsrc), '체크박스 없음 (v2.15.0에서 단계로 대체)');
  ok(/data-mtstep=/.test(tsrc), '의뢰→접수→수리중→완료 단계 선택');
  ok(/o\.step !== 'done'/.test(tsrc), '완료건은 목록에서 내려간다');
  ok(/m\.long && m\.step && m\.step !== 'done'/.test(tsrc), '장기 미해결이면 사유칸이 열린다');
  ok(!/사유.*필수|required/.test(tsrc.slice(tsrc.indexOf('function mtHTML'), tsrc.indexOf('function v8'))),
     '사유는 강제하지 않는다(우리 소관이 아니다)');
  ok(/S\.mt/.test(tsrc), '의뢰 상태를 저장한다');
  ok(A.S.mt !== undefined, 'S.mt 기본값 있음');
}

console.log('\n[28] 권한 — 스탭/관리자, 로그인 없으면 아무것도 안 보인다');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');

  // 로그인 게이트
  /* ★v2.20.0에서 뒤집었다 — 종전 검사는 `!A.isStaff()`를 **통과 조건으로
     못 박고** 있었다. 그 조건이 유지되면 측량팀은 비밀번호가 맞아도 영영
     못 들어온다(측량팀은 스탭이 아니다). isIn()이 맞는 문지기다. */
  ok(/if \(!A\.isIn\(\)\)/.test(tsrc), '로그인 전에는 로그인 화면만');
  ok(!/if \(!A\.isStaff\(\)\) \{/.test(tsrc), '★스탭 여부로 문을 막지 않는다');
  ok(/function loginHTML/.test(tsrc), '로그인 화면 있음');
  const asrc = fs.readFileSync(path.join(ROOT, 'assets/js/api.js'), 'utf8');
  ok(/API\.login/.test(asrc), '로그인은 서버가 검사한다');
  const gs = fs.readFileSync(path.join(ROOT, 'tools/AppsScript_Code.gs'), 'utf8');
  ok(/PropertiesService/.test(gs) && /PW_ADMIN/.test(gs), '비밀번호는 스크립트 속성에 둔다');
  ok(!/PW_ADMIN\s*=\s*['\"]/.test(gs), '서버 코드에 비밀번호가 적혀 있지 않다');
  const lgSrc = tsrc.slice(tsrc.indexOf('function loginHTML'), tsrc.indexOf('function v1'));
  ok(!/pw\.value\s*===|pw\s*===\s*['"]/.test(lgSrc), '화면 코드에서 비밀번호를 대조하지 않는다(서버가 한다)');
  ok(/api\.login\(pw\.value\)/.test(lgSrc), '입력값을 서버로 보내 확인받는다');

  // 등급별 판정
  A.setRole('staff');
  ok(A.isStaff() && !A.isAdmin(), '스탭 등급');
  ['deny', 'approve', 'prod', 'recon', 'stock', 'notice', 'sched', 'print'].forEach(k => {
    ok(A.can(k) === false, `스탭은 ${k} 불가`);
  });
  ok(A.can('confirm') === true, '스탭도 확인은 가능(인수인계서 344행)');

  A.setRole('admin');
  ok(A.isAdmin(), '관리자 등급');
  ['deny', 'prod', 'recon', 'stock', 'notice', 'sched', 'print'].forEach(k => {
    ok(A.can(k) === true, `관리자는 ${k} 가능`);
  });

  // 화면 반영
  ok(/i === 5\) return A\.can\('notice'\)/.test(tsrc), '알림·전파는 스탭에게 감춘다');
  // v2.16.0 — 공정표는 이제 모두에게 감춰진다. 되살릴 때 권한 조건이 남아 있어야 한다
  ok(/i === 6\) return SCHED_ON && A\.can\('sched'\)/.test(tsrc),
     '공정표를 되살려도 스탭에게는 감춰진다 (권한 조건 보존)');
  ok(/A\.can\('prod'\)/.test(tsrc), '생산성 분석 감춤');
  ok(/A\.can\('recon'\)/.test(tsrc), '장비 지급대조 감춤');
  ok(/A\.can\('stock'\)/.test(tsrc), '자재 재고·증감 감춤');
  ok(/A\.can\('deny'\)/.test(tsrc), '반려 버튼 감춤');
  ok(/nocopy/.test(tsrc), '스탭 화면 인쇄·복사 차단');

  // 스탭 화면에 실제로 안 나오는지
  A.setRole('staff'); A.go(4);
  const h4 = bag.view.innerHTML;
  ok(!/data-mdeny/.test(h4), '스탭 자재화면에 반려 버튼 없음');
  A.setRole('admin'); A.go(1);
}

/* ── 91 업체 Master — 명부 2곳인데 집계가 3곳이던 것 ──────
   ★사고 : 명부에 업체가 2곳뿐인데 인원·장비 집계에는 3곳이 섰다(사용자 지적).
     집계가 업체를 `co || by`로 읽는데, 담당자 배정(v2.19.2) 이후 `by`는
     **담당자 이름**이다. `co`가 없는 옛 crew 기록 하나가 담당자 이름으로
     업체 한 줄을 만들었고, 그 줄은 지급(보유) 축에는 없어 두 축이 어긋났다.
   ★고침 : A.vendFind / A.coOf — 명부(S.vend)를 업체 Master로 삼아
     업체명·코드·**담당자 이름**을 그 업체 한 줄로 되묶는다.
   ★이 검사는 옛 코드(`c.co || c.by`)로 되돌리면 실패한다 — 확인함. */
console.log('\n[91] 업체 Master — 담당자 이름이 업체로 서지 않는다');
{
  const keepVend = S.vend.slice(), keepCrew = S.crew.slice(),
        keepIssue = S.issue.slice(), keepFlt = A.coFlt;
  S.vend.length = 0; S.crew.length = 0; S.issue.length = 0; A.coFlt = '';

  const LC = { s: 'civil', p: 1, c: 1 }, td = A.today();
  A.vendAdd('KEW', 'KEW Company', '토공|Ahmed|964770000001');
  A.vendAdd('DIG', 'Diglah Trading', '우수공|Ali|964770000002');

  /* ★존재 확인을 맨 앞에 둔다 (0-W의 교훈) — 옛 파일로 되돌렸을 때 예외로
     검사가 통째로 죽으면 어느 줄이 왜 실패했는지 안 보인다. 한 줄로 깨끗이
     실패시키고 나머지는 건너뛴다. */
  const hasAPI = (typeof A.vendFind === 'function' && typeof A.coOf === 'function');
  ok(hasAPI, 'A.vendFind · A.coOf 존재');
  if (!hasAPI) {
    ok(false, '★업체 Master 해석 계층이 없다 — 아래 검사를 건너뛴다');
  } else {

  // 되묶기 — 이름 변형·코드·담당자
  ok(A.vendFind('K.E.W  company') && A.vendFind('K.E.W  company').code === 'KEW',
     '이름 변형(K.E.W)이 한 업체로');
  ok(A.vendFind('KEW') && A.vendFind('KEW').code === 'KEW', '업체코드로도 찾는다');
  ok(A.vendFind('Ahmed') && A.vendFind('Ahmed').code === 'KEW',
     '★담당자 이름 → 그 사람의 업체');
  ok(A.vendFind('KEW Trading') === null, '비슷하지만 다른 이름은 안 붙는다');

  // 실제 집계 — 명부 2곳이면 줄도 2곳
  S.crew.push({ id: 'q1', date: td, loc: LC, key: 'T-01', st: 'ok', teams: 1,
    ppl: { eng: 0, fmn: 1, wkr: 5 }, eq: [{ cat: 'Dump Truck', size: '15ton', run: 2, brk: 0, rep: 0 }],
    by: 'Ahmed', co: 'KEW Company' });
  S.crew.push({ id: 'q2', date: td, loc: LC, key: 'T-01', st: 'ok', teams: 1,
    ppl: { eng: 0, fmn: 1, wkr: 4 }, eq: [], by: 'Ahmed' });          /* 옛 자료 — co 없음 */
  S.crew.push({ id: 'q3', date: td, loc: LC, key: 'SS-01', st: 'ok', teams: 1,
    ppl: { eng: 0, fmn: 1, wkr: 3 }, eq: [], by: 'Ali', co: 'Diglah Trading' });

  const gs = A.rollupCo(null);
  ok(gs.length === 2, `★업체 줄이 2개다 (실제 ${gs.length}) — 담당자 이름 줄이 안 선다`);
  ok(!gs.some(g => g.co === 'Ahmed'), '담당자 이름(Ahmed)이 업체 줄로 서지 않는다');
  const kew = gs.filter(g => g.co === 'KEW Company')[0];
  /* q1 = 포맨1+워커5 + 운전원2 = 8 · q2(co 없는 옛 줄) = 포맨1+워커4 = 5 */
  ok(kew && kew.rows.reduce((t, r) => t + r.pplT, 0) === 13,
     '★co 없는 옛 줄의 인원이 그 업체에 합쳐진다 (8+5=13)');

  // 두 축(실적·지급)이 같은 이름에서 만난다
  A.setEqQty(LC, 'Dump Truck', '15ton', 'give', 5, 'KEW Company');
  const gby = {};
  A.eqRecon(null).forEach(r => Object.keys(r.gby || {}).forEach(c => gby[c] = 1));
  ok(gby['KEW Company'], '지급 축도 같은 정식 업체명으로 선다');

  // 현장 현황 칸
  const sr = A.siteRows(null, td);
  const cos = {}; sr.forEach(r => Object.keys(r.co).forEach(c => cos[c] = 1));
  ok(!cos['Ahmed'] && cos['KEW Company'], '현장 현황 업체 칸에도 담당자 이름이 없다');

  // ★명부가 있으면, 못 찾은 이름은 사람 이름을 회사 자리에 내보내지 않는다
  //   (v2.45.0 사용자 지시 「이름이 들어가지 않도록」 — 종전엔 원문 유지였다).
  ok(A.coOf({ co: 'Unknown Sub Co' }) === A.T('e_nocomp'),
     '★명부에 없는 이름은 「미등록 업체」로 뜬다(사람 이름이 회사 자리에 안 나온다)');
  ok(A.coOf({ by: 'Ahmed' }) !== 'Ahmed',
     '★담당자 개인 이름은 회사 자리에 절대 안 나온다');

  // 직영은 업체로 섞이지 않는다
  ok(A.coOf({ by: '이과장' }, true) === A.T('res_dir'), '직영은 직영 줄로 간다');

  // 업체 필터가 옛 담당자이름 줄까지 잡는다
  A.coFlt = 'KEW Company';
  ok(S.crew.filter(c => A.inCo(c)).length === 2,
     '★업체 필터에 co 없는 옛 줄도 함께 걸린다');
  A.coFlt = 'Diglah Trading';
  ok(S.crew.filter(c => A.inCo(c)).length === 1, '다른 업체로 거르면 그 업체 것만');
  A.coFlt = '';

  /* ★조회 색인을 캐시한다(집계마다 줄 수만큼 불리는 자리라 재 보고 넣었다).
     캐시는 「고쳤는데 화면이 옛것」을 만드는 전형적인 자리다 — 명부를 고치는
     길마다 색인이 따라오는지 검사로 붙들어 둔다. */
  S.vend.length = 0; S.crew.length = 0;
  A.vendAdd('KEW', 'KEW Company', '토공|Ahmed|964770000001');
  ok(A.vendFind('Ahmed') && A.vendFind('Ahmed').code === 'KEW', '캐시① 담당자로 찾힌다');
  A.vendAdd('KEW', 'KEW Company', '우수공|Hassan|964770000009');
  ok(A.vendFind('Hassan') && A.vendFind('Hassan').code === 'KEW',
     '★캐시② 담당자를 더하면 바로 찾힌다(줄 수는 그대로)');
  A.vendAdd('KEW', 'KEW Contracting');
  ok(A.coOf({ co: 'Ahmed' }) === 'KEW Contracting',
     '★캐시③ 상호를 바꾸면 집계 이름도 따라온다');
  A.vendAdd('DIG', 'Diglah Trading', '우수공|Ali|964770000002');
  ok(A.vendFind('Ali') && A.vendFind('Ali').code === 'DIG', '캐시④ 업체를 더하면 찾힌다');
  if (typeof A.vendDel === 'function') {
    A.vendDel('DIG');
    ok(A.vendFind('Ali') === null, '★캐시⑤ 업체를 지우면 담당자도 안 찾힌다');
  }
  S.vend.push({ code: 'RAW', name: 'Raw Pushed Co', staff: [], key: 'x' });
  ok(A.vendFind('Raw Pushed Co') && A.vendFind('Raw Pushed Co').code === 'RAW',
     '★캐시⑥ save를 안 거쳐도 줄 수가 달라지면 다시 만든다');

  // 명부가 비어도 죽지 않는다
  S.vend.length = 0;
  ok(A.coOf({ co: 'AnyCo' }) === 'AnyCo', '명부가 비어도 원문을 유지한다');

  }   /* hasAPI */

  S.vend.length = 0; keepVend.forEach(v => S.vend.push(v));
  S.crew.length = 0; keepCrew.forEach(c => S.crew.push(c));
  S.issue.length = 0; keepIssue.forEach(g => S.issue.push(g));
  A.coFlt = keepFlt;
}

/* ── 92 화면에서 군더더기를 뺀다 (요청 ⑭·⑯) ─────────────
   ★사용자 지시 : 「화면에는 실제 관리에 필요한 정보만 간결하게 표시하고,
     상세한 사용방법과 시스템 설명은 별도 사용자 매뉴얼로 뺀다.」
   ★이 검사를 [29] **앞**에 둔 이유 — [29]부터는 저장소에 없는 표본 파일을
     읽어 거기서 멈춘다. 뒤에 두면 검사가 아예 안 돌아 거짓 안심이 된다. */
console.log('\n[92] 군더더기 제거 — 설명 문구 · 「N개 공종」 오표기 · 플랜트 재고칸');
{
  const keepVend = S.vend.slice(), keepCrew = S.crew.slice(),
        keepIssue = S.issue.slice(), keepMreq = S.mreq.slice();
  const keepRole = A.role ? A.role() : 'admin', keepFlt = A.flt ? A.flt() : null;
  S.vend.length = 0; S.crew.length = 0; S.issue.length = 0; S.mreq.length = 0;
  A.coFlt = ''; A.setRole('admin');

  const LZ = { s: 'civil', p: 1, c: 1 }, tz = A.today();
  A.setFlt(LZ);
  A.vendAdd('LUU', 'LUU Company', '토공|Kim|964770000001');
  S.crew.push({ id: 'z1', date: tz, loc: LZ, key: 'T-01', st: 'ok', teams: 1,
    ppl: { eng: 0, fmn: 1, wkr: 2 }, co: 'LUU Company', by: 'Kim',
    eq: [{ cat: 'Dump Truck', size: '25ton', run: 6, brk: 1, rep: 0 },
         { cat: 'Excavator (crawler)', size: '0.8m3', run: 2, brk: 0, rep: 0 },
         { cat: 'Motor Grader', size: '12ft', run: 1, brk: 0, rep: 0 }] });
  A.setEqQty(LZ, 'Dump Truck', '25ton', 'give', 8, 'LUU Company');

  A._grpBy('co'); A.go(1);
  const hz = bag.view.innerHTML;
  ok(hz.indexOf(A.T('eq_st')) > 0, '장비 표가 그려진다(기준 확보)');

  /* ⑭-1 설명 문구 — 만든 사람의 사정이지 보는 사람이 확인할 것이 아니다 */
  ok(hz.indexOf('위치 필터를 따르지 않는다') < 0,
     '★설명 문구(보유는 업체 축이라…)가 화면에 없다');
  ok(hz.indexOf('eq_co_n') < 0, '지운 키가 날글자로 새지 않는다');
  ok(!/eq_co_n/.test(fs.readFileSync(path.join(ROOT, 'assets/js/i18n.js'), 'utf8')),
     '사전에서도 지웠다 — 죽은 키를 남기지 않는다(3-E)');

  /* ⑭-2 「3개 공종」 오표기 — 장비현황에서 세는 것은 장비 종류다.
     ★탭1 전체로 재면 진행률 표의 「개 공종」이 걸린다(3-B 기준어 함정) —
       업체 줄 안으로 좁혀서 본다. */
  const rs = hz.indexOf('data-eqo="co|LUU Company"');
  const eqRow = rs < 0 ? '' : hz.slice(rs, hz.indexOf('</tr>', rs));
  ok(eqRow.length > 0, '장비 업체 줄을 집어냈다');
  ok(eqRow.indexOf('개 공종') < 0, '★장비 업체 줄에 「N개 공종」이 안 나온다');
  ok(eqRow.indexOf(A.T('u_neq').replace('{n}', '3')) > 0,
     '★장비 종류 수로 표시된다 (장비 3종)');

  /* ★엉뚱한 데까지 지우지 않았다 — 진행률·자재의 「개 공종」은 진짜 공종이다 */
  {
    const ts2 = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
    ok((ts2.match(/T\('u_nwork'\)/g) || []).length === 3,
       '진짜 공종 자리 3곳은 u_nwork 그대로');
    ok((ts2.match(/T\('u_neq'\)/g) || []).length === 1, '장비 자리 1곳만 u_neq');
  }

  /* ⑯ 플랜트 자재는 재고 칸을 만들지 않는다 — 플랜트 인원이 아니면 셀 수 없다 */
  A.addMreq({ date: tz, loc: LZ, grp: '토공', sub: '되메우기', mat: '레미콘',
              spec: '25-24-15', unit: 'm3', plant: true, qty: 12, by: 'Kim' });
  A.addMreq({ date: tz, loc: LZ, grp: '토공', sub: '되메우기', mat: '부직포',
              spec: '150g', unit: 'm2', plant: false, qty: 30, by: 'Kim' });
  const mrows = A.matRows(A.flt());
  let pRow = null, wRow = null;
  mrows.forEach(function (r) { if (r.plant && !pRow) pRow = r; if (!r.plant && !wRow) wRow = r; });
  ok(!!pRow && !!wRow, '플랜트·창고 자재가 한 줄씩 선다');
  if (pRow && wRow) {
    A.go(4);
    const h4 = bag.view.innerHTML;
    const q = function (s) { return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    ok(h4.indexOf('data-mst="' + q(pRow.id) + '"') < 0,
       '★플랜트 자재에는 재고 입력칸이 없다');
    ok(h4.indexOf('data-mst="' + q(wRow.id) + '"') > 0,
       '★창고 자재에는 재고 입력칸이 그대로 있다');
  }

  S.vend.length = 0; keepVend.forEach(function (v) { S.vend.push(v); });
  S.crew.length = 0; keepCrew.forEach(function (c) { S.crew.push(c); });
  S.issue.length = 0; keepIssue.forEach(function (g) { S.issue.push(g); });
  S.mreq.length = 0; keepMreq.forEach(function (m) { S.mreq.push(m); });
  A._grpBy('work'); A.setRole(keepRole); if (keepFlt) A.setFlt(keepFlt); A.go(1);
}

/* ── 93 스탭 화면에는 '준비'가 없다 (요청 : 스탭화면 작업현황) ──
   ★준비의 여섯 갈래는 전부 셋업(설계수량·지급장비·명부·우리스탭·동기화·용량)
     이라 관리자만 넣어야 한다. 종전에는 스탭 화면에도 그대로 떠 설계수량·
     지급장비까지 스탭이 손댈 수 있었다.
   ★[29] 앞에 둔다 — 뒤는 표본 파일 누락으로 안 돌아 거짓 안심이 된다. */
console.log('\n[93] 준비는 관리자 전용 — 스탭 작업현황에는 없다');
{
  const keepRole = A.role();
  const spT = A.T('sp_t');

  A.setRole('staff'); A.go(1);
  const hs = bag.view.innerHTML;
  ok(hs.length > 0, '스탭 작업현황이 그려진다(기준)');
  ok(hs.indexOf(spT) < 0, "★준비 카드가 스탭 화면에 없다");
  ok(!/data-stp=/.test(hs), '★준비 하위 버튼(data-stp)이 없다 — 입력 기능도 제거');
  ok(!/id="stMe"/.test(hs), '★「나는 누구」 셀렉트도 스탭 화면엔 없다');
  ok(hs.indexOf(A.T('ro_ppl')) > 0 || hs.indexOf(A.T('rollup')) > 0,
     '작업현황 본체(인력 표)는 스탭에게도 그대로');

  A.setRole('admin'); A.go(1);
  const ha = bag.view.innerHTML;
  ok(ha.indexOf(spT) > 0, '★관리자 화면에는 준비가 그대로 있다');
  ok(/data-stp=/.test(ha), '관리자에게는 준비 하위 버튼이 있다');

  A.setRole(keepRole); A.go(1);
}

/* ── 94 진행 중 작업 추적 (요청 : 작업량 입력 연동 1단계) ──
   ★인력을 올렸는데 수량이 안 들어온 작업을 「진행 중」으로 잡는다. 작업 =
     공종+위치+구간(도로 측점범위·관로 표기·구조물 개소). 오래 방치되면 경고.
   ★[29] 앞에 둔다 — 뒤는 표본 파일 누락으로 안 돈다. */
console.log('\n[94] 진행 중 작업 — 인력만 올린 것을 잡고, 수량 들어오면 뺀다');
{
  const keepCrew = S.crew.slice(), keepWork = S.work.slice(), keepRole = A.role();
  const keepFlt = A.flt ? A.flt() : null;
  S.crew.length = 0; S.work.length = 0; A.setRole('admin');

  const LT = { s: 'civil', p: 1, c: 1 }, tt = A.today();
  const back = function (n) { const d = new Date(tt); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

  ok(typeof A.openTasks === 'function' && typeof A.segOf === 'function', 'A.openTasks · A.segOf 존재');

  /* 관로(오수) 표기 라벨 하나에 3일 인력, 수량 없음 */
  [2, 1, 0].forEach(function (n, i) {
    S.crew.push({ id: 'ot' + i, date: back(n), loc: LT, key: 'SS-01', st: 'ok', teams: 2,
      ppl: { eng: 0, fmn: 1, wkr: 6 }, eq: [], tag: 'C61 D700 L=319m' });
  });
  let list = A.openTasks(null, tt);
  ok(list.length === 1, `진행 중 작업 1개 (같은 라벨=한 작업) 실제 ${list.length}`);
  const t0 = list[0] || {};   /* ★없어도 예외로 검사가 죽지 않게(0-W) */
  ok(t0.seg === 'tag|C61 D700 L=319m', '★구간 = 표기(도면 라벨)');
  ok(t0.dayN === 3 && t0.age === 2, '투입 3일 · 방치 2일');
  ok(t0.isNew === false, '어제부터라 NEW 아님');

  /* 구조물 개소 — 오늘 처음 = NEW */
  S.crew.push({ id: 'otf', date: tt, loc: LT, key: 'T-01', st: 'ok', teams: 1,
    ppl: { eng: 0, fmn: 1, wkr: 5 }, eq: [], spot: 0 });
  const fac = A.openTasks(null, tt).filter(function (t) { return t.seg === 'fac|0'; })[0];
  ok(fac && fac.isNew === true, '★구조물 개소가 오늘 처음이면 NEW');

  /* 도로 — 크루가 두 구간을 담으면 작업 2개로 갈린다 */
  S.crew.push({ id: 'otr', date: tt, loc: LT, key: 'T-02', st: 'ok', teams: 2,
    ppl: { eng: 0, fmn: 1, wkr: 8 }, eq: [], spots: [
      { kind: 'road', w: '50', no: '1', side: '', f: 0, t: 120 },
      { kind: 'road', w: '50', no: '1', side: '', f: 120, t: 240 }] });
  ok(A.openTasks(null, tt).filter(function (t) { return t.key === 'T-02'; }).length === 2,
     '★크루가 두 측점구간을 담으면 작업 2개');

  /* 수량이 들어오면 그 작업은 진행 중에서 빠진다 (완료) */
  S.work.push({ id: 'otw', date: tt, loc: LT, key: 'SS-01', st: 'sub', qty: 319, tag: 'C61 D700 L=319m' });
  ok(!A.openTasks(null, tt).some(function (t) { return t.seg === 'tag|C61 D700 L=319m'; }),
     '★수량 들어오면 진행 중에서 빠진다(완료)');
  /* 수량 0짜리 줄은 완료로 치지 않는다 */
  S.work.push({ id: 'otw0', date: tt, loc: LT, key: 'T-01', st: 'sub', qty: 0, spot: 0 });
  ok(A.openTasks(null, tt).some(function (t) { return t.seg === 'fac|0'; }),
     '수량 0인 줄은 완료로 안 친다(구조물 아직 진행 중)');

  /* 관리자 화면에 카드가 뜬다 */
  A.setFlt(LT); A.go(1);
  const hv = bag.view.innerHTML;
  ok(hv.indexOf(A.T('ot_t')) > 0, '★진행 중 작업 카드가 화면에 뜬다');
  ok(hv.indexOf(A.T('u_sec') + ' 1') > 0, '구조물이 개소 라벨로 표시된다(아직 진행 중)');

  S.crew.length = 0; keepCrew.forEach(function (c) { S.crew.push(c); });
  S.work.length = 0; keepWork.forEach(function (w) { S.work.push(w); });
  A.setRole(keepRole); if (keepFlt) A.setFlt(keepFlt); A.go(1);
}

/* ★[29] 앞에 둔다 — 뒤는 표본 파일 누락으로 안 돌아 거짓 안심이 된다. */
console.log('\n[95] 작업 중단 — 세우고(사유·중단일) 다시 잇는다, 중단일수만 제외');
{
  const keepCrew = S.crew.slice(), keepWork = S.work.slice(), keepStop = S.stop.slice();
  const keepRole = A.role(), keepFlt = A.flt ? A.flt() : null;
  S.crew.length = 0; S.work.length = 0; S.stop.length = 0; A.setRole('admin');

  const LT = { s: 'civil', p: 1, c: 1 }, tt = A.today();
  const back = function (n) { const d = new Date(tt); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

  ok(typeof A.addStop === 'function' && typeof A.stopDaysOf === 'function' &&
     typeof A.activeStop === 'function' && typeof A.resumeStop === 'function',
     'A.addStop · stopDaysOf · activeStop · resumeStop 존재');

  /* 6일 전 인력만 올린 오수 작업(수량 없음) — 방치로 잡히기 직전 */
  S.crew.push({ id: 'st0', date: back(6), loc: LT, key: 'SS-01', st: 'ok', teams: 2,
    ppl: { eng: 0, fmn: 1, wkr: 6 }, eq: [], tag: 'C61 D700 L=319m' });
  let t = A.openTasks(null, tt)[0];
  ok(t && t.age === 6 && !t.stopped, '중단 전 — 방치 6일 · 중단 아님');
  const TK = t.tk;

  /* 2일 전 자재대기로 중단 */
  const r = A.addStop({ tk: TK, loc: LT, key: 'SS-01', seg: t.seg, why: 'mat', date: back(2), by: '홍' });
  ok(r && r.type === 'stop' && r.why === 'mat', '중단 기록이 생긴다');
  ok(!A.addStop({ tk: TK, loc: LT, key: 'SS-01', seg: t.seg, why: 'etc', date: tt }),
     '★이미 중단 중이면 새 중단을 안 만든다');
  ok(!!A.activeStop(TK), '지금 중단 중이다(재개일 없음)');
  ok(A.stopDaysOf(TK, tt) === 2, '중단일수 = 2 (2일 전부터 오늘까지)');

  t = A.openTasks(null, tt)[0];
  ok(t.stopped === true && t.stopWhy === 'mat' && t.stopFrom === back(2),
     '진행 중 목록에서 중단으로 표시된다(사유·중단일)');
  ok(t.age === 4, '★방치일 = 달력 6일 − 중단 2일 = 4 (중단일수만 뺀다)');

  /* 관리자 화면 — 중단 묶음이 뜬다 */
  A.setFlt(LT); A.go(1);
  ok(bag.view.innerHTML.indexOf(A.T('ot_stopped')) > 0, '★중단 묶음이 관리자 화면에 뜬다');

  /* 재개 — 오늘 다시 잇는다. 과거 중단일수는 그대로 방치에서 빠진 채다 */
  const rs = A.resumeStop(TK, tt);
  ok(rs && rs.to === tt, '재개일이 찍힌다');
  ok(!A.activeStop(TK), '재개하면 더는 중단 중이 아니다');
  t = A.openTasks(null, tt)[0];
  ok(t.stopped === false && t.age === 4, '재개 후 — 중단 아님 · 지난 중단 2일은 여전히 방치에서 제외');

  /* 완료 — 수량이 들어오면 진행 중/중단 목록에서 빠진다 */
  S.work.push({ id: 'stw', date: tt, loc: LT, key: 'SS-01', st: 'sub', qty: 319, tag: 'C61 D700 L=319m' });
  ok(A.openTasks(null, tt).length === 0, '★수량이 들어오면 완료 — 목록에서 빠진다(중단 기록은 남는다)');
  ok(A.stopsOf(TK).length === 1, '중단 이력은 보존된다(생산성 소요일 근거)');

  /* 서버 왕복 — 'stop'은 모르는 종류라도 unpack이 stop 상자로 되돌린다(Code.gs 무수정) */
  const u = A._unpack({ type: 'stop', id: 'srv1', date: back(2), s: 'civil', p: 1, c: 1,
    tk: TK, key: 'SS-01', seg: t ? t.seg : 'tag|C61 D700 L=319m', to: tt, why: 'eqbrk' });
  ok(u && u.box === 'stop' && u.row && u.row.tk === TK && u.row.to === tt && u.row.why === 'eqbrk',
     '★서버에서 받은 중단 줄이 stop 상자로 풀린다(tk·to·why 보존)');

  S.crew.length = 0; keepCrew.forEach(function (c) { S.crew.push(c); });
  S.work.length = 0; keepWork.forEach(function (w) { S.work.push(w); });
  S.stop.length = 0; keepStop.forEach(function (s) { S.stop.push(s); });
  A.setRole(keepRole); if (keepFlt) A.setFlt(keepFlt); A.go(1);
}

/* ★[29] 앞에 둔다 — 뒤는 표본 파일 누락으로 안 돈다. */
console.log('\n[96] 모바일 복귀 즉시 수신 — 백그라운드 타이머가 멈춰도 반영된다');
{
  const API = sb.BNCP_API;
  const savedChanged = API.changed, savedOn = API.on;
  let changedN = 0;
  API.changed = function () { changedN++; return Promise.resolve([]); };
  API.on = true;
  sb.__evt = {};

  A.startAutoSync();
  const vis = sb.__evt['visibilitychange'];
  ok(typeof vis === 'function', '★visibilitychange 리스너가 걸린다(모바일 복귀 감지)');
  ok(typeof sb.__evt['win:online'] === 'function', '★online(네트워크 복귀) 리스너가 걸린다');
  ok(typeof sb.__evt['win:pageshow'] === 'function', '★pageshow(뒤로가기 복귀) 리스너가 걸린다');
  ok(typeof sb.__evt['win:focus'] === 'function', 'focus 리스너가 걸린다');

  /* ★syncNow는 진행중 플래그를 microtask에서 내리는데, 동기 실행뿐인 검사에선
     [23]이 부른 A.sync가 그 플래그를 켠 채로 남겨 둔다. stopAutoSync가 이제
     그 플래그를 내리므로 여기서 턴 뒤 각 wake를 본다(실화면과 같은 상태). */
  A.stopAutoSync();
  sb.document.hidden = false;
  const b1 = changedN; vis();
  ok(changedN === b1 + 1, '★복귀하면 즉시 수신을 당긴다(최대 1분 안 기다린다)');

  /* 아직 안 보이면(백그라운드로 넘어가는 순간) 안 받는다 */
  A.stopAutoSync();
  sb.document.hidden = true;
  const b2 = changedN; vis();
  ok(changedN === b2, '숨겨진 상태에서는 안 받는다(헛통신 방지)');

  /* online도 같은 wake를 탄다 */
  A.stopAutoSync();
  sb.document.hidden = false;
  const b3 = changedN; sb.__evt['win:online']();
  ok(changedN === b3 + 1, '★네트워크가 돌아오면 즉시 수신');

  A.stopAutoSync();
  API.changed = savedChanged; API.on = savedOn; sb.document.hidden = false;
}

/* ★[29] 앞에 둔다 — [74]의 같은 검사는 표본 CSV 누락으로 안 도는 죽은 구역에 있다. */
console.log('\n[97] 현황판·상단제목 손질 (v2.40.0 사용자 지적)');
{
  const css97 = fs.readFileSync(path.join(ROOT, 'assets/css/app.css'), 'utf8');
  const px = (sel, prop) => {
    const m = css97.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{[^}]*?' + prop + ':(\\d+)px'));
    return m ? +m[1] : 0;
  };
  /* 각 탭 상단 제목 20% 축소 (18-스펙) — 26→21, 모바일 21→17 */
  ok(/\.ph h1\{margin:0;font-size:21px/.test(css97), '★상단 제목 20% 축소(26→21px)');
  ok(/\.ph h1\{font-size:17px\}/.test(css97), '★모바일 상단 제목도 20% 축소(21→17px)');
  /* 현황판 고정 — 화면보다 길어도 안 잘리게 높이를 묶고 안에서 스크롤 */
  ok(/\.pg__side\{[^}]*max-height:calc/.test(css97) && /\.pg__side\{[^}]*overflow-y:auto/.test(css97),
     '★현황판이 화면에 묶여 잘리지 않고 안에서 스크롤(고정+근본수정)');
  /* 좁은 화면에선 높이 안 묶는다(세로로 쌓임) */
  ok(/\.pg__side\{position:static;order:-1;max-height:none/.test(css97),
     '좁은 화면에선 현황판을 위로 올리고 높이 제한을 푼다');
  /* ★작업현황 제목 고정 해제 (v2.40.1) — 고정한 제목이 현황판 위를 덮어 가렸다.
     .ph가 position:sticky를 더는 갖지 않아야 한다. */
  ok(!/\.ph\{[^}]*position:sticky/.test(css97),
     '★작업현황 제목이 더는 고정(sticky)이 아니다 — 현황판을 안 덮는다');
  /* 제목(≥16) > 내용 숫자 — v2.44.0에서 숫자를 14로 더 낮춰 제목보다 작게 */
  ok(px('.sb__t', 'font-size') >= 16, `★현황판 제목 16px 이상 (${px('.sb__t','font-size')})`);
  ok(px('.sb__v b', 'font-size') <= 14 && px('.sb__v b', 'font-size') < px('.sb__t', 'font-size'),
     `★내용 숫자가 제목보다 작다 (숫자 ${px('.sb__v b','font-size')} < 제목 ${px('.sb__t','font-size')})`);
  ok(px('.sb__l', 'font-size') >= 13, `★라벨(소제목)도 읽히게 13px 이상 (${px('.sb__l','font-size')})`);
  ok(px('.wx__now b', 'font-size') <= 20, `★날씨 기온도 과하지 않게 20px 이하 (${px('.wx__now b','font-size')})`);
  /* ★날씨를 탭바 오른쪽 끝(알림·전파 옆)으로 옮겼다 (v2.42.0) — margin-left:auto.
     이 간격은 나중에 탭이 더 들어올 자리다(사용자 확정). */
  ok(/\.wxtab\{[^}]*margin-left:auto/.test(css97),
     '★날씨 탭칸이 오른쪽 끝으로 밀린다(다음 탭 자리 + 간격 확보)');
  /* ★접지 않는다 (v2.42.2) — 위치·상세·7일예보를 늘 보인다, 숨기는 media 없음 */
  ok(/\.wxtab \.sb__l\{display:inline/.test(css97), '★위치(날씨·Baghdad)를 늘 보인다');
  ok(/\.wxtab \.wx__now i\{display:inline/.test(css97), '★상세(체감·바람…)를 늘 보인다');
  ok(!/\.wxtab[^{]*\{display:none/.test(css97) && !/\.wxtab \.wx__fc\{display:none/.test(css97),
     '★무엇도 접지 않는다(좁으면 탭바가 가로 스크롤될 뿐)');
  const kR = A.role(), kF = A.flt ? A.flt() : null;
  A.setRole('admin'); A.setFlt({ s: 'civil', p: 1, c: 1 });
  ok(/class="wxtab" id="wxBox"/.test(bag.tabs.innerHTML), '★날씨가 탭바(#tabs) 오른쪽에 붙는다');
  ok(bag.view.innerHTML.indexOf('id="wxBox"') < 0, '★본문(#view)에는 더는 날씨가 없다');
  ok(bag.view.innerHTML.indexOf('sb__wx') < 0, '★현황판 안에도 날씨 칸이 없다');
  ok(/class="sb"/.test(bag.view.innerHTML) && /class="sb__t"/.test(bag.view.innerHTML), '현황판은 그대로 있다');

  /* ★인원·장비 추이 반반 + 업체별에 직영 추가 (v2.44.0) — 자료를 넣고 렌더 확인 */
  const kCrew = S.crew.slice(), kDir = S.direct.slice();
  const LT97 = { s: 'civil', p: 1, c: 1 }, td97 = A.today();
  S.crew.push({ id: 'sc97', date: td97, loc: LT97, key: 'T-01', st: 'ok', teams: 1,
    ppl: { eng: 0, fmn: 1, wkr: 5 }, eq: [{ cat: 'Dozer', size: '', run: 3, brk: 0, rep: 0 }],
    by: '라비', co: 'RABEE' });
  A.addDirect({ date: td97, loc: LT97, task: '현장정리', teams: 1, ppl: { eng: 0, fmn: 0, wkr: 4 },
    eq: [{ cat: 'Dozer', size: '', run: 2, brk: 0, rep: 0 }], by: '직영' });
  A.setFlt(LT97); A.go(1);
  const hv = bag.view.innerHTML;
  ok(/class="sb__tw"/.test(hv) && /class="sb__thalf"/.test(hv), '★추이가 인원·장비 반반(나란히)으로 나온다');
  ok((hv.match(/sb__thalf/g) || []).length === 2, '★추이 그래프가 둘(인원+장비)');
  ok(/class="sb__cos"/.test(hv) && hv.indexOf('RABEE') >= 0 && hv.indexOf('>' + A.T('res_dir') + '<') >= 0,
     '★업체별에 협력업체(RABEE)와 직영이 함께 뜬다');
  S.crew.length = 0; kCrew.forEach(function (x) { S.crew.push(x); });
  S.direct.length = 0; kDir.forEach(function (x) { S.direct.push(x); });

  /* CSS — 추이는 높이를 안 늘린다(mini 스파크라인이 짧다) */
  ok(/\.sb__tw\{[^}]*display:flex/.test(css97), '★추이 두 개가 가로로 나란히(반반)');

  A.setRole(kR); if (kF) A.setFlt(kF); A.go(1);
}

/* ★[29] 앞에 둔다 — 뒤는 표본 파일 누락으로 안 돈다. */
console.log('\n[98] 직영 장비 고장(brk)·정비(rep) 입력 (v2.43.0 · 18-스펙)');
{
  const keepD = S.direct.slice(), kR = A.role(), kF = A.flt ? A.flt() : null;
  S.direct.length = 0; A.setRole('staff'); A.setFlt({ s: 'civil', p: 1, c: 1 });

  /* UI — 직영 장비 입력에 고장·정비 칸이 생겼다 */
  A.go(7);
  const hv = bag.view.innerHTML;
  ok(/id="dBrk"/.test(hv) && /id="dRep"/.test(hv), '★직영 장비 입력에 고장·정비 칸이 있다');

  /* ★작업내용을 친 뒤 장비종류를 골라도 안 날아간다 (v2.43.1 버그 수정).
     dTask에 타이핑(oninput→dF) 후 dCat 변경(A.render)해도 값이 남아야 한다. */
  bag.dTask.value = '현장정리 작업'; if (bag.dTask.oninput) bag.dTask.oninput();
  bag.dCat.value = 'Excavator(crawler)'; if (bag.dCat.onchange) bag.dCat.onchange();
  ok(bag.view.innerHTML.indexOf('value="현장정리 작업"') >= 0,
     '★장비종류를 골라도 작업내용이 초기화되지 않는다');

  /* 실제 클릭으로 담기까지 — 고장만(가동 0) 눌러도 담기고 고장 배지가 뜬다.
     (담는 코드가 brk를 버리면 이 배지가 안 뜬다 → revert가 여기서 걸린다) */
  bag.dRun.value = '0'; bag.dBrk.value = '2'; bag.dRep.value = '1';
  if (bag.dEqAdd.onclick) bag.dEqAdd.onclick();
  ok(/bd--d/.test(bag.view.innerHTML), '★가동 0·고장 2를 누르면 담기고 고장 배지가 뜬다');

  /* ★입력자(담당자)는 스탭 명부가 있으면 select로 고른다 (v2.43.1) */
  const kStaff = S.staff.slice();
  A.staffAdd({ name: '김직영', tel: '', grps: [] });
  A.go(7);
  ok(/<select class="in" id="dBy">/.test(bag.view.innerHTML) &&
     bag.view.innerHTML.indexOf('>김직영<') >= 0, '★입력자는 스탭 명부에서 고른다(select)');
  S.staff.length = 0; kStaff.forEach(function (x) { S.staff.push(x); });

  /* 데이터 — 고장만 있는(run=0) 장비도 담기고 업체집계(직영)에 잡힌다 */
  const LT = { s: 'civil', p: 1, c: 1 };
  A.addDirect({ date: A.today(), loc: LT, task: '현장정리', teams: 1,
    ppl: { eng: 0, fmn: 0, wkr: 0 },
    eq: [{ cat: 'Excavator(crawler)', size: '', run: 0, brk: 2, rep: 1 }], by: '직영' });
  const co = A.rollupCo(LT).filter(function (g) { return g.dir; })[0];
  ok(co && co.rows[0].brk === 2 && co.rows[0].rep === 1,
     '★직영 장비 고장·정비가 업체집계(직영)에 잡힌다');
  /* 현황판 장비 「가동/고장」의 고장(down)에도 반영된다 */
  const sr = A.siteRows(LT).filter(function (r) { return A.locKey(r.loc) === A.locKey(LT); })[0];
  ok(sr && sr.down >= 3, '★현황판 장비 고장(down)에 직영 고장·정비가 더해진다');

  S.direct.length = 0; keepD.forEach(function (x) { S.direct.push(x); });
  A.setRole(kR); if (kF) A.setFlt(kF); A.go(1);
}

/* ★[29] 앞 — 명부 유무에 따른 coOf 안전장치 (v2.45.0) */
console.log('\n[99] 회사 자리에 사람 이름 안 나오기 — 명부 유무별');
{
  const kVend = S.vend.slice();
  /* 명부 없음 → 종전대로 입력값 유지(자유입력 현장을 지우면 안 된다) */
  S.vend.length = 0; A.coDirty && A.coDirty();
  ok(A.coOf({ by: 'Some Person' }) === 'Some Person', '명부 없으면 입력값 그대로(자유입력 현장 보호)');
  /* 명부 있음 → 미등록 이름은 「미등록 업체」, 등록 담당자는 회사명 */
  S.vend.length = 0;
  S.vend.push({ name: 'ACME Co', code: 'AC01', staff: ['토공|Mustafah Jassem Abowd|0770'], key: 'AC01-x' });
  A.coDirty && A.coDirty();
  ok(A.coOf({ by: 'Mustafah Jassem Abowd' }) === 'ACME Co', '★등록 담당자 이름 → 회사명');
  ok(A.coOf({ by: 'Nobody' }) === A.T('e_nocomp'), '★미등록 이름 → 미등록 업체(사람 이름 안 나옴)');

  /* ★모바일(명부 없음)이 서버로 명부를 받으면(mergeVend) 회사명이 풀린다 (v2.45.1) */
  S.vend.length = 0; A.coDirty && A.coDirty();
  ok(A.coOf({ by: 'Kim Site' }) === 'Kim Site', '받기 전 — 명부 없어 이름 그대로(모바일 상태)');
  ok(typeof A._mergeVend === 'function', 'A._mergeVend 노출됨');
  const got = A._mergeVend({ type: 'vend', code: 'V9', name: 'World Sub Co', staff: ['토공|Kim Site|010'] });
  ok(got === true, '명부 한 줄을 받아 S.vend에 upsert');
  ok(A.coOf({ by: 'Kim Site' }) === 'World Sub Co',
     '★서버로 명부를 받으면 담당자 이름이 회사명으로 풀린다(모바일도 PC와 같아짐)');
  ok(A._mergeVend({ type: 'vend', code: 'V9', name: 'World Sub Co', staff: ['토공|Kim Site|010'] }) === false,
     '같은 내용은 두 번 세지 않는다');

  S.vend.length = 0; kVend.forEach(function (x) { S.vend.push(x); }); A.coDirty && A.coDirty();
}

/* ★[29] 앞 — 설정·명부 전체 동기화 additive 병합 (v2.46.0).
   불변식 : 빈/부분 수신이 로컬을 절대 지우지 않는다(union). 각 검사에서
   「로컬에만 있는 것이 수신 뒤에도 남는다」를 확인한다 — 병합을 덮어쓰기로
   되돌리면 그 줄이 사라져 이 검사가 실패한다(규칙 3-A). */
console.log('\n[90] 설정·명부 동기화 — additive 병합(빈 수신이 로컬을 안 지운다)');
{
  /* ── 담당자(staff) ── */
  ok(typeof A._mergeStaff === 'function', 'A._mergeStaff 노출됨');
  const kStaff = S.staff.slice();
  S.staff.length = 0;
  S.staff.push({ id: 'ME1', name: '내 담당자', tel: '111', grps: ['토공'] });   /* 로컬에만 있는 것 */
  ok(A._mergeStaff({ type: 'staff', sid: 'PC1', name: 'PC 담당자', tel: '222', grps: ['우수공'] }) === true,
     '담당자 한 줄 수신 → upsert');
  ok(S.staff.some(function (x) { return x.id === 'PC1' && x.name === 'PC 담당자'; }), '수신 담당자가 들어왔다');
  ok(S.staff.some(function (x) { return x.id === 'ME1'; }),
     '★로컬 담당자는 그대로 남는다(union — 덮어쓰기면 사라져 실패)');
  ok(A._mergeStaff({ type: 'staff', sid: 'PC1', name: 'PC 담당자', tel: '222', grps: ['우수공'] }) === false,
     '같은 내용 두 번은 안 센다');
  ok(A._mergeStaff({ type: 'staff', sid: 'PC1', name: 'PC 담당자 수정', tel: '222', grps: ['우수공'] }) === true,
     '이름 수정은 반영된다');
  S.staff.length = 0; kStaff.forEach(function (x) { S.staff.push(x); });

  /* ── 지급장비(issue) — ★업체는 `by`에 실린다(coOf가 co||by로 읽는다).
     v2.46.0은 없는 co를 보내 업체가 빈 채 넘어가 지급대조가 어긋났다.
     여기서 「받은 줄의 업체가 회사명으로 풀리는지」까지 확인한다(v2.46.1). */
  ok(typeof A._mergeIssue === 'function', 'A._mergeIssue 노출됨');
  const kIssue = S.issue.slice(), kVend2 = S.vend.slice();
  S.vend.length = 0;
  S.vend.push({ name: 'PC 협력사', code: 'PC01', staff: ['토공|김담당|010'], key: 'PC01-x' });
  A.coDirty && A.coDirty();
  S.issue.length = 0;
  S.issue.push({ id: 'IL1', date: '2026-08-01', loc: 'x', cat: '굴착기', size: '06W', kind: 'give', cnt: 2, by: '로컬사' });
  ok(A._mergeIssue({ type: 'issue', iid: 'IP1', date: '2026-08-02', loc: 'y', cat: '덤프', size: '15T', kind: 'give', cnt: 3, by: '김담당' }) === true,
     '지급장비 한 줄 수신 → upsert');
  const rxIssue = S.issue.filter(function (x) { return x.id === 'IP1'; })[0];
  ok(rxIssue && rxIssue.cnt === 3, '수신 지급장비가 들어왔다');
  ok(rxIssue && A.coOf(rxIssue, false) === 'PC 협력사',
     '★받은 지급장비의 업체가 회사명으로 풀린다(by 복원 — 안 채우면 이 단언 실패)');
  ok(S.issue.some(function (x) { return x.id === 'IL1'; }), '★로컬 지급장비는 그대로 남는다(union)');
  ok(A._mergeIssue({ type: 'issue', iid: 'IP1', date: '2026-08-02', loc: 'y', cat: '덤프', size: '15T', kind: 'give', cnt: 3, by: '김담당' }) === false,
     '같은 내용 두 번은 안 센다');
  ok(A._mergeIssue({ type: 'issue', iid: 'IP1', date: '2026-08-02', loc: 'y', cat: '덤프', size: '15T', kind: 'give', cnt: 5, by: '김담당' }) === true,
     '수량 수정은 반영된다');
  /* 옛 형식(co만) 수신도 업체가 풀려야 한다 — 호환 */
  ok(A._mergeIssue({ type: 'issue', iid: 'IP2', date: '2026-08-03', cat: '로더', size: '3T', kind: 'give', cnt: 1, co: '김담당' }) === true,
     '옛 co 형식 수신도 받는다');
  const rxOld = S.issue.filter(function (x) { return x.id === 'IP2'; })[0];
  ok(rxOld && A.coOf(rxOld, false) === 'PC 협력사', '옛 co 형식도 회사명으로 풀린다(호환)');
  /* ★빈 by 수신이 로컬 업체를 덮지 않는다 (v2.46.2 — 「미등록 업체가 생겼다」 방지).
     v2.46.0이 업체 없이 올린 옛 줄을 되받아도 로컬 업체가 지워지면 안 된다. */
  S.issue.length = 0;
  S.issue.push({ id: 'IK1', date: '2026-08-05', cat: '크레인', size: '20T', kind: 'give', cnt: 1, by: '김담당' });
  ok(A._mergeIssue({ type: 'issue', iid: 'IK1', date: '2026-08-05', cat: '크레인', size: '20T', kind: 'give', cnt: 1, by: '' }) === false,
     '★빈 by 수신은 무변경(로컬 업체를 안 지운다)');
  ok(S.issue.filter(function (x) { return x.id === 'IK1'; })[0].by === '김담당',
     '★로컬 업체가 그대로 남는다 — 미등록 업체가 안 생긴다');
  ok(A._mergeIssue({ type: 'issue', iid: 'IZ9', date: '2026-08-06', cat: '로더', size: '3T', kind: 'give', cnt: 1, by: '' }) === false,
     '★업체 없는 새 줄은 받지 않는다(미등록 방지)');
  ok(!S.issue.some(function (x) { return x.id === 'IZ9'; }), '업체 없는 새 줄이 안 들어왔다');
  S.issue.length = 0; kIssue.forEach(function (x) { S.issue.push(x); });
  S.vend.length = 0; kVend2.forEach(function (x) { S.vend.push(x); }); A.coDirty && A.coDirty();

  /* ── 내역서 별칭(alias/alias2) ── */
  ok(typeof A._mergeAlias === 'function', 'A._mergeAlias 노출됨');
  const kA = JSON.stringify(S.alias || {}), kA2 = JSON.stringify(S.alias2 || {});
  S.alias = { '로컬키': 'L001' }; S.alias2 = {};
  ok(A._mergeAlias({ type: 'alias', k: '서버키', code: 'S001' }) === true, '별칭 한 줄 수신');
  ok(S.alias['서버키'] === 'S001', '수신 별칭이 들어왔다');
  ok(S.alias['로컬키'] === 'L001', '★로컬 별칭은 그대로 남는다(union)');
  ok(A._mergeAlias({ type: 'alias', k: '서버키', code: 'S001' }) === false, '같은 별칭 두 번은 안 센다');
  ok(A._mergeAlias2({ type: 'alias2', k: 'K', code: 'A' }) === true, 'alias2 처음 수신 → 채움');
  ok(S.alias2['K'] === 'A', 'alias2 채워졌다');
  ok(A._mergeAlias2({ type: 'alias2', k: 'K', code: 'B' }) === true, 'alias2 다른 코드 수신 → 갈림');
  ok(S.alias2['K'] === '*', "★코드가 갈리면 '*'(자동매칭 중단) — learnAlias와 같은 규칙");
  S.alias = JSON.parse(kA); S.alias2 = JSON.parse(kA2);

  /* ── 자재 재고(stock) ── */
  ok(typeof A._mergeStock === 'function', 'A._mergeStock 노출됨');
  const kStock = JSON.stringify(S.stock || {});
  S.stock = { 'LOC': { 'matLocal': 7 } };
  ok(A._mergeStock({ type: 'stock', lk: 'LOC', mid: 'matSrv', qty: 9 }) === true, '재고 한 칸 수신 → upsert');
  ok(S.stock['LOC']['matSrv'] === 9, '수신 재고가 들어왔다');
  ok(S.stock['LOC']['matLocal'] === 7,
     '★같은 위치의 로컬 재고는 그대로 남는다(union — 위치 통째 덮어쓰기면 사라져 실패)');
  ok(A._mergeStock({ type: 'stock', lk: 'LOC', mid: 'matSrv', qty: 9 }) === false, '같은 재고 두 번은 안 센다');
  ok(A._mergeStock({ type: 'stock', lk: 'LOC', mid: 'matSrv', qty: 12 }) === true, '수량 수정은 반영된다');
  S.stock = JSON.parse(kStock);

  /* ── 정비대장(mt) ── */
  ok(typeof A._mergeMt === 'function', 'A._mergeMt 노출됨');
  const kMt = JSON.stringify(S.mt || {});
  S.mt = { 'eqLocal': { step: 'req' } };
  ok(A._mergeMt({ type: 'mt', mid: 'eqSrv', step: 'fix', why: '엔진' }) === true, '정비 한 줄 수신 → upsert');
  ok(S.mt['eqSrv'] && S.mt['eqSrv'].step === 'fix', '수신 정비가 들어왔다');
  ok(S.mt['eqLocal'] && S.mt['eqLocal'].step === 'req', '★로컬 정비는 그대로 남는다(union)');
  ok(A._mergeMt({ type: 'mt', mid: 'eqSrv', step: 'fix', why: '엔진' }) === false, '같은 정비 두 번은 안 센다');
  S.mt = JSON.parse(kMt);

  ok(typeof A._txCfgAll === 'function', 'A._txCfgAll 노출됨(등록·업로드 시 서버로 밀어 올린다)');
}

/* ── 29 내역서 원본 인식 (v2.14.0) ────────────────────── */
console.log('\n[29] 내역서 원본 인식 — 실제 P3-1 파일로 검사');
{
  const raw = fs.readFileSync(path.join(ROOT, 'sample/내역서_부지토목_원본샘플_CP949.csv'));

  // 이 표본이 정말 CP949인지 — UTF-8로는 못 읽는 파일이어야 검사 의미가 있다
  let utf8ok = true;
  try { new TextDecoder('utf-8', { fatal: true }).decode(raw); } catch (e) { utf8ok = false; }
  ok(!utf8ok, '표본이 ANSI(CP949) — UTF-8로는 못 읽는다');

  const text = new TextDecoder('euc-kr').decode(raw);
  ok(/부지조성공사/.test(text), 'CP949로 풀면 한글이 살아난다');

  const rows = A.parseCSV(text);
  ok(rows.length > 100, `행 파싱 ${rows.length}`);
  ok(/^\s+/.test(rows.find(r => /표토제거/.test(r[0]) && /T=30cm/.test(r[1]))[0]),
     '들여쓰기가 보존된다 — 계층 판정의 근거');

  ok(A.isBoq(rows) === true, '내역서 형식으로 판별');
  const tpl = A.parseCSV(fs.readFileSync(path.join(ROOT, 'sample/설계수량_부지토목_샘플.csv'), 'utf8'));
  ok(A.isBoq(tpl) === false, '코드 열이 있는 기존 양식은 내역서로 보지 않는다');

  const items = A.boqItems(rows);
  ok(items.length === 109, `수량행 ${items.length}건`);

  // 대분류 추적 — 목차에 있으나 본문에 없는 공종(공동구)을 건너뛰어도 어긋나지 않아야 한다
  const gs = [...new Set(items.map(x => x.g))];
  ok(gs.includes('우수공') && gs.includes('오수공'), '대분류가 갈린다');
  ok(!gs.includes('공동구'), '본문에 없는 공종은 대분류로 잡히지 않는다');
  const up = items.find(x => /UPVC/.test(x.n) && /250/.test(x.n));
  ok(up && up.g === '우수공', '우수공 밑의 중분류 「토공」이 대분류를 덮어쓰지 않는다');

  // 계층 복원 — 3단(도로표지판 등 › 삼각표지판 › 터파기)
  const tri = items.find(x => x.sub.includes('삼각표지판') && x.n === '터파기');
  ok(!!tri, '3단 계층이 복원된다');

  const loc = { s: 'civil', p: 3, c: 1 };
  const r = A.readBoqRows(rows, loc);
  ok(r.total === 109 && r.ok >= 104, `자동 매칭 ${r.ok}/${r.total}`);

  const lk = A.locKey(loc);
  ok(S.plan[lk]['T-02'] === 87457, '절토 및 상차 87,457 — 값이 그대로 들어간다');
  ok(S.plan[lk]['WS-39'] === 220.75, '프라이머 방수(외부) — 마스터가 다르게 쪼갠 항목도 붙는다');

  // ★ 덮어쓰기 — 같은 파일을 두 번 올려도 두 배가 되지 않는다
  A.readBoqRows(rows, loc);
  ok(S.plan[lk]['T-02'] === 87457, '두 번 올려도 두 배가 되지 않는다(덮어쓰기)');

  // 별칭 학습 — 한 번 지정하면 다음 파일부터 자동
  const need = r.need;
  ok(need.length > 0 && need.length <= 6, `확인 필요 ${need.length}건`);
  const one = need[0];
  ok(A.boqMatch(one, 'civil').code === '', '지정 전에는 코드가 안 붙는다');
  A.setAlias(one, 'T-09');
  ok(A.boqMatch(one, 'civil').code === 'T-09', '한 번 지정하면 다음부터 자동으로 붙는다');
  A.setAlias(one, '');

  // 위치가 다르면 섞이지 않는다
  const loc2 = { s: 'civil', p: 3, c: 2 };
  ok(!S.plan[A.locKey(loc2)] || !S.plan[A.locKey(loc2)]['T-02'], '다른 공구에는 들어가지 않는다');

  delete S.plan[lk];
  A.save();
}

/* ── 30 작업현황 재설계 (v2.15.0) ────────────────────── */
console.log('\n[30] 작업현황 재설계 — 날짜조회·재확인·장비약어·장비현황');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  const csrc = fs.readFileSync(path.join(ROOT, 'assets/js/core.js'), 'utf8');
  const vsrc = fs.readFileSync(path.join(ROOT, 'assets/js/vendor.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'assets/css/app.css'), 'utf8');

  // 날짜 조회 — 종전에는 '오늘' 고정이라 지난 날짜를 볼 수 없었다
  A.dateFlt = { from: '', to: '' };
  ok(A.inDate({ date: '2026-01-01' }) === true, '범위가 비면 전 기간');
  A.dateFlt = { from: '2026-08-10', to: '2026-08-12' };
  ok(A.inDate({ date: '2026-08-11' }) === true, '범위 안이면 통과');
  ok(A.inDate({ date: '2026-08-09' }) === false, '범위 앞은 걸러진다');
  ok(A.inDate({ date: '2026-08-13' }) === false, '범위 뒤는 걸러진다');
  A.dateFlt = { from: '', to: '' };
  ok(/A\.hit\(w, f\)/.test(csrc) && /A\.hit\(c, f\)/.test(csrc), '집계가 날짜를 따른다');
  // v2.16.1 — 조회 기준 카드를 없애고 표마다 [기간] 단추를 붙였다(사용자 지시)
  ok(!/qbarHTML/.test(tsrc), '맨 위 조회 기준 카드 삭제');
  ok(/function rngBtn/.test(tsrc) && /function withRng/.test(tsrc), '표별 기간 선택 있음');
  /* ★v2.16.7 — 고르는 수단이 네 갈래라 복잡했다. 지름길 넷 + [직접]으로 줄였다 */
  ok(!/data-rgu=/.test(tsrc) && !/function rngPreset/.test(tsrc),
     '★일·주·월·년 + ◀▶ 조합 삭제');
  ok(!/data-rga=/.test(tsrc), '[전 기간]은 지름길로 들어갔다');
  ok(/data-rgq=/.test(tsrc) && /data-rgp=/.test(tsrc) && /data-rgf=/.test(tsrc),
     '지름길 넷 + [직접] 달력');
  ok(!/function cumCard/.test(tsrc), '누계 카드 삭제 — 기간 「전체」로 흡수');
  ok(!/function todayHTML/.test(tsrc), '오늘 투입 카드 삭제 — 현황판으로 흡수');
  ok(!/function rollEq/.test(tsrc), '장비투입현황 삭제 — 장비 표로 흡수');
  ok(/function eqBody/.test(tsrc) && /eq_bywork/.test(tsrc),
     '★장비 한 표에서 종류→규격→공종→정비까지 본다');
  ok(/id="eqAdd"/.test(tsrc), '장비 수동 입력 있음');

  // 장비 약어 — 사용자가 지정한 표기
  ok(A.eqAbbr('Dump Truck') === 'D/T', 'Dump Truck → D/T');
  ok(A.eqAbbr('Excavator(wheel)') === 'EX(W)', 'Excavator(wheel) → EX(W)');
  ok(A.eqAbbr('Excavator(crawler)') === 'EX(C)', 'Excavator(crawler) → EX(C)');
  ok(A.eqAbbr('Motor Grader') === 'MG', 'Motor Grader → MG');
  // 마스터 62종이 전부 약어를 갖고, 빈 값이 없어야 한다
  let blank = 0, seen = {};
  A.EQ_TREE.forEach(t => { const a = A.eqAbbr(t.cat); if (!a) blank++; seen[t.cat] = a; });
  ok(blank === 0, `장비 ${Object.keys(seen).length}종 전부 약어가 있다`);
  ok(/esc\(o\.abbr\)[\s\S]{0,80}esc\(o\.cat\)/.test(tsrc),
     '약어 옆에 원문을 함께 쓴다 — 지급대장 대조는 원문 철자');

  // 재확인 요청 — 막지 않되 답을 받아낸다
  ok(/A\.askRecheck/.test(csrc) && /rechecks/.test(csrc), '재확인 요청 기능 있음');
  const wid = 'rc-test-1';
  S.work.push({ id: wid, date: A.today(), loc: { s: 'civil', p: 1, c: 1 },
                key: 'T-02', qty: 999, st: 'wait', by: 'TESTCO' });
  ok(A.askRecheck(wid, 'eqadd') === true, '재확인을 건다');
  ok(S.work.find(w => w.id === wid).st === 'recheck', '상태가 recheck');
  ok(A.rechecks({ s: 'civil', p: 1, c: 1 }).length === 1, '재확인 목록에 잡힌다');
  ok(/data-rc=/.test(tsrc), '확인대기 표에 재확인 버튼');
  ok(/data-rcans=/.test(vsrc), '협력업체 화면에서 사유를 답한다');
  ok(/w\.st = 'wait'/.test(vsrc), '업체가 답하면 다시 확인대기로 올라간다');
  S.work = S.work.filter(w => w.id !== wid);

  // 장비현황 — 지급대조 + 정비의뢰 통합
  ok(typeof A.eqStatus === 'function', 'eqStatus 있음');
  ok(!/function reconTable/.test(tsrc), '장비 지급대조 표 삭제 — 장비현황으로 흡수');
  ok(/eq_st/.test(tsrc), '장비현황 카드 있음');
  ok(/isFile/.test(tsrc), '지급대장 업로드가 장비현황 안으로 들어왔다');
  ok(/data-eqo=/.test(tsrc), '종류를 눌러 규격별 상세를 연다');
  A.mtSet('X|Dump Truck|25ton', 'req');
  ok(A.mtStep('X|Dump Truck|25ton') === 'req', '정비 단계가 저장된다');
  A.mtSet('X|Dump Truck|25ton', 'done');
  ok(A.mtStep('X|Dump Truck|25ton') === 'done', '완료로 바뀐다');
  delete S.mt['X|Dump Truck|25ton'];
  ok(A.mtStep('old-style') === '', '없는 건 빈값');
  S.mt['old-style'] = { req: true };
  ok(A.mtStep('old-style') === 'req', 'v2.14 이전 자료도 읽는다');
  delete S.mt['old-style'];

  // 공구 선택 — 없앨 수 없다. 합쳤을 뿐이다
  ok(/fPC/.test(tsrc), 'Phase·공구가 드롭다운 1개로 합쳐졌다');
  ok(!/id="fC"/.test(tsrc), '공구 전용 드롭다운은 사라졌다');
  ok(A.locKey({ s: 'civil', p: 3, c: 1 }) !== A.locKey({ s: 'civil', p: 3, c: 2 }),
     '★공구는 여전히 위치를 가른다 — 3-1과 3-2가 섞이면 안 된다');

  // 화면 — 로고·대비
  ok(/\.brand__logo\{height:38px/.test(css), '로고 26px → 38px');
  ok(/--faint:#8A8A8A/.test(css), '흐린 글씨 대비 상향 (#A6A6A6 → #8A8A8A)');
  ok(/--mute:#5C5C5C/.test(css), '보조 글씨 대비 상향 (#767676 → #5C5C5C)');
  ok(/font-size:14px;line-height:1\.55/.test(css), '본문 13px → 14px');

  // 카드 제목에서 '공종별-?' 제거
  ok(!/T\('rollup'\) \+ ' — '/.test(tsrc), "제목이 '공종별 — ?' 형태가 아니다");

  // v2.15.1 — 사용자 지적 2건
  /* (1) 「오늘 투입」 카드는 v2.16.1에서 없앴고, v2.18.0에서 그 자리를
     요약 띠가 대신한다. 요약 띠의 인원·장비는 「오늘」이 맞다(사용자 확정) —
     검측·측량·자재만 누계다. 기준이 둘이므로 화면에 그 사실을 적어 둔다. */
  ok(/resAgg\(A\.today\(\), A\.today\(\)\)/.test(tsrc),
     '★요약 띠의 인원·장비는 오늘 기준');
  {
    const prev = S.lang; S.lang = 'ko';
    A.setRole('admin'); A.go(1);
    ok(bag.view.innerHTML.indexOf(A.T('sb_n')) > 0,
       '★한 표에 기준이 둘이라는 것을 화면에 적는다');
    S.lang = prev;
  }
  // (2) 업체 칩이 켜지기만 하고 걸러지지 않았다
  ok(typeof A.inCo === 'function', '업체 필터 함수 있음');
  A.coFlt = 'X'; ok(A.inCo({ by: 'X' }) === true && A.inCo({ by: 'Y' }) === false, '업체명으로 걸린다');
  A.coFlt = '@dir'; ok(A.inCo({}, true) === true && A.inCo({ by: 'X' }) === false, '직영만 남는다');
  A.coFlt = ''; ok(A.inCo({ by: 'X' }) === true, '전체면 다 통과');
  ok(/A\.inCo\(c, isDir\)/.test(tsrc), '투입 집계도 업체 필터를 따른다');
  // (3) '품목'은 자재에만 쓴다. 공종은 '개 공종'
  ok(/u_nwork/.test(tsrc), "공종 수는 '개 공종'으로 쓴다");
  ok(!/nf\(n\) \+ T\('u_item'\)/.test(tsrc), "대분류 머리에 '품목'을 쓰지 않는다");
  /* ★검사 범위를 진행률 표 안으로 좁혔다 (v2.17.1).
     원본 전체를 훑고 있어서, 자재 표가 「품목」을 쓰자 엉뚱하게 걸렸다.
     자재는 품목이 맞다 — 진행률만 공종이어야 한다. */
  {
    const a = tsrc.indexOf('function progTable'), b = tsrc.indexOf('function detailHTML');
    ok(!/nf\(rows\.length\) \+ T\('u_item'\)/.test(tsrc.slice(a, b)),
       "진행률 합계에 '품목'을 쓰지 않는다");
  }

  // v2.15.2 — 진행률 표만 대분류 분류에서 빠져 있었다(사용자 지적)
  ok(/roKey\('prog'/.test(tsrc), '★진행률도 대분류로 접힌다');
  {
    const raw = fs.readFileSync(path.join(ROOT, 'sample/내역서_부지토목_원본샘플_CP949.csv'));
    const brows = A.parseCSV(new TextDecoder('euc-kr').decode(raw));
    const bl = { s: 'civil', p: 3, c: 1 };
    A.readBoqRows(brows, bl);
    A.setRole('admin'); A.setFlt(bl); A.dateFlt = { from: '', to: '' }; A.coFlt = '';
    A.go(1);
    const h1 = bag.view.innerHTML;
    const heads = [...h1.matchAll(/data-ro="prog\|([^"]+)"/g)].map(m => m[1]);
    ok(heads.length >= 6, `진행률 대분류 ${heads.length}개로 갈린다`);
    ok(heads.includes('우수공') && heads.includes('오수공'), '우수공·오수공이 따로 선다');
    ok((h1.match(/class="prow sub"/g) || []).length === 0, '접힌 상태에서는 세부행이 안 나온다');
    ok(!/bar bar--sm/.test(h1), '진행률 표에도 막대가 없다');
    // v2.15.3 — EN/BN 화면에 한글이 남던 문제(사용자 지적)
    //  · itemLine이 규격에 A.trS()를 안 걸고 있었다 → 진행률·작업량 전부 영향
    //  · 마스터에 한글 단위 17종(개소·본·경간·회…)이 섞여 있었다
    ok(/A\.trS\(e\.spec\)/.test(tsrc), '★규격도 A.trS()를 거친다');
    ok(typeof A.trU === 'function', '단위 번역기 있음');
    ok(A.trU('개소', 'en') === 'ea', '개소 → ea');
    ok(A.trU('m3/개소', 'en') === 'm3/ea', '복합 단위도 조각으로 바뀐다');
    ok(A.trU('경간', 'en') === 'span', '경간 → span');
    ok(A.trU('m3', 'en') === 'm3', '영문 단위는 그대로');
    ok(A.trU('개소', 'ko') === '개소', '한국어 화면은 원문 유지');

    // 대분류를 전부 펼친 상태에서 EN·BN 화면에 한글이 남으면 안 된다
    const KOre = /[가-힣]/;
    ['en', 'bn'].forEach(lg => {
      S.lang = lg;
      A.go(1);
      Object.keys(A._roOpen).forEach(k => delete A._roOpen[k]);
      [...new Set([...bag.view.innerHTML.matchAll(/data-ro="([^"]+)"/g)].map(m => m[1]))]
        .forEach(k => { A._roOpen[k] = true; });
      A.go(1);
      const txt = bag.view.innerHTML.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ');
      const hit = [...new Set(txt.match(/[가-힣][가-힣0-9 ·%()]*/g) || [])].map(x => x.trim()).filter(Boolean);
      ok(hit.length === 0, `${lg.toUpperCase()} 화면 한글 0 (펼친 상태)` + (hit.length ? ' — ' + hit.slice(0, 5).join(' / ') : ''));
      Object.keys(A._roOpen).forEach(k => delete A._roOpen[k]);
    });
    S.lang = 'ko';

    // v2.16.0 — 공정표 탭은 감춘다. 코드는 남긴다
  ok(/SCHED_ON = false/.test(tsrc), '공정표 탭 감춤');
  ok(/function v6|V\[6\]|6:/.test(tsrc), '★공정표 코드는 남아 있다 — 되살릴 수 있어야 한다');

  // v2.16.0 — 현황판. 진행률 표 오른쪽 5:2, 스크롤해도 따라온다
    S.lang = 'ko'; A._setup(''); A.setRole('admin'); A.setFlt(bl);
    S.issue.push({ date: A.today(), loc: bl, cat: 'Dump Truck', size: '25ton', cnt: 16 });
    S.crew.push({ id: 'pn-c1', date: A.today(), loc: bl, key: 'T-02', teams: 3, st: 'ok', by: 'PNCO',
      ppl: { eng: 2, fmn: 4, wkr: 60 }, eq: [{ cat: 'Dump Truck', size: '25ton', run: 12, brk: 2, rep: 0 }] });
    A.go(1);
    const hp = bag.view.innerHTML;
    /* ★v2.18.0 — 오른쪽 기둥(현황판)을 철거하고 가로로 눕혔다(사용자 지시).
       기둥은 가로 29%를 늘 먹었고 세로로 회색 막대만 아홉 줄이었다.
       요약 띠(한 줄) + 공구 표로 갈랐다. 도넛은 없앴다. */
    /* ★v2.19.21 — 기둥이 돌아왔다(사용자 확정 「세로로 바꾸자」). 뒤집는다. */
    ok(/class="pg"/.test(hp) && /class="pg__side"/.test(hp), '★오른쪽 기둥이 돌아왔다 (5:2)');
    ok(!/stroke-dasharray/.test(hp), '★도넛 삭제됨');
    ok(/class="sb"/.test(hp), '★요약 띠가 있다');
    ok(/<polyline/.test(hp), '7일 추이 선그래프는 요약 띠에 남는다');
    ['pn_pax', 'pn_eq', 'sb_sec', 'pn_trend'].forEach(k => {
      ok(hp.indexOf(A.T(k)) >= 0, `요약 띠 제목: ${A.T(k)}`);
    });
    ok(hp.indexOf(A.T('sb_t')) > 0, '★공구 표가 있다');
    ok(hp.indexOf(A.T('sb_t')) < hp.indexOf('class="sb"'),
       '★본문이 먼저, 기둥(현황판)이 나중 — 현황판은 오른쪽 칸이다');
    {
      const st2 = A.eqStatus(bl);
      const dt = st2.find(o => o.cat === 'Dump Truck');
      ok(dt && dt.given === 16 && dt.run === 12 && dt.brk === 2, '지급 16 = 가동 12 + 고장 2 + 유휴 2');
    }
    // 사용자 지시로 뺀 것
    ok(!/pn__[\s\S]{0,400}확인 대기/.test(hp), '현황판에 확인대기 없음 (KPI와 중복)');
    ok(!/pn__[\s\S]{0,200}개 조/.test(hp), '현황판에 조 수 없음');
    S.issue = S.issue.filter(x => x.cat !== 'Dump Truck');
    S.crew = S.crew.filter(x => x.id !== 'pn-c1');

    // v2.16.1 — 알림: 문안을 만들어 준다. 왓츠앱 + 카톡용 요약
    A.vendAdd('SHK', 'AL-SHAKAAB', 'Ahmed', '964770123456');
    S.work.push({ id: 'n-w1', date: A.today(), loc: bl, key: 'T-02', qty: 100, st: 'ok', by: 'AL-SHAKAAB' });
    S.crew.push({ id: 'n-c1', date: A.today(), loc: bl, key: 'T-02', teams: 2, st: 'ok', by: 'AL-SHAKAAB',
      ppl: { eng: 1, fmn: 2, wkr: 30 }, eq: [{ cat: 'Dump Truck', size: '25ton', run: 6, brk: 1, rep: 0 }] });
    A.go(5);
    const hn = bag.view.innerHTML;
    ok(/AL-SHAKAAB/.test(hn), '업체별로 묶인다');
    ok(/wa\.me\/964770123456/.test(hn), '전화번호가 있으면 왓츠앱 버튼');
    ok(/id="nSum"/.test(hn), '카톡용 전체 요약 있음');
    {
      const pre = /<pre class="npre" id="nSum">([\s\S]*?)<\/pre>/.exec(hn);
      const txt = pre ? pre[1] : '';
      ok(txt.indexOf('AL-SHAKAAB') >= 0, '요약에 업체가 들어간다');
      // ★사용자 지시로 뺀 것 — 수량·진행률·미처리
      ok(!/\d+\.\d|m3|㎥/.test(txt), '★요약에 작업수량이 없다');
      ok(txt.indexOf('%') < 0, '★요약에 진행률이 없다');
      ok(txt.indexOf(A.T('k_pend')) < 0, '★요약에 미처리가 없다');
    }
    ok(typeof A.vendByName === 'function', '업체명으로 명부를 찾는다');
    ok((A.vendByName('AL-SHAKAAB') || {}).tel === '964770123456', '명부에 전화번호가 저장된다');
    A.vendDel('SHK');
    S.work = S.work.filter(x => x.id !== 'n-w1');
    S.crew = S.crew.filter(x => x.id !== 'n-c1');
    A.go(1);

    // v2.15.4 — 자주 안 쓰는 것은 맨 아래로. 열기 전에는 자리를 차지하지 않는다
    S.lang = 'ko'; A._setup(''); A.go(1);
    const hs = bag.view.innerHTML;
    ok(!/id="planFile"/.test(hs) && !/id="vdCode"/.test(hs) && !/id="syncBtn"/.test(hs),
       '★닫힌 상태에서는 설계·명부·동기화 폼이 없다');
    ok(hs.indexOf('data-stp="plan"') > hs.indexOf('공종별 진행률'),
       '★준비 줄이 진행률보다 아래에 있다');
    ['plan', 'vend', 'sync'].forEach(t => {
      A._setup(t); A.go(1);
      const x = bag.view.innerHTML;
      const on = [/id="planFile"/.test(x), /id="vdCode"/.test(x), /id="syncBtn"/.test(x)];
      ok(on.filter(Boolean).length === 1, `${t} — 한 번에 하나만 열린다`);
    });
    A._setup('');

    delete S.plan[A.locKey(bl)];
    A.save();
  }
}

/* ── 31 원본 감사 + v2.16.2 수정분 ─────────────────────
   ★v2.16.1을 검사가 통과시켰다. 화면을 그려 보는 검사만 있고
     원본 자체를 훑는 검사가 없었기 때문이다(6-B). */
console.log('\n[31] 원본 감사 · v2.16.2 수정분');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'assets/css/app.css'), 'utf8');

  /* 31-1. 같은 이름을 두 번 정의하면 나중 것이 앞의 것을 조용히 덮어쓴다 */
  ['tabs', 'core', 'vendor', 'spot'].forEach(function (f) {
    const src = fs.readFileSync(path.join(ROOT, 'assets/js', f + '.js'), 'utf8');
    const seen = {};
    for (const m of src.matchAll(/\n  function (\w+)\s*\(/g)) seen[m[1]] = (seen[m[1]] || 0) + 1;
    const dup = Object.keys(seen).filter(k => seen[k] > 1);
    ok(dup.length === 0, `${f}.js — 함수 중복 정의 0${dup.length ? ' (★' + dup.join(', ') + ')' : ''}`);
  });
  ok(/function eqTableHTML/.test(tsrc) && /function eqHTML\s*\(\s*px\s*\)/.test(tsrc),
     '★장비 표와 직영 장비 입력폼이 다른 이름이다');

  /* 31-2. 장비 규격 — EQ_TREE 한 줄은 {cat, sizes} 다 */
  ok(!/sizes\.push\(t\.size\)/.test(tsrc), '★t.size(단수)를 읽지 않는다');
  ok(/var sizes = A\.eqSizes\(eqAddCat\)/.test(tsrc), '규격은 A.eqSizes로 가져온다');
  {
    const cat = A.EQ_TREE[0] && A.EQ_TREE[0].cat;
    ok(!!cat && A.eqSizes(cat).length > 0, `종류를 고르면 규격이 나온다 (${cat})`);
  }

  /* 31-3. 내역서 확인필요 — 위치·선택유지·별칭 재적용 */
  ok(/function boqHere/.test(tsrc), '확인필요 목록의 문지기가 있다');
  /* ★v2.19.4 — 종전 검사는 반대를 못 박고 있었다. 화면 위치와 대조하는 것을
     통과 조건으로 걸어 두어, 67개가 안 뜨는 결함이 검사에서는 「정상」으로
     나왔다. ★주석에도 옛 식이 적혀 있으므로 **함수 몸통만** 떼어 본다 —
     원본 전체로 찾으면 주석에 걸려 거짓 실패한다(실제로 그랬다). */
  {
    const i0 = tsrc.indexOf('function boqHere');
    const body = tsrc.slice(i0, tsrc.indexOf('function boqNeedHTML'));
    ok(i0 > 0 && !/pkLoc\('w'\)/.test(body),
       '★화면 위치(pkLoc)와 대조하지 않는다 — 안 따라가는 옛 변수다');
  }
  ok(/function boqKeep/.test(tsrc) && /boqKeep\(\);\s*\/\* ★빼기 전에/.test(tsrc),
     '★[제외]를 눌러도 고른 것이 날아가지 않는다');
  ok(/it\.pick === /.test(tsrc), '고른 값이 다시 그려도 남는다(selected)');
  ok(/\/\^alias\/\.test\(m\.how\)/.test(tsrc),
     '★저장하면 방금 배운 별칭으로 남은 줄을 다시 훑는다(느슨한 별칭 포함)');

  /* 31-4. 배치 */
  ok(!/max-width:1240px/.test(css), '★본문 폭을 묶지 않는다 — 좌우 공백 없음');
  /* ★v2.19.21 — 5:2 격자가 돌아왔다. 가로 띠는 고정하는 순간 반드시
     본문을 덮는다는 것이 네 판(v2.19.15~20)에 걸쳐 확인됐다. */
  ok(/\.pg\{display:grid;grid-template-columns:5fr 2fr/.test(css),
     '★.pg 5:2 격자');
  /* ★★v2.19.9에서 뒤집었다 — 종전 세 줄은 「띠를 고정한다」를 통과 조건으로
     못 박고 있었고, 그것이 바로 공구 표 머리행을 덮던 결함이었다.
     [31-3]과 같은 꼴이다. 되살리려면 겹침부터 풀 것(0-D). */
  ok(!/scr-dn/.test(css), '★요약 띠에 스크롤 방향 규칙이 없다');
  /* ★사용자가 직접 발견 — body에 'dn' 클래스를 쓰면 기존 .dn{color:var(--danger)}
     (고장 표시용 빨간 글씨)와 이름이 겹쳐 화면 전체 글씨가 빨개졌다.
     감시 자체는 지웠지만 이 규칙은 남긴다 — 다음에 body 클래스를 붙일 때도 같다. */
  ok(!/document\.body\.classList\.add\('dn'\)/.test(tsrc),
     '★body 클래스에 기존 .dn과 겹치는 이름을 쓰지 않는다');
  ok(!/scr-dn/.test(tsrc.replace(/\/\*[\s\S]*?\*\//g, '')),
     '★스크롤 방향 감시는 지웠다 (주석 설명만 남는다)');
  /* ★v2.19.15 — 사용자가 다시 「위에 고정」을 지시했다. 뒤집는다.
     단 v2.18.0의 「스크롤 방향을 보고 내렸다 올렸다」는 되살리지 않는다 —
     그것이 .dn 이름 겹침과 머리행 가림을 만들었다. 항상 보이는 고정이다. */
  ok(!/--tabh/.test(css), '★쓰지 않게 된 --tabh를 되살리지 않는다');
  ok(!/body:not\(\.vbody\)\s*\.brand/.test(css), '★브랜드바를 가운데로 몰지 않는다');
}

/* ── 32 지적 결함 2차 (v2.16.2) ───────────────────────── */
console.log('\n[32] 표기·기록·유지 — 2차 수정분');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  const csrc = fs.readFileSync(path.join(ROOT, 'assets/js/core.js'), 'utf8');
  const bl = { s: 'civil', p: 3, c: 1 };
  A.setRole('admin'); S.lang = 'ko'; A.setFlt(bl);

  /* 32-1. 직영 기록 표가 다른 표와 같은 옷을 입는다 */
  ok(!/<table class="tb">/.test(tsrc), '★class="tb"(정의 없는 이름) 제거');
  {
    /* 기록이 있어야 표가 그려진다 — 없으면 빈 안내가 나온다 */
    A.addDirect({ date: A.today(), loc: bl, task: '현장정리', teams: 1,
                  ppl: { wkr: 3 }, eq: [], by: 'SM' });
    A.go(7);
    const h = bag.view.innerHTML;
    const i = h.indexOf(A.T('d_list'));
    ok(i > 0 && h.slice(i, i + 400).indexOf('class="tw"') > 0,
       '★직영 기록도 .tw로 감싼다 — 글씨·정렬이 다른 표와 같아진다');
  }

  /* 32-2. 장비 지급 기록을 고칠 수 있다 */
  S.issue.length = 0;
  S.issue.push({ id: 'ix1', date: A.today(), loc: bl, cat: 'Dump Truck', size: '25ton', cnt: 16 });
  ok(A.issueRows(A.flt()).length === 1, '지급 기록이 목록으로 나온다');
  ok(A.setIssueCnt('ix1', 12), '★수량을 고칠 수 있다 (회수해서 줄었을 때)');
  ok(S.issue[0].cnt === 12, '고친 값이 남는다');
  /* ★v2.16.5 — 밑으로 쌓이던 목록을 없애고 표 안 규격 줄에서 고친다 */
  {
    const bl2 = { s: 'civil', p: 3, c: 1 };
    A.setFlt(bl2);
    A.setEqQty(bl2, 'Dump Truck', '25ton', 'give', 16);
    A.setEqQty(bl2, 'Dump Truck', '25ton', 'take', 4);
    const n = S.issue.filter(g => g.cat === 'Dump Truck').length;
    A.setEqQty(bl2, 'Dump Truck', '25ton', 'give', 20);
    ok(S.issue.filter(g => g.cat === 'Dump Truck').length === n,
       '★고쳐도 줄이 늘지 않는다 (같은 자리를 고친다)');
    const st = A.eqStatus(A.flt()).filter(x => x.cat === 'Dump Truck')[0];
    ok(!!st && st.gv === 20 && st.tk === 4, '지급 20 · 회수 4');
    ok(!!st && (st.gv - st.tk) === 16, '★보유 = 지급 − 회수 = 16');
    A.go(1);
    ok(!/class="ei"/.test(bag.view.innerHTML), '★밑으로 쌓이던 지급 기록 목록 없음');
    const tsrc2 = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
    /* ★v2.19.14 — 입력칸이 규격 줄에서 **업체 줄**로 내려갔다.
       보유가 업체 축이 되면서, 어느 업체의 대수인지 정해지지 않은 칸은
       고칠 수가 없다. 그래서 키 끝에 업체가 붙는다. */
    ok(/data-eqq="' \+ k \+ '\|give\|' \+ ck \+ '"/.test(tsrc2), '표 안에 지급 칸이 있다');
    ok(/data-eqq="' \+ k \+ '\|take\|' \+ ck \+ '"/.test(tsrc2), '표 안에 회수 칸이 있다');
    ok(!/function eqIssueHTML/.test(tsrc2), '쌓이는 목록 코드도 제거');
  }
  A.setEqQty({ s: 'civil', p: 3, c: 1 }, 'Dump Truck', '25ton', 'give', 0);
  ok(true, '0으로 낮추면 사라진 것과 같다');
  /* 옛 줄(id 없음)도 다룰 수 있어야 한다 */
  S.issue.push({ date: A.today(), loc: bl, cat: 'Tire Roller', size: '', cnt: 4 });
  ok(!!A.issueRows(A.flt())[0].id, '★id 없는 옛 줄에도 id를 채운다(지우지 않는다)');
  S.issue.length = 0;

  /* 32-3. 내가 지우지 않으면 초기화 금지 */
  ok(/S\.boq && S\.boq\.need/.test(tsrc), '★확인 목록을 저장소에서 되살린다');
  ok(/function boqStore/.test(tsrc), '목록이 바뀌면 저장한다');
  ok(/boq: null/.test(csrc), '저장소에 자리가 있다');

  /* 32-4. 마지막으로 보던 탭 */
  ok(/var cur = \+\(S\.tab \|\| 1\)/.test(tsrc), '★다시 들어오면 마지막 탭');
  ok(/S\.tab = i; A\.save\(\)/.test(tsrc), '탭을 옮기면 기억한다');
  A.go(1);
}

/* ── 33 상단 정리 (사용자 지시) ─────────────────────── */
console.log('\n[33] 상단 KPI 삭제 · 명칭 · 화살표');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'assets/css/app.css'), 'utf8');
  A.setRole('admin'); S.lang = 'ko'; A.go(1);
  const h = bag.view.innerHTML;
  const head = h.slice(0, h.indexOf('class="pg__s"') > 0 ? h.indexOf('class="pg__s"') : h.length);
  ok(head.indexOf(A.T('k_rate')) < 0, '★평균 진행률 카드 없음');
  ok(head.indexOf(A.T('k_pend')) < 0, '★확인 대기 카드 없음');
  ok(head.indexOf(A.T('e_long')) < 0, '★장기 고장·수리 카드 없음');
  ok(head.indexOf(A.T('k_short')) < 0, '★자재 부족 카드 없음');
  ok(!/kpi\('kpi--lead', T\('k_rate'\)/.test(tsrc), '코드에서도 지웠다');
  ok(/class="sb"/.test(h), '요약 띠에서 총인원·총장비를 본다');
  ['ko', 'en', 'bn'].forEach(lg => {
    const prev = S.lang; S.lang = lg;
    const nm = A.T('app'); S.lang = prev;
    ok(!/토목팀|Civil Team|সিভিল টিম/.test(nm), `${lg} 상단 명칭 변경됨 (${nm})`);
  });
  ok(/\.fltbox select\.in\{padding-right:26px/.test(css),
     '★위치 선택 드롭다운 화살표가 글자를 덮지 않는다');

  /* ★설계수량 올림 표시 — KPI 카드를 지우면서 같이 사라졌던 것(사용자 지적) */
  /* ★v2.17.6 — 설계수량 표시는 진행률 카드에서 위치 필터 옆(planBadge)
     으로 옮겼다. 카드에 또 있으면 같은 정보가 두 번이다. */
  {
    const lk33 = A.locKey({ s: 'civil', p: 3, c: 1 });
    S.plan[lk33] = S.plan[lk33] || {}; S.plan[lk33]['T-02'] = 500;
  }
  A.setFlt({ s: 'civil', p: 3, c: 1 }); A.go(1);
  ok(/class="pbg pbg--y"/.test(bag.fltBox.innerHTML), '★설계수량 표시가 위치 필터 옆에 있다');
  A.setFlt({ s: 'civil', p: 9, c: 9 }); A.go(1);
  ok(/class="pbg"/.test(bag.fltBox.innerHTML) && !/pbg--y/.test(bag.fltBox.innerHTML),
     '★설계수량 없는 위치에서는 미등록이라고 알린다');
  A.setFlt({ s: 'civil', p: 3, c: 1 });
}

/* ── 34 대분류 펼치기 (v2.16.6) ────────────────────────
   ★roOpen을 읽는 곳은 셋이었는데 그 값을 바꾸는 처리기가 없었다.
     검사가 A._roOpen으로 직접 켜고 확인해서 통과했다 — 화면은 안 열렸다.
     이제 처리기 자체가 붙어 있는지를 본다. */
console.log('\n[34] 진행률·작업량·인원 대분류 펼치기');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  ok(/function bindRo/.test(tsrc), '★[data-ro] 처리기가 있다');
  ok(/\$\$\('\[data-ro\]'\)\.forEach/.test(tsrc), '모든 대분류 줄에 건다');
  ok(/eqTableBind\(\);\n[\s\S]{0,120}bindRo\(\);/.test(tsrc),
     '★장비표와 따로 부른다 — 장비표를 감춰도 안 죽는다');

  A.setRole('admin'); S.lang = 'ko';
  /* 설계수량이 있어야 진행률 표가 그려진다 — 검사용으로 한 줄 심는다 */
  {
    const bl3 = { s: 'civil', p: 3, c: 1 };
    S.plan[A.locKey(bl3)] = S.plan[A.locKey(bl3)] || {};
    S.plan[A.locKey(bl3)]['T-02'] = 1000;
    A.setFlt(bl3);
  }
  Object.keys(A._roOpen).forEach(k => delete A._roOpen[k]);
  A.go(1);
  const shut = bag.view.innerHTML;
  const m = /data-ro="(prog\|[^"]+)"/.exec(shut);
  ok(!!m, '진행률에 펼칠 대분류 줄이 있다');
  if (m) {
    ok(shut.indexOf('▸') > 0, '닫혀 있으면 ▸');
    A._roOpen[m[1]] = true;
    A.go(1);
    const open = bag.view.innerHTML;
    ok(open.length > shut.length, '★펼치면 공종이 나온다');
    ok(/class="prow sub"/.test(open), '공종 줄이 붙는다');
    delete A._roOpen[m[1]];
  }
  A.go(1);
}

/* ── 35 기간 선택 단순화 (v2.16.7) ────────────────────── */
console.log('\n[35] 기간 선택 — 지름길 넷 + [직접]');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  A.setRole('admin'); S.lang = 'ko'; A.setFlt({ s: 'civil', p: 3, c: 1 });
  A.go(1);
  ok(/data-rg="prog"/.test(bag.view.innerHTML), '표 머리에 [기간] 단추');
  ok(!/data-rgq=/.test(bag.view.innerHTML), '닫혀 있으면 지름길이 안 보인다');

  /* 열어 본다 */
  const b = { dataset: { rg: 'prog' } };
  ok(/rngOpen = \(rngOpen === b\.dataset\.rg\)/.test(tsrc), '단추를 누르면 열린다');

  /* 지름길 계산 — 오늘/7일/30일/전체 */
  ok(/\['n', 'rg_now'\], \['7', 'rg_7'\], \['30', 'rg_30'\], \['a', 'rg_all'\]/.test(tsrc),
     '★지름길은 넷뿐이다');
  ok(/if \(q === 'a'\) return \{ from: '', to: '' \}/.test(tsrc), '전체는 기간 없음');
  ok(/d\.setDate\(d\.getDate\(\) - \(\+q - 1\)\)/.test(tsrc),
     '★7일은 오늘 포함 7일 (오늘 − 6)');
  ok(/rgPick === id\n?\s*\? '<span class="rg__d"/.test(tsrc) || /rgPick === id/.test(tsrc),
     '★달력은 [직접]을 눌렀을 때만 펼친다');

  /* 4개 언어에 이름이 다 있다 */
  ['ko', 'en', 'bn'].forEach(lg => {
    const prev = S.lang; S.lang = lg;
    const miss = ['rg_now', 'rg_7', 'rg_30', 'rg_pick'].filter(k => !A.T(k) || A.T(k) === k);
    S.lang = prev;
    ok(miss.length === 0, `${lg} 지름길 이름 있음${miss.length ? ' ★' + miss : ''}`);
  });
}

/* ── 36 준비 · 직영 정리 (v2.16.8) ─────────────────────── */
console.log('\n[36] 지급대장 올리기 · 설계량 확인 · 직영 정리');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  const bl = { s: 'civil', p: 3, c: 1 };
  A.setRole('admin'); S.lang = 'ko'; A.setFlt(bl);

  /* 36-1. 지급대장 CSV — 처리기는 있었는데 화면에 칸이 없었다 */
  A._setup('eqgv'); A.go(1);
  ok(/id="isFile"/.test(bag.view.innerHTML), '★지급대장 올리는 칸이 준비에 있다');
  ok(/id="isTpl"/.test(bag.view.innerHTML), '양식 내려받기도 있다');
  ok(/var loc = pkLoc\('w'\);\s+\/\* ★준비는 화면에 고른 위치/.test(tsrc),
     '★화면에 고른 위치로 들어간다');
  {
    const before = S.issue.length;
    const r = A.readIssueRows([['날짜', '장비', '규격', '대수'],
                               [A.today(), 'Dump Truck', '25ton', 6]], bl);
    ok(r.ok === 1 && S.issue.length === before + 1, 'CSV 한 줄이 들어간다');
    S.issue = S.issue.slice(0, before);
  }

  /* 36-2. 올린 설계량을 확인·수정한다 */
  const lk = A.locKey(bl);
  S.plan[lk] = S.plan[lk] || {}; S.plan[lk]['T-02'] = 1234;
  A._setup('plan'); A.go(1);
  {
    const h = bag.view.innerHTML;
    ok(/data-plq="T-02"/.test(h), '★올린 설계량이 목록으로 보인다');
    ok(h.indexOf('1234') > 0 || h.indexOf('1,234') > 0, '수량이 그대로 나온다');
    ok(/data-pld="T-02"/.test(h), '지울 수 있다');
  }
  ok(/\[data-plq\]/.test(tsrc) && /\[data-pld\]/.test(tsrc), '고치기·지우기 처리기가 붙어 있다');
  A._setup('');

  /* 36-3. 직영 — 상단 집계 카드와 인원 그래프 삭제 */
  A.go(7);
  {
    const h = bag.view.innerHTML;
    ok(h.indexOf(A.T('d_sum')) < 0, '★직영투입집계 카드 없음');
    ok(!/class="dbar"/.test(h), '★인원 그래프 없음');
    ok(h.indexOf(A.T('d_list')) > 0, '기록 표는 그대로');
    /* ★v2.16.9 — 입력은 스탭만. 관리자는 [수정]을 눌렀을 때만 폼이 열린다 */
    ok(!/id="dSave"/.test(h), '★관리자 화면에는 입력 폼이 없다');
    ok(/data-ded=/.test(h) && /data-ddel=/.test(h), '확인·수정·삭제는 된다');
    A.setRole('staff'); A.go(7);
    ok(/id="dSave"/.test(bag.view.innerHTML), '★스탭은 입력할 수 있다');
    A.setRole('admin');
  }
  A.go(1);
}

/* ── 37 협력업체가 넣은 위치 (v2.16.9) ───────────────── */
console.log('\n[37] 작업량에 위치 표시');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  /* ★v2.17.9 — 작업량 표의 「위치」 칸을 떼어 「작업위치」 표로 독립시켰다.
     한 공종이 여러 구간에 걸치는데 칸 안에 여러 줄을 쑤셔 넣으니
     작업량 표의 줄 높이가 들쭉날쭉했다(사용자 지시). */
  ok(/function spotTable/.test(tsrc), '★작업위치 표를 따로 만든다');
  ok(!/function spotCell/.test(tsrc), '★작업량 표의 위치 칸은 없앴다(죽은 코드도 제거)');
  ok(/window\.BNCP_SPOT\.label\(w\.spot\)/.test(tsrc), '협력업체가 넣은 STA 구간도 붙는다');

  A.setRole('admin'); S.lang = 'ko';
  /* 확인된 실적이 있어야 작업량 표가 그려진다 — 검사용으로 두 건 심는다 */
  {
    const bl4 = { s: 'civil', p: 3, c: 1 };
    A.setFlt(bl4);
    const key = A.progressRows(A.flt())[0] && A.progressRows(A.flt())[0].e.key;
    /* ★날짜를 오늘로 (v2.19.13) — 작업량·작업위치 기준이 어제에서 오늘로 바뀌었다 */
    S.work.push({ id: 'w-t1', date: A.today(), loc: bl4, key: key, qty: 10, st: 'ok', by: 'LUU',
                  spot: { kind: 'road', f: 0, t: 250 } });
    S.work.push({ id: 'w-t2', date: A.today(), loc: bl4, key: key, qty: 5, st: 'ok', by: 'LUU',
                  spot: { kind: 'road', f: 250, t: 400 } });
  }
  Object.keys(A._roOpen).forEach(k => delete A._roOpen[k]);
  A.go(1);
  const m = /data-ro="(out\|[^"]+)"/.exec(bag.view.innerHTML);
  ok(!!m, '작업량에 펼칠 대분류가 있다');
  {
    const h = bag.view.innerHTML;
    /* ★sp_loc은 공구 표의 칸 머리에도 쓰인다 — 작업량 카드 뒤에서 찾는다 */
    const after = h.indexOf(A.T('ro_out'));
    ok(h.indexOf(A.T('sp_loc'), after) > 0, '★작업위치 표가 작업량 바로 밑에 있다');
    ok(/id="locCsv"/.test(h), 'CSV 내려받기가 있다');
  }
  A.go(1);
}

/* ── 38 독촉 (v2.17.0) ───────────────────────────────── */
console.log('\n[38] 독촉 — 마감 08:00 · 30분 간격 두 번');
{
  const bl = { s: 'civil', p: 3, c: 1 };
  A.setRole('admin'); S.lang = 'ko'; A.setFlt(bl);
  ok(A.DUE.hour === 8 && A.DUE.gap === 30, '마감 8시 · 간격 30분');

  const D = (h, m) => { const d = new Date(A.today() + 'T00:00:00'); d.setHours(h, m, 0, 0); return d; };
  S.vend.length = 0;
  S.vend.push({ name: 'LUU', tel: '964770123456', lang: 'en' });

  /* 마감 전에는 아무도 대상이 아니다 */
  ok(A.dueList(A.flt(), D(7, 30)).co.length === 0, '★마감 전에는 독촉하지 않는다');
  ok(A.dueList(A.flt(), D(8, 0)).co.length === 0, '정각에도 아직 아니다');
  {
    const a = A.dueList(A.flt(), D(8, 30)).co;
    ok(a.length === 1 && a[0].stage === 1, '★08:30 — 1차');
    ok(a[0].miss.indexOf('crew') >= 0, '빠진 항목이 잡힌다 (' + a[0].miss.join(',') + ')');
    const b = A.dueList(A.flt(), D(9, 0)).co;
    ok(b.length === 1 && b[0].stage === 2, '★09:00 — 2차');
  }
  /* 넣으면 빠진다 */
  S.work.push({ id: 'w-du', date: A.today(), loc: bl, key: 'T-02', qty: 1, st: 'sub', by: 'LUU' });
  S.crew.push({ id: 'c-du', date: A.today(), loc: bl, by: 'LUU', ppl: { wkr: 1 },
                eq: [{ cat: 'Dump Truck', size: '25ton', run: 1, brk: 0, rep: 0 }] });
  ok(A.dueList(A.flt(), D(9, 0)).co.length === 0, '★다 넣으면 대상에서 빠진다');

  /* 스탭 — 요청 30분/60분 */
  S.insp.length = 0;
  const at = h => { const d = D(h, 0); return d.toISOString(); };
  S.insp.push({ id: 'i-du', date: A.today(), loc: bl, key: 'T-02', st: 'apply',
                at: at(10), staff: '김OO', hist: [] });
  ok(A.dueList(A.flt(), D(10, 10)).staff.length === 0, '요청 10분 뒤 — 아직');
  {
    const a = A.dueList(A.flt(), D(10, 30)).staff;
    ok(a.length === 1 && a[0].stage === 1 && a[0].insp === 1, '★30분 — 1차');
    ok(A.dueList(A.flt(), D(11, 0)).staff[0].stage === 2, '★60분 — 2차');
  }
  /* 시각 없는 옛 기록 — 어제 것이면 곧바로 2차 */
  S.insp.length = 0;
  S.insp.push({ id: 'i-old', date: '2020-01-01', loc: bl, key: 'T-02', st: 'apply', staff: '김OO', hist: [] });
  ok(A.dueList(A.flt(), D(9, 0)).staff[0].stage === 2, '★시각 없는 옛 기록 — 곧바로 2차');
  /* 확인하면 빠진다 */
  S.insp[0].st = 'ready';
  ok(A.dueList(A.flt(), D(9, 0)).staff.length === 0, '★확인하면 대상에서 빠진다');

  /* 새 요청에는 시각이 남는다 */
  {
    const vsrc = fs.readFileSync(path.join(ROOT, 'assets/js/vendor.js'), 'utf8');
    ok((vsrc.match(/at: A\.nowISO\(\)/g) || []).length === 2,
       '★검측·측량 요청에 시각을 남긴다 (날짜만으로는 30분을 못 잰다)');
  }
  S.insp.length = 0; S.work.pop(); S.crew.pop(); S.vend.length = 0;
}

/* ── 39 자재 : 설계 · 재고 · 지급 (v2.17.1) ─────────────── */
console.log('\n[39] 자재 — 설계 · 재고 · 지급 세 칸');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  const bl = { s: 'civil', p: 3, c: 1 };
  A.setRole('admin'); S.lang = 'ko'; A.setFlt(bl);
  A.go(4);
  const h = bag.view.innerHTML;
  ok(!/data-mseg/.test(h), '★창고/플랜트 세그먼트 없음 — 칸막이 단추는 되살리지 않았다');
  ok(!/data-mapv/.test(h) && !/data-mdeny/.test(h) && !/data-miss=/.test(h),
     '★신청·승인·지급 절차 단추 없음');
  ok(/MAT_FLOW_ON = false/.test(tsrc) && /function v4Full/.test(tsrc), '옛 화면은 보존');

  /* ★v2.22.2 — 종전 검사는 「플랜트 자재가 섞이지 않는다」였다(v2.17.1 결정).
     사용자가 결정을 **바꿨다** — 「플랜트 자재도 보이게 한다」.
     이유 : 협력업체가 올린 레미콘·모래 신청이 화면 어디에도 안 나와,
     올린 사람은 올렸는데 받는 사람은 못 보는 상태였다.
     ★검사를 통과시키려고 고친 것이 아니다. 결정이 바뀌어 검사도 바뀐 것이다.
     ★칸막이 단추(data-mseg)와 5단계 절차는 **되살리지 않았다** — 그건
       여전히 시스템 밖 일이다. 바뀐 것은 「표에 보이느냐」뿐이다. */
  ok(!/A\.mVariance\(f, false\)/.test(
       fs.readFileSync(path.join(ROOT, 'assets/js/core.js'), 'utf8')),
     '★matRows가 창고만 세도록 못 박혀 있지 않다 (v2.17.1 결정 변경)');

  /* 재고는 사람이 넣는다 */
  const row = A.mVariance(A.flt(), false)[0];
  if (row) {
    ok(A.stockOf(A.flt(), row.id) === null, '처음에는 재고가 비어 있다');
    A.setStock(A.flt(), row.id, 340);
    ok(A.stockOf(A.flt(), row.id) === 340, '★넣은 재고가 남는다');
    A.go(4);
    ok(/data-mst=/.test(bag.view.innerHTML), '재고 입력 칸이 표에 있다');
    /* 위치가 다르면 재고도 다르다 — 창고는 위치별이다 */
    A.setFlt({ s: 'civil', p: 3, c: 2 });
    ok(A.stockOf(A.flt(), row.id) === null, '★다른 위치에는 안 따라간다');
    A.setFlt(bl);
    A.setStock(A.flt(), row.id, '');
    ok(A.stockOf(A.flt(), row.id) === null, '지우면 빈다');
  }
  A.go(1);
}

/* ── 40 위치 옆 수량 표시 · 관리자 작업현황의 직영 (v2.17.2) ── */
console.log('\n[40] 설계수량 표시 · 관리자 화면 직영');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  const bl = { s: 'civil', p: 3, c: 1 };
  S.lang = 'ko';

  /* 40-1. 위치 선택 옆에 올림 여부 */
  ok(/function planBadge/.test(tsrc), '★위치 선택 옆에 표시가 붙는다');
  A.setRole('admin'); A.setFlt(bl); A.go(1);
  {
    const lk = A.locKey(bl);
    S.plan[lk] = S.plan[lk] || {}; S.plan[lk]['T-02'] = 500;
    A.go(1);
    ok(/class="pbg pbg--y"/.test(bag.fltBox.innerHTML), '★올린 구간은 주황으로');
    A.setFlt({ s: 'civil', p: 9, c: 9 }); A.go(1);
    ok(/class="pbg"/.test(bag.fltBox.innerHTML) && !/pbg--y/.test(bag.fltBox.innerHTML),
       '★안 올린 구간은 「없음」으로');
    A.setFlt(bl);
  }
  ok(/o\.t \+ \(has \? ' ●' : ''\)/.test(tsrc), '드롭다운 목록에도 ● 표시');

  /* 40-2. 직영 — 관리자는 작업현황에서, 스탭은 탭7 그대로 */
  A.setRole('admin'); A.go(1);
  ok(bag.view.innerHTML.indexOf(A.T('d_list')) > 0, '★관리자 작업현황에 직영이 있다');
  ok(!/data-tab="7"/.test(bag.tabs.innerHTML), '관리자에게는 직영 탭이 없다 — 중복 방지');
  ok(!/id="dSave"/.test(bag.view.innerHTML), '관리자는 입력 폼 없음 (확인·수정만)');

  A.setRole('staff'); A.go(1);
  ok(bag.view.innerHTML.indexOf(A.T('d_list')) < 0, '★스탭 작업현황은 그대로 — 직영 없음');
  ok(/data-tab="7"/.test(bag.tabs.innerHTML), '★스탭은 직영 탭 그대로');
  A.go(7);
  ok(/id="dSave"/.test(bag.view.innerHTML), '★스탭은 탭7에서 입력한다 — 안 건드렸다');
  A.setRole('admin'); A.go(1);
}

/* ── 41 작업현황 순서 (v2.17.3 사용자 지시) ──────────────
   ★인력 → 장비 → 직영 → 작업량 → 진행률 → 생산성 → 준비.
     순서는 눈으로만 확인하면 다음 회차에 조용히 어긋난다. 자리로 못박는다. */
console.log('\n[41] 작업현황 순서');
{
  A.setRole('admin'); S.lang = 'ko';
  const bl = { s: 'civil', p: 3, c: 1 };
  S.plan[A.locKey(bl)] = S.plan[A.locKey(bl)] || {};
  S.plan[A.locKey(bl)]['T-02'] = 500;
  S.work.push({ id: 'w-ord', date: A.today(), loc: bl, key: 'T-02', qty: 1, st: 'ok', by: 'LUU' });
  A.setFlt(bl); A.go(1);
  const h = bag.view.innerHTML;
  const at = t => h.indexOf(t);
  const want = [
    ['인력', A.T('ro_ppl')],
    ['장비', A.T('eq_st')],
    ['직영', A.T('d_list')],
    ['작업량', A.T('ro_out')],
    ['진행률', A.T('progress')],
    /* ★「실측 생산성」은 확인대기 카드 부제에도 들어 있어 먼저 걸린다.
       카드에만 있는 문구(부제)를 기준으로 잡는다. */
    /* ★h_prod(부제)는 v2.17.6에서 카드 설명을 없애며 지웠다.
       빈 상태 문구(z_prod_n)로 잡는다 — prod 카드에만 있다. */
    ['생산성', A.T('z_prod_n')],
    ['준비', A.T('sp_t')]
  ].map(x => ({ nm: x[0], i: at(x[1]) }));
  want.forEach(w => ok(w.i > 0, `${w.nm} 있음`));
  for (let i = 1; i < want.length; i++) {
    ok(want[i - 1].i < want[i].i, `★${want[i - 1].nm} → ${want[i].nm}`);
  }
  S.work.pop(); A.go(1);
}

/* ── 42 현황판 개선 (v2.17.4 사용자 지적) ──────────────── */
console.log('\n[42] 요약 띠 · 공구 표 (v2.18.0)');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'assets/css/app.css'), 'utf8');
  const bl = { s: 'civil', p: 3, c: 1 };
  A.setRole('admin'); S.lang = 'ko'; A.setFlt(bl);

  ok(!/function panelHTML/.test(tsrc), '★현황판 함수 제거 — 죽은 코드를 남기지 않는다');
  ok(!/function donutSVG/.test(tsrc), '★도넛 제거');
  ok(/function summaryHTML/.test(tsrc) && /function siteTable/.test(tsrc),
     '요약 띠와 공구 표가 있다');

  /* 공구 표 — 작업 없는 공구는 줄을 만들지 않는다 */
  S.crew.push({ id: 's1', date: A.today(), loc: bl, by: 'LUU', key: 'T-02', st: 'ok',
                teams: 1, ppl: { wkr: 9 },
                eq: [{ cat: 'Dump Truck', size: '25ton', run: 6, brk: 1, rep: 0 }] });
  /* ★현장 현황의 작업위치는 「오늘 투입」에서 나온다 — 실적이 아니다 */
  S.crew.push({ id: 's2', date: A.today(), loc: bl, key: 'T-02', st: 'ok', teams: 1,
                ppl: { wkr: 1 }, eq: [], by: 'LUU', spot: { kind: 'road', f: 0, t: 250 } });
  {
    /* 이 공구만 본다 — 앞 절이 남긴 다른 공구 자료가 섞이지 않게 */
    const r = A.siteRows(A.flt());
    ok(r.length === 1, `★작업 있는 공구만 줄이 된다 (${r.length}줄)`);
    ok(r[0].pax > 0 && r[0].run === 6, '인원·장비가 잡힌다');
    ok(r[0].cos.indexOf('LUU') >= 0, '★공구당 업체 — 한 줄에 한 번만');
    ok(r[0].spots.length >= 1, `작업위치가 잡힌다 (${JSON.stringify(r[0].spots)})`);
    ok(r[0].spots.every(x => !/^[\s·]/.test(x)),
       '★작업위치 앞에 구분점이 남지 않는다 (BNCP_SPOT.label이 · 를 달고 나온다)');
    /* 아무도 안 나온 공구는 줄이 없다 */
    const empty = A.siteRows({ s: 'civil', p: 6, c: 2 });
    ok(empty.length === 0, '★작업 없는 공구는 표시하지 않는다');
  }
  A.go(1);
  {
    const h = bag.view.innerHTML;
    ok(/class="sb"/.test(h), '요약 띠가 그려진다');
    ok(/data-sloc=/.test(h), '★공구 줄을 누르면 그 공구로 조회가 걸린다');
    ok(/class="sp2"/.test(h), '★작업위치는 올리면 펼쳐진다(전부 담고 한 줄로 접음)');
    ok(/\.sp2:hover \.sp2__all/.test(css) && /\.sp2:focus-within \.sp2__all/.test(css),
       '★터치에서도 펼쳐진다 — hover만 두면 태블릿에서 못 본다');
  }
  S.crew.pop(); S.crew.pop(); A.setFlt(bl); A.go(1);
}

/* ── 43 업체별 묶기 (v2.17.5 사용자 지시) ────────────────
   ★인원·장비만. 수량(진행률·작업량)은 설계수량이 위치에 걸려 있어
     업체별 분모를 가를 근거가 없다(사용자 확인). */
console.log('\n[43] 작업현황 업체별 묶기');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  const bl = { s: 'civil', p: 3, c: 1 };
  A.setRole('admin'); S.lang = 'ko'; A.setFlt(bl);
  A._grpBy('work');

  ok(/\[\['work', 't_bywork'\], \['co', 't_byco'\]\]/.test(tsrc), '★공종별·업체별 두 단추');
  ok(/function grpBtn/.test(tsrc), '표마다가 아니라 화면에 하나만 둔다');
  A.go(1);
  /* ★v2.17.6 — 위치 필터 옆이 아니라 인원투입·장비현황 카드 머리로 옮겼다.
     사용자 지적: 위치 선택 줄에 얹으니 무엇을 고르는 건지 알 수 없었다. */
  ok(!/data-gb="co"/.test(bag.fltBox.innerHTML), '★위치 필터 옆에는 없다(옮겼다)');
  {
    const h = bag.view.innerHTML;
    const ppl = h.indexOf(A.T('ro_ppl')), eq = h.indexOf(A.T('eq_st'));
    /* ★v2.18.1 — 표마다 따로 고른다. 단추 값이 'ppl|co' / 'eq|co' 로 갈렸다 */
    ok(ppl > 0 && h.slice(ppl, ppl + 400).indexOf('data-gb="ppl|co"') > 0,
       '★인원투입 카드 머리에 있다');
    ok(eq > 0 && h.slice(eq, eq + 400).indexOf('data-gb="eq|co"') > 0,
       '★장비현황 카드 머리에 있다');
  }

  /* 업체 기준 집계 — A.rollup은 공종키로만 합쳐 업체가 사라진다 */
  S.crew.push({ id: 'g1', date: A.today(), loc: bl, by: 'LUU', key: 'T-02', st: 'ok',
                teams: 1, ppl: { wkr: 9 }, eq: [] });
  S.crew.push({ id: 'g2', date: A.today(), loc: bl, by: 'AL-SHAKAAB', key: 'T-02', st: 'ok',
                teams: 1, ppl: { wkr: 4 }, eq: [] });
  S.direct.push({ id: 'g3', date: A.today(), loc: bl, task: '정리', teams: 1, ppl: { wkr: 2 }, eq: [] });
  {
    const g = A.rollupCo(A.flt());
    ok(g.length === 3, '★업체 3(직영 포함)으로 갈린다');
    const luu = g.filter(x => x.co === 'LUU')[0];
    ok(!!luu && luu.rows[0].pplT === 9, 'LUU 9명');
    ok(g[g.length - 1].dir, '★직영은 맨 끝에 — 협력업체와 성격이 다르다');
    /* 공종별 합계와 업체별 합계가 같아야 한다 */
    const a = A.rollup(A.flt()).reduce((n, x) => n + x.pplT, 0);
    const b = g.filter(x => !x.dir).reduce((n, x) => n + x.rows.reduce((m, r) => m + r.pplT, 0), 0);
    ok(a === b, `★각도만 바꾼 것이다 — 합계가 같다 (${a}/${b})`);
  }
  A._grpBy('co'); A.go(1);
  {
    const h = bag.view.innerHTML;
    const i = h.indexOf(A.T('ro_ppl'));
    ok(i > 0 && h.slice(i, i + 3000).indexOf('LUU') > 0, '★인원 표가 업체로 묶인다');
    ok(h.slice(i, i + 3000).indexOf(A.T('vd_name')) > 0, '첫 칸 이름이 「업체」로 바뀐다');
  }
  A._grpBy('work'); A.go(1);
  {
    const h = bag.view.innerHTML;
    const i = h.indexOf(A.T('ro_ppl'));
    ok(h.slice(i, i + 3000).indexOf('LUU') < 0, '★공종별로 되돌리면 업체가 안 보인다');
  }
  /* 장비도 업체별로 갈린다 */
  S.crew.push({ id: 'g4', date: A.today(), loc: bl, by: 'LUU', key: 'T-02', st: 'ok',
                teams: 1, ppl: { wkr: 1 },
                eq: [{ cat: 'Dump Truck', size: '25ton', run: 6, brk: 1, rep: 0 }] });
  A._grpBy('co'); A.go(1);
  {
    /* ★기준어로 자르지 않는다 — 「장비현황」은 현황판 문구에도 들어 있어
       엉뚱한 자리가 먼저 잡힌다(v2.17.3에서 같은 실수를 했다). */
    const h = bag.view.innerHTML;
    ok(h.indexOf(A.T('eq_st')) > 0, '장비 표가 있다');
    ok(/data-eqo="co\|LUU"/.test(h), '★장비도 업체로 묶인다');
    /* ★종전에는 「보유는 업체 축이라…」 설명 문구가 뜨는지 봤다. 요청 ⑭로
       그 문구를 뺐다 — 만든 사람의 사정이지 보는 사람이 확인할 것이 아니다.
       ★통과시키려고 지운 것이 아니라 **결정이 바뀌어** 검사도 바뀐 것이다.
         이제는 그 문구가 **없는지**를 지킨다(다시 들어오면 걸린다). */
    ok(h.indexOf('위치 필터를 따르지 않는다') < 0 && h.indexOf('eq_co_n') < 0,
       '★설명 문구(보유는 업체 축이라…)가 화면에 없다');
    ok(!/data-eqq=/.test(h), '★업체별에서는 지급·회수 칸을 만들지 않는다');
    /* ★「3개 공종」 오표기 (요청 ⑭) — 장비현황에서 세는 것은 장비 종류다 */
    ok(h.indexOf('개 공종') < 0, '★장비현황에 「N개 공종」이 안 나온다');
    ok(h.indexOf(A.T('u_neq').replace('{n}', '1')) > 0,
       '★장비 종류 수로 표시한다 (장비 N종)');
  }
  A._grpBy('work'); A.go(1);
  ok(/data-eqq=/.test(bag.view.innerHTML) || /class="gr"/.test(bag.view.innerHTML),
     '공종별로 되돌리면 지급·회수 표가 돌아온다');
  S.crew.pop();

  S.crew.pop(); S.crew.pop(); S.direct.pop(); A.go(1);
}

/* ── 44 2차 UI 정리 (v2.17.6 사용자 지적) ──────────────── */
console.log('\n[44] 카드 설명 제거 · 지급입력 재배치 · 일괄삭제');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  const bl = { s: 'civil', p: 3, c: 1 };
  A.setRole('admin'); S.lang = 'ko'; A.setFlt(bl);
  const lk = A.locKey(bl);
  S.plan[lk] = S.plan[lk] || {}; S.plan[lk]['T-02'] = 500;

  /* 44-1. 작업현황 카드 설명 전부 삭제 */
  A.go(1);
  const h1 = bag.view.innerHTML;
  ['ro_n_ppl', 'ro_n_out', 'h_roll', 'h_prod', 'eq_st_n'].forEach(k => {
    ok(h1.indexOf(A.T(k)) < 0, `★설명 삭제 — ${k}`);
  });
  ok(!/pn__n">.*설계가 있는 공종/.test(h1), '★현황판 진행률 설명도 삭제');

  /* 44-2. 지급 입력 — 표 아래, 접힌 토글, 기록 유무 배지 */
  ok(/var eqAddOpen = false/.test(tsrc), '★기본은 접혀 있다');
  ok(/id="eqAddT"/.test(tsrc), '토글 단추가 있다');
  ok(!/T\('h_nogiven'\)/.test(tsrc), '★"지급대장 없음 — 대조대기" 문구 삭제');
  ok(/T\('e_hasrec'\)|T\('e_norec'\)/.test(tsrc), '★대신 배지로 기록 유무를 보인다');
  S.crew.push({ id: 'eq44', date: A.today(), loc: bl, by: 'LUU', key: 'T-02', st: 'ok',
                teams: 1, ppl: { wkr: 1 },
                eq: [{ cat: 'Dump Truck', size: '25ton', run: 3, brk: 0, rep: 0 }] });
  A.go(1);
  {
    const eqI = bag.view.innerHTML.indexOf(A.T('eq_st'));
    const seg = bag.view.innerHTML.slice(eqI, eqI + 6000);
    ok(seg.indexOf('</table>') > 0 && seg.indexOf('id="eqAddT"') > seg.indexOf('</table>'),
       '★입력 토글이 표보다 아래에 있다');
    ok(seg.indexOf('id="eqCat"') < 0, '접혀 있으면 입력 칸이 안 보인다');
  }
  S.crew.pop();

  /* 44-4. 설계수량 일괄삭제 */
  A._setup('plan'); A.go(1);
  ok(/id="plClrAll"/.test(bag.view.innerHTML), '★일괄삭제 단추가 있다');
  ok(/if \(!confirm\(T\('pl_clrall_c'\)\)\) return;/.test(tsrc), '되돌릴 수 없다는 확인을 거친다');
  ok(Object.keys(S.plan[lk]).length > 0, '지우기 전 자료가 있다');
  delete S.plan[lk];    /* 핸들러와 같은 동작 — confirm이 없는 검사 환경이라 직접 재현 */
  ok(!S.plan[lk], '★위치 전체가 한 번에 지워진다');
  A._setup(''); A.go(1);
}

/* ── 45 직영 — 대분류 제거 · 조 수 삭제 (v2.17.7 사용자 지적) ── */
console.log('\n[45] 직영 — 구획 제목 제거 · 조 수 삭제');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  const bl = { s: 'civil', p: 3, c: 1 };
  A.setRole('admin'); S.lang = 'ko'; A.setFlt(bl);
  A.addDirect({ date: A.today(), loc: bl, task: '정리', teams: 1, ppl: { wkr: 2 }, eq: [], by: 'SM' });
  A.go(1);
  const h = bag.view.innerHTML;
  ok(h.indexOf(A.T('d_list')) > 0, '★관리자 작업현황에 직영 기록은 그대로 있다');
  {
    /* ★대분류(구획 제목)가 사라졌는지 — 직영 카드 바로 앞에 sec 헤더가 없어야 한다 */
    const i = h.indexOf('class="card"><div class="card__h"><h2>' + A.T('d_list'));
    const before = h.slice(Math.max(0, i - 200), i);
    ok(!/class="sec"/.test(before), '★직영 앞에 구획 제목이 없다 — 다른 표와 같은 무게');
  }
  /* ★스탭은 여전히 원래 탭7에서 입력 — v2.17.2 그대로 */
  A.setRole('staff'); A.go(1);
  ok(bag.view.innerHTML.indexOf(A.T('d_list')) < 0, '스탭 작업현황에는 여전히 직영이 없다');
  A.go(7);
  ok(/id="dSave"/.test(bag.view.innerHTML), '스탭은 탭7에서 그대로 입력');

  /* ★조 수(팀 수) 입력·표시 삭제 — 양쪽 화면 다 */
  ok(!/id="dTeams"/.test(bag.view.innerHTML), '★스탭 입력폼에 조 수 칸이 없다');
  A.setRole('admin'); A.go(1);
  {
    const seg = bag.view.innerHTML.slice(bag.view.innerHTML.indexOf(A.T('d_list')));
    ok(!/id="dTeams"/.test(seg), '★관리자 수정폼에도 조 수 칸이 없다');
    ok(seg.indexOf(A.T('d_teams')) < 0, '★기록 표 머리에도 조 수 칸이 없다');
  }
  ok(/rec = \{ date: val\('#dDate'\) \|\| A\.today\(\), loc: pkLoc\('d'\), task: task, teams: 1,/.test(tsrc),
     '저장은 teams:1로 고정 — 다른 계산이 참조하는 자리라 값 자체는 남긴다');

  S.direct.pop(); A.go(1);
}

/* ── 46 설명문 일소 · 작업위치 표시 (v2.17.8) ────────────── */
console.log('\n[46] 설명문 일소 · 작업위치');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  const bl = { s: 'civil', p: 3, c: 1 };
  A.setRole('admin'); S.lang = 'ko'; A.setFlt(bl);

  /* 46-1. 탭 제목 옆 설명문이 사라졌다 */
  ok(!/<p>' \+ T\('t' \+ cur \+ 'd'\)/.test(tsrc), '★탭 제목 옆 설명문 삭제');
  A.go(1);
  ok(bag.view.innerHTML.indexOf(A.T('t1d')) < 0, '★작업현황 옆 안내문이 안 나온다');
  A.go(2);
  ok(bag.view.innerHTML.indexOf(A.T('t2d')) < 0, '★검측 탭도 마찬가지');
  A.go(7);
  ok(bag.view.innerHTML.indexOf(A.T('t7d')) < 0, '★직영 탭도 마찬가지');

  /* 46-2. 카드 설명문도 전 탭에서 사라졌다 */
  const gone = ['sp_n', 'h_forprog', 'rc_n', 'bq_n', 'h_reqvendor', 'n_co_n', 'n_sum_n'];
  [1, 2, 3, 4, 5, 7].forEach(t => {
    A.go(t);
    const h = bag.view.innerHTML;
    gone.forEach(k => {
      const v = A.T(k);
      ok(!v || h.indexOf(v) < 0, `★탭${t} — ${k} 없음`);
    });
  });

  /* 46-3. 협력업체가 넣은 작업위치는 작업량 표에 나온다 */
  {
    S.plan[A.locKey(bl)] = S.plan[A.locKey(bl)] || {};
    S.plan[A.locKey(bl)]['T-02'] = 500;
    /* ★w·no를 반드시 넣는다 — 실제 협력업체 입력(vendor.js roadHTML)은
       폭·번호 없이 저장되는 일이 없다. 이게 빠지면 SPOT.roadName()이
       빈 문자열을 내놓아 label()이 우연히 ' · '로 시작해 버려서,
       위치코드 뒤에 구분자를 또 붙이는 실제 버그(요청 2)를 못 잡는다. */
    S.work.push({ id: 'w46', date: A.today(), loc: bl, key: 'T-02', qty: 10, st: 'ok', by: 'LUU',
                  spot: { kind: 'road', w: '18', no: '2', side: 'L', f: 0, t: 250 } });
    A.setFlt(bl);
    Object.keys(A._roOpen).forEach(k => delete A._roOpen[k]);
    A.go(1);
    const h = bag.view.innerHTML;
    ok(h.indexOf(A.T('sp_loc')) > 0, '★작업위치는 「작업위치」 표에 나온다');
    const i = h.indexOf(A.T('sp_loc'), h.indexOf(A.T('ro_out')));
    ok(h.slice(i, i + 3000).indexOf('Phase 3-1') > 0, 'Phase가 나온다');
    ok(/STA/.test(h.slice(i, i + 3000)) || h.slice(i, i + 3000).indexOf('0+00') > 0,
       'STA 구간도 나온다');
    /* ★★요청 2 (2026-08-23) — 위치코드와 도로명이 눌어붙지 않는다.
       종전에는 「Phase 3-118-2」로 붙어 관리자 눈에 안 보이는 것처럼 읽혔다. */
    ok(h.slice(i, i + 3000).indexOf('Phase 3-118-2') < 0,
       '★★위치코드와 도로명이 안 눌어붙는다');
    S.work.pop();
  }
  A.go(1);
}

/* ── 47 작업위치 표 독립 (v2.17.9 사용자 지시) ─────────── */
console.log('\n[47] 작업위치 — 표 하나로 독립');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'assets/css/app.css'), 'utf8');
  const bl = { s: 'civil', p: 3, c: 1 };
  A.setRole('admin'); S.lang = 'ko'; A.setFlt(bl);
  S.plan[A.locKey(bl)] = S.plan[A.locKey(bl)] || {}; S.plan[A.locKey(bl)]['T-02'] = 500;
  /* ★작업량·작업위치는 기본이 오늘이다(v2.19.13) — 검사 자료도 오늘로 넣는다
     ★w·no 포함 — 46-3과 같은 이유(실제 입력은 폭·번호가 반드시 있다) */
  S.work.push({ id: 'l1', date: A.today(), loc: bl, key: 'T-02', qty: 10, st: 'ok',
                by: 'LUU', spot: { kind: 'road', w: '18', no: '2', side: 'L', f: 0, t: 250 } });
  S.work.push({ id: 'l2', date: A.today(), loc: bl, key: 'T-02', qty: 7, st: 'ok',
                by: 'SHAKAAB', spot: null });
  A.go(1);
  const h = bag.view.innerHTML;
  const i = h.indexOf(A.T('sp_loc'), h.indexOf(A.T('ro_out')));
  ok(i > 0, '★작업위치 표가 있다');
  ok(i > h.indexOf(A.T('ro_out')), '★작업량 바로 밑이다');
  {
    const seg = h.slice(i, i + 4000);
    ok(seg.indexOf('Phase 3-1 · 18-2 · Left · STA 0+00~12+10') > 0, '★구간마다 한 줄');
    /* ★★요청 2 (2026-08-23) — 위치코드와 도로명이 눌어붙지 않는다.
       종전 코드는 label()이 ' · '로 시작한다고 잘못 가정해 구분자를
       안 붙였다. 실제 label()은 안 달고 나오므로 「Phase 3-118-2」처럼
       위치와 도로가 한 숫자로 읽혔다 — 그게 사용자가 「Road/Station이
       관리자 화면에 안 뜬다」고 본 것이었다. */
    ok(seg.indexOf('Phase 3-118-2') < 0,
       '★★위치코드와 도로명이 안 눌어붙는다 (요청 2)');
    ok(!/Phase 3-1 ·  · 18-2/.test(seg),
       '★구분점이 겹치지도 않는다');
    ok(seg.indexOf('LUU') > 0 && seg.indexOf('SHAKAAB') > 0, '어느 업체가 했는지 나온다');
    ok(seg.indexOf('<td class="r sp">' + A.today() + '</td>') > 0, '마지막 작업일이 나온다');
  }
  /* 작업량 표에서는 위치 칸이 빠졌다 */
  ok(!/function spotCell/.test(tsrc), '★작업량 표의 위치 칸 코드 제거');
  ok(!/loc2/.test(css), '★쓰지 않는 CSS도 제거');
  ok(/id="locCsv"/.test(h), 'CSV 내려받기');
  ok(/rngBtn\('loc'\)/.test(tsrc), '기간 단추가 따로 붙는다');
  S.work.pop(); S.work.pop(); A.go(1);
}

/* ── 48 공구 표 세부 (v2.18.0) ────────────────────────── */
console.log('\n[48] 공구 표 — 드릴다운 · 누계 · 죽은 코드');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'assets/css/app.css'), 'utf8');
  const bl = { s: 'civil', p: 3, c: 1 };
  A.setRole('admin'); S.lang = 'ko'; A.setFlt(bl);

  /* 검측·측량·자재는 누계 — 오늘로 자르지 않는다 */
  S.insp.push({ id: 'k1', date: '2020-01-01', loc: bl, key: 'T-02', st: 'apply', hist: [] });
  S.surv.push({ id: 'k2', date: '2020-01-01', loc: bl, key: 'T-02', done: false });
  {
    const r = A.siteRows(A.flt());
    ok(r.length === 1 && r[0].insp === 1 && r[0].surv === 1,
       '★검측·측량은 누계 — 오늘이 아니어도 잡힌다');
    ok(/c\.date !== today/.test(fs.readFileSync(path.join(ROOT, 'assets/js/core.js'), 'utf8')),
       '인원·장비는 오늘 것만 — 기준이 둘이다');
  }
  A.go(1);
  ok(/data-sgo=/.test(bag.view.innerHTML), '★밀린 건수를 누르면 그 탭으로 간다');

  /* 죽은 코드·CSS를 남기지 않는다 */
  ok(!/^\.pn(__|\{)/m.test(css), '★현황판 CSS 제거(주석은 남아도 선택자는 없다)');
  ok(!/class="pn"/.test(bag.view.innerHTML), '화면에도 흔적이 없다');

  S.insp.pop(); S.surv.pop(); A.go(1);
}

/* ── 49 v2.18.1 수정분 ───────────────────────────────── */
console.log('\n[49] 묶기 분리 · 작업위치 기본 오늘 · 공구 첫 칸 · 클래스 충돌');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'assets/css/app.css'), 'utf8');
  const bl = { s: 'civil', p: 3, c: 1 };
  A.setRole('admin'); S.lang = 'ko'; A.setFlt(bl);

  /* 49-1. 스크롤 상태 클래스 이름 충돌 */
  ok(!/classList\.add\('dn'\)/.test(tsrc), '★body에 dn을 붙이지 않는다');
  /* ★v2.19.9 — scr-dn 자체가 없어졌다(0-D). .dn과 겹치지 않는 것만 남는다 */
  ok(/^\.dn\{color:var\(--danger\)\}/m.test(css), '.dn(고장 표시)은 그대로 있다');

  /* 49-2. 묶기 단추가 표마다 따로 */
  A._grpBy('ppl', 'work'); A._grpBy('eq', 'work');
  A._grpBy('ppl', 'co');
  ok(A._grpBy('ppl') === 'co' && A._grpBy('eq') === 'work',
     '★인원만 업체별로 바꿔도 장비는 안 따라간다');
  A._grpBy('ppl', 'work');

  /* 49-3. 작업위치 기본이 오늘 */
  S.work.push({ id: 'q1', date: '2020-01-01', loc: bl, key: 'T-02', qty: 9, st: 'ok', by: 'OLD' });
  S.work.push({ id: 'q2', date: A.today(), loc: bl, key: 'T-02', qty: 5, st: 'ok', by: 'LUU' });
  A.go(1);
  {
    const h = bag.view.innerHTML;
    const i = h.indexOf(A.T('sp_loc'), h.indexOf(A.T('ro_out')));
    const seg = h.slice(i, i + 1200);
    ok(seg.indexOf('2020-01-01') < 0, '★작업위치 기본 기간 밖은 안 섞인다');
    ok(seg.indexOf(A.today()) > 0, '★오늘 것이 나온다 — 반영된 날이 기준(v2.19.13)');
  }
  /* ★v2.19.13에서 뒤집었다 — 종전에는 out·loc이 'yday'인 것을 통과 조건으로
     못 박고 있었다. 사용자 지시로 「반영된 날짜 기준」 = 오늘로 통일했다.
     진행률·생산성은 RNG_DEF에 없다(전 기간) — 그것이 누계 유지의 근거다. */
  ok(/out: 'today', loc: 'today', ppl: 'today', eq: 'today'/.test(tsrc),
     '★표별 기본 기간 — 기간 있는 표는 전부 오늘');
  ok(!/\bout: 'yday'|\bloc: 'yday'/.test(tsrc), '★어제 기본값이 남아 있지 않다');
  ok(!/prog:\s*'/.test(tsrc), '★진행률은 RNG_DEF에 없다 — 누계 그대로(사용자 확정)');
  ok(/insp: 'today', surv: 'today', mat: 'today'/.test(tsrc),
     '★검측·측량·자재는 오늘 (사용자 지시)');

  /* 49-4. 검측·측량·자재 첫 칸이 공구 — 자료가 있어야 표가 그려진다 */
  S.insp.push({ id: 'z1', date: A.today(), loc: bl, key: 'T-02', st: 'apply',
                qty: 5, seq: 1, hist: [], reason: '' });
  S.surv.push({ id: 'z2', date: A.today(), loc: bl, key: 'T-02', done: false, why: '확인' });
  A.go(2);
  ok(bag.view.innerHTML.indexOf('<th>' + A.T('u_sec') + '</th>') > 0, '★검측 첫 칸이 공구');
  A.go(3);
  ok(bag.view.innerHTML.indexOf('<th>' + A.T('u_sec') + '</th>') > 0, '★측량 첫 칸이 공구');
  A.go(4);
  ok(bag.view.innerHTML.indexOf('<th>' + A.T('u_sec') + '</th>') > 0, '★자재 첫 칸이 공구');

  S.insp.pop(); S.surv.pop(); S.work.pop(); S.work.pop(); A.go(1);
}

/* ── 50 파일명으로 위치 판별 (v2.18.2 사용자 지시) ────────── */
console.log('\n[50] 설계수량 — 파일명으로 위치 판별');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');

  /* 50-1. 페이즈 */
  [['BNCP_P3-1_설계수량.xlsx', 'Phase 3-1'],
   ['3-1 물량산출.csv', 'Phase 3-1'],
   ['Phase3-1.xlsx', 'Phase 3-1'],
   ['P 3 - 1 내역서.xlsx', 'Phase 3-1'],
   ['P6-2.xlsx', 'Phase 6-2']].forEach(function (x) {
    const r = A.locFromName(x[0]);
    ok(r.ok && A.locLabel(r.loc) === x[1], `${x[0]} → ${x[1]}`);
  });

  /* 50-2. 블럭 — 타운 글자가 앞에 온다 */
  [['B-7 설계.xlsx', 'Town B · Block 7'],
   ['B7BL_수량.csv', 'Town B · Block 7'],
   ['B7 내역서.xlsx', 'Town B · Block 7'],
   ['C6BL 수량.csv', 'Town C · Block 6']].forEach(function (x) {
    const r = A.locFromName(x[0]);
    ok(r.ok && A.locLabel(r.loc) === x[1], `${x[0]} → ${x[1]}`);
  });

  /* 50-3. 못 정하면 묻는다 — 틀린 곳에 조용히 넣지 않는다 */
  {
    const a = A.locFromName('설계수량.xlsx');
    ok(!a.ok && !a.many, '★이름에 없으면 묻는다');
    const b = A.locFromName('P3-1_and_P4-2.xlsx');
    ok(!b.ok && b.many && b.hits.length === 2, '★여럿이면 묻는다');
    const c = A.locFromName('BL7 물량.xlsx');
    ok(!c.ok && c.blockOnly === 7, '★블럭만 알면 타운을 묻는다');
    const d = A.locFromName('2026-08-17 보고.xlsx');
    ok(!d.ok, '★날짜를 위치로 오인하지 않는다');
    /* 없는 블럭 번호는 안 잡는다 — Town D는 5블럭까지다 */
    ok(!A.locFromName('D9 수량.xlsx').ok, '★없는 블럭 번호는 안 잡는다');
  }

  /* 50-4. 상단 필터를 보지 않는다 · 안내와 목록이 같은 변수를 본다 */
  ok(/var det = A\.locFromName\(f\.name\)/.test(tsrc), '★업로드가 파일명을 본다');
  ok(!/var loc = pkLoc\('w'\);\s*\n\s*var done/.test(tsrc), '★상단 필터로 정하지 않는다');
  ok(/if \(!det\.ok\) \{ planAsk\(f, det\)/.test(tsrc), '못 정하면 읽지 않고 묻는다');
  ok(/var loc = planLoc \|\| pkLoc\('w'\);/.test(tsrc), '★목록이 그 위치를 따라간다');
  ok(/A\.locKey\(planLoc \|\| pkLoc\('w'\)\), v = Number/.test(tsrc),
     '★고치기도 같은 위치를 본다 — 화면과 저장처가 어긋나지 않게');
}

/* ── 51 설계량 서버 저장 (v2.18.4 사용자 지적) ──────────── */
console.log('\n[51] 설계량 — 서버에 남는다');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  const bl = { s: 'civil', p: 3, c: 1 };
  A.setRole('admin'); S.lang = 'ko'; A.setFlt(bl);

  ok(/function txPlan\(/.test(tsrc) && /function txPlanAll\(/.test(tsrc),
     '★설계량 전송 함수가 있다');
  ok(/api\.send\('plan'/.test(tsrc), "종류 'plan'으로 보낸다");
  ok(/id: A\.locKey\(loc\) \+ '\|' \+ code/.test(tsrc),
     '★id가 위치키|공종코드 — 고쳐 다시 보내면 그 줄을 덮어쓴다');

  /* 올린 뒤·고친 뒤·지운 뒤 모두 보낸다 */
  ok(/txPlanAll\(loc\);/.test(tsrc), '파일을 올리면 보낸다');
  ok(/if \(boqLoc\) txPlanAll\(boqLoc\);/.test(tsrc), '내역서에 공종을 붙여도 보낸다');
  ok(/txPlan\(planLoc \|\| pkLoc\('w'\), el\.dataset\.plq, v\)/.test(tsrc), '수량을 고치면 보낸다');
  ok(/txPlan\(planLoc \|\| pkLoc\('w'\), b\.dataset\.pld, 0\)/.test(tsrc), '지우면 0으로 보낸다');

  /* 읽는 길이 하나뿐이다 — 두 벌이면 한쪽만 고쳐져 어긋난다 */
  ok((tsrc.match(/A\.readPlanRows\(rows, loc\)/g) || []).length === 1,
     '★읽는 곳이 한 군데다 (planReadInto)');
  ok(/planReadInto\(f, det\.loc\);/.test(tsrc), '업로드도 그 한 곳을 부른다');

  /* 수신 — 서버에서 받은 설계량이 자리에 앉는다 */
  {
    const lk = A.locKey(bl);
    delete S.plan[lk];
    const r = { id: lk + '|T-02', type: 'plan', date: A.today(),
                s: 'civil', p: 3, c: 1, key: 'T-02', qty: 777 };
    A._unpack ? A._unpack(r) : null;
  }
  ok(/if \(r\.type === 'plan'\)/.test(tsrc), '★받은 설계량을 S.plan에 앉힌다');
  ok(/if \(q > 0\) S\.plan\[lk\]\[r\.key\] = q; else delete/.test(tsrc),
     '0으로 오면 지운다 — 삭제도 다른 PC에 전해진다');
}

/* ── 52 저장 용량 (v2.18.5 사용자 지적) ─────────────────── */
console.log('\n[52] 저장 용량 — 터지기 전에 알린다');
{
  const bl = { s: 'civil', p: 3, c: 1 };
  A.setRole('admin'); S.lang = 'ko'; A.setFlt(bl);

  ok(typeof A.usage === 'function' && A.usage().pct >= 0, '★사용량을 잰다');
  ok(A.KEEP_DAYS === 90, '화면은 최근 90일');

  /* 오래된 확인분만 덜어낸다 — 미처리 건은 남긴다 */
  const n0 = S.work.length;
  S.work.push({ id: 'cap_old_ok', date: '2020-01-01', loc: bl, key: 'T-02', qty: 1, st: 'ok' });
  S.work.push({ id: 'cap_old_sub', date: '2020-01-01', loc: bl, key: 'T-02', qty: 1, st: 'sub' });
  S.work.push({ id: 'cap_new', date: A.today(), loc: bl, key: 'T-02', qty: 1, st: 'ok' });
  S.surv.push({ id: 'cap_surv_open', date: '2020-01-01', loc: bl, key: 'T-02', done: false });
  const r = A.trim(90);
  const ids = S.work.map(x => x.id);
  ok(ids.indexOf('cap_old_ok') < 0, '★90일 지난 확인분은 덜어낸다');
  ok(ids.indexOf('cap_old_sub') >= 0, '★미처리 건은 오래돼도 남긴다 — 밀린 일이 사라지면 안 된다');
  ok(ids.indexOf('cap_new') >= 0, '최근 것은 그대로');
  ok(S.surv.some(x => x.id === 'cap_surv_open'), '★미처리 측량도 남긴다');
  ok(r.n >= 1 && /^\d{4}-\d{2}-\d{2}$/.test(r.cut), `덜어낸 건수·기준일 (${r.n}건 / ${r.cut})`);

  /* 기준 자료는 안 건드린다 */
  {
    const lk = A.locKey(bl);
    S.plan[lk] = S.plan[lk] || {}; S.plan[lk]['T-02'] = 500;
    const vn = S.vend.length;
    A.trim(90);
    ok(S.plan[lk]['T-02'] === 500, '★설계량은 안 덜어낸다 — 쌓이는 자료가 아니다');
    ok(S.vend.length === vn, '★업체 명부도 안 건드린다');
  }

  /* 화면 — 준비에 용량 칸 */
  A._setup('cap'); A.go(1);
  {
    const h = bag.view.innerHTML;
    ok(h.indexOf(A.T('cap_t')) > 0, '★준비에 저장 용량 칸이 있다');
    ok(/class="cap__b"/.test(h), '사용량 막대가 있다');
    ok(/id="capTrim"/.test(h), '직접 덜어내는 단추가 있다');
  }
  A._setup('');

  /* 덜어냈으면 반드시 알린다 — 조용히 지우면 「내 자료가 왜 없지」가 된다 */
  {
    const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/core.js'), 'utf8');
    ok(/S\.trimMsg = A\.T\('cap_trimmed'\)/.test(tsrc), '★자동으로 덜어내면 알린다');
    ok(/catch \(e\) \{\s*\/\*[\s\S]{0,200}var r = A\.trim/.test(tsrc),
       '★저장이 터지면 덜어내고 한 번 더 시도한다');
  }
  S.work = S.work.filter(x => !/^cap_/.test(x.id));
  S.surv = S.surv.filter(x => !/^cap_/.test(x.id));
  A.go(1);
}

/* ── 53 확인한 것이 되살아나던 문제 (v2.18.6 사용자 지적) ── */
console.log('\n[53] 확인 처리가 서버에 남는다');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  const bl = { s: 'civil', p: 3, c: 1 };
  A.setRole('admin'); S.lang = 'ko'; A.setFlt(bl);

  /* 53-1. 되돌려 보내는 길이 생겼다 */
  ok(/function txBack\(type, row\)/.test(tsrc), '★관리자 화면에 전송 함수가 있다');
  ok(/txBack\(kind, x\);/.test(tsrc), '실적·인원장비 확인을 보낸다');
  /* ★v2.20.0에서 뒤집었다 — 옛 [완료] 토글(txBack('surv', x))이 사라졌다.
     참·거짓 하나로는 「측량팀이 못 했다」와 「스탭이 조치 중이다」를 못 가른다.
     이제 결재 흐름 처리기 하나가 두 종류를 다 보낸다. */
  ok(/txBack\(kind, fRow\(kind, id\)\)/.test(tsrc), '측량·자재 결재 결과를 보낸다');
  ok(!/txBack\('surv', x\)/.test(tsrc), '★옛 완료 토글이 남아 있지 않다');
  ok((tsrc.match(/txBack\('insp'/g) || []).length === 4, '검측 상태 변경 4곳 다 보낸다 (v2.31.0 예외확인 포함)');

  /* ★확인 처리가 시트의 공종명·단위를 비우지 않는다 (v2.18.7 사용자 지적).
     협력업체 화면(payload)은 처음부터 채워 보내고 있었다 — 되돌려 보내는
     쪽만 빠져 있었다. 두 쪽이 같은 꼴이어야 한다. */
  ok(/name: e \? e\.name : '', unit: e \? e\.unit : ''/.test(tsrc),
     '★되돌려 보낼 때 공종명·단위를 함께 보낸다');
  ok(/if \(e && e\.spec\) b\.spec = e\.spec;/.test(tsrc), '규격도 보낸다');
  ok(/b\.qty = row\.teams;\s+\/\* 시트 수량칸엔 조 수/.test(tsrc),
     '인원장비는 수량칸에 조 수 — 협력업체와 같은 규칙');
  {
    const vsrc = fs.readFileSync(path.join(ROOT, 'assets/js/vendor.js'), 'utf8');
    ok(/base\.name = e \? e\.name : '';/.test(vsrc),
       '협력업체 쪽도 같은 값을 보낸다(대조 기준)');
  }

  /* 53-2. 확인하면 st가 바뀌고 전송 대상이 된다 */
  {
    S.work.push({ id: 'r53', date: A.today(), loc: bl, key: 'T-02', qty: 5, st: 'sub', by: 'LUU' });
    const w = S.work.filter(x => x.id === 'r53')[0];
    w.st = 'ok'; w.ckAt = A.today();
    ok(w.st === 'ok', '확인하면 ok가 된다');
  }

  /* 53-3. ★핵심 — 서버의 옛 값이 내 확인을 되돌리지 못한다 */
  {
    const rank = { sub: 0, apply: 0, ready: 1, ok: 2, pass: 2, iss: 2 };
    const older = (local, r) => {
      if (!local) return false;
      if (local.done === true && r.done === false) return true;
      const a = rank[local.st], b = rank[r.st];
      return (a !== undefined && b !== undefined && b < a);
    };
    ok(older({ st: 'ok' }, { st: 'sub' }), '★내가 ok인데 서버가 sub면 무시');
    ok(older({ st: 'ready' }, { st: 'apply' }), '★내가 ready인데 서버가 apply면 무시');
    ok(older({ done: true }, { done: false }), '★측량 완료를 미처리로 되돌리지 않는다');
    ok(!older({ st: 'sub' }, { st: 'ok' }), '서버가 더 앞서면 받는다');
    ok(!older({ st: 'apply' }, { st: 'pass' }), '검측 합격도 받는다');
  }

  S.work = S.work.filter(x => x.id !== 'r53');
  A.go(1);
}

/* ── 54 협력업체 자재신청이 관리자 화면에 뜬다 (v2.18.8 사용자 지적) ── */
console.log('\n[54] 자재신청이 관리자 화면에 뜬다');
{
  const csrc = fs.readFileSync(path.join(ROOT, 'assets/js/core.js'), 'utf8');
  const bl = { s: 'civil', p: 3, c: 1 };
  A.setRole('admin'); S.lang = 'ko'; A.setFlt(bl);

  /* 54-1. 같은 이름이 두 번 정의돼 앞의 것이 죽어 있었다 */
  {
    const m = {};
    for (const x of csrc.matchAll(/\n  A\.(\w+) = function/g)) m[x[1]] = (m[x[1]] || 0) + 1;
    const dup = Object.keys(m).filter(k => m[k] > 1);
    ok(dup.length === 0, `core.js A.* 중복 정의 0${dup.length ? ' ★' + dup.join(',') : ''}`);
  }

  /* 54-2. ★신청만 있는 줄이 살아남는다 — 지급 전이라 다른 칸은 다 비었다 */
  ok(/return a\.design \|\| a\.iss \|\| a\.req \|\| a\.stock != null;/.test(csrc),
     '★신청(req)도 남긴다');
  {
    const before = S.mreq.length;
    const m = A.addMreq({ date: A.today(), loc: bl, grp: '우수관', sub: '우수맨홀',
                          mat: '모래', spec: '', unit: 'M3', qty: 3, by: 'ALSKHAA COMPANY' });
    ok(m.st === 'req', '협력업체 신청은 req 상태로 들어온다');
    const hit = A.matRows(A.flt()).filter(r => r.mat === '모래')[0];
    ok(!!hit, '★신청이 관리자 목록에 뜬다 (종전에는 사라졌다)');
    ok(hit && hit.req === 3 && hit.iss === 0 && !hit.design,
       '지급·설계가 없어도 신청 수량만으로 뜬다');
    A.go(4);
    ok(bag.view.innerHTML.indexOf(A.T('m_req')) > 0, '★화면에 「신청」 칸이 있다');
    S.mreq = S.mreq.slice(0, before);
  }
  A.go(1);
}

/* ── 55 반려 (v2.18.8 사용자 지시) ────────────────────── */
console.log('\n[55] 확인 필요 — 반려 + 독촉 문자');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  const vsrc = fs.readFileSync(path.join(ROOT, 'assets/js/vendor.js'), 'utf8');
  const bl = { s: 'civil', p: 3, c: 1 };
  A.setRole('admin'); S.lang = 'ko'; A.setFlt(bl);

  ok(/data-ckno=/.test(tsrc), '★반려 단추가 있다');
  ok(/w\.st = 'rej'; w\.ckOk = 1; w\.rejWhy/.test(tsrc), '반려 사유를 남긴다');
  ok(!/S\.work = S\.work\.filter[\s\S]{0,60}ckno/.test(tsrc),
     '★반려해도 지우지 않는다 — 무엇을 왜 고칠지 알아야 한다');
  ok(/rej: 0\.5/.test(tsrc), '★반려가 서버의 sub에 덮이지 않는다');

  /* 협력업체가 본다 — 날짜 무관 */
  ok(/x\.st === 'rej' && A\.locKey\(x\.loc\) === lk/.test(vsrc),
     '★협력업체 화면에 반려가 날짜와 무관하게 뜬다');

  /* 독촉 — 마감 전이어도 반려는 바로 */
  {
    S.vend.length = 0;
    S.vend.push({ name: 'LUU', tel: '964770123456', lang: 'en' });
    S.work.push({ id: 'rj55', date: '2020-01-01', loc: bl, key: 'T-02', qty: 99,
                  st: 'rej', rejWhy: 'too high', by: 'LUU' });
    const D = (h, m) => { const d = new Date(A.today() + 'T00:00:00'); d.setHours(h, m, 0, 0); return d; };
    const early = A.dueList(A.flt(), D(7, 30)).co;
    ok(early.length === 1 && early[0].rej === 1,
       '★마감 전이어도 반려는 바로 독촉 대상이다');
    ok(early[0].miss.indexOf('rej') >= 0, '사유 항목에 반려가 들어간다');
    A.go(5);
    ok(bag.view.innerHTML.indexOf(A.T('du_m_rej')) > 0, '독촉 화면에 반려가 뜬다');
    S.work = S.work.filter(x => x.id !== 'rj55');
    S.vend.length = 0;
  }
  A.go(1);
}

/* ── 56 v2.19.0 — 요약 띠 보강 · 오늘 기준 · 설계외 자재 · 검측 조회 ── */
console.log('\n[56] 요약 띠 보강 · 설계외 자재 · 검측 날짜조회');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  const csrc = fs.readFileSync(path.join(ROOT, 'assets/js/core.js'), 'utf8');
  const bl = { s: 'civil', p: 3, c: 1 };
  A.setRole('admin'); S.lang = 'ko'; A.setFlt(bl);

  /* 56-1. 요약 띠에 손봐야 할 것 */
  S.work.push({ id: 't56a', date: A.today(), loc: bl, key: 'T-02', qty: 5, st: 'sub', by: 'LUU' });
  S.insp.push({ id: 't56b', date: A.today(), loc: bl, key: 'T-02', st: 'apply', qty: 3, seq: 1, hist: [] });
  S.work.push({ id: 't56c', date: '2026-08-01', loc: bl, key: 'T-02', qty: 9, st: 'rej', rejWhy: 'x', by: 'LUU' });
  A.go(1);
  {
    const h = bag.view.innerHTML;
    ok(/class="sb__td"/.test(h), '★요약 띠에 손봐야 할 것이 나온다');
    ok(/data-sbgo="1"/.test(h), '확인 대기를 누르면 작업현황으로');
    ok(/data-sbgo="2"/.test(h), '검측을 누르면 검측 탭으로');
    ok(h.indexOf(A.T('sb_todo')) > 0, '제목이 붙는다');
  }
  ok(/function sbTodo/.test(tsrc), 'sbTodo가 있다');
  ok(/T\('sb_clear'\)/.test(tsrc), '★다 처리했으면 「없음」이라고 알린다');

  /* 56-2. 검측·측량·자재는 오늘 기준 + 날짜 조회 */
  ok(/insp: 'today', surv: 'today', mat: 'today'/.test(tsrc), '★기본이 오늘');
  A.go(2);
  ok(/data-rg="insp"/.test(bag.view.innerHTML), '★검측에 기간 단추가 있다');
  ok(/A\.dateFlt\.from \|\| A\.dateFlt\.to/.test(csrc),
     '★기간을 넓히면 끝난 건도 나온다 — 단추가 실제로 듣는다');

  /* 56-3. 설계 외 자재 수동 입력 */
  A.go(4);
  ok(/id="mtAddT"/.test(bag.view.innerHTML), '★설계 외 자재 추가 칸이 있다');
  ok(/data-rg="mat"/.test(bag.view.innerHTML), '자재에도 기간 단추');
  {
    const before = S.mreq.length;
    const m = A.addExtraMat({ loc: bl, mat: '방수시트', spec: 'T=2mm', unit: 'm2', qty: 40 });
    ok(m.extra === 1 && m.st === 'iss', '★설계 외 표시가 붙고 지급으로 들어간다');
    ok(A.matExtraCount(A.flt()) >= 1, '설계 외 건수를 센다');
    const hit = A.matRows(A.flt()).filter(r => r.mat === '방수시트')[0];
    ok(!!hit && hit.iss === 40, '자재 목록에 뜬다');
    ok(!hit.design, '★설계수량은 없다 — 설계 대비 차이로 오해하면 안 된다');
    S.mreq = S.mreq.slice(0, before);
  }

  S.work = S.work.filter(x => !/^t56/.test(x.id));
  S.insp = S.insp.filter(x => !/^t56/.test(x.id));
  A.go(1);
}

function bagLabelHas(m) {
  A.setRole('staff'); A.go(4);
  return bag.view.innerHTML.indexOf(A.T('fm_iss_v')) > 0;
}
/* ── 57 자재 신청 처리 (v2.19.1 → v2.20.1 결재 흐름으로 뒤집음) ── */
console.log('\n[57] 자재 — 결재 흐름 (신청→검토→확인→지급→최종입력)');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  const bl = { s: 'civil', p: 1, c: 1 };
  S.lang = 'ko'; A.setFlt(bl);
  const before = S.mreq.length;

  const m = A.addMreq({ date: A.today(), loc: bl, grp: '부지토목', sub: '도로포장(아스팔트)',
                        mat: '표층', spec: '#78, T=40MM', unit: 'm2', qty: 600, by: 'LUU' });

  /* ★흐름을 건너뛰던 옛 단추는 없어야 한다.
     종전 검사는 이 단추들을 **통과 조건으로 못 박고** 있었다 —
     그 상태가 곧 「스탭 검토도 관리자 확인도 건너뛰고 곧바로 지급」이다. */
  ok(!/data-mtiss=/.test(tsrc), '★[지급] 직행 단추가 없다');
  ok(!/data-mtno=/.test(tsrc), '★[미지급] 직행 단추가 없다');

  /* 57-1. 신청은 스탭 차례다 */
  A.setRole('staff'); A.go(4);
  ok(A.fst('mat', m) === 'req', '신청은 스탭 검토 대기');
  ok(A.flowOwn('mat', m) === 'staff', '★내 차례는 스탭');
  ok(/data-fgo="mat\|/.test(bag.view.innerHTML), '스탭 화면에 결재 단추가 있다');

  /* 57-2. 관리자에게는 아직 아무 단추도 없다 — 남의 차례다 */
  A.setRole('admin'); A.go(4);
  ok(!A.flowMine('mat', m), '★관리자 차례가 아니다');
  ok(!/data-fgo="mat\|/.test(bag.view.innerHTML), '★남의 단계 단추는 안 그린다');

  /* 57-3. 스탭 검토 → 관리자 확인 → 지급 → 최종입력 */
  A.flowGo('mat', m, 'ok', { by: 'staff' });
  ok(A.fst('mat', m) === 'chk', '스탭 검토 → 관리자 확인 대기');
  ok(A.flowOwn('mat', m) === 'admin', '★이제 관리자 차례');
  A.setRole('admin'); A.go(4);
  ok(/data-fgo="mat\|/.test(bag.view.innerHTML), '관리자 화면에 단추가 있다');

  A.flowGo('mat', m, 'ok', { by: 'admin' });
  ok(A.fst('mat', m) === 'ord', '관리자 확인 → 지급 대기');
  A.flowGo('mat', m, 'ok', { by: 'staff', qty: 500 });
  ok(A.fst('mat', m) === 'iss' && m.iss === 500,
     '★신청보다 적게 지급할 수 있다 (600 신청 → 500 지급)');
  ok(m.qty === 600, '신청 수량은 그대로 남는다 — 차이를 알아야 한다');
  /* ★지급 뒤는 **양쪽이 확인해야** 끝난다 (v2.20.1 사용자 지시).
     한쪽만 눌러서는 종료되지 않는다 — 그래야 나중에 「받은 적 없다」가 안 나온다. */
  A.flowGo('mat', m, 'ok', { by: 'staff', as: 'staff', qty: 500 });
  ok(A.fst('mat', m) === 'iss' && !A.flowEnd('mat', m),
     '★스탭만 확인해서는 끝나지 않는다');
  ok(A.flowMineVendor('mat', m), '★업체 수령확인이 남아 있다');
  ok(!A.flowMine('mat', m, 'staff'), '★스탭은 이미 눌렀으므로 내 차례가 아니다');
  ok(A.flowWarn(A.flt()).recv >= 1, '★「수령확인 안 됨」으로 센다');
  ok(A.T('fm_iss_v') && bagLabelHas(m), '★화면에 「업체 수령확인 대기」로 적힌다');
  A.flowGo('mat', m, 'ok', { by: 'LUU', as: 'vendor' });
  ok(A.fst('mat', m) === 'fin' && A.flowEnd('mat', m),
     '★양쪽이 확인하면 최종 종료');
  ok(A.flowWarn(A.flt()).recv === 0, '끝난 것은 수령확인 경고에서 빠진다');
  {
    const row = A.matRows(A.flt()).filter(x => x.mat === '표층')[0];
    ok(!!row && row.iss === 500, '★자재 표의 「지급」 칸에 최종 수량이 실린다');
    ok(!!row && row.req === 600, '★「신청」 칸은 그대로 600 — 차이를 알아야 한다');
  }
  ok(!A.flowMine('mat', m, 'staff') && !A.flowMine('mat', m, 'admin'),
     '★끝난 것은 아무의 차례도 아니다');

  /* 57-4. 반려는 한 칸만 뒤로 간다 — 어디로 갈지 고르지 않는다 */
  const m2 = A.addMreq({ date: A.today(), loc: bl, grp: '부지토목', sub: '도로포장(아스팔트)',
                         mat: '기층', spec: 'T=20cm', unit: 'm2', qty: 100, by: 'LUU' });
  A.flowGo('mat', m2, 'no', { by: 'staff', why: '규격이 다르다' });
  ok(A.fst('mat', m2) === 'back' && A.flowOwn('mat', m2) === 'vendor',
     '★스탭 반려 → 업체 재검토 (한 칸만 뒤로)');
  ok(m2.fwhy === '규격이 다르다', '★사유가 남는다 — 누구 잘못인지 알아야 한다');
  A.flowGo('mat', m2, 'ok', { by: 'LUU' });        // 업체가 다시 올린다
  A.flowGo('mat', m2, 'ok', { by: 'staff' });      // 스탭 검토
  A.flowGo('mat', m2, 'no', { by: 'admin', why: '수량 과다' });
  ok(A.fst('mat', m2) === 'rej' && A.flowOwn('mat', m2) === 'staff',
     '★관리자 반려 → 스탭 재검토 (업체까지 안 간다)');
  ok(A.matRows(A.flt()).some(r => r.mat === '기층'),
     '★반려여도 목록에서 사라지지 않는다');

  /* 57-5. 화면·문자 독촉 */
  m2.fat = new Date(Date.now() - 125 * 60000).toISOString();
  ok(A.flowLate('mat', m2) === 2, '★125분 멈춰 있으면 2차 독촉');
  m2.fat = new Date(Date.now() - 70 * 60000).toISOString();
  ok(A.flowLate('mat', m2) === 1, '★70분이면 1차 독촉');
  m2.fat = new Date().toISOString();
  ok(A.flowLate('mat', m2) === 0, '방금 넘긴 것은 독촉하지 않는다');
  m2.fat = new Date(Date.now() - 125 * 60000).toISOString();
  ok(A.flowDue(A.flt()).some(x => x.own === 'staff' && x.stage === 2),
     '★문자 독촉 대상에 오른다');
  ok(A.flowLate('mat', m) === 0, '★끝난 건은 독촉하지 않는다');
  A.setRole('staff'); A.go(4);
  ok(/fl_late2|1차|2차|Overdue|তাগিদ/.test(bag.view.innerHTML) ||
     bag.view.innerHTML.indexOf(A.T('fl_late2')) > 0, '★화면에서도 독촉이 보인다');

  /* 57-6. 옛 기록도 그대로 읽는다 */
  ok(A.fst('mat', { st: 'iss' }) === 'fin', '★옛 지급건은 끝난 것으로 읽는다');
  ok(A.fst('mat', { st: 'req' }) === 'req', '★옛 신청건은 검토 대기로 읽는다');

  S.mreq = S.mreq.slice(0, before);
  A.setRole('admin'); A.go(1);
}

/* ── 77 측량 결재 흐름 · 측량팀 (v2.20.0 사용자 지시) ────── */
console.log('\n[77] 측량 — 신청→확인→측량지시→측량팀→최종완료 · 측량팀 로그인');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  const csrc = fs.readFileSync(path.join(ROOT, 'assets/js/core.js'), 'utf8');
  const vsrc = fs.readFileSync(path.join(ROOT, 'assets/js/vendor.js'), 'utf8');
  const gsrc = fs.readFileSync(path.join(ROOT, 'Code.gs'), 'utf8');
  const bl = { s: 'civil', p: 3, c: 1 };
  S.lang = 'ko'; A.setFlt(bl);
  const before = S.surv.length;
  const key = Object.keys(A.REG || {})[0] || (A.LIST && A.LIST[0] && A.LIST[0].key) || '';

  function mk() {
    const r = { id: 't77-' + S.surv.length, date: A.today(), loc: bl, key: key,
                spot: null, why: '중심선 확인', by: 'LUU', done: false,
                at: new Date().toISOString(), up: 0 };
    S.surv.push(r); return r;
  }

  /* 77-1. 측량팀은 별도 역할이다 — 스탭 권한을 물려받지 않는다 */
  ok(typeof A.isSurv === 'function' && typeof A.isIn === 'function', '측량팀 역할이 있다');
  A.setRole('surv');
  ok(A.isSurv() && A.isIn(), '★측량팀도 로그인한 것으로 본다');
  ok(!A.isStaff(), '★측량팀은 스탭이 아니다');
  ok(!A.can('stock') && !A.can('prod') && !A.can('notice') && !A.can('recon'),
     '★관리 기능은 하나도 못 쓴다 — 스탭보다 좁다');
  ok(/PW_SURVEY/.test(gsrc) && /role: 'surv'/.test(gsrc), '★서버가 측량팀 비밀번호를 검사한다');
  ok(!/PW_SURVEY['\"]?\s*[:=]\s*['\"][^'\"]+/.test(gsrc.replace(/getProperty\('PW_SURVEY'\)/g, '')),
     '★비밀번호가 소스에 적혀 있지 않다');
  ok(/A\.isSurv\(\) \? \[3\]/.test(tsrc), '★측량팀에게는 측량 탭 하나만');

  /* 77-2. 단계마다 차례가 넘어간다 */
  const r1 = mk();
  ok(A.fst('surv', r1) === 'req' && A.flowOwn('surv', r1) === 'staff', '신청은 스탭 확인 대기');
  A.setRole('surv'); A.go(3);
  ok(!A.flowMine('surv', r1), '★측량팀 차례가 아니다');
  ok(!/data-fgo="surv\|/.test(bag.view.innerHTML), '★남의 단계 단추는 안 그린다');

  A.flowGo('surv', r1, 'ok', { by: 'staff' });
  ok(A.fst('surv', r1) === 'chk' && A.flowOwn('surv', r1) === 'admin',
     '★스탭이 「측량 필요」로 보면 관리자에게 올라간다');
  A.flowGo('surv', r1, 'ok', { by: 'admin' });
  ok(A.fst('surv', r1) === 'ord' && A.flowOwn('surv', r1) === 'surv',
     '★관리자 측량지시 → 측량팀 차례');

  A.setRole('surv'); A.go(3);
  ok(A.flowMine('surv', r1), '★이제 측량팀 차례');
  ok(/data-fgo="surv\|/.test(bag.view.innerHTML), '측량팀 화면에 단추가 있다');
  ok(bag.view.innerHTML.indexOf(A.T('b_sdone')) > 0 &&
     bag.view.innerHTML.indexOf(A.T('b_sfail')) > 0, '★[측량 완료]와 [미완료] 둘뿐이다');

  A.flowGo('surv', r1, 'ok', { by: 'surv' });
  ok(A.fst('surv', r1) === 'sdone' && A.flowOwn('surv', r1) === 'staff',
     '★측량팀 완료 → 스탭 확인 차례');
  A.flowGo('surv', r1, 'ok', { by: 'staff' });
  ok(A.fst('surv', r1) === 'fin' && A.flowEnd('surv', r1) && r1.done === true,
     '★스탭 최종완료로 끝난다');

  /* 77-3. 측량팀이 못 했을 때 — 사유가 남고 스탭이 조치한다 */
  const r2 = mk();
  A.flowGo('surv', r2, 'ok', { by: 'staff' });
  A.flowGo('surv', r2, 'ok', { by: 'admin' });
  A.flowGo('surv', r2, 'no', { by: 'surv', why: '장비 고장' });
  ok(A.fst('surv', r2) === 'sfail' && r2.fwhy === '장비 고장',
     '★완료 못한 사유가 남는다');
  ok(A.flowOwn('surv', r2) === 'staff', '★스탭이 확인·조치할 차례');
  ok(r2.done === false, '★미완료는 끝난 것이 아니다');
  A.flowGo('surv', r2, 'no', { by: 'staff', why: '자재 반입 대기' });
  ok(A.fst('surv', r2) === 'delay' && !A.flowEnd('surv', r2),
     '★지연도 끝난 것이 아니다 — 스탭 목록에 남는다');
  A.flowGo('surv', r2, 'ok', { by: 'staff' });
  ok(A.fst('surv', r2) === 'fin', '조치 뒤 최종완료');

  /* 77-4. ★스탭 선에서 끝나는 길 — 관리자까지 안 올린다 */
  const r3 = mk();
  A.flowGo('surv', r3, 'alt', { by: 'staff', why: '기존 측량으로 갈음' });
  ok(A.fst('surv', r3) === 'none' && A.flowEnd('surv', r3),
     '★「측량 불필요」는 스탭 선에서 종결된다');
  ok(!A.flowMineList(A.flt(), 'admin').some(x => x.row.id === r3.id),
     '★관리자 목록에 안 뜬다 — 정말 필요한 것만 본다');

  /* 77-5. 반려는 한 칸만 뒤로 */
  const r4 = mk();
  A.flowGo('surv', r4, 'no', { by: 'staff', why: '위치가 틀렸다' });
  ok(A.fst('surv', r4) === 'back' && A.flowOwn('surv', r4) === 'vendor',
     '★스탭 반려 → 업체 재검토');
  A.flowGo('surv', r4, 'ok', { by: 'LUU' });
  A.flowGo('surv', r4, 'ok', { by: 'staff' });
  A.flowGo('surv', r4, 'no', { by: 'admin', why: '측량 대상 아님' });
  ok(A.fst('surv', r4) === 'rej' && A.flowOwn('surv', r4) === 'staff',
     '★관리자 반려 → 스탭 재검토 (업체까지 안 간다)');

  /* 77-6. 독촉 — 화면과 문자 */
  const r5 = mk();
  A.flowGo('surv', r5, 'ok', { by: 'staff' });          // 관리자 차례
  r5.fat = new Date(Date.now() - 130 * 60000).toISOString();
  ok(A.flowLate('surv', r5) === 2, '★130분 멈춰 있으면 2차 독촉');
  ok(A.flowDue(A.flt()).some(x => x.own === 'admin' && x.surv > 0),
     '★문자 독촉 대상이 「관리자」로 잡힌다');
  ok(A.flowLate('surv', r3) === 0, '★종결된 것은 독촉하지 않는다');
  ok(A.flowLate('surv', r4) === 0 || A.flowOwn('surv', r4) !== 'vendor',
     '★업체 차례는 여기서 안 센다 — dueList가 이미 맡고 있다');
  A.setRole('admin'); A.go(3);
  ok(bag.view.innerHTML.indexOf(A.T('fl_late2')) > 0, '★화면에서도 독촉이 보인다');
  ok(bag.view.innerHTML.indexOf(A.T('fl_mine')) > 0, '★「내 차례」 카드가 있다');

  /* 77-7. 옛 기록을 버리지 않는다 */
  ok(A.fst('surv', { done: true }) === 'fin', '★옛 완료 기록은 끝난 것으로 읽는다');
  ok(A.fst('surv', { done: false }) === 'req', '★옛 미완료 기록은 확인 대기로 읽는다');

  /* 77-8. 서버·수신 — 단계가 넘어가야 다른 PC에서도 같은 상태다 */
  ok(/b\.fst = A\.fst\(type, row\)/.test(tsrc), '★결재 단계를 서버로 보낸다');
  ok(/r\.type === 'mat'/.test(tsrc), '★자재 신청 수신 갈래가 있다 (종전에는 없었다)');
  ok(tsrc.indexOf("r.type === 'mat'") < tsrc.indexOf('if (!r.key) return null;'),
     '★자재 갈래가 key 검사보다 위에 있다 — 밑에 두면 전부 걸러진다');
  ok(/frank/.test(tsrc), '★서버의 옛 단계가 내 처리를 되돌리지 못한다');

  /* 77-9. 협력업체 화면 */
  ok(/FSTV/.test(vsrc), '★업체 화면에도 지금 단계가 보인다');
  ok(/data-vre=/.test(vsrc), '★돌아온 줄은 업체가 스스로 되올린다');
  ok(/f === 'back'/.test(vsrc), '★돌아온 줄은 날짜와 무관하게 뜬다');

  /* 77-10. 엔진은 한 벌이다 */
  ok(/A\.FLOW = \{[\s\S]*mat:[\s\S]*surv:/.test(csrc), '★자재와 측량이 같은 엔진을 쓴다');
  ['mat', 'surv'].forEach(k => {
    Object.keys(A.FLOW[k]).forEach(st => {
      const d = A.FLOW[k][st];
      if (d.end) return;
      ['ok', 'no', 'alt'].forEach(dir => {
        if (d[dir]) ok(!!A.FLOW[k][d[dir]], `★${k}.${st}.${dir} → ${d[dir]} 가 실재하는 단계다`);
      });
    });
  });

  S.surv = S.surv.slice(0, before);
  A.setRole('admin'); A.go(1);
}

/* ── 78 양쪽 확인 · 현황판 결재 경고 (v2.20.1 사용자 지시) ──── */
console.log('\n[78] 지급 후 양쪽 확인 · 현황판 경고');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  const vsrc = fs.readFileSync(path.join(ROOT, 'assets/js/vendor.js'), 'utf8');
  const bl = { s: 'civil', p: 2, c: 1 };
  S.lang = 'ko'; A.setFlt(bl);
  const before = S.mreq.length;

  function upto(qty) {                       // 지급까지 밀어 올린다
    const r = A.addMreq({ date: A.today(), loc: bl, grp: '부지토목', sub: '관로공',
                          mat: '우수관', spec: 'D=600mm', unit: 'm', qty: qty, by: 'KEW' });
    A.flowGo('mat', r, 'ok', { as: 'staff' });
    A.flowGo('mat', r, 'ok', { as: 'admin' });
    A.flowGo('mat', r, 'ok', { as: 'staff', qty: qty });
    return r;
  }

  /* 78-1. 순서가 반대여도 똑같이 동작한다 */
  {
    const r = upto(100);
    A.flowGo('mat', r, 'ok', { as: 'vendor', by: 'KEW' });
    ok(A.fst('mat', r) === 'iss' && !A.flowEnd('mat', r), '★업체만 확인해서는 끝나지 않는다');
    ok(A.flowMine('mat', r, 'staff'), '★스탭 확인이 남아 있다');
    ok(!A.flowMineVendor('mat', r), '★업체는 이미 눌렀다');
    A.flowGo('mat', r, 'ok', { as: 'staff' });
    ok(A.fst('mat', r) === 'fin', '★업체 먼저여도 양쪽이면 종료');
  }

  /* 78-2. 라벨이 「누가 남았는지」를 말한다 */
  {
    const r = upto(50);
    A.setRole('staff'); A.go(4);
    ok(bag.view.innerHTML.indexOf(A.T('fm_iss_b')) > 0, '★둘 다 안 눌렀으면 「양쪽 확인 대기」');
    A.flowGo('mat', r, 'ok', { as: 'staff' });
    A.go(4);
    ok(bag.view.innerHTML.indexOf(A.T('fm_iss_v')) > 0, '★스탭이 눌렀으면 「업체 수령확인 대기」');
    A.flowGo('mat', r, 'ok', { as: 'vendor' });
  }

  /* 78-3. ★확인 안 하면 경고한다 */
  {
    const r = upto(70);
    r.fat = new Date(Date.now() - 130 * 60000).toISOString();
    ok(A.flowLate('mat', r) === 2, '★지급 후 확인이 없으면 독촉 대상이다');
    const due = A.flowDue(A.flt());
    ok(due.some(x => x.own === 'staff'), '★스탭이 독촉 대상에 오른다');
    ok(due.some(x => x.own === 'vendor' && x.name === 'KEW'),
       '★업체는 **이름**으로 잡힌다 — 그래야 보낼 곳이 있다');
    ok(/x\.own === 'vendor' \? \(x\.name/.test(tsrc), '★문안도 업체 이름 앞으로 간다');
    ok(/wa\.me/.test(tsrc.slice(tsrc.indexOf('fd.forEach'), tsrc.indexOf('fd.forEach') + 900)),
       '★업체에는 왓츠앱 링크가 붙는다');
    A.flowGo('mat', r, 'ok', { as: 'staff' });
    A.flowGo('mat', r, 'ok', { as: 'vendor' });
  }

  /* 78-4. ★현황판만 봐도 승인이 안 되고 있는 것이 보인다 */
  {
    const r = upto(90);
    const a = A.flowWarn(A.flt());
    ok(a.wait >= 1 && a.recv >= 1, '★현황판 집계에 잡힌다');
    ok((a.byOwn.staff || 0) >= 1 && (a.byOwn.vendor || 0) >= 1,
       '★스탭·업체 양쪽이 대기로 잡힌다');
    A.setRole('admin'); A.go(1);
    const h = bag.view.innerHTML;
    ok(h.indexOf(A.T('sb_appr')) > 0, '★현황판에 「결재 대기」 칸이 뜬다');
    ok(/data-sbgo="4"/.test(h), '★누르면 자재 탭으로 간다');
    ok(h.indexOf(A.T('fl_recv')) > 0, '★「수령확인 안 됨」이 보인다');

    r.fat = new Date(Date.now() - 130 * 60000).toISOString();
    A.go(1);
    ok(A.flowWarn(A.flt()).late >= 1 && /class="bad"/.test(bag.view.innerHTML),
       '★멈춘 것이 있으면 빨강으로 붙는다');

    A.flowGo('mat', r, 'ok', { as: 'staff' });
    A.flowGo('mat', r, 'ok', { as: 'vendor' });
    A.go(1);
    ok(A.flowWarn(A.flt()).wait === 0, '다 처리하면 0');
    ok(bag.view.innerHTML.indexOf(A.T('sb_appr')) < 0,
       '★0이면 칸 자체를 만들지 않는다 — 늘 0이 떠 있으면 눈이 건너뛴다');
  }

  /* 78-5. 뒤로 가면 확인 표시가 지워진다 */
  {
    const r = upto(30);
    A.flowGo('mat', r, 'ok', { as: 'staff' });
    ok(r.okS === 1, '스탭 확인이 켜졌다');
    A.flowGo('mat', r, 'no', { as: 'admin', why: '되돌림' });   // iss엔 no가 없다
    ok(A.fst('mat', r) === 'iss', 'iss에는 반려 길이 없다 — 그대로다');
    /* 앞 단계로 되돌리는 길을 직접 태워 확인한다 */
    r.fst = 'chk'; A.flowGo('mat', r, 'no', { as: 'admin', why: '수량 정정' });
    ok(A.fst('mat', r) === 'rej' && !r.okS && !r.okV,
       '★뒤로 가면 양쪽 확인 표시가 지워진다 — 안 지우면 한쪽만 눌러도 종료된다');
  }

  /* 78-6. 서버·수신 */
  ok(/b\.okS = row\.okS/.test(tsrc), '★확인 표시를 서버로 보낸다');
  ok(/okS: r\.okS \? 1 : 0/.test(tsrc), '★수신에서도 복원한다');
  ok(/local\.okS && !r\.okS/.test(tsrc),
     '★같은 단계면 켜진 쪽이 이긴다 — 서로의 확인이 상대를 지우면 영영 안 끝난다');

  /* 78-7. 협력업체 화면 */
  ok(/flowMineVendor/.test(vsrc), '★업체 화면이 수령확인 차례를 안다');
  ok(/as: 'vendor'/.test(vsrc), '★업체가 눌렀다는 것을 역할로 실어 보낸다');
  ok(/Received/.test(vsrc), '★[수령확인] 단추가 있다');
  ok(/!recv && !\(x\.date === d/.test(vsrc),
     '★수령확인 줄은 날짜와 무관하게 뜬다 — 어제 받은 것을 오늘 누른다');

  S.mreq = S.mreq.slice(0, before);
  A.setRole('admin'); A.go(1);
}

/* ── 79 명부 — 업체 먼저, 담당자는 그 다음 (v2.21.0 사용자 지시) ── */
console.log('\n[79] 명부 2단계 · 담당자별 전화 · 수정/삭제 · 초기화');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  const keep = S.vend.slice();
  S.vend = []; S.lang = 'ko';

  /* 79-1. 1단계 — 업체만 만든다 */
  ok(A.vendCreate('', 'X').ok === false, '코드 없이는 안 만들어진다');
  ok(A.vendCreate('AAA', '').ok === false, '이름 없이도 안 된다');
  const c1 = A.vendCreate('AAA', 'Alpha Co');
  ok(c1.ok && c1.v.staff.length === 0, '★업체만 만들어진다 — 담당자는 안 받는다');
  ok(!!c1.v.key, '링크 열쇠가 함께 생긴다');

  /* 79-2. ★같은 코드면 회사가 갈라지지 않는다 */
  const c2 = A.vendCreate('AAA', 'Alpha Company');
  ok(S.vend.length === 1 && c2.dup === true, '★같은 코드는 새로 안 만든다');
  ok(S.vend[0].name === 'Alpha Company', '이름만 고쳐진다');
  ok(S.vend[0].key === c1.v.key, '★링크는 그대로 — 업체가 쓰던 주소가 안 죽는다');

  /* 79-3. 2단계 — 만들어진 업체에 담당자를 붙인다 */
  ok(A.vendStaffAdd('AAA', '', '').ok === false, '이름 없이는 안 들어간다');
  ok(A.vendStaffAdd('ZZZ', '', 'Ali').why === 'novend', '★없는 업체에는 못 붙인다');
  A.vendStaffAdd('AAA', '토공', 'Ahmed', '964770000001');
  A.vendStaffAdd('AAA', '포장공', 'Kareem', '964770000002');
  A.vendStaffAdd('AAA', '', 'Ali', '');
  ok(S.vend[0].staff.length === 3, '담당자 셋이 붙었다');
  ok(S.vend.length === 1, '★담당자를 넣어도 회사는 하나 그대로다');

  /* 79-4. ★전화번호가 담당자마다 따로다 */
  const st = A.vendStaffList(S.vend[0]);
  ok(st[0].grp === '토공' && st[0].name === 'Ahmed' && st[0].tel === '964770000001',
     '★공종·이름·전화가 따로 읽힌다');
  ok(st[2].grp === '' && st[2].name === 'Ali' && st[2].tel === '',
     '공종 없는 담당자도 그대로');
  ok(A.vendTel(S.vend[0], '포장공') === '964770000002', '★공종 담당자 번호를 고른다');
  ok(A.vendTel(S.vend[0], '', 'Ahmed') === '964770000001', '★이름으로도 고른다');
  ok(A.vendTel(S.vend[0], '없는공종') !== '', '★못 찾으면 다른 번호라도 준다 — 빈손으로 안 돌려보낸다');

  /* 79-5. ★옛 자료를 그대로 읽는다 (마이그레이션 없음) */
  {
    const old = { staff: ['Ahmed', '토공|Kareem', '포장공|Ali|964770000009'] };
    const q = A.vendStaffList(old);
    ok(q[0].name === 'Ahmed' && q[0].grp === '' && q[0].tel === '', '★옛 「이름만」 형식');
    ok(q[1].grp === '토공' && q[1].name === 'Kareem' && q[1].tel === '', '★옛 「공종|이름」 형식');
    ok(q[2].tel === '964770000009', '새 「공종|이름|전화」 형식');
  }
  ok(A.vendStaffMake('', 'Ali', '9647700') === '|Ali|9647700',
     '★공종이 없어도 전화가 있으면 칸을 비워 자리를 지킨다 — 안 그러면 이름이 공종 자리로 밀린다');

  /* 79-6. 수정 — 같은 사람이 둘이 되지 않는다 */
  A.vendStaffAdd('AAA', '토공', 'Ahmed', '964770009999');
  ok(S.vend[0].staff.length === 3, '★같은 공종·같은 이름이면 덧붙이지 않고 고친다');
  ok(A.vendTel(S.vend[0], '토공') === '964770009999', '전화만 바뀐다');
  A.vendStaffSet('AAA', A.vendStaffList(S.vend[0])[0].raw, '관로공', 'Ahmad', '964770001111');
  const st2 = A.vendStaffList(S.vend[0]);
  ok(st2[0].grp === '관로공' && st2[0].name === 'Ahmad' && st2[0].tel === '964770001111',
     '★공종·이름까지 통째로 고칠 수 있다');
  ok(S.vend[0].staff.length === 3, '고쳐도 수가 안 는다');

  /* 79-7. 삭제 */
  A.vendStaffDel('AAA', A.vendStaffList(S.vend[0])[2].raw);
  ok(S.vend[0].staff.length === 2, '담당자 하나만 지워진다');
  ok(S.vend.length === 1, '업체는 남는다');

  /* 79-8. ★초기화 */
  A.vendCreate('BBB', 'Beta Co');
  ok(S.vend.length === 2, '업체 둘');
  const n = A.vendReset();
  ok(n === 2 && S.vend.length === 0, '★명부를 통째로 비운다');

  /* 79-9. 화면 — 두 단계로 나뉘어 있다 */
  A.vendCreate('CCC', 'Gamma Co');
  A.vendStaffAdd('CCC', '', 'Sami', '');
  ok(/id="vdMk"/.test(tsrc), '★1단계 [업체 만들기] 단추가 따로 있다');
  ok(/id="vdCo"/.test(tsrc), '★2단계는 업체를 **고른다** — 이름을 다시 안 적는다');
  ok(!/A\.vendAdd\(val\('#vdCode'\)/.test(tsrc),
     '★한 폼에서 업체·담당자를 함께 받던 옛 길이 없다');
  ok(/data-vsed=/.test(tsrc), '★담당자 [수정] 단추가 있다');
  ok(/id="vdReset"/.test(tsrc), '★[명부 초기화] 단추가 있다');
  ok(/confirm\(T\('vd_reset_ask'\)\)/.test(tsrc), '★초기화는 확인을 받는다');
  ok(/confirm\(T\('vd_sdel_ask'\)\)/.test(tsrc), '★담당자 삭제도 확인을 받는다');
  ok(/confirm\(T\('vd_del_ask'\)\)/.test(tsrc), '★업체 삭제도 확인을 받는다');
  ok(/T\('vd_first'\)/.test(tsrc), '★업체가 없으면 담당자 폼 대신 안내를 낸다');
  ok(/vd_notel/.test(tsrc), '★번호 없는 담당자는 눈에 띄게 둔다 — 독촉이 못 간다');

  /* 79-10. 독촉이 담당자 번호로 간다 */
  {
    const csrc = fs.readFileSync(path.join(ROOT, 'assets/js/core.js'), 'utf8');
    ok(/tel = A\.vendTel\(v, r\.grp/.test(csrc),
       '★결재 독촉이 대표번호가 아니라 담당자 번호로 간다');
    ok(/tel: A\.vendTel\(v\)/.test(csrc), '★미입력 독촉도 마찬가지');
  }

  S.vend = keep; A.save();
  A.setRole('admin'); A.go(1);
}

/* ── 58 공종 수동 추가 · 공종별 담당자 (v2.19.2 사용자 지시) ── */
console.log('\n[58] 공종 직접 추가 · 공종별 담당자');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  const vsrc = fs.readFileSync(path.join(ROOT, 'assets/js/vendor.js'), 'utf8');
  const bl = { s: 'civil', p: 3, c: 1 };
  A.setRole('admin'); S.lang = 'ko'; A.setFlt(bl);

  /* 58-1. 빠진 공종을 손으로 넣는다 */
  const lk = A.locKey(bl);
  S.plan[lk] = S.plan[lk] || {}; S.plan[lk]['T-02'] = 500;
  A._setup('plan'); A.go(1);
  ok(/id="plAddT"/.test(bag.view.innerHTML), '★공종 직접 추가 칸이 있다');
  ok(/data-pld=/.test(bag.view.innerHTML), '지우는 단추도 있다');
  ok(/id="plClrAll"/.test(bag.view.innerHTML), '한 번에 지우기도 있다');
  ok(/S\.plan\[lk\]\[k\] = q;/.test(tsrc), '★있는 코드는 덮어쓴다 — 중복 줄을 안 만든다');
  ok(/items = A\.itemsOf\(site\)\.filter/.test(tsrc), '★이미 올린 공종은 고를 목록에서 뺀다');
  A._setup('');

  /* 58-2. 공종별 담당자 */
  {
    const vn = S.vend.length;
    S.vend.length = 0;
    A.vendAdd('LUU', 'LUU', '토공|Ahmed', '964770000000');
    A.vendAdd('LUU', 'LUU', '포장공|Kareem', '');
    A.vendAdd('LUU', 'LUU', 'Ali', '');
    ok(S.vend[0].staff.length === 3, '담당자 3명이 담긴다');
    ok(A.staffFor('LUU', '토공').pick === 'Ahmed', '★토공을 고르면 Ahmed');
    ok(A.staffFor('LUU', '포장공').pick === 'Kareem', '★포장공을 고르면 Kareem');
    ok(A.staffFor('LUU', '우수공').pick === 'Ali',
       '★맡은 사람이 없으면 공종 없는 기본 담당자');
    ok(A.staffFor('LUU', '토공').all.length === 3,
       '★틀리면 고를 수 있게 전원 목록도 준다');
    ok(A.vendStaffList({ staff: ['Ali'] })[0].grp === '',
       '★옛 자료(이름만)도 그대로 읽힌다 — 마이그레이션 불필요');
    S.vend.length = 0;
    ok(vn >= 0, '명부 정리');
  }
  ok(/function byFld/.test(vsrc), '협력업체 화면에 담당자 칸이 있다');
  ok(/if \(!info\.all\.length\)/.test(vsrc),
     '★명부에 담당자가 없으면 종전처럼 자유 입력 — 안 채운 현장이 막히지 않는다');
  ok(/if \(f === 'grp' \|\| f === 'key'\)/.test(vsrc), '★공종을 바꾸면 담당자를 다시 잡는다');

  A.go(1);
}

/* ── 59 증분 수신 (v2.19.3 사용자 지시) ────────────────── */
console.log('\n[59] 증분 수신 — 바뀐 것만');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  const API = sb.BNCP_API;

  /* 가짜 서버로 실제 동작을 재현한다 */
  const server = [
    { id: 'x1', type: 'work', rx: '2026-08-19T01:00:00.000Z' },
    { id: 'x2', type: 'work', rx: '2026-08-19T02:00:00.000Z' }
  ];
  let asked = [];
  /* ★검사판에는 fetch가 없어 live()가 막힌다. changed의 판단 부분만
     그대로 재현해 본다 — 실제 코드와 같은 규칙인지는 아래에서 원본을 본다. */
  API.meta = function () {
    const last = server.reduce((m, r) => r.rx > m ? r.rx : m, '');
    return Promise.resolve({ ok: true, last: last, count: server.length });
  };
  API.rows = function (type, since) {
    asked.push(since || '');
    const out = server.filter(r => !since || r.rx > since);
    const last = server.reduce((m, r) => r.rx > m ? r.rx : m, '');
    if (last) API.last = last;
    return Promise.resolve(out);
  };
  API.changed = function () {
    return API.meta().then(function (m) {
      if (!m) return null;
      if (API.last && m.last && m.last === API.last) return [];
      return API.rows('', API.last || '');
    });
  };

  return API.changed().then(function (a) {
    ok(a && a.length === 2, `처음에는 전부 받는다 (${a && a.length})`);
    ok(API.last === '2026-08-19T02:00:00.000Z', '서버가 알려준 시각을 기억한다');

    return API.changed().then(function (b) {
      ok(b && b.length === 0, '★바뀐 게 없으면 빈 배열 — 조회를 안 한다');
      ok(asked.length === 1, '★두 번째는 본문 요청 자체를 안 보낸다');

      server.push({ id: 'x3', type: 'work', rx: '2026-08-19T03:00:00.000Z' });
      return API.changed().then(function (c) {
        ok(c && c.length === 1 && c[0].id === 'x3',
           '★새로 들어온 것만 받는다 (전체가 아니다)');
        ok(asked[1] === '2026-08-19T02:00:00.000Z', 'since로 직전 시각을 보낸다');

        ok(/function syncNow\(quiet, force\)/.test(tsrc), '전체 다시 받기 통로가 있다');
        ok(/if \(force\) \{ api\.last = ''; S\.rxLast = ''; \}/.test(tsrc),
           '★전체 받기는 기준점을 지운다');
        ok(/if \(!api\.last && S\.rxLast\) api\.last = S\.rxLast;/.test(tsrc),
           '★새로 고쳐도 이어 받는다 — 기준점을 저장소에 남긴다');
        ok(/id="syncAll"/.test(tsrc), '[전체 다시 받기] 단추가 있다');

        /* ★위는 재현판이다. 원본이 같은 규칙인지 글자로 대조한다 —
           재현판만 맞고 원본이 다르면 검사가 거짓으로 통과한다. */
        {
          const asrc = fs.readFileSync(path.join(ROOT, 'assets/js/api.js'), 'utf8');
          const body = asrc.slice(asrc.indexOf('API.changed = function'),
                                  asrc.indexOf('/* ── 로그인'));
          ok(/if \(!m\) return null;/.test(body), '원본 — 통신 실패는 null');
          ok(/if \(API\.last && m\.last && m\.last === API\.last\) return \[\];/.test(body),
             '원본 — 바뀐 게 없으면 빈 배열');
          ok(/return API\.rows\('', API\.last \|\| ''\);/.test(body),
             '원본 — 있을 때만 since로 받는다');
        }

        /* ── 60 내역서 확인필요가 화면에 뜬다 (v2.19.4) ────────
           ★사고 : P3-2.csv를 올렸는데 33개만 들어가고 67개가 어디에도
             안 보였다. 인식 실패가 아니라 **화면에 그릴지 정하는 조건**이
             틀린 것이었다 — boqHere가 pkLoc('w')(안 따라가는 옛 변수)와
             대조했다. 저장은 정상인데 영영 안 뜬다.
           ★그래서 여기서는 「함수가 있다」가 아니라 **실제 파일을 읽어
             실제로 그려 보고 글자가 나오는지**를 본다. */
          /* 새 판을 하나 더 띄운다 — boqNeed·boqLoc은 tabs.js가 읽힐 때
           S.boq에서 한 번 정해지는 모듈 변수라, 이미 떠 있는 판에
           S.boq를 넣어 봐야 반영되지 않는다(새로 고침과 같은 상황). */
        function boot(seed) {
          const bag2 = {};
          function El2(id) {
            return { id, innerHTML: '', textContent: '', value: '', src: '', style: {}, dataset: {},
              options: [{ text: '' }], files: [], setAttribute() {}, getAttribute() { return null; },
              addEventListener() {}, appendChild() {}, remove() {}, select() {},
              closest() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; } };
          }
          ['logo','appt','hmeta','tabs','view','fltBox','wipe','vendorBtn'].forEach(i => bag2[i] = El2(i));
          const st = {};
          if (seed) st['bncp.dash.v2'] = JSON.stringify(seed);
          const s2 = {
            console: { log() {}, warn() {}, error() {} },
            localStorage: { getItem: k => (k in st ? st[k] : null),
                            setItem: (k, v) => { st[k] = String(v); },
                            removeItem: k => { delete st[k]; } },
            navigator: {}, location: { reload() {} }, alert() {}, confirm: () => false,
            prompt: () => 'test', Blob: function () {},
            URL: { createObjectURL: () => '', revokeObjectURL() {} },
            setTimeout: () => 0, XLSX: null, scrollTo() {}, TextDecoder,
  setInterval: (fn) => { sb.__ivFn = fn; return 7; }, clearInterval: (id) => { if (id === 7) sb.__ivFn = null; },
            document: { documentElement: {}, addEventListener() {}, createElement: () => El2('t'),
              body: { appendChild() {} },
              querySelector(s) { const m = /^#([A-Za-z0-9_-]+)$/.exec(s); return m && bag2[m[1]] ? bag2[m[1]] : null; },
              querySelectorAll() { return []; } }
          };
          s2.window = s2; vm.createContext(s2);
          ['version','i18n','data','master','materials','materials2','work_i18n','prod','equip',
           'core','spot','api','matmaster_api','wx','tabs']
            .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js', f + '.js'), 'utf8'), s2, { filename: f }));
          return { A: s2.APP, view: bag2.view };
        }

        /* 브라우저 decodeCsv와 같은 규칙 — utf-8이 깨지면 euc-kr */
        function readSample(A2, name) {
          const u8 = new Uint8Array(fs.readFileSync(path.join(ROOT, 'sample', name)));
          let txt;
          try { txt = new TextDecoder('utf-8', { fatal: true }).decode(u8); }
          catch (e) { txt = new TextDecoder('euc-kr').decode(u8); }
          return A2.parseCSV(txt);
        }

        console.log('\n[60] 내역서 확인필요 — 화면에 실제로 뜬다');
        {
          /* 60-1 실제 파일 두 개로 숫자가 재현되는가 */
          const P = boot(null).A;
          const r31 = readSample(P, 'P3-1.csv'), r32 = readSample(P, 'P3-2.csv');
          ok(P.locFromName('P3-1.csv').ok && P.locFromName('P3-1.csv').loc.c === 1, 'P3-1.csv → Phase 3-1');
          ok(P.locFromName('P3-2.csv').ok && P.locFromName('P3-2.csv').loc.c === 2, 'P3-2.csv → Phase 3-2');
          ok(P.isBoq(r31) && P.isBoq(r32), '둘 다 내역서로 판별된다');
          const b31 = P.readBoqRows(r31, { s:'civil', p:3, c:1 });
          const b32 = P.readBoqRows(r32, { s:'civil', p:3, c:2 });
          ok(b31.ok === 104 && b31.need.length === 5, `P3-1 104/109 · 확인필요 5 (실제 ${b31.ok}/${b31.total} · ${b31.need.length})`);
          ok(b32.ok === 85 && b32.need.length === 15, `P3-2 85/100 · 확인필요 15 (실제 ${b32.ok}/${b32.total} · ${b32.need.length})`);

          /* 60-2 ★핵심 — 화면 위치가 어긋나도 67개가 뜨는가.
             새 판의 pk('w')는 flt 초기값을 따라 Phase 1-1이 된다.
             올린 파일은 Phase 3-2다 — 사고가 났던 그 조합 그대로. */
          /* ★v:2가 없으면 load()가 통째로 버린다 — 빈 판이 떠서 검사가
             「카드가 없다」로 거짓 실패한다. 실제 저장 모양과 같아야 한다. */
          const B = boot({ v: 2, boq: { need: b32.need, loc: { s:'civil', p:3, c:2 } } });
          B.A.setRole('admin');
          B.A.go(1);
          const h = B.view.innerHTML;
          ok(/내역서 — 확인 필요/.test(h), '★파일명(3-2)과 화면(1-1)이 어긋나도 카드가 뜬다');
          ok(h.indexOf('Phase 3-2') >= 0, '★어느 위치에 들어갈 것인지 카드에 적혀 있다');
          ok((h.match(/data-bq="/g) || []).length === 15, `★확인필요 15줄이 전부 그려진다 (실제 ${(h.match(/data-bq="/g) || []).length})`);
          ok(/규준틀/.test(h), '못 붙인 줄의 내용이 그대로 보인다(부대공 › 규준틀)');
          const dO2 = (h.match(/<div\b/g)||[]).length, dC2 = (h.match(/<\/div>/g)||[]).length;
          ok(dO2 === dC2, `카드를 넣어도 div가 맞는다 (${dO2}/${dC2})`);

          /* 60-3 확인필요가 없으면 카드도 없다 — 항상 뜨는 것이 아니다 */
          const E = boot({ v: 2 });
          E.A.setRole('admin'); E.A.go(1);
          ok(!/내역서 — 확인 필요/.test(E.view.innerHTML), '확인필요가 없으면 카드도 안 뜬다');
        }

        /* ── 61 내역서 자동매칭 규칙 (v2.19.5) ──────────────── */
        console.log('\n[61] 자동매칭 — 대분류 해제 · near 제외 · 느슨한 별칭');
        {
          const M = boot({ v: 2 }).A;
          const r31 = readSample(M, 'P3-1.csv'), r32 = readSample(M, 'P3-2.csv');
          const L31 = { s:'civil', p:3, c:1 }, L32 = { s:'civil', p:3, c:2 };

          /* 61-1 대분류를 풀면 붙는 수가 는다. P3-1은 그대로여야 한다 */
          const a31 = M.readBoqRows(r31, L31), a32 = M.readBoqRows(r32, L32);
          ok(a31.ok === 104, `P3-1은 종전 그대로 104 (실제 ${a31.ok})`);
          ok(a32.ok === 85, `★P3-2 33 → 85 (실제 ${a32.ok})`);
          ok(a32.need.filter(it => !it.cands.length).length <= 2,
             `★후보 없는 줄이 62 → 2 이하 (실제 ${a32.need.filter(it => !it.cands.length).length})`);

          /* 61-2 ★near가 엉뚱한 것을 집지 않는다.
             대분류를 풀면 후보가 마스터 전체로 넓어져 「표지판설치」가
             「기초설치」에 붙었다. 기초설치 수량이 두 배가 된다. */
          const sign = M.boqItems(r32).filter(it => it.n === '표지판설치');
          ok(sign.length === 3, `표지판설치가 3줄 있다 (실제 ${sign.length})`);
          /* ★readBoqRows로 봐야 한다. 겹침을 물리는 것은 파일 전체를 봐야
             알 수 있어서 boqMatch(한 줄만 본다)에서는 판단할 수 없다. */
          const r2 = M.readBoqRows(r32, L32);
          ok(r2.need.filter(it => it.n === '표지판설치').length === 3,
             '★표지판설치 3줄이 확인필요로 남는다 — 기초설치를 뺏지 않는다');
          ok(r2.need.filter(it => it.n === '표지판설치').every(it => it.cands.length),
             '물린 줄에도 후보가 달려 있다');
          const pl = M.S.plan[M.locKey(L32)];
          ok(pl['P-13'] === 107 && pl['P-16'] === 140 && pl['P-19'] === 22,
             `★기초설치 수량이 두 배가 되지 않는다 (${pl['P-13']}/${pl['P-16']}/${pl['P-19']})`);

          /* 61-3 ★한 번 고르면 다른 페이즈에도 붙는다 (사용자 지시).
             P3-2는 「부대공 › 아스콘 포장 › 표층」,
             P3-1은 「포장공 › 아스콘 포장 › 표층」 — 대분류만 다르다. */
          const top = a32.need.filter(it => it.n === '표층')[0];
          ok(!!top, '고를 대상이 확인필요에 있다(표층 #78)');
          M.applyBoqPick(top, 'P-30', L32);
          const top31 = M.boqItems(r31).filter(it => it.n === '표층' && it.g === '포장공')[0];
          const m31 = M.boqMatch(top31, 'civil');
          ok(m31.code === 'P-30' && /^alias/.test(m31.how),
             `★P3-2에서 고른 것이 P3-1에도 붙는다 (${m31.code}/${m31.how})`);
          ok(M.readBoqRows(r31, L31).ok === 105, '다시 읽으면 104 → 105');

          /* 61-4 ★느슨한 별칭이 갈리면 안 쓴다.
             「토공 › 터파기 · m3」는 우수공·오수공·상수공에 똑같이 있다.
             대분류를 뺀 열쇠로는 이 셋이 한 칸에 겹친다. */
          const digWS = { g:'우수공', m:'토공', n:'터파기', sp:'', u:'m3' };
          const digSS = { g:'오수공', m:'토공', n:'터파기', sp:'', u:'m3' };
          ok(M.aliasKey2(digWS) === M.aliasKey2(digSS), '대분류를 빼면 열쇠가 겹친다');
          M.setAlias(digWS, 'WS-01');
          ok(M.S.alias2[M.aliasKey2(digWS)] === 'WS-01', '처음 고른 것은 기억한다');
          M.setAlias(digSS, 'SS-01');
          ok(M.S.alias2[M.aliasKey2(digWS)] === '*',
             '★서로 다른 것에 붙는 순간 느슨한 별칭을 막는다');
          ok(M.boqMatch(digWS, 'civil').code === 'WS-01',
             '★우수공 터파기는 여전히 WS-01 — 오수공 것이 밀고 들어오지 않는다');
          ok(M.boqMatch(digSS, 'civil').code === 'SS-01', '오수공 터파기도 제자리');

          /* 61-5 ★구조가 별칭보다 먼저다.
             느슨한 별칭을 맨 앞에서 보면 구조로 정확히 붙는 줄까지 덮어쓴다. */
          const src = fs.readFileSync(path.join(ROOT, 'assets/js/core.js'), 'utf8');
          const body = src.slice(src.indexOf('A.boqMatch = function'), src.indexOf('A.readBoqRows = function'));
          ok(body.indexOf("S.alias2 || {}") > body.indexOf("how: 'bag-'"),
             '★느슨한 별칭은 구조적 일치가 전부 실패한 뒤에 본다');
          ok(/if \(gKnown && sc\.length/.test(body),
             '★대분류를 못 찾았으면 near를 쓰지 않는다');
        }

        /* ── 62 대분류 판정 (v2.19.6) ─────────────────────────
           ★뿌리는 파서였다. 대분류를 「번호가 튀면 올린다」로 정하는 바람에
             토공의 부대공(6번, 앞이 4번이라 5를 건너뛴다)이 대분류로 올라갔고,
             gn=6이 되어 뒤따르는 포장공·우수공·오수공·상수공이 전부 아래로
             밀렸다. 그래서 100줄 중 67줄이 g='부대공'이 됐다. */
        console.log('\n[62] 대분류 — 번호와 이름이 목차와 둘 다 맞아야 한다');
        {
          const G = boot({ v: 2 }).A;
          const items = G.boqItems(readSample(G, 'P3-2.csv'));
          const gs = []; const seen = {};
          items.forEach(it => { if (!seen[it.g]) { seen[it.g] = 1; gs.push(it.g); } });
          ok(gs.indexOf('부대공') < 0, '★부대공이 대분류로 올라가지 않는다');
          ['토공', '포장공', '우수공', '오수공', '상수공'].forEach(function (g) {
            ok(gs.indexOf(g) >= 0, `대분류 ${g}을 놓치지 않는다`);
          });
          /* ★부대공은 공종마다 하나씩 있다 — 토공의 부대공, 오수의 부대공 …
             블럭공사(부대토목)와는 다른 것이다. */
          const bd = items.filter(it => /부대공/.test(it.m));
          ok(bd.length >= 5, `공종별 부대공이 여러 공종에 걸쳐 있다 (${bd.length}줄)`);
          ok(bd.filter(it => it.g === '토공' && it.n === '규준틀').length === 1,
             '★규준틀은 토공의 부대공이다');
          ok(bd.filter(it => it.g === '상수공' && it.n === '수압시험').length === 1,
             '★수압시험은 상수공의 부대공이다');

          /* ★부지 → 부대(블럭공사)로 새지 않는다. 후보 풀은 site로 잠겨 있다. */
          let leak = 0;
          items.forEach(it => {
            const m = G.boqMatch(it, 'civil');
            if (m.code && /^A-/.test(m.code)) leak++;
            (m.cands || []).forEach(c => { if (/^A-/.test(c)) leak++; });
          });
          ok(leak === 0, `★부지토목 내역서가 부대토목 코드에 붙지 않는다 (${leak})`);
          ok(G.locFromName('B-7.csv').loc.s === 'anc', '블럭 파일은 부대토목으로 간다');
          ok(G.locFromName('P3-2.csv').loc.s === 'civil', '페이즈 파일은 부지토목으로 간다');

          /* 62-2 같은 이름이 아래 단계에도 나온다 — 번호가 되돌아가면 대분류가 아니다.
             「1. 토공」은 대분류로도, 우수공·오수공 아래에도 나온다. */
          ok(items.filter(it => it.g === '우수공' && it.m === '토공').length > 0,
             '★우수공 아래의 토공은 대분류로 오해되지 않는다');
          /* ★오수공 아래에도 「1. 토공」이 있으나 세 줄 모두 수량이 비어 있어
             항목으로 나오지 않는다. 파싱 문제가 아니라 내역서가 그렇다.
             수량이 있는 상수공으로 본다. */
          ok(items.filter(it => it.g === '상수공' && it.m === '토공').length > 0,
             '상수공 아래의 토공도 마찬가지');
        }

        /* ── 63 옛 목록에서 빠져나가는 길 (v2.19.7) ──────────
           ★v2.19.4에서 「저장돼 있으면 무조건 보인다」로 바꾼 뒤, 예전에
             만들어진 확인필요 목록이 브라우저에 남아 계속 떠 있었다.
             매칭 규칙을 33→85로 고쳐도 화면에는 옛 67건이 그대로였다.
             저장된 옛 결과이기 때문이다. 지울 길이 없었다. */
        console.log('\n[63] 확인 필요 목록 — 지우는 길과 캐시');
        {
          const src = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
          ok(/id="bqDrop"/.test(src), '★목록 지우기 단추가 있다');
          ok(/bqDrop'\)\)\s*\$\('#bqDrop'\)\.onclick/.test(src), '단추가 연결돼 있다');
          ok(/confirm\(T\('bq_dropq'\)\)/.test(src), '★되돌릴 수 없으므로 묻는다');
          ['bq_drop', 'bq_dropq', 'bq_dropped'].forEach(function (k) {
            const i18 = fs.readFileSync(path.join(ROOT, 'assets/js/i18n.js'), 'utf8');
            ok((i18.match(new RegExp('\\b' + k + ":'", 'g')) || []).length === 3,
               `${k}이 3개 언어에 다 있다`);
          });

          /* 63-2 ★캐시 — 새 파일을 올려도 브라우저가 옛 JS를 쓰면 소용없다 */
          const ver = /'([\d.]+)'/.exec(fs.readFileSync(path.join(ROOT, 'assets/js/version.js'), 'utf8'))[1];
          ['index.html', 'vendor.html'].forEach(function (f) {
            const h = fs.readFileSync(path.join(ROOT, f), 'utf8');
            const bare = h.match(/(?:src|href)="assets\/[^"]*?"(?!\?)/g) || [];
            const noV = bare.filter(x => x.indexOf('?v=') < 0 && !/\.svg"/.test(x));
            ok(noV.length === 0, `★${f} — 버전이 안 붙은 js·css가 없다 (${noV.join(',')})`);
            ok(h.indexOf('?v=' + ver) > 0, `${f}의 버전이 version.js와 같다 (${ver})`);
          });
        }

        /* ── 64 부대 → 부지 한 방향 폴백 (v2.19.8 — 사용자 지시) ──
           「부대토목에 없는 것은 부지토목에서 갖다 쓴다.」
           ★반대는 절대 열지 않는다 — [62]가 그쪽을 지킨다. */
        console.log('\n[64] 부대토목에 없으면 부지토목에서 — 한 방향만');
        {
          const F = boot({ v: 2 }).A;
          const mk = (g, m, n, sp, u) => ({ g: g, m: m, n: n, sp: sp, u: u });

          /* 64-1 부대토목에 있으면 부대토목이 이긴다 */
          const a1 = F.boqMatch(mk('단지내 부대토목-토공', '표토제거', '표토제거', '', 'm3'), 'anc');
          ok(a1.code === 'A-T-01', `★부대토목에 있으면 부대토목 코드 (${a1.code})`);
          const a2 = F.boqMatch(mk('단지내 부대토목-우수공', '우수관로', 'Φ400mm', '모래기초360˚', 'm'), 'anc');
          ok(a2.code === 'A-WS-06', `관로도 부대토목에서 (${a2.code})`);

          /* 64-2 ★부대토목에 없으면 부지토목에서 갖다 쓴다 */
          const b1 = F.boqMatch(mk('단지내 부대토목-토공', '부대공', '규준틀', '', 'ea'), 'anc');
          ok(b1.code === 'T-08' && /@civil$/.test(b1.how),
             `★규준틀은 부지토목에서 (${b1.code}/${b1.how})`);
          const b2 = F.boqMatch(mk('단지내 부대토목-오수공', '부대공', '관로표식테이프', '흑갈색, 10cm', 'm'), 'anc');
          ok(b2.code === 'SS-36' && /@civil$/.test(b2.how),
             `★관로표식테이프도 부지토목에서 (${b2.code}/${b2.how})`);

          /* 64-3 ★순서 — 부대토목을 다 찾아본 뒤에만 부지토목을 본다.
             바뀌면 부대토목에 제 짝이 있는 줄까지 부지토목이 가로챈다. */
          const c = F.boqMatch(mk('단지내 부대토목-상수공', '부대공', '수압시험', '', 'ea'), 'anc');
          ok(!c.code, '중분류가 어긋나면 확인필요로 남는다');
          ok(c.cands[0] === 'A-WW-12',
             `★후보도 부대토목이 먼저다 (${c.cands.slice(0, 3).join(',')})`);
          ok(c.cands.some(x => !/^A-/.test(x)), '부지토목 후보도 뒤에 달려 있다');

          /* 64-4 ★반대는 막혀 있다 */
          let leak = 0;
          [mk('토공', '부대공', '규준틀', '', 'ea'),
           mk('우수공', '토공', '터파기', '', 'm3'),
           mk('포장공', '기층/보조기층', '기층', '', 'm3')].forEach(function (x) {
            const m = F.boqMatch(x, 'civil');
            if (/^A-/.test(m.code || '')) leak++;
            (m.cands || []).forEach(y => { if (/^A-/.test(y)) leak++; });
          });
          ok(leak === 0, `★부지토목은 부대토목 코드를 절대 안 본다 (${leak})`);

          /* 64-5 손으로 고를 때도 부지토목이 보인다 */
          const tsrc2 = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
          ok(/site === 'anc' \? A\.itemsOf\('civil', ''\) : \[\]/.test(tsrc2),
             '★부대토목 화면에서만 부지토목 목록을 덧붙인다');
          const i18b = fs.readFileSync(path.join(ROOT, 'assets/js/i18n.js'), 'utf8');
          ok((i18b.match(/\bbq_allc:'/g) || []).length === 3, 'bq_allc이 3개 언어에 다 있다');
        }

        /* ── 65 요약 띠가 공구 표 머리행을 덮지 않는다 (v2.19.9 · 0-D 가) ── */
        console.log('\n[65] 요약 띠 — 고정하지 않는다 (표 머리행 가림 해소)');
        {
          const css = fs.readFileSync(path.join(ROOT, 'assets/css/app.css'), 'utf8');
          const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');

          /* 65-1 ★겹침을 만드는 세 조각이 모두 없다.
             하나라도 남으면 증상이 그대로 돌아온다 — 셋이 한 벌이다. */
          /* ★v2.19.15 — 고정을 되살렸다(사용자 지시). 0-D가 「되살리려면
             겹침부터 풀 것」이라 적어 둔 그 겹침을 푸는 것이 [71]이다. */
          /* ★v2.19.21 — 고정은 기둥(.pg__side)이 한다. .sb는 안 한다. */
          ok(!/\.sb\{position:sticky/.test(css) && /\.pg__side\{[^}]*position:sticky/.test(css),
             '★기둥이 고정하고 .sb는 고정하지 않는다');
          ok(!/scr-dn/.test(css), '★scr-dn 규칙이 CSS에 없다');
          ok(!/scr-dn/.test(tsrc.replace(/\/\*[\s\S]*?\*\//g, '')),
             '★scr-dn을 붙이는 코드가 없다');
          ok(!/--tabh/.test(css), '★쓰지 않게 된 --tabh를 남기지 않았다');

          /* 65-2 표 쪽은 종전 그대로다 — 덮인 것이 문제였지 없던 것이 아니다.
             .tw의 자체 스크롤(520px)과 상자 안 sticky 머리행은 손대지 않는다. */
          /* ★v2.19.17 — 자체 스크롤을 없앴다. 띠를 고정한 채로 머리행이
             안 묻히려면 머리행이 **페이지 기준**으로 붙어야 한다(0-D의 「나」). */
          ok(/\.tw\{overflow:visible\}/.test(css), '★.tw의 자체 스크롤을 없앴다');
          ok(/\.tw th\{\s*position:sticky;top:0/.test(css),
             '★머리행이 화면 맨 위에 붙는다 (위에 아무것도 없다)');

          /* 65-3 ★실제로 그려서 확인 — 공구 표 카드와 머리 8칸이 다 나온다.
             (가림은 화면에서만 보이는 것이라 여기서는 「있다」까지만 지킨다.
              눈으로 보는 확인은 사용자 몫 — 인수인계서 2-C) */
          const K = boot({ v: 2, crew: [{
            id: 'k1', date: A.today(), loc: { s: 'civil', p: 1, c: 1 }, key: 'T-02',
            by: 'LUU', st: 'ok', teams: 1, ppl: { eng: 1, fmn: 1, wkr: 8 },
            eq: [{ cat: 'Dump Truck', size: '15Ton', run: 3, brk: 0, rep: 0 }]
          }] });
          K.A.setRole('admin'); K.A.go(1);
          const hk = K.view.innerHTML;
          const th = (hk.match(/<th[ >]/g) || []).length;
          ok(/sb__in/.test(hk) && /<thead>/.test(hk), '요약 띠와 표 머리행이 같이 그려진다');
          ok(th >= 8, `공구 표 머리 8칸이 있다 (실제 th ${th}개)`);
        }

        /* ── 66 요약 띠의 장비 = 오늘 (v2.19.9 · 사용자 지시) ── */
        console.log('\n[66] 요약 띠 장비 — 인원·장비현황 카드와 같은 「오늘」');
        {
          const L = { s: 'civil', p: 1, c: 1 };
          function crew(id, date, run) {
            return { id: id, date: date, loc: L, key: 'T-02', by: 'LUU', st: 'ok',
                     teams: 1, ppl: { eng: 0, fmn: 1, wkr: 5 },
                     eq: [{ cat: 'Dump Truck', size: '15Ton', run: run, brk: 0, rep: 0 }] };
          }
          /* 오늘 3대, 옛날 30대 — 누계로 세면 33이 뜬다 */
          const D = boot({ v: 2, crew: [crew('c1', A.today(), 3), crew('c2', '2020-01-01', 30)] });
          D.A.setRole('admin'); D.A.go(1);
          const h = D.view.innerHTML;
          const band = (h.split('sb__d')[1] || '').split('</span>')[0];
          const m = /<i class="ok"><\/i>([\d,]+)/.exec(band);
          const runShown = m ? Number(m[1].replace(/,/g, '')) : -1;
          ok(runShown === 3, `★띠의 가동은 오늘 3대다 (실제 ${runShown} · 누계면 33)`);

          /* 66-2 아래 장비현황 카드와 숫자가 같아야 한다 — 어긋난 것이 사고였다 */
          const card = h.split('data-eqo=')[1] || '';
          ok(/class="r em">3</.test(card), '★장비현황 카드도 같은 3대다');

          /* 66-3 ★오늘 입력이 없으면 띠도 조용해야 한다.
             종전에는 카드가 「대조할 게 없습니다」인데 띠에만 숫자가 남았다. */
          const Z = boot({ v: 2, crew: [crew('c3', '2020-01-01', 30)] });
          Z.A.setRole('admin'); Z.A.go(1);
          const hz = Z.view.innerHTML;
          const mz = /<i class="ok"><\/i>([\d,]+)/.exec((hz.split('sb__d')[1] || '').split('</span>')[0]);
          ok(!mz || Number(mz[1].replace(/,/g, '')) === 0,
             `★오늘 것이 없으면 띠도 0이다 (실제 ${mz ? mz[1] : '없음'})`);
          ok(/대조할 게 없습니다/.test(hz), '카드는 종전대로 「대조할 게 없습니다」');

          /* 66-4 인원은 종전 그대로 오늘이다 — 같이 흔들리지 않았는지 본다.
             ★인원 = 3직군 6명 + 장비기사 3명(A.crewTotal은 가동대수를 기사로 센다) = 9.
             옛 자료 30대짜리는 오늘이 아니므로 기사도 안 붙는다. */
          const mp = /sb__v"><b>(\d+)<\/b>/.exec(h);
          ok(mp && mp[1] === '9', `★띠의 인원도 오늘 9명 그대로 (실제 ${mp ? mp[1] : '없음'})`);
        }

        /* ── 67 확인필요 카드 자리 · 공구 표 열 너비 (v2.19.10 사용자 지시) ── */
        console.log('\n[67] 내역서 확인필요는 요약 띠 아래 · 공구 표 열 너비');
        {
          const L = { s: 'civil', p: 3, c: 2 };
          const P = boot({ v: 2 }).A;
          const u8 = new Uint8Array(fs.readFileSync(path.join(ROOT, 'sample', 'P3-2.csv')));
          let txt;
          try { txt = new TextDecoder('utf-8', { fatal: true }).decode(u8); }
          catch (e) { txt = new TextDecoder('euc-kr').decode(u8); }
          const bq = P.readBoqRows(P.parseCSV(txt), L);

          const O = boot({ v: 2, boq: { need: bq.need, loc: L }, crew: [{
            id: 'o1', date: A.today(), loc: { s: 'civil', p: 1, c: 1 }, key: 'T-02',
            by: 'LUU', st: 'ok', teams: 1, ppl: { eng: 1, fmn: 1, wkr: 8 },
            eq: [{ cat: 'Dump Truck', size: '15Ton', run: 3, brk: 0, rep: 0 }]
          }] });
          O.A.setRole('admin'); O.A.go(1);
          const h = O.view.innerHTML;
          /* ★자리는 카드 제목으로 잡는다. tw--site(열 너비용 클래스)로 잡으면
             그 클래스만 빠져도 -1이 되어 「뒤에 있다」가 거짓으로 통과한다(3-B). */
          const iSb = h.indexOf('sb__in'), iSite = h.indexOf(O.A.T('sb_t')),
                iBq = h.indexOf('내역서 — 확인 필요'), iPpl = h.indexOf(O.A.T('ro_ppl'));
          ok(iSb > 0 && iSite > 0 && iBq > 0 && iPpl > 0, '넷 다 화면에 있다');

          /* 67-1 ★네 자리가 이 순서여야 한다.
             확인필요가 위에 있으면 50건짜리 카드가 화면을 채워 오늘 숫자가 묻힌다. */
          ok(iSb > 0 && iSite > 0 && iSite < iSb,
             '★현장 현황은 본문, 현황판은 오른쪽 기둥 (v2.19.21)');
          ok(iBq > iSite, `★현장 현황 → 내역서 확인필요 (${iSite}/${iBq})`);
          ok(iPpl > iBq, '내역서 확인필요 → 인원');
          ok((h.match(/data-bq="/g) || []).length === bq.need.length,
             `확인필요 ${bq.need.length}줄이 자리를 옮겨도 그대로 그려진다`);
          const dO = (h.match(/<div\b/g) || []).length, dC = (h.match(/<\/div>/g) || []).length;
          ok(dO === dC, `자리를 옮겨도 div가 맞는다 (${dO}/${dC})`);

          /* 67-2 열 너비는 이 표에만 건다 — 진행률·자재 표는 종전 그대로 */
          const css2 = fs.readFileSync(path.join(ROOT, 'assets/css/app.css'), 'utf8');
          ok(/\.tw--site th,\.tw--site td\{width:1%;white-space:nowrap\}/.test(css2),
             '★공구 표 칸은 내용만큼만 쓴다');
          ok(/\.tw--site th:nth-child\(5\),\.tw--site td:nth-child\(5\)\{width:auto\}/.test(css2),
             '★남는 폭은 작업위치(5번째 칸)가 받는다');
          ok(/<div class="tw tw--site">/.test(h), '공구 표에만 tw--site가 붙는다');
          ok((h.match(/tw--site/g) || []).length === 1, '다른 표에는 안 붙는다');
        }

        /* ── 68 직영현황 — 관리자 작업현황 쪽에도 기간이 붙는다 (v2.19.11) ── */
        console.log('\n[68] 직영현황 — 관리자 작업현황에서도 오늘 · 기간 조회');
        {
          /* ★관리자는 탭7이 없고 작업현황 안에서 본다(4-A). 스탭 탭7은
             smoke_direct [D9]가 지킨다. 같은 v7()이지만 두 화면 다 확인한다. */
          const G = boot({ v: 2, direct: [
            { id: 'g-now', date: A.today(), loc: { s: 'civil', p: 1, c: 1 },
              task: '오늘직영', teams: 1, ppl: { eng: 0, fmn: 0, wkr: 4 }, eq: [] },
            { id: 'g-old', date: '2026-07-29', loc: { s: 'civil', p: 1, c: 1 },
              task: '옛날직영', teams: 1, ppl: { eng: 0, fmn: 0, wkr: 4 }, eq: [] }
          ] });
          G.A.setRole('admin'); G.A.go(1);
          const h = G.view.innerHTML;
          ok(/data-rg="dir"/.test(h), '★기간 단추가 작업현황의 직영 카드에도 있다');
          ok(h.includes('오늘직영') && !h.includes('옛날직영'),
             '★기본이 오늘이라 옛 기록은 안 뜬다');
          ok(h.includes('직영작업현황'), '★이름이 「직영작업현황」이다');
          ok(!h.includes('직영 작업 기록'), '옛 이름이 남아 있지 않다');
        }

        /* ── 69 장비 파일 — 형식을 가리지 않는다 (v2.19.12 사용자 지시) ── */
        console.log('\n[69] 지급장비 — 4열이든 가로 표든 읽는다');
        {
          const W = boot({ v: 2 }).A;
          const L = { s: 'civil', p: 1, c: 1 };
          const u8 = new Uint8Array(fs.readFileSync(path.join(ROOT, 'sample', '장비현황-1.csv')));
          let txt;
          try { txt = new TextDecoder('utf-8', { fatal: true }).decode(u8); }
          catch (e) { txt = new TextDecoder('euc-kr').decode(u8); }
          const rows = W.parseCSV(txt);

          /* 69-1 ★실제 현장 파일로 실제로 읽어 본다(글자 대조가 아니다).
             종전에는 이 파일이 한 줄도 안 읽혔다 — 4열 판독기는 장비 열을
             못 찾아 전부 건너뛴다. */
          ok(W.readIssueRows(rows, L).ok === 0, '★4열 판독기로는 0줄이다 (종전 상태)');
          ok(typeof W.readEquipFile === 'function', '★형식을 가리지 않는 입구가 있다');
          W.S.issue = [];
          const r = W.readEquipFile(rows, L, W.today());
          ok(r.wide === true, '가로 표로 알아본다');
          ok(r.ok >= 25, `★장비 ${r.ok}종을 읽었다 (25종 이상)`);
          ok(r.miss.length === 0, `못 알아본 열 머리 0 (실제 ${r.miss.length})`);
          ok(W.S.issue.length === r.ok, '읽은 만큼 지급대장에 들어간다');

          /* 69-2 숫자가 제대로 갈렸는가 — ㎥의 3을 규격 숫자로 읽던 실수 */
          const by = {};
          W.S.issue.forEach(x => { by[x.cat + '|' + x.size] = x.cnt; });
          ok(by['Excavator(crawler)|1.2m3'] > 0 && by['Excavator(crawler)|2.9m3'] > 0,
             '★1.2㎥와 2.9㎥가 서로 다른 규격으로 들어간다');
          ok(by['Dozer (D3K)|7.8ton'] > 0 && by['Dozer(D6R)|18ton'] > 0,
             '★「Dozer18 Ton」처럼 글자와 숫자가 붙어 있어도 갈라 읽는다');
          ok(W.eqFindName('Excavator0.7㎥(Wheel)').cat === 'Excavator(wheel)',
             'crawler와 wheel을 가른다');
          ok(W.eqFindName('Fork Lift (16 Ton )').how === 'near',
             '★마스터에 없는 규격(16톤)은 근사로 표시한다');
          ok(W.eqFindName('Dump Truck (25 Ton )').how === 'exact', '있는 규격은 정확이다');
          ok(r.near.length > 0 && r.near.length < 10, `근사 ${r.near.length}건을 따로 알린다`);

          /* 69-3 4열 양식은 종전 그대로 — 새 길이 옛 길을 막지 않는다 */
          const T4 = boot({ v: 2 }).A;
          const tpl = T4.parseCSV('날짜,장비,규격,대수\n2026-08-21,Dump Truck,15ton,3\n');
          const r4 = T4.readEquipFile(tpl, L, T4.today());
          ok(r4.ok === 1 && r4.wide === false, '★4열 양식은 4열로 읽는다');
          ok(T4.S.issue[0].cat === 'Dump Truck' && T4.S.issue[0].cnt === 3, '값이 그대로 들어간다');

          /* ── [70] 장비 보유 = 업체 축 (v2.19.14, 인수인계서 0-I) ──────
             사용자 확정 두 가지
               ①「장비는 업체에 주는 것이지 부지·부대에 주는 게 아니다」
               ②「한번 올린 지급 대수는 내가 회수할 때까지 지급한 것이다.
                  그날그날 지급하는 게 아니다」
             ★검사를 만들고 옛 코드로 되돌려 실제로 실패하는 것을 확인했다. */
          console.log('\n[70] 장비 보유 — 업체 축 · 회수할 때까지 유효');
          {
            const E = boot({ v: 2 }).A;
            const L1 = { s: 'civil', p: 3, c: 1 }, L2 = { s: 'civil', p: 4, c: 1 };
            const wide = E.parseCSV(txt);

            /* 70-1 ★두 번 올려도 안 쌓인다 (종전 push는 두 배가 됐다) */
            E.readEquipFile(wide, L1, E.today(), '한국건설');
            const n1 = E.S.issue.length;
            const g1 = E.S.issue.reduce((a, x) => a + (Number(x.cnt) || 0), 0);
            E.readEquipFile(wide, L1, E.today(), '한국건설');
            ok(E.S.issue.length === n1, `★같은 파일을 두 번 올려도 줄이 안 는다 (${n1})`);
            ok(E.S.issue.reduce((a, x) => a + (Number(x.cnt) || 0), 0) === g1,
               '★대수도 두 배가 되지 않는다');

            /* 70-2 ★업체가 갈린다 */
            E.readEquipFile(wide, L2, E.today(), '바그다드토건');
            ok(E.S.issue.length === n1 * 2, '★업체가 다르면 자리가 갈린다');
            const cos = {};
            E.S.issue.forEach(x => { cos[x.by || ''] = 1; });
            ok(!!cos['한국건설'] && !!cos['바그다드토건'] && !cos[''],
               '★올린 업체가 by에 박힌다 (빈 업체 없음)');

            /* 70-3 ★위치를 좁혀도 보유가 안 줄어든다 — 업체 축이므로 */
            E.setFlt({ s: 'civil', p: 0, c: 0 });
            const all = E.eqRecon(E.flt()).reduce((a, r) => a + (r.gv || 0), 0);
            E.setFlt(L1);
            const one = E.eqRecon(E.flt()).reduce((a, r) => a + (r.gv || 0), 0);
            ok(all > 0 && one === all, `★Phase 하나로 좁혀도 보유 그대로 (${all})`);

            /* 70-4 ★기간을 좁혀도 안 줄어든다 — 회수할 때까지 지급한 것이다 */
            E.setFlt({ s: 'civil', p: 0, c: 0 });
            E.dateFlt.from = '2020-01-01'; E.dateFlt.to = '2020-01-02';
            const old = E.eqRecon(E.flt()).reduce((a, r) => a + (r.gv || 0), 0);
            E.dateFlt.from = ''; E.dateFlt.to = '';
            ok(old === all, '★기간을 딴 해로 돌려도 보유 그대로 (상태값)');
            const st1 = E.eqRecon(E.flt(), E.today());
            ok(st1.reduce((a, r) => a + (r.gv || 0), 0) === all,
               '★요약 띠(withDay)에서도 보유는 그대로');

            /* 70-5 ★업체 필터는 듣는다 */
            E.coFlt = '한국건설';
            const mine = E.eqRecon(E.flt()).reduce((a, r) => a + (r.gv || 0), 0);
            E.coFlt = '';
            ok(mine > 0 && mine < all, `★업체로 좁히면 그 업체 것만 (${mine}/${all})`);

            /* 70-6 ★회수만이 보유를 줄인다 */
            const c0 = E.eqRecon(E.flt()).filter(r => r.gv > 0)[0];
            E.setEqQty(L1, c0.cat, c0.size, 'take', 1, '한국건설');
            const after = E.eqRecon(E.flt()).filter(r => r.id === c0.id)[0];
            ok(after && after.tk === 1 && (after.gv - after.tk) === c0.gv - 1,
               '★회수하면 그만큼 보유가 준다');

            /* 70-7 ★가동은 종전대로 위치별이다 — 축이 섞이지 않았다 */
            E.S.crew.push({ id: 'q1', date: E.today(), loc: L1, st: 'ok', by: '한국건설',
                            ppl: {}, eq: [{ cat: c0.cat, size: c0.size, run: 2, brk: 0, rep: 0 }] });
            E.setFlt(L1);
            const rHere = E.eqRecon(E.flt()).filter(r => r.id === c0.id)[0];
            E.setFlt(L2);
            const rThere = E.eqRecon(E.flt()).filter(r => r.id === c0.id)[0];
            ok(rHere && rHere.run === 2, '★가동은 그 위치에서 보인다');
            ok(rThere && rThere.run === 0 && rThere.gv === rHere.gv,
               '★다른 위치에서는 가동 0 · 보유는 그대로');
            E.setFlt({ s: 'civil', p: 0, c: 0 });

            /* 70-8 손입력도 같은 통로 — 두 번 넣어도 안 쌓인다 */
            E.setEqQty(L1, 'Dump Truck', '25ton', 'give', 5, '한국건설');
            const m0 = E.S.issue.length;
            E.setEqQty(L1, 'Dump Truck', '25ton', 'give', 7, '한국건설');
            ok(E.S.issue.length === m0, '★손입력도 같은 자리를 고친다 (줄이 안 느다)');
            const dt = E.S.issue.filter(x => x.cat === 'Dump Truck' && x.size === '25ton' &&
                                             x.by === '한국건설' && x.kind !== 'take');
            ok(dt.length === 1 && dt[0].cnt === 7, '마지막 값만 남는다 (합계되지 않는다)');

            /* 70-9 ★업체 없이 올리는 길이 막혀 있다 */
            const tsrc3 = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
            ok(/if \(!co\) \{[\s\S]{0,120}e_pickco/.test(tsrc3),
               '★업체를 안 고르면 파일이 안 올라간다');
            ok(/coSel\('isCo'\)/.test(tsrc3) && /coSel\('eqCo'\)/.test(tsrc3),
               '★업로드·손입력 둘 다 업체 칸이 있다');
            ok(!/by: ''/.test(fs.readFileSync(path.join(ROOT, 'assets/js/core.js'), 'utf8')),
               '★by를 빈 값으로 박아 넣는 자리가 없다');
          }

          /* ── [71] 현황판·이름·여백 (v2.19.15 사용자 지시 8건) ────── */
          console.log('\n[71] 현황판 손질 — 고정 · 업체별 · 눈금 · 위치 이름');
          {
            const css2 = fs.readFileSync(path.join(ROOT, 'assets/css/app.css'), 'utf8');
            const t5 = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');

            /* 71-1 ★띠 고정 — 겹침을 푸는 짝이 같이 있어야 한다.
               0-D의 교훈 : 고정만 되살리면 증상도 그대로 돌아온다. */
            ok(!/\.sb\{position:sticky/.test(css2), '★띠가 아니라 기둥이다 (v2.19.21)');
            /* ★v2.19.21 — 기둥이 되면서 기준점 자체가 필요 없어졌다.
               `--sbh`가 v2.19.17~20을 헛돌게 만든 장본인이다 — 한 번만 재고
               날씨가 늦게 도착하면 낡은 값으로 남았다. **되살리지 않는다.** */
            ok(!/var\(--sbh/.test(css2), '★--sbh 기준점을 안 쓴다');
            ok(!/setProperty\('--sbh'/.test(t5), '★재는 코드도 남아 있지 않다');
            ok(/\.tw th\{\s*position:sticky;top:0/.test(css2), '★머리행이 화면 맨 위에 붙는다');
            ok(!/scr-dn/.test(css2), '★스크롤 방향 감시는 되살리지 않았다');

            /* 71-2 ★이름 셋 */
            ok(A.T('d_list') === '직영작업현황', '★직영현황 → 직영작업현황');
            ok(A.T('sb_todo').indexOf('미확인') >= 0, '★「손봐야 할 것」 → 「미확인 · 확인요청」');
            ok(A.T('sb_todo').indexOf('손봐야') < 0, '옛 이름이 남아 있지 않다');
            ok(A.T('sb_sec') === '작업 위치', '★「작업 공구」 → 「작업 위치」');
            {
              const I2 = sb.I18N;
              ['ko', 'en', 'bn'].forEach(l => {
                ok(!!I2[l].sb_todo && !!I2[l].sb_sec, `${l} 사전에 새 문구가 있다`);
              });
              ok(!I2.ar.sb_sec || typeof I2.ar.sb_sec === 'string',
                 '★ar은 협력업체 전용 부분 사전 — 벵골어가 섞이지 않았다');
            }

            /* 71-3 ★직영 카드에 아래 여백 — 작업량 카드와 붙어 있었다 */
            {
              const D = boot({ v: 2, direct: [{ id: 'd1', date: A.today(),
                loc: { s: 'civil', p: 1, c: 1 }, task: '정리', teams: 1,
                ppl: { eng: 0, fmn: 0, wkr: 3 }, eq: [] }] });
              D.A.setRole('admin'); D.A.go(1);
              const hh = D.view.innerHTML;
              const at = hh.indexOf(D.A.T('d_list'));
              ok(at > 0, '직영작업현황 카드가 있다');
              ok(/margin-bottom:16px">.{0,80}?직영작업현황/s.test(hh) ||
                 hh.slice(Math.max(0, at - 400), at).indexOf('margin-bottom:16px') >= 0,
                 '★직영 카드가 여백 있는 상자 안에 들어 있다');
            }

            /* 71-4 ★그래프 — 눈금 숫자 · 7일 · 오늘이 오른쪽 */
            {
              const P = boot({ v: 2 });
              const days = [];
              for (let k = 6; k >= 0; k--) {
                const dd = new Date(Date.parse(P.A.today() + 'T00:00:00Z') - k * 864e5)
                  .toISOString().slice(0, 10);
                days.push(dd);
                P.A.S.crew.push({ id: 'p' + k, date: dd, loc: { s: 'civil', p: 1, c: 1 },
                  key: 'T-02', st: 'ok', by: '가업체',
                  ppl: { eng: 0, fmn: 0, wkr: 100 + k * 30 }, eq: [] });
              }
              P.A.setRole('admin'); P.A.go(1);
              const hh = P.view.innerHTML;
              ok(/<text[^>]*font-size="11"[^>]*>\d+<\/text>/.test(hh),
                 '★세로 눈금에 숫자가 있다 (v2.19.18에서 8px→11px)');
              ok(hh.indexOf(days[0].slice(5)) > 0 && hh.indexOf(days[6].slice(5)) > 0,
                 '★7일 전부터 오늘까지 날짜가 붙는다');
              ok(/stroke="var\(--line-2\)"/.test(hh), '눈금선이 그려진다');
            }

            /* 71-5 ★작업 위치를 이름으로 — 「2 공구」로 읽히던 것 */
            {
              const Q = boot({ v: 2, crew: [
                { id: 'c1', date: A.today(), loc: { s: 'civil', p: 3, c: 1 }, key: 'T-02',
                  st: 'ok', by: '가업체', ppl: { eng: 0, fmn: 0, wkr: 5 }, eq: [] },
                { id: 'c2', date: A.today(), loc: { s: 'civil', p: 4, c: 2 }, key: 'T-02',
                  st: 'ok', by: '나업체', ppl: { eng: 0, fmn: 0, wkr: 7 }, eq: [] }
              ] });
              Q.A.setRole('admin'); Q.A.go(1);
              const hh = Q.view.innerHTML;
              ok(/sb__loc/.test(hh), '★위치 칸이 숫자 칸이 아니다');
              ok(hh.indexOf(Q.A.locLabel({ s: 'civil', p: 3, c: 1 })) > 0,
                 '★Phase·Section 이름이 그대로 나온다');

              /* 71-6 ★업체가 둘이면 업체별 + 합계 */
              ok(/sb__cos/.test(hh), '★업체별 줄이 나온다');
              ok(hh.indexOf('가업체') > 0 && hh.indexOf('나업체') > 0, '두 업체가 다 나온다');
              const tot = hh.indexOf(Q.A.T('tot_t'), hh.indexOf('sb__cos'));
              ok(tot > 0, '★합계가 같이 나온다');

              /* 한 곳뿐이면 줄을 만들지 않는다 — 위 칸과 같은 숫자다 */
              const R = boot({ v: 2, crew: [
                { id: 'r1', date: A.today(), loc: { s: 'civil', p: 3, c: 1 }, key: 'T-02',
                  st: 'ok', by: '가업체', ppl: { eng: 0, fmn: 0, wkr: 5 }, eq: [] }
              ] });
              R.A.setRole('admin'); R.A.go(1);
              ok(!/sb__cos/.test(R.view.innerHTML), '★업체가 하나면 줄을 만들지 않는다');
            }
          }

          /* ── [72] 날씨 (v2.19.16 사용자 지시) ────────────────────
             ★이 시스템에서 유일하게 밖에서 자료를 받아오는 곳이다.
               「받아와진다」보다 **「안 받아와져도 멀쩡하다」**가 중요하다 —
               현장 인터넷은 끊긴다. 검사도 그쪽에 무게를 둔다.
             ★검사판에는 fetch도 geolocation도 없다. 그 상태가 곧 「막힌 현장」이다. */
          console.log('\n[72] 날씨 — 막혀도 화면이 멀쩡하다');
          {
            const wsrc = fs.readFileSync(path.join(ROOT, 'assets/js/wx.js'), 'utf8');
            const t6 = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
            const css3 = fs.readFileSync(path.join(ROOT, 'assets/css/app.css'), 'utf8');

            /* 72-1 ★fetch도 위치정보도 없는 판에서 화면이 다 그려진다 */
            const X = boot({ v: 2, crew: [{ id: 'x1', date: A.today(),
              loc: { s: 'civil', p: 1, c: 1 }, key: 'T-02', st: 'ok', by: '가업체',
              ppl: { eng: 0, fmn: 0, wkr: 9 }, eq: [] }] });
            X.A.setRole('admin');
            let threw = '';
            try { X.A.go(1); } catch (e) { threw = String(e); }
            ok(!threw, '★fetch도 위치정보도 없어도 예외가 없다 (' + (threw || 'ok') + ')');
            const hx = X.view.innerHTML;
            ok(/id="wxBox"/.test(hx), '★날씨 자리가 띠에 있다');
            ok(hx.indexOf(X.A.T('u_pax')) > 0, '★다른 숫자는 그대로 그려진다');

            /* 72-2 ★못 받아왔을 때 문구가 나온다 — 빈칸이 아니다 */
            ok(hx.indexOf(X.A.T('wx_wait')) > 0 || hx.indexOf(X.A.T('wx_off')) > 0,
               '★못 받아오면 그 사실을 적는다');

            /* 72-3 ★자료가 오면 기온·풍속·강수·시정·7일이 다 나온다 */
            X.A.WX = { st: 'ok', fb: false, at: Date.now(), place: 'Baghdad',
              cur: { t: 41.4, ft: 44.2, hum: 12, rain: 0, code: 0, wind: 6.3, vis: 9000 },
              days: ['2026-08-21','2026-08-22','2026-08-23','2026-08-24',
                     '2026-08-25','2026-08-26','2026-08-27'].map((d, k) => ({
                d: d, code: k === 2 ? 45 : (k === 4 ? 61 : 0),
                hi: 42 - k, lo: 28 - k, rain: k === 4 ? 3.2 : 0, wind: 5 + k }))
            };
            const wh = X.A.wxHTML();
            ok(wh.indexOf('41°') > 0, '★현재 기온이 나온다');
            ok(wh.indexOf(X.A.T('wx_wind')) > 0 && wh.indexOf('6.3') > 0, '★풍속이 나온다');
            ok(wh.indexOf(X.A.T('wx_rain')) > 0, '★강수가 나온다');
            ok(wh.indexOf(X.A.T('wx_vis')) > 0 && wh.indexOf('9') > 0, '★시정이 나온다');
            ok((wh.match(/class="wx__d/g) || []).length === 7, '★7일 예보가 일곱 칸이다');
            ok(wh.indexOf(X.A.T('wx_fog')) > 0, '★안개인 날은 안개로 적는다');
            ok(!/wx_site/.test(wh) && wh.indexOf(X.A.T('wx_site')) < 0,
               'PC 위치를 받았으면 「현장 좌표」 표시가 없다');

            /* 72-4 ★시정이 나쁘면 알린다 — WMO 코드에 모래바람이 없다 */
            ok(X.A.wxLowVis(800) === true && X.A.wxLowVis(9000) === false,
               '★시정 2km 미만이면 나쁨으로 본다');
            X.A.WX.cur.vis = 700;
            ok(X.A.wxHTML().indexOf(X.A.T('wx_dust')) > 0, '★안개·모래바람을 알린다');

            /* 72-5 ★위치를 못 받으면 현장 좌표로 가고 **그 사실을 적는다** */
            X.A.WX.fb = true;
            ok(X.A.wxHTML().indexOf(X.A.T('wx_site')) > 0, '★짐작을 숨기지 않는다');

            /* 72-6 ★화면을 통째로 다시 그리지 않는다 (입력 중인 칸이 날아간다) */
            ok(!/A\.render\(\)/.test(wsrc.replace(/\/\*[\s\S]*?\*\//g, '')),
               '★wx.js가 A.render를 부르지 않는다 (설명만 남는다)');
            ok(/querySelector\('#wxBox'\)/.test(wsrc), '★칸 하나만 갈아 끼운다');

            /* 72-7 ★키·가입이 필요 없는 곳을 쓴다 — 현장에 관리거리를 안 만든다 */
            ok(/api\.open-meteo\.com/.test(wsrc), 'Open-Meteo를 쓴다');
            ok(!/api[_-]?key|apikey|token=/i.test(wsrc), '★키를 박아 넣은 자리가 없다');

            /* 72-8 ★위치를 무한정 기다리지 않는다 — 창을 무시하면 영영 「받는 중」 */
            ok(/setTimeout/.test(wsrc) && /8000/.test(wsrc), '★8초면 포기하고 현장 좌표로 간다');

            /* 72-9 ★사전 — ko/en/bn 셋만. ar은 협력업체 전용이라 안 건드린다 (3-C) */
            {
              const I3 = sb.I18N;
              ['ko', 'en', 'bn'].forEach(l => {
                ok(!!I3[l].wx_t && !!I3[l].wx_fog && !!I3[l].wx_dow,
                   `${l} 사전에 날씨 문구가 있다`);
              });
              ok(I3.ar.wx_t === undefined, '★ar에는 넣지 않았다 (부분 사전)');
              ok(String(I3.ko.wx_dow).split(',').length === 7, '요일이 일곱이다');
            }

            /* 72-10 ★날씨는 v2.42.0에서 탭바(.wxtab)로 옮겼다 (실검사는 [97]) */
            ok(/\.wxtab\{/.test(css3), '날씨 탭칸 자리가 정해져 있다');
            ok(/\.wx__fc\{/.test(css3), '7일 예보 줄이 있다');
            ok(/A\.wxHTML\(\)/.test(t6), '띠가 날씨 칸을 그린다');
          }

          /* ── [73] 띠가 아무것도 가리지 않는다 · 눌러서 찾아간다 (v2.19.17) ──
             ★사용자 캡처 : 「전부 가리고 있어」. v2.19.15에서 내가 낸 구멍이다.
               scroll-margin-top은 손 스크롤에 안 먹는데 그걸로 막았다고 적었다. */
          console.log('\n[73] 띠 가림 해소 · 띠 칸을 눌러 찾아가기');
          {
            const css4 = fs.readFileSync(path.join(ROOT, 'assets/css/app.css'), 'utf8');
            const t7 = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');

            ok(!/max-height:520px/.test(css4), '★520px 상자 스크롤이 없다');
            ok(/\.tw\{overflow:visible\}/.test(css4), '★.tw가 스크롤 상자가 아니다');
            ok(/\.tw th\{\s*position:sticky;top:0/.test(css4),
               '★머리행이 화면 맨 위에 붙는다 — 위에 덮는 것이 없다');
            ok(!/\.tw\{scroll-margin-top/.test(css4),
               '★손 스크롤에 안 먹는 scroll-margin-top으로 막아 둔 자리가 없다');
            ok(/\.pg__side\{[^}]*position:sticky/.test(css4), '★기둥이 스크롤을 따라온다');

            const Y = boot({ v: 2, crew: [{ id: 'y1', date: A.today(),
              loc: { s: 'civil', p: 3, c: 1 }, key: 'T-02', st: 'ok', by: '가업체',
              ppl: { eng: 1, fmn: 1, wkr: 8 }, eq: [] }] });
            Y.A.setRole('admin'); Y.A.go(1);
            const hy = Y.view.innerHTML;
            ['cdPpl', 'cdEq', 'cdSite'].forEach(k => {
              ok(hy.indexOf('data-sbcd="' + k + '"') > 0, `★띠에 ${k}로 가는 칸이 있다`);
              ok(hy.indexOf('id="' + k + '"') > 0, `★${k} 카드에 이름표가 달려 있다`);
            });
            ok(/\.card\{scroll-margin-top/.test(css4),
               '★찾아갈 때는 띠 높이만큼 비켜선다 (이쪽은 scrollIntoView라 먹는다)');
            ok(/scrollIntoView/.test(t7), '★탭을 옮기지 않고 그 자리로 굴린다');
            ok(/data-sbcd/.test(t7) && /onkeydown/.test(t7), '★키보드로도 눌린다');
            ok(/\.sb__k--go\{cursor:pointer/.test(css4), '★누를 수 있다는 표시가 있다');
            ok(/if \(!el \|\| !el\.scrollIntoView\) return;/.test(t7),
               '★없는 카드로 보내려 하지 않는다');
          }

          /* ── [74] 띠 균형 — 글씨 크기와 빈자리 (v2.19.18 사용자 캡처) ──
             ★「위에 글씨는 너무작고 빈공간도 많아 · 일기예보 글씨가 너무작아」
             ★크기는 화면으로만 판정된다. 여기서는 **다시 작아지지 않는 것**만
               지킨다 — 아래 하한을 못 지키면 그때 그 크기로 돌아간 것이다. */
          console.log('\n[74] 띠 균형 — 글씨가 다시 작아지지 않는다');
          {
            const css5 = fs.readFileSync(path.join(ROOT, 'assets/css/app.css'), 'utf8');
            const t8 = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
            function px(sel, prop) {
              const m = css5.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
                '\\{[^}]*?' + prop + ':(\\d+)px'));
              return m ? +m[1] : 0;
            }
            /* 라벨 — 10px에 --faint였다. 무슨 숫자인지가 안 보였다 */
            ok(px('.sb__l', 'font-size') >= 12, `★띠 라벨 12px 이상 (${px('.sb__l','font-size')})`);
            ok(!/\.sb__l\{[^}]*var\(--faint\)/.test(css5), '★라벨이 --faint가 아니다');
            /* ★v2.40.1 — 「내용 글씨가 지나치게 크다」로 27→22→18px. 균형 구간
               16~20만 지킨다. (실검사는 [97]에 있다 — 여긴 표본CSV 없으면 죽은 구역) */
            ok(px('.sb__v b', 'font-size') >= 16 && px('.sb__v b', 'font-size') <= 20,
               `★큰 숫자가 균형 구간 16~20px (${px('.sb__v b','font-size')})`);
            ok(px('.sb__loc', 'font-size') >= 16, '★작업 위치 이름이 16px 이상');
            /* 날씨 — 8~10px이었다 */
            ok(px('.wx__d em', 'font-size') >= 11, '★예보 요일 11px 이상');
            ok(px('.wx__d b', 'font-size') >= 14, '★예보 최고기온 14px 이상');
            ok(px('.wx__d u', 'font-size') >= 11, '★예보 최저기온 11px 이상');
            /* ★v2.19.20 — 예보 칸의 강수·바람 **줄**을 뺐다(띠 높이).
               자료를 뺀 것이 아니라 짚으면 나오게 옮겼다. 그것을 여기서 지킨다. */
            ok(!/\.wx__d span\{/.test(css5), '★예보 강수·바람 줄이 없다');
            ok(/T\('wx_rain'\)[\s\S]{0,200}title="/.test(t8) ||
               /var tip = [\s\S]{0,300}wx_wind/.test(t8),
               '★강수·바람은 짚으면 나온다 (자료를 버리지 않았다)');
            ok(px('.wx__now i', 'font-size') >= 12, '★현재 날씨 상세 12px 이상');
            /* 그래프 — SVG는 CSS가 아니라 코드에 박힌다 */
            ok(!/font-size="8"/.test(t8), '★그래프에 8px 글씨가 남아 있지 않다');
            ok(/font-size="11"/.test(t8), '★그래프 눈금·날짜가 11px');
            /* 가운데를 통째로 밀던 스페이서를 없앴다 */
            ok(/\.sb__sp\{display:none\}/.test(css5), '★가운데를 미는 스페이서가 없다');
            ok(/\.sb__in\{[^}]*flex-direction:column/.test(css5),
               '★칸들이 세로로 쌓인다 (v2.19.21 기둥)');
          }

          /* ── [75] 측점이 작업위치에 뜬다 (v2.19.19 사용자 확정 「가」) ──
             ★증상 : 작업위치 칸이 자료가 아무리 들어와도 항상 「—」.
             ★원인 : 측점은 **실적 폼**에서만 받는데 작업위치는 **인원·장비**를
               본다. S.crew의 spot은 일반 공종이면 null, 시설물이면 열 번호라
               kind:'road'가 될 수가 없었다.
             ★고침 : 보는 곳(인원·장비)에서 받게 한다. */
          console.log('\n[75] 측점 — 작업위치에 실제로 뜬다');
          {
            const vsrc2 = fs.readFileSync(path.join(ROOT, 'assets/js/vendor.js'), 'utf8');
            const csrc2 = fs.readFileSync(path.join(ROOT, 'assets/js/core.js'), 'utf8');

            /* 75-1 ★인원·장비 폼에 측점 칸이 붙었다 */
            /* ★v2.26.0 — roadHTML() 직접 호출이 placeHTML()로 바뀌었다.
               placeHTML은 고른 공종군에 따라 **도로 칸 또는 표기 칸** 하나를
               고른다(요청 12·13). 측점 칸이 사라진 것이 아니다.
               ★실제 동작은 smoke_vendor의 [V-TAG]가 화면을 그려서 본다 —
                 원문 검사만으로는 「그 갈래가 실제로 도는가」를 못 본다. */
            ok(/t === 'crew'\) return workHTML\(\) \+ placeHTML\(\)/.test(vsrc2),
               '★인원·장비 폼에도 위치 칸이 있다');
            ok(/t === 'work'\) return workHTML\(\) \+ placeHTML\(\)/.test(vsrc2),
               '실적 폼도 같은 자리다');
            ok(/needTag\(V\.s, V\.grp\) \? tagHTML\(\) : roadHTML\(\)/.test(vsrc2),
               '★표기 공종이면 표기 칸, 아니면 종전대로 도로·측점 칸');

            /* 75-2 ★행은 하나 · 측점은 여럿 — 쪼개면 인원이 중복 계상된다 */
            ok(/spots: sps\.length \? sps : null/.test(vsrc2),
               '★한 행에 측점을 여럿 담는다');
            ok(!/sps\.forEach\(function \(x\) \{[\s\S]{0,200}S\.crew\.push/.test(vsrc2),
               '★쪽마다 인원 행을 쪼개지 않는다 (중복 계상 방지)');

            /* 75-3 ★실제로 뜬다 — 이것이 이 판의 전부다 */
            const Z = boot({ v: 2 });
            const L = { s: 'civil', p: 3, c: 1 };
            Z.A.S.crew.push({ id: 'z1', date: Z.A.today(), loc: L, key: 'T-02', st: 'ok',
              by: '가업체', teams: 1, ppl: { eng: 0, fmn: 1, wkr: 9 }, eq: [],
              spot: null,
              spots: [{ kind: 'road', w: 20, no: 3, memo: '', side: 'L', f: 1000, t: 1250 },
                      { kind: 'road', w: 20, no: 3, memo: '', side: 'R', f: 1000, t: 1180 }] });
            Z.A.setFlt(L);
            const sr = Z.A.siteRows(Z.A.flt());
            const row = sr.filter(o => o.key === Z.A.locKey(L))[0];
            ok(!!row, '현장 현황에 그 자리가 있다');
            ok(row.spots.length === 2, `★측점이 두 쪽 다 뜬다 (${row.spots.length})`);
            ok(row.spots.join(' ').indexOf('STA') >= 0, '★STA 표기가 들어 있다');
            ok(row.pax === 10, '★인원은 한 번만 센다 (쪽 수만큼 안 는다)');

            /* 75-4 ★옛 기록(spot 한 개)도 그대로 읽는다 */
            const Z2 = boot({ v: 2 });
            Z2.A.S.crew.push({ id: 'z2', date: Z2.A.today(), loc: L, key: 'T-02', st: 'ok',
              by: '가업체', teams: 1, ppl: { eng: 0, fmn: 0, wkr: 4 }, eq: [],
              spot: { kind: 'road', w: 12, no: 1, memo: '', side: 'C', f: 0, t: 300 } });
            Z2.A.setFlt(L);
            const r2 = Z2.A.siteRows(Z2.A.flt())[0];
            ok(r2 && r2.spots.length === 1, '★옛 spot 한 개짜리도 읽는다');

            /* 75-5 ★측점을 안 넣어도 막히지 않는다 — 도로가 아닌 공종이 있다 */
            const Z3 = boot({ v: 2 });
            Z3.A.S.crew.push({ id: 'z3', date: Z3.A.today(), loc: L, key: 'T-02', st: 'ok',
              by: '가업체', teams: 1, ppl: { eng: 0, fmn: 0, wkr: 3 }, eq: [],
              spot: null, spots: null });
            Z3.A.setFlt(L);
            const r3 = Z3.A.siteRows(Z3.A.flt())[0];
            ok(r3 && r3.pax === 3 && r3.spots.length === 0,
               '★측점이 없어도 인원은 그대로 뜬다');
            ok(/return x\.w && x\.no;/.test(vsrc2), '★도로를 안 고르면 측점을 안 담는다');
          }

          /* ── [76] 띠가 여전히 가리던 진짜 이유 (v2.19.20 사용자 캡처 3회) ──
             ★v2.19.17에서 「.tw{overflow:visible} + th{top:var(--sbh)}」로
               고쳤다고 적었다. 그런데 증상이 그대로였다.
             ★진짜 이유 : **--sbh를 딱 한 번, 화면을 그릴 때만 쟀다.**
               날씨는 그 **뒤에** 도착한다. 도착하면 띠가 100px 넘게 높아지는데
               --sbh는 날씨 오기 전의 낮은 값 그대로다 → 머리행이 띠 뒤로 깔린다.
             ★교훈 : 「기준점을 잰다」로 끝이 아니다. **기준점이 바뀌는 길을
               전부 세어 봐야 한다.** 여기서는 셋이었다 —
               다시 그릴 때 · 날씨가 늦게 올 때 · 창 폭이 바뀌어 줄바꿈될 때. */
          console.log('\n[76] --sbh를 걷어냈다 — 기둥에는 기준점이 필요 없다');
          {
            const t9 = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
            const w9 = fs.readFileSync(path.join(ROOT, 'assets/js/wx.js'), 'utf8');
            const c9 = fs.readFileSync(path.join(ROOT, 'assets/css/app.css'), 'utf8');
            function nc(x) { return x.replace(/\/\*[\s\S]*?\*\//g, ''); }

            /* ★v2.19.17~20을 헛돌게 만든 장치를 통째로 걷어냈다.
               가로 띠를 고정하니 「띠 높이만큼 본문을 밀어야」 했고, 그 높이를
               한 번만 재서 날씨가 늦게 오면 낡은 값이 남았다.
               ★기둥은 본문 **옆**에 있다. 밀 것이 없으니 잴 것도 없다. */
            ok(!/setProperty\('--sbh'/.test(nc(t9)), '★높이를 재던 코드가 없다');
            ok(!/A\.sbHeight/.test(nc(t9)) && !/A\.sbHeight/.test(nc(w9)),
               '★그것을 부르던 자리도 없다');
            ok(!/addEventListener\('resize'/.test(nc(t9)), '★창 크기 감시도 필요 없다');
            ok(!/var\(--sbh/.test(nc(c9)), '★CSS도 그 값을 안 쓴다');
            ok(/\.tw th\{\s*position:sticky;top:0/.test(c9), '★머리행은 화면 맨 위다');

            /* 기둥이 제 몫을 한다 */
            ok(/\.pg\{display:grid;grid-template-columns:5fr 2fr/.test(c9), '★5:2 격자');
            ok(/\.pg__side\{[^}]*position:sticky/.test(c9), '★기둥이 스크롤을 따라온다');
            ok(/\.sb__in\{[^}]*flex-direction:column/.test(c9), '★현황판이 세로로 쌓인다');
            ok(/@media \(max-width:1180px\)[\s\S]{0,160}grid-template-columns:1fr/.test(c9),
               '★좁은 화면에서는 한 칸으로 떨어진다');
            ok(/@media \(max-width:1180px\)[\s\S]{0,160}position:static/.test(c9),
               '★★그 화면에서는 고정하지 않는다 — 고정하면 또 덮는다');
          }
        }

        /* ── 85 우리 스탭 명부 · 공종그룹 담당 (v2.23.0) ── */
        console.log('\n[85] 우리 스탭 — 공종그룹별 담당 · 내 차례');
        {
          const tsrc85 = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
          S.staff = []; S.me = '';

          /* 85-1 명부 */
          ok(A.staffAdd({ name: '' }) === null, '★이름 없이는 안 만들어진다');
          const k1 = A.staffAdd({ name: '김대리', tel: '821000000001', grps: ['토공', '우수공'] });
          const k2 = A.staffAdd({ name: '박과장', tel: '821000000002', grps: ['우수공'] });
          ok(S.staff.length === 2, '두 명이 들어갔다');
          ok(k1.grps.length === 2, '★한 사람이 여러 공종을 맡는다 (사용자 확정)');
          ok(A.staffOf('우수공').length === 2,
             '★★한 공종에 여러 사람도 된다 — 중복지정 (사용자 확정)');
          ok(A.staffOf('토공').length === 1 && A.staffOf('포장공').length === 0,
             '맡지 않은 공종에는 안 걸린다');
          ok(A.staffUpd(k2.id, { name: '' }) === null, '★이름을 빈 것으로 못 고친다');
          A.staffUpd(k2.id, { grps: ['우수공', '포장공'] });
          ok(A.staffOf('포장공').length === 1, '담당 공종을 고칠 수 있다');

          /* 85-2 나는 누구 — 기기에만 남는다 */
          A.setMe(k1.id);
          ok(A.me().name === '김대리', '이 기기의 나를 기억한다');
          ok(A.myGrps().join() === '토공,우수공', '내 담당 공종을 안다');
          ok(!/'me'|S\.me/.test(fs.readFileSync(path.join(ROOT, 'assets/js/api.js'), 'utf8')),
             '★「나는 누구」를 서버로 안 보낸다 — 기기마다 다르다');

          /* 85-3 ★내 차례가 담당으로 걸러진다 */
          const L85 = { s: 'civil', p: 3, c: 1 };
          const rowW = { id: 'r85w', loc: L85, grp: '우수공', mat: '레미콘', date: A.today() };
          const rowP = { id: 'r85p', loc: L85, grp: '포장공', mat: '아스콘', date: A.today() };
          const rowX = { id: 'r85x', loc: L85, grp: '기타공', mat: '모래', date: A.today() };
          ok(A.flowMineGrp('mat', rowW) === true, '내가 맡은 공종은 내 차례에 온다');
          ok(A.flowMineGrp('mat', rowP) === false,
             '★★남이 맡은 공종은 안 온다 — 이게 이 기능의 핵심이다');
          ok(A.flowMineGrp('mat', rowX) === true,
             '★★담당이 아무도 없는 공종은 모두에게 보인다 — 주인 없는 일을 숨기면 아무도 안 한다');

          /* 85-3-B ★★flowMineList가 **실제로** 그 필터를 부르는가.
             ★함수만 시험하면 「있는데 안 불린다」를 못 잡는다 — 0-J가 그랬다. */
          {
            const F85 = { s: 'civil', p: 0, c: 0, t: '', b: 0 };
            const keep = S.mreq;
            A.setRole('staff'); A.setMe(k1.id);
            S.mreq = [
              { id: 'f85a', loc: L85, grp: '우수공', mat: '레미콘', unit: 'M3',
                qty: 1, st: 'req', date: A.today(), fst: '', okS: 0, okV: 0 },
              { id: 'f85b', loc: L85, grp: '포장공', mat: '아스콘', unit: 'ton',
                qty: 1, st: 'req', date: A.today(), fst: '', okS: 0, okV: 0 }
            ];
            const ids = A.flowMineList(F85, 'staff').map(x => x.row.id);
            ok(ids.indexOf('f85a') >= 0,
               '★★내 차례 목록에 내 담당(우수공)이 온다');
            ok(ids.indexOf('f85b') < 0,
               '★★★내 차례 목록에서 남의 담당(포장공)이 빠진다 — 필터가 실제로 걸려 있다');
            S.mreq = keep;
          }

          /* 85-4 ★안 골랐거나 배정이 없으면 종전대로 전부 보인다 */
          A.setMe('');
          ok(A.flowMineGrp('mat', rowP) === true,
             '★「나는 누구」를 안 골랐으면 안 거른다 — 빈 화면이 되면 안 된다');
          const k3 = A.staffAdd({ name: '신입', tel: '', grps: [] });
          A.setMe(k3.id);
          ok(A.flowMineGrp('mat', rowP) === true,
             '★배정을 아직 안 받은 사람에게도 전부 보인다');

          /* 85-5 지운 사람이 「나」로 남지 않는다 */
          A.staffDel(k3.id);
          ok(S.me === '' && A.me() === null, '★지운 사람이 「나」로 남지 않는다');

          /* 85-6 공종그룹 찾기 */
          ok(A.grpOfRow('mat', rowW) === '우수공', '자재는 줄에 실린 grp를 쓴다');
          ok(A.grpOfRow('surv', { key: '' }) === '', '공종코드가 없으면 빈 문자 — 주인 없는 줄이 된다');
          ok(A.staffGrps().indexOf('토공') >= 0 && A.staffGrps().indexOf('기타공(부대토목)') >= 0,
             '★부지·부대 공종그룹을 함께 고를 수 있다');

          /* 85-7 옛 기기 대비 — staff가 빈 객체로 저장돼 있던 것 */
          ok(/if \(!Array\.isArray\(s\.staff\)\) s\.staff = \[\];/.test(
               fs.readFileSync(path.join(ROOT, 'assets/js/core.js'), 'utf8')),
             '★옛 기기의 staff:{} 를 배열로 바꾼다 — 안 하면 명부 화면이 죽는다');

          /* 85-8 화면 */
          ok(/id: 'stff'/.test(tsrc85) && /setupTab === 'stff'\) body = staffPanel\(\)/.test(tsrc85),
             '★준비 탭에 칸이 있고 실제로 그린다');
          ok(/data-stg=/.test(tsrc85), '공종을 여러 개 고르는 칸이 있다');
          ok(/A\.setMe\(this\.value\)/.test(tsrc85), '「나는 누구」를 고르면 저장된다');
          ['ko', 'en', 'bn'].forEach(function (L) {
            const d = sb.I18N && sb.I18N[L];
            ok(!!(d && d.st_t && d.st_me && d.st_grps && d.st_need && d.st_orphan),
               `${L} — 스탭 명부 문구가 다 있다`);
          });

          S.staff = []; S.me = '';
        }

        /* ── 87 자동 수신 1분 폴링 (v2.22.7 · 요청 8) ── */
        console.log('\n[87] 자동 수신 — 1분마다 서버를 확인한다');
        {
          const tsrc87 = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
          const hsrc87 = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

          ok(A.AUTO_SYNC_MS === 60000, '★1분마다다 (사용자 확정)');
          ok(typeof A.startAutoSync === 'function' && typeof A.stopAutoSync === 'function',
             '시작·정지 두 손잡이가 있다');

          /* 화면 열 때 켜진다 */
          ok(/A\.startAutoSync\(\)/.test(hsrc87), '★화면 열 때 자동 수신을 켠다');

          /* 실제로 타이머가 걸린다 — setInterval 스텁이 함수를 잡아 둔다 */
          sb.__ivFn = null;
          A.startAutoSync();
          ok(typeof sb.__ivFn === 'function', '★타이머가 실제로 걸린다');
          /* 두 번 걸어도 하나만 — 겹치면 같은 수신이 중복된다 */
          const first = sb.__ivFn;
          A.startAutoSync();
          ok(sb.__ivFn === first, '★두 번 켜도 타이머는 하나뿐이다');

          /* 안 보는 탭이면 쉰다 */
          ok(/document\.hidden/.test(tsrc87),
             '★안 보이는 탭이면 건너뛴다 — 백그라운드에서 헛돌지 않는다');

          /* ★자동 수신은 조용히 — 화면을 흔들지 않는다 */
          const autoBlk = tsrc87.slice(tsrc87.indexOf('A.startAutoSync ='),
                                       tsrc87.indexOf('A.stopAutoSync ='));
          ok(/syncNow\(true\)/.test(autoBlk),
             '★syncNow(true) — 조용히 받는다 (바뀐 게 없으면 meta만 오간다)');

          /* 받은 게 있으면 화면이 자동 갱신된다 (syncNow 안에) */
          ok(/if \(add\) \{ A\.save\(\); A\.render\(\); \}/.test(tsrc87),
             '★새 자료가 들어오면 화면이 저절로 다시 그려진다');

          A.stopAutoSync();
          ok(sb.__ivFn === null, '정지하면 타이머가 풀린다');
        }

        /* ── 86 「내 차례」가 탭별로 갈린다 (v2.22.6 · 요청 9) ── */
        console.log('\n[86] 내 차례 — 측량 탭에 자재가 안 섞인다');
        {
          const L85 = { s: 'civil', p: 3, c: 1 };
          const F85 = { s: 'civil', p: 0, c: 0, t: '', b: 0 };
          /* 스탭이 눌러야 하는 단계로 둔다 (fst=req → 스탭 확인 차례) */
          S.mreq = [{ id: 'mm85', date: A.today(), loc: L85, grp: '관수공', sub: '환기구',
                      mat: '모래', unit: 'M3', plant: false, qty: 3, st: 'req' }];
          S.surv = [{ id: 'sv85', date: A.today(), loc: L85, key: 'T-01', st: 'req' }];
          A.setRole('staff');

          const both = A.flowMineList(F85).map(x => x.kind);
          ok(both.indexOf('mat') >= 0 && both.indexOf('surv') >= 0,
             '종류를 안 주면 전부 모은다 (작업현황 탭용)');

          const onlyS = A.flowMineList(F85, null, null, ['surv']).map(x => x.kind);
          ok(onlyS.length > 0 && onlyS.every(k => k === 'surv'),
             '★★측량만 달라면 측량만 온다 — 자재가 안 섞인다');
          const onlyM = A.flowMineList(F85, null, null, ['mat']).map(x => x.kind);
          ok(onlyM.length > 0 && onlyM.every(k => k === 'mat'),
             '★자재만 달라면 자재만 온다');

          /* 경고(수령미확인)도 같은 종류만 세야 한다 */
          ok(typeof A.flowWarn(F85, null, ['surv']).wait === 'number',
             'flowWarn도 종류를 받는다');

          /* 화면 — 측량 탭이 mineCard(['surv'])를 부른다 */
          const tsrc85 = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
          const v3blk = tsrc85.slice(tsrc85.indexOf('function v3()'),
                                     tsrc85.indexOf('function survTable'));
          ok(!/mineCard\(\)/.test(v3blk) && /mineCard\(\['surv'\]\)/.test(v3blk),
             "★측량 탭은 mineCard(['surv'])만 부른다 — 인자 없는 호출이 없다");
          const v4blk = tsrc85.slice(tsrc85.indexOf('function v4()'),
                                     tsrc85.indexOf('function v4Full'));
          ok(/mineCard\(\['mat'\]\)/.test(v4blk), "★자재 탭은 mineCard(['mat'])");

          /* ★v2.24.0 — 사용자 신고 재현 : 「이제는 **관리자** 화면 측량 탭에
             자재가 섞여 나온다」. 위 검사는 (가) flowMineList를 직접 부르고
             (나) tabs.js **원문**을 읽을 뿐이라, 역할별로 실제 화면을 그려
             보지는 않았다. 원문 검사는 「그 갈래가 실제로 도는가」를 못 본다 —
             0-J·0-N에서 두 번 당한 함정이다.
             ★그래서 **역할 둘 다** 측량 탭을 그려서 자재명이 없는지 본다. */
          ['admin', 'staff'].forEach(function (rl) {
            A.setRole(rl); A.go(3);
            const hv = bag.view.innerHTML;
            ok(hv.indexOf('모래') < 0, '★★' + rl + ' 측량 탭을 그려도 자재가 안 섞인다');
            ok(hv.length > 200, rl + ' 측량 탭이 정상적으로 그려진다');
          });

          S.mreq = []; S.surv = []; A.setRole('admin');
        }

        /* ── 88 검측 화면 — 미처리/처리완료를 가른다 (v2.24.0 · 요청 10) ── */
        console.log('\n[88] 검측 — 처리완료는 접혀 있고 미처리만 뜬다');
        {
          const L88 = { s: 'civil', p: 3, c: 1 };
          const mk = (id, key, st) => ({ id: id, date: A.today(), loc: L88, key: key,
            qty: 10, st: st, stAt: A.today(), reason: '', seq: 1, hist: [] });
          const save88 = S.insp;
          S.insp = [mk('i88a', 'C-01', 'apply'), mk('i88b', 'C-02', 'pass'),
                    mk('i88c', 'C-03', 'fail')];
          A.setRole('admin'); A.go(2);
          const h88 = bag.view.innerHTML;

          /* ★핵심 — 합격(처리완료)은 기본으로 **안 보인다.**
             종전(v2.23.0)에는 한 표에 섞여 맨 아래로 밀려 있을 뿐이었다.
             그래서 이 줄은 옛 파일로 되돌리면 반드시 실패한다. */
          ok(h88.indexOf('C-02') < 0, '★★처리완료(합격)는 접혀 있어 안 나온다');
          ok(h88.indexOf('C-01') >= 0 && h88.indexOf('C-03') >= 0,
             '★미처리(신청·불합격)는 그대로 보인다');
          ok(h88.indexOf('data-idone') >= 0, '펼치기 단추가 있다');
          ok(h88.indexOf('data-rg="insp"') >= 0,
             '★기간 단추는 처리완료 카드 머리에 있다 — 접혀 있어도 누를 수 있다');
          ok(h88.indexOf(A.T('i_done_t')) >= 0 && h88.indexOf(A.T('s_open')) >= 0,
             '카드가 둘로 갈렸다 (미처리 / 처리완료)');

          /* 죽은 키를 남기지 않았는가 (3-E) */
          const isrc88 = fs.readFileSync(path.join(ROOT, 'assets/js/i18n.js'), 'utf8');
          ok(isrc88.indexOf('h_inspq') < 0, '★안 쓰게 된 h_inspq를 네 사전에서 지웠다');
          /* ★3-C — 아랍어는 협력업체 화면 전용 부분 사전이다. 관리자 화면 키를
             넣으면 아랍어 자리에 다른 말이 들어간다. 사전을 직접 본다. */
          const I88 = sb.I18N;
          ok(!!(I88.ko.i_dshow && I88.en.i_dshow && I88.bn.i_dshow),
             '새 키가 ko·en·bn 셋 다 있다');
          ok(I88.ar.i_dshow === undefined && I88.ar.i_done_t === undefined,
             '★ar은 건드리지 않았다 (3-C)');

          S.insp = save88; A.go(1);
        }

        /* ── 89 측량 탭 — 어디로 들어와 어디서 멈춰 있는지 (v2.24.1 · 요청 11) ── */
        console.log('\n[89] 측량 — 들어오는 곳과 걸려 있는 곳이 화면에 뜬다');
        {
          const L89 = { s: 'civil', p: 3, c: 1 };
          const save89 = S.surv;
          /* 협력업체가 vendor 화면에서 올린 그대로 — fst가 없다(→ 'req') */
          S.surv = [{ id: 'sv89', date: A.today(), loc: L89, key: 'C-01', spot: null,
                      why: '경계 확인', by: '업체A', done: false, up: 0 }];
          ok(A.fst('surv', S.surv[0]) === 'req' && A.flowOwn('surv', S.surv[0]) === 'staff',
             '업체가 올린 요청은 **스탭 확인**이 먼저다 — 관리자 차례가 아니다');

          A.setRole('admin'); A.go(3);
          const h89 = bag.view.innerHTML, t89 = h89.replace(/<[^>]+>/g, ' ');
          ok(h89.indexOf(A.T('h_survin')) >= 0,
             '★★측량 요청이 어디로 들어오는지가 화면에 있다');
          ok(h89.indexOf(A.T('h_survflow')) >= 0,
             '★★흐름 한 줄(업체→스탭→관리자→측량팀→스탭)이 화면에 있다');
          /* ★핵심 — 「내 차례 0건」으로 끝나지 않는다. 어디서 멈춰 있는지를 적는다. */
          ok(/지금 걸려 있는 곳/.test(t89) && /스탭 1건/.test(t89),
             '★★내 차례가 없으면 **누구 앞에 몇 건**인지가 뜬다');

          /* 자재 탭도 같은 카드를 쓴다 — 종류를 넘어 안 샌다 */
          S.mreq = [{ id: 'mm89', date: A.today(), loc: L89, grp: '관수공', sub: '환기구',
                      mat: '모래', unit: 'M3', plant: false, qty: 3, st: 'req' }];
          A.go(3);
          ok(bag.view.innerHTML.indexOf('모래') < 0,
             '★빈칸 문구도 종류를 지킨다 — 측량 탭에 자재가 안 샌다');

          const I89 = sb.I18N;
          ok(!!(I89.ko.h_survin && I89.en.h_survin && I89.bn.h_survin && I89.ko.fl_wait_who),
             '새 키가 ko·en·bn 셋 다 있다');
          ok(I89.ar.h_survin === undefined && I89.ar.fl_wait_who === undefined,
             '★ar은 건드리지 않았다 (3-C)');

          S.surv = save89; S.mreq = []; A.go(1);
        }

        /* ── 90 작업위치 표 — 도로명이 위치코드에 안 눌어붙는다 (v2.24.2 · 요청 2) ── */
        console.log('\n[90] 작업위치 표 — Road/Station 구분자 (요청 2 진단)');
        {
          const bl90 = { s: 'civil', p: 3, c: 1 };
          A.setFlt(bl90);
          const saveW90 = S.work;
          S.work = [
            { id: 'w90a', date: A.today(), loc: bl90, key: 'T-01', qty: 10, st: 'ok', by: 'LUU',
              spot: { kind: 'road', w: '18', no: '2', memo: '', side: 'L', f: 0, t: 250 } },
            { id: 'w90b', date: A.today(), loc: bl90, key: 'T-01', qty: 5, st: 'ok', by: 'LUU', spot: null }
          ];
          A.setRole('admin'); A.go(1);
          const h90 = bag.view.innerHTML;

          /* ★핵심 — 위치코드와 도로명이 붙어 「3-118-2」로 읽히면 안 된다.
             종전 버그를 재현하려면 이 줄이 바뀌기 전 코드로는 실패해야 한다. */
          ok(h90.indexOf('Phase 3-118-2') < 0,
             '★★위치코드와 도로명이 안 눌어붙는다 (Phase 3-118-2 금지)');
          ok(h90.indexOf('Phase 3-1 · 18-2 · Left · STA 0+00~12+10') >= 0,
             '★★구분자를 넣어 「위치 · 도로 · 쪽 · STA」로 읽힌다');

          /* spot이 없는 줄은 뒤에 군더더기 ' · '가 남지 않는다 */
          ok(!/Phase 3-1\s*·\s*<\/td>/.test(h90) && h90.indexOf('Phase 3-1</td>') >= 0,
             'spot 없는 줄은 위치코드만 깔끔하게 뜬다');

          S.work = saveW90; A.go(1);
        }

        /* ── 84 서버 용량 계기판 (v2.22.5 · 0-Z-4) ── */
        console.log('\n[84] 서버 용량 — 파일을 언제 나눠야 하는지 보여준다');
        {
          const asrc = fs.readFileSync(path.join(ROOT, 'assets/js/api.js'), 'utf8');
          const tsrc84 = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');

          ok(/API\.cap = \{/.test(asrc) && /d\.cellPct/.test(asrc),
             '★meta 응답에서 서버 용량을 기억한다 — 따로 물으러 안 간다');

          /* ★통신한 적이 없으면 아무것도 안 그린다 — 모르는 것을 0%로
             보여주면 「아직 안 찼다」고 오해한다 */
          ok(/if \(!c \|\| c\.pct == null\) return '';/.test(tsrc84),
             '★서버와 통신한 적이 없으면 계기판을 안 그린다');
          /* ★함수가 있다는 것만으로는 모자란다 — capPanel이 **부르는지**를 본다.
             0-J가 「갈래는 있는데 안 돈다」였다. 같은 함정을 안 밟는다. */
          const capBlk = tsrc84.slice(tsrc84.indexOf('function capPanel'),
                                      tsrc84.indexOf('function srvCapHTML'));
          ok(/srvCapHTML\(\)/.test(capBlk), '★저장 용량 칸이 실제로 부른다');

          ok(/T\('scap_w'\)/.test(tsrc84) && /c\.pct >= 80/.test(tsrc84),
             '★80%를 넘으면 경고한다 (사용자 물음: 「80% 찰 경우 경고」)');
          ok(/window\.BNCP_API && window\.BNCP_API\.cap/.test(tsrc84),
             '기기 용량이 아니라 서버 용량을 본다');

          ['ko', 'en', 'bn'].forEach(function (L) {
            const d = sb.I18N && sb.I18N[L];
            ok(!!(d && d.scap_t && d.scap_n && d.scap_h && d.scap_w),
               `${L} — 서버 용량 문구가 다 있다`);
          });
          ok(!(sb.I18N && sb.I18N.ar && sb.I18N.ar.scap_t),
             '★ar은 협력업체 전용 부분 사전이라 안 건드렸다');

        }

        /* ── 83 자재 결재 단계가 수신에서 살아남는다 (v2.22.4 · 0-J) ── */
        console.log('\n[83] 자재 수신 — 결재 단계가 안 없어진다');
        {
          const tsrc83 = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');

          /* 83-1 ★갈래가 하나뿐이어야 한다. 둘이면 앞엣것이 끊어 뒤엣것이 죽는다 */
          ok((tsrc83.match(/if \(r\.type === 'mat'\)/g) || []).length === 1,
             "★★unpack의 mat 갈래가 하나뿐이다 — 둘이면 뒤엣것이 영영 안 돈다");

          /* 83-2 ★실제로 돌려 본다. 글자 대조로는 「도는가」를 못 본다 */
          ok(typeof A._unpack === 'function', 'unpack을 검사에서 부를 수 있다');
          const rx83 = {
            id: 'mq83', type: 'mat', date: A.today(), s: 'civil', p: 3, c: 1,
            grp: '관수공', sub: '환기구', mat: 'STS plate', spec: 't=5mm',
            unit: 'kg', qty: 3, st: 'req', by: 'ALSKHAA',
            fst: 'fin', fat: '2026-08-20T05:00:00Z', fby: '이과장', fwhy: '수량 확인',
            okS: 1, okV: 1
          };
          const u83 = A._unpack(rx83);
          ok(u83 && u83.box === 'mreq', '자재 신청으로 받아들여진다');
          ok(u83.row.fst === 'fin',
             '★★결재 단계(fst)가 살아남는다 — 종전에는 통째로 버려졌다');
          ok(u83.row.fby === '이과장' && u83.row.fwhy === '수량 확인',
             '★누가 왜 눌렀는지도 남는다');
          ok(u83.row.okS === 1 && u83.row.okV === 1,
             '★★스탭·측량 확인 표시가 살아남는다 — 이게 없어서 안 눌린 채로 보였다');

          /* 83-3 ★위쪽 갈래에만 있던 칸도 빠지면 안 된다.
             addMreq가 만드는 줄과 모양이 달라지면 화면이 없는 칸을 읽는다. */
          ['reqAt', 'apvBy', 'apvAt', 'denyWhy', 'plantReqAt',
           'issAt', 'noissWhy', 'useAt'].forEach(function (k) {
            ok(k in u83.row, `${k} 칸이 있다 — addMreq가 만드는 줄과 모양이 같다`);
          });
          ok(u83.row.iss === null && u83.row.use === null,
             '지급·실사용은 비어 있으면 null이다 (0이 아니다)');

          /* 83-4 지급까지 끝난 줄이 그대로 온다 */
          const u84 = A._unpack(Object.assign({}, rx83, {
            id: 'mq84', st: 'iss', iss: 3, issAt: '2026-08-21T06:00:00Z', use: 2
          }));
          ok(u84.row.st === 'iss' && u84.row.iss === 3 && u84.row.use === 2,
             '★지급·실사용 수량이 그대로 온다');

          /* 83-5 자재명이 없으면 종전대로 안 받는다 (0-L) */
          ok(A._unpack(Object.assign({}, rx83, { id: 'mq85', mat: '', name: '' })) === null,
             '★자재명이 없으면 안 받는다 — 이름 없는 줄은 손댈 수가 없다');

          /* 83-6 자재는 공종코드가 없다. key 검사보다 위에 있어야 한다 */
          const bare83 = tsrc83.replace(/\/\*[\s\S]*?\*\//g, '');   /* 주석 안 언급은 빼고 본다 */
          ok(bare83.indexOf("if (r.type === 'mat')") < bare83.indexOf("if (!r.key) return null"),
             '★mat 갈래가 key 검사보다 위에 있다 — 밑에 두면 전부 걸러진다');
        }

        /* ── 82 자재 표가 위치별로 갈린다 (v2.22.3 · 0-M) ── */
        console.log('\n[82] 자재 — 줄마다 제 위치를 단다');
        {
          const tsrc82 = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
          const LA = { s: 'civil', p: 1, c: 1 }, LB = { s: 'civil', p: 3, c: 1 };
          const F82 = { s: 'civil', p: 0, c: 0, t: '', b: 0 };
          S.mreq = [
            { id: 'x1', date: A.today(), loc: LA, grp: '가로등', sub: '핸드홀',
              mat: '레미콘', spec: 'fck=21MPa', unit: 'M3', plant: true, qty: 22, st: 'req' },
            { id: 'x2', date: A.today(), loc: LB, grp: '가로등', sub: '핸드홀',
              mat: '레미콘', spec: 'fck=21MPa', unit: 'M3', plant: true, qty: 23, st: 'req' }
          ];
          /* ★설계수량에서 온 줄이 섞여 있으므로 레미콘만 본다 */
          const rs = A.matRows(F82).filter(a => a.mat === '레미콘');
          ok(rs.length === 2,
             `★★같은 자재라도 위치가 다르면 갈라진다 (${rs.length}) — 종전에는 한 줄로 뭉갰다`);
          ok(rs.every(a => !!a.loc), '★줄마다 제 위치가 실려 온다');
          const ka = rs.filter(a => A.locKey(a.loc) === A.locKey(LA))[0];
          const kb = rs.filter(a => A.locKey(a.loc) === A.locKey(LB))[0];
          ok(ka && ka.req === 22, 'P1-1 줄은 22');
          ok(kb && kb.req === 23, '★P3-1 줄은 23 — 두 곳 수량이 안 섞인다');

          /* ★표가 선택기 위치를 찍으면 안 된다 — 그 버그가 이번 신고였다 */
          ok(!/A\.locShort\(pkLoc\('w'\)\)/.test(tsrc82),
             "★★표가 선택기 위치(pkLoc('w'))를 찍지 않는다");
          ok(/A\.locShort\(a\.loc\)/.test(tsrc82), '★그 줄의 위치를 찍는다');

          /* 재고도 그 줄의 위치에 붙는다 */
          A.setStock(LB, kb.id, 7);
          const rs2 = A.matRows(F82).filter(a => a.mat === '레미콘');
          ok(rs2.filter(a => A.locKey(a.loc) === A.locKey(LB))[0].stock === 7,
             '★재고가 그 줄의 위치에 붙는다');
          ok(rs2.filter(a => A.locKey(a.loc) === A.locKey(LA))[0].stock == null,
             '★★다른 위치 줄에는 안 붙는다 — 필터로 보면 여기가 어긋난다');
          ok(/data-mstl=/.test(tsrc82) && /A\.keyLoc\(el\.dataset\.mstl\)/.test(tsrc82),
             '★재고 입력도 그 줄의 위치에 저장한다');

          /* locKey ↔ keyLoc 왕복 */
          ok(A.locKey(A.keyLoc(A.locKey(LB))) === A.locKey(LB), 'keyLoc이 locKey의 역함수다');
          ok(A.keyLoc('A|B|7').s === 'anc' && A.keyLoc('A|B|7').b === 7, '부대토목 위치도 되돌아온다');
          ok(A.keyLoc('') === null, '빈 열쇠는 null');

          /* CSV에도 위치가 있어야 한다 — 표에 있는데 CSV에 없으면 어디 것인지 모른다 */
          ok(/\[T\('u_sec'\), T\('c_grp'\)/.test(tsrc82), '★CSV 머리에 공구가 있다');
          ok(/\[A\.locShort\(a\.loc\), a\.grp/.test(tsrc82), '★CSV 줄에도 위치가 실린다');

          S.mreq = []; S.stock = {};
        }

        /* ── 81 플랜트 자재가 화면에 나온다 · 측량 기간 단추 (v2.22.2 · 0-M) ── */
        console.log('\n[81] 플랜트 자재 · 측량 기간 단추');
        {
          const tsrc81 = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
          const csrc81 = fs.readFileSync(path.join(ROOT, 'assets/js/core.js'), 'utf8');

          /* 81-1 ★플랜트 자재를 세는가 — 종전에는 false를 박아 창고만 셌다 */
          ok(!/A\.mVariance\(f, false\)/.test(csrc81),
             '★matRows가 창고(false)로 못 박혀 있지 않다');
          ok(/A\.mVariance\(f, null\)/.test(csrc81),
             '★null로 부른다 — 창고·플랜트를 함께 센다');

          const L81 = { s: 'civil', p: 3, c: 1 };
          const F81 = { s: 'civil', p: 0, c: 0, t: '', b: 0 };
          S.mreq = [
            { id: 'mp81', date: A.today(), loc: L81, grp: '관수공', sub: '환기구',
              mat: 'STS plate', spec: 't=5mm', unit: 'kg', plant: false, qty: 3, st: 'req' },
            { id: 'mp82', date: A.today(), loc: L81, grp: '콘크리트공', sub: '레미콘',
              mat: '레미콘', spec: '', unit: 'M3', plant: true, qty: 23, st: 'req' }
          ];
          const mr = A.matRows(F81);
          ok(mr.filter(a => a.mat === '레미콘').length === 1,
             '★★플랜트 자재(레미콘)가 표에 나온다 — 종전에는 통째로 빠졌다');
          ok(mr.filter(a => a.mat === 'STS plate').length === 1,
             '창고 자재도 그대로 나온다');
          ok(mr.filter(a => a.mat === '레미콘')[0].plant === true,
             '★플랜트 여부가 줄에 실려 온다 — 표에서 갈라 보여야 한다');
          ok(/a\.plant \? ' <span class="bd bd--o">' \+ T\('m_plant'\)/.test(tsrc81),
             '★표에 플랜트 표를 단다 — 안 달면 창고 자재와 구분이 안 된다');

          /* 81-2 ★측량 기간 단추 — 단추도 없고 감싸지도 않았다 */
          const v3src = tsrc81.slice(tsrc81.indexOf('function v3()'),
                                     tsrc81.indexOf('function survTable'));
          ok(/rngBtn\('surv'\)/.test(v3src), '★측량 표에 기간 단추가 있다');
          ok(/withRng\('surv'/.test(v3src),
             '★★측량 목록이 그 기간을 따른다 — 단추만 있고 안 걸면 안 듣는다');
          ok(/withRng\('surv', function \(\) \{ return A\.survList\(flt\); \}\)\.map/.test(tsrc81),
             '★CSV도 표와 같은 기간이다 — 어긋나면 0-H와 같은 사고다');

          S.mreq = [];
        }

        /* ── 80 측량·자재도 기간 단추를 따른다 (v2.22.1 · 0-K) ── */
        console.log('\n[80] 측량·자재 — 끝난 것도 기간을 주면 나온다');
        {
          const lk79 = A.locKey({ s: 'civil', p: 3, c: 1 });
          const L79 = { s: 'civil', p: 3, c: 1 };
          const F79 = { s: 'civil', p: 0, c: 0, t: '', b: 0 };
          S.surv = [
            { id: 'sv79a', date: '2026-08-18', loc: L79, key: 'T-01', done: true },
            { id: 'sv79b', date: A.today(), loc: L79, key: 'T-01', done: true },
            { id: 'sv79c', date: '2026-08-18', loc: L79, key: 'T-01', done: false }
          ];
          S.mreq = [
            { id: 'mq79a', date: '2026-08-18', loc: L79, mat: '레미콘', st: 'iss', iss: 3 },
            { id: 'mq79b', date: A.today(), loc: L79, mat: '레미콘', st: 'iss', iss: 3 },
            { id: 'mq79c', date: '2026-08-18', loc: L79, mat: '모래', st: 'req' }
          ];

          /* 기간을 안 주면 종전대로 — 오늘 것 + 안 끝난 것 */
          A.dateFlt = { from: '', to: '' };
          let sv = A.survList(F79).map(r => r.id);
          ok(sv.indexOf('sv79b') >= 0 && sv.indexOf('sv79c') >= 0,
             '기간 없으면 오늘 것과 미처리는 나온다');
          ok(sv.indexOf('sv79a') < 0, '기간 없으면 끝난 과거 건은 안 나온다 (종전 그대로)');

          /* ★기간을 주면 끝난 과거 건도 나와야 한다 — 여기가 안 되고 있었다 */
          A.dateFlt = { from: '2026-08-17', to: '2026-08-23' };
          sv = A.survList(F79).map(r => r.id);
          ok(sv.indexOf('sv79a') >= 0,
             '★★기간을 주면 끝난 측량도 나온다 — 옛 사본은 기간을 안 봤다');
          ok(sv.indexOf('sv79c') >= 0, '미처리는 기간과 무관하게 계속 나온다');

          const mq = A.mreqOpen(F79).map(r => r.id);
          ok(mq.indexOf('mq79a') >= 0, '★★기간을 주면 지급 끝난 자재도 나온다');
          ok(mq.indexOf('mq79c') >= 0, '아직 지급 안 된 자재는 계속 나온다');

          /* ★기간 밖은 여전히 걸러야 한다 — 단추가 뜻대로 들어야 한다 */
          A.dateFlt = { from: '2026-08-01', to: '2026-08-02' };
          ok(A.survList(F79).map(r => r.id).indexOf('sv79a') < 0,
             '기간 밖의 끝난 건은 안 나온다');
          ok(A.mreqOpen(F79).map(r => r.id).indexOf('mq79a') < 0,
             '기간 밖의 지급 끝난 자재도 안 나온다');

          /* ★같은 뜻의 함수가 둘이면 또 한쪽만 고치게 된다 (3-D) */
          ok(!/function todayOrOpen\(/.test(
               fs.readFileSync(path.join(ROOT, 'assets/js/core.js'), 'utf8')),
             '★옛 사본(비공개 todayOrOpen)이 지워졌다 — 같은 뜻이 둘이면 또 갈린다');

          A.dateFlt = { from: '', to: '' };
          S.surv = []; S.mreq = [];
          void lk79;
        }

        /* ── 78 [초기화] — 관리자만 · 협력업체 입력만 (v2.21.1 · 0-Z-1·0-Z-2) ── */
        console.log('\n[78] [초기화] — 관리자 비밀번호 · 협력업체가 올린 것만 지운다');
        {
          const csrc = fs.readFileSync(path.join(ROOT, 'assets/js/core.js'), 'utf8');
          const hsrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

          /* 78-1 지우는 범위 — 다섯만 비고 나머지는 그대로 남는다.
             ★사용자 확정 : 「없다 — 협력업체 입력 5종만」 */
          const lk78 = A.locKey({ s: 'civil', p: 3, c: 1 });
          S.work = [{ id: 'w78' }]; S.crew = [{ id: 'c78' }]; S.insp = [{ id: 'i78' }];
          S.surv = [{ id: 's78' }]; S.mreq = [{ id: 'm78' }];
          S.direct = [{ id: 'd78' }]; S.issue = [{ id: 'e78' }];
          S.stock = { x78: 1 }; S.boq = { rows: [1] }; S.alias = { a78: 'T-01' };
          S.plan[lk78] = { 'T-01': 100 };
          S.vend = [{ code: 'V78', name: 'V78', key: 'k78', staff: ['|Ali|9647'] }];
          S.lang = 'ko'; S.rxLast = '2026-08-01T00:00:00Z';
          A.save();
          A.wipe();
          ok(!S.work.length && !S.crew.length && !S.insp.length &&
             !S.surv.length && !S.mreq.length, '★협력업체 입력 5종이 비었다');
          ok(S.direct.length === 1 && S.issue.length === 1 && S.stock.x78 === 1 && !!S.boq,
             '★직영·지급대장·재고·확인필요 목록은 남는다 (사용자 확정)');
          ok(S.plan[lk78] && S.plan[lk78]['T-01'] === 100 && S.vend.length === 1 &&
             S.alias.a78 === 'T-01', '★설계수량·명부·별칭은 남는다');
          ok(S.rxLast === '2026-08-01T00:00:00Z',
             '★rxLast를 되돌리지 않는다 — 되돌리면 지운 줄이 서버에서 되돌아온다');
          ok(store['bncp.dash.v2'] != null && JSON.parse(store['bncp.dash.v2']).vend.length === 1,
             '★저장소 키를 통째로 지우지 않는다');
          ok(!/removeItem\(KEY\)/.test(csrc), '★옛 removeItem(KEY) 길이 남아 있지 않다');

          /* 78-2 관문 판정 — 관리자만 통과한다 */
          ok(A.wipeOk({ ok: true, role: 'admin' }).ok === true, '관리자는 통과');
          ok(A.wipeOk({ ok: true, role: 'staff' }).err === 'role', '★스탭은 거절');
          ok(A.wipeOk({ ok: true, role: 'surv' }).err === 'role', '★측량팀도 거절');
          ok(A.wipeOk({ ok: false }).err === 'bad', '비밀번호 불일치는 거절');
          ok(A.wipeOk({ ok: false, err: 'offline' }).err === 'off',
             '★대조 못 하면 거절 — 확인 없이 지워지는 것보다 낫다');
          ok(A.wipeOk(null).err === 'off', '응답 자체가 없어도 거절');

          /* 78-3 ★대조 없이 A.wipe가 불리는 자리가 없다 */
          const inl = (hsrc.split('#wipe')[1] || '').slice(0, 900);
          ok(/A\.wipeGate\(/.test(inl), '★[초기화]는 서버 대조를 거친다');
          ok(inl.indexOf('A.wipeGate(') < inl.indexOf('A.wipe()'),
             '★A.wipe()는 대조를 통과한 뒤에만 불린다');
          ok(!/if\(confirm\(A\.T\('wipeConfirm'\)\)\) A\.wipe\(\)/.test(hsrc),
             '★confirm 하나로 곧바로 지우던 옛 길이 없다');
          const strip78 = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
          ok(!/PW_ADMIN|pwAdmin/.test(strip78(hsrc)) && !/PW_ADMIN/.test(strip78(csrc)),
             '★비밀번호를 화면 코드에 두지 않는다 (주석 제외)');

          /* 78-4 문구가 실제 동작과 맞는다 (ko/en/bn — ar은 협력업체 전용이라 뺀다) */
          const I78 = sb.BNCP_I18N || sb.I18N || null;
          ['ko', 'en', 'bn'].forEach(function (L) {
            const d = I78 && I78[L];
            ok(!!(d && d.wipePw && d.wipeRole && d.wipeBad && d.wipeOff && d.wipeDone),
               `${L} — 초기화 안내 문구가 다 있다`);
          });
          if (I78 && I78.ko) {
            ok(/명부/.test(I78.ko.wipeConfirm) && /설계수량/.test(I78.ko.wipeConfirm),
               '★무엇이 남는지 문구에 적혀 있다');
          }
        }

        /* 78-5 관문이 실제로 통신을 거친다 (비동기 — 요약은 이 뒤에 낸다) */
        const api78 = sb.BNCP_API;
        const gate78 = function (stub) {
          sb.BNCP_API = stub;
          return A.wipeGate('x');
        };
        Promise.resolve()
          .then(() => gate78({ login: () => Promise.resolve({ ok: true, role: 'admin' }) }))
          .then(r => ok(r.ok === true, '★서버가 관리자라고 하면 통과'))
          .then(() => gate78({ login: () => Promise.resolve({ ok: true, role: 'staff' }) }))
          .then(r => ok(r.err === 'role', '★서버가 스탭이라고 하면 막힌다'))
          .then(() => gate78({ login: () => Promise.resolve({ ok: false, err: 'offline' }) }))
          .then(r => ok(r.err === 'off', '★오프라인이면 막힌다'))
          .then(() => gate78(null))
          .then(r => ok(r.err === 'off', '★API가 아예 없어도 막힌다'))
          .then(() => {
            sb.BNCP_API = api78;
            console.log(fail ? `\n✗ 실패 ${fail}건\n` : '\n✓ 전부 통과\n');
            process.exit(fail ? 1 : 0);
          });
      });
    });
  });
}
process.exit(fail ? 1 : 0);
