/*
 * 문의 대장 · 고객 대장 (연습용) — 기혁스 3기 5회차 ⑤. 운영관리자 화면(admin.html)의 「문의 대장」「고객 대장」 탭에서 쓴다.
 *
 * · 이 컴퓨터에서 열 때만 동작한다(file:// 또는 localhost). 공개 주소(github.io·pages.dev)에서는 탭을 숨긴다.
 *   — 연습용이라 실제 시민 정보를 넣으면 안 되고, 직원이 함께 보는 대장은 6회차에 Supabase로 만든다.
 * · 저장은 이 컴퓨터 브라우저의 localStorage 뿐이다(서버로 가지 않음). 키: company_inquiries_v1
 * · 응대 단계와 계약 결과는 서로 다른 칸이다. 계약 결과가 비어 있으면 「미입력」 배지가 붙는다.
 * · 같은 사람은 이름이 아니라 「연락처(숫자만)」로 판단해 같은 고객번호(C-0001 꼴)로 묶는다.
 * · 「처음 알게 된 경로」는 고객을 처음 만들 때 한 번만 저장하고 바뀌지 않는다. 문의의 경로는 문의마다 따로 남는다.
 * · 경로 값은 홈페이지 문의 폼(Supabase inquiries.source)과 같다 → 나중에 이어 붙일 때 그대로 붙는다.
 */
