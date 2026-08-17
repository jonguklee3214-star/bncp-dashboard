# -*- coding: utf-8 -*-
"""자재명 마스터(사용자 최종본) → materials2.js
   - 공종그룹×세부공종 매핑 보존 (공종선택 → 자재필터)
   - 몰탈 (1:2) 통일 / 레미콘 fck=NMPa 통일, 강도 여러개는 행 분리
   - 철근·거푸집 제외
   - 차선도색 종류·경계석 색상 제외
   - 플랜트 지급자재 분류(레미콘·아스콘·보도블럭·경계석·모래·서브베이스·치환·베이스코스…)
"""
import openpyxl, re, json, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else '자재명_마스터_최종.xlsx'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'materials2.js'

wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
ws = wb['자재명_마스터']
rows = list(ws.iter_rows(values_only=True))
body = [r for r in rows[3:] if r[2]]

def s(v): return '' if v is None else re.sub(r'\s+', ' ', str(v)).strip()

# ── 제외: 철근·거푸집 ──
EXCLUDE = re.compile(r'거푸집')
# 철근 '단독' 자재만 제외 — '레미콘 철근'(콘크리트 강도구분)은 살린다
EXCLUDE_REBAR = re.compile(r'^철근')
# ── 제외: 차선/노면표시 종류·색상, 줄눈 종류(자재 아님) ──
EXCLUDE_MARK = re.compile(r'^(중앙선|차선변경선|유도선|주차선|안전지대|횡단보도|정지선|황색|백색|적색|팽창줄눈|수축줄눈)$')

# ── 플랜트 지급자재 판정 ──
PLANT = re.compile(r'레미콘|레미컨|아스콘|아스팔트\s*콘크리트|콘크리트|몰탈|모르타르|'
                   r'보도블럭|보도블록|경계석|경계블록|모래|잔골재|굵은골재|골재|'
                   r'서브\s*베이스|sub\s*base|베이스\s*코스|base\s*course|치환|'
                   r'기층|보조기층|동상방지층|선택층|되메우기용|성토재', re.I)

def norm_conc(name, spec):
    """레미콘/콘크리트/몰탈 표기 통일. 강도 여러개면 (분리목록) 반환."""
    combined = name + ' ' + spec
    # 몰탈 배합비
    if re.search(r'몰탈|모르타르', name):
        m = re.search(r'(\d+)\s*[:：]\s*(\d+)', combined)
        base = '몰탈'
        use = re.sub(r'몰탈|모르타르|\(?\d+\s*[:：]\s*\d+\)?', '', name)
        use = re.sub(r'[/／]+', ' ', use); use=re.sub(r'\s+',' ',use).strip(' /()')
        sp = ('(%s:%s)' % (m.group(1), m.group(2))) if m else spec
        return [(base + (' · ' + use if use else ''), sp)]
    # 레미콘/콘크리트
    if re.search(r'레미콘|레미컨|콘크리트', name):
        base = '레미콘'
        # 강도 토큰 추출: 철근31 / 무근17 / fck=31 / 31MPa
        toks = re.findall(r'(철근|무근)?\s*(?:fck\s*=?\s*)?(\d{2})\s*(?:MPa|N/?㎟|N/mm2)?', combined)
        nom = re.search(r'(\d{2}-\d{2,3}-\d{1,2})', combined)
        out = []
        seen = set()
        for kind, val in toks:
            if val not in ('17', '21', '24', '27', '30', '31', '35', '40'): continue
            key = (kind, val)
            if key in seen: continue
            seen.add(key)
            label = base + (' ' + kind if kind else '')
            spc = 'fck=%sMPa' % val + (' (%s)' % nom.group(1) if nom else '')
            out.append((label, spc))
        if out: return out
        # 강도 못 찾으면 원본 유지
        return [(base, spec or (nom.group(1) if nom else ''))]
    return None

items = []
for r in body:
    grp, sub, name, spec, unit, sheet = [s(x) for x in r[:6]]
    if not name: continue
    if EXCLUDE.search(name): continue
    if EXCLUDE_REBAR.match(name): continue
    if EXCLUDE_MARK.match(name): continue

    conc = norm_conc(name, spec)
    variants = conc if conc else [(name, spec)]
    for nm, sp in variants:
        items.append({
            'grp': grp, 'sub': sub, 'mat': nm, 'spec': sp, 'unit': unit,
            'plant': bool(PLANT.search(nm))
        })

# 중복 제거(같은 grp·sub·mat·spec·unit)
seen = set(); uniq = []
for it in items:
    k = (it['grp'], it['sub'], it['mat'], it['spec'], it['unit'])
    if k in seen: continue
    seen.add(k); uniq.append(it)

# 공종그룹→세부공종 인덱스
groups = {}
for it in uniq:
    groups.setdefault(it['grp'], {})
    groups[it['grp']].setdefault(it['sub'], 0)
    groups[it['grp']][it['sub']] += 1

plant_n = sum(1 for it in uniq if it['plant'])
print('자재행 %d (플랜트 %d / 창고 %d)' % (len(uniq), plant_n, len(uniq) - plant_n))
print('공종그룹 %d' % len(groups))
mats = sorted(set(it['mat'] for it in uniq))
print('고유 자재명 %d' % len(mats))
print('\n[몰탈]', [m for m in mats if '몰탈' in m])
print('[레미콘]', [m for m in mats if '레미콘' in m])
print('[철근/거푸집 잔존]', [m for m in mats if re.search(r'철근|거푸집', m)] or '없음 ✓')

js = '/* 자동생성 — build_matmaster.py. 사용자 자재명 마스터 기준 */\n'
js += 'window.BNCP_MAT2=' + json.dumps({'items': uniq}, ensure_ascii=False, separators=(',', ':')) + ';\n'
open(OUT, 'w', encoding='utf-8').write(js)
print('\n→', OUT)
