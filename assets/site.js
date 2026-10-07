/*
 * 시민활동통합지원단 홈페이지 - 공통 스크립트
 * 헤더/푸터를 여기 한 곳에서만 관리하면 모든 페이지에 반영됨 (유지관리 목적)
 *
 * [ERP 연동 안내] 2026-10-03부터 데이터베이스는 Supabase(프로젝트 acais-erp, 서울).
 * 공개 페이지는 아래 window.Api 가 REST 로 직접 부르고, 직원 화면(운영관리자·단톡·전자결재)은 assets/sb.js 를 쓴다.
 * (그 전에는 Google Sheets + Apps Script — apps-script/ 폴더, 예비로 남겨 둠)
 */

const CONFIG = {
  // ERP 데이터 시트: https://docs.google.com/spreadsheets/d/1G1C1Xvn13Fqi_S-6uTcmQ4u4j3IURx1TIKXg3oMoGsQ/edit
  // 위 시트에서 Apps Script(apps-script/Code.gs)를 배포한 뒤, 그 웹앱 URL을 아래에 입력하면
  // useMock 값과 상관없이 자동으로 실제 데이터로 전환됩니다.
  API_BASE: "https://script.google.com/macros/s/AKfycbymsLGlQ04MZPDrMO8K9wCpQmaVY-SBWSO3zJIpYHM8EWnyaj7taTjCSWadnqz9EQXo/exec",
  // 2026-10-03부터 실제 데이터는 Supabase 에 있다. (API_BASE 는 예전 Apps Script 백업 — 옮겨 가는 동안만 남겨 둠)
  // 공개용(publishable) 키라 홈페이지에 있어도 된다. 무엇을 읽고 쓸 수 있는지는 데이터베이스 규칙(RLS)이 정한다.
  SUPABASE_URL: "https://vwobpxyqsiynlybasnek.supabase.co",
  SUPABASE_KEY: "sb_publishable_eujFGfxRNaVQ3TKtg3iWMw_9OohMjZo",
  useMock: false,
  orgName: "시민활동통합지원단",
  orgNameShort: "지원단",
};
CONFIG.useMock = CONFIG.useMock || !CONFIG.SUPABASE_URL;

const NAV_ITEMS = [
  { key: "intro", label: "지원단소개", href: "intro.html" },
  { key: "centers", label: "센터별안내", href: "centers.html" },
  { key: "notice", label: "소식·참여", href: "notice.html" },
  { key: "reservation", label: "공간대관", href: "reservation.html" },
  { key: "disclosure", label: "정보공개", href: "disclosure.html" },
];

const MOCK_CENTERS = [
  { key: "public", name: "공익활동지원센터", desc: "시민 공익활동 발굴·지원", icon: "🤝" },
  { key: "village", name: "마을공동체지원센터", desc: "마을공동체 형성·활성화", icon: "🏘️" },
  { key: "social", name: "사회적경제지원센터", desc: "사회적경제 조직 성장지원", icon: "🌱" },
  { key: "rural", name: "도농교류지원센터", desc: "도시-농촌 교류·상생", icon: "🚜" },
  { key: "regen", name: "도시재생지원센터", desc: "지역 도시재생 사업 추진", icon: "🏙️" },
];

