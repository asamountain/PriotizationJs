// Lightweight usage telemetry: buffers UI interaction events and flushes them
// to /api/events in batches. Counts only — no free text, no "why". Best-effort:
// never throws into the app, drops events on failure.

const FLUSH_MS = 10000;
const MAX_BUFFER = 100;

function sessionId() {
  try {
    let id = sessionStorage.getItem('telemetry_sid');
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()).slice(0, 36);
      sessionStorage.setItem('telemetry_sid', id);
    }
    return id;
  } catch (e) {
    return 'nosession';
  }
}

const SID = sessionId();
let buffer = [];
let timer = null;

function schedule() {
  if (timer) return;
  timer = setTimeout(() => { timer = null; flush(); }, FLUSH_MS);
}

export function flush(useBeacon = false) {
  if (buffer.length === 0) return;
  const events = buffer;
  buffer = [];
  const body = JSON.stringify({ events });
  try {
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }));
    } else {
      fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true
      }).catch(() => {});
    }
  } catch (e) {
    // give up on this batch
  }
}

export function track(event, target = null, meta = null) {
  try {
    if (!event) return;
    buffer.push({ session_id: SID, event, target, meta });
    if (buffer.length >= MAX_BUFFER) flush();
    else schedule();
  } catch (e) {
    // never let telemetry break the app
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true);
  });
  window.addEventListener('pagehide', () => flush(true));
}
