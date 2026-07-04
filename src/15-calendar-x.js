/* ═══════════════════════════════════════════════════════════════════════
   CALENDAR — design-system calendar page (day / week / month)
   Wired to the app's real data: CAL_EVENTS (Firestore calEvents) + tasks with
   a dueDate. Creating a slot reuses openQuickCalModal(); clicking an event
   jumps to its linked task. Rendered into #panel-calendarx by showMainPanel().
   ═══════════════════════════════════════════════════════════════════════ */

let _calxView = 'week';          // 'day' | 'week' | 'month'
let _calxRef  = new Date();      // anchor date the current view is built around
let _calxDrag = null;            // { kind:'task'|'event', id } while dragging

const CALX_HR_START = 7;
const CALX_HR_END   = 22;        // grid spans 07:00–22:00

const CALX_DOW = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const CALX_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// "HH:MM" → fractional hours (e.g. "09:30" → 9.5). null for all-day.
function _calxParseH(t) {
  if (!t) return null;
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
}
function _calxFmtH(h) {
  const hh = Math.floor(h), mm = Math.round((h % 1) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function _calxEventColor(e) {
  return e.color || (e.category ? getCatColor(e.category) : null) || 'rgba(255,255,255,.55)';
}
// Timed events on a date, sorted by start.
function _calxTimed(ds) {
  return CAL_EVENTS
    .filter(e => e.date === ds && !e.allDay && e.startTime)
    .map(e => {
      const sH = _calxParseH(e.startTime);
      const eH = e.endTime ? _calxParseH(e.endTime) : sH + ((e.duration || 60) / 60);
      return { ...e, _sH: sH, _eH: Math.max(eH, sH + 0.25) };
    })
    .sort((a, b) => a._sH - b._sH);
}
// All-day items on a date: all-day calEvents + incomplete tasks due that day.
function _calxAllDay(ds) {
  const items = CAL_EVENTS.filter(e => e.date === ds && (e.allDay || !e.startTime))
    .map(e => ({ id: e.id, title: e.title, color: _calxEventColor(e), taskId: e.taskId }));
  (TASKS || []).forEach(t => {
    if (!t.done && t.dueDate === ds && !CAL_EVENTS.some(e => e.taskId === t.id && e.date === ds)) {
      items.push({ id: 'task-' + t.id, title: t.title, color: getCatColor(t.category), taskId: t.id, isTask: true });
    }
  });
  return items;
}

// Monday-anchored start of the ref week.
function _calxWeekStart(d) {
  const x = new Date(d);
  const wd = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - wd);
  x.setHours(0, 0, 0, 0);
  return x;
}

function _calxHeading() {
  if (_calxView === 'month') return `${CALX_MONTHS[_calxRef.getMonth()]} ${_calxRef.getFullYear()}`;
  if (_calxView === 'day')   return _calxRef.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const ws = _calxWeekStart(_calxRef), we = new Date(ws); we.setDate(ws.getDate() + 6);
  const sameMonth = ws.getMonth() === we.getMonth();
  return `${ws.getDate()} ${sameMonth ? '' : CALX_MONTHS[ws.getMonth()].slice(0,3) + ' '}— ${we.getDate()} ${CALX_MONTHS[we.getMonth()].slice(0,3)} ${we.getFullYear()}`;
}

/* ── Header (toolbar + legend + stat rail) ─────────────────────────────── */
function _calxHeaderHtml() {
  const views = ['day', 'week', 'month'].map(v =>
    `<button class="calx-vtog${_calxView === v ? ' active' : ''}" data-calx-view="${v}">${v}</button>`).join('');
  return `
    <div class="calx-toolbar">
      <div>
        <div class="calx-eyebrow">CALENDAR · ${_calxView.toUpperCase()}</div>
        <div class="calx-heading">${escHtml(_calxHeading())}</div>
      </div>
      <div style="flex:1"></div>
      <div class="calx-navarrows">
        <button class="calx-arrow" data-calx-nav="-1">‹</button>
        <button class="calx-arrow" data-calx-nav="1">›</button>
      </div>
      <div class="calx-vtog-wrap">${views}</div>
      <button class="calx-liquid" data-calx-today>◈ Today</button>
      <button class="calx-liquid" data-calx-new>＋ New event</button>
    </div>
    <div class="calx-italic">One focus that cannot slip. Click any empty slot to capture.</div>`;
}

/* ── Time-grid column (shared by day & week) ───────────────────────────── */
function _calxColumnHtml(ds, rowH, isToday, nowH) {
  const timed = _calxTimed(ds);
  let html = '';
  for (let h = CALX_HR_START; h < CALX_HR_END; h++) {
    html += `<div class="calx-slot" data-calx-slot="${ds}|${String(h).padStart(2,'0')}:00" style="height:${rowH}px"></div>`;
  }
  if (isToday && nowH >= CALX_HR_START && nowH <= CALX_HR_END) {
    const top = (nowH - CALX_HR_START) * rowH;
    html += `<div class="calx-now" style="top:${top}px"><span class="calx-now-dot"></span></div>`;
  }
  timed.forEach(e => {
    const top = (e._sH - CALX_HR_START) * rowH;
    const hgt = Math.max((e._eH - e._sH) * rowH - 3, 22);
    const clr = _calxEventColor(e);
    html += `<div class="calx-ev" draggable="true" data-calx-ev="${escAttr(e.taskId || '')}" data-ev-move="${escAttr(e.id)}" title="${escAttr(e.title)} — drag to reschedule"
      style="top:${top}px;height:${hgt}px;--ec:${clr};background:linear-gradient(135deg, ${clr}22, rgba(255,255,255,.03) 70%);border-left-color:${clr}">
      <div class="calx-ev-title">${escHtml(e.title)}</div>
      <div class="calx-ev-meta">${_calxFmtH(e._sH)}<span class="calx-ev-dot" style="background:${clr}"></span></div>
    </div>`;
  });
  return html;
}

/* ── DAY ────────────────────────────────────────────────────────────────── */
function _calxDayHtml() {
  const rowH = 60;
  const ds = localDateStr(_calxRef);
  const now = new Date();
  const isToday = ds === localDateStr(now);
  const nowH = now.getHours() + now.getMinutes() / 60;
  let rail = '';
  for (let h = CALX_HR_START; h < CALX_HR_END; h++)
    rail += `<div class="calx-hr" style="height:${rowH}px">${String(h).padStart(2,'0')}:00</div>`;
  return `
    <div class="calx-glass">
      <div class="calx-daygrid">
        <div class="calx-railcol">${rail}</div>
        <div class="calx-col" data-calx-col="${ds}" data-rowh="${rowH}">${_calxColumnHtml(ds, rowH, isToday, nowH)}</div>
      </div>
    </div>`;
}

/* ── WEEK ───────────────────────────────────────────────────────────────── */
function _calxWeekHtml() {
  const rowH = 46;
  const ws = _calxWeekStart(_calxRef);
  const now = new Date(), todayDs = localDateStr(now);
  const nowH = now.getHours() + now.getMinutes() / 60;
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(ws.getDate() + i); return d; });

  const header = days.map((d, i) => {
    const isToday = localDateStr(d) === todayDs;
    return `<div class="calx-whead${isToday ? ' today' : ''}">
      <div class="calx-whead-dow">${CALX_DOW[i]}</div>
      <div class="calx-whead-dd">${d.getDate()}</div>
    </div>`;
  }).join('');

  let rail = '';
  for (let h = CALX_HR_START; h < CALX_HR_END; h++)
    rail += `<div class="calx-hr sm" style="height:${rowH}px">${String(h).padStart(2,'0')}</div>`;

  const cols = days.map(d => {
    const ds = localDateStr(d);
    const isToday = ds === todayDs;
    return `<div class="calx-col${isToday ? ' today' : ''}" data-calx-col="${ds}" data-rowh="${rowH}">${_calxColumnHtml(ds, rowH, isToday, nowH)}</div>`;
  }).join('');

  return `
    <div class="calx-glass">
      <div class="calx-whead-row"><div class="calx-railcol-h"></div>${header}</div>
      <div class="calx-weekgrid"><div class="calx-railcol">${rail}</div>${cols}</div>
    </div>`;
}

