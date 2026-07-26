/* ── Reminders mirror (desktop only) ──────────────────────────────────────
   One-way push: open Cosmodex tasks are mirrored into a dedicated "Cosmodex"
   list in Apple Reminders via the bundled EventKit helper, so they show up on
   iPhone / Mac / Watch. Cosmodex is the source of truth — the helper reconciles
   the full set each run (create / update / delete), so completing or deleting a
   task removes it from the Reminders list. Only key fields are mirrored: task
   name, due date, and subtasks (as a ☐/☑ checklist in the reminder's notes —
   EventKit has no public API for real Reminders subtasks). Runs only inside the
   Tauri app; the web build has no EventKit. */
(function remindersMirror() {
  const invoke = () => window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke;
  let timer = null;
  let running = false;
  let dirtyWhileRunning = false;

  // Local wall-clock date → epoch seconds at local midnight (all-day due).
  function epochLocal(dateStr) {
    const [y, m, d] = String(dateStr || '').split('-').map(Number);
    if (!y || !m || !d) return null;
    return Math.floor(new Date(y, m - 1, d, 0, 0, 0, 0).getTime() / 1000);
  }

  function buildDesired() {
    const items = [];
    // TASKS is a top-level `let` in the shared app.js scope — reachable by bare
    // name here (same script), NOT via window.
    const tasks = (typeof TASKS !== 'undefined' && TASKS) || [];
    tasks.forEach(t => {
      if (!t.id || t.done) return;                // mirror only open tasks
      const title = (String(t.title || '').trim()) || 'Untitled';
      const item = { id: t.id, title };
      const due = t.dueDate ? epochLocal(t.dueDate) : null;
      if (due != null) item.due = due;
      const subs = t.subtasks || [];
      if (subs.length) {
        item.notes = subs
          .map(s => `${s.done ? '☑' : '☐'} ${String(s.title || '').trim()}`)
          .join('\n');
      }
      items.push(item);
    });
    return items;
  }

  async function run() {
    const inv = invoke(); if (!inv) return;
    if (running) { dirtyWhileRunning = true; return; }
    running = true;
    try {
      const items = buildDesired();
      const res = await inv('reminders_sync', { payload: JSON.stringify({ items }) });
      console.debug('reminders mirror:', res);
      if (/"error"/.test(String(res)) && typeof showToast === 'function') {
        showToast('Reminders sync: ' + res, 'error');
      }
    } catch (e) {
      console.warn('reminders mirror failed:', e);
      if (typeof showToast === 'function') showToast('Reminders sync failed: ' + e, 'error');
    } finally {
      running = false;
      if (dirtyWhileRunning) { dirtyWhileRunning = false; window._remindMirrorSchedule(); }
    }
  }

  // Debounced trigger — called from the tasks snapshot handler.
  window._remindMirrorSchedule = function () {
    if (!invoke()) return;
    clearTimeout(timer);
    timer = setTimeout(run, 1800);
  };
  // Manual trigger (e.g. from the console) for testing.
  window._remindMirrorNow = run;
})();
