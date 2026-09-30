/*
 * 시민활동통합지원단 홈페이지 - 공통 스크립트
 * 헤더/푸터를 여기 한 곳에서만 관리하면 모든 페이지에 반영됨 (유지관리 목적)
 *
 * [ERP 연동 안내] Google Sheets + Apps Script(apps-script/Code.gs)를 데이터베이스로 사용.
 * (Firebase는 Google 계정 2단계 인증 요구로 관리가 막혀 이 방식으로 전환함)
 * 배포된 Apps Script 웹앱 URL을 CONFIG.API_BASE에 넣으면 자동으로 실데이터 모드로 전환됨.
 */

const CONFIG = {
  // ERP 데이터 시트: https://docs.google.com/spreadsheets/d/1G1C1Xvn13Fqi_S-6uTcmQ4u4j3IURx1TIKXg3oMoGsQ/edit
  // 위 시트에서 Apps Script(apps-script/Code.gs)를 배포한 뒤, 그 웹앱 URL을 아래에 입력하면
  // useMock 값과 상관없이 자동으로 실제 데이터로 전환됩니다.
  API_BASE: "https://script.google.com/macros/s/AKfycbymsLGlQ04MZPDrMO8K9wCpQmaVY-SBWSO3zJIpYHM8EWnyaj7taTjCSWadnqz9EQXo/exec",
  useMock: false,
  orgName: "시민활동통합지원단",
  orgNameShort: "지원단",
};
CONFIG.useMock = CONFIG.useMock || !CONFIG.API_BASE;

const NAV_ITEMS = [
  { key: "intro", label: "지원단소개", href: "index.html#intro" },
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
        ${CONFIG.orgName} · 경기도 안성시 시청길 25(봉산동) · 대표전화 031-678-2114<br>
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
 */
window.Api = {
  async getNotices() {
    if (CONFIG.useMock) return MOCK_NOTICES;
    const res = await fetch(`${CONFIG.API_BASE}?action=notices`);
    return res.json();
  },
  async getSpaces() {
    if (CONFIG.useMock) return MOCK_SPACES;
    const res = await fetch(`${CONFIG.API_BASE}?action=spaces`);
    return res.json();
  },
  async getSuggestions() {
    if (CONFIG.useMock) return MOCK_SUGGESTIONS;
    const res = await fetch(`${CONFIG.API_BASE}?action=suggestions`);
    return res.json();
  },
  async submitReservation(payload) {
    if (CONFIG.useMock) {
      console.log("[MOCK] 대관신청 제출:", payload);
      return { ok: true, message: "(모의 제출) 실제 배포 시 공간예약 시트에 기록됩니다." };
    }
    const res = await fetch(`${CONFIG.API_BASE}?action=submitReservation`, {
      method: "POST",
      // Content-Type을 text/plain으로 두면 Apps Script 웹앱 호출 시 브라우저의
      // CORS 사전요청(preflight)이 발생하지 않음. Code.gs는 내용만 JSON으로 파싱함.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    return res.json();
  },
  async submitSuggestion(payload) {
    if (CONFIG.useMock) {
      console.log("[MOCK] 건의사항 제출:", payload);
      return { ok: true, message: "(모의 제출) 실제 배포 시 건의민원관리 시트에 기록됩니다." };
    }
    const res = await fetch(`${CONFIG.API_BASE}?action=submitSuggestion`, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    return res.json();
  },
};
