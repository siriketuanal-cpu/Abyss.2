loadState();
setupDelegatedEvents();
setupGDelegatedEvents();
setupSLDelegatedEvents();
const appRootForTickRecovery = document.querySelector('.wrap');
if (appRootForTickRecovery) appRootForTickRecovery.addEventListener('click', scheduleInteractionTickRecovery);
scheduleStartupStabilization();
const startupGraceUntil = Date.now() + 3000;

// ---- 画面復帰時のタイマー同期処理 ----
// 起動直後の初回pageshow/focus/resumeはloadState()直後の二重描画になるため除外する。
// 起動後の連続復帰イベントは短い debounce で1回にまとめる。
let resumeDebounceTimer = null;
let lastResumeAt = 0;
// Androidのvisibilitychange・resume・pageshow・focusの連続通知をまとめる。
const RESUME_FORCE_COALESCE_MS = 800;
const RESUME_NORMAL_DEBOUNCE_MS = 320;

function shouldSkipInitialResume(event){
  if (Date.now() >= startupGraceUntil) return false;
  // BFCacheからの復帰は、起動直後に見えても必ず同期する。
  return !(event && event.type === 'pageshow' && event.persisted);
}

function resumeTicking(force){
  if (document.hidden) return;
  const now = Date.now();
  // visibilitychange・resume・pageshowが連続しても、最初の即時描画だけを採用する。
  const minGap = force ? RESUME_FORCE_COALESCE_MS : RESUME_NORMAL_DEBOUNCE_MS;
  if (now - lastResumeAt < minGap) return;
  lastResumeAt = now;

  if (resumeDebounceTimer) {
    clearTimeout(resumeDebounceTimer);
    resumeDebounceTimer = null;
  }

  const restart = () => {
    if (document.hidden) return;
    render();
    // 復帰時は、見かけ上のIDが残っていても実体を再生成して連続更新を保証する。
    startTicking(true);
    scheduleResetCheck();
  };

  // タスク復帰は即時同期する。通常の重複イベントだけ短くまとめる。
  if (force) {
    restart();
    return;
  }
  resumeDebounceTimer = setTimeout(() => {
    resumeDebounceTimer = null;
    restart();
  }, 48);
}

function scheduleResetCheck(){
  if (resetCheckTimer) clearTimeout(resetCheckTimer);

  const now = new Date();
  const next = new Date(now);
  next.setHours(1, 0, 1, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  const nextGameReset = new Date(now);
  nextGameReset.setHours(5, 0, 1, 0);
  if (nextGameReset <= now) nextGameReset.setDate(nextGameReset.getDate() + 1);
  if (nextGameReset < next) next.setTime(nextGameReset.getTime());

  resetCheckTimer = setTimeout(() => {
    resetCheckTimer = null;
    if (!document.hidden) {
      render();
      startTicking();
    }
    scheduleResetCheck();
  }, Math.max(1000, next.getTime() - now.getTime()));
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // 次の復帰を直前イベントの抑止対象にしない。
    lastResumeAt = 0;
    if (Date.now() < startupGraceUntil) return;
    // Android Chrome／PWAシェルでは復帰通知が欠ける場合があるため、
    // 進行中の描画ループはここで止めない。非表示中はブラウザ側が自然に抑制する。
    if (resumeDebounceTimer) {
      clearTimeout(resumeDebounceTimer);
      resumeDebounceTimer = null;
    }
  } else {
    // Androidのタスク復帰では最初の可視化を必ず同期する。
    if (shouldSkipInitialResume()) return;
    resumeTicking(true);
  }
});

// 一部のWebView・PWAシェルが送る復帰通知も同じ経路で扱う。
document.addEventListener('resume', (event) => {
  if (shouldSkipInitialResume(event)) return;
  resumeTicking(true);
});

window.addEventListener('pageshow', (event) => {
  if (shouldSkipInitialResume(event)) return;
  resumeTicking(true);
});
// visibilitychangeが届かないPWAシェルでも、フォーカス復帰を保険として同期入口にする。
window.addEventListener('focus', (event) => {
  if (shouldSkipInitialResume(event)) return;
  resumeTicking(true);
});

const SW_UPDATE_CHECK_KEY = 'dotabyss:sw-update-check:v1';
const SW_UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function isServiceWorkerUpdateDue(now){
  try {
    const last = Number(localStorage.getItem(SW_UPDATE_CHECK_KEY));
    return !Number.isFinite(last) || last <= 0 || now < last || now - last >= SW_UPDATE_CHECK_INTERVAL_MS;
  } catch (_) {
    // 保存不可の環境では、従来どおり起動時に確認する。
    return true;
  }
}

function markServiceWorkerUpdateChecked(now){
  try { localStorage.setItem(SW_UPDATE_CHECK_KEY, String(now)); } catch (_) {}
}

function scheduleServiceWorkerRegistration(){
  if (swRegistrationScheduled) return;
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;

  swRegistrationScheduled = true;
  const register = async () => {
    try {
      const existing = await navigator.serviceWorker.getRegistration('./');
      // 未登録時は必ず登録する。登録済みなら更新確認を6時間に1回へ抑える。
      if (!existing) {
        await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
        markServiceWorkerUpdateChecked(Date.now());
        return;
      }
      const now = Date.now();
      if (!isServiceWorkerUpdateDue(now)) return;
      await existing.update();
      markServiceWorkerUpdateChecked(now);
    } catch (_) {}
  };

  // Service Workerの取得・インストールを初期描画と競合させない。
  if ('requestIdleCallback' in window) requestIdleCallback(register, { timeout: 8000 });
  else setTimeout(register, 2500);
}