/* ── MONTH ──────────────────────────────────────────────────────────────── */
function _calxMonthHtml() {
  const first = new Date(_calxRef.getFullYear(), _calxRef.getMonth(), 1);
  const start = _calxWeekStart(first);
  const todayDs = localDateStr(new Date());
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    cells.push(d);
  }
  const headers = CALX_DOW.map(d => `<div class="calx-mhead">${d}</div>`).join('');
  const grid = cells.map(d => {
    const ds = localDateStr(d);
    const inMonth = d.getMonth() === _calxRef.getMonth();
    const isToday = ds === todayDs;
    const items = [..._calxAllDay(ds), ..._calxTimed(ds).map(e => ({ title: e.title, color: _calxEventColor(e), taskId: e.taskId }))];
    const chips = items.slice(0, 3).map(a =>
      `<div class="calx-mchip" style="border-left-color:${a.color};background:linear-gradient(90deg, ${a.color}1a, rgba(255,255,255,.02))">${escHtml(a.title)}</div>`).join('');
    return `<div class="calx-mcell${inMonth ? '' : ' out'}${isToday ? ' today' : ''}" data-calx-slot="${ds}|09:00">
      <div class="calx-mcell-h">
        <span class="calx-mcell-dd">${d.getDate()}</span>
        ${isToday ? '<span class="calx-mcell-today">TODAY</span>' : ''}
        ${items.length ? `<span class="calx-mcell-count">·${items.length}</span>` : ''}
      </div>
      <div class="calx-mcell-body">${chips}${items.length > 3 ? `<div class="calx-mmore">+${items.length - 3} more</div>` : ''}</div>
    </div>`;
  }).join('');
  return `<div class="calx-glass"><div class="calx-mhead-row">${headers}</div><div class="calx-monthgrid">${grid}</div></div>`;
}

