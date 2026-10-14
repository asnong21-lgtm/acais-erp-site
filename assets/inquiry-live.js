/*
 * 운영관리자 「문의 대장」·「고객 대장」 — 홈페이지 「문의하기」로 들어온 진짜 문의를 보여 준다.
 * 문의는 별도 Supabase 프로젝트(acais-inquiry)에 있고, 직원 로그인은 acais-erp 에 있다.
 * 그래서 Edge Function `inquiry-admin`(supabase/functions/inquiry-admin)이 acais-erp 로그인(단장·사무국)을
 * 확인한 뒤에만 읽고/고쳐 준다. (연습용 대장은 ERP 지도 안의 화면 — assets/ledger.js)
 * 앞에 site.js · sb.js 가 먼저 로드돼 있어야 한다. admin.html 의 enter() 가 window.loadInquiryLedger(me) 를 부른다.
 */
(function () {
  const SRC = { search: "검색", map: "지도", referral: "지인 소개", sns: "SNS", phone: "전화", other: "기타", unknown: "모르겠음" };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const day = ts => ts ? new Date(ts).toLocaleDateString("sv-SE") : "";
  const fmtPhone = p => {
    const d = String(p || "");
    return d.length === 11 ? d.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3") : d.length === 10 ? d.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3") : d;
  };
  const srcName = v => SRC[v] || v || "";
  const num = (p, id) => p + "-" + String(id).padStart(4, "0");
  const fnUrl = () => (window.CONFIG && CONFIG.INQUIRY_URL ? CONFIG.INQUIRY_URL : "https://rpmxsuvbmlgxikrpapsj.supabase.co") + "/functions/v1/inquiry-admin";

  let box1, box2, data = null;
  const open = {};

  async function call(body) {
    const { data: { session } } = await window.sb.auth.getSession();
    if (!session) throw new Error("로그인이 필요합니다.");
    const r = await fetch(fnUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
      body: JSON.stringify(body),
    });
    let j;
    try { j = await r.json(); } catch (e) { throw new Error("서버 응답을 읽지 못했습니다."); }
    if (!j.ok) throw new Error(j.message || "요청에 실패했습니다.");
    return j;
  }

  const resultBadge = r => r === "계약" ? '<span class="lg-badge done">계약</span>'
    : r === "보류" ? '<span class="lg-badge hold">보류</span>'
    : r === "실패" ? '<span class="lg-badge fail">실패</span>'
    : '<span class="lg-badge missing">미입력</span>';

  function summary() {
    const rows = data.inquiries, n = rows.length, miss = rows.filter(r => !r.result).length;
    const ym = new Date().toLocaleDateString("sv-SE").slice(0, 7);
    const month = rows.filter(r => day(r.created_at).slice(0, 7) === ym).length;
    return '<div class="lg-summary">'
      + '<div class="lg-stat"><b>' + data.customers.length + '명</b><span>고객</span></div>'
      + '<div class="lg-stat"><b>' + n + '건</b><span>전체 문의</span></div>'
      + '<div class="lg-stat"><b>' + month + '건</b><span>이번 달(' + ym + ') 접수</span></div>'
      + '<div class="lg-stat warn"><b>' + miss + '건</b><span>계약 결과 미입력' + (n ? " · 전체의 " + Math.round(miss / n * 100) + "%" : "") + '</span></div></div>';
  }

  function sel(id, field, opts, cur, blank) {
    return '<select data-id="' + id + '" data-field="' + field + '">'
      + (blank ? '<option value=""' + (cur ? "" : " selected") + ">" + blank + "</option>" : "")
      + opts.map(o => "<option" + (o === cur ? " selected" : "") + ">" + o + "</option>").join("")
      + "</select>";
  }

  function inquiryRow(r) {
    return "<tr>"
      + "<td>" + day(r.created_at) + "</td>"
      + "<td>" + esc(r.name) + '<span class="lg-sub">고객 ' + num("C", r.customer_id) + " · " + num("Q", r.id) + "</span></td>"
      + "<td>" + esc(fmtPhone(r.phone)) + "</td>"
      + "<td>" + esc(r.product) + (r.message ? '<span class="lg-sub" style="white-space:pre-wrap; max-width:260px;">' + esc(r.message) + "</span>" : "") + "</td>"
      + "<td>" + esc(srcName(r.source)) + "</td>"
      + "<td>" + sel(r.id, "stage", ["접수", "연락중", "상담완료"], r.stage) + "</td>"
      + "<td>" + sel(r.id, "result", ["계약", "보류", "실패"], r.result, "— 미입력") + " " + resultBadge(r.result) + "</td></tr>";
  }

  function customerRows(by) {
    if (!data.customers.length) return '<tr><td class="lg-empty" colspan="6">아직 고객이 없습니다.</td></tr>';
    return data.customers.map(c => {
      const list = by[c.id] || [], contracts = list.filter(r => r.result === "계약").length, isOpen = open[c.id];
      let h = '<tr class="lg-cust-row" data-cid="' + c.id + '"><td><button type="button" class="lg-toggle">' + (isOpen ? "▾" : "▸") + "</button>" + num("C", c.id) + "</td>"
        + "<td>" + esc(c.name) + "</td><td>" + esc(fmtPhone(c.phone)) + '</td><td><span class="lg-badge first">' + esc(srcName(c.first_source)) + "</span></td>"
        + "<td>" + list.length + '건</td><td class="' + (contracts ? "lg-num-pos" : "lg-num0") + '">' + contracts + "건</td></tr>";
      if (isOpen) {
        h += '<tr class="lg-detail"><td colspan="6"><div class="lg-note">「처음 알게 된 경로」는 첫 문의 때의 경로로 고정이고, 아래 문의의 경로는 문의마다 따로 남습니다.</div>'
          + '<table class="lg-small"><thead><tr><th>문의번호</th><th>접수일</th><th>그때의 경로</th><th>관심 서비스</th><th>응대 단계</th><th>계약 결과</th></tr></thead><tbody>'
          + list.map(r => "<tr><td>" + num("Q", r.id) + "</td><td>" + day(r.created_at) + "</td><td>" + esc(srcName(r.source)) + "</td><td>" + esc(r.product) + "</td><td>" + esc(r.stage) + "</td><td>" + resultBadge(r.result) + "</td></tr>").join("")
          + "</tbody></table></td></tr>";
      }
      return h;
    }).join("");
  }

  function render() {
    if (!data) return;
    const sum = summary(), rows = data.inquiries;
    box1.innerHTML = '<div class="lg-practice" style="background:#eaf7f4; border-color:#bfe3da;"><b>실제 문의</b>입니다. 홈페이지 「문의하기」로 들어온 내용이 그대로 보이며, 단장·사무국만 볼 수 있습니다. 응대 단계·계약 결과는 여기서 바꿀 수 있습니다. 문의는 접수 후 1년이 지나면 자동으로 지워집니다. '
      + '<button type="button" class="lg-clear" id="lgl-reload" style="margin-left:8px;">↻ 새로고침</button></div>'
      + sum
      + '<div class="lg-panel"><h2>문의 대장 (' + rows.length + '건)</h2><div class="lg-wrap"><table>'
      + "<thead><tr><th>접수일</th><th>이름</th><th>연락처</th><th>관심 서비스</th><th>경로</th><th>응대 단계</th><th>계약 결과</th></tr></thead><tbody>"
      + (rows.length ? rows.map(inquiryRow).join("") : '<tr><td class="lg-empty" colspan="7">아직 들어온 문의가 없습니다.</td></tr>')
      + "</tbody></table></div></div>";

    const by = {};
    rows.forEach(r => { (by[r.customer_id] = by[r.customer_id] || []).push(r); });
    box2.innerHTML = sum
      + '<div class="lg-panel"><h2>고객 대장 <span style="font-weight:400; font-size:12px; color:var(--sub);">— 같은 연락처는 한 분으로 묶습니다 (줄을 누르면 문의가 펼쳐집니다)</span></h2><div class="lg-wrap"><table class="lg-cust">'
      + "<thead><tr><th>고객번호</th><th>이름</th><th>연락처</th><th>처음 알게 된 경로</th><th>문의 건수</th><th>계약 건수</th></tr></thead><tbody>"
      + customerRows(by) + "</tbody></table></div></div>";
  }

  async function reload(quiet) {
    if (!quiet) box1.innerHTML = box2.innerHTML = '<p style="color:var(--sub); padding:12px;">불러오는 중...</p>';
    try { data = await call({ action: "list" }); render(); }
    catch (e) { box1.innerHTML = box2.innerHTML = '<p style="color:#c4301c; padding:12px;">' + esc(e.message) + "</p>"; }
  }

  function bind() {
    box1.addEventListener("click", e => { if (e.target.id === "lgl-reload") reload(); });
    box1.addEventListener("change", async e => {
      const s = e.target;
      if (!s.dataset || !s.dataset.field) return;
      const body = { action: "update", id: Number(s.dataset.id) };
      body[s.dataset.field] = s.dataset.field === "result" && !s.value ? null : s.value;
      try { await call(body); await reload(true); } catch (err) { alert(err.message); reload(true); }
    });
    box2.addEventListener("click", e => {
      const tr = e.target.closest(".lg-cust-row");
      if (!tr) return;
      open[tr.dataset.cid] = !open[tr.dataset.cid];
      render();
    });
  }

  window.loadInquiryLedger = function (me) {
    box1 = document.getElementById("tab-inq");
    box2 = document.getElementById("tab-cust");
    if (!box1 || !box2) return;
    box1.classList.add("lg");
    box2.classList.add("lg");
    if (!me || !["owner", "office"].includes(me.role)) {
      box1.innerHTML = box2.innerHTML = '<p style="color:var(--sub); padding:12px;">문의 대장·고객 대장은 단장·사무국만 볼 수 있습니다.</p>';
      return;
    }
    if (!box1.dataset.bound) { box1.dataset.bound = "1"; bind(); }
    reload();
  };
})();
