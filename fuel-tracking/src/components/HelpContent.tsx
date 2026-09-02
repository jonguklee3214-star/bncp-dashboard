"use client";

import type { Lang } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";
import { Card } from "./ui";

interface Step {
  st: string;
  de?: string;
}
interface Section {
  n: string;
  title: string;
  intro?: string;
  steps?: Step[];
  bullets?: string[];
  note?: string;
}
interface Manual {
  title: string;
  lede: string;
  url: string;
  sections: Section[];
}

const MANUAL: Record<Lang, Manual> = {
  ko: {
    title: "사용설명서",
    lede: "현장 차량·장비의 주유를 기록하고 사용량을 일·주·월로 집계·조회합니다. 휴대폰과 PC 모두에서 사용할 수 있습니다.",
    url: "fuel-tracking-lyart.vercel.app",
    sections: [
      {
        n: "1",
        title: "시작하기 · 접속",
        steps: [
          { st: "웹 주소 접속", de: "휴대폰·PC 브라우저에서 앱 주소를 엽니다." },
          { st: "휴대폰 홈 화면에 추가 (선택)", de: "브라우저 메뉴 → '홈 화면에 추가' 하면 앱처럼 쓸 수 있습니다." },
          { st: "언어 선택", de: "오른쪽 위 🌐 에서 한국어 / English / বাংলা. 선택 언어는 다음에도 유지됩니다." },
        ],
      },
      {
        n: "2",
        title: "주유 입력 (가장 중요)",
        intro: "유종을 먼저 고르는 것이 핵심입니다. 유종에 따라 입력 항목이 달라집니다.",
        steps: [
          { st: "하단 '주유' 메뉴(모바일) 또는 왼쪽 '주유 입력'(PC)" },
          { st: "유종 선택 — 디젤 또는 가솔린", de: "선택한 유종의 차량/장비만 목록에 나옵니다." },
          { st: "차량/장비 선택", de: "검색창에 번호 일부를 입력해 찾습니다. 관리번호·운전자·팀·차종·용량이 자동 표시됩니다." },
          { st: "주유량(L) 입력", de: "디젤은 주유량만. 가솔린은 현재 주행거리(km)도 입력(거리 자동 계산)." },
          { st: "저장", de: "'주유 기록이 저장되었습니다'가 뜨면 완료. 대시보드에 즉시 반영." },
        ],
        bullets: [
          "기타 급유: 차량 대신 목록 맨 위 '기타 급유'를 고르면 주유량 + 사유만 입력해 저장합니다(소형 발전기·소형 기계용, 말통 급유 등).",
          "디젤 트럭(카고·덤프·미니카고·워터트럭·박스카)은 주행거리(km)도 입력. 굴삭기·로더·바브캣·발전기는 주유량만.",
          "미터기 고장: 주행거리를 못 넣으면 관리자가 차량 관리에서 '면제 승인'을 1회 해주면, 그 차량은 이후 주유량만으로 입력됩니다(수리 후 해제 가능).",
        ],
        note: "주행거리 경고: 현재 주행거리가 이전보다 작으면 저장이 막힙니다. 관리자만 예외 저장할 수 있습니다.",
      },
      {
        n: "3",
        title: "대시보드 보기",
        bullets: [
          "상단 날씨: 현장(바그다드) 현재 날씨 + 7일 예보(기온·강수·바람).",
          "KPI: 주유 횟수·주유량·총 주행거리·평균 주유량·운행 차량.",
          "그래프: 일·주·월별, 파트·차량·운전자별 사용량. 막대 위 숫자로 바로 확인.",
          "필터: 기간·유종·파트·차량·운전자. 바꾸면 KPI와 그래프가 함께 바뀝니다.",
        ],
      },
      {
        n: "4",
        title: "주유 이력 · 검색 · 내보내기",
        bullets: [
          "이력: 최신 기록부터. PC는 표, 휴대폰은 카드.",
          "검색: 차량번호·관리번호·운전자·파트·차종 일부만 입력해도 찾습니다.",
          "CSV: 현재 목록을 엑셀 파일로 내려받기.",
          "인쇄/PDF: 인쇄 버튼 → 'PDF로 저장' 선택 가능. 금액 정보는 없습니다.",
          "기록 수정(관리자): 오른쪽 위 🔒 관리자 수정 → PIN 입력 후, 각 기록의 '수정' 버튼으로 주유량·주행거리·비고를 고칩니다. 관리자만 가능.",
          "수정 요청(입력자): 잘못 입력했으면 각 기록의 '수정 요청' 버튼으로 올립니다. 관리자가 📥 수정 요청에서 승인해야 반영됩니다.",
          "삭제(무효): 관리자는 수정 창의 '삭제(무효)'로 잘못된 기록을 무효 처리합니다. 데이터는 보존되고 집계·이력에서만 제외됩니다.",
        ],
      },
      {
        n: "5",
        title: "차량 관리 (관리자)",
        bullets: [
          "차량 추가: 우측 상단 '+ 차량 추가'. 추가 즉시 주유 입력에서 선택 가능.",
          "수정: 각 행의 '수정' 버튼.",
          "CSV 일괄 등록: 'CSV 양식'을 받아 채운 뒤 'CSV 등록'으로 여러 대 한 번에(관리번호 기준).",
          "운행/미운행: 안 쓰는 차량은 삭제 대신 '미운행'. 과거 기록은 보존됩니다.",
        ],
      },
      {
        n: "?",
        title: "자주 묻는 질문",
        bullets: [
          "'날씨 정보 없음' → 일시적 문제. 잠시 후 새로고침.",
          "저장이 안 됨 → 주유량이 0보다 큰지·필수 항목 확인. 안 되면 인터넷 확인.",
          "발전기 등 주행거리 없는 장비 → 디젤 선택 시 주유량만 입력.",
          "화면이 예전 그대로 → 새로고침(휴대폰 당겨서, PC Ctrl+Shift+R).",
        ],
      },
    ],
  },
  en: {
    title: "User Guide",
    lede: "Record refueling of site vehicles and equipment, and review usage by day, week and month. Works on both mobile and PC.",
    url: "fuel-tracking-lyart.vercel.app",
    sections: [
      {
        n: "1",
        title: "Getting Started",
        steps: [
          { st: "Open the web address", de: "Open the app URL in a phone or PC browser." },
          { st: "Add to home screen (optional)", de: "Browser menu → 'Add to Home Screen' to use it like an app." },
          { st: "Choose a language", de: "Top-right 🌐 : Korean / English / বাংলা. Your choice is remembered." },
        ],
      },
      {
        n: "2",
        title: "Fuel Entry (most important)",
        intro: "The key is to choose the fuel type first. The fields change based on it.",
        steps: [
          { st: "Bottom 'Fuel' tab (mobile) or 'Fuel Entry' on the left (PC)" },
          { st: "Select fuel type — Diesel or Gasoline", de: "Only vehicles of that fuel type appear." },
          { st: "Select vehicle / equipment", de: "Search by part of the number. Control No., driver, team, type, capacity fill automatically." },
          { st: "Enter Fuel Volume (L)", de: "Diesel: volume only. Gasoline: also current mileage (km); distance auto-calculated." },
          { st: "Save", de: "'Fuel record saved successfully' means done. Dashboard updates immediately." },
        ],
        bullets: [
          "Other Refuel: pick 'Other Refuel' at the top of the list instead of a vehicle, then enter volume + reason only (for small generators/machines, jerry-can refuels).",
          "Diesel trucks (Cargo, Dump, Mini Cargo, Water Truck, Box Car) also need mileage (km). Excavators, loaders, Bobcat and generators are volume-only.",
          "Broken odometer: if mileage cannot be entered, an admin grants a one-time exemption in Vehicles; that vehicle can then be entered with volume only (revocable after repair).",
        ],
        note: "Mileage warning: if current mileage is lower than previous, saving is blocked. Only an admin can save as an exception.",
      },
      {
        n: "3",
        title: "Reading the Dashboard",
        bullets: [
          "Weather (top): current site (Baghdad) weather + 7-day forecast (temp, rain, wind).",
          "KPIs: transactions, volume, total distance, average volume, active vehicles.",
          "Charts: daily/weekly/monthly and by part/vehicle/driver. Values shown on each bar.",
          "Filters: period, fuel type, part, vehicle, driver. Changing them updates KPIs and charts together.",
        ],
      },
      {
        n: "4",
        title: "History · Search · Export",
        bullets: [
          "History: newest first. Table on PC, cards on mobile.",
          "Search: find by part of vehicle no., control no., driver, part or type.",
          "CSV: download the current list as a spreadsheet.",
          "Print/PDF: Print button → choose 'Save as PDF'. No cost information included.",
          "Edit records (admin): top-right 🔒 Admin Edit → enter PIN, then use each row's 'Edit' button to fix volume, mileage or remarks. Admin only.",
          "Request edit (entrant): if you entered something wrong, use the 'Request Edit' button on that row. It applies only after an admin approves it (📥 Edit Requests).",
          "Delete (void, admin): in the edit dialog use 'Delete (void)' to void a wrong record. Data is preserved; it is only excluded from totals and history.",
        ],
      },
      {
        n: "5",
        title: "Vehicle Management (admin)",
        bullets: [
          "Add vehicle: top-right '+ Add Vehicle'. Immediately selectable in Fuel Entry.",
          "Edit: the 'Edit' button on each row.",
          "Bulk CSV import: download 'CSV Template', fill it, then 'Import CSV' (matched by control no.).",
          "Active/Inactive: instead of deleting, set unused vehicles Inactive. Past records are kept.",
        ],
      },
      {
        n: "?",
        title: "FAQ / Troubleshooting",
        bullets: [
          "'Weather unavailable' → temporary issue; refresh in a moment.",
          "Can't save → check volume > 0 and required fields. If it still fails, check internet.",
          "Equipment with no mileage (generators) → choose Diesel; only volume needed.",
          "Screen looks old → refresh (mobile: pull down; PC: Ctrl+Shift+R).",
        ],
      },
    ],
  },
  bn: {
    title: "ব্যবহার নির্দেশিকা",
    lede: "সাইটের যানবাহন ও সরঞ্জামের জ্বালানি রেকর্ড করুন এবং দৈনিক·সাপ্তাহিক·মাসিক ব্যবহার দেখুন। মোবাইল ও পিসি উভয়েই চলে।",
    url: "fuel-tracking-lyart.vercel.app",
    sections: [
      {
        n: "1",
        title: "শুরু করা",
        steps: [
          { st: "ওয়েব ঠিকানা খুলুন", de: "মোবাইল বা পিসি ব্রাউজারে অ্যাপের ঠিকানা খুলুন।" },
          { st: "হোম স্ক্রিনে যোগ করুন (ঐচ্ছিক)", de: "ব্রাউজার মেনু → 'Add to Home Screen'।" },
          { st: "ভাষা নির্বাচন", de: "উপরে ডানদিকে 🌐 :한국어 / English / বাংলা। পছন্দ মনে রাখা হয়।" },
        ],
      },
      {
        n: "2",
        title: "জ্বালানি এন্ট্রি (সবচেয়ে গুরুত্বপূর্ণ)",
        intro: "প্রথমে জ্বালানির ধরন নির্বাচন করাই মূল বিষয়। ধরন অনুযায়ী ঘর বদলায়।",
        steps: [
          { st: "নিচের 'জ্বালানি' ট্যাব (মোবাইল) বা বাঁয়ে 'জ্বালানি এন্ট্রি' (পিসি)" },
          { st: "জ্বালানির ধরন — ডিজেল বা পেট্রোল", de: "শুধু সেই ধরনের যানবাহন তালিকায় আসে।" },
          { st: "যানবাহন নির্বাচন", de: "নম্বরের অংশ লিখে খুঁজুন। কন্ট্রোল নং·চালক·টিম·ধরন·ক্ষমতা স্বয়ংক্রিয়ভাবে দেখায়।" },
          { st: "জ্বালানির পরিমাণ (L) দিন", de: "ডিজেল: শুধু পরিমাণ। পেট্রোল: বর্তমান মাইলেজও (km); দূরত্ব স্বয়ংক্রিয়।" },
          { st: "সংরক্ষণ", de: "'সফলভাবে সংরক্ষিত' দেখালে শেষ। ড্যাশবোর্ডে সাথে সাথে দেখায়।" },
        ],
        bullets: [
          "অন্যান্য জ্বালানি: যানবাহনের বদলে তালিকার উপরে 'অন্যান্য জ্বালানি' বেছে নিয়ে শুধু পরিমাণ + কারণ লিখে সংরক্ষণ (ছোট জেনারেটর/মেশিনের জন্য)।",
          "ডিজেল ট্রাক (কার্গো·ডাম্প·মিনি কার্গো·ওয়াটার ট্রাক·বক্স কার) মাইলেজও (km) লাগে। এক্সকাভেটর·লোডার·ববক্যাট·জেনারেটর শুধু পরিমাণ।",
          "মিটার নষ্ট: মাইলেজ দেওয়া না গেলে অ্যাডমিন একবার 'ছাড় অনুমোদন' দিলে সেই যানবাহন শুধু পরিমাণ দিয়েই এন্ট্রি করা যায় (মেরামতের পর বাতিল করা যায়)।",
        ],
        note: "মাইলেজ সতর্কতা: বর্তমান মাইলেজ আগেরটির চেয়ে কম হলে সংরক্ষণ আটকে যায়। শুধু অ্যাডমিন ব্যতিক্রম করতে পারেন।",
      },
      {
        n: "3",
        title: "ড্যাশবোর্ড দেখা",
        bullets: [
          "আবহাওয়া (উপরে): বর্তমান (বাগদাদ) + ৭ দিনের পূর্বাভাস।",
          "KPI: লেনদেন·পরিমাণ·মোট দূরত্ব·গড় পরিমাণ·সক্রিয় যানবাহন।",
          "চার্ট: দৈনিক/সাপ্তাহিক/মাসিক এবং পার্ট/যানবাহন/চালক অনুযায়ী।",
          "ফিল্টার: সময়কাল·জ্বালানি·পার্ট·যানবাহন·চালক। বদলালে KPI ও চার্ট একসাথে বদলায়।",
        ],
      },
      {
        n: "4",
        title: "ইতিহাস · অনুসন্ধান · এক্সপোর্ট",
        bullets: [
          "ইতিহাস: নতুন আগে। পিসিতে টেবিল, মোবাইলে কার্ড।",
          "অনুসন্ধান: যানবাহন·কন্ট্রোল নং·চালক·পার্ট·ধরন দিয়ে।",
          "CSV: বর্তমান তালিকা স্প্রেডশিট হিসেবে ডাউনলোড।",
          "প্রিন্ট/PDF: প্রিন্ট → 'Save as PDF'। কোনো খরচের তথ্য নেই।",
          "রেকর্ড সম্পাদনা (অ্যাডমিন): উপরে ডানে 🔒 → পিন দিয়ে প্রতিটি রেকর্ডের 'সম্পাদনা' বোতামে পরিমাণ·মাইলেজ·মন্তব্য ঠিক করুন। শুধু অ্যাডমিন।",
          "সম্পাদনার অনুরোধ: ভুল হলে রেকর্ডের 'সম্পাদনার অনুরোধ' বোতামে পাঠান। অ্যাডমিন অনুমোদন করলে (📥) তবেই প্রযোজ্য হয়।",
          "মুছুন (বাতিল, অ্যাডমিন): সম্পাদনা উইন্ডোতে 'মুছুন (বাতিল)' দিয়ে ভুল রেকর্ড বাতিল করুন। ডেটা থাকে, শুধু হিসাব থেকে বাদ যায়।",
        ],
      },
      {
        n: "5",
        title: "যানবাহন ব্যবস্থাপনা (অ্যাডমিন)",
        bullets: [
          "যোগ: উপরে ডানে '+ যানবাহন যোগ করুন'। সাথে সাথে এন্ট্রিতে পাওয়া যায়।",
          "সম্পাদনা: প্রতিটি সারির 'সম্পাদনা' বোতাম।",
          "CSV ইম্পোর্ট: 'CSV টেমপ্লেট' পূরণ করে 'CSV ইম্পোর্ট' (কন্ট্রোল নং অনুযায়ী)।",
          "সক্রিয়/নিষ্ক্রিয়: অব্যবহৃত যানবাহন মুছবেন না, নিষ্ক্রিয় করুন। পুরোনো রেকর্ড থাকে।",
        ],
      },
      {
        n: "?",
        title: "সাধারণ প্রশ্ন",
        bullets: [
          "'আবহাওয়া তথ্য নেই' → সাময়িক; একটু পরে রিফ্রেশ।",
          "সংরক্ষণ হয় না → পরিমাণ > 0 ও প্রয়োজনীয় ঘর দেখুন; না হলে ইন্টারনেট দেখুন।",
          "মাইলেজবিহীন সরঞ্জাম (জেনারেটর) → ডিজেল নিন; শুধু পরিমাণ।",
          "পুরোনো স্ক্রিন → রিফ্রেশ (মোবাইল: টেনে; পিসি: Ctrl+Shift+R)।",
        ],
      },
    ],
  },
};