function _calxChip(a) {
  // Unscheduled task → drag onto a slot to schedule; all-day event → drag to time.
  const dragAttr = a.isTask
    ? `draggable="true" data-task-drag="${escAttr(a.taskId)}"`
    : (a.id ? `draggable="true" data-ev-move="${escAttr(a.id)}"` : '');
  return `<div class="calx-chip" ${dragAttr} data-calx-ev="${escAttr(a.taskId || '')}" style="border-left-color:${a.color}" title="${escAttr(a.title)}${a.isTask ? ' — drag onto a time to schedule' : ''}">
    <span class="calx-ev-dot" style="background:${a.color}"></span>${escHtml(a.title)}${a.isTask ? '<span class="calx-chip-tag">DUE</span>' : ''}</div>`;
}

/* ── Legend ─────────────────────────────────────────────────────────────── */
function _calxLegendHtml() {
  const cats = Object.keys(CATEGORIES).slice(0, 8);
  if (!cats.length) return '';
  return `<div class="calx-legend"><span class="calx-eyebrow">LEGEND</span>${cats.map(id =>
    `<span class="calx-leg"><span class="calx-ev-dot" style="background:${getCatColor(id)}"></span>${escHtml(CATEGORIES[id].label)}</span>`).join('')}</div>`;
}

/* ── Top band: milestones + all-day / unscheduled (day & week) ──────────
   Milestones are pinned here (⚑, not draggable). Unscheduled tasks due in the
   range and all-day events sit alongside as draggable chips → drop onto a slot
   to give them a time. */
