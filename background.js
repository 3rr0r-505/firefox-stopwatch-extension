// background.js — zero interval; elapsed computed on demand from startTime

let state = {
  running: false,
  startTime: null,  // Date.now() offset when started
  pausedAt: 0,      // elapsed ms at last pause
  laps: []
};

// Compute current elapsed without any interval
function getElapsed() {
  if (state.running && state.startTime !== null) {
    return Date.now() - state.startTime;
  }
  return state.pausedAt;
}

browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const elapsed = getElapsed();

  switch (msg.type) {
    case 'GET_STATE':
      sendResponse({ running: state.running, elapsed, laps: state.laps });
      break;

    case 'START':
      state.startTime = Date.now() - state.pausedAt;
      state.running = true;
      sendResponse({ running: true, elapsed: getElapsed(), laps: state.laps });
      break;

    case 'PAUSE':
      state.pausedAt = elapsed;
      state.running = false;
      state.startTime = null;
      sendResponse({ running: false, elapsed: state.pausedAt, laps: state.laps });
      break;

    case 'RESET':
      state.running = false;
      state.startTime = null;
      state.pausedAt = 0;
      state.laps = [];
      sendResponse({ running: false, elapsed: 0, laps: [] });
      break;

    case 'LAP': {
      const now = getElapsed();
      if (now > 0) {
        const prev = state.laps.length > 0 ? state.laps[state.laps.length - 1].total : 0;
        state.laps.push({ total: now, delta: now - prev });
      }
      sendResponse({ running: state.running, elapsed: getElapsed(), laps: state.laps });
      break;
    }
  }
  return true;
});
