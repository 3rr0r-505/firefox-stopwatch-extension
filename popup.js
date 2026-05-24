// popup.js

const arcEl    = document.getElementById('arc');
const tMain    = document.getElementById('t-main');
const tMs      = document.getElementById('t-ms');
const hdDot    = document.getElementById('hd');
const btnStart = document.getElementById('btn-start');
const btnLap   = document.getElementById('btn-lap');
const btnReset = document.getElementById('btn-reset');
const lapsEl   = document.getElementById('laps');

// ── local tick state (popup only, for smooth display) ────
let rafId      = null;
let localBase  = 0;   // elapsed at the moment we started local tick
let localStart = 0;   // Date.now() at that moment
let isRunning  = false;

function getLiveElapsed() {
  return isRunning ? localBase + (Date.now() - localStart) : localBase;
}

// ── display ───────────────────────────────────────────────

function fmt(ms, showMs = false) {
  const totalSec = Math.floor(ms / 1000);
  const h   = Math.floor(totalSec / 3600).toString().padStart(2, '0');
  const m   = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
  const s   = (totalSec % 60).toString().padStart(2, '0');
  const mil = (ms % 1000).toString().padStart(3, '0');
  return showMs ? { hms: `${h}:${m}:${s}`, ms: `.${mil}` } : `${h}:${m}:${s}`;
}

function updateDisplay(ms) {
  const { hms, ms: mil } = fmt(ms, true);
  tMain.textContent = hms;
  tMs.textContent   = mil;
  const progress = (Math.floor(ms / 1000) % 60) / 60;
  arcEl.style.strokeDashoffset = 679 * (1 - progress);
}

function setUIRunning(running) {
  isRunning = running;
  if (running) {
    hdDot.classList.add('active');
    btnStart.textContent = 'Pause';
    btnStart.classList.add('paused');
  } else {
    hdDot.classList.remove('active');
    btnStart.textContent = 'Start';
    btnStart.classList.remove('paused');
  }
}

// ── RAF loop (only active while popup is open & running) ──

function startLocalTick(elapsed) {
  localBase  = elapsed;
  localStart = Date.now();
  cancelAnimationFrame(rafId);
  function tick() {
    updateDisplay(getLiveElapsed());
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);
}

function stopLocalTick(elapsed) {
  cancelAnimationFrame(rafId);
  rafId     = null;
  localBase = elapsed;
  updateDisplay(elapsed);
}

// ── laps ──────────────────────────────────────────────────

function renderLaps(laps) {
  if (!laps || laps.length === 0) {
    lapsEl.innerHTML = '<div class="laps-empty">— no laps yet —</div>';
    return;
  }
  const deltas = laps.map(l => l.delta);
  const minD   = Math.min(...deltas);
  const maxD   = Math.max(...deltas);
  const rangeD = maxD - minD || 1;

  lapsEl.innerHTML = [...laps].reverse().map((lap, ri) => {
    const num     = laps.length - ri;
    const isBest  = laps.length > 1 && lap.delta === minD;
    const isWorst = laps.length > 1 && lap.delta === maxD;
    const barW    = Math.round(((lap.delta - minD) / rangeD) * 100);
    const cls     = isBest ? 'best' : isWorst ? 'worst' : '';
    return `<div class="lap-row ${cls}">
      <span class="lap-num">#${num}</span>
      <div class="lap-bar-wrap"><div class="lap-bar" style="width:${barW}%"></div></div>
      <span class="lap-total">${fmt(lap.total)}</span>
      <span class="lap-delta">+${fmt(lap.delta)}</span>
    </div>`;
  }).join('');
}

// ── messaging ─────────────────────────────────────────────

function send(type) {
  return browser.runtime.sendMessage({ type });
}

btnStart.addEventListener('click', async () => {
  if (isRunning) {
    const r = await send('PAUSE');
    setUIRunning(false);
    stopLocalTick(r.elapsed);
    renderLaps(r.laps);
  } else {
    const r = await send('START');
    setUIRunning(true);
    startLocalTick(r.elapsed);
    renderLaps(r.laps);
  }
});

btnLap.addEventListener('click', async () => {
  // use live local elapsed — fixes the first-lap bug
  if (getLiveElapsed() > 0) {
    const r = await send('LAP');
    renderLaps(r.laps);
    // keep local tick running, don't touch display
  }
});

btnReset.addEventListener('click', async () => {
  const r = await send('RESET');
  setUIRunning(false);
  stopLocalTick(0);
  renderLaps(r.laps);
});

// ── cleanup on popup close ────────────────────────────────

window.addEventListener('unload', () => {
  cancelAnimationFrame(rafId);
});

// ── init ──────────────────────────────────────────────────

(async () => {
  const r = await send('GET_STATE');
  setUIRunning(r.running);
  renderLaps(r.laps);
  if (r.running) {
    startLocalTick(r.elapsed);
  } else {
    updateDisplay(r.elapsed);
    localBase = r.elapsed;
  }
})();