function _calxVisibleDates() {
  if (_calxView === 'day') return [localDateStr(_calxRef)];
  if (_calxView === 'week') {
    const ws = _calxWeekStart(_calxRef);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(ws.getDate() + i); return localDateStr(d); });
  }
  return []; // month view carries its own per-cell chips
}
function _calxMilestoneChips(dates) {
  const set = new Set(dates);
  return (typeof MILESTONE_EVENTS !== 'undefined' ? MILESTONE_EVENTS : [])
    .filter(e => set.has(String(e.date || '').slice(0, 10)))
    .map(e => {
      const c = (typeof _pcalProjColor === 'function') ? _pcalProjColor(e.projectId) : 'rgb(53,249,47)';
      return `<div class="calx-ms" data-ms-id="${escAttr(e.id)}" data-ms-proj="${escAttr(e.projectId || '')}" style="--c:${c}" title="◆ ${escAttr(e.title || 'Milestone')}">
        <span class="calx-ms-ico">⚑</span>${escHtml(e.title || 'Milestone')}</div>`;
    }).join('');
}
function _calxTopBandHtml() {
  const dates = _calxVisibleDates();
  if (!dates.length) return '';
  const ms = _calxMilestoneChips(dates);
  const allDay = dates.flatMap(ds => _calxAllDay(ds));
  if (!ms && !allDay.length) return '';
  return `<div class="calx-band">
    <span class="calx-band-label">ON TOP</span>
    ${ms}
    ${allDay.map(a => _calxChip(a)).join('')}
  </div>`;
}

/* ── Main render + wiring ──────────────────────────────────────────────── */
function renderCalendarX() {
  const panel = document.getElementById('panel-calendarx');
  if (!panel) return;
  const body = _calxView === 'day' ? _calxDayHtml() : _calxView === 'week' ? _calxWeekHtml() : _calxMonthHtml();
  panel.innerHTML = `<div class="calx-root">${_calxHeaderHtml()}${_calxLegendHtml()}${_calxTopBandHtml()}${body}</div>`;
  _calxWire(panel);
}
window.renderCalendarX = renderCalendarX;
window._calxAutoRefresh = () => { if (_mainPanel === 'calendarx') renderCalendarX(); };

function _calxShift(dir) {
  const d = new Date(_calxRef);
  if (_calxView === 'day')   d.setDate(d.getDate() + dir);
  if (_calxView === 'week')  d.setDate(d.getDate() + dir * 7);
  if (_calxView === 'month') d.setMonth(d.getMonth() + dir);
  _calxRef = d;
  renderCalendarX();
}

function _calxWire(panel) {
  panel.querySelectorAll('[data-calx-view]').forEach(b =>
    b.addEventListener('click', () => { _calxView = b.dataset.calxView; renderCalendarX(); }));
  panel.querySelectorAll('[data-calx-nav]').forEach(b =>
    b.addEventListener('click', () => _calxShift(+b.dataset.calxNav)));
  panel.querySelector('[data-calx-today]')?.addEventListener('click', () => { _calxRef = new Date(); renderCalendarX(); });
  panel.querySelector('[data-calx-new]')?.addEventListener('click', () =>
    openQuickCalModal(localDateStr(_calxRef), '09:00'));

  // Click an empty slot / month cell → create an event there
  panel.querySelectorAll('[data-calx-slot]').forEach(s =>
    s.addEventListener('click', () => {
      const [ds, time] = s.dataset.calxSlot.split('|');
      openQuickCalModal(ds, time || '09:00');
    }));

  // Click an event/chip → jump to its linked task (non-destructive)
  panel.querySelectorAll('[data-calx-ev]').forEach(ev =>
    ev.addEventListener('click', e => {
      e.stopPropagation();
      const taskId = ev.dataset.calxEv;
      if (!taskId) return;
      if (typeof _atkSelectedId !== 'undefined') _atkSelectedId = taskId;
      showMainPanel('alltasks');
      document.getElementById('nav-alltasks')?.classList.add('active');
      document.getElementById('nav-calendarx')?.classList.remove('active');
    }));

  // Milestone chips in the top band → open the milestone editor
  panel.querySelectorAll('.calx-ms[data-ms-id]').forEach(el =>
    el.addEventListener('click', e => {
      e.stopPropagation();
      if (typeof openMsEventModal === 'function') openMsEventModal(el.dataset.msProj || null, el.dataset.msId);
    }));

  _calxWireDnd(panel);
}