(function () {
  "use strict";
  const IS_LOCAL = location.protocol === "file:" || ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  const tabBtns = document.querySelectorAll('.admin-tab[data-tab="inq"], .admin-tab[data-tab="cust"]');
  const panels = document.querySelectorAll("#tab-inq, #tab-cust");
  if (!IS_LOCAL) {            // 공개 주소에서는 탭과 화면을 아예 없앤다
    tabBtns.forEach(b => b.remove()); panels.forEach(p => p.remove());
    return;
  }
  tabBtns.forEach(b => { b.style.display = ""; });

  const STORE_KEY = "company_inquiries_v1";
  const SOURCES = { search: "검색", map: "지도", referral: "지인 소개", sns: "SNS", phone: "전화", other: "기타", unknown: "모르겠음" };
  const STAGES = ["접수", "연락중", "상담완료"];
  const RESULTS = ["계약", "보류", "실패"];
  const PRODUCTS = ["시민동아리", "사회연대경제 창업교육", "농촌크리에이투어", "공간대관", "기타"];

  const $ = id => document.getElementById("lg-" + id);
  const todayStr = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const qno = id => "Q-" + String(id).padStart(4, "0");
  const cno = id => "C-" + String(id).padStart(4, "0");
  const digits = s => String(s || "").replace(/\D/g, "");

  /* ── 저장 (localStorage) — 못 쓰는 환경이어도 화면은 동작한다 ── */
  let storageOk = true;
  const emptyDb = () => ({ v: 2, nextId: 1, nextCustomerId: 1, rows: [], customers: [] });
  let memory = emptyDb();

  // 옛 저장본(고객 없음)이나 깨진 값을 새 형식으로 맞춘다. 같은 연락처는 같은 고객으로 묶고, 가장 이른 문의의 경로를 처음 경로로 삼는다.
  function normalize(d) {
    if (!d || typeof d !== "object") return emptyDb();
    d.rows = (Array.isArray(d.rows) ? d.rows : []).filter(r => r && typeof r.id === "number" && r.phone);
    d.customers = (Array.isArray(d.customers) ? d.customers : []).filter(c => c && typeof c.id === "number" && c.phone);
    d.nextId = Math.max(Number(d.nextId) || 1, ...d.rows.map(r => r.id + 1), 1);
    d.nextCustomerId = Math.max(Number(d.nextCustomerId) || 1, ...d.customers.map(c => c.id + 1), 1);
    const ordered = d.rows.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
    ordered.forEach(r => {
      let c = d.customers.find(x => x.id === r.customerId) || d.customers.find(x => x.phone === r.phone);
      if (!c) {
        c = { id: d.nextCustomerId++, name: r.name, phone: r.phone, firstSource: r.source, firstDate: r.date };
        d.customers.push(c);
      }
      r.customerId = c.id;
    });
    d.v = 2;
    return d;
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? normalize(JSON.parse(raw)) : emptyDb();
    } catch (e) { storageOk = false; return memory; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }
    catch (e) { storageOk = false; }
    if (!storageOk) setMsg("note", "이 브라우저에서는 저장할 수 없어 화면을 닫으면 사라집니다. (시크릿 창이면 일반 창에서 열어 주세요)");
  }
  let db = load();
  memory = db;
  if (storageOk) save();   // 옛 저장본이었다면 새 형식으로 한 번 저장

  /* ── 작은 도구 ── */
  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => { if (k === "class") e.className = v; else if (k === "text") e.textContent = v; else e.setAttribute(k, v); });
    kids.forEach(k => { if (k != null) e.append(k.nodeType ? k : document.createTextNode(k)); });
    return e;
  }
  function fmtPhone(d) {
    if (d.length === 11) return d.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
    if (d.length === 10) return d.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
    if (d.length === 9) return d.replace(/(\d{2})(\d{3})(\d{4})/, "$1-$2-$3");
    return d;
  }
  function setMsg(kind, text) { const m = $("msg"); if (!m) return; m.className = "lg-msg " + kind; m.textContent = text; }
  const customerOf = id => db.customers.find(c => c.id === id);
  const rowsOf = id => db.rows.filter(r => r.customerId === id);

  /* ── 화면 ── */
  function fillSelects() {
    PRODUCTS.forEach(p => $("product").append(el("option", { value: p, text: p })));
    Object.entries(SOURCES).forEach(([v, t]) => $("source").append(el("option", { value: v, text: t })));
    $("date").value = todayStr();
  }

  function resultBadge(r) {
    if (!r) return el("span", { class: "lg-badge missing", text: "미입력" });
    if (r === "계약") return el("span", { class: "lg-badge done", text: "계약" });
    if (r === "보류") return el("span", { class: "lg-badge hold", text: "보류" });
    return el("span", { class: "lg-badge fail", text: r });
  }

  function renderSummary() {
    const total = db.rows.length;
    const month = todayStr().slice(0, 7);
    const thisMonth = db.rows.filter(r => String(r.date).slice(0, 7) === month).length;
    const missing = db.rows.filter(r => !r.result).length;
    const pct = total ? Math.round(missing / total * 100) : 0;
    const stat = (n, label, warn) => el("div", { class: "lg-stat" + (warn ? " warn" : "") }, el("b", { text: n }), el("span", { text: label }));
    document.querySelectorAll(".lg-summary").forEach(box => {
      box.replaceChildren(stat(db.customers.length + "명", "고객"), stat(total + "건", "전체 문의"), stat(thisMonth + "건", "이번 달(" + month + ") 접수"),
        stat(missing + "건", "계약 결과 미입력" + (total ? " · 전체의 " + pct + "%" : ""), missing > 0));
    });
  }

  function renderInquiries() {
    const tb = $("rows"); tb.replaceChildren();
    const rows = db.rows.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
    if (!rows.length) { tb.append(el("tr", {}, el("td", { class: "lg-empty", colspan: "8", text: "아직 문의가 없습니다. 위에서 가상 문의를 하나 넣어 보세요." }))); return; }
    rows.forEach(r => {
      const stageSel = el("select", { "aria-label": "응대 단계" }, ...STAGES.map(s => { const o = el("option", { value: s, text: s }); if (r.stage === s) o.selected = true; return o; }));
      stageSel.addEventListener("change", () => { r.stage = stageSel.value; save(); renderCustomers(); });

      const resSel = el("select", { "aria-label": "계약 결과" }, el("option", { value: "", text: "(비어 있음)" }),
        ...RESULTS.map(s => { const o = el("option", { value: s, text: s }); if (r.result === s) o.selected = true; return o; }));
      const badgeSlot = el("span", {}, resultBadge(r.result));
      resSel.addEventListener("change", () => { r.result = resSel.value || ""; save(); badgeSlot.replaceChildren(resultBadge(r.result)); renderSummary(); renderCustomers(); });

      const del = el("button", { class: "lg-del", type: "button", text: "지우기" });
      del.addEventListener("click", () => removeInquiry(r));

      tb.append(el("tr", {},
        el("td", { text: r.date }),
        el("td", {}, r.name, el("span", { class: "lg-sub", text: "고객 " + cno(r.customerId) + " · " + qno(r.id) })),
        el("td", { text: fmtPhone(r.phone) }),
        el("td", { text: r.product || "—" }),
        el("td", { text: SOURCES[r.source] || r.source }),
        el("td", {}, stageSel),
        el("td", {}, resSel, badgeSlot),
        el("td", {}, del)));
    });
  }

  const openSet = new Set();   // 펼쳐 둔 고객
  function renderCustomers() {
    const tb = $("cust-rows"); tb.replaceChildren();
    if (!db.customers.length) { tb.append(el("tr", {}, el("td", { class: "lg-empty", colspan: "5", text: "아직 고객이 없습니다. 문의를 넣으면 연락처로 고객이 만들어집니다." }))); return; }
    db.customers.slice().sort((a, b) => a.id - b.id).forEach(c => {
      const mine = rowsOf(c.id);
      const contracts = mine.filter(r => r.result === "계약").length;   // 결과가 비어 있으면 세지 않는다
      const isOpen = openSet.has(c.id);

      const tg = el("button", { class: "lg-toggle", type: "button", "aria-expanded": String(isOpen), "aria-label": cno(c.id) + " 문의 펼치기", text: isOpen ? "▾" : "▸" });
      const tr = el("tr", { class: "lg-cust-row" },
        el("td", {}, tg, cno(c.id)),
        el("td", {}, c.name, el("span", { class: "lg-sub", text: fmtPhone(c.phone) })),
        el("td", {}, el("span", { class: "lg-badge first", text: SOURCES[c.firstSource] || c.firstSource }), el("span", { class: "lg-sub", text: "바뀌지 않음 · 첫 문의 " + (c.firstDate || "") })),
        el("td", { class: mine.length ? "" : "lg-num0", text: mine.length + "건" }),
        el("td", { class: contracts ? "lg-num-pos" : "lg-num0", text: contracts + "건" }));
      tr.addEventListener("click", () => { if (openSet.has(c.id)) openSet.delete(c.id); else openSet.add(c.id); renderCustomers(); });
      tb.append(tr);

      if (isOpen) {
        const inner = el("table", { class: "lg-small" },
          el("thead", {}, el("tr", {}, ...["문의번호", "접수일", "그때의 경로", "관심 서비스", "응대 단계", "계약 결과"].map(t => el("th", { text: t })))),
          el("tbody", {}, ...mine.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id)).map(r =>
            el("tr", {}, el("td", { text: qno(r.id) }), el("td", { text: r.date }), el("td", { text: SOURCES[r.source] || r.source }),
              el("td", { text: r.product || "—" }), el("td", { text: r.stage }), el("td", {}, resultBadge(r.result))))));
        tb.append(el("tr", { class: "lg-detail" }, el("td", { colspan: "5" },
          el("div", { class: "lg-note", text: "「처음 알게 된 경로」는 " + (SOURCES[c.firstSource] || c.firstSource) + " 그대로이고, 아래 문의의 경로는 문의마다 따로 남습니다. 이 분이 문의할 때 적은 이름: " + [...new Set(mine.map(r => r.name))].join(", ") }),
          inner)));
      }
    });
  }
  function render() { renderSummary(); renderInquiries(); renderCustomers(); }

  /* ── 문의 지우기 — 그 고객의 문의가 하나도 안 남으면 고객도 함께 정리한다 ── */
  function removeInquiry(r) {
    const c = customerOf(r.customerId);
    const last = rowsOf(r.customerId).length === 1;
    const ask = qno(r.id) + " " + r.name + " 문의를 지울까요? (연습 데이터)" + (last && c ? "\n이 고객(" + cno(c.id) + ")의 마지막 문의라서 고객도 함께 지워집니다." : "");
    if (!confirm(ask)) return;
    db.rows = db.rows.filter(x => x.id !== r.id);
    if (last) { db.customers = db.customers.filter(x => x.id !== r.customerId); openSet.delete(r.customerId); }
    save(); render();
  }

  /* ── 새 문의 저장: 연락처로 같은 고객을 찾고, 없으면 새 고객번호를 만든다 ── */
  $("form").addEventListener("submit", e => {
    e.preventDefault();
    const date = $("date").value;
    const name = $("name").value.trim();
    const phone = digits($("phone").value);   // 숫자만 남겨서 비교한다 (이름이 아니라 연락처)
    const source = $("source").value;
    if (!date) return setMsg("err", "접수일을 골라 주세요.");
    if (!name) return setMsg("err", "이름을 적어 주세요.");
    if (!/^[0-9]{9,11}$/.test(phone)) return setMsg("err", "연락처는 숫자 9~11자리로 적어 주세요. (예: 010-0000-0001)");
    if (!source) return setMsg("err", "「어디서 알고 오셨나요」를 선택해 주세요.");

    let c = db.customers.find(x => x.phone === phone);
    const isNew = !c;
    if (isNew) {
      // 처음 알게 된 경로는 이때 한 번만 정한다. 이후 문의가 와도 고치지 않는다.
      c = { id: db.nextCustomerId++, name, phone, firstSource: source, firstDate: date };
      db.customers.push(c);
    }
    const qid = db.nextId++;
    db.rows.push({ id: qid, customerId: c.id, date, name, phone, product: $("product").value, source, stage: "접수", result: "" });
    save();
    openSet.add(c.id);
    render();
    setMsg("ok", qno(qid) + " 접수했습니다. " + (isNew
      ? "새 고객 " + cno(c.id) + "로 만들었고, 처음 알게 된 경로는 「" + SOURCES[source] + "」입니다."
      : "같은 연락처의 기존 고객 " + cno(c.id) + "로 묶었습니다 (처음 알게 된 경로 「" + SOURCES[c.firstSource] + "」는 그대로).")
      + (name.startsWith("가상") ? "" : " — 실제 시민 정보는 이 연습 화면에 넣지 마세요(가상 이름 권장)."));
    $("name").value = ""; $("phone").value = ""; $("product").value = ""; $("source").value = ""; $("name").focus();
  });

  $("clear").addEventListener("click", () => {
    if (!db.rows.length && !db.customers.length) return;
    if (!confirm("연습 데이터(문의 " + db.rows.length + "건, 고객 " + db.customers.length + "명)를 모두 지울까요? 되돌릴 수 없습니다.")) return;
    db = emptyDb(); memory = db; openSet.clear(); save(); render(); setMsg("note", "모두 지웠습니다.");
  });

  fillSelects();
  if (!storageOk) setMsg("note", "이 브라우저에서는 저장할 수 없어 화면을 닫으면 사라집니다. (시크릿 창이면 일반 창에서 열어 주세요)");
  render();
})();
