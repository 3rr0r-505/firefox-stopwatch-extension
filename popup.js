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
let localBase  = 0;
let localStart = 0;
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

// ── RAF loop ──────────────────────────────────────────────

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

function makeLapRow(lap, num, isBest, isWorst, barW) {
  const row = document.createElement('div');
  row.className = 'lap-row' + (isBest ? ' best' : isWorst ? ' worst' : '');

  const numEl = document.createElement('span');
  numEl.className = 'lap-num';
  numEl.textContent = '#' + num;

  const barWrap = document.createElement('div');
  barWrap.className = 'lap-bar-wrap';
  const bar = document.createElement('div');
  bar.className = 'lap-bar';
  bar.style.width = barW + '%';
  barWrap.appendChild(bar);

  const totalEl = document.createElement('span');
  totalEl.className = 'lap-total';
  totalEl.textContent = fmt(lap.total);

  const deltaEl = document.createElement('span');
  deltaEl.className = 'lap-delta';
  deltaEl.textContent = '+' + fmt(lap.delta);

  row.appendChild(numEl);
  row.appendChild(barWrap);
  row.appendChild(totalEl);
  row.appendChild(deltaEl);

  return row;
}

function renderLaps(laps) {
  lapsEl.textContent = ''; // clear safely

  if (!laps || laps.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'laps-empty';
    empty.textContent = '— no laps yet —';
    lapsEl.appendChild(empty);
    return;
  }

  const deltas = laps.map(l => l.delta);
  const minD   = Math.min(...deltas);
  const maxD   = Math.max(...deltas);
  const rangeD = maxD - minD || 1;

  const fragment = document.createDocumentFragment();
  [...laps].reverse().forEach((lap, ri) => {
    const num     = laps.length - ri;
    const isBest  = laps.length > 1 && lap.delta === minD;
    const isWorst = laps.length > 1 && lap.delta === maxD;
    const barW    = Math.round(((lap.delta - minD) / rangeD) * 100);
    fragment.appendChild(makeLapRow(lap, num, isBest, isWorst, barW));
  });
  lapsEl.appendChild(fragment);
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
  if (getLiveElapsed() > 0) {
    const r = await send('LAP');
    renderLaps(r.laps);
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