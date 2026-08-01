/* ─────────────────────────────────────────────────────────────
   OBSERVATION LOG WIDGET BRIDGE (desktop only)

   The chart window is its own webview with no Firebase of its own, so this
   window — which already holds the live snapshots — packages what it needs and
   pushes it over Tauri events. Same shape as the focus-lens bridge: broadcast
   only when the payload actually changes, never on a timer.
───────────────────────────────────────────────────────────── */
(function _chartBridge() {
  const ev = window.__TAURI__?.event;
  const invoke = window.__TAURI__?.core?.invoke;
  if (!ev) return;

  let _sig = '';
  let _timer = null;

  function build() {
    const today = localDateStr(new Date());
    const projPct = p => {
      const linked = (TASKS || []).filter(t => t.projectId === p.id);
      if (!linked.length) return 0;
      return Math.round(linked.filter(t => t.done).length / linked.length * 100);
    };
    const row = t => ({
      id: t.id, title: t.title, done: !!t.done, pri: t.priority || 'med',
      late: !!(t.dueDate && t.dueDate < today && !t.done),
      due: t.dueDate && t.dueDate !== today ? t.dueDate.slice(5) : ''
    });

    const log = (_habitLogs || {})[today] || {};
    const comp = log.completions || {};

    return {
      date: today,
      tasks: (TASKS || []).filter(t => t.dueDate === today).map(row),
      overdue: (TASKS || []).filter(t => !t.done && t.dueDate && t.dueDate < today)
        .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)).map(row),
      habits: (_habits || [])
        .filter(h => h.status !== 'graduated' && h.status !== 'archived')
        .map(h => ({ id: h.id, title: h.name, done: !!comp[h.id], streak: h.streak || 0 })),
      commit: (MILESTONE_PROJECTS || [])
        .filter(p => p.status !== 'done' && p.status !== 'archived')
        .map(p => ({ id: p.id, title: p.name, pct: projPct(p) }))
    };
  }

  function broadcast(force) {
    const payload = build();
    const sig = JSON.stringify(payload);
    if (!force && sig === _sig) return;
    _sig = sig;
    ev.emit('tw:data', payload);
  }
  // Snapshots land in bursts; one send per burst is plenty.
  window._chartSchedule = function () {
    clearTimeout(_timer);
    _timer = setTimeout(() => broadcast(false), 400);
  };

  ev.listen('tw:req', () => broadcast(true));
  ev.listen('tw:cmd', e => {
    const { a, id } = e.payload || {};
    if (a === 'habit') {
      habitToggle(id, localDateStr(new Date())).then(() => broadcast(true));
    } else if (a === 'open') {
      // Hand off to this window: focus the task so the session can start.
      const t = (TASKS || []).find(x => x.id === id);
      if (t) { showMainPanel('focus'); window.initPomoOverlay?.(); window._pomoSelectTask?.(t); }
    }
  });

  // Toggle pill on the dashboard.
  const btn = document.getElementById('dash-chart-toggle');
  if (btn && invoke) {
    btn.style.display = '';
    const paint = open => btn.classList.toggle('active', !!open);
    invoke('chart_is_open').then(paint).catch(() => {});
    btn.addEventListener('click', () => {
      invoke('chart_toggle').then(open => { paint(open); if (open) broadcast(true); }).catch(() => {});
    });
  }
})();
