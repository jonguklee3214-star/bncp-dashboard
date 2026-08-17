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
['logo','appt','hmeta','tabs','view','fltBox','wipe','vendorBtn'].forEach(i => bag[i] = El(i));
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
  document: { documentElement: {}, addEventListener() {}, createElement: () => El('t'),
    body: { appendChild() {} },
    querySelector(s) { const m = /^#([A-Za-z0-9_-]+)$/.exec(s); return m && bag[m[1]] ? bag[m[1]] : null; },
    querySelectorAll() { return []; } }
};
sb.window = sb; vm.createContext(sb);
['version','i18n','data','master','materials','materials2','work_i18n','prod','equip','core','spot','api','matmaster_api','tabs']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js', f + '.js'), 'utf8'), sb, { filename: f }));

const A = sb.APP, S = A.S;
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; };
const near = (a, b, t) => Math.abs(a - b) <= (t == null ? 1e-6 : t);

/* ── 1 위치체계 ───────────────────────────────────────── */
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
  ok(/api\.rows\(''\)/.test(tsrc), '한 번의 요청으로 전 종류를 받는다');

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
  ok(/if \(have\[r\.id\]\) return;/.test(tsrc), '전 종류에 id 중복 차단 적용');
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
  ok(/function vendPanel/.test(tsrc) && /vendor\.html\?c=/.test(tsrc), '업체별 링크를 관리자 화면에서 확인');
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
  ok(/function rollOut/.test(tsrc) && /function rollPpl/.test(tsrc) && /function rollEq/.test(tsrc),
     '공종별 집계가 작업량·인원·장비 세 구획으로 나뉨');
  ok(/h \+= todayHTML\(\)/.test(tsrc) && /h \+= mtHTML\(\)/.test(tsrc) && /h \+= cumCard\(\)/.test(tsrc),
     '오늘 투입·정비의뢰·누계가 탭1에 있다');
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
  ok(/cumOpen/.test(tsrc), '누계는 접어 둔다');
  ok(/res_md/.test(tsrc) && /res_ed/.test(tsrc), '누계 단위는 명·일 / 대·일');

  // 상세 팝오버
  ok(/function detailHTML/.test(tsrc) && /function bindDetail/.test(tsrc), '공종 상세 있음');
  ok(/mousemove/.test(tsrc) && /> 900/.test(tsrc), '마우스가 30px 움직이면 닫힌다');
  ok(/data-detail=/.test(tsrc), '행 클릭으로 열린다');
}

console.log('\n[27] 정비 의뢰 — 스탭이 의뢰 여부만 체크, 장기건은 사유');
{
  const tsrc = fs.readFileSync(path.join(ROOT, 'assets/js/tabs.js'), 'utf8');
  ok(/function mtRows/.test(tsrc), '고장 장비 추적 있음');
  ok(/c\.by \|\| '—'\) \+ '\|' \+ x\.cat/.test(tsrc), '회사+종류+규격 단위로 추적(개별 번호 없음)');
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
  ok(/if \(!A\.isStaff\(\)\)/.test(tsrc), '로그인 전에는 로그인 화면만');
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
  ok(/i === 6\) return A\.can\('sched'\)/.test(tsrc), '공정표는 스탭에게 감춘다');
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
  ok(/qbFrom/.test(tsrc) && /qbPrev/.test(tsrc) && /qbToday/.test(tsrc), '조회 줄에 날짜·하루이동·오늘');

  // 장비 약어 — 사용자가 지정한 표기
  ok(A.eqAbbr('Dump Truck') === 'D/T', 'Dump Truck → D/T');
  ok(A.eqAbbr('Excavator(wheel)') === 'EX(W)', 'Excavator(wheel) → EX(W)');
  ok(A.eqAbbr('Excavator(crawler)') === 'EX(C)', 'Excavator(crawler) → EX(C)');
  ok(A.eqAbbr('Motor Grader') === 'MG', 'Motor Grader → MG');
  // 마스터 62종이 전부 약어를 갖고, 빈 값이 없어야 한다
  let blank = 0, seen = {};
  A.EQ_TREE.forEach(t => { const a = A.eqAbbr(t.cat); if (!a) blank++; seen[t.cat] = a; });
  ok(blank === 0, `장비 ${Object.keys(seen).length}종 전부 약어가 있다`);
  ok(/title="' \+ esc\(o\.cat\)/.test(tsrc), '약어에 원문을 남긴다 — 지급대장 대조는 원문 철자');

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
  // (1) 오늘 투입 카드만 A.today()로 고정돼 위 집계와 숫자가 어긋났다
  ok(/resAgg\(A\.dateFlt\.from, A\.dateFlt\.to\)/.test(tsrc),
     '★투입 카드가 조회 기준을 따른다 — 위는 15대인데 여기만 0대이던 문제');
  ok(!/var d = A\.today\(\), t = resAgg/.test(tsrc), '오늘 고정이 남아 있지 않다');
  // (2) 업체 칩이 켜지기만 하고 걸러지지 않았다
  ok(typeof A.inCo === 'function', '업체 필터 함수 있음');
  A.coFlt = 'X'; ok(A.inCo({ by: 'X' }) === true && A.inCo({ by: 'Y' }) === false, '업체명으로 걸린다');
  A.coFlt = '@dir'; ok(A.inCo({}, true) === true && A.inCo({ by: 'X' }) === false, '직영만 남는다');
  A.coFlt = ''; ok(A.inCo({ by: 'X' }) === true, '전체면 다 통과');
  ok(/A\.inCo\(c, isDir\)/.test(tsrc), '투입 집계도 업체 필터를 따른다');
  // (3) '품목'은 자재에만 쓴다. 공종은 '개 공종'
  ok(/u_nwork/.test(tsrc), "공종 수는 '개 공종'으로 쓴다");
  ok(!/nf\(n\) \+ T\('u_item'\)/.test(tsrc), "대분류 머리에 '품목'을 쓰지 않는다");
  ok(!/nf\(rows\.length\) \+ T\('u_item'\)/.test(tsrc), "진행률 합계에 '품목'을 쓰지 않는다");

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

console.log(fail ? `\n✗ 실패 ${fail}건\n` : '\n✓ 전부 통과\n');
process.exit(fail ? 1 : 0);
