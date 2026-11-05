/*
 * 기회의 장부 (운영관리자 › 기회의 장부) — 9회차. 공고를 우리 회사 기준 ✓ ✗ 모름으로 판정한 표를 보여 준다.
 *
 * · 판정 내용은 이 파일에 없다. 수파베이스(acais-erp)의 opps · opp_stage · opp_meta 표에서 읽어 오며,
 *   표는 RLS 로 단장 · 사무국(is_office)만 읽고 쓴다. 이 코드는 공개돼도 내용은 새지 않는다(로그아웃 · 방문자는 0줄/거부).
 * · 규칙: 한 칸이라도 ✗ 이면 ✗ · ✗ 없이 모름이 있으면 「모름(확인 필요)」 · 전부 ✓ 일 때만 ✓. 모름은 ✓로 올리지 않는다.
 * · 마감 D-day 는 저장하지 않고 오늘 날짜로 그때그때 센다. 진행 상태(발견됨 · 검토 중 · 신청함 · 넣지 않음)는 opp_stage 에 저장돼 사무국이 함께 본다.
 * · 판정은 공고 요약 기준이다. 마감 · 자격 · 한도는 신청 직전 첨부 공고문 원문과 담당기관 문의로 다시 확인한다.
 */
(function () {
  const $ = id => document.getElementById(id);
  const E = x => String(x == null ? "" : x).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const LAB = { y: "✓", n: "✗", u: "모름" }, CLS = { y: "ok", n: "no", u: "unk" };
  const KIND = { revenue: ["수주", "#3f7a52"], cash: ["현금성", "#c67b3c"], service: ["교육·컨설팅", "#6b7785"], system: ["지정·제도", "#7a4fd1"] };
  const KIND_RANK = { revenue: 0, cash: 1, service: 2, system: 3 };
  const STAGES = [["found", "발견됨"], ["reviewing", "검토 중"], ["applied", "신청함"], ["skipped", "넣지 않음"]];
  const HEAD = ["소재지", "규모", "업종", "업력", "제외·재무"];
  const short = (t, n) => t.length > n ? t.slice(0, n) + "…" : t;

  let me = null, rows = [], stage = {}, meta = {};

  const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  const daysLeft = c => { const p = c.split("-"); return Math.round((new Date(+p[0], +p[1] - 1, +p[2]) - today()) / 864e5); };
  const verdict = cells => { const v = cells.map(c => c[0]); return v.indexOf("n") >= 0 ? "n" : v.indexOf("u") >= 0 ? "u" : "y"; };
  const stageOf = id => stage[id] || "found";
  const chip = s => `<span class="op-chip ${CLS[s]}">${LAB[s]}</span>`;
  const vchip = s => `<span class="op-chip ${CLS[s]}" style="font-size:13px;padding:2px 11px">${s === "u" ? "모름(확인 필요)" : LAB[s]}</span>`;
  const kindTag = k => `<span style="display:inline-block;background:${KIND[k][1]};color:#fff;border-radius:10px;padding:0 8px;font-size:11.5px;font-weight:700;margin-right:6px">${KIND[k][0]}</span>`;
  const dday = c => {
    if (!c) return `<span class="op-chip gray">날짜 없음 · 원문 확인</span>`;
    const n = daysLeft(c), cls = n <= 7 ? "no" : n <= 14 ? "unk" : "ok";
    return `<span class="op-chip ${cls}">${n < 0 ? "마감 지남" : n === 0 ? "D-day" : "D-" + n}</span><div class="op-sm">${E(c)}</div>`;
  };

  function css() {
    if ($("op-css")) return;
    const s = document.createElement("style"); s.id = "op-css";
    s.textContent = ".op-note{background:#fff4d6;border:1px solid #f0d78a;border-radius:10px;padding:10px 14px;font-size:12.5px;line-height:1.7;margin-bottom:14px}" +
      ".op-box{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px;margin-bottom:14px}.op-box h2{margin:0 0 10px;font-size:15px}" +
      ".op-sum{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:6px}.op-stat{background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 16px;min-width:130px}" +
      ".op-stat b{display:block;font-size:22px;line-height:1.2}.op-stat span{font-size:12px;color:var(--sub)}" +
      ".op-chip{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11.5px;font-weight:700;margin:0 4px 3px 0;white-space:nowrap}" +
      ".op-chip.ok{background:#eaf7f0;color:#1f7a47}.op-chip.no{background:#fdecea;color:#c4301c}.op-chip.unk{background:#fff4d6;color:#8a6200}.op-chip.gray{background:#eef0f3;color:#6b7280}.op-chip.blue{background:#eaf1ff;color:#2757a6}" +
      ".op-sm{font-size:11.5px;color:var(--sub)}.op-cellnote{font-size:11.5px;color:#4a5866;margin-top:3px;line-height:1.45}" +
      ".op-wrap{overflow-x:auto}.op-wrap table{width:100%;border-collapse:collapse;min-width:1000px}.op-wrap th{text-align:left;font-size:12px;color:var(--sub);background:#f3f5f8;padding:9px 10px;border-bottom:1px solid var(--line);white-space:nowrap}" +
      ".op-wrap td{padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top;font-size:13px}" +
      ".op-stage{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}.op-stage button{border:1px solid #c9d0d8;background:#fff;border-radius:7px;padding:1px 8px;font:inherit;font-size:11.5px;cursor:pointer;color:#2b3a4e}.op-stage button.on{background:#2b3a4e;color:#fff;border-color:#2b3a4e}" +
      ".op-fun{display:flex;flex-wrap:wrap;gap:6px;align-items:stretch;margin:4px 0 12px}.op-fun div{flex:1 1 130px;background:#f7f3ee;border:1px solid #e4ded5;border-radius:10px;padding:8px 10px;text-align:center}.op-fun div b{display:block;font-size:20px;color:#2b3a4e}.op-fun div span{font-size:12px;color:#6b7785}.op-fun i{align-self:center;color:#c67b3c;font-style:normal;font-weight:800}" +
      ".op-btn{border:0;background:#e8631c;color:#fff;border-radius:9px;padding:8px 16px;font:inherit;font-weight:700;cursor:pointer}";
    document.head.appendChild(s);
  }

  function table() {
    const list = rows.slice().sort((a, b) => (KIND_RANK[a.kind] - KIND_RANK[b.kind]) || ((a.close_on || "9999") < (b.close_on || "9999") ? -1 : 1));
    return `<div class="op-wrap"><table><thead><tr><th style="width:27%">공고</th><th style="width:96px">마감</th>${HEAD.map(h => `<th>${h}</th>`).join("")}<th>판정</th></tr></thead><tbody>` +
      list.map(g => `<tr><td>${kindTag(g.kind)}<b>${E(g.title)}</b><br><span class="op-sm">${E(g.org)}</span>${g.url ? ` <a href="${E(g.url)}" target="_blank" rel="noopener" style="font-size:12px">공고 보기 ↗</a>` : ""}
          <div class="op-stage" data-id="${E(g.id)}">${STAGES.map(s => `<button type="button" data-st="${s[0]}"${s[0] === stageOf(g.id) ? ' class="on"' : ""}>${s[1]}</button>`).join("")}</div></td>
        <td>${dday(g.close_on)}</td>
        ${g.cells.map(c => `<td>${chip(c[0])}<div class="op-cellnote">${E(c[1])}</div></td>`).join("")}
        <td>${vchip(verdict(g.cells))}</td></tr>`).join("") + `</tbody></table></div>` +
      `<div style="margin-top:8px;font-size:12.5px;color:var(--sub);line-height:1.7">${list.map(g => `<div><b>${E(short(g.title, 34))}</b> — ${E(g.why)}</div>`).join("")}</div>`;
  }

  function stats() {
    const open = rows.filter(g => verdict(g.cells) !== "n" && stageOf(g.id) !== "skipped");
    const week = open.filter(g => { if (!g.close_on) return false; const n = daysLeft(g.close_on); return n >= 0 && n <= 7; });
    const c = [["수주 기회", open.filter(g => g.kind === "revenue").length], ["현금성 지원", open.filter(g => g.kind === "cash").length],
      ["이번 주 마감", week.length], ["아직 안 본 것", open.filter(g => stageOf(g.id) === "found").length]];
    return `<div class="op-sum">${c.map(x => `<div class="op-stat"><b>${x[1]}건</b><span>${x[0]}</span></div>`).join("")}</div>
      <p class="op-sm" style="margin:0 0 12px">✗ 로 판정된 것과 「넣지 않음」은 세지 않습니다. 상태를 바꾸면 숫자가 바뀝니다.</p>`;
  }

  function callRows() {
    const out = [];
    rows.forEach(g => { if (verdict(g.cells) === "n") return; g.cells.forEach((c, i) => { if (c[0] === "u") out.push([g, HEAD[i], c[1]]); }); });
    return out;
  }

  function icsData() {
    const pick = rows.filter(g => g.close_on && verdict(g.cells) !== "n" && stageOf(g.id) !== "skipped");
    const dt = c => c.replace(/-/g, "") + "T180000";
    const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//acais-erp//opps//KO", "CALSCALE:GREGORIAN"];
    pick.forEach(g => L.push("BEGIN:VEVENT", "UID:" + g.id + "@acais-erp-opps", "DTSTART;TZID=Asia/Seoul:" + dt(g.close_on), "DTEND;TZID=Asia/Seoul:" + dt(g.close_on),
      "SUMMARY:[마감] " + g.title.replace(/[,;]/g, " "), "DESCRIPTION:신청 직전 공고문 원문 재확인",
      "BEGIN:VALARM", "TRIGGER:-P14D", "ACTION:DISPLAY", "DESCRIPTION:14일 전", "END:VALARM", "BEGIN:VALARM", "TRIGGER:-P7D", "ACTION:DISPLAY", "DESCRIPTION:7일 전", "END:VALARM", "END:VEVENT"));
    L.push("END:VCALENDAR");
    return { n: pick.length, text: L.join("\r\n") };
  }

  function draw() {
    const root = $("tab-opps"); if (!root) return;
    css();
    const cal = icsData(), calls = callRows(), f = meta.funnel, r = meta.radar;
    root.innerHTML = `
      <div class="op-note"><b>단장 · 사무국만 보는 화면입니다.</b> 공고를 우리 지원단(안성시 위탁 중간지원조직) 기준으로 ✓ ✗ 모름으로 판정한 표입니다.
        판정은 공고 요약 기준이라 <b>마감 · 자격 · 한도는 신청 직전 첨부 공고문 원문과 담당기관 문의로 다시 확인</b>합니다. 법인 형태 · 업종 · 설립연도는 아직 몰라 「모름」입니다.</div>
      ${stats()}
      ${r ? `<div class="op-box"><h2>자동 레이더 — 매일 아침 후보가 이슈로 올라옵니다</h2>
        <div style="font-size:13.5px;line-height:1.9"><span class="op-chip ok">연결됨</span><span class="op-chip ok">${E(r.first_run)} 수동 실행 ${E(r.first_run_result)}</span><span class="op-chip blue">${E(r.schedule)} 자동</span><br>
          깃헙 액션이 기업마당 공고를 받아 우리 조건으로 거르고, 후보를 비공개 저장소의 이슈로 올립니다(GitHub이 메일로도 알려 줍니다). 이 장부는 그 후보를 사람이 ✓ ✗ 모름으로 판정해 옮겨 적는 곳입니다.
          <div style="margin-top:6px"><a href="${E(r.issues)}" target="_blank" rel="noopener">오늘의 후보 이슈 보기 ↗</a> · <a href="${E(r.actions)}" target="_blank" rel="noopener">실행 기록 보기 ↗</a></div></div>
        <div class="op-sm" style="margin-top:8px">기계는 거르기까지만 합니다 — 후보는 「신청 가능」이 아닙니다. 같은 후보가 매일 올라오니 이미 본 이슈는 닫으세요. 남은 것: ${E(r.todo)}.</div></div>` : ""}
      ${f ? `<div class="op-box"><h2>레이더가 거르는 모습 — ${E(f.asof)} ${E(f.source)}</h2>
        <div class="op-fun">${f.steps.map((s, i) => (i ? "<i>→</i>" : "") + `<div><b>${Number(s[1]).toLocaleString()}</b><span>${E(s[0])}</span></div>`).join("")}</div>
        <div class="op-wrap"><table style="min-width:520px"><thead><tr><th>빠진 이유 — 지우지 않고 이유를 남깁니다</th><th style="width:100px">건수</th></tr></thead><tbody>${f.out.map(o => `<tr><td>${E(o[0])}</td><td>${Number(o[1]).toLocaleString()}</td></tr>`).join("")}</tbody></table></div>
        <div class="op-sm" style="margin-top:8px">제목 · 요약의 말로 좁히는 방식이라 놓치는 공고가 있을 수 있어서, 걸러진 건수를 함께 남깁니다.</div></div>` : ""}
      <div class="op-box"><h2>정부지원사업 — 기업마당 (수주 → 현금성 → 교육·컨설팅 → 지정·제도 순)</h2>
        <p class="op-sm" style="margin:0 0 8px">칸 5개: 소재지 · 규모 · 업종 · 업력 · 제외·재무. 요건은 <b>첨부 공고문(.hwp · .pdf)</b>에 있어서 「모름」이 많이 나옵니다. 지원단은 기업이 아니라 위탁 운영 기관이라 ✗ 도 나오는데, 그 공고가 센터가 만나는 시민 · 조직에게는 맞을 수 있어 아래 「뒤집어 읽기」에서 다시 봅니다.</p>
        ${rows.length ? table() : '<p class="op-sm">들어 있는 공고가 없습니다.</p>'}</div>
      <div class="op-box"><h2>공공입찰 — 나라장터 (키 연결 전)</h2>
        <p class="op-sm" style="margin:0">나라장터 키(<code>NARA_KEY</code>)를 받으면 같은 방식으로 이 칸에 채웁니다. 투찰가 · 하한율 · 낙찰 전략은 다루지 않습니다.</p></div>
      <div class="op-box"><h2>뒤집어 읽기 — 이 공고가 우리 센터가 만나는 사람에게 무엇을 주나</h2>
        <div class="op-wrap"><table style="min-width:640px"><thead><tr><th style="width:36%">지원사업</th><th>수혜자가 받는 것 · 우리가 연결할 수 있는 길</th></tr></thead><tbody>${rows.map(g => `<tr><td>${kindTag(g.kind)}${E(short(g.title, 34))}</td><td>${E(g.flip)}</td></tr>`).join("")}</tbody></table></div>
        <div class="op-sm" style="margin-top:8px">공고 요약으로 정리한 예시입니다 ★원문 확인 전. 지원단이 직접 신청하는 것과 센터가 안내하는 것은 별개의 일입니다.</div></div>
      <div class="op-box"><h2>전화로 물어볼 것 — 모름 칸 모음</h2>
        <div class="op-wrap"><table style="min-width:760px"><thead><tr><th style="width:30%">공고</th><th style="width:12%">칸</th><th>물어볼 것</th><th style="width:24%">어디에</th></tr></thead><tbody>${calls.map(c => `<tr><td>${E(short(c[0].title, 30))}</td><td>${E(c[1])}</td><td>${E(c[2])}</td><td>${E(c[0].contact)}</td></tr>`).join("")}</tbody></table></div>
        <div class="op-sm" style="margin-top:8px">✗ 로 끝난 공고는 빠집니다. 먼저 첨부 공고문에서 찾아보고, 없으면 전화합니다. 법인 형태 · 업종 · 설립연도는 공고가 아니라 <b>우리 쪽 정보</b>라서 대표님께 먼저 확인합니다.</div></div>
      <div class="op-box"><h2>마감 캘린더에 넣기</h2>
        <p class="op-sm" style="margin:0 0 8px">✗ 가 아니고 「넣지 않음」도 아닌 공고 중 <b>마감 날짜가 있는 ${cal.n}건</b>을 캘린더 파일(.ics)로 내려받습니다. 구글 캘린더에 가져오면 <b>14일 전 · 7일 전 알림</b>이 함께 들어갑니다. 「예산 소진시까지」 공고는 날짜가 없어 빠집니다.</p>
        <button type="button" class="op-btn" id="op-ics">📅 마감 ${cal.n}건 캘린더 파일 내려받기</button></div>
      <div class="op-note" style="background:#eef3ff;border-color:#c7d6f5"><b>규칙 한 줄</b> — 한 칸이라도 ✗ 이면 ✗ · ✗ 없이 모름이 있으면 「모름(확인 필요)」 · 전부 ✓ 일 때만 ✓. 모름은 ✓로 올리지 않습니다.</div>`;
    root.querySelectorAll(".op-stage").forEach(box => box.addEventListener("click", async e => {
      const b = e.target.closest("button"); if (!b) return;
      const id = box.dataset.id, st = b.dataset.st;
      const { error } = await sb.from("opp_stage").upsert({ opp_id: id, stage: st, updated_by: me ? me.id : null, updated_at: new Date().toISOString() });
      if (error) { alert(sbErr(error)); return; }
      stage[id] = st; draw();
    }));
    const ics = $("op-ics");
    if (ics) ics.addEventListener("click", () => {
      const c = icsData(), a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([c.text], { type: "text/calendar;charset=utf-8" })); a.download = "opps_deadlines.ics";
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    });
  }

  /** admin.html 이 로그인(단장·사무국)을 확인한 뒤 부른다 */
  window.loadOpps = async function (staffRow) {
    me = staffRow;
    const root = $("tab-opps"); if (!root) return;
    root.innerHTML = '<p class="op-sm">불러오는 중...</p>';
    const [o, s, m] = await Promise.all([
      sb.from("opps").select("*").order("sort"),
      sb.from("opp_stage").select("opp_id,stage"),
      sb.from("opp_meta").select("key,value"),
    ]);
    const err = o.error || s.error || m.error;
    if (err) { root.innerHTML = `<p class="op-sm" style="color:#c4301c">${E(sbErr(err))}</p>`; return; }
    rows = o.data || [];
    stage = {}; (s.data || []).forEach(x => { stage[x.opp_id] = x.stage; });
    meta = {}; (m.data || []).forEach(x => { meta[x.key] = x.value; });
    draw();
  };
})();
