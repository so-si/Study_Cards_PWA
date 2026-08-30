(() => {
  const GOAL = 40;
  const TOKEN_KEY = 'studyCardsApiTokenV1';
  const PENDING_KEY = 'studyCardsPendingV1';
  const CACHE_KEY = 'studyCardsNudgeStatusV1';

  let currentStatus = null;

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function jstDateString(value) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(value instanceof Date ? value : new Date(value));
    const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${map.year}-${map.month}-${map.day}`;
  }

  function pendingToday() {
    try {
      const list = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
      if (!Array.isArray(list)) return 0;
      const today = jstDateString(new Date());
      return list.filter(x => x && x.timestamp && jstDateString(x.timestamp) === today).length;
    } catch (_) {
      return 0;
    }
  }

  function apiRequest(action) {
    const apiUrl = (window.STUDY_CARDS_CONFIG || {}).apiUrl || '';
    if (!apiUrl || !token()) return Promise.reject(new Error('API未設定'));

    return new Promise((resolve, reject) => {
      const cb = 'sc_nudge_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const script = document.createElement('script');
      let timer;

      function finish(err, val) {
        clearTimeout(timer);
        try { delete window[cb]; } catch (_) {}
        script.remove();
        err ? reject(err) : resolve(val);
      }

      window[cb] = data => {
        if (!data || data.success === false) finish(new Error(data && data.error || 'APIエラー'));
        else finish(null, data);
      };

      timer = setTimeout(() => finish(new Error('timeout')), 15000);
      const q = new URLSearchParams({
        action,
        callback: cb,
        token: token(),
        payload: '{}'
      });
      script.src = apiUrl + '?' + q.toString();
      script.onerror = () => finish(new Error('接続失敗'));
      document.head.appendChild(script);
    });
  }

  function ensureUi() {
    if (document.getElementById('studyNudgeCard')) return;
    const setupPanel = document.querySelector('#setup .panel');
    if (!setupPanel) return;

    const card = document.createElement('div');
    card.id = 'studyNudgeCard';
    card.className = 'card';
    card.innerHTML = `
      <div style="font-size:14px;color:#aaa;margin-bottom:6px">今日の目標</div>
      <div id="studyNudgeCount" style="font-size:28px;font-weight:850">0 / ${GOAL}問</div>
      <div id="studyNudgeRemaining" style="font-size:14px;color:#aaa;margin-top:5px">あと${GOAL}問</div>
      <div style="height:9px;background:#333;border-radius:999px;overflow:hidden;margin-top:13px">
        <div id="studyNudgeProgress" style="height:100%;width:0%;background:#f5f5f5;border-radius:999px;transition:width .2s"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px">
        <div style="border:1px solid #333;border-radius:12px;padding:11px;background:#111">
          <div id="studyNudgeStreak" style="font-size:21px;font-weight:850">0日</div>
          <div style="font-size:12px;color:#999">連続達成</div>
        </div>
        <div style="border:1px solid #333;border-radius:12px;padding:11px;background:#111">
          <div id="studyNudgeTotal" style="font-size:21px;font-weight:850">0回</div>
          <div style="font-size:12px;color:#999">通算達成</div>
        </div>
      </div>`;

    setupPanel.insertBefore(card, setupPanel.firstChild);
  }

  function render(status) {
    ensureUi();
    if (!status) return;
    currentStatus = status;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(status)); } catch (_) {}

    const count = Number(status.count || 0);
    const remaining = Math.max(GOAL - count, 0);
    const pct = Math.min(count / GOAL * 100, 100);
    const streak = Number(status.currentStreak || 0);
    const total = Number(status.totalAchievements || 0);

    const countEl = document.getElementById('studyNudgeCount');
    const remainingEl = document.getElementById('studyNudgeRemaining');
    const progressEl = document.getElementById('studyNudgeProgress');
    const streakEl = document.getElementById('studyNudgeStreak');
    const totalEl = document.getElementById('studyNudgeTotal');

    if (countEl) countEl.textContent = `${count} / ${GOAL}問`;
    if (remainingEl) remainingEl.textContent = remaining > 0 ? `あと${remaining}問` : '本日の目標達成';
    if (progressEl) progressEl.style.width = pct + '%';
    if (streakEl) streakEl.textContent = `${streak}日`;
    if (totalEl) totalEl.textContent = `${total}回`;
  }

  function loadCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached) render(cached);
    } catch (_) {}
  }

  async function refresh() {
    if (!navigator.onLine || !token()) return;
    try {
      const response = await apiRequest('getNudgeStatus');
      if (!response.status) return;
      const status = { ...response.status };
      status.count = Number(status.count || 0) + pendingToday();
      status.goal = GOAL;
      status.remaining = Math.max(GOAL - status.count, 0);
      status.achieved = status.count >= GOAL;
      render(status);
    } catch (_) {}
  }

  function init() {
    ensureUi();
    loadCache();
    refresh();

    document.addEventListener('click', event => {
      if (event.target && event.target.classList && event.target.classList.contains('rating')) {
        setTimeout(refresh, 50);
        setTimeout(refresh, 900);
      }
    });

    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refresh();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
