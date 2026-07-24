/* ── Calendar mirror (desktop only) ───────────────────────────────────────
   One-way push: whatever is on the Cosmodex calendar (timed events + timeboxed
   tasks, which are both CAL_EVENTS, plus milestones as all-day) is mirrored into
   a dedicated "Cosmodex" calendar in Apple Calendar via the bundled EventKit
   helper. Cosmodex is the source of truth — the helper reconciles the full set
   each run (create / update / delete), so deletions and edits propagate too.
   Runs only inside the Tauri app; the web build has no filesystem/EventKit. */
(function calendarMirror() {
  const invoke = () => window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke;
  let timer = null;
  let running = false;
  let dirtyWhileRunning = false;

  // Local wall-clock date+time → epoch seconds (Apple events are absolute times).
  function epochLocal(dateStr, hhmm) {
    const [y, m, d] = String(dateStr || '').split('-').map(Number);
    const [hh, mm] = String(hhmm || '00:00').split(':').map(Number);
    if (!y || !m || !d) return null;
    return Math.floor(new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0).getTime() / 1000);
  }

  function buildDesired() {
    const items = [];
    // CAL_EVENTS / MILESTONE_EVENTS are top-level `let` globals in the shared
    // app.js scope — reachable by bare name here (same script), NOT via window.
    const calEvents = (typeof CAL_EVENTS !== 'undefined' && CAL_EVENTS) || [];
    const msEvents = (typeof MILESTONE_EVENTS !== 'undefined' && MILESTONE_EVENTS) || [];
    // CAL_EVENTS = plain calendar events AND tasks timeboxed onto the calendar.
    calEvents.forEach(ev => {
      if (!ev.id || !ev.date) return;
      const title = (String(ev.title || '').trim()) || 'Untitled';
      if (ev.allDay) {
        const s = epochLocal(ev.date, '00:00'); if (s == null) return;
        items.push({ id: 'ev_' + ev.id, title, start: s, end: s + 86400, allDay: true });
      } else if (ev.startTime) {
        const s = epochLocal(ev.date, ev.startTime); if (s == null) return;
        const dur = (Number(ev.duration) || 60) * 60;
        items.push({ id: 'ev_' + ev.id, title, start: s, end: s + dur, allDay: false });
      }
    });
    // Milestones → all-day markers.
    msEvents.forEach(ms => {
      const d = ms.date || ms.dueDate;
      if (!ms.id || !d) return;
      const s = epochLocal(d, '00:00'); if (s == null) return;
      const title = '⚑ ' + ((String(ms.title || ms.name || '').trim()) || 'Milestone');
      items.push({ id: 'ms_' + ms.id, title, start: s, end: s + 86400, allDay: true });
    });
    return items;
  }

  async function run() {
    const inv = invoke(); if (!inv) return;
    if (running) { dirtyWhileRunning = true; return; }
    running = true;
    try {
      const items = buildDesired();
      const res = await inv('calendar_sync', { payload: JSON.stringify({ items }) });
      console.debug('calendar mirror:', res);
      if (/"error"/.test(String(res)) && typeof showToast === 'function') {
        showToast('Calendar sync: ' + res, 'error');
      }
    } catch (e) {
      console.warn('calendar mirror failed:', e);
      if (typeof showToast === 'function') showToast('Calendar sync failed: ' + e, 'error');
    } finally {
      running = false;
      if (dirtyWhileRunning) { dirtyWhileRunning = false; window._calMirrorSchedule(); }
    }
  }

  // Debounced trigger — called from the calEvents / milestoneEvents snapshots.
  window._calMirrorSchedule = function () {
    if (!invoke()) return;
    clearTimeout(timer);
    timer = setTimeout(run, 1500);
  };
  // Manual trigger (e.g. from the console) for testing.
  window._calMirrorNow = run;
})();