export function HelpContent() {
  const { lang } = useI18n();
  const m = MANUAL[lang];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{m.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-600">{m.lede}</p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-neutral-border bg-white px-3 py-1.5 text-sm">
          🔗 <span className="tabular font-semibold text-hanwha-deep" style={{ color: "#d95e10" }}>{m.url}</span>
        </div>
      </div>

      {m.sections.map((s) => (
        <Card key={s.n} className="p-5">
          <div className="mb-3 flex items-center gap-3">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-hanwha/10 text-sm font-extrabold text-hanwha">
              {s.n}
            </span>
            <h2 className="text-lg font-bold">{s.title}</h2>
          </div>

          {s.intro && <p className="mb-3 text-sm text-gray-600">{s.intro}</p>}

          {s.steps && (
            <ol className="space-y-2.5">
              {s.steps.map((st, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full bg-hanwha text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <div className="font-semibold text-gray-900">{st.st}</div>
                    {st.de && <div className="text-sm text-gray-600">{st.de}</div>}
                  </div>
                </li>
              ))}
            </ol>
          )}

          {s.bullets && (
            <ul className="ml-1 space-y-1.5">
              {s.bullets.map((b, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="text-hanwha">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          {s.note && (
            <div className="mt-3 flex gap-2 rounded-lg bg-warning/10 p-3 text-sm text-warning">
              <span>⚠️</span>
              <span>{s.note}</span>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
