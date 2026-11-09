/*
 * 공동체 성장·성과관리 화면 (site/community.html)
 *  - 수파베이스 acais-erp 의 표(017_community_growth.sql)를 읽고 쓴다. 보는 범위·고칠 수 있는 범위는 DB(RLS·트리거)가 정한다 — 이 화면은 보여 주기만 한다.
 *  - 역할: owner/office(단장·사무국) · center(센터 담당) · community(공동체 담당자) · viewer(보고서 열람자)
 *  - 공동체 순위·점수 줄세우기 화면은 만들지 않는다(공동체별 변화와 단계 분포만 본다).
 */
(function () {
  "use strict";
  const $ = (s, r) => (r || document).querySelector(s);
  const E = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const NOW = new Date().getFullYear();
  const LOCKED = ["제출", "검토중", "확정"];
  const CENTERS = { "": "미지정", public: "공공", village: "마을", social: "사회", rural: "농촌", regen: "도시재생" };
  const ROLE_LABEL = { owner: "단장", office: "사무국", center: "센터 담당", community: "공동체 담당자", viewer: "보고서 열람자" };
  const STATUS_LABEL = { ACTIVE: "활동중", DORMANT: "휴면", CLOSED: "종료" };
  const S = { uid: null, name: "", role: null, center: "", year: NOW, codes: {}, comms: [], subs: {}, view: "home", cid: null, tab: "overview", sub: null, msg: "", err: "" };

  /* ───────── 입력 칸 정의 (이름, 라벨, 종류, 선택지, 필수) ───────── */
  const SCORE = "score";
  const ENT = {
    member: { t: "community_member_summary", pk: "member_summary_id", title: "참여 현황", yf: "survey_year", cols: 6, fields: [
      ["total_participants", "전체 참여자 수", "int"], ["regular_participants", "정기 참여자 수", "int"], ["new_participants", "신규 참여자 수", "int"], ["continuing_participants", "지속 참여자 수", "int"],
      ["diversity_note", "참여 다양성 설명 (집단 단위로 적기 — 이름·연락처 금지)", "text"], ["evidence_note", "근거 설명", "text"]] },
    activity: { t: "activity_record", pk: "activity_id", title: "활동 기록", df: "activity_date", cols: 5, fields: [
      ["activity_date", "활동일", "date", null, 1], ["activity_name", "활동명", "str", null, 1], ["activity_type_code", "활동 유형", "code:activity_type", null, 1],
      ["participant_count", "참여 인원(명)", "int"], ["resident_led_score", "주민 주도성 (1~5, 높을수록 주민이 직접 이끎)", SCORE], ["outcome_summary", "성과 요약", "text"]] },
    project: { t: "project", pk: "project_id", title: "사업 이력", yf: "application_year", cols: 6, fields: [
      ["project_name", "사업명", "str", null, 1], ["project_type_code", "사업 유형", "code:project_type", null, 1],
      ["application_status", "신청 상태", "enum", ["미신청", "신청", "선정", "미선정"]], ["selected_amount", "선정 금액(원) — 미신청이면 비움", "int"],
      ["execution_status", "수행 상태", "enum", ["예정", "진행", "완료", "중단"]], ["followup_status", "후속 연계 여부", "str"], ["project_outcome", "사업 성과", "text"]] },
    growth: { t: "growth_assessment", pk: "assessment_id", title: "성장 진단", yf: "assessment_year", cols: 6, fields: [
      ["domain_code", "진단 영역", "code:growth_domain", null, 1], ["stage_code", "성장 단계", "code:growth_stage", null, 1], ["round_no", "회차 (재평가는 번호를 올려 새로 입력)", "int", null, 1],
      ["score", "점수 (1~5, 높을수록 그 영역이 잘 갖춰짐)", SCORE], ["rationale", "판단 근거 (필수)", "text", null, 1], ["support_need", "지원 필요사항", "text"],
      ["assessed_by_role", "평가 주체", "code:assessed_by_role", null, 1]] },
    collab: { t: "collaboration", pk: "collaboration_id", title: "연대·협력", cid: "lead_community_id", df: "activity_date", cols: 5, fields: [
      ["activity_name", "협력 활동명", "str", null, 1], ["activity_date", "활동일", "date"], ["collaboration_type_code", "협력 유형", "code:collaboration_type", null, 1],
      ["continuity_code", "지속성", "code:continuity"], ["exchanged_resource", "교류한 자원", "text"], ["outcome_summary", "성과 요약", "text"]] },
    network: { t: "network_assessment", pk: "network_assessment_id", title: "관계망 진단", yf: "assessment_year", cols: 6, fields: [
      ["round_no", "회차", "int", null, 1], ["regular_partner_count", "정기 협력 상대 수", "int"], ["reciprocity_score", "상호성 (1~5, 높을수록 서로 주고받음)", SCORE],
      ["trust_score", "신뢰도 (1~5, 높을수록 큼)", SCORE], ["distribution_score", "관계 분산도 (1~5, 높을수록 여러 곳으로 고르게)", SCORE],
      ["conflict_resolution_score", "갈등 조정 수준 (1~5, 높을수록 잘 조정됨)", SCORE], ["network_note", "관계망 설명", "text"]] },
    governance: { t: "governance_assessment", pk: "governance_id", title: "자치 진단", yf: "assessment_year", cols: 6, fields: [
      ["round_no", "회차", "int", null, 1], ["resident_decision_score", "주민 결정 참여 (1~5, 높을수록 주민 주도)", SCORE], ["role_distribution_score", "역할·리더십 분산 (1~5, 높을수록 고르게 분산)", SCORE],
      ["operation_rules_exists", "운영 규칙이 있는가", "bool"], ["rules_shared", "규칙이 공유되는가", "bool"],
      ["external_dependency_score", "외부 의존 정도 (1~5, ★높을수록 의존이 큼 — 낮을수록 자치)", SCORE], ["governance_example", "자치 사례", "text"]] },
    resource: { t: "resource_record", pk: "resource_record_id", title: "자립·자원", yf: "record_year", cols: 6, fields: [
      ["resource_type_code", "자원 유형", "code:resource_type", null, 1], ["resource_amount", "규모", "num"], ["unit_code", "단위", "code:resource_unit"],
      ["local_source", "지역 내 자원인가", "bool"], ["post_grant_activity", "지원 종료 후에도 활동 지속", "bool"], ["circulation_note", "순환 내용 (지역 안에서 돌고 있는 모습)", "text"]] },
  };
  const TABS = [["overview", "개요"], ["member", "참여"], ["activity", "활동"], ["project", "사업"], ["growth", "성장진단"], ["collab", "연대"], ["network", "관계망"],
    ["governance", "자치"], ["resource", "자립"], ["indicator", "지표"], ["evidence", "증빙"], ["submit", "제출·검토"]];

  /* ───────── 도우미 ───────── */
  const isOffice = () => S.role === "owner" || S.role === "office";
  const isStaff = () => isOffice() || S.role === "center";
  const comm = (id) => S.comms.find((c) => c.community_id === id);
  const lockedNow = () => !!(S.sub && LOCKED.includes(S.sub.status));
  const canEdit = () => S.role && S.role !== "viewer" && (!lockedNow() || isOffice());
  const codeList = (g) => S.codes[g] || [];
  function friendly(e) {
    const m = (e && (e.message || e.details)) || String(e);
    if (/duplicate key|unique constraint/i.test(m)) return "이미 같은 연도(또는 같은 회차) 자료가 있습니다. 목록에서 그 자료를 열어 고쳐 주세요.";
    if (/row-level security|permission denied/i.test(m)) return "이 작업을 할 권한이 없습니다.";
    if (/violates check constraint/i.test(m)) return "입력값이 허용 범위를 벗어났습니다 (점수 1~5, 숫자는 0 이상, 미신청 사업에는 선정 금액을 넣을 수 없음).";
    return window.sbErr ? window.sbErr(e) : m;
  }
  const say = (ok, err) => { S.msg = ok || ""; S.err = err || ""; };
  const msgHtml = () => (S.err ? `<div class="err">${E(S.err)}</div>` : "") + (S.msg ? `<div class="ok">${E(S.msg)}</div>` : "");
  const pill = (s) => `<span class="pill ${E(s)}">${E(s)}</span>`;
  const fmtDate = (d) => (d ? String(d).slice(0, 10) : "");
  const yearOptions = () => { let h = ""; for (let y = NOW + 1; y >= 2024; y--) h += `<option value="${y}"${y === S.year ? " selected" : ""}>${y}년</option>`; return h; };

  /* ───────── 시작 · 로그인 ───────── */
  async function start() {
    if (!window.sb) { $("#app").innerHTML = `<div class="card err">수파베이스 연결을 불러오지 못했습니다.</div>`; return; }
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return loginScreen();
    await boot(session);
  }
  function loginScreen(msg) {
    $("#nav").style.display = "none"; $("#who").innerHTML = "";
    $("#app").innerHTML = `<div class="card login"><h2>로그인</h2>
      <p class="sub">직원 계정 또는 단장·사무국이 만들어 준 공동체 담당자 계정으로 들어갑니다. 새 가입은 막혀 있습니다.</p>
      <label>이메일</label><input type="email" id="le" autocomplete="username"><label>비밀번호</label><input type="password" id="lp" autocomplete="current-password">
      <div style="margin-top:12px;"><button class="b" id="lb" style="width:100%;">로그인</button></div><div class="err" id="lerr">${E(msg || "")}</div></div>`;
    const go = async () => {
      $("#lerr").textContent = "";
      const { error } = await sb.auth.signInWithPassword({ email: $("#le").value.trim(), password: $("#lp").value });
      if (error) { $("#lerr").textContent = friendly(error); return; }
      start();
    };
    $("#lb").onclick = go; $("#lp").onkeydown = (e) => { if (e.key === "Enter") go(); };
  }
  async function boot(session) {
    S.uid = session.user.id;
    const r = await sb.rpc("gc_my_role");
    S.role = r.data || null;
    if (r.error || !S.role) {
      $("#nav").style.display = "none";
      $("#who").innerHTML = `${E(session.user.email)} <button class="b g s" id="lo">로그아웃</button>`;
      $("#lo").onclick = async () => { await sb.auth.signOut(); start(); };
      $("#app").innerHTML = `<div class="card"><h2>권한이 없습니다</h2><p>이 계정에는 공동체 성장·성과관리 권한이 없습니다. 단장·사무국에 「공동체 담당자 연결」을 요청하세요.</p></div>`;
      return;
    }
    const me = await sb.from("staff").select("name,center").eq("id", S.uid).maybeSingle();
    S.name = (me.data && me.data.name) || session.user.email; S.center = (me.data && me.data.center) || "";
    $("#who").innerHTML = `${E(S.name)} · ${E(ROLE_LABEL[S.role])}${S.role === "center" ? " (" + E(CENTERS[S.center] || "") + ")" : ""} <button class="b g s" id="lo">로그아웃</button>`;
    $("#lo").onclick = async () => { await sb.auth.signOut(); start(); };
    const cs = await sb.from("code_item").select("code_group,code,label,sort").eq("active", true).order("sort");
    S.codes = {}; (cs.data || []).forEach((c) => (S.codes[c.code_group] = S.codes[c.code_group] || []).push(c));
    await loadComms();
    S.view = S.role === "viewer" ? "report" : "home"; S.cid = null;
    if (S.role === "community" && S.comms.length === 1) { S.view = "detail"; S.cid = S.comms[0].community_id; S.tab = "overview"; await loadSub(); }
    render();
  }
  async function loadComms() {
    if (S.role === "viewer") { S.comms = []; return; }
    const r = await sb.from("community").select("*").is("deleted_at", null).order("community_name");
    S.comms = r.data || [];
    const sb2 = await sb.from("annual_submission").select("community_id,record_year,status,due_date").eq("record_year", S.year);
    S.subs = {}; (sb2.data || []).forEach((x) => (S.subs[x.community_id] = x));
  }
  async function loadSub() {
    if (!S.cid) { S.sub = null; return; }
    const r = await sb.from("annual_submission").select("*").eq("community_id", S.cid).eq("record_year", S.year).maybeSingle();
    S.sub = r.data || null;
  }

  /* ───────── 화면 틀 ───────── */
  function navHtml() {
    const items = [];
    if (S.role !== "viewer") items.push(["home", "공동체"]);
    if (isStaff()) items.push(["review", "검토함"]);
    items.push(["report", "보고서"]);
    if (isOffice()) items.push(["admin", "지표·코드·담당자"]);
    return items.map(([k, l]) => `<button data-nav="${k}" class="${S.view === k || (k === "home" && S.view === "detail") ? "on" : ""}">${l}</button>`).join("") +
      `<span style="flex:1"></span><span style="padding:6px 8px;font-size:12.5px;">연도 <select id="yr" style="width:auto;display:inline-block;padding:3px 6px;">${yearOptions()}</select></span>`;
  }
  async function render() {
    const nav = $("#nav"); nav.style.display = "flex"; nav.innerHTML = navHtml();
    nav.querySelectorAll("[data-nav]").forEach((b) => (b.onclick = async () => { S.view = b.dataset.nav; S.cid = null; say(); await loadComms(); render(); }));
    $("#yr").onchange = async (e) => { S.year = +e.target.value; await loadComms(); await loadSub(); render(); };
    const app = $("#app");
    app.innerHTML = `<div class="note">🔒 이 화면에는 <b>공동체 단위 집계와 설명</b>만 입력합니다. 참여자 이름 · 연락처 · 얼굴이 나오는 사진 · 주민등록번호 등 개인 식별 정보는 쓰지 않습니다. 순위 매기기용 화면은 없습니다.</div><div id="body"></div>`;
    try {
      if (S.view === "home") await viewHome();
      else if (S.view === "detail") await viewDetail();
      else if (S.view === "review") await viewReview();
      else if (S.view === "report") await viewReport();
      else if (S.view === "admin") await viewAdmin();
    } catch (e) { $("#body").innerHTML = `<div class="card err">${E(friendly(e))}</div>`; }
  }
  const body = (h) => { $("#body").innerHTML = h; };

  /* ───────── 공동체 목록 (SCR-02) ───────── */
  async function viewHome() {
    const rows = S.comms.map((c) => {
      const s = S.subs[c.community_id];
      return `<tr><td><a href="#" data-open="${c.community_id}">${E(c.community_name)}</a></td><td>${E(CENTERS[c.assigned_center] || "")}</td><td>${E(STATUS_LABEL[c.current_status] || c.current_status)}</td>
        <td>${pill(s ? s.status : "작성중")}${s && s.status === "보완요청" && s.due_date ? ` <span class="sub">~${E(fmtDate(s.due_date))}</span>` : ""}</td></tr>`;
    }).join("");
    const reg = isOffice() ? `<div class="card"><h2>공동체 등록</h2><form id="newc"><div class="grid">
        <div><label>공동체명 *</label><input name="community_name" required maxlength="200"></div>
        <div><label>담당 센터</label><select name="assigned_center">${Object.entries(CENTERS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
        <div><label>결성 연도</label><input name="formed_year" type="number" min="1900" max="2100"></div></div>
        <div style="margin-top:10px;"><button class="b">등록</button></div></form></div>` : "";
    body(`${msgHtml()}<div class="card"><h2>공동체 목록 · ${S.year}년 제출 현황</h2>
      ${S.comms.length ? `<div class="tw"><table><thead><tr><th>공동체</th><th>담당 센터</th><th>상태</th><th>${S.year}년 자료</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="sub">보이는 공동체가 없습니다. ${isOffice() ? "아래에서 등록하세요." : "담당 공동체가 배정되면 여기에 나타납니다."}</p>`}
      <p class="sub" style="margin-top:8px;">이름 순입니다. 점수·성과로 줄 세우지 않습니다.</p></div>${reg}`);
    document.querySelectorAll("[data-open]").forEach((a) => (a.onclick = async (e) => { e.preventDefault(); S.cid = +a.dataset.open; S.view = "detail"; S.tab = "overview"; say(); await loadSub(); render(); }));
    const f = $("#newc");
    if (f) f.onsubmit = async (e) => {
      e.preventDefault(); const d = Object.fromEntries(new FormData(f));
      const row = { community_name: d.community_name.trim(), assigned_center: d.assigned_center, formed_year: d.formed_year ? +d.formed_year : null };
      const r = await sb.from("community").insert(row);
      say(r.error ? "" : "공동체를 등록했습니다.", r.error ? friendly(r.error) : ""); await loadComms(); render();
    };
  }

  /* ───────── 공동체 상세 (SCR-03~) ───────── */
  async function viewDetail() {
    const c = comm(S.cid);
    if (!c) { S.view = "home"; return viewHome(); }
    const st = S.sub ? S.sub.status : "작성중";
    const tabs = TABS.map(([k, l]) => `<button data-tab="${k}" class="${S.tab === k ? "on" : ""}">${l}</button>`).join("");
    const lockMsg = lockedNow() && !isOffice() ? `<div class="note">🔒 ${S.year}년 자료는 <b>${E(st)}</b> 상태라 고칠 수 없습니다. ${st === "확정" ? "고쳐야 하면 사무국에 재오픈을 요청하세요." : "보완 요청이 오면 다시 고칠 수 있습니다."}</div>` : "";
    body(`<div class="card"><div class="row" style="justify-content:space-between;"><div><h2 style="margin:0;">${E(c.community_name)}</h2>
        <span class="sub">${E(CENTERS[c.assigned_center] || "")} · ${E(STATUS_LABEL[c.current_status])} · ${S.year}년 자료</span> ${pill(st)}</div>
        ${S.role === "community" && S.comms.length === 1 ? "" : `<button class="b g s" id="back">← 목록</button>`}</div></div>
      ${lockMsg}<div class="tabs">${tabs}</div>${msgHtml()}<div id="tab"></div>`);
    const back = $("#back"); if (back) back.onclick = async () => { S.view = "home"; S.cid = null; say(); await loadComms(); render(); };
    document.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { S.tab = b.dataset.tab; say(); viewDetail(); }));
    const t = S.tab;
    if (t === "overview") return tabOverview(c);
    if (ENT[t]) return tabEntity(t);
    if (t === "indicator") return tabIndicator();
    if (t === "evidence") return tabEvidence();
    if (t === "submit") return tabSubmit();
  }
  const cidOf = (cfg) => cfg.cid || "community_id";

  /* 개요 */
  function tabOverview(c) {
    const canOv = isOffice() || (S.role === "center");
    const sel = (name, g, cur) => `<select name="${name}" ${canOv ? "" : "disabled"}><option value="">(선택 안 함)</option>${codeList(g).map((x) => `<option value="${E(x.code)}"${x.code === cur ? " selected" : ""}>${E(x.label)}</option>`).join("")}</select>`;
    $("#tab").innerHTML = `<div class="card"><h2>공동체 개요</h2><form id="ov"><div class="grid">
      <div><label>공동체명</label><input name="community_name" value="${E(c.community_name)}" ${canOv ? "" : "disabled"} maxlength="200"></div>
      <div><label>담당 센터 (단장·사무국만 변경)</label><select name="assigned_center" ${isOffice() ? "" : "disabled"}>${Object.entries(CENTERS).map(([k, v]) => `<option value="${k}"${k === c.assigned_center ? " selected" : ""}>${v}</option>`).join("")}</select></div>
      <div><label>활동 권역</label>${sel("activity_area_code", "activity_area", c.activity_area_code)}</div>
      <div><label>주요 활동 분야</label>${sel("main_topic_code", "main_topic", c.main_topic_code)}</div>
      <div><label>결성 연도</label><input name="formed_year" type="number" value="${E(c.formed_year || "")}" ${canOv ? "" : "disabled"}></div>
      <div><label>현재 상태</label><select name="current_status" ${canOv ? "" : "disabled"}>${Object.entries(STATUS_LABEL).map(([k, v]) => `<option value="${k}"${k === c.current_status ? " selected" : ""}>${v}</option>`).join("")}</select></div></div>
      <label>공동체 소개 (이름·연락처 없이 활동 중심으로)</label><textarea name="introduction" ${canOv ? "" : "disabled"} maxlength="4000">${E(c.introduction || "")}</textarea>
      ${codeList("activity_area").length ? "" : `<p class="sub">활동 권역·주요 활동 분야 코드는 아직 정해지지 않았습니다 — 단장·사무국이 「지표·코드·담당자」에서 정합니다. [확인필요]</p>`}
      <div class="row" style="margin-top:10px;">${canOv ? `<button class="b">저장</button>` : ""}${isOffice() ? `<button type="button" class="b r" id="delc">공동체 삭제(숨김)</button>` : ""}</div></form></div>`;
    const f = $("#ov");
    f.onsubmit = async (e) => {
      e.preventDefault(); if (!canOv) return; const d = Object.fromEntries(new FormData(f));
      const row = { community_name: d.community_name.trim(), activity_area_code: d.activity_area_code || null, main_topic_code: d.main_topic_code || null,
        formed_year: d.formed_year ? +d.formed_year : null, current_status: d.current_status, introduction: d.introduction || null };
      if (isOffice()) row.assigned_center = d.assigned_center;
      const r = await sb.from("community").update(row).eq("community_id", c.community_id);
      say(r.error ? "" : "저장했습니다.", r.error ? friendly(r.error) : ""); await loadComms(); viewDetail();
    };
    const del = $("#delc");
    if (del) del.onclick = async () => {
      if (!confirm("이 공동체를 목록에서 숨깁니다(자료는 지워지지 않고 이력이 남습니다). 계속할까요?")) return;
      const r = await sb.from("community").update({ deleted_at: new Date().toISOString() }).eq("community_id", c.community_id);
      if (r.error) { say("", friendly(r.error)); return viewDetail(); }
      S.view = "home"; S.cid = null; say("공동체를 숨겼습니다."); await loadComms(); render();
    };
  }

  /* 연도별 자료 표 (공통) */
  function fieldInput(f, val) {
    const [k, , type, opts] = f; const v = val == null ? "" : val;
    if (type === "text") return `<textarea name="${k}" maxlength="4000">${E(v)}</textarea>`;
    if (type === "int") return `<input name="${k}" type="number" step="1" min="0" value="${E(v)}">`;
    if (type === "num") return `<input name="${k}" type="number" step="0.01" min="0" value="${E(v)}">`;
    if (type === "date") return `<input name="${k}" type="date" value="${E(fmtDate(v))}">`;
    if (type === SCORE) return `<select name="${k}"><option value="">(미입력)</option>${[1, 2, 3, 4, 5].map((n) => `<option value="${n}"${String(v) === String(n) ? " selected" : ""}>${n}</option>`).join("")}</select>`;
    if (type === "bool") return `<select name="${k}"><option value="">(미입력)</option><option value="true"${v === true ? " selected" : ""}>예</option><option value="false"${v === false ? " selected" : ""}>아니오</option></select>`;
    if (type === "enum") return `<select name="${k}"><option value="">(선택)</option>${opts.map((o) => `<option${o === v ? " selected" : ""}>${E(o)}</option>`).join("")}</select>`;
    if (type.startsWith("code:")) return `<select name="${k}"><option value="">(선택)</option>${codeList(type.slice(5)).map((x) => `<option value="${E(x.code)}"${x.code === v ? " selected" : ""}>${E(x.label)}</option>`).join("")}</select>`;
    return `<input name="${k}" maxlength="200" value="${E(v)}">`;
  }
  function readForm(cfg, form) {
    const d = new FormData(form), row = {};
    for (const f of cfg.fields) {
      const [k, , type] = f; let v = d.get(k);
      if (v == null || v === "") v = null;
      else if (type === "int" || type === SCORE) v = parseInt(v, 10);
      else if (type === "num") v = parseFloat(v);
      else if (type === "bool") v = v === "true";
      row[k] = v;
    }
    return row;
  }
  function cellText(f, v) {
    if (v == null || v === "") return "";
    if (f[2] === "bool") return v ? "예" : "아니오";
    if (f[2] === "date") return fmtDate(v);
    const s = String(v); return s.length > 40 ? s.slice(0, 40) + "…" : s;
  }
  async function tabEntity(key) {
    const cfg = ENT[key], ck = cidOf(cfg);
    let q = sb.from(cfg.t).select("*").eq(ck, S.cid).is("deleted_at", null);
    if (cfg.yf) q = q.eq(cfg.yf, S.year); else if (cfg.df) q = q.gte(cfg.df, S.year + "-01-01").lte(cfg.df, S.year + "-12-31");
    const r = await q.order(cfg.pk);
    if (r.error) { $("#tab").innerHTML = `<div class="card err">${E(friendly(r.error))}</div>`; return; }
    const rows = r.data || [];
    const shown = cfg.fields.slice(0, cfg.cols);
    const edit = canEdit();
    $("#tab").innerHTML = `<div class="card"><div class="row" style="justify-content:space-between;"><h2 style="margin:0;">${cfg.title} · ${S.year}년</h2>${edit ? `<button class="b" id="add">+ 추가</button>` : ""}</div>
      <div id="eform"></div>${rows.length ? `<div class="tw" style="margin-top:8px;"><table><thead><tr>${shown.map((f) => `<th>${E(f[1].split(" (")[0].split(" —")[0])}</th>`).join("")}<th></th></tr></thead><tbody>
      ${rows.map((x) => `<tr>${shown.map((f) => `<td>${E(cellText(f, x[f[0]]))}</td>`).join("")}<td style="white-space:nowrap;">${edit ? `<button class="b g s" data-edit="${x[cfg.pk]}">열기·고치기</button> <button class="b r s" data-del="${x[cfg.pk]}">삭제</button>` : `<button class="b g s" data-edit="${x[cfg.pk]}">보기</button>`}${key === "collab" ? ` <button class="b g s" data-partner="${x[cfg.pk]}">협력 상대</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : `<p class="sub" style="margin-top:8px;">${S.year}년 입력된 자료가 없습니다.</p>`}
      <div id="extra"></div></div>`;
    const openForm = (row) => {
      const ro = !edit;
      $("#eform").innerHTML = `<form id="ef" class="card" style="background:#fafbfc;margin-top:8px;"><h3 style="margin-top:0;">${row ? "수정" : "새 자료"}</h3><div class="grid">${cfg.fields.map((f) => {
        let h = fieldInput(f, row ? row[f[0]] : (f[0] === "round_no" ? 1 : f[0] === "activity_date" ? (S.year === NOW ? new Date().toISOString().slice(0, 10) : S.year + "-01-01") : null));
        if (ro) h = h.replace(/<(input|select|textarea)/, "<$1 disabled");
        return `<div${f[2] === "text" ? ' style="grid-column:1/-1"' : ""}><label>${E(f[1])}${f[4] ? " *" : ""}</label>${h}</div>`;
      }).join("")}</div><div class="err" id="eerr"></div><div class="row" style="margin-top:8px;">${ro ? "" : `<button class="b">저장</button>`}<button type="button" class="b g" id="ecancel">닫기</button></div></form>`;
      $("#ecancel").onclick = () => ($("#eform").innerHTML = "");
      $("#ef").onsubmit = async (e) => {
        e.preventDefault(); const vals = readForm(cfg, $("#ef"));
        for (const f of cfg.fields) if (f[4] && (vals[f[0]] == null || vals[f[0]] === "")) { $("#eerr").textContent = `「${f[1].split(" (")[0]}」은 꼭 입력해야 합니다.`; return; }
        let res;
        if (row) res = await sb.from(cfg.t).update(vals).eq(cfg.pk, row[cfg.pk]);
        else { const ins = Object.assign({}, vals, { [ck]: S.cid }); if (cfg.yf) ins[cfg.yf] = S.year; res = await sb.from(cfg.t).insert(ins); }
        if (res.error) { $("#eerr").textContent = friendly(res.error); return; }
        say("저장했습니다."); viewDetail();
      };
    };
    const add = $("#add"); if (add) add.onclick = () => openForm(null);
    document.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => openForm(rows.find((x) => String(x[cfg.pk]) === b.dataset.edit))));
    document.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
      if (!confirm("이 자료를 삭제합니다(목록에서 숨김 · 변경 이력은 남습니다). 계속할까요?")) return;
      const res = await sb.from(cfg.t).update({ deleted_at: new Date().toISOString() }).eq(cfg.pk, +b.dataset.del);
      say(res.error ? "" : "삭제했습니다.", res.error ? friendly(res.error) : ""); viewDetail();
    }));
    document.querySelectorAll("[data-partner]").forEach((b) => (b.onclick = () => partnerPanel(+b.dataset.partner)));
  }

  /* 연대 협력 상대 */
  async function partnerPanel(collId) {
    const r = await sb.from("collaboration_partner").select("*").eq("collaboration_id", collId).order("partner_id");
    const ps = r.data || [], edit = canEdit();
    const name = (p) => (p.partner_community_id ? (comm(p.partner_community_id) || {}).community_name || "(등록된 다른 공동체)" : p.partner_name_temp + " (임시 기관명)");
    $("#extra").innerHTML = `<div class="card" style="background:#fafbfc;margin-top:10px;"><h3 style="margin-top:0;">협력 상대</h3>
      ${ps.length ? `<ul>${ps.map((p) => `<li>${E(name(p))} ${p.partner_role_code ? `· ${E(p.partner_role_code)}` : ""} ${edit ? `<button class="b r s" data-pdel="${p.partner_id}">빼기</button>` : ""}</li>`).join("")}</ul>` : `<p class="sub">등록된 상대가 없습니다.</p>`}
      ${edit ? `<form id="pf"><div class="grid"><div><label>등록된 공동체에서 고르기</label><select name="pc"><option value="">(선택 안 함)</option>${S.comms.filter((c) => c.community_id !== S.cid).map((c) => `<option value="${c.community_id}">${E(c.community_name)}</option>`).join("")}</select></div>
        <div><label>또는 임시 기관명 (담당자 확인 전)</label><input name="pn" maxlength="200"></div>
        <div><label>역할</label><select name="pr"><option value="">(선택 안 함)</option>${codeList("partner_role").map((x) => `<option>${E(x.label)}</option>`).join("")}</select></div></div>
        <div class="err" id="perr"></div><div style="margin-top:8px;"><button class="b s">상대 추가</button></div></form>` : ""}</div>`;
    document.querySelectorAll("[data-pdel]").forEach((b) => (b.onclick = async () => { const x = await sb.from("collaboration_partner").delete().eq("partner_id", +b.dataset.pdel); if (x.error) alert(friendly(x.error)); partnerPanel(collId); }));
    const pf = $("#pf");
    if (pf) pf.onsubmit = async (e) => {
      e.preventDefault(); const d = Object.fromEntries(new FormData(pf));
      if (!!d.pc === !!d.pn.trim()) { $("#perr").textContent = "등록된 공동체 또는 임시 기관명 중 하나만 입력하세요."; return; }
      const x = await sb.from("collaboration_partner").insert({ collaboration_id: collId, partner_community_id: d.pc ? +d.pc : null, partner_name_temp: d.pn.trim() || null, partner_role_code: d.pr || null });
      if (x.error) { $("#perr").textContent = friendly(x.error); return; } partnerPanel(collId);
    };
  }

  /* 지표 입력 */
  async function tabIndicator() {
    const [defs, vals] = await Promise.all([
      sb.from("indicator_definition").select("*").eq("active_flag", true).lte("active_from_year", S.year).order("indicator_code"),
      sb.from("indicator_value").select("*").eq("community_id", S.cid).eq("record_year", S.year).is("deleted_at", null)]);
    const ds = (defs.data || []).filter((d) => d.active_to_year == null || d.active_to_year >= S.year), vm = {}; (vals.data || []).forEach((v) => (vm[v.indicator_id] = v));
    const edit = canEdit();
    $("#tab").innerHTML = `<div class="card"><h2>지표 입력 · ${S.year}년</h2><p class="sub">정의된 지표에 값과 근거를 적습니다. <b>점수 지표는 1~5, 높을수록 긍정</b>(지표별 방향은 정의를 확인). 필수(★) 지표가 비면 제출할 수 없습니다.</p>
      ${ds.length ? `<form id="iv">${ds.map((d) => {
        const v = vm[d.indicator_id] || {}, nar = d.data_type === "서술형", id = d.indicator_id;
        const inp = nar ? `<textarea name="t${id}" ${edit ? "" : "disabled"} maxlength="4000">${E(v.value_text || "")}</textarea>`
          : `<input name="n${id}" type="number" step="${d.data_type === "점수" || d.data_type === "정수" || d.data_type === "금액" ? "1" : "0.01"}" value="${E(v.value_number == null ? "" : v.value_number)}" ${edit ? "" : "disabled"}>`;
        return `<div style="border-top:1px solid var(--line);padding:8px 0;"><div><b>${d.mandatory_flag ? "★ " : ""}${E(d.indicator_code)} · ${E(d.indicator_name)}</b> <span class="sub">(${E(d.data_type)}${d.unit ? "·" + E(d.unit) : ""}${d.score_direction ? " · " + E(d.score_direction) : ""}) ${v.status_code ? pill(v.status_code === "검토" ? "검토중" : v.status_code) : ""}</span></div>
          <div class="sub">${E(d.definition)} / 측정: ${E(d.measurement_method)}</div><div class="grid"><div><label>값</label>${inp}</div><div><label>근거 설명</label><textarea name="e${id}" ${edit ? "" : "disabled"} maxlength="4000">${E(v.evidence_note || "")}</textarea></div></div></div>`;
      }).join("")}<div class="err" id="ierr"></div>${edit ? `<button class="b" style="margin-top:8px;">지표 저장</button>` : ""}</form>` : `<p class="sub">${S.year}년에 적용되는 지표가 없습니다. 단장·사무국이 「지표·코드·담당자」에서 지표를 정의하면 여기에 나타납니다.</p>`}</div>`;
    const f = $("#iv");
    if (f) f.onsubmit = async (e) => {
      e.preventDefault(); const d = new FormData(f), rows = [];
      for (const df of ds) {
        const id = df.indicator_id, nar = df.data_type === "서술형", ev = (d.get("e" + id) || "").trim();
        const raw = nar ? (d.get("t" + id) || "").trim() : (d.get("n" + id) || "");
        const existing = vm[id];
        if (!raw && !ev && !existing) continue;
        rows.push({ community_id: S.cid, indicator_id: id, record_year: S.year, value_number: nar || raw === "" ? null : parseFloat(raw), value_text: nar && raw ? raw : null, evidence_note: ev || null });
      }
      if (!rows.length) { $("#ierr").textContent = "입력한 값이 없습니다."; return; }
      const res = await sb.from("indicator_value").upsert(rows, { onConflict: "community_id,indicator_id,record_year" });
      if (res.error) { $("#ierr").textContent = friendly(res.error); return; }
      say("지표를 저장했습니다."); viewDetail();
    };
  }

  /* 증빙자료 */
  const TT = { 활동: ["activity_record", "activity_id", "activity_name"], 사업: ["project", "project_id", "project_name"], 진단: ["growth_assessment", "assessment_id", "domain_code"],
    연대: ["collaboration", "collaboration_id", "activity_name"], 관계망: ["network_assessment", "network_assessment_id", "round_no"], 자치: ["governance_assessment", "governance_id", "round_no"],
    자립: ["resource_record", "resource_record_id", "resource_type_code"], 참여: ["community_member_summary", "member_summary_id", "survey_year"], 지표: ["indicator_value", "indicator_value_id", "indicator_id"] };
  async function tabEvidence() {
    const r = await sb.from("evidence").select("*").eq("community_id", S.cid).is("deleted_at", null).order("evidence_id", { ascending: false });
    const ev = r.data || [], ids = ev.map((x) => x.evidence_id);
    const lk = ids.length ? (await sb.from("evidence_link").select("*").in("evidence_id", ids)).data || [] : [];
    const edit = canEdit() || (S.role !== "viewer" && !isOffice() && lockedNow()); // 증빙 추가는 제출 뒤에도 가능(보완용)
    $("#tab").innerHTML = `<div class="card"><h2>증빙자료</h2><p class="sub">회의록 · 활동일지 · 사진 · 설문 요약 등. 파일 한 개 20MB까지. <b>얼굴이 나오는 사진, 명단, 연락처가 있는 파일은 올리지 않습니다.</b> 공개 범위: 공동체(공동체·직원) / 담당자(직원) / 관리자(단장·사무국).</p>
      ${edit ? `<form id="evf" class="card" style="background:#fafbfc;"><div class="grid"><div><label>파일 *</label><input type="file" name="file" required></div>
        <div><label>자료 유형 *</label><select name="type" required>${codeList("evidence_type").map((x) => `<option>${E(x.label)}</option>`).join("")}</select></div>
        <div><label>공개 범위</label><select name="lvl"><option>담당자</option><option>공동체</option><option>관리자</option></select></div>
        <div><label>보관 기한 (선택)</label><input type="date" name="ret"></div></div><label>설명</label><textarea name="desc" maxlength="2000"></textarea>
        <div class="err" id="everr"></div><button class="b" style="margin-top:8px;">올리기</button></form>` : ""}
      ${ev.length ? `<div class="tw"><table><thead><tr><th>파일</th><th>유형</th><th>공개</th><th>올린 날</th><th>연결된 자료</th><th></th></tr></thead><tbody>${ev.map((x) => {
        const mine = lk.filter((l) => l.evidence_id === x.evidence_id);
        return `<tr><td>${E(x.file_name)}<div class="sub">${E(x.description || "")}</div></td><td>${E(x.evidence_type_code)}</td><td>${E(x.access_level)}</td><td>${E(fmtDate(x.uploaded_at))}</td>
          <td>${mine.map((l) => `${E(l.target_type)}#${l.target_id}${edit ? ` <a href="#" data-unlink="${l.evidence_link_id}">✕</a>` : ""}`).join(", ") || '<span class="sub">없음</span>'}</td>
          <td style="white-space:nowrap;"><button class="b g s" data-dl="${E(x.storage_key)}">받기</button>${edit ? ` <button class="b g s" data-link="${x.evidence_id}">연결</button> <button class="b r s" data-edel="${x.evidence_id}">삭제</button>` : ""}</td></tr>`;
      }).join("")}</tbody></table></div><div id="lkform"></div>` : `<p class="sub">올린 증빙이 없습니다.</p>`}</div>`;
    const f = $("#evf");
    if (f) f.onsubmit = async (e) => {
      e.preventDefault(); const d = new FormData(f), file = d.get("file");
      if (!file || !file.size) return;
      if (file.size > 20 * 1024 * 1024) { $("#everr").textContent = "파일이 20MB를 넘습니다."; return; }
      const ext = (file.name.match(/\.[A-Za-z0-9]{1,8}$/) || [""])[0], key = `${S.cid}/${(crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(16).slice(2))}${ext}`;
      const up = await sb.storage.from("community-evidence").upload(key, file, { upsert: false });
      if (up.error) { $("#everr").textContent = friendly(up.error); return; }
      const ins = await sb.from("evidence").insert({ community_id: S.cid, evidence_type_code: d.get("type"), file_name: file.name.slice(0, 255), storage_key: key, access_level: d.get("lvl"), description: d.get("desc") || null, retention_until: d.get("ret") || null });
      if (ins.error) { await sb.storage.from("community-evidence").remove([key]); $("#everr").textContent = friendly(ins.error); return; }
      say("증빙을 올렸습니다."); viewDetail();
    };
    document.querySelectorAll("[data-dl]").forEach((b) => (b.onclick = async () => {
      const u = await sb.storage.from("community-evidence").createSignedUrl(b.dataset.dl, 60);
      if (u.error) { alert(friendly(u.error)); return; } window.open(u.data.signedUrl, "_blank", "noopener");
    }));
    document.querySelectorAll("[data-edel]").forEach((b) => (b.onclick = async () => {
      if (!confirm("증빙을 목록에서 숨깁니다(파일은 보관 기한까지 남습니다). 계속할까요?")) return;
      const x = await sb.from("evidence").update({ deleted_at: new Date().toISOString() }).eq("evidence_id", +b.dataset.edel);
      say(x.error ? "" : "삭제했습니다.", x.error ? friendly(x.error) : ""); viewDetail();
    }));
    document.querySelectorAll("[data-unlink]").forEach((a) => (a.onclick = async (e) => { e.preventDefault(); const x = await sb.from("evidence_link").delete().eq("evidence_link_id", +a.dataset.unlink); if (x.error) alert(friendly(x.error)); viewDetail(); }));
    document.querySelectorAll("[data-link]").forEach((b) => (b.onclick = () => linkForm(+b.dataset.link)));
  }
  function linkForm(evId) {
    $("#lkform").innerHTML = `<form id="lf" class="card" style="background:#fafbfc;margin-top:8px;"><h3 style="margin-top:0;">증빙 #${evId} 연결</h3><div class="grid"><div><label>연결할 자료 종류</label><select name="tt">${Object.keys(TT).map((k) => `<option>${k}</option>`).join("")}</select></div>
      <div><label>자료 선택</label><select name="ti" id="ti"></select></div></div><div class="err" id="lerr2"></div><div class="row" style="margin-top:8px;"><button class="b s">연결</button><button type="button" class="b g s" id="lc">닫기</button></div></form>`;
    const fill = async () => {
      const [t, pk, nm] = TT[$("#lf select[name=tt]").value], ck = t === "collaboration" ? "lead_community_id" : "community_id";
      const r = await sb.from(t).select(`${pk},${nm}`).eq(ck, S.cid).order(pk);
      $("#ti").innerHTML = (r.data || []).map((x) => `<option value="${x[pk]}">#${x[pk]} ${E(x[nm])}</option>`).join("") || `<option value="">(자료 없음)</option>`;
    };
    $("#lf select[name=tt]").onchange = fill; fill(); $("#lc").onclick = () => ($("#lkform").innerHTML = "");
    $("#lf").onsubmit = async (e) => {
      e.preventDefault(); const tt = $("#lf select[name=tt]").value, ti = $("#ti").value; if (!ti) return;
      const x = await sb.from("evidence_link").insert({ evidence_id: evId, target_type: tt, target_id: +ti });
      if (x.error) { $("#lerr2").textContent = friendly(x.error); return; } say("연결했습니다."); viewDetail();
    };
  }

  /* 제출·검토 (SCR-12, 13) */
  async function tabSubmit() {
    const [miss, rev] = await Promise.all([sb.rpc("gc_missing_mandatory", { p_community: S.cid, p_year: S.year }),
      sb.from("review_comment").select("*").eq("community_id", S.cid).eq("record_year", S.year).order("review_id", { ascending: false })]);
    const missing = miss.data || [], st = S.sub ? S.sub.status : "작성중";
    const actions = [];
    if (S.role !== "viewer" && (st === "작성중" || st === "보완요청")) actions.push(["submit", "제출하기", "b"]);
    if (isStaff() && st === "제출") actions.push(["start_review", "검토 시작", "b g"]);
    if (isStaff() && (st === "제출" || st === "검토중")) { actions.push(["request_fix", "보완 요청", "b g"]); actions.push(["confirm", "확정", "b"]); }
    if (isOffice() && st === "확정") actions.push(["reopen", "확정 취소(다시 열기)", "b r"]);
    $("#tab").innerHTML = `<div class="card"><h2>${S.year}년 제출·검토</h2><p>현재 상태: ${pill(st)} ${S.sub && S.sub.due_date ? `<span class="sub">보완 기한 ${E(fmtDate(S.sub.due_date))}</span>` : ""}</p>
      <p class="sub">흐름: 작성중 → 제출 → 검토중 → (보완요청 → 다시 제출) → 확정. 제출하면 그 해 자료는 잠기고, 확정 뒤에는 단장·사무국만 다시 열 수 있습니다. 확정은 제출한 사람이 할 수 없습니다(단장 제외).</p>
      ${missing.length ? `<div class="note">필수 지표가 비어 있습니다: <b>${E(missing.join(", "))}</b> — 「지표」 탭에서 채워야 제출할 수 있습니다.</div>` : `<p class="ok">필수 지표가 모두 채워져 있습니다.</p>`}
      ${actions.length ? `<div class="grid"><div style="grid-column:1/-1"><label>메모 / 사유 (보완 요청·확정 취소는 필수)</label><textarea id="anote" maxlength="4000"></textarea></div>
        <div><label>보완할 항목 (보완 요청 시)</label><input id="aitems" maxlength="2000"></div><div><label>보완 기한 (보완 요청 시)</label><input type="date" id="adue"></div></div>
        <div class="err" id="aerr"></div><div class="row" style="margin-top:8px;">${actions.map(([a, l, c]) => `<button class="${c}" data-act="${a}">${l}</button>`).join("")}</div>` : `<p class="sub">지금 상태에서 할 수 있는 작업이 없습니다.</p>`}
      <h3>검토 의견 이력</h3>${(rev.data || []).length ? `<ul>${rev.data.map((x) => `<li><b>${E(x.kind)}</b> ${E(fmtDate(x.created_at))}${x.items ? ` · 항목: ${E(x.items)}` : ""}${x.due_date ? ` · 기한 ${E(fmtDate(x.due_date))}` : ""}<br>${E(x.body)}</li>`).join("")}</ul>` : `<p class="sub">아직 없습니다.</p>`}</div>`;
    document.querySelectorAll("[data-act]").forEach((b) => (b.onclick = async () => {
      const a = b.dataset.act, note = $("#anote").value.trim();
      if ((a === "request_fix" || a === "reopen") && !note) { $("#aerr").textContent = "사유를 적어 주세요."; return; }
      if (a === "confirm" && !confirm("확정하면 이 연도 자료는 잠깁니다. 확정할까요?")) return;
      const r = await sb.rpc("gc_submission_action", { p_community: S.cid, p_year: S.year, p_action: a, p_note: note || null, p_items: $("#aitems").value.trim() || null, p_due: $("#adue").value || null });
      if (r.error) { $("#aerr").textContent = friendly(r.error); return; }
      say("처리했습니다 → " + (r.data && r.data.status)); await loadSub(); await loadComms(); viewDetail();
    }));
  }

  /* ───────── 검토함 (SCR-13) ───────── */
  async function viewReview() {
    const r = await sb.from("annual_submission").select("*").in("status", ["제출", "검토중", "보완요청"]).order("submitted_at", { ascending: true });
    const rows = (r.data || []).map((s) => {
      const c = S.comms.find((x) => x.community_id === s.community_id) || {};
      return `<tr><td><a href="#" data-r="${s.community_id}|${s.record_year}">${E(c.community_name || "#" + s.community_id)}</a></td><td>${s.record_year}년</td><td>${pill(s.status)}</td><td>${E(fmtDate(s.submitted_at))}</td><td>${E(fmtDate(s.due_date))}</td></tr>`;
    }).join("");
    body(`<div class="card"><h2>검토함</h2>${rows ? `<div class="tw"><table><thead><tr><th>공동체</th><th>연도</th><th>상태</th><th>제출일</th><th>보완 기한</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="sub">검토할 자료가 없습니다.</p>`}</div>`);
    document.querySelectorAll("[data-r]").forEach((a) => (a.onclick = async (e) => {
      e.preventDefault(); const [c, y] = a.dataset.r.split("|"); S.cid = +c; S.year = +y; S.view = "detail"; S.tab = "submit"; say(); await loadSub(); render();
    }));
  }

  /* ───────── 보고서 (SCR-14) ───────── */
  async function viewReport() {
    const r = await sb.rpc("gc_report", { p_year: S.year });
    if (r.error) { body(`<div class="card err">${E(friendly(r.error))}</div>`); return; }
    const d = r.data, kv = (o) => Object.entries(o || {}).map(([k, v]) => `<tr><td>${E(k)}</td><td>${v == null ? "비공개(3 미만)" : E(v)}</td></tr>`).join("") || `<tr><td colspan="2" class="sub">자료 없음</td></tr>`;
    body(`<div class="card"><h2>${S.year}년 요약 보고서</h2>${d.viewer_view ? `<p class="sub">열람자용 비식별 집계입니다. 3 미만 칸은 가려 보입니다.</p>` : `<p class="sub">내가 볼 수 있는 공동체 기준 집계입니다.</p>`}
      <div class="kpi"><div><b>${d.communities}</b>공동체</div><div><b>${d.active_communities}</b>활동중</div><div><b>${d.participants_total == null ? "-" : d.participants_total}</b>참여자 합계</div><div><b>${d.activities == null ? "-" : d.activities}</b>활동 건수</div></div>
      <div class="grid"><div><h3>자료 제출 상태</h3><table><tbody>${kv(d.submission_status)}</tbody></table></div><div><h3>성장 단계 분포 (영역/단계 · 공동체 수)</h3><table><tbody>${kv(d.stage_distribution)}</tbody></table></div>
      <div><h3>사업 신청 결과</h3><table><tbody>${kv(d.projects)}</tbody></table></div></div>
      <p class="sub" style="margin-top:10px;">공동체끼리 순위를 매기지 않고 단계 분포로만 봅니다. 자료는 확정된 것과 아직 확정 전인 것이 섞여 있을 수 있으니 「제출 상태」를 함께 보세요.</p></div>`);
  }

  /* ───────── 지표·코드·담당자 (SCR-15, 단장·사무국) ───────── */
  async function viewAdmin() {
    const [ind, cu, st, cd, au] = await Promise.all([
      sb.from("indicator_definition").select("*").order("indicator_code"),
      sb.from("community_user").select("*").order("created_at", { ascending: false }),
      sb.from("staff").select("id,email,name,role").eq("role", "pending"),
      sb.from("code_item").select("*").order("code_group").order("sort"),
      sb.from("audit_log").select("*").order("audit_log_id", { ascending: false }).limit(60)]);
    const inds = ind.data || [], cus = cu.data || [], pend = st.data || [], codes = cd.data || [], aud = au.data || [];
    const groups = [...new Set(codes.map((c) => c.code_group))];
    const cname = (id) => (S.comms.find((c) => c.community_id === id) || {}).community_name || (id ? "#" + id : "전체(열람)");
    body(`${msgHtml()}
    <div class="card"><h2>지표 정의 (${inds.length})</h2><p class="sub">지표는 지우지 않고 「적용 종료 연도」를 정해 끝냅니다. 연도별 값은 그 해의 정의로 남습니다. 아래 6개는 초안입니다 — 정의를 확정한 뒤 필수(★)로 바꾸세요.</p>
      <div class="tw"><table><thead><tr><th>코드</th><th>이름</th><th>영역</th><th>자료형</th><th>주기</th><th>필수</th><th>적용 연도</th><th>사용</th><th></th></tr></thead><tbody>${inds.map((d) => `<tr><td>${E(d.indicator_code)}</td><td>${E(d.indicator_name)}</td><td>${E(d.domain_code)}</td><td>${E(d.data_type)}</td><td>${E(d.collection_cycle)}</td><td>${d.mandatory_flag ? "★" : ""}</td><td>${d.active_from_year}~${d.active_to_year || ""}</td><td>${d.active_flag ? "예" : "아니오"}</td><td><button class="b g s" data-ind="${d.indicator_id}">고치기</button></td></tr>`).join("")}</tbody></table></div>
      <div style="margin-top:8px;"><button class="b" id="indnew">+ 지표 추가</button></div><div id="indform"></div></div>
    <div class="card"><h2>코드 값</h2><p class="sub">선택 목록에 나오는 값입니다. 활동 권역(activity_area)·주요 활동 분야(main_topic)는 비어 있습니다 — 여기서 추가하세요.</p>
      <div class="tw"><table><thead><tr><th>묶음</th><th>값</th></tr></thead><tbody>${[...new Set([...groups, "activity_area", "main_topic"])].map((g) => `<tr><td>${E(g)}</td><td>${codes.filter((c) => c.code_group === g).map((c) => E(c.label)).join(" · ") || '<span class="sub">비어 있음</span>'}</td></tr>`).join("")}</tbody></table></div>
      <form id="cdf" class="row" style="margin-top:8px;"><select name="g" style="width:auto;">${[...new Set([...groups, "activity_area", "main_topic"])].map((g) => `<option>${E(g)}</option>`).join("")}</select><input name="v" placeholder="새 값 (예: 안성 서부권)" style="width:220px;" required maxlength="50"><button class="b s">값 추가</button></form></div>
    <div class="card"><h2>공동체 담당자 · 열람자 연결 (${cus.length})</h2><p class="sub">① 「직원 권한 관리」에서 계정을 만들 때 권한을 <b>pending(승인 대기)</b>로 둡니다 → ② 여기서 그 계정을 공동체에 연결합니다. 퇴사·중단은 「사용 안 함」으로 바꿉니다.</p>
      <div class="tw"><table><thead><tr><th>계정</th><th>역할</th><th>공동체</th><th>사용</th><th></th></tr></thead><tbody>${cus.map((u) => `<tr><td>${E(u.user_id.slice(0, 8))}…</td><td>${u.role === "community" ? "공동체 담당자" : "보고서 열람자"}</td><td>${E(u.role === "community" ? cname(u.community_id) : "전체(비식별 집계)")}</td><td>${u.active ? "예" : "아니오"}</td><td><button class="b g s" data-cuact="${u.user_id}|${u.active ? 0 : 1}">${u.active ? "사용 중지" : "다시 사용"}</button></td></tr>`).join("") || `<tr><td colspan="5" class="sub">연결된 계정이 없습니다.</td></tr>`}</tbody></table></div>
      <form id="cuf" class="grid" style="margin-top:8px;"><div><label>계정 (승인 대기 직원 목록)</label><select name="u" required><option value="">(선택)</option>${pend.map((p) => `<option value="${p.id}">${E(p.email)}${p.name ? " · " + E(p.name) : ""}</option>`).join("")}</select></div>
        <div><label>역할</label><select name="r" id="cur"><option value="community">공동체 담당자</option><option value="viewer">보고서 열람자</option></select></div>
        <div><label>공동체 (담당자일 때)</label><select name="c"><option value="">(선택)</option>${S.comms.map((c) => `<option value="${c.community_id}">${E(c.community_name)}</option>`).join("")}</select></div>
        <div style="align-self:end;"><button class="b">연결</button></div></form><div class="err" id="cuerr"></div>${pend.length ? "" : `<p class="sub">연결할 승인 대기 계정이 없습니다.</p>`}</div>
    <div class="card"><h2>변경 이력 (최근 60건)</h2><div class="tw"><table><thead><tr><th>시각</th><th>대상</th><th>행동</th><th>내용</th></tr></thead><tbody>${aud.map((a) => `<tr><td>${E(String(a.changed_at).slice(0, 16).replace("T", " "))}</td><td>${E(a.entity_type)}#${a.entity_id}</td><td>${E(a.action_type)}</td><td>${E(a.change_summary || "")}</td></tr>`).join("")}</tbody></table></div></div>`);
    $("#indnew").onclick = () => indForm(null);
    document.querySelectorAll("[data-ind]").forEach((b) => (b.onclick = () => indForm(inds.find((x) => String(x.indicator_id) === b.dataset.ind))));
    $("#cdf").onsubmit = async (e) => {
      e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)), v = d.v.trim();
      const x = await sb.from("code_item").insert({ code_group: d.g, code: v, label: v, sort: 100 });
      say(x.error ? "" : "코드 값을 추가했습니다.", x.error ? friendly(x.error) : ""); viewAdmin();
    };
    $("#cuf").onsubmit = async (e) => {
      e.preventDefault(); const d = Object.fromEntries(new FormData(e.target));
      if (d.r === "community" && !d.c) { $("#cuerr").textContent = "공동체를 고르세요."; return; }
      const x = await sb.from("community_user").insert({ user_id: d.u, role: d.r, community_id: d.r === "community" ? +d.c : null });
      say(x.error ? "" : "연결했습니다.", x.error ? friendly(x.error) : ""); viewAdmin();
    };
    document.querySelectorAll("[data-cuact]").forEach((b) => (b.onclick = async () => {
      const [id, a] = b.dataset.cuact.split("|"); const x = await sb.from("community_user").update({ active: a === "1" }).eq("user_id", id);
      say(x.error ? "" : "바꿨습니다.", x.error ? friendly(x.error) : ""); viewAdmin();
    }));
  }
  function indForm(d) {
    const v = d || { data_type: "점수", collection_cycle: "연간", active_from_year: NOW, active_flag: true, mandatory_flag: false };
    const opt = (arr, cur) => arr.map((o) => `<option${o === cur ? " selected" : ""}>${E(o)}</option>`).join("");
    $("#indform").innerHTML = `<form id="inf" class="card" style="background:#fafbfc;margin-top:8px;"><h3 style="margin-top:0;">${d ? "지표 고치기" : "새 지표"}</h3><div class="grid">
      <div><label>지표 코드 * (예: GOV03)</label><input name="indicator_code" value="${E(v.indicator_code || "")}" ${d ? "disabled" : ""} required maxlength="30"></div>
      <div><label>지표명 *</label><input name="indicator_name" value="${E(v.indicator_name || "")}" required maxlength="200"></div>
      <div><label>영역 *</label><select name="domain_code">${codeList("growth_domain").map((x) => `<option${x.code === v.domain_code ? " selected" : ""}>${E(x.label)}</option>`).join("")}</select></div>
      <div><label>자료형</label><select name="data_type">${opt(["정수", "금액", "비율", "점수", "서술형"], v.data_type)}</select></div>
      <div><label>단위</label><input name="unit" value="${E(v.unit || "")}" maxlength="30"></div>
      <div><label>수집 주기</label><select name="collection_cycle">${opt(["수시", "분기", "연간"], v.collection_cycle)}</select></div>
      <div><label>점수 방향</label><select name="score_direction"><option value="">(없음)</option>${opt(["높을수록 긍정", "낮을수록 긍정", "해당 없음"], v.score_direction)}</select></div>
      <div><label>적용 시작 연도</label><input name="active_from_year" type="number" value="${v.active_from_year}" required></div>
      <div><label>적용 종료 연도 (비우면 계속)</label><input name="active_to_year" type="number" value="${E(v.active_to_year || "")}"></div>
      <div><label>필수 지표</label><select name="mandatory_flag"><option value="false"${v.mandatory_flag ? "" : " selected"}>아니오</option><option value="true"${v.mandatory_flag ? " selected" : ""}>예 (비면 제출 불가)</option></select></div>
      <div><label>사용</label><select name="active_flag"><option value="true"${v.active_flag ? " selected" : ""}>예</option><option value="false"${v.active_flag ? "" : " selected"}>아니오</option></select></div></div>
      <label>정의 *</label><textarea name="definition" required>${E(v.definition || "")}</textarea><label>측정 방법 *</label><textarea name="measurement_method" required>${E(v.measurement_method || "")}</textarea>
      <div class="err" id="inerr"></div><div class="row" style="margin-top:8px;"><button class="b">저장</button><button type="button" class="b g" id="inc">닫기</button></div></form>`;
    $("#inc").onclick = () => ($("#indform").innerHTML = "");
    $("#inf").onsubmit = async (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
      const row = { indicator_name: f.indicator_name.trim(), domain_code: f.domain_code, definition: f.definition.trim(), measurement_method: f.measurement_method.trim(), data_type: f.data_type, unit: f.unit || null,
        collection_cycle: f.collection_cycle, mandatory_flag: f.mandatory_flag === "true", score_direction: f.score_direction || null, active_from_year: +f.active_from_year, active_to_year: f.active_to_year ? +f.active_to_year : null, active_flag: f.active_flag === "true" };
      const x = d ? await sb.from("indicator_definition").update(row).eq("indicator_id", d.indicator_id) : await sb.from("indicator_definition").insert(Object.assign({ indicator_code: f.indicator_code.trim() }, row));
      if (x.error) { $("#inerr").textContent = friendly(x.error); return; } say("지표를 저장했습니다."); viewAdmin();
    };
  }

  start();
})();