const MOCK_NOTICES = [
  { id: 1, cat: "공지사항", title: "2026년 하반기 마을공동체 활성화 프로그램 참여자 모집", date: "2026-09-15", body: "안성시 시민활동통합지원단에서는 2026년 하반기 마을공동체 활성화 프로그램에 참여할 주민을 모집합니다.\n\n대상: 안성시 거주 주민 누구나\n신청기간: 2026.09.15 ~ 09.30\n문의: 마을공동체지원센터" },
  { id: 2, cat: "사회적경제", title: "2026 더 좋은소비 페스타 in 안성 참여기업 모집 공고", date: "2026-09-12", body: "사회적경제 나눔장터 「2026 더 좋은소비 페스타 in 안성」에 참여할 기업을 모집합니다. 자세한 내용은 첨부파일을 참고해 주세요." },
  { id: 3, cat: "교육·행사", title: "공익 ON 스쿨 4기 교육생 모집 안내", date: "2026-09-05", body: "공익활동 역량 강화를 위한 「공익 ON 스쿨」 4기 교육생을 모집합니다." },
  { id: 4, cat: "보도자료", title: "동막마을 한승택 활동가, 행복농촌 만들기 콘테스트 금상 수상", date: "2026-09-14", body: "안성시 죽산면 동막마을 한승택 활동가가 제13회 행복농촌 만들기 콘테스트에서 우수활동가 분야 금상을 수상했습니다." },
  { id: 5, cat: "공지사항", title: "가치공도 공동체 거점공간 정기 휴관 안내", date: "2026-09-01", body: "가치공도 공동체 거점공간의 정기 휴관일을 안내드립니다. 매주 월요일은 휴관입니다." },
];

const MOCK_SPACES = [
  { key: "hall_large", name: "공유공간 대회의실", cap: "최대 40명" },
  { key: "hall_small", name: "공유공간 소회의실", cap: "최대 12명" },
  { key: "media", name: "미디어창작실", cap: "최대 8명" },
];

const MOCK_SUGGESTIONS = [
  { id: 3, date: "2026-09-14", isPublic: true, status: "답변완료", answered: true, title: "마을공동체 프로그램 신청 방법이 궁금합니다", name: "김*수", content: "하반기 마을공동체 활성화 프로그램에 참여하고 싶은데, 신청은 어디로 하면 될까요?", answer: "안녕하세요. 마을공동체지원센터(031-000-0000)로 전화 주시거나 공지사항에 안내된 신청서를 작성해 접수해 주시면 됩니다. 감사합니다." },
  { id: 2, date: "2026-09-10", isPublic: false, status: "접수", answered: false, title: "🔒 비공개 문의", name: "" },
  { id: 1, date: "2026-09-02", isPublic: true, status: "접수", answered: false, title: "공유공간 대회의실 주차 공간 문의", name: "이*", content: "대회의실 대관 시 주차 가능한 공간이 있는지 궁금합니다.", answer: "" },
];

function renderHeader(activeKey) {
  const gnb = NAV_ITEMS.map(item =>
    `<a href="${item.href}" class="${item.key === activeKey ? "active" : ""}">${item.label}</a>`
  ).join("");

  // ERP 지도에서 들어온 직원에게만 "ERP로 돌아가기" 링크를 보여줌 (일반 방문자에게는 노출되지 않음)
  let fromErp = false;
  try { fromErp = sessionStorage.getItem("fromErp") === "1"; } catch (e) {}
  const erpBack = fromErp
    ? `<a href="../erp-map.html" style="margin-right:auto; font-weight:700; opacity:1;">← ERP 지도로 돌아가기</a>`
    : "";

  return `
  <div class="utility-bar">
    <div class="wrap">
      ${erpBack}
      <a href="https://www.anseong.go.kr" target="_blank" rel="noopener">안성시청 바로가기</a>
      <a href="suggestion.html">지원단에 바란다</a>
    </div>
  </div>
  <header class="site-header">
    <div class="wrap header-inner">
      <a href="index.html" class="logo">
        <span class="badge">시</span>
        ${CONFIG.orgName}
      </a>
      <nav class="gnb">${gnb}</nav>
    </div>
  </header>`;
}

function renderFooter() {
  return `
  <footer class="site-footer">
    <div class="wrap">
      <div class="foot-top">
        <div class="links">
          <a href="#">개인정보처리방침</a>
          <a href="#">이메일무단수집거부</a>
          <a href="disclosure.html">정보공개</a>
          <a href="https://www.anseong.go.kr" target="_blank" rel="noopener">관련기관</a>
        </div>
      </div>
      <div>
        ${CONFIG.orgName} · 경기도 안성시 고수2로 17 · 대표전화 031-678-0782<br>
        Copyright &copy; ${CONFIG.orgName}. All rights reserved.
      </div>
    </div>
  </footer>`;
}

