/*
 * 시민활동통합지원단 ERP — Supabase 연결 (공용)
 * 앞에 supabase-js v2 를 먼저 불러야 한다:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *   <script src="assets/sb.js"></script>
 *
 * publishable key 는 공개돼도 되는 키다. 데이터 보호는 데이터베이스의 RLS·함수가 맡는다.
 * 로그인은 탭마다 따로 기억한다(sessionStorage) — 탭 두 개에 서로 다른 직원으로 들어가
 * 결재·대화를 주고받아 볼 수 있게 하기 위함. 같은 탭에서 페이지를 옮겨 다니면 로그인은 유지된다.
 * 단, 휴대폰 홈 화면에 설치한 앱(단톡 웹앱)으로 실행될 때는 localStorage 에 기억한다 — 앱을 닫았다 열어도 로그인이 유지되게.
 */
(function () {
  const SB_URL = "https://vwobpxyqsiynlybasnek.supabase.co";
  const SB_KEY = "sb_publishable_eujFGfxRNaVQ3TKtg3iWMw_9OohMjZo";
  if (!window.supabase || !window.supabase.createClient) {
    console.error("supabase-js 가 먼저 로드되지 않았습니다.");
    return;
  }
  const installedApp = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  let storage;
  try {
    const s = installedApp ? window.localStorage : window.sessionStorage;
    s.setItem("__sb_t", "1"); s.removeItem("__sb_t"); storage = s;
  } catch (e) { storage = undefined; } // 저장소를 못 쓰는 환경이면 기본값(메모리)으로
  window.sb = window.supabase.createClient(SB_URL, SB_KEY, {
    auth: { storage, storageKey: "acais-erp-auth", persistSession: true, autoRefreshToken: true },
  });

  /** 로그인한 직원의 staff 행 { id, email, name, role, center, active }. 로그인 안 했으면 null */
  window.sbMe = async function () {
    const { data: { session } } = await window.sb.auth.getSession();
    if (!session) return null;
    const { data, error } = await window.sb.from("staff")
      .select("id,email,name,role,center,active").eq("id", session.user.id).maybeSingle();
    if (error) throw error;
    return data;
  };

  /** 오류를 화면에 보여줄 한국어 한 줄로 */
  window.sbErr = function (e) {
    if (!e) return "";
    const msg = e.message || String(e);
    if (/Invalid login credentials/i.test(msg)) return "이메일 또는 비밀번호가 올바르지 않습니다.";
    if (/Email not confirmed/i.test(msg)) return "이메일 확인이 아직 안 된 계정입니다. 받은 메일의 확인 링크를 눌러 주세요.";
    if (/Failed to fetch|NetworkError/i.test(msg)) return "서버에 연결하지 못했습니다.";
    return msg;
  };
})();