/* ── Drag-to-schedule / drag-to-move on the Calendar ────────────────────── */
function _calxWireDnd(panel) {
  const startDrag = (el, kind, id) => {
    el.addEventListener('dragstart', e => {
      _calxDrag = { kind, id };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', kind + ':' + id);
      el.classList.add('calx-dragging');
    });
    el.addEventListener('dragend', () => { _calxDrag = null; el.classList.remove('calx-dragging'); _calxClearMarks(panel); });
  };
  panel.querySelectorAll('[data-task-drag]').forEach(el => startDrag(el, 'task', el.dataset.taskDrag));
  panel.querySelectorAll('[data-ev-move]').forEach(el => startDrag(el, 'event', el.dataset.evMove));

  // Time-grid columns (day & week): drop at the pointed 30-min mark
  panel.querySelectorAll('.calx-col[data-calx-col]').forEach(col => {
    const rowH = +col.dataset.rowh || 46;
    const timeAt = clientY => {
      const r = col.getBoundingClientRect();
      let mins = CALX_HR_START * 60 + ((clientY - r.top) / rowH) * 60;
      mins = Math.round(mins / 30) * 30;
      mins = Math.max(CALX_HR_START * 60, Math.min(CALX_HR_END * 60 - 30, mins));
      return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    };
    col.addEventListener('dragover', e => {
      if (!_calxDrag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      let mark = col.querySelector('.calx-drop-line');
      if (!mark) { mark = document.createElement('div'); mark.className = 'calx-drop-line'; col.appendChild(mark); }
      const r = col.getBoundingClientRect();
      const t = timeAt(e.clientY);
      const [hh, mm] = t.split(':').map(Number);
      mark.style.top = ((hh * 60 + mm - CALX_HR_START * 60) / 60 * rowH) + 'px';
    });
    col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) col.querySelector('.calx-drop-line')?.remove(); });
    col.addEventListener('drop', e => {
      e.preventDefault();
      const ds = col.dataset.calxCol;
      const time = timeAt(e.clientY);
      const p = _calxDrag; _calxDrag = null; _calxClearMarks(panel);
      if (!p) return;
      if (p.kind === 'task') scheduleTaskAt(p.id, ds, time, 30);
      else moveCalEventTo(p.id, ds, time);
    });
  });

  // Month cells: drop schedules/moves to that date at 09:00
  panel.querySelectorAll('.calx-mcell[data-calx-slot]').forEach(cell => {
    cell.addEventListener('dragover', e => { if (_calxDrag) { e.preventDefault(); cell.classList.add('calx-drop-cell'); } });
    cell.addEventListener('dragleave', () => cell.classList.remove('calx-drop-cell'));
    cell.addEventListener('drop', e => {
      e.preventDefault(); cell.classList.remove('calx-drop-cell');
      const ds = cell.dataset.calxSlot.split('|')[0];
      const p = _calxDrag; _calxDrag = null;
      if (!p) return;
      if (p.kind === 'task') scheduleTaskAt(p.id, ds, '09:00', 30);
      else moveCalEventTo(p.id, ds, '09:00');
    });
  });
}
function _calxClearMarks(panel) { panel.querySelectorAll('.calx-drop-line').forEach(m => m.remove()); panel.querySelectorAll('.calx-drop-cell').forEach(c => c.classList.remove('calx-drop-cell')); }