function mountLayout(activeKey) {
  const headerMount = document.getElementById("site-header-mount");
  const footerMount = document.getElementById("site-footer-mount");
  if (headerMount) headerMount.innerHTML = renderHeader(activeKey);
  if (footerMount) footerMount.innerHTML = renderFooter();
}

/*
 * window.Api로 선언(= const 아님): 다른 스크립트가 나중에 window.Api를
 * 교체할 가능성을 열어두기 위함 (const로 선언하면 다른 <script> 태그가
 * 참조하는 "Api"가 최초 선언에 고정되어 재할당이 무시되는 문제가 있었음).
 *
 * 공개 홈페이지는 로그인이 없으므로 supabase-js 없이 REST 로 바로 부른다.
 * 실패하면 { ok:false, message } 를 돌려준다 (화면이 「접수됨」으로 잘못 보이지 않게).
 */
async function sbRest(path, opt) {
  const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${path}`, Object.assign({}, opt, {
    headers: Object.assign({ apikey: CONFIG.SUPABASE_KEY, "Content-Type": "application/json" }, (opt || {}).headers),
  }));
  if (!res.ok) {
    let msg = "";
    try { msg = (await res.json()).message || ""; } catch (e) {}
    throw new Error(msg || ("HTTP " + res.status));
  }
  return res.status === 204 || res.status === 201 ? null : res.json();
}
function failMsg(e) {
  const m = (e && e.message) || "";
  if (/Failed to fetch|NetworkError/i.test(m)) return "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  if (/check constraint|violates/i.test(m)) return "입력한 내용을 다시 확인해 주세요. (필수 칸, 시간 순서 등)";
  return "처리하지 못했습니다: " + m;
}

window.Api = {
  async getNotices() {
    if (CONFIG.useMock) return MOCK_NOTICES;
    const rows = await sbRest("notices?select=id,category,title,body,posted_on&published=eq.true&order=posted_on.desc,id.desc");
    return rows.map(n => ({ id: n.id, cat: n.category, title: n.title, body: n.body, date: n.posted_on }));
  },
  async getSpaces() {
    if (CONFIG.useMock) return MOCK_SPACES;
    const rows = await sbRest("spaces?select=key,name,capacity&order=sort");
    return rows.map(s => ({ key: s.key, name: s.name, cap: s.capacity }));
  },
  async getSuggestions() {
    if (CONFIG.useMock) return MOCK_SUGGESTIONS;
    const rows = await sbRest("rpc/public_suggestions", { method: "POST", body: "{}" });
    return rows.map(s => ({
      id: s.id, date: s.posted_on, isPublic: s.is_public, status: s.status, answered: s.answered,
      title: s.title, name: s.name, content: s.content || "", answer: s.answer || "",
    }));
  },
  async submitReservation(p) {
    if (CONFIG.useMock) {
      console.log("[MOCK] 대관신청 제출:", p);
      return { ok: true, message: "(모의 제출)" };
    }
    try {
      await sbRest("reservations", {
        method: "POST", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          space_key: p.space, use_date: p.date, start_time: p.start, end_time: p.end,
          applicant: p.name, phone: p.phone, email: p.email || "",
          people: p.people ? Number(p.people) : null, purpose: p.purpose || "",
        }),
      });
      return { ok: true, message: "담당 센터에서 확인 후 승인 여부를 안내드립니다." };
    } catch (e) { return { ok: false, message: failMsg(e) }; }
  },
  async submitSuggestion(p) {
    if (CONFIG.useMock) {
      console.log("[MOCK] 건의사항 제출:", p);
      return { ok: true, message: "(모의 제출)" };
    }
    try {
      await sbRest("suggestions", {
        method: "POST", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          name: p.name, phone: p.phone || "", email: p.email || "",
          title: p.title, content: p.content, is_public: !!p.isPublic,
        }),
      });
      return { ok: true, message: "소중한 의견 감사합니다. 담당자가 확인 후 답변드립니다." };
    } catch (e) { return { ok: false, message: failMsg(e) }; }
  },
};
