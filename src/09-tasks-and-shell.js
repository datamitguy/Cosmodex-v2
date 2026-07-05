/* ══ RENDER TASKS ══ */
// → future file: cosmodex-tasks.js
function _buildTaskToProjectMap() {
  const map = {}; // taskId → { projectId, projectTitle, projectColor }
  if (typeof MILESTONE_PROJECTS === 'undefined') return map;

  // 1. Direct: task has projectId field (set when created via addMilestoneActivity)
  if (typeof TASKS !== 'undefined') {
    TASKS.forEach(task => {
      if (!task.projectId) return;
      const proj = MILESTONE_PROJECTS.find(p => p.id === task.projectId);
      if (!proj || proj.isArchived) return;
      map[task.id] = { projectId: proj.id, projectTitle: proj.title, projectColor: proj.color || '#8a8070' };
    });
  }

  // 2. Fallback: scan milestone event activities for taskId links
  if (typeof MILESTONE_EVENTS !== 'undefined') {
    MILESTONE_EVENTS.forEach(ev => {
      const proj = MILESTONE_PROJECTS.find(p => p.id === ev.projectId);
      if (!proj || proj.isArchived) return;
      (ev.activities || []).forEach(act => {
        if (act.taskId && !map[act.taskId]) {
          map[act.taskId] = { projectId: proj.id, projectTitle: proj.title, projectColor: proj.color || '#8a8070' };
        }
      });
    });
  }

  return map;
}

function _renderTaskGroup(container, tasks, taskProjMap, rowIdxRef) {
  // Separate tasks into initiative-linked and standalone
  const byProject = {};
  const standalone = [];
  tasks.forEach(task => {
    const proj = taskProjMap[task.id];
    if (proj) {
      if (!byProject[proj.projectId]) byProject[proj.projectId] = { ...proj, tasks: [] };
      byProject[proj.projectId].tasks.push(task);
    } else {
      standalone.push(task);
    }
  });

  // Render standalone tasks as collapsible "Independent" group (only if there are also initiative tasks)
  const hasInitiatives = Object.keys(byProject).length > 0;
  if (standalone.length && hasInitiatives) {
    const storageKey = 'cdx_init_collapsed_independent';
    const isCollapsed = localStorage.getItem(storageKey) !== 'false';
    const indLabel = document.createElement('div');
    indLabel.className = 'tasks-initiative-label';
    indLabel.innerHTML = `<span style="margin-right:4px;transition:transform 0.2s;display:inline-block;font-size:10px;${isCollapsed ? '' : 'transform:rotate(90deg)'}">\u203A</span><span class="tasks-initiative-dot" style="background:var(--muted)"></span>Independent<span class="tasks-initiative-count">${standalone.length}</span>`;
    const indContainer = document.createElement('div');
    indContainer.style.display = isCollapsed ? 'none' : '';
    indLabel.addEventListener('click', () => {
      const collapsed = indContainer.style.display === 'none';
      indContainer.style.display = collapsed ? '' : 'none';
      const arrow = indLabel.querySelector('span');
      if (arrow) arrow.style.transform = collapsed ? 'rotate(90deg)' : '';
      localStorage.setItem(storageKey, !collapsed);
    });
    container.appendChild(indLabel);
    standalone.forEach(task => indContainer.appendChild(buildTaskRow(task, rowIdxRef.idx++)));
    container.appendChild(indContainer);
  } else {
    standalone.forEach(task => container.appendChild(buildTaskRow(task, rowIdxRef.idx++)));
  }

  // Render initiative sub-groups (collapsed by default)
  Object.values(byProject).forEach(projGroup => {
    const storageKey = 'cdx_init_collapsed_' + projGroup.projectId;
    const isCollapsed = localStorage.getItem(storageKey) !== 'false'; // collapsed by default

    const initLabel = document.createElement('div');
    initLabel.className = 'tasks-initiative-label';
    initLabel.innerHTML = `<span style="margin-right:4px;transition:transform 0.2s;display:inline-block;font-size:10px;${isCollapsed ? '' : 'transform:rotate(90deg)'}">\u203A</span><span class="tasks-initiative-dot" style="background:${escAttr(projGroup.projectColor)}"></span>${escHtml(projGroup.projectTitle)}<span class="tasks-initiative-count">${projGroup.tasks.length}</span>`;

    const initContainer = document.createElement('div');
    initContainer.style.display = isCollapsed ? 'none' : '';

    initLabel.addEventListener('click', () => {
      const collapsed = initContainer.style.display === 'none';
      initContainer.style.display = collapsed ? '' : 'none';
      const arrow = initLabel.querySelector('span');
      if (arrow) arrow.style.transform = collapsed ? 'rotate(90deg)' : '';
      localStorage.setItem(storageKey, !collapsed);
    });

    container.appendChild(initLabel);
    projGroup.tasks.forEach(task => initContainer.appendChild(buildTaskRow(task, rowIdxRef.idx++)));
    container.appendChild(initContainer);
  });
}

function renderTasks() {
  const body = document.getElementById('tasks-body');
  if (!body) return;
  body.innerHTML = '';

  const visible  = _settings.visibleCategories;
  const filtered = TASKS.filter(t => !t.category || visible.includes(t.category));
  const today    = localDateStr(new Date());
  // Exclude someday tasks from normal groups
  const active   = filtered.filter(t => !t.someday);
  const groups   = [
    { label: 'Overdue',  tasks: active.filter(t => !t.done && t.dueDate && t.dueDate < today) },
    { label: 'Today',    tasks: active.filter(t => !t.done && t.dueDate === today) },
    { label: 'Upcoming', tasks: active.filter(t => !t.done && t.dueDate && t.dueDate > today) },
    { label: 'No date',  tasks: active.filter(t => !t.done && !t.dueDate) },
    { label: 'Done',     tasks: active.filter(t =>  t.done && t.doneDate === today) },
  ];

  const taskProjMap = _buildTaskToProjectMap();
  const rowIdxRef = { idx: 0 };
  const collapsibleGroups = ['No date', 'Upcoming', 'Done'];
  groups.forEach(group => {
    if (!group.tasks.length) return;
    const isCollapsible = collapsibleGroups.includes(group.label);
    const storageKey = 'cdx_group_collapsed_' + group.label.replace(' ', '_');
    // Done group is collapsed by default; others only if explicitly saved
    const isCollapsed = isCollapsible && (
      group.label === 'Done'
        ? localStorage.getItem(storageKey) !== 'false'
        : localStorage.getItem(storageKey) === 'true'
    );

    const labelEl = document.createElement('div');
    labelEl.className = 'tasks-group-label' + (group.label === 'Overdue' ? ' overdue' : '');
    labelEl.style.cursor = isCollapsible ? 'pointer' : 'default';
    const countBadge = `<span class="tasks-group-count">${group.tasks.length}</span>`;
    labelEl.innerHTML = isCollapsible
      ? `<span style="margin-right:4px;transition:transform 0.2s;display:inline-block;${isCollapsed ? '' : 'transform:rotate(90deg)'}">›</span>${group.label} ${countBadge}`
      : `${group.label} ${countBadge}`;

    const taskContainer = document.createElement('div');
    taskContainer.style.display = isCollapsed ? 'none' : '';

    if (isCollapsible) {
      labelEl.addEventListener('click', () => {
        const collapsed = taskContainer.style.display === 'none';
        taskContainer.style.display = collapsed ? '' : 'none';
        const arrow = labelEl.querySelector('span');
        if (arrow) arrow.style.transform = collapsed ? 'rotate(90deg)' : '';
        localStorage.setItem(storageKey, !collapsed);
      });
    }

    body.appendChild(labelEl);
    _renderTaskGroup(taskContainer, group.tasks, taskProjMap, rowIdxRef);
    body.appendChild(taskContainer);
  });

  // Someday Graveyard
  renderSomedaySection(body, filtered.filter(t => t.someday), rowIdxRef.idx);

  // All clear — say so, in voice
  if (!body.children.length) {
    body.innerHTML = '<div class="tasks-void-empty">inbox zero. the void approves. ✦<br><span>press n to disturb the peace</span></div>';
  }

  // Keep the standalone Tasks page + its drawer live on data changes.
  const atkPanel = document.getElementById('panel-alltasks');
  if (atkPanel && atkPanel.style.display !== 'none' && document.getElementById('alltasks-body')) {
    renderAllTasksList();
    // Don't rebuild the drawer while the user is editing inside it.
    const ae = document.activeElement;
    const editingDrawer = ae && ae.closest && ae.closest('#atk-detail') && /INPUT|TEXTAREA/.test(ae.tagName);
    if (!editingDrawer) renderAtkDetail();
  }
  // Commitment progress on the planning design tabs tracks task completion.
  window._refreshPlanDesign && window._refreshPlanDesign();
  // Minimalist dashboard reflects today's tasks/cards.
  if (_mainPanel === 'default') window.renderDashboardBoard && window.renderDashboardBoard();
}

/* ── Task Decay helper ───────────────────────────────── */
function getTaskDecay(task) {
  if (!task.createdAt) return null;
  const created = task.createdAt.toDate ? task.createdAt.toDate() : new Date(task.createdAt);
  const ageMs = Date.now() - created.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const pct = Math.min(100, Math.round((ageDays / 14) * 100)); // 0–100% over 14 days
  const state = ageDays < 3 ? 'fresh' : ageDays < 7 ? 'aging' : 'stale';
  const label = ageDays < 1 ? 'new' : ageDays < 3 ? `${Math.floor(ageDays)}d` : ageDays < 7 ? `${Math.floor(ageDays)}d` : ageDays < 14 ? `${Math.floor(ageDays)}d` : '14d+';
  return { pct, state, label, ageDays };
}

function buildTaskRow(task, idx) {
  const wrap = document.createElement('div');
  wrap.className = 'task-row-wrap';
  wrap.dataset.taskId = task.id;

  const hasSubs  = task.subtasks && task.subtasks.length > 0;
  const cat      = task.category ? CATEGORIES[task.category] : null;
  const catClr   = getCatColor(task.category);
  const catBadge = cat
    ? `<span class="task-cat-badge" data-setcat="${escAttr(task.id)}" title="Click to change category" style="cursor:pointer;background:${catClr}22;color:${catClr};border:1px solid ${catClr}44">${cat.label}</span>`
    : `<span class="task-cat-badge" data-setcat="${escAttr(task.id)}" title="Click to set category" style="cursor:pointer;opacity:0.35;border:1px dashed var(--border)">+ cat</span>`;

  let schedBadge = '';
  if (task.calEventId) {
    const ev = CAL_EVENTS.find(e => e.id === task.calEventId);
    const ts = ev?.startTime ? fmtTimeSched(ev.startTime) : '';
    const te = ev?.endTime ? fmtTimeSched(ev.endTime) : '';
    const timeStr = ts && te ? `${ts}–${te}` : ts || 'Scheduled';
    schedBadge = `<span class="task-cal-badge">⊙ ${timeStr}</span>`;
  }

  const PRIORITY_LABELS = { high: 'High', med: 'Med', low: 'Low' };
  const priorityLabel = task.priority ? PRIORITY_LABELS[task.priority] || '' : '';
  const priorityBadge = priorityLabel ? `<span style="font-family:var(--font-mono);font-size:10px;color:${task.priority==='high'?'var(--gold)':task.priority==='med'?'rgba(255,255,255,0.55)':'var(--muted)'}">${priorityLabel}</span>` : '';

  let recurBadge = '';
  if (task.recurrence) {
    const rl = task.recurrence === 'daily' ? '↻ Daily'
      : task.recurrence === 'weekdays' ? '↻ Weekdays'
      : task.recurrence === 'weekly' ? '↻ Weekly'
      : task.recurrence === 'monthly' ? '↻ Monthly'
      : task.recurrence === 'yearly' ? '↻ Yearly'
      : task.recurrence.startsWith('custom:') ? `↻ ${task.recurrence.replace('custom:','')}`
      : `↻ ${task.recurrence}`;
    recurBadge = `<span class="task-recur-badge">${rl}</span>`;
  }

  // Decay bar
  const decay = !task.done ? getTaskDecay(task) : null;
  const decayBarHtml = decay
    ? `<div class="task-decay-bar"><div class="task-decay-fill ${decay.state}" style="width:${decay.pct}%"></div></div>
       <span class="task-decay-label ${decay.state}">${decay.label}</span>`
    : '';

  // Energy badge
  const energyInfo = task.energyType ? ENERGY_TYPES[task.energyType] : null;
  const energyBadge = energyInfo
    ? `<span class="task-energy-badge ${energyInfo.cssClass}">${energyInfo.icon} ${energyInfo.label}</span>`
    : '';

  // Time-spent badge
  const timeBadge = (task.done && task.timeSpentMinutes)
    ? `<span style="font-family:var(--font-mono);font-size:10px;color:var(--neon);background:rgba(74,124,94,0.1);border:1px solid rgba(74,124,94,0.3);border-radius:100px;padding:1px 6px">⏱ ${task.timeSpentMinutes < 60 ? task.timeSpentMinutes + 'm' : Math.floor(task.timeSpentMinutes/60) + 'h' + (task.timeSpentMinutes%60 ? ' ' + task.timeSpentMinutes%60 + 'm' : '')}</span>`
    : '';

  // Friction indicator
  const frictionBadge = (task.deferrals >= 3 && !task.done)
    ? `<span class="task-friction-badge" data-friction="${escAttr(task.id)}" title="Deferred ${task.deferrals} times — click to tag">⚠ Friction</span>`
    : '';

  // People badges
  const peopleBadgesHtml = (task.people && task.people.length)
    ? task.people.map(id => {
        const p = PEOPLE.find(p => p.id === id);
        if (!p) return '';
        return `<span class="task-person-badge" style="background:${p.color}18;border-color:${p.color}44;color:${p.color}" title="${escAttr(p.name)}">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:12px;height:12px;border-radius:50%;background:${p.color};font-size:6px;font-weight:600;color:#0d0c0a;margin-right:3px">${escHtml(p.initials)}</span>@${escHtml(p.name)}</span>`;
      }).join('')
    : '';

  // Re-entry snapshot display
  const snapshotHtml = task.reentrySnapshot
    ? `<div class="task-snapshot-display">↩ ${escHtml(task.reentrySnapshot)}</div>`
    : '';

  const row = document.createElement('div');
  row.className = 'task-row';
  row.draggable = true;
  row.dataset.taskId = task.id;
  row.style.animationDelay = `${idx * 35}ms`;
  const today = localDateStr(new Date());
  const isOverdue = task.dueDate && task.dueDate < today && !task.done;
  const inlineDue = task.dueDate
    ? `<span class="task-inline-due ${isOverdue ? 'overdue' : ''}">${fmtDate(task.dueDate)}</span>`
    : '';
  const inlineCatDot = cat
    ? `<span class="task-inline-cat-dot" style="background:${catClr}" title="${cat.label}"></span>`
    : '';
  const inlineDecay = decay
    ? `<span class="task-inline-decay ${decay.state}">${decay.label}</span>`
    : '';
  const priorityClass = task.priority ? ` priority-${task.priority}` : '';

  row.innerHTML = `
    <button class="task-expand-btn ${hasSubs ? 'open' : 'ghost'}" data-expand="${escAttr(task.id)}">›</button>
    <div class="task-check ${task.done ? 'done' : ''}" data-check="${escAttr(task.id)}">${task.done ? '✓' : ''}</div>
    <div class="task-content">
      <div class="task-title-line">
        ${inlineCatDot}
        <span class="task-title ${task.done ? 'done' : ''}${priorityClass}" data-edit="${escAttr(task.id)}">${escHtml(task.title)}</span>
        ${inlineDue}
        ${inlineDecay}
      </div>
      <div class="task-meta">
        <div class="task-priority-dot ${task.priority || 'low'}"></div>
        ${priorityBadge}
        ${catBadge}
        ${schedBadge}
        ${recurBadge}
        ${energyBadge}
        ${frictionBadge}
        ${timeBadge}
        ${peopleBadgesHtml}
        ${snapshotHtml}
      </div>
    </div>
    <div class="task-actions-group">
      ${!task.done ? `<button class="task-action-btn commit" data-commit="${escAttr(task.id)}" title="Enter commit mode">▶</button>` : ''}
      <button class="task-action-btn" data-task-edit="${escAttr(task.id)}" title="Edit task">✎</button>
      <button class="task-action-btn" data-add-sub="${escAttr(task.id)}" title="Add subtask">⊕</button>
      <button class="task-action-btn danger" data-del="${escAttr(task.id)}" title="Delete task">✕</button>
    </div>`;
  wrap.appendChild(row);

  const subWrap = document.createElement('div');
  subWrap.className = hasSubs ? 'subtasks-wrap expanded' : 'subtasks-wrap';
  subWrap.dataset.taskId = task.id;
  if (hasSubs) task.subtasks.forEach(sub => subWrap.appendChild(buildSubtaskRow(task.id, sub)));

  const addSubRow = document.createElement('div');
  addSubRow.className = 'subtask-add-row hidden';
  addSubRow.dataset.taskId = task.id;
  addSubRow.innerHTML = `
    <input class="subtask-add-input" placeholder="Subtask…" data-parent="${escAttr(task.id)}" autocomplete="off" />
    <button class="subtask-add-confirm" data-parent="${escAttr(task.id)}">↵</button>`;
  subWrap.appendChild(addSubRow);
  wrap.appendChild(subWrap);

  row.addEventListener('dragstart', e => {
    _dragTaskId = task.id; _dragSubId = null;
    row.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', task.id);
  });
  row.addEventListener('dragend', () => {
    row.classList.remove('dragging'); _dragTaskId = null; _dragSubId = null;
  });
  return wrap;
}

function buildSubtaskRow(parentId, sub) {
  const row = document.createElement('div');
  row.className = 'subtask-row';
  row.dataset.subId = sub.id;
  row.draggable = true;

  let schedBadge = '';
  if (sub.calEventId) {
    const ev = CAL_EVENTS.find(e => e.id === sub.calEventId);
    if (ev?.startTime) schedBadge = `<span class="task-cal-badge" style="font-size:10px">⊙ ${fmtTimeSched(ev.startTime)}</span>`;
  }

  row.innerHTML = `
    <div class="task-check ${sub.done ? 'done' : ''}" data-subcheck="${escAttr(parentId)}" data-sub="${escAttr(sub.id)}">${sub.done ? '✓' : ''}</div>
    <span class="subtask-title ${sub.done ? 'done' : ''}">${escHtml(sub.title)}</span>
    ${schedBadge}
    <button class="task-action-btn danger" style="opacity:0;margin-left:auto" data-delsub="${escAttr(parentId)}" data-sub="${escAttr(sub.id)}">✕</button>`;
  row.addEventListener('mouseenter', () => row.querySelector('.task-action-btn').style.opacity = '1');
  row.addEventListener('mouseleave', () => row.querySelector('.task-action-btn').style.opacity = '0');
  row.addEventListener('dragstart', e => {
    _dragTaskId = parentId; _dragSubId = sub.id;
    row.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', `${parentId}:${sub.id}`);
    e.stopPropagation();
  });
  row.addEventListener('dragend', () => {
    row.classList.remove('dragging'); _dragTaskId = null; _dragSubId = null;
  });
  return row;
}

/* ── Category cycle ───────────────────────────────────── */
async function cycleTaskCategory(taskId) {
  const task = TASKS.find(t => t.id === taskId);
  if (!task) return;
  const catCycle = Object.keys(CATEGORIES).concat([null]);
  const idx  = catCycle.indexOf(task.category || null);
  const next = catCycle[(idx + 1) % catCycle.length];
  await updateTask(taskId, { category: next });
}

/* ── Event delegation for task lists (dashboard #tasks-body + Tasks page) ──
   Extracted into named handlers + wireTaskListEvents() so any container that
   holds buildTaskRow() rows gets identical behaviour. */
function _tlClick(e) {
  const check    = e.target.closest('[data-check]');
  const subCheck = e.target.closest('[data-subcheck]');
  const del      = e.target.closest('[data-del]');
  const delSub   = e.target.closest('[data-delsub]');
  const addSub   = e.target.closest('[data-add-sub]');
  const expand   = e.target.closest('[data-expand]');
  const editEl   = e.target.closest('[data-edit]');
  const setCat   = e.target.closest('[data-setcat]');
  const confirmSub = e.target.closest('.subtask-add-confirm');
  const commitBtn  = e.target.closest('[data-commit]');
  const frictionEl = e.target.closest('[data-friction]');
  const taskEditBtn = e.target.closest('[data-task-edit]');

  if (check)    { handleCheckClick(check.dataset.check, e); return; }
  if (subCheck) { toggleSubtask(subCheck.dataset.subcheck, subCheck.dataset.sub); return; }
  if (del)      { deleteTask(del.dataset.del); return; }
  if (delSub)   { deleteSubtask(delSub.dataset.delsub, delSub.dataset.sub); return; }
  if (setCat)   { cycleTaskCategory(setCat.dataset.setcat); return; }
  if (commitBtn) { openCommitRitual(commitBtn.dataset.commit); return; }
  if (frictionEl) { openFrictionModal(frictionEl.dataset.friction); return; }
  if (taskEditBtn) { openTaskEditModal(taskEditBtn.dataset.taskEdit); return; }

  if (addSub) {
    const taskId  = addSub.dataset.addSub;
    const subWrap = document.querySelector(`.subtasks-wrap[data-task-id="${taskId}"]`);
    const addRow  = subWrap?.querySelector('.subtask-add-row');
    if (addRow) {
      addRow.classList.toggle('hidden');
      if (!addRow.classList.contains('hidden')) {
        subWrap.classList.add('expanded');
        addRow.querySelector('.subtask-add-input')?.focus();
        // show expand btn
        const wrap = document.querySelector(`.task-row-wrap[data-task-id="${taskId}"]`);
        wrap?.querySelector('.task-expand-btn')?.classList.remove('ghost');
      }
    }
    return;
  }

  if (expand) {
    const taskId  = expand.dataset.expand;
    const subWrap = document.querySelector(`.subtasks-wrap[data-task-id="${taskId}"]`);
    if (subWrap) {
      subWrap.classList.toggle('expanded');
      expand.classList.toggle('open');
    }
    return;
  }

  if (confirmSub) {
    const parentId = confirmSub.dataset.parent;
    const input = document.querySelector(`.subtask-add-input[data-parent="${parentId}"]`);
    const title = input?.value.trim();
    if (title) { addSubtask(parentId, title); input.value = ''; }
    return;
  }

  if (editEl && !e.target.closest('button')) {
    startInlineEdit(editEl);
    return;
  }
}

/* Keyboard events on task lists */
function _tlKeydown(e) {
  if (e.key === 'Enter') {
    if (e.target.classList.contains('subtask-add-input')) {
      const parentId = e.target.dataset.parent;
      const title = e.target.value.trim();
      if (title) { addSubtask(parentId, title); e.target.value = ''; }
      return;
    }
    if (e.target.classList.contains('task-inline-input')) {
      commitInlineEdit(e.target); return;
    }
  }
  if (e.key === 'Escape') {
    if (e.target.classList.contains('task-inline-input')) cancelInlineEdit(e.target);
    if (e.target.classList.contains('subtask-add-input')) {
      e.target.closest('.subtask-add-row')?.classList.add('hidden');
    }
  }
}

function _tlFocusout(e) {
  if (e.target.classList.contains('task-inline-input')) commitInlineEdit(e.target);
}

function wireTaskListEvents(el) {
  if (!el || el.dataset.tlWired) return;
  el.dataset.tlWired = '1';
  el.addEventListener('click', _tlClick);
  el.addEventListener('keydown', _tlKeydown);
  el.addEventListener('focusout', _tlFocusout);
}
wireTaskListEvents(document.getElementById('tasks-body'));

/* ── Inline title editing ─────────────────────────────── */
function startInlineEdit(titleEl) {
  const taskId = titleEl.dataset.edit;
  const input  = document.createElement('input');
  input.className = 'task-inline-input';
  input.value = titleEl.textContent;
  input.dataset.taskId   = taskId;
  input.dataset.original = titleEl.textContent;
  titleEl.replaceWith(input);
  input.focus(); input.select();
}

function syncTaskTitleToMilestone(taskId, newTitle) {
  for (const msEv of MILESTONE_EVENTS) {
    const act = (msEv.activities || []).find(a => a.taskId === taskId);
    if (act && act.text !== newTitle) {
      const activities = msEv.activities.map(a => a.taskId === taskId ? { ...a, text: newTitle } : a);
      updateMilestoneEvent(msEv.id, { activities });
    }
  }
}

function commitInlineEdit(input) {
  const title  = input.value.trim();
  const taskId = input.dataset.taskId;
  const orig   = input.dataset.original;
  if (title && title !== orig) {
    updateTask(taskId, { title });
    syncTaskTitleToMilestone(taskId, title);
  }
  // Firestore onSnapshot will re-render and restore the span
  const span = document.createElement('span');
  span.className = 'task-title';
  span.dataset.edit = taskId;
  span.textContent = title || orig;
  input.replaceWith(span);
}

function cancelInlineEdit(input) {
  const span = document.createElement('span');
  span.className = 'task-title';
  span.dataset.edit = input.dataset.taskId;
  span.textContent = input.dataset.original;
  input.replaceWith(span);
}

/* ── Task Edit Modal ──────────────────────────────────── */
let _editTaskId = null;

function openTaskEditModal(taskId) {
  const task = TASKS.find(t => t.id === taskId);
  if (!task) return;
  _editTaskId = taskId;

  document.getElementById('te-title').value    = task.title || '';
  document.getElementById('te-date').value     = task.dueDate || '';
  document.getElementById('te-priority').value = task.priority || 'med';
  document.getElementById('te-notes').value    = task.notes || '';

  // Category select
  const catSel = document.getElementById('te-category');
  catSel.innerHTML = '<option value="">No category</option>' +
    Object.entries(CATEGORIES).map(([k,v]) =>
      `<option value="${escAttr(k)}">${escHtml(v.label)}</option>`).join('');
  catSel.value = task.category || '';

  // Recurrence select — preserve an existing custom:… value as its own option
  const recSel = document.getElementById('te-recur');
  if (recSel) {
    const rv = task.recurrence || '';
    recSel.querySelectorAll('option[data-custom]').forEach(o => o.remove());
    if (rv && !Array.from(recSel.options).some(o => o.value === rv)) {
      const o = document.createElement('option');
      o.value = rv; o.dataset.custom = '1'; o.textContent = _recurLabel(rv);
      recSel.appendChild(o);
    }
    recSel.value = rv;
  }

  // Energy picker
  const picker = document.getElementById('te-energy-picker');
  picker.querySelectorAll('.energy-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.energy === (task.energyType || ''));
  });

  openOverlay('task-edit-modal');
  setTimeout(() => document.getElementById('te-title')?.focus(), 80);
}

async function confirmTaskEdit() {
  if (!_editTaskId) return;
  const title    = document.getElementById('te-title').value.trim();
  const dueDate  = document.getElementById('te-date').value || null;
  const priority = document.getElementById('te-priority').value;
  const category = document.getElementById('te-category').value || null;
  const recurrence = document.getElementById('te-recur')?.value || '';
  const notes    = document.getElementById('te-notes').value.trim() || null;
  const energyType = document.getElementById('te-energy-picker')
    .querySelector('.energy-pill.active')?.dataset.energy || null;

  if (!title) { showToast('Title is required', 'error'); return; }
  await updateTask(_editTaskId, { title, dueDate, priority, category, recurrence, notes, energyType });
  syncTaskTitleToMilestone(_editTaskId, title);
  closeOverlay('task-edit-modal');
  _editTaskId = null;
  showToast('Task updated', 'success');
}

function initTaskEditModal() {
  document.getElementById('te-save-btn')?.addEventListener('click', confirmTaskEdit);
  document.getElementById('te-title')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmTaskEdit();
  });
  document.getElementById('te-energy-picker')?.querySelectorAll('.energy-pill').forEach(pill => {
    pill.addEventListener('click', e => {
      e.stopPropagation();
      const val = pill.dataset.energy;
      const picker = document.getElementById('te-energy-picker');
      if (picker.querySelector('.energy-pill.active')?.dataset.energy === val) {
        picker.querySelectorAll('.energy-pill').forEach(p => p.classList.remove('active'));
        document.querySelector('.energy-pill[data-energy=""]')?.classList.add('active');
      } else {
        picker.querySelectorAll('.energy-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
      }
    });
  });
}

/* ── Firestore CRUD ───────────────────────────────────── */
async function addTask(title, priority = 'med', dueDate = '', category = '', recurrence = '', energyType = '', people = []) {
  if (!title?.trim()) { showToast('Task title cannot be empty', 'error'); return; }
  const { addDoc, serverTimestamp } = window.CDX_FB;
  try {
    await addDoc(_uc('tasks'), {
      title, done: false, priority,
      dueDate: dueDate || null,
      category: category || null,
      recurrence: recurrence || null,
      energyType: energyType || null,
      people: people.length ? people : null,
      calEventId: null, subtasks: [],
      deferrals: 0,
      createdAt: serverTimestamp()
    });
    showToast('Task added', 'success');
  } catch (err) {
    console.error('addTask error:', err);
    showToast('Failed to add task', 'error');
  }
}

/* Duplicate an existing task into a fresh, not-done copy. Useful when a task is
   in-progress or already done but needs to be done again. Copies the shape/meta
   (priority, due, category, recurrence, energy, people, notes, subtasks) but
   resets completion state and any single-use links (calendar event, deferrals). */
async function duplicateTask(taskId) {
  const src = TASKS.find(t => t.id === taskId);
  if (!src) return;
  const { addDoc, serverTimestamp } = window.CDX_FB;
  try {
    const ref = await addDoc(_uc('tasks'), {
      title: src.title,
      done: false,
      priority: src.priority || 'med',
      dueDate: src.dueDate || null,
      category: src.category || null,
      recurrence: src.recurrence || null,
      energyType: src.energyType || null,
      people: (src.people && src.people.length) ? src.people : null,
      projectId: src.projectId || null,
      notes: src.notes || null,
      // Fresh copy: subtasks reset to not-done, no calendar link, no time logged
      subtasks: (src.subtasks || []).map(s => ({ ...s, id: crypto.randomUUID(), done: false })),
      calEventId: null,
      deferrals: 0,
      createdAt: serverTimestamp()
    });
    showToast('Task duplicated', 'success');
    // Select the new copy in the Tasks page detail pane if we're there
    if (_mainPanel === 'alltasks') { _atkSelectedId = ref.id; }
  } catch (err) {
    console.error('duplicateTask error:', err);
    showToast('Failed to duplicate task', 'error');
  }
}

async function updateTask(taskId, data) {
  const { updateDoc, serverTimestamp } = window.CDX_FB;
  try {
    await updateDoc(_ud('tasks', taskId), { ...data, updatedAt: serverTimestamp() });
  } catch (err) {
    console.error('updateTask error:', err);
    showToast('Failed to update task', 'error');
  }
}

async function toggleTask(taskId, timeSpentMinutes = null, category = null) {
  const task = TASKS.find(t => t.id === taskId);
  if (!task) return;
  const updates = { done: !task.done };
  if (!task.done) {
    updates.doneDate = localDateStr(new Date());
    updates.doneAt = new Date().toISOString(); // exact time — used by the orbit recap constellation
    if (timeSpentMinutes != null) updates.timeSpentMinutes = timeSpentMinutes;
    if (category) updates.category = category;
  }
  // Celebration fires before the snapshot re-render wipes the row
  if (!task.done) _taskFireCelebration(taskId, task);
  await updateTask(taskId, updates);
  if (!task.done) {
    const short = task.title.length > 30 ? task.title.slice(0, 30) + '…' : task.title;
    showUndoToast(`done: ${short}`, () => updateTask(taskId, { done: false, doneDate: null }));
  }
  // Sync done status to linked milestone activities
  const newDone = !task.done;
  for (const msEv of MILESTONE_EVENTS) {
    const act = (msEv.activities || []).find(a => a.taskId === taskId);
    if (act && act.done !== newDone) {
      const activities = msEv.activities.map(a => a.taskId === taskId ? { ...a, done: newDone } : a);
      updateMilestoneEvent(msEv.id, { activities });
    }
  }
}

/* ── Task completion celebration ──────────────────────────
   Same reward grammar as habits: burst + identity vote + haptic.
   Elements are appended to <body> so the snapshot re-render can't wipe them. */
function _taskFireCelebration(taskId, task) {
  const esc = (window.CSS && CSS.escape) ? CSS.escape(taskId) : taskId;
  const check = document.querySelector(`[data-check="${esc}"]`);
  if (!check) return;
  const r = check.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;

  const ring = document.createElement('div');
  ring.className = 'task-burst-ring';
  ring.style.left = cx + 'px'; ring.style.top = cy + 'px';
  document.body.appendChild(ring);
  setTimeout(() => ring.remove(), 700);

  for (let i = 0; i < 6; i++) {
    const p = document.createElement('div');
    p.className = 'task-burst-star';
    p.textContent = '✦';
    const ang = (i / 6) * Math.PI * 2 + Math.random() * 0.6;
    const dist = 18 + Math.random() * 22;
    p.style.left = cx + 'px'; p.style.top = cy + 'px';
    p.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    p.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 900);
  }

  const proj = (typeof MILESTONE_PROJECTS !== 'undefined' ? MILESTONE_PROJECTS : [])
    .find(p => p.id === task.projectId);
  const vote = document.createElement('div');
  vote.className = 'task-vote-float';
  vote.textContent = '+1 for ' + (proj ? proj.title : 'future you');
  vote.style.left = (r.right + 10) + 'px'; vote.style.top = cy + 'px';
  document.body.appendChild(vote);
  setTimeout(() => vote.remove(), 1900);

  if (navigator.vibrate) { try { navigator.vibrate(10); } catch {} }
}

/* ── Time-to-complete popover ─────────────────────────── */
let _timePickerTaskId = null;
let _timePickerMins   = null;
let _timePickerCat    = null;

function handleCheckClick(taskId, clickEvent) {
  const task = TASKS.find(t => t.id === taskId);
  if (!task) return;
  // Un-completing: no popover needed
  if (task.done) { toggleTask(taskId); return; }
  // Completing: show time picker near the checkbox
  _timePickerTaskId = taskId;
  _timePickerMins   = null;
  _timePickerCat    = task.category || null;
  const pop = document.getElementById('task-time-popover');
  // Reset state
  pop.querySelectorAll('.time-opt-btn').forEach(b => b.classList.remove('active'));
  const customInp = document.getElementById('task-time-custom');
  if (customInp) customInp.value = '';
  const warn = document.getElementById('task-time-warn');
  if (warn) warn.style.display = 'none';
  // Populate theme chips from CATEGORIES; preselect the task's current theme
  const catWrap = document.getElementById('task-time-cats');
  if (catWrap) {
    catWrap.innerHTML = Object.keys(CATEGORIES).map(id => {
      const c = CATEGORIES[id];
      const active = id === _timePickerCat;
      return `<button class="time-cat-btn${active ? ' active' : ''}" data-cat="${escAttr(id)}"
        style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:100px;cursor:pointer;
        background:${active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)'};
        border:1px solid ${active ? 'rgba(255,255,255,0.35)' : 'var(--border)'};
        color:${active ? '#fff' : 'var(--muted)'};font-family:var(--font-mono);font-size:10px;letter-spacing:0.08em;text-transform:uppercase">
        <span style="width:7px;height:7px;border-radius:50%;background:${getCatColor(id)}"></span>${escHtml(c.label)}</button>`;
    }).join('');
  }
  // Position near the click target when we have one; otherwise centre it in
  // the viewport (used by keyboard / commit / pomo completion paths).
  const popW = 250, popH = 180;
  const tgt = clickEvent && clickEvent.target && clickEvent.target.getBoundingClientRect
    ? clickEvent.target : null;
  if (tgt) {
    const rect = tgt.getBoundingClientRect();
    let left = rect.left;
    let top  = rect.bottom + 8;
    if (left + popW > window.innerWidth - 12) left = window.innerWidth - popW - 12;
    if (top + popH > window.innerHeight - 12) top = rect.top - popH - 8;
    pop.style.left = left + 'px';
    pop.style.top  = top + 'px';
  } else {
    pop.style.left = Math.round((window.innerWidth - popW) / 2) + 'px';
    pop.style.top  = Math.round((window.innerHeight - popH) / 2) + 'px';
  }
  pop.style.display = 'block';
}

function initTimePickerPopover() {
  const pop = document.getElementById('task-time-popover');

  pop.querySelectorAll('.time-opt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      pop.querySelectorAll('.time-opt-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _timePickerMins = parseInt(btn.dataset.mins, 10);
      const customInp = document.getElementById('task-time-custom');
      if (customInp) customInp.value = '';
    });
  });

  document.getElementById('task-time-custom')?.addEventListener('input', e => {
    const v = parseInt(e.target.value, 10);
    pop.querySelectorAll('.time-opt-btn').forEach(b => b.classList.remove('active'));
    _timePickerMins = isNaN(v) || v <= 0 ? null : v;
  });

  // Theme chips (delegated — repopulated each open)
  document.getElementById('task-time-cats')?.addEventListener('click', e => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    _timePickerCat = b.dataset.cat;
    pop.querySelectorAll('.time-cat-btn').forEach(x => {
      const on = x === b;
      x.classList.toggle('active', on);
      x.style.background = on ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)';
      x.style.border = `1px solid ${on ? 'rgba(255,255,255,0.35)' : 'var(--border)'}`;
      x.style.color = on ? '#fff' : 'var(--muted)';
    });
    const warn = document.getElementById('task-time-warn');
    if (warn) warn.style.display = 'none';
  });

  document.getElementById('task-time-confirm')?.addEventListener('click', async () => {
    // Theme is mandatory on completion — nudge instead of closing if unset
    if (!_timePickerCat) {
      const warn = document.getElementById('task-time-warn');
      if (warn) warn.style.display = 'block';
      return;
    }
    pop.style.display = 'none';
    if (_timePickerTaskId) await toggleTask(_timePickerTaskId, _timePickerMins, _timePickerCat);
    _timePickerTaskId = null;
  });

  // "Skip time" — still records the theme (mandatory), just no minutes logged
  document.getElementById('task-time-skip')?.addEventListener('click', async () => {
    if (!_timePickerCat) {
      const warn = document.getElementById('task-time-warn');
      if (warn) warn.style.display = 'block';
      return;
    }
    pop.style.display = 'none';
    if (_timePickerTaskId) await toggleTask(_timePickerTaskId, null, _timePickerCat);
    _timePickerTaskId = null;
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (pop.style.display !== 'none' && !pop.contains(e.target) && !e.target.closest('[data-check]')) {
      pop.style.display = 'none';
      _timePickerTaskId = null;
    }
  }, true);
}

/* ── Safe calendar event delete helper ──────────────────── */
async function _safeDeleteCalEvent(eventId) {
  if (!eventId) return;
  try {
    await window.CDX_FB.deleteDoc(_ud('calEvents', eventId));
  } catch (err) {
    console.warn('calEvent delete failed (may already be gone):', eventId, err.message);
  }
}

async function deleteTask(taskId) {
  const task = TASKS.find(t => t.id === taskId);
  if (!task) return;
  const snapshot = { ...task };   // for undo — restore with the same doc id
  const { deleteDoc } = window.CDX_FB;
  try {
    // Delete the task's own linked calendar event
    await _safeDeleteCalEvent(task.calEventId);
    // Delete any subtask calendar events
    for (const sub of (task.subtasks || [])) {
      await _safeDeleteCalEvent(sub.calEventId);
    }
    // Clean up orphaned calEvents that reference this task by taskId
    // (handles cases where task.calEventId was null/mismatched)
    for (const ev of CAL_EVENTS.filter(e => e.taskId === taskId && e.id !== task.calEventId)) {
      await _safeDeleteCalEvent(ev.id);
    }
    // Remove from any milestone activities that reference this task
    for (const msEv of MILESTONE_EVENTS) {
      if ((msEv.activities || []).some(a => a.taskId === taskId)) {
        await updateMilestoneEvent(msEv.id, { activities: msEv.activities.filter(a => a.taskId !== taskId) });
      }
    }
    await deleteDoc(_ud('tasks', taskId));
    showUndoToast('task banished.', async () => {
      const { setDoc, serverTimestamp } = window.CDX_FB;
      const { id, ...data } = snapshot;
      // calEventId / milestone links were cleaned up above and are not restored
      delete data.calEventId;
      await setDoc(_ud('tasks', id), { ...data, updatedAt: serverTimestamp() });
    });
  } catch (err) {
    console.error('deleteTask error:', err);
    showToast('Failed to delete task', 'error');
  }
}

async function addSubtask(taskId, title) {
  if (!title?.trim()) return;
  const { arrayUnion, serverTimestamp, updateDoc } = window.CDX_FB;
  const sub = { id: crypto.randomUUID(), title: title.trim(), done: false, createdAt: new Date().toISOString() };
  try {
    await updateDoc(_ud('tasks', taskId), { subtasks: arrayUnion(sub), updatedAt: serverTimestamp() });
  } catch (err) {
    console.error('addSubtask error:', err);
    showToast('Failed to add subtask', 'error');
  }
}

async function toggleSubtask(taskId, subId) {
  const { runTransaction, serverTimestamp } = window.CDX_FB;
  try {
    await runTransaction(window.CDX_DB, async (transaction) => {
      const ref = _ud('tasks', taskId);
      const snap = await transaction.get(ref);
      if (!snap.exists()) throw new Error('Task not found');
      const subtasks = (snap.data().subtasks || []).map(s => s.id === subId ? { ...s, done: !s.done } : s);
      transaction.update(ref, { subtasks, updatedAt: serverTimestamp() });
    });
  } catch (err) {
    console.error('toggleSubtask error:', err);
    showToast('Failed to update subtask', 'error');
  }
}

async function deleteSubtask(taskId, subId) {
  const { runTransaction, serverTimestamp } = window.CDX_FB;
  // Find the calEventId from local state before transacting
  const sub = TASKS.find(t => t.id === taskId)?.subtasks?.find(s => s.id === subId);
  if (sub?.calEventId) await _safeDeleteCalEvent(sub.calEventId);
  try {
    await runTransaction(window.CDX_DB, async (transaction) => {
      const ref = _ud('tasks', taskId);
      const snap = await transaction.get(ref);
      if (!snap.exists()) throw new Error('Task not found');
      const subtasks = (snap.data().subtasks || []).filter(s => s.id !== subId);
      transaction.update(ref, { subtasks, updatedAt: serverTimestamp() });
    });
  } catch (err) {
    console.error('deleteSubtask error:', err);
    showToast('Failed to delete subtask', 'error');
  }
}

/* ── Schedule Modal ───────────────────────────────────── */
function openScheduleModal(date, startTime, taskId, subId) {
  _schedCtx = { taskId, subId, date, startTime };
  const task = TASKS.find(t => t.id === taskId);
  if (!task) return;
  document.getElementById('sched-title').value = subId
    ? (task.subtasks?.find(s => s.id === subId)?.title || task.title)
    : task.title;
  document.getElementById('sched-date').value = date;
  document.getElementById('sched-time').value = startTime;
  document.getElementById('sched-duration').value = 30;
  const subsSection = document.getElementById('sched-subtasks-section');
  const subsList    = document.getElementById('sched-subtasks-list');
  if (!subId && task.subtasks && task.subtasks.length > 0) {
    subsSection.style.display = 'block';
    subsList.innerHTML = task.subtasks.map(s => `
      <div class="sched-subtask-item">
        <input type="checkbox" id="sched-sub-${s.id}" value="${escAttr(s.id)}" checked />
        <label for="sched-sub-${s.id}" style="flex:1">${escHtml(s.title)}</label>
        <input type="time" class="sched-input" style="width:100px;font-size:11px;padding:4px 6px"
               id="sched-sub-time-${s.id}" value="${startTime}" />
      </div>`).join('');
  } else {
    subsSection.style.display = 'none';
    subsList.innerHTML = '';
  }
  document.getElementById('schedule-modal').classList.add('open');
}

async function confirmSchedule() {
  const { addDoc, deleteDoc, serverTimestamp } = window.CDX_FB;
  const title     = document.getElementById('sched-title').value.trim();
  const date      = document.getElementById('sched-date').value;
  const startTime = document.getElementById('sched-time').value;
  const duration  = parseInt(document.getElementById('sched-duration').value) || 60;
  const endTime   = addMinutes(startTime, duration);
  if (!title || !date || !startTime) return;

  const { taskId, subId } = _schedCtx;
  const task = TASKS.find(t => t.id === taskId);
  if (!task) return;
  const color = getCatColor(task.category);

  if (subId) {
    const sub = task.subtasks?.find(s => s.id === subId);
    if (!sub) return;
    await _safeDeleteCalEvent(sub.calEventId);
    const ref = await addDoc(_uc('calEvents'), {
      title, taskId, subId, date, startTime, endTime, duration, color,
      createdAt: serverTimestamp()
    });
    await updateTask(taskId, {
      subtasks: task.subtasks.map(s => s.id === subId ? { ...s, calEventId: ref.id } : s)
    });
  } else {
    await _safeDeleteCalEvent(task.calEventId);
    const ref = await addDoc(_uc('calEvents'), {
      title, taskId, date, startTime, endTime, duration, color,
      createdAt: serverTimestamp()
    });
    await updateTask(taskId, { calEventId: ref.id });
    // Schedule checked subtasks
    const checkedBoxes = document.querySelectorAll('#sched-subtasks-list input[type="checkbox"]:checked');
    for (const cb of checkedBoxes) {
      const sid = cb.value;
      const st  = document.getElementById(`sched-sub-time-${sid}`)?.value || startTime;
      const freshTask = TASKS.find(t => t.id === taskId);
      const sub = freshTask?.subtasks?.find(s => s.id === sid);
      if (!sub) continue;
      await _safeDeleteCalEvent(sub.calEventId);
      const sref = await addDoc(_uc('calEvents'), {
        title: sub.title, taskId, subId: sid, date,
        startTime: st, endTime: addMinutes(st, 30), duration: 30, color,
        createdAt: serverTimestamp()
      });
      const latestTask = TASKS.find(t => t.id === taskId);
      await updateTask(taskId, {
        subtasks: (latestTask?.subtasks || []).map(s => s.id === sid ? { ...s, calEventId: sref.id } : s)
      });
    }
  }
  document.getElementById('schedule-modal').classList.remove('open');
  _schedCtx = {};
}

function initScheduleModal() {
  document.getElementById('sched-confirm-btn')?.addEventListener('click', confirmSchedule);
}

/* ── Drag-to-schedule helpers ─────────────────────────────
   Shared by the dashboard time-block grid and the Calendar page. Dropping a
   task onto a slot gives it a calEvent (a place on the timeline); dropping an
   existing event moves it. Both keep the task ↔ calEvent link in sync. */
async function scheduleTaskAt(taskId, date, startTime, duration = 30) {
  const { addDoc, serverTimestamp } = window.CDX_FB;
  const task = TASKS.find(t => t.id === taskId);
  if (!task || !window.CDX_USER?.uid) return;
  try {
    await _safeDeleteCalEvent(task.calEventId);
    const endTime = addMinutes(startTime, duration);
    const ref = await addDoc(_uc('calEvents'), {
      title: task.title, taskId, date, startTime, endTime, duration,
      color: getCatColor(task.category), createdAt: serverTimestamp()
    });
    // Anchor the task to this day so it stops showing as "anytime/unscheduled".
    await updateTask(taskId, { calEventId: ref.id, dueDate: date, someday: false });
    showToast(`Scheduled at ${_dashFmtTime(startTime)}`, 'success');
  } catch (e) { console.error('scheduleTaskAt', e); showToast('Could not schedule', 'error'); }
}

async function moveCalEventTo(eventId, date, startTime) {
  const { updateDoc } = window.CDX_FB;
  const ev = (CAL_EVENTS || []).find(e => e.id === eventId);
  if (!ev) return;
  try {
    const dur = ev.duration || 30;
    await updateDoc(_ud('calEvents', eventId), {
      date, startTime, endTime: addMinutes(startTime, dur), allDay: false
    });
    if (ev.taskId) await updateTask(ev.taskId, { dueDate: date });
  } catch (e) { console.error('moveCalEventTo', e); showToast('Could not move event', 'error'); }
}

/* ── Calendar helpers ─────────────────────────────────── */
function getCatColor(cat) {
  return cat && CATEGORIES[cat] ? CATEGORIES[cat].color : '#e4e4e4';
}

/* ── Calendar render dispatch ─────────────────────────── */
function renderCalendar() {
  if (_calView === 'day')   renderDayView(_calDate);
  if (_calView === 'week')  renderWeekView(_calDate);
  if (_calView === 'month') renderMonthView(_calDate);
  updateCalLabel();
  // Events + milestones also feed the minimalist dashboard's today spine.
  if (_mainPanel === 'default') window.renderDashboardBoard && window.renderDashboardBoard();
}

function updateCalLabel() {
  const el = document.getElementById('cal-date-label');
  if (!el) return;
  const d = _calDate;
  if (_calView === 'day') {
    el.textContent = d.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
  } else if (_calView === 'week') {
    const ws = weekStart(d);
    const we = new Date(ws); we.setDate(we.getDate() + 6);
    el.textContent = `${ws.toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – ${we.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}`;
  } else {
    el.textContent = d.toLocaleDateString('en-GB', { month:'long', year:'numeric' });
  }
}

function weekStart(d) {
  const ws = new Date(d);
  const dow = ws.getDay();
  ws.setDate(ws.getDate() + (dow === 0 ? -6 : 1 - dow));
  ws.setHours(0,0,0,0);
  return ws;
}

/* ── Day view ─────────────────────────────────────────── */
function renderDayView(date) {
  const calPanel  = document.getElementById('cal-day-view');
  const container = document.getElementById('cal-hours-container');
  if (!container) return;
  document.getElementById('cal-week-view')?.remove();
  document.getElementById('cal-month-view')?.remove();
  calPanel.style.display = '';

  const dateStr   = localDateStr(date);
  const dayEvents = CAL_EVENTS.filter(ev => ev.date === dateStr && !ev.allDay);
  const allDayEvs = CAL_EVENTS.filter(ev => ev.date === dateStr && ev.allDay);
  const dow = date.getDay(); // 0=Sun, 6=Sat
  const isWeekend = (dow === 0 || dow === 6);
  calPanel.style.borderTop = isWeekend ? '2px solid rgba(255,255,255,0.12)' : '';

  // Render all-day strip
  const alldayRow = document.getElementById('cal-allday-row');
  const msDay = _calMilestones(dateStr);
  if (alldayRow) alldayRow.style.display = '';
  if (alldayRow) alldayRow.innerHTML = msDay + (allDayEvs.length
    ? allDayEvs.map(ev => `<span class="cal-allday-chip" data-event-id="${escAttr(ev.id)}">${escHtml(ev.title)}</span>`).join('')
    : (msDay ? '' : `<span style="font-size:10px;color:var(--muted);font-family:var(--font-mono)">All-day</span>`));
  if (alldayRow) _wireCalMilestones(alldayRow);

  // Clear old event chips
  container.querySelectorAll('.cal-event').forEach(e => e.remove());

  // Build hour rows if not yet present
  if (!container.querySelector('.cal-hour-row')) {
    for (let h = 5; h <= 23; h++) {
      const label = h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h-12}pm`;
      const row = document.createElement('div');
      row.className = 'cal-hour-row';
      row.dataset.hour = h;
      row.innerHTML = `<div class="cal-hour-label">${label}</div><div class="cal-hour-slot"></div>`;
      container.appendChild(row);
    }
  }

  dayEvents.forEach(ev => {
    const startH = ev.startTime ? parseInt(ev.startTime.split(':')[0]) : (ev.startHour || 9);
    const startM = ev.startTime ? parseInt(ev.startTime.split(':')[1] || '0') : 0;
    const durationMins = ev.duration || 60;
    const endTotalMins = startH * 60 + startM + durationMins;
    const endH = Math.floor(endTotalMins / 60);
    const endM = endTotalMins % 60;
    const endTimeStr = `${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`;

    const slot = container.querySelector(`[data-hour="${startH}"] .cal-hour-slot`);
    if (!slot) return;
    const chip = document.createElement('div');
    chip.className = 'cal-event';
    chip.dataset.eventId = ev.id;
    const color = getCatColor(TASKS.find(t => t.id === ev.taskId)?.category);
    // top = startM px (1 minute = 1px), height = durationMins px
    const topPx = startM;
    const heightPx = Math.max(durationMins, 20);
    chip.style.cssText = `border-left-color:${color};background:${color}18;top:${topPx}px;height:${heightPx}px;`;
    const startTimeStr = fmtTimeSched(ev.startTime || `${String(startH).padStart(2,'0')}:00`);
    chip.innerHTML = `
      <span class="cal-event-title">${escHtml(ev.title)} <span class="cal-event-time" style="display:inline;margin-top:0">${startTimeStr}–${fmtTimeSched(endTimeStr)}</span></span>`;
    chip.addEventListener('click', e => {
      e.stopPropagation();
      showEventModal(ev, e.clientX, e.clientY);
    });
    slot.appendChild(chip);
  });

  // Now-line position — delegate to updateCalNowLine so timezone is consistent
  updateCalNowLine();
}

/* ── Week view ─────────────────────────────────────────── */
function renderWeekView(date) {
  const calPanel = document.getElementById('cal-day-view');
  calPanel.style.display = 'none';
  document.getElementById('cal-allday-row').style.display = 'none';
  document.getElementById('cal-month-view')?.remove();

  let weekView = document.getElementById('cal-week-view');
  if (!weekView) {
    weekView = document.createElement('div');
    weekView.id = 'cal-week-view';
    weekView.style.cssText = 'flex:1;overflow-y:auto;display:flex;flex-direction:column';
    calPanel.parentNode.insertBefore(weekView, calPanel.nextSibling);
  }

  const ws    = weekStart(date);
  const today = localDateStr(new Date());
  const DAYS  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  let html = `<div class="week-header-row"><div class="week-time-label" style="border-bottom:none"></div>`;
  for (let i = 0; i < 7; i++) {
    const d  = new Date(ws); d.setDate(d.getDate() + i);
    const ds = localDateStr(d);
    const isToday = ds === today;
    const isWeekend = (i === 5 || i === 6); // Sat=5, Sun=6
    const hol = HOLIDAYS[ds];
    html += `<div class="week-day-header${isToday ? ' today' : ''}${isWeekend ? ' weekend' : ''}" data-date="${ds}" style="font-family:var(--font-mono);font-size:10px;letter-spacing:0.08em;text-transform:uppercase;${isToday ? 'color:rgba(57,255,20,0.9);text-shadow:0 0 8px rgba(57,255,20,0.4);border-bottom:2px solid rgba(57,255,20,0.45)' : ''}">
      ${DAYS[i]} ${d.getDate()}${hol ? `<br><span style="font-size:7px;color:rgba(255,255,255,0.7);background:rgba(255,255,255,0.12);border-radius:2px;padding:0 2px;display:block">${escHtml(hol.name)}</span>` : ''}
    </div>`;
  }
  html += `</div>`;
  // All-day row
  const weekCols = `grid-template-columns:48px repeat(7,1fr)`;
  html += `<div class="week-allday-row" style="${weekCols}"><div class="week-time-label" style="font-size:10px;color:var(--muted)">all-day</div>`;
  for (let i = 0; i < 7; i++) {
    const d  = new Date(ws); d.setDate(d.getDate() + i);
    const ds = localDateStr(d);
    const adEvs = CAL_EVENTS.filter(ev => ev.date === ds && ev.allDay);
    html += `<div class="week-allday-cell">${_calMilestones(ds)}${adEvs.map(ev => `<span class="week-allday-chip">${escHtml(ev.title)}</span>`).join('')}</div>`;
  }
  html += `</div><div class="week-body">`;

  for (let h = 5; h <= 23; h++) {
    const label = h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h-12}pm`;
    html += `<div class="week-time-label">${label}</div>`;
    for (let i = 0; i < 7; i++) {
      const d   = new Date(ws); d.setDate(d.getDate() + i);
      const ds  = localDateStr(d);
      const isWeekend = (i === 5 || i === 6);
      const hh  = String(h).padStart(2,'0');
      const evs = CAL_EVENTS.filter(ev => ev.date === ds && ev.startTime?.startsWith(hh));
      const chips = evs.map(ev => {
        const color = getCatColor(TASKS.find(t => t.id === ev.taskId)?.category);
        return `<div class="week-event-chip" data-event-id="${escAttr(ev.id)}" style="border-left-color:${color};background:${color}18">
          <span class="chip-title">${escHtml(ev.title)}</span>
          <span class="chip-time">${fmtTimeSched(ev.startTime)}</span>
        </div>`;
      }).join('');
      html += `<div class="week-cell${isWeekend ? ' weekend' : ''}" data-date="${ds}" data-hour="${h}">${chips}</div>`;
    }
  }
  html += `</div>`;
  weekView.innerHTML = html;
  _wireCalMilestones(weekView);

  // Click week-event-chip → show event action modal
  weekView.querySelectorAll('.week-event-chip[data-event-id]').forEach(chip => {
    chip.style.cursor = 'pointer';
    chip.addEventListener('click', e => {
      e.stopPropagation();
      const ev = CAL_EVENTS.find(ev => ev.id === chip.dataset.eventId);
      if (!ev) return;
      showEventModal(ev, e.clientX, e.clientY);
    });
  });

  // Reposition multi-hour chips to span correct duration height
  const weekBodyEl = weekView.querySelector('.week-body');
  const WEEK_CELL_H = 44; // px per hour slot (min-height of .week-cell)
  weekView.querySelectorAll('.week-event-chip[data-event-id]').forEach(chip => {
    const ev = CAL_EVENTS.find(e => e.id === chip.dataset.eventId);
    if (!ev || !weekBodyEl) return;
    const cell = chip.parentElement;
    if (!cell) return;
    const durationMins = ev.duration || 60;
    const startM = ev.startTime ? parseInt(ev.startTime.split(':')[1] || '0') : 0;
    const topPx    = cell.offsetTop  + Math.round(startM / 60 * WEEK_CELL_H);
    const leftPx   = cell.offsetLeft + 2;
    const widthPx  = cell.offsetWidth - 6;
    const heightPx = Math.max(Math.round(durationMins / 60 * WEEK_CELL_H), 18);
    chip.style.position  = 'absolute';
    chip.style.top       = topPx  + 'px';
    chip.style.left      = leftPx + 'px';
    chip.style.width     = widthPx + 'px';
    chip.style.height    = heightPx + 'px';
    chip.style.zIndex    = '3';
    chip.style.margin    = '0';
    chip.style.boxSizing = 'border-box';
    weekBodyEl.appendChild(chip);
  });

  // Click header day → switch to day view
  weekView.querySelectorAll('.week-day-header[data-date]').forEach(el => {
    el.addEventListener('click', () => {
      _calDate = new Date(el.dataset.date + 'T00:00:00');
      _calView = 'day';
      document.querySelectorAll('.view-tab[data-view]').forEach(t => t.classList.remove('active'));
      document.querySelector('.view-tab[data-view="day"]')?.classList.add('active');
      renderCalendar();
    });
  });
}

/* ── Month view ───────────────────────────────────────── */
function renderMonthView(date) {
  const calPanel = document.getElementById('cal-day-view');
  calPanel.style.display = 'none';
  document.getElementById('cal-allday-row').style.display = 'none';
  document.getElementById('cal-week-view')?.remove();

  let monthView = document.getElementById('cal-month-view');
  if (!monthView) {
    monthView = document.createElement('div');
    monthView.id = 'cal-month-view';
    monthView.style.cssText = 'flex:1;overflow-y:auto;display:flex;flex-direction:column';
    calPanel.parentNode.insertBefore(monthView, calPanel.nextSibling);
  }

  const year  = date.getFullYear();
  const month = date.getMonth();
  const today = localDateStr(new Date());
  const DAYS  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  let html = `<div class="month-dow-header">${DAYS.map(d => `<div class="month-dow-label">${d}</div>`).join('')}</div><div class="month-grid">`;

  const firstDow   = new Date(year, month, 1).getDay();
  const startOffset = firstDow === 0 ? 6 : firstDow - 1;
  const lastDay    = new Date(year, month + 1, 0).getDate();
  const prevLast   = new Date(year, month, 0).getDate();

  for (let i = startOffset - 1; i >= 0; i--) {
    html += buildMonthCell(localDateStr(new Date(year, month - 1, prevLast - i)), false);
  }
  for (let day = 1; day <= lastDay; day++) {
    const ds = localDateStr(new Date(year, month, day));
    html += buildMonthCell(ds, true);
  }
  const total = startOffset + lastDay;
  const rem   = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let i = 1; i <= rem; i++) {
    html += buildMonthCell(localDateStr(new Date(year, month + 1, i)), false);
  }

  html += `</div>`;
  monthView.innerHTML = html;

  monthView.querySelectorAll('.month-event-pill[data-event-id]').forEach(pill => {
    pill.addEventListener('click', e => {
      e.stopPropagation();
      const ev = CAL_EVENTS.find(ev => ev.id === pill.dataset.eventId);
      if (!ev) return;
      showEventModal(ev, e.clientX, e.clientY);
    });
  });

  monthView.querySelectorAll('.month-day-cell[data-date]').forEach(cell => {
    cell.addEventListener('click', () => {
      _calDate = new Date(cell.dataset.date + 'T00:00:00');
      _calView = 'day';
      document.querySelectorAll('.view-tab[data-view]').forEach(t => t.classList.remove('active'));
      document.querySelector('.view-tab[data-view="day"]')?.classList.add('active');
      renderCalendar();
    });
  });
  _wireCalMilestones(monthView);
}

// Global milestone layer — the same markers render on every calendar surface,
// pinned to the top of a date, with their own flag design (not task/event chips).
function _calMilestones(dateStr) {
  const evs = (typeof MILESTONE_EVENTS !== 'undefined' ? MILESTONE_EVENTS : [])
    .filter(e => String(e.date || '').slice(0, 10) === dateStr);
  return evs.map(e => {
    const c = (typeof _pcalProjColor === 'function') ? _pcalProjColor(e.projectId) : 'var(--gold)';
    return `<div class="cal-ms" data-ms-id="${escAttr(e.id)}" data-ms-proj="${escAttr(e.projectId || '')}" style="--c:${c}" title="◆ ${escAttr(e.title || 'Milestone')}">
      <span class="cal-ms-ico">⚑</span><span class="cal-ms-t">${escHtml(e.title || 'Milestone')}</span></div>`;
  }).join('');
}
function _wireCalMilestones(scopeEl) {
  scopeEl.querySelectorAll('.cal-ms[data-ms-id]').forEach(el => el.addEventListener('click', e => {
    e.stopPropagation();
    if (typeof openMsEventModal === 'function') openMsEventModal(el.dataset.msProj || null, el.dataset.msId);
  }));
}

function buildMonthCell(dateStr, isCurrentMonth) {
  const today  = localDateStr(new Date());
  const day    = parseInt(dateStr.split('-')[2]);
  const hol    = HOLIDAYS[dateStr];
  const evs    = CAL_EVENTS.filter(ev => ev.date === dateStr);
  const cellDate = new Date(dateStr + 'T00:00:00');
  const dow = cellDate.getDay(); // 0=Sun, 6=Sat
  const isWeekend = (dow === 0 || dow === 6);

  const classes = ['month-day-cell',
    !isCurrentMonth ? 'other-month' : '',
    dateStr === today ? 'today' : '',
    hol ? 'holiday' : '',
    isWeekend ? 'weekend' : '',
    dow === 6 ? 'saturday' : ''
  ].filter(Boolean).join(' ');

  const timedEvs  = evs.filter(ev => !ev.allDay);
  const allDayEvs = evs.filter(ev => ev.allDay);
  const doneTasks = TASKS.filter(t => t.done && t.dueDate === dateStr);
  const catCounts = {};
  doneTasks.forEach(t => { const c = t.category || 'personal'; catCounts[c] = (catCounts[c]||0) + 1; });
  const maxCount  = Math.max(1, ...Object.values(catCounts));
  const sparkBars = Object.entries(catCounts).map(([cat, cnt]) => {
    const h = Math.round((cnt / maxCount) * 12) + 2;
    return `<div class="month-spark-bar" style="height:${h}px;background:${getCatColor(cat)}"></div>`;
  }).join('');
  const spark = sparkBars ? `<div class="month-spark">${sparkBars}</div>` : '';

  const holBadge = hol ? `<span class="month-holiday-name">${escHtml(hol.name)}</span>` : '';
  const adBadges = allDayEvs.slice(0,1).map(ev =>
    `<span style="font-family:var(--font-mono);font-size:7px;color:#fff;background:var(--neon);border-radius:2px;padding:0 3px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:2px">${escHtml(ev.title)}</span>`
  ).join('');
  const pills = timedEvs.slice(0,2).map(ev => {
    const color = getCatColor(TASKS.find(t => t.id === ev.taskId)?.category);
    return `<span class="month-event-pill" data-event-id="${escAttr(ev.id)}" style="background:${color}22;color:${color};cursor:pointer">${escHtml(ev.title)}</span>`;
  }).join('');
  const more = timedEvs.length > 2 ? `<span style="font-size:10px;color:var(--muted);font-family:var(--font-mono)">+${timedEvs.length-2} more</span>` : '';

  const msBanner = _calMilestones(dateStr);
  return `<div class="${classes}" data-date="${dateStr}">
    ${msBanner}
    <span class="month-day-num">${day}</span>
    ${holBadge}${adBadges}${spark}${pills}${more}
  </div>`;
}

/* ── Event Action Modal ───────────────────────────────── */
let _eamEvent = null;

function showEventModal(ev, clientX, clientY) {
  _eamEvent = ev;
  const modal = document.getElementById('event-action-modal');
  if (!modal) return;
  // Show "Delete event & task" only when this event is actually linked to a task
  const hasTask = !!(ev.taskId ? TASKS.find(t => t.id === ev.taskId) : TASKS.find(t => t.calEventId === ev.id));
  const delTaskBtn = document.getElementById('eam-delete-task');
  if (delTaskBtn) delTaskBtn.style.display = hasTask ? '' : 'none';
  document.getElementById('eam-title').textContent = ev.title;
  document.getElementById('eam-start').value = ev.startTime || '';
  document.getElementById('eam-dur').value   = ev.duration  || 60;
  modal.classList.add('open');
  // Position near click, keep within viewport
  const mW = 268, mH = 170;
  const vW = window.innerWidth, vH = window.innerHeight;
  let x = clientX + 14, y = clientY - 14;
  if (x + mW > vW - 8) x = clientX - mW - 14;
  if (y + mH > vH - 8) y = vH - mH - 8;
  if (y < 8) y = 8;
  modal.style.left = x + 'px';
  modal.style.top  = y + 'px';
}

function hideEventModal() {
  document.getElementById('event-action-modal')?.classList.remove('open');
  _eamEvent = null;
}

function initEventModal() {
  const { updateDoc, deleteDoc } = window.CDX_FB || {};

  document.getElementById('eam-close')?.addEventListener('click', hideEventModal);

  document.getElementById('eam-save')?.addEventListener('click', async () => {
    if (!_eamEvent || !updateDoc) return;
    const startTime = document.getElementById('eam-start').value;
    const duration  = parseInt(document.getElementById('eam-dur').value) || 60;
    if (!startTime) return;
    const [h, m] = startTime.split(':').map(Number);
    const endMins = h * 60 + m + duration;
    const endTime = `${String(Math.floor(endMins/60) % 24).padStart(2,'0')}:${String(endMins%60).padStart(2,'0')}`;
    try {
      await updateDoc(_ud('calEvents', _eamEvent.id), { startTime, endTime, duration });
      hideEventModal();
      showToast('Event updated', 'success');
    } catch(e) { showToast('Could not update event', 'error'); }
  });

  document.getElementById('eam-delete')?.addEventListener('click', async () => {
    if (!_eamEvent || !deleteDoc) return;
    if (!await cdxConfirm(`Delete "${_eamEvent.title}"?`)) return;
    try {
      await deleteDoc(_ud('calEvents', _eamEvent.id));
      // Clear calEventId on linked task
      const linkedTask = _eamEvent.taskId
        ? TASKS.find(t => t.id === _eamEvent.taskId)
        : TASKS.find(t => t.calEventId === _eamEvent.id);
      if (linkedTask) await updateTask(linkedTask.id, { calEventId: null });
      hideEventModal();
      showToast('Event deleted', 'success');
    } catch(e) { showToast('Could not delete event', 'error'); }
  });

  // Delete the event AND its linked task (deleteTask cascades the calEvent + subtask events)
  document.getElementById('eam-delete-task')?.addEventListener('click', async () => {
    if (!_eamEvent) return;
    const linkedTask = _eamEvent.taskId
      ? TASKS.find(t => t.id === _eamEvent.taskId)
      : TASKS.find(t => t.calEventId === _eamEvent.id);
    if (!linkedTask) { document.getElementById('eam-delete')?.click(); return; }
    if (!await cdxConfirm(`Delete the event AND the task "${linkedTask.title}"? This removes the task entirely.`)) return;
    try {
      await deleteTask(linkedTask.id);   // cascades: task + its calEvent + subtask events + milestone refs
      hideEventModal();
    } catch(e) { showToast('Could not delete event & task', 'error'); }
  });

  document.getElementById('eam-play')?.addEventListener('click', () => {
    if (!_eamEvent) return;
    const ev = _eamEvent;
    hideEventModal();
    showMainPanel('focus');
    const titleEl = document.getElementById('pomo-ev-title');
    if (titleEl) titleEl.textContent = ev.title;
    window.setPomoEvent?.(ev);
  });

  // Close on outside click
  document.addEventListener('click', e => {
    const modal = document.getElementById('event-action-modal');
    if (!modal || !modal.classList.contains('open')) return;
    if (!modal.contains(e.target)) hideEventModal();
  }, true);
}

/* ── Calendar nav ─────────────────────────────────────── */
function initCalNav() {
  document.getElementById('cal-prev')?.addEventListener('click', () => {
    if (_calView === 'day')   _calDate.setDate(_calDate.getDate() - 1);
    else if (_calView === 'week')  _calDate.setDate(_calDate.getDate() - 7);
    else _calDate.setMonth(_calDate.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById('cal-next')?.addEventListener('click', () => {
    if (_calView === 'day')   _calDate.setDate(_calDate.getDate() + 1);
    else if (_calView === 'week')  _calDate.setDate(_calDate.getDate() + 7);
    else _calDate.setMonth(_calDate.getMonth() + 1);
    renderCalendar();
  });
  document.getElementById('cal-today')?.addEventListener('click', () => {
    _calDate = new Date(); renderCalendar();
  });
  document.getElementById('cal-add-milestone')?.addEventListener('click', () => {
    if (typeof _planMilestonePicker === 'function') _planMilestonePicker(localDateStr(_calDate || new Date()));
  });
}

/* ── Drag-to-timebox ──────────────────────────────────────
   Implementation intentions: dropping a task on a time slot converts
   "I'll do X" into "I'll do X at 2:15pm". 15-min snap, ghost preview,
   direct schedule (no modal) for plain tasks, undo toast. */

let _dragGhostEl = null;

function _dragSnapQuarter(slot, clientY) {
  const rect = slot.getBoundingClientRect();
  const frac = Math.min(0.999, Math.max(0, (clientY - rect.top) / rect.height));
  const mins = Math.floor(frac * 4) * 15;
  return { mins, rect };
}

function _showDragGhost(slot, hour, mins, rect) {
  if (!_dragGhostEl) {
    _dragGhostEl = document.createElement('div');
    _dragGhostEl.className = 'cal-drop-ghost';
    document.body.appendChild(_dragGhostEl);
  }
  const task = TASKS.find(t => t.id === _dragTaskId);
  const start = `${String(hour).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
  const title = _dragSubId
    ? (task?.subtasks?.find(s => s.id === _dragSubId)?.title || task?.title || '')
    : (task?.title || '');
  _dragGhostEl.textContent = `${fmtTimeSched(start)} — ${title}`;
  _dragGhostEl.style.left   = rect.left + 'px';
  _dragGhostEl.style.width  = rect.width + 'px';
  _dragGhostEl.style.top    = (rect.top + (mins / 60) * rect.height) + 'px';
  _dragGhostEl.style.height = Math.max(14, rect.height / 2) + 'px';
}

function _clearDragGhost() {
  _dragGhostEl?.remove();
  _dragGhostEl = null;
}

/* Direct schedule (drag-drop path) — mirrors confirmSchedule for a single task/subtask */
async function scheduleTaskDirect(date, startTime, taskId, subId, duration = 30) {
  const { addDoc, serverTimestamp, setDoc, doc } = window.CDX_FB;
  const task = TASKS.find(t => t.id === taskId);
  if (!task) return;
  const endTime = addMinutes(startTime, duration);
  const color = getCatColor(task.category);
  const sub = subId ? task.subtasks?.find(s => s.id === subId) : null;
  if (subId && !sub) return;
  const title = sub ? sub.title : task.title;

  // Snapshot the event being replaced so undo can restore it
  const prevEvId = sub ? sub.calEventId : task.calEventId;
  const prevEv = prevEvId ? CAL_EVENTS.find(ev => ev.id === prevEvId) : null;
  const prevEvData = prevEv ? { ...prevEv } : null;

  await _safeDeleteCalEvent(prevEvId);
  const payload = sub
    ? { title, taskId, subId, date, startTime, endTime, duration, color, createdAt: serverTimestamp() }
    : { title, taskId, date, startTime, endTime, duration, color, createdAt: serverTimestamp() };
  const ref = await addDoc(_uc('calEvents'), payload);
  if (sub) {
    await updateTask(taskId, { subtasks: task.subtasks.map(s => s.id === subId ? { ...s, calEventId: ref.id } : s) });
  } else {
    await updateTask(taskId, { calEventId: ref.id });
  }

  showUndoToast(`${fmtTimeSched(startTime)} claimed. future you says thanks.`, async () => {
    await _safeDeleteCalEvent(ref.id);
    let restoredId = null;
    if (prevEvData) {
      const { id, ...data } = prevEvData;
      await setDoc(_ud('calEvents', id), data);
      restoredId = id;
    }
    const fresh = TASKS.find(t => t.id === taskId);
    if (sub) {
      await updateTask(taskId, { subtasks: (fresh?.subtasks || []).map(s => s.id === subId ? { ...s, calEventId: restoredId } : s) });
    } else {
      await updateTask(taskId, { calEventId: restoredId });
    }
  });
}

function initCalDropZones() {
  // Day view
  const dayContainer = document.getElementById('cal-hours-container');
  if (dayContainer) {
    dayContainer.addEventListener('dragover', e => {
      const slot = e.target.closest('.cal-hour-slot');
      if (!slot || !_dragTaskId) return;
      e.preventDefault();
      const h = parseInt(slot.closest('.cal-hour-row')?.dataset.hour ?? '9');
      const { mins, rect } = _dragSnapQuarter(slot, e.clientY);
      _showDragGhost(slot, h, mins, rect);
    });
    dayContainer.addEventListener('dragleave', e => {
      if (!dayContainer.contains(e.relatedTarget)) _clearDragGhost();
    });
    dayContainer.addEventListener('drop', e => {
      const slot = e.target.closest('.cal-hour-slot');
      if (!slot || !_dragTaskId) return;
      e.preventDefault();
      _clearDragGhost();
      const h = parseInt(slot.closest('.cal-hour-row')?.dataset.hour ?? '9');
      const { mins } = _dragSnapQuarter(slot, e.clientY);
      const start = `${String(h).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
      const task = TASKS.find(t => t.id === _dragTaskId);
      // Tasks with subtasks keep the modal (it offers scheduling them together)
      if (!_dragSubId && task?.subtasks?.length) {
        openScheduleModal(localDateStr(_calDate), start, _dragTaskId, _dragSubId);
      } else {
        scheduleTaskDirect(localDateStr(_calDate), start, _dragTaskId, _dragSubId);
      }
    });
    document.addEventListener('dragend', _clearDragGhost);
    // Click empty slot to create new event (or open pomodoro for spanning multi-hour events)
    // Half-hour precision: top half of slot = :00, bottom half = :30
    dayContainer.addEventListener('click', e => {
      if (_dragTaskId) return;
      const slot = e.target.closest('.cal-hour-slot');
      if (!slot) return;
      if (e.target.closest('.cal-event')) return; // clicking existing event chip
      const h = parseInt(slot.closest('.cal-hour-row')?.dataset.hour ?? '9');
      const rect = slot.getBoundingClientRect();
      const yFrac = (e.clientY - rect.top) / rect.height;
      const m = yFrac >= 0.5 ? 30 : 0;
      const dateStr = localDateStr(_calDate);
      const hourFrac = h + m / 60;
      // Check if an event is already running at this exact half-hour slot
      const coveringEvent = CAL_EVENTS.find(ev => {
        if (ev.date !== dateStr || !ev.startTime) return false;
        const [sh, sm] = ev.startTime.split(':').map(Number);
        const startFrac = sh + sm / 60;
        const endFrac = startFrac + (ev.duration || 60) / 60;
        // Skip the event's own start (its chip handles its own click)
        if (Math.abs(startFrac - hourFrac) < 0.01) return false;
        return hourFrac > startFrac && hourFrac < endFrac;
      });
      if (coveringEvent) {
        showEventModal(coveringEvent, e.clientX, e.clientY);
      } else {
        openQuickCalModal(dateStr, `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
      }
    });
  }

  // Week view (delegated via document)
  document.addEventListener('dragover', e => {
    const cell = e.target.closest('.week-cell');
    if (!cell || !_dragTaskId) return;
    e.preventDefault();
    document.querySelectorAll('.week-cell.drop-over').forEach(c => c.classList.remove('drop-over'));
    cell.classList.add('drop-over');
  });
  document.addEventListener('dragleave', e => {
    e.target.closest('.week-cell')?.classList.remove('drop-over');
  });
  document.addEventListener('drop', e => {
    const cell = e.target.closest('.week-cell');
    if (!cell || !_dragTaskId) return;
    e.preventDefault();
    cell.classList.remove('drop-over');
    const h = parseInt(cell.dataset.hour ?? '9');
    openScheduleModal(cell.dataset.date, `${String(h).padStart(2,'0')}:00`, _dragTaskId, _dragSubId);
  });
}

/* ── Quick Calendar Event Creation ───────────────────── */
function openQuickCalModal(date, startTime) {
  const titleEl = document.getElementById('qcal-title');
  if (titleEl) { titleEl.value = ''; }
  const dateEl = document.getElementById('qcal-date');
  if (dateEl) dateEl.value = date;
  const timeEl = document.getElementById('qcal-time');
  if (timeEl) timeEl.value = startTime;
  const allDayEl = document.getElementById('qcal-allday');
  if (allDayEl) { allDayEl.checked = false; }
  document.getElementById('qcal-time-wrap').style.display = '';
  document.getElementById('qcal-dur-wrap').style.display  = '';
  const durEl = document.getElementById('qcal-duration');
  if (durEl) durEl.value = 30;
  const sel = document.getElementById('qcal-category');
  if (sel) {
    sel.innerHTML = '<option value="">No category</option>' + Object.entries(CATEGORIES).map(([k,v]) => `<option value="${escAttr(k)}">${escHtml(v.label)}</option>`).join('');
    if (_settings.defaultCategory) sel.value = _settings.defaultCategory;
  }
  document.getElementById('quick-cal-modal')?.classList.add('open');
  setTimeout(() => titleEl?.focus(), 100);
}

async function confirmQuickCalEvent() {
  const title    = document.getElementById('qcal-title')?.value.trim();
  const date     = document.getElementById('qcal-date')?.value;
  const isAllDay = document.getElementById('qcal-allday')?.checked;
  const startTime= isAllDay ? null : document.getElementById('qcal-time')?.value;
  const duration = isAllDay ? null : (parseInt(document.getElementById('qcal-duration')?.value) || 60);
  const category = document.getElementById('qcal-category')?.value || null;
  if (!title || !date) { showToast('Please fill in title and date', 'error'); return; }
  if (!isAllDay && !startTime) { showToast('Please fill in start time', 'error'); return; }
  const { addDoc, serverTimestamp } = window.CDX_FB;
  if (!window.CDX_USER?.uid) return;
  try {
    const taskRef = await addDoc(_uc('tasks'), {
      title, category, done: false, dueDate: date, createdAt: serverTimestamp()
    });
    if (isAllDay) {
      await addDoc(_uc('calEvents'), {
        title, date, allDay: true, taskId: taskRef.id,
        color: getCatColor(category), createdAt: serverTimestamp()
      });
    } else {
      const endTime = addMinutes(startTime, duration);
      await addDoc(_uc('calEvents'), {
        title, date, startTime, endTime, duration, taskId: taskRef.id,
        color: getCatColor(category), createdAt: serverTimestamp()
      });
    }
    document.getElementById('quick-cal-modal')?.classList.remove('open');
    showToast(`Created "${title}"`, 'success');
  } catch(e) { showToast('Error creating event', 'error'); console.error(e); }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('qcal-confirm-btn')?.addEventListener('click', confirmQuickCalEvent);
  document.getElementById('qcal-title')?.addEventListener('keydown', e => { if (e.key === 'Enter') confirmQuickCalEvent(); });
  // Toggle time/duration fields visibility based on all-day checkbox
  document.getElementById('qcal-allday')?.addEventListener('change', e => {
    const hide = e.target.checked;
    document.getElementById('qcal-time-wrap').style.display = hide ? 'none' : '';
    document.getElementById('qcal-dur-wrap').style.display  = hide ? 'none' : '';
  });
});

/* ── Add-task form ────────────────────────────────────── */
function initAddTaskForm() {
  const input   = document.getElementById('task-add-input');
  const confirm = document.getElementById('task-add-confirm');

  // ── Recurrence state ──
  let _taskRecur = '';
  let _taskRecurDays = new Set();

  function recurLabel(val) {
    if (!val) return 'One-time';
    if (val === 'daily') return 'Daily';
    if (val === 'weekdays') return 'Weekdays';
    if (val === 'weekly') return 'Weekly';
    if (val === 'monthly') return 'Monthly';
    if (val === 'yearly') return 'Yearly';
    if (val.startsWith('custom:')) {
      const days = val.replace('custom:', '');
      return days || 'Custom';
    }
    return val;
  }

  function setRecur(val, skipClose) {
    _taskRecur = val;
    document.getElementById('task-recur-label').textContent = recurLabel(val);
    const recurBtn = document.getElementById('task-recur-btn');
    recurBtn.classList.toggle('active', !!val);
    document.querySelectorAll('#task-recur-popover .task-recur-option').forEach(o => {
      const match = o.dataset.recur === val || (val.startsWith('custom:') && o.dataset.recur === 'custom');
      o.querySelector('.recur-check').textContent = match ? '✓' : '';
      o.classList.toggle('selected', match);
    });
    if (!skipClose) {
      document.getElementById('task-recur-popover').classList.remove('open');
      recurBtn.classList.remove('active');
      if (!!val) recurBtn.classList.add('active');
    }
  }

  function resetRecur() {
    _taskRecur = '';
    _taskRecurDays.clear();
    document.getElementById('task-recur-label').textContent = 'One-time';
    document.getElementById('task-recur-btn').classList.remove('active');
    document.getElementById('task-recur-custom-days').style.display = 'none';
    document.querySelectorAll('#task-recur-popover .task-recur-day-btn').forEach(b => b.classList.remove('on'));
    setRecur('');
  }

  const recurBtn = document.getElementById('task-recur-btn');
  const recurPopover = document.getElementById('task-recur-popover');

  recurBtn.addEventListener('click', e => {
    e.stopPropagation();
    recurPopover.classList.toggle('open');
  });

  document.addEventListener('click', e => {
    if (!recurPopover.contains(e.target) && e.target !== recurBtn) {
      recurPopover.classList.remove('open');
    }
  });

  recurPopover.querySelectorAll('.task-recur-option').forEach(opt => {
    opt.addEventListener('click', e => {
      e.stopPropagation();
      const val = opt.dataset.recur;
      if (val === 'custom') {
        document.getElementById('task-recur-custom-days').style.display = 'flex';
        setRecur('custom:', true);
        return;
      }
      document.getElementById('task-recur-custom-days').style.display = 'none';
      _taskRecurDays.clear();
      document.querySelectorAll('#task-recur-popover .task-recur-day-btn').forEach(b => b.classList.remove('on'));
      setRecur(val);
    });
  });

  recurPopover.querySelectorAll('.task-recur-day-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      btn.classList.toggle('on');
      if (btn.classList.contains('on')) _taskRecurDays.add(btn.dataset.day);
      else _taskRecurDays.delete(btn.dataset.day);
      const days = [..._taskRecurDays].join(',');
      _taskRecur = days ? `custom:${days}` : 'custom:';
      document.getElementById('task-recur-label').textContent = days || 'Custom';
      recurBtn.classList.toggle('active', !!days);
    });
  });

  // ── @mention people state ──
  let _taskPeople = []; // array of person IDs
  let _mentionQuery = null; // null = not in mention mode; string = current query
  const mentionDropdown = document.getElementById('task-mention-dropdown');
  const peoplePillsRow  = document.getElementById('task-people-pills');

  function renderPeoplePills() {
    if (!_taskPeople.length) { peoplePillsRow.style.display = 'none'; return; }
    peoplePillsRow.style.display = 'flex';
    peoplePillsRow.innerHTML = _taskPeople.map(id => {
      const p = PEOPLE.find(p => p.id === id);
      if (!p) return '';
      return `<span class="task-people-pill" style="background:${p.color}18;border-color:${p.color}44;color:${p.color}">
        <span class="mention-avatar" style="background:${p.color};width:14px;height:14px;font-size:7px">${escHtml(p.initials)}</span>
        @${escHtml(p.name)}
        <button class="pill-remove" data-remove-person="${escAttr(p.id)}" tabindex="-1">✕</button>
      </span>`;
    }).join('');
    peoplePillsRow.querySelectorAll('[data-remove-person]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        _taskPeople = _taskPeople.filter(id => id !== btn.dataset.removePerson);
        renderPeoplePills();
      });
    });
  }

  function showMentionDropdown(query) {
    const matches = PEOPLE.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) && !_taskPeople.includes(p.id)
    );
    if (!matches.length) { hideMentionDropdown(); return; }
    mentionDropdown.style.display = 'block';
    mentionDropdown.innerHTML = matches.map((p, i) => `
      <div class="mention-item${i===0?' selected':''}" data-mention-id="${escAttr(p.id)}">
        <div class="mention-avatar" style="background:${p.color}">${escHtml(p.initials)}</div>
        ${escHtml(p.name)}
      </div>`).join('');
    mentionDropdown.querySelectorAll('.mention-item').forEach(item => {
      item.addEventListener('mousedown', e => {
        e.preventDefault(); // prevent blur
        selectMentionPerson(item.dataset.mentionId);
      });
    });
  }

  function hideMentionDropdown() {
    mentionDropdown.style.display = 'none';
    _mentionQuery = null;
  }

  function selectMentionPerson(personId) {
    const p = PEOPLE.find(p => p.id === personId);
    if (!p) return;
    if (!_taskPeople.includes(personId)) _taskPeople.push(personId);
    // Remove the @query from the input text
    const val = input.value;
    const cursor = input.selectionStart;
    const before = val.slice(0, cursor);
    const atIdx = before.lastIndexOf('@');
    if (atIdx >= 0) {
      input.value = val.slice(0, atIdx) + val.slice(cursor);
      input.setSelectionRange(atIdx, atIdx);
    }
    hideMentionDropdown();
    renderPeoplePills();
    input.focus();
  }

  function resetPeople() {
    _taskPeople = [];
    _mentionQuery = null;
    hideMentionDropdown();
    renderPeoplePills();
  }

  input.addEventListener('input', () => {
    const val = input.value;
    const cursor = input.selectionStart;
    const before = val.slice(0, cursor);
    const atMatch = before.match(/@(\w*)$/);
    if (atMatch) {
      _mentionQuery = atMatch[1];
      showMentionDropdown(_mentionQuery);
    } else {
      hideMentionDropdown();
    }
  });

  input.addEventListener('keydown', e => {
    if (mentionDropdown.style.display === 'none') return;
    const items = mentionDropdown.querySelectorAll('.mention-item');
    const selIdx = [...items].findIndex(i => i.classList.contains('selected'));
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[selIdx]?.classList.remove('selected');
      items[(selIdx + 1) % items.length]?.classList.add('selected');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[selIdx]?.classList.remove('selected');
      items[(selIdx - 1 + items.length) % items.length]?.classList.add('selected');
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      const sel = mentionDropdown.querySelector('.mention-item.selected');
      if (sel) { e.preventDefault(); selectMentionPerson(sel.dataset.mentionId); }
    } else if (e.key === 'Escape') {
      hideMentionDropdown();
    }
  });

  input.addEventListener('blur', () => {
    // Delay to allow mousedown on dropdown items to fire first
    setTimeout(hideMentionDropdown, 150);
  });

  // ── Energy type state ──
  let _taskEnergy = '';
  const energyPicker = document.getElementById('task-energy-picker');
  if (energyPicker) {
    energyPicker.querySelectorAll('.energy-pill').forEach(pill => {
      pill.addEventListener('click', e => {
        e.stopPropagation();
        const val = pill.dataset.energy;
        if (_taskEnergy === val) {
          // deselect
          _taskEnergy = '';
          energyPicker.querySelectorAll('.energy-pill').forEach(p => p.classList.remove('active'));
        } else {
          _taskEnergy = val;
          energyPicker.querySelectorAll('.energy-pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
        }
      });
    });
  }

  // ── Submit ──
  async function submit() {
    const title = input.value.trim();
    if (!title) return;
    const priority = document.getElementById('task-add-priority').value;
    const dueDate  = document.getElementById('task-add-date').value;
    const category = document.getElementById('task-add-category').value;
    const recurrence = _taskRecur && _taskRecur !== 'custom:' ? _taskRecur : '';
    await addTask(title, priority, dueDate, category, recurrence, _taskEnergy, [..._taskPeople]);
    input.value = '';
    document.getElementById('task-add-date').value = '';
    const catSel = document.getElementById('task-add-category');
    if (catSel && _settings.defaultCategory) catSel.value = _settings.defaultCategory;
    // Reset energy
    _taskEnergy = '';
    energyPicker?.querySelectorAll('.energy-pill').forEach(p => p.classList.remove('active'));
    resetRecur();
    resetPeople();
    input.focus();
  }
  confirm.addEventListener('click', submit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') submit();
  });
}

/* ── Settings ─────────────────────────────────────────── */
/* ── Category Management ──────────────────────────────── */
function saveCategoriesLocal() {
  localStorage.setItem('cdx_categories', JSON.stringify(CATEGORIES));
}

async function saveCategories() {
  saveCategoriesLocal();
  const user = window.CDX_USER;
  if (!user || !window.CDX_FB || !window.CDX_DB) return;
  const { doc, setDoc } = window.CDX_FB;
  try {
    await setDoc(doc(window.CDX_DB, 'users', user.uid, 'config', 'categories'),
      { categories: CATEGORIES }, { merge: false });
  } catch(e) { console.warn('Categories Firestore save failed:', e); }
}

function addCategory(label, color) {
  const key = label.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,20) || `cat${Date.now()}`;
  if (CATEGORIES[key]) return; // already exists
  CATEGORIES[key] = { label, color };
  saveCategories();
  renderSettingsCatList();
  renderSettingsCats();
  renderTasks();
  rebuildCategorySelects();
}

async function deleteCategory(key) {
  delete CATEGORIES[key];
  saveCategories();
  // Clear dangling category refs on tasks and milestone projects
  await Promise.all([
    ...TASKS.filter(t => t.category === key).map(t => updateTask(t.id, { category: '' })),
    ...MILESTONE_PROJECTS.filter(p => p.category === key).map(p => updateMilestoneProject(p.id, { category: '' })),
  ]);
  renderSettingsCatList();
  renderSettingsCats();
  renderTasks();
  rebuildCategorySelects();
}

function rebuildCategorySelects() {
  const def = _settings.defaultCategory;
  // Rebuild task-add-category select
  const taskCatSel = document.getElementById('task-add-category');
  if (taskCatSel) {
    const cur = taskCatSel.value || def;
    taskCatSel.innerHTML = Object.entries(CATEGORIES).map(([k,v]) =>
      `<option value="${k}"${k===cur?' selected':''}>${v.label}</option>`
    ).join('');
  }
  // Rebuild ms-proj-category select
  const projCatSel = document.getElementById('ms-proj-category');
  if (projCatSel) {
    const cur = projCatSel.value;
    projCatSel.innerHTML = '<option value="">— None —</option>' +
      Object.entries(CATEGORIES).map(([k,v]) =>
        `<option value="${k}"${k===cur?' selected':''}>${v.label}</option>`
      ).join('');
  }
  // Also refresh the settings default-category select if it's open
  renderSettingsDefaultCat();
}

function renderSettingsCatList() {
  const list = document.getElementById('settings-cat-list');
  if (!list) return;
  list.innerHTML = Object.entries(CATEGORIES).map(([key, cat]) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
      <div style="width:14px;height:14px;border-radius:50%;background:${cat.color};flex-shrink:0"></div>
      <span style="flex:1;font-family:var(--font-body);font-size:13px;color:var(--cream)">${escHtml(cat.label)}</span>
      <span style="font-family:var(--font-mono);font-size:10px;color:var(--muted);background:var(--elevated);border:1px solid var(--border);border-radius:4px;padding:1px 5px">${escHtml(key)}</span>
      <button class="task-action-btn danger" data-del-cat="${escAttr(key)}" title="Delete">✕</button>
    </div>`).join('');
  list.querySelectorAll('[data-del-cat]').forEach(btn => {
    btn.addEventListener('click', () => deleteCategory(btn.dataset.delCat));
  });
}

function initNewCatColorPicker() {
  const picker = document.getElementById('new-cat-color-picker');
  if (!picker) return;
  picker.innerHTML = CAT_COLOR_PALETTE.map(c => `
    <div style="width:18px;height:18px;border-radius:50%;background:${c};cursor:pointer;border:2px solid ${c===_newCatColor?'var(--cream)':'transparent'};transition:transform 0.15s;box-sizing:border-box"
         data-newcatcolor="${c}"></div>`).join('');
  picker.querySelectorAll('[data-newcatcolor]').forEach(sw => {
    sw.addEventListener('click', () => {
      _newCatColor = sw.dataset.newcatcolor;
      initNewCatColorPicker();
    });
  });
}

function renderSettingsCats() {
  const grid = document.getElementById('settings-cat-filters');
  if (!grid) return;
  grid.innerHTML = Object.entries(CATEGORIES).map(([key, cat]) => {
    const active = _settings.visibleCategories.includes(key);
    return `<div class="settings-cat-pill${active ? ' active' : ''}" data-cat="${key}"
      style="border-color:${cat.color}44;${active ? `background:${cat.color}18` : ''}">
      <div class="cat-dot" style="background:${cat.color}"></div>${cat.label}
    </div>`;
  }).join('');
  grid.querySelectorAll('.settings-cat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const cat = pill.dataset.cat;
      const idx = _settings.visibleCategories.indexOf(cat);
      if (idx >= 0) _settings.visibleCategories.splice(idx, 1);
      else _settings.visibleCategories.push(cat);
      localStorage.setItem('cdx_v2_settings', JSON.stringify(_settings));
      renderSettingsCats();
      renderTasks();
    });
  });
}

function renderSettingsDefaultCat() {
  const sel = document.getElementById('settings-default-category');
  if (!sel) return;
  const cur = _settings.defaultCategory;
  sel.innerHTML = Object.entries(CATEGORIES).map(([k,v]) =>
    `<option value="${k}"${k===cur?' selected':''}>${v.label}</option>`
  ).join('');
}

function renderSettingsHolidays() {
  const list = document.getElementById('settings-holidays-list');
  if (!list) return;
  // Filter out sentinel docs, sort: public first then personal, each by date (Jan→Dec)
  const entries = Object.values(HOLIDAYS)
    .filter(h => h.name && h.date)
    .sort((a, b) => {
      const aPublic = a.type === 'public' ? 0 : 1;
      const bPublic = b.type === 'public' ? 0 : 1;
      if (aPublic !== bPublic) return aPublic - bPublic;
      return a.date.localeCompare(b.date);
    });
  if (!entries.length) {
    list.innerHTML = `<div style="color:var(--muted);font-size:12px;padding:8px 0">Loading holidays…</div>`;
    return;
  }
  list.innerHTML = entries.map(h => `
    <div class="settings-holiday-row">
      <span style="flex:1">${escHtml(h.name)}</span>
      <span class="hol-type${h.type === 'public' ? ' public' : ''}">${h.type || 'personal'}</span>
      <span style="font-family:var(--font-mono);font-size:10px;color:var(--muted);white-space:nowrap">${fmtDate(h.date)}</span>
      ${h.type !== 'public' ? `<button class="task-action-btn danger" data-delhol="${escAttr(h.docId)}" title="Delete">✕</button>` : '<span style="width:22px"></span>'}
    </div>`).join('');
  list.querySelectorAll('[data-delhol]').forEach(btn => {
    btn.addEventListener('click', () => deleteHoliday(btn.dataset.delhol));
  });
}

/* ── People Management ────────────────────────────────── */
function renderSettingsPeople() {
  const list = document.getElementById('settings-people-list');
  if (!list) return;
  if (!PEOPLE.length) {
    list.innerHTML = `<div style="font-size:12px;color:var(--muted);padding:8px 0">No people added yet.</div>`;
    return;
  }
  list.innerHTML = PEOPLE.map(p => `
    <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
      <div style="width:26px;height:26px;border-radius:50%;background:${p.color};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:#0d0c0a;flex-shrink:0">${escHtml(p.initials)}</div>
      <span style="flex:1;font-family:var(--font-body);font-size:13px;color:var(--cream)">${escHtml(p.name)}</span>
      <button class="task-action-btn danger" data-del-person="${escAttr(p.id)}" title="Remove">✕</button>
    </div>`).join('');
  list.querySelectorAll('[data-del-person]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pid = btn.dataset.delPerson;
      PEOPLE = PEOPLE.filter(p => p.id !== pid);
      savePeople();
      renderSettingsPeople();
      // Clear dangling person id from any tasks that referenced them
      await Promise.all(TASKS.filter(t => Array.isArray(t.people) && t.people.includes(pid))
        .map(t => updateTask(t.id, { people: t.people.filter(id => id !== pid) })));
    });
  });
}

function initPeopleSettings() {
  document.getElementById('people-add-btn')?.addEventListener('click', addPersonFromInput);
  document.getElementById('people-name-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') addPersonFromInput();
  });
}

function addPersonFromInput() {
  const input = document.getElementById('people-name-input');
  const name = input?.value.trim();
  if (!name) return;
  const initials = name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const color = PEOPLE_COLORS[PEOPLE.length % PEOPLE_COLORS.length];
  PEOPLE.push({ id: crypto.randomUUID(), name, initials, color });
  savePeople();
  renderSettingsPeople();
  if (input) { input.value = ''; input.focus(); }
}

function initSettingsNav() {
  document.querySelectorAll('.settings-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.settings-nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.settings-content-panel').forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      const pane = document.getElementById('st-pane-' + item.dataset.settingsTab);
      if (pane) pane.classList.add('active');
    });
  });
}

function initSettingsPanel() {
  initSettingsNav();
  initPeopleSettings();

  document.getElementById('settings-btn')?.addEventListener('click', () => {
    renderSettingsCats();
    renderSettingsHolidays();
    renderSettingsCatList();
    renderSettingsDefaultCat();
    initNewCatColorPicker();
    hbLoadSettingsPanel();
    renderSettingsPeople();
    // Update UID display
    const uid = window.CDX_USER?.uid;
    const uidEl = document.getElementById('settings-uid-display');
    if (uidEl && uid) uidEl.textContent = uid;
    // Sync theme button label
    const themeBtn = document.getElementById('settings-theme-btn');
    if (themeBtn) themeBtn.textContent = document.documentElement.dataset.theme === 'light' ? '☀ Light mode active' : '◐ Dark mode active';
    document.getElementById('settings-overlay').classList.add('open');
  });
  document.getElementById('settings-default-category')?.addEventListener('change', e => {
    _settings.defaultCategory = e.target.value;
    saveSettings();
    rebuildCategorySelects();
  });
  document.getElementById('holiday-add-btn')?.addEventListener('click', async () => {
    const dateEl = document.getElementById('holiday-date');
    const dateEndEl = document.getElementById('holiday-date-end');
    const nameEl = document.getElementById('holiday-name');
    const startDate = dateEl?.value;
    const endDate = dateEndEl?.value;
    const name = nameEl?.value.trim();
    const type = document.getElementById('holiday-type')?.value;
    if (!startDate || !name) { showToast('Please enter both date and name', 'error'); return; }
    try {
      if (endDate && endDate > startDate) {
        // Date range — create a holiday for each day
        const d = new Date(startDate + 'T00:00');
        const end = new Date(endDate + 'T00:00');
        let count = 0;
        while (d <= end && count < 60) { // cap at 60 days
          const ds = localDateStr(d);
          await addHoliday(ds, name, type);
          d.setDate(d.getDate() + 1);
          count++;
        }
        showToast(`${count} holiday days added`, 'success');
      } else {
        await addHoliday(startDate, name, type);
        showToast('Holiday added', 'success');
      }
      if (dateEl) dateEl.value = '';
      if (dateEndEl) dateEndEl.value = '';
      if (nameEl) nameEl.value = '';
    } catch (err) {
      console.error('addHoliday error:', err);
      showToast('Failed to add holiday', 'error');
    }
  });
  // Initialize manage categories section
  renderSettingsCatList();
  initNewCatColorPicker();
  document.getElementById('new-cat-add-btn')?.addEventListener('click', () => {
    const label = document.getElementById('new-cat-label').value.trim();
    if (label) { addCategory(label, _newCatColor); document.getElementById('new-cat-label').value = ''; }
  });
}

/* ── Cosmodex Orb ──────────────────────────────────────── */
const orb         = document.getElementById('cosmodex-orb');
const orbClose    = document.getElementById('orb-close');
const orbBackdrop = document.getElementById('orb-backdrop');
const orbDisplay  = document.getElementById('orb-time-display');
const orbHeader   = document.getElementById('orb-header');

function openOrb() {
  orb.style.display = 'block';
  orb.classList.add('expanded');
  orbClose.classList.add('visible');
  orbBackdrop.classList.add('visible');
  orbDisplay.classList.add('visible');
  orbHeader.classList.add('visible');
  // Continuously redraw canvas during the CSS transition (~480ms) to avoid blurry scaling
  const start = Date.now();
  (function animRedraw() {
    drawCosmodex();
    if (Date.now() - start < 550) requestAnimationFrame(animRedraw);
  })();
}

function closeOrb() {
  orb.classList.remove('expanded');
  orbClose.classList.remove('visible');
  orbBackdrop.classList.remove('visible');
  orbDisplay.classList.remove('visible');
  orbHeader.classList.remove('visible');
  orb.style.display = 'none'; drawCosmodex();
}

orb.addEventListener('click', e => {
  if (!orb.classList.contains('expanded')) { openOrb(); return; }
  // When expanded: ignore clicks that hit UI children (header, footer, close)
  // With pointer-events:none on canvas, direct canvas-area clicks land on orb itself
  if (e.target !== orb) return;
  // Petal click — detect which hour
  if (!_orbGeometry) return;
  const rect = orb.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const { cx, cy, innerR, eventR } = _orbGeometry;
  const dx = x - cx, dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist >= innerR * 0.85 && dist <= eventR + 28) {
    const angle = Math.atan2(dy, dx);
    const hour = Math.floor(((angle + Math.PI / 2) / (Math.PI * 2) * 24 + 24) % 24);
    openOrbAddTaskModal(hour);
  }
});
orbClose.addEventListener('click', e => { e.stopPropagation(); closeOrb(); });
orbBackdrop.addEventListener('click', closeOrb);

/* ── Radial chronodex canvas draw ─────────────────────── */

// Core drawing — pure canvas ops, no DOM side effects. Returns { cx, cy, maxR }.
function _cosmodexDrawCore(ctx, W, H, expanded, dpr) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2;
  const cy = expanded ? H / 2 - 10 : H / 2;
  const maxR = expanded
    ? Math.min(W * 0.46, (H - 230) / 2)
    : Math.min(W, H) / 2 * 0.93;
  const innerR = maxR * (expanded ? 0.14 : 0.175);
  const baseR  = maxR * (expanded ? 0.52 : 0.65);
  const eventR = maxR * (expanded ? 0.70 : 0.72);

  const now    = new Date(Date.now() + (window._orbTimeOffset || 0)); // Bubble drag preview
  const today  = localDateStr(now);
  const curH   = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const TWO_PI = Math.PI * 2;
  const GAP    = (TWO_PI / 24) * 0.06;

  // Subtle outer ring guide
  ctx.beginPath();
  ctx.arc(cx, cy, eventR + (expanded ? 3 : 1), 0, TWO_PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = expanded ? 1 : 0.5;
  ctx.stroke();

  for (let h = 0; h < 24; h++) {
    const a0 = (h / 24)       * TWO_PI - Math.PI / 2 + GAP;
    const a1 = ((h + 1) / 24) * TWO_PI - Math.PI / 2 - GAP;

    const evs  = CAL_EVENTS.filter(ev => {
      if (ev.date !== today || !ev.startTime) return false;
      const [eh, em] = ev.startTime.split(':').map(Number);
      const startFrac = eh + em / 60;
      const endFrac = startFrac + (ev.duration || 60) / 60;
      return h >= Math.floor(startFrac) && h < Math.ceil(endFrac);
    });
    const hasEv  = evs.length > 0;
    const isCur  = Math.floor(curH) === h;
    const isPast = h < Math.floor(curH);

    const isNight = h < 5 || h >= 23;
    const isRest  = h >= 5 && h < 7;
    const isEve   = h >= 20 && h < 23;

    const segR = hasEv ? eventR : baseR;

    let fill;
    if (hasEv) {
      const t = TASKS.find(t => t.id === evs[0].taskId);
      fill = getCatColor(t?.category) + (expanded ? 'cc' : 'bb');
    } else if (isCur) {
      fill = 'rgba(255,255,255,0.28)';
    } else if (isPast) {
      fill = isNight ? 'rgba(60,60,80,0.07)' : 'rgba(255,255,255,0.07)';
    } else {
      if (isNight)      fill = 'rgba(60,60,80,0.05)';
      else if (isRest)  fill = 'rgba(180,100,40,0.09)';
      else if (isEve)   fill = 'rgba(60,90,70,0.07)';
      else              fill = 'rgba(232,224,208,0.04)';
    }

    ctx.beginPath();
    ctx.arc(cx, cy, innerR, a0, a1);
    ctx.arc(cx, cy, segR,   a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();

    if (hasEv) {
      const t = TASKS.find(t => t.id === evs[0].taskId);
      ctx.strokeStyle = getCatColor(t?.category) + '55';
      ctx.lineWidth   = 0.6;
      ctx.stroke();
    }

    if (isCur && !hasEv) {
      const frac = curH - Math.floor(curH);
      const aElapsed = a0 + (a1 - a0) * frac;
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, a0, aElapsed);
      ctx.arc(cx, cy, baseR,  aElapsed, a0, true);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fill();
    }

    if (expanded) {
      const boundA = (h / 24) * TWO_PI - Math.PI / 2;
      const isQuarter = h % 6 === 0;
      const dotRad = isQuarter ? 2 : (h % 3 === 0 ? 1.4 : 0.8);
      const dotDist = eventR + (isQuarter ? 7 : 5);
      ctx.beginPath();
      ctx.arc(cx + dotDist * Math.cos(boundA), cy + dotDist * Math.sin(boundA), dotRad, 0, TWO_PI);
      ctx.fillStyle = isQuarter ? 'rgba(255,255,255,0.6)' : (h % 3 === 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.18)');
      ctx.fill();
    }

    if (expanded && h % 3 === 0) {
      const boundA = (h / 24) * TWO_PI - Math.PI / 2;
      const labelDist = eventR + (h % 6 === 0 ? 22 : 19);
      ctx.fillStyle = isCur ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)';
      ctx.font = `${h % 6 === 0 ? 14 : 11}px "DM Mono", monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(h), cx + labelDist * Math.cos(boundA), cy + labelDist * Math.sin(boundA));
    }

    if (hasEv && evs[0].title && segR > baseR) {
      const midA   = ((h + 0.5) / 24) * TWO_PI - Math.PI / 2;
      const isLeft = Math.cos(midA) < 0;
      const startDist = isLeft ? eventR - 2 : innerR + 2;
      const sx = cx + startDist * Math.cos(midA);
      const sy = cy + startDist * Math.sin(midA);
      const maxPx = eventR - innerR - 4;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(isLeft ? midA + Math.PI : midA);
      ctx.fillStyle = 'rgba(232,224,208,0.95)';
      ctx.font = `${expanded ? 8 : 6}px "DM Mono", monospace`;
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(evs[0].title, 0, 0, maxPx);
      ctx.restore();
    }
  }

  // Red current-time needle
  const tAngle = (curH / 24) * TWO_PI - Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(cx + (innerR + 2) * Math.cos(tAngle), cy + (innerR + 2) * Math.sin(tAngle));
  ctx.lineTo(cx + (eventR + 5) * Math.cos(tAngle), cy + (eventR + 5) * Math.sin(tAngle));
  ctx.strokeStyle = '#e05550';
  ctx.lineWidth   = expanded ? 2 : 1.5;
  ctx.lineCap     = 'round';
  ctx.stroke();

  if (expanded) {
    ctx.beginPath();
    ctx.arc(cx + (eventR + 5) * Math.cos(tAngle), cy + (eventR + 5) * Math.sin(tAngle), 2.5, 0, TWO_PI);
    ctx.fillStyle = '#e05550';
    ctx.fill();
  }

  // Center hub
  ctx.beginPath();
  ctx.arc(cx, cy, innerR - 1, 0, TWO_PI);
  ctx.fillStyle = '#070707';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth   = 1;
  ctx.stroke();

  if (!expanded) {
    const hh2 = String(now.getHours()).padStart(2, '0');
    const mm2 = String(now.getMinutes()).padStart(2, '0');
    const fontSize = Math.max(8, Math.round(innerR * 0.72));
    ctx.fillStyle    = 'rgba(255,255,255,0.88)';
    ctx.font         = `bold ${fontSize}px "DM Mono", monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${hh2}:${mm2}`, cx, cy);
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();
  }

  return { cx, cy, maxR };
}

function drawCosmodex() {
  if (document.hidden) return;            // perf: don't redraw the 1Hz orb while the tab is hidden
  const canvas = document.getElementById('cosmodex-canvas');
  if (!canvas) return;

  const expanded = orb.classList.contains('expanded');
  const dpr = window.devicePixelRatio || 1;
  const W = orb.offsetWidth, H = orb.offsetHeight;
  if (W < 4) return;

  // Only resize canvas backing store when dimensions actually change (avoids costly clears)
  if (canvas.dataset.cw !== String(W) || canvas.dataset.ch !== String(H)) {
    canvas.width  = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    canvas.dataset.cw = String(W); canvas.dataset.ch = String(H);
  }

  const geo = _cosmodexDrawCore(canvas.getContext('2d'), W, H, expanded, dpr);

  // Store geometry for petal click detection
  if (expanded) {
    _orbGeometry = { cx: geo.cx, cy: geo.cy, innerR: geo.maxR * 0.14, eventR: geo.maxR * 0.70 };
  } else {
    _orbGeometry = null;
  }

  const now = new Date(Date.now() + (window._orbTimeOffset || 0));
  const today = localDateStr(now);

  // Update date line in orb header
  if (expanded) {
    const dateLine = document.getElementById('orb-date-line');
    if (dateLine) {
      const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      dateLine.textContent = `${days[now.getDay()]} · ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    }
    const hh2 = String(now.getHours()).padStart(2, '0');
    const mm2 = String(now.getMinutes()).padStart(2, '0');
    const ss2 = String(now.getSeconds()).padStart(2, '0');
    const clockEl = document.getElementById('orb-clock');
    if (clockEl) clockEl.textContent = `${hh2}:${mm2}:${ss2}`;

    const nowMins = now.getHours() * 60 + now.getMinutes();
    const upcoming = CAL_EVENTS
      .filter(ev => ev.date === today && ev.startTime)
      .map(ev => { const [eh, em] = ev.startTime.split(':').map(Number); return { ...ev, evMins: eh * 60 + em }; })
      .filter(ev => ev.evMins > nowMins)
      .sort((a, b) => a.evMins - b.evMins);

    const nextEl = document.getElementById('orb-next-event');
    const nextLabelEl = document.querySelector('.orb-next-label');
    if (nextEl) {
      if (upcoming.length === 0) {
        if (nextLabelEl) nextLabelEl.textContent = 'Schedule';
        nextEl.textContent = 'nothing planned. a perfectly empty orbit — suspicious.';
      } else {
        if (nextLabelEl) nextLabelEl.textContent = 'Next';
        const next = upcoming[0];
        const diff = next.evMins - nowMins;
        const timeStr = diff <= 0 ? 'Now' : diff < 60 ? `In ${diff}m` : (() => { const dh = Math.floor(diff/60), dm = diff%60; return dm > 0 ? `In ${dh}h ${dm}m` : `In ${dh}h`; })();
        nextEl.innerHTML = `${timeStr}&thinsp;·&thinsp;<em>${escHtml(next.title)}</em>&thinsp;<span style="color:var(--muted);font-size:0.85em">${next.startTime}</span>`;
      }
    }
  }

  // Also draw to pomo canvas if focus overlay is open
  const pomoCanvas = document.getElementById('pomo-cosmo-canvas');
  if (pomoCanvas && document.getElementById('pomo-overlay')?.classList.contains('open')) {
    const pW = pomoCanvas.offsetWidth, pH = pomoCanvas.offsetHeight;
    if (pW > 4) {
      pomoCanvas.width = pW * dpr; pomoCanvas.height = pH * dpr;
      pomoCanvas.style.width = pW + 'px'; pomoCanvas.style.height = pH + 'px';
      _cosmodexDrawCore(pomoCanvas.getContext('2d'), pW, pH, true, dpr);

      // Update pomo cosmo info strip
      const hh2 = String(now.getHours()).padStart(2, '0');
      const mm2 = String(now.getMinutes()).padStart(2, '0');
      const ss2 = String(now.getSeconds()).padStart(2, '0');
      const clockEl = document.getElementById('pomo-cosmo-clock');
      const dateEl  = document.getElementById('pomo-cosmo-date');
      if (clockEl) clockEl.textContent = `${hh2}:${mm2}:${ss2}`;
      if (dateEl) {
        const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        dateEl.textContent = `${days[now.getDay()]} · ${now.getDate()} ${months[now.getMonth()]}`;
      }
      const nowMins2 = now.getHours() * 60 + now.getMinutes();
      const upcoming2 = CAL_EVENTS
        .filter(ev => ev.date === today && ev.startTime)
        .map(ev => { const [eh, em] = ev.startTime.split(':').map(Number); return { ...ev, evMins: eh * 60 + em }; })
        .filter(ev => ev.evMins > nowMins2)
        .sort((a, b) => a.evMins - b.evMins);
      const nextEl2 = document.getElementById('pomo-cosmo-next');
      const nextLabelEl2 = document.getElementById('pomo-cosmo-next-label');
      if (nextEl2) {
        if (upcoming2.length === 0) {
          if (nextLabelEl2) nextLabelEl2.textContent = 'Schedule';
          nextEl2.textContent = 'nothing planned. a perfectly empty orbit — suspicious.';
        } else {
          if (nextLabelEl2) nextLabelEl2.textContent = 'Next';
          const next2 = upcoming2[0];
          const diff2 = next2.evMins - nowMins2;
          const ts2 = diff2 <= 0 ? 'Now' : diff2 < 60 ? `In ${diff2}m` : (() => { const dh=Math.floor(diff2/60),dm=diff2%60; return dm>0?`In ${dh}h ${dm}m`:`In ${dh}h`; })();
          nextEl2.innerHTML = `${ts2}&thinsp;·&thinsp;<em>${escHtml(next2.title)}</em>&thinsp;<span style="color:var(--muted);font-size:0.85em">${next2.startTime}</span>`;
        }
      }
    }
  }
}

// Tick every second (drives both mini and expanded states)
_cosmodexInterval = setInterval(drawCosmodex, 1000);
drawCosmodex(); // immediate first draw

/* ── Entropy — the rail-side dice (choice-overload breaker) ── */
function rollEntropy() {
  const btn = document.getElementById('task-entropy-btn');
  if (!btn || btn.dataset.rolling === '1') return;
  let pool = TASKS.filter(t => !t.done && (t.energyType === 'shallow' || t.energyType === 'admin'));
  if (pool.length === 0) pool = TASKS.filter(t => !t.done);
  if (pool.length === 0) { showToast('nothing left to roll. the void approves.', 'info'); return; }

  btn.dataset.rolling = '1';
  btn.classList.add('rolling');
  let frame = 0;
  const ticker = setInterval(() => {
    btn.textContent = DICE_FACES[frame % 6];
    frame++;
    if (frame >= 14) {
      clearInterval(ticker);
      btn.classList.remove('rolling');
      btn.dataset.rolling = '0';
      const picked = pool[Math.floor(Math.random() * pool.length)];
      btn.textContent = DICE_FACES[Math.floor(Math.random() * 6)];
      const row = document.querySelector(`#tasks-body .task-row[data-task-id="${(window.CSS && CSS.escape) ? CSS.escape(picked.id) : picked.id}"]`);
      if (row) {
        _kbSelect(row);
        row.classList.remove('entropy-hit');
        void row.offsetWidth;
        row.classList.add('entropy-hit');
      }
      const short = picked.title.length > 34 ? picked.title.slice(0, 34) + '…' : picked.title;
      showToast(`the universe has spoken: ${short}`, 'info', 4000);
    }
  }, 55);
}
document.getElementById('task-entropy-btn')?.addEventListener('click', rollEntropy);

/* ── Dice Gadget ───────────────────────────────────────── */
const DICE_FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];

function rollDice() {
  const btn = document.getElementById('orb-dice-btn');
  if (!btn || btn.dataset.rolling === '1') return;

  // Pick from shallow/admin energy tasks only (undone)
  let pool = TASKS.filter(t => !t.done && (t.energyType === 'shallow' || t.energyType === 'admin'));
  if (pool.length === 0) pool = TASKS.filter(t => !t.done); // fallback to all undone
  if (pool.length === 0) {
    btn.textContent = '⚀';
    btn.title = 'No tasks to roll!';
    return;
  }

  btn.dataset.rolling = '1';
  btn.classList.add('rolling');

  let frame = 0;
  const total = 16;
  const ticker = setInterval(() => {
    btn.textContent = DICE_FACES[frame % 6];
    frame++;
    if (frame >= total) {
      clearInterval(ticker);
      const picked = pool[Math.floor(Math.random() * pool.length)];
      const face = DICE_FACES[Math.floor(Math.random() * 6)];
      btn.textContent = face;
      btn.title = picked.title;
      btn.classList.remove('rolling');
      btn.dataset.rolling = '0';

      // Show result in next-event display
      const nextEl = document.getElementById('orb-next-event');
      const nextLabelEl = document.querySelector('.orb-next-label');
      if (nextEl) {
        if (nextLabelEl) nextLabelEl.textContent = 'Rolled';
        nextEl.innerHTML = `${face}&thinsp;<em>${escHtml(picked.title)}</em>`;
        setTimeout(() => { if (nextLabelEl) nextLabelEl.textContent = 'Next'; }, 5000);
      }
    }
  }, 55);
}

document.getElementById('orb-dice-btn')?.addEventListener('click', rollDice);

/* ── Spinning Wheel Gadget ────────────────────────────── */
let wheelAngle   = 0;
let wheelVelocity = 0;
let wheelSpinning = false;
let wheelTasks    = [];

function drawWheel(canvas, angle) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const r  = Math.min(W, H) / 2 - 6;
  ctx.clearRect(0, 0, W, H);

  const n = wheelTasks.length;
  if (n === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '13px "DM Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No tasks', cx, cy);
    return;
  }

  const slice = (Math.PI * 2) / n;
  const WHEEL_COLORS = [
    '#c9a227','#6b9fd4','#4a7c5e','#c45c2a','#8a6bbf','#2a8a7c','#bf6b8a','#a27c4a'
  ];

  for (let i = 0; i < n; i++) {
    const a0 = angle + i * slice;
    const a1 = a0 + slice;

    // Slice fill
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a1);
    ctx.closePath();
    ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length] + '33';
    ctx.fill();
    ctx.strokeStyle = WHEEL_COLORS[i % WHEEL_COLORS.length] + '88';
    ctx.lineWidth = 1;
    ctx.stroke();

    // No text labels inside slices — winner shown below wheel
  }

  // Pointer triangle on the right
  ctx.beginPath();
  ctx.moveTo(cx + r + 6, cy);
  ctx.lineTo(cx + r + 14, cy - 7);
  ctx.lineTo(cx + r + 14, cy + 7);
  ctx.closePath();
  ctx.fillStyle = '#e05550';
  ctx.fill();

  // Center hub
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#0e0e0e';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function openWheelOverlay() {
  wheelTasks = TASKS.filter(t => !t.done).slice(0, 8);
  const overlay = document.getElementById('orb-wheel-overlay');
  const canvas  = document.getElementById('orb-wheel-canvas');
  const resultEl = document.getElementById('orb-wheel-result');
  if (!overlay || !canvas) return;
  resultEl.textContent = '';
  document.getElementById('orb-wheel-spin').disabled = false;
  overlay.classList.add('visible');
  drawWheel(canvas, wheelAngle);
}

function spinWheel() {
  if (wheelSpinning) return;
  const canvas  = document.getElementById('orb-wheel-canvas');
  const resultEl = document.getElementById('orb-wheel-result');
  const spinBtn  = document.getElementById('orb-wheel-spin');
  if (!canvas) return;

  wheelSpinning = true;
  spinBtn.disabled = true;
  resultEl.textContent = '';
  wheelVelocity = 0.18 + Math.random() * 0.22; // random starting velocity

  function tick() {
    wheelAngle    += wheelVelocity;
    wheelVelocity *= 0.978; // decelerate
    drawWheel(canvas, wheelAngle);

    if (wheelVelocity > 0.003) {
      requestAnimationFrame(tick);
    } else {
      wheelSpinning = false;
      spinBtn.disabled = false;

      // Determine winner: pointer is at angle 0 (right side = 3 o'clock)
      // Normalize angle so 0 = top (pointer at right means offset by -PI/2)
      const n = wheelTasks.length;
      if (n === 0) return;
      const slice = (Math.PI * 2) / n;
      // pointer is on the RIGHT side, so we find which slice is at angle 0
      const norm = ((-wheelAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const winIdx = Math.floor(norm / slice) % n;
      const winner = wheelTasks[winIdx];
      resultEl.innerHTML = `<em>${escHtml(winner.title)}</em>`;
    }
  }
  requestAnimationFrame(tick);
}

document.getElementById('orb-wheel-btn')?.addEventListener('click', openWheelOverlay);
document.getElementById('orb-wheel-spin')?.addEventListener('click', spinWheel);
document.getElementById('orb-wheel-close')?.addEventListener('click', () => {
  document.getElementById('orb-wheel-overlay')?.classList.remove('visible');
});

/* ── Overlay system ────────────────────────────────────── */
/* ── Focus-trap utility for overlays ──
   Keeps Tab/Shift-Tab inside an open overlay and restores focus to the
   previously-focused element when the overlay closes. Ensures accessibility
   within the "Liquid Glass" spatial UI so tab doesn't leak into the blurred
   background. */
const _focusTrapState = new WeakMap(); // overlayEl -> { handler, prevActive }
const _focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function _getFocusable(el) {
  return Array.from(el.querySelectorAll(_focusableSelector)).filter(n => {
    if (n.offsetParent === null && getComputedStyle(n).position !== 'fixed') return false;
    return n.tabIndex !== -1;
  });
}

function _attachFocusTrap(overlayEl) {
  if (!overlayEl || _focusTrapState.has(overlayEl)) return;
  const prevActive = document.activeElement;
  const handler = (e) => {
    if (e.key !== 'Tab') return;
    if (!overlayEl.classList.contains('open')) return;
    const focusable = _getFocusable(overlayEl);
    if (!focusable.length) { e.preventDefault(); return; }
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    const active = document.activeElement;
    // If focus is outside the overlay, pull it back to the first focusable
    if (!overlayEl.contains(active)) { e.preventDefault(); first.focus(); return; }
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', handler, true);
  _focusTrapState.set(overlayEl, { handler, prevActive });
  // Focus first focusable element after open animation
  setTimeout(() => {
    const focusable = _getFocusable(overlayEl);
    if (focusable.length) focusable[0].focus();
  }, 60);
}

function _detachFocusTrap(overlayEl) {
  if (!overlayEl) return;
  const state = _focusTrapState.get(overlayEl);
  if (!state) return;
  document.removeEventListener('keydown', state.handler, true);
  _focusTrapState.delete(overlayEl);
  // Restore focus to whatever was focused before the overlay opened
  if (state.prevActive && typeof state.prevActive.focus === 'function' && document.contains(state.prevActive)) {
    try { state.prevActive.focus(); } catch {}
  }
}

function openOverlay(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('open');
    _attachFocusTrap(el);
  }
  if (id === 'notes-overlay') initNotesCanvas();
  if (id === 'pomo-overlay') window.initPomoOverlay?.();
}

function closeOverlay(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('open');
    _detachFocusTrap(el);
  }
}

// MutationObserver: watch every .overlay element for .open class toggles so
// the focus trap attaches/detaches even when code bypasses openOverlay()
// (many call sites use classList.add('open') directly).
(function _observeOverlays() {
  const observe = (el) => {
    const mo = new MutationObserver(muts => {
      muts.forEach(m => {
        if (m.attributeName !== 'class') return;
        const isOpen = el.classList.contains('open');
        const hasTrap = _focusTrapState.has(el);
        if (isOpen && !hasTrap) _attachFocusTrap(el);
        else if (!isOpen && hasTrap) _detachFocusTrap(el);
      });
    });
    mo.observe(el, { attributes: true, attributeFilter: ['class'] });
  };
  const attachAll = () => {
    document.querySelectorAll('.overlay').forEach(observe);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachAll, { once: true });
  } else {
    attachAll();
  }
  // Also catch overlays added later via dynamic DOM
  const bodyObserver = new MutationObserver(muts => {
    muts.forEach(m => {
      m.addedNodes?.forEach(n => {
        if (n.nodeType !== 1) return;
        if (n.classList?.contains('overlay')) observe(n);
        n.querySelectorAll?.('.overlay').forEach(observe);
      });
    });
  });
  const startBody = () => bodyObserver.observe(document.body, { childList: true, subtree: true });
  if (document.body) startBody();
  else document.addEventListener('DOMContentLoaded', startBody, { once: true });
})();

// Delegated handlers for [data-close] buttons and overlay click-outside — covers
// elements inserted after script execution (e.g. #quick-cal-modal at end of body)
//
// Close-outside uses mousedown-origin tracking to avoid false closes when users
// click inside an input (especially number-input spinner arrows, which can fire
// click events with unexpected targets in some browsers).
// Focus / Commit are deliberate "locked" modes: while one is open, the outside
// world cannot be interacted with (the full-screen backdrop already blocks it)
// AND a click on the backdrop or Escape must NOT dismiss it — the user has to
// exit explicitly via the overlay's own controls.
const LOCKED_OVERLAYS = new Set(['pomo-overlay', 'commit-overlay']);

let _overlayMousedownInsidePanel = false;
document.addEventListener('mousedown', e => {
  _overlayMousedownInsidePanel = !!e.target.closest?.('.overlay-panel, #td-pomo-float');
}, true);

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-close]');
  if (btn) {
    closeOverlay(btn.dataset.close); return;
  }
  // Don't close on modifier+click (e.g. Ctrl+click for text selection)
  if (e.ctrlKey || e.metaKey || e.altKey) {
    return;
  }
  // If the click started inside a panel, never close (protects inputs, spinners, text selection)
  if (_overlayMousedownInsidePanel) {
    _overlayMousedownInsidePanel = false;
    return;
  }
  // Only close if the click target is an open overlay itself AND not inside its panel
  const overlay = e.target.closest?.('.overlay.open');
  if (overlay && !e.target.closest('.overlay-panel, #td-pomo-float')) {
    if (LOCKED_OVERLAYS.has(overlay.id)) return; // focus/commit mode — no click-outside dismiss
    if (overlay.id === 'pomo-overlay') {
      document.getElementById('pomo-close')?.click();
    } else {
      closeOverlay(overlay.id);
    }
  }
});

// Header action buttons
document.getElementById('btn-notes')?.addEventListener('click', () => openOverlay('notes-overlay'));
document.getElementById('btn-focus')?.addEventListener('click', () => {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.getElementById('btn-focus')?.classList.add('active');
  showMainPanel('focus');
});
document.getElementById('btn-cosmodex-bubble')?.addEventListener('click', () => openOrb());
document.getElementById('btn-cosmos')?.addEventListener('click', () => openOverlay('claude-panel'));

// Nav footer overlays
document.getElementById('cmd-btn')?.addEventListener('click', openCmdPalette);

/* ── Command Palette ──────────────────────────────────── */
const CMD_COMMANDS_BASE = [
  { label: 'Today',            icon: '◈', action: () => {}, keys: '' },
  { label: 'Open Calendar',    icon: '◻', action: () => {}, keys: '' },
  { label: 'New Task',         icon: '+', action: () => {}, keys: 'N' },
  { label: 'Focus — Timedrift', icon: '◎', action: () => { showMainPanel('timedrift'); document.getElementById('left-nav')?.classList.add('collapsed'); }, keys: 'F' },
  { label: 'Open Notes',       icon: '✎', action: () => openOverlay('notes-overlay'), keys: '' },
  { label: 'Ask Cosmos',       icon: '✦', action: () => openOverlay('claude-panel'), keys: '' },
  { label: 'Insights',         icon: '◈', action: () => showMainPanel('insights'), keys: '' },
  { label: 'Habits',           icon: '◎', action: () => showMainPanel('habits'), keys: '' },
  { label: 'Lists',            icon: '▤', action: () => showMainPanel('lists'), keys: '' },
  { label: 'Planning',         icon: '◉', action: () => showMainPanel('milestones'), keys: '' },
  { label: 'Toggle Theme',     icon: '◑', action: toggleTheme, keys: '' },
  { label: 'Zen Mode',         icon: '◎', action: () => document.getElementById('left-nav').classList.toggle('collapsed'), keys: '' },
  { label: 'Add Shallow Task', icon: '💬', action: async () => {
    const title = prompt('Shallow task title:');
    if (!title?.trim()) return;
    await addTask(title.trim(), 'med', '', _settings.defaultCategory || '', '', 'shallow', []);
  }, keys: '' },
];

function getCmdCommands() {
  const personCmds = PEOPLE.map(p => ({
    label: `@${p.name} — tasks`,
    icon: '◎',
    action: () => showPersonTasks(p),
    keys: '',
    _personColor: p.color,
    _personInitials: p.initials,
  }));
  const initiativeCmds = MILESTONE_PROJECTS.filter(p => !p.isArchived).map(proj => ({
    label: `◉ ${proj.title} — tasks`,
    icon: '◉',
    action: () => showInitiativeTasks(proj),
    keys: '',
    _projColor: proj.color,
  }));
  return [...CMD_COMMANDS_BASE, ...personCmds, ...initiativeCmds];
}

function showInitiativeTasks(proj) {
  // Sort milestone events by date (calendar order)
  const linkedEvents = MILESTONE_EVENTS
    .filter(e => e.projectId === proj.id)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const titleEl = document.getElementById('person-tasks-title');
  const listEl  = document.getElementById('person-tasks-list');
  if (titleEl) {
    titleEl.innerHTML = `<span style="display:inline-flex;align-items:center;gap:8px">
      <span style="width:20px;height:20px;border-radius:6px;background:${proj.color};display:inline-flex;align-items:center;justify-content:center;font-size:10px;color:#0d0c0a">◉</span>
      Tasks in ${escHtml(proj.title)}
    </span>`;
  }
  if (listEl) {
    const renderTask = t => {
      const cat = t.category ? CATEGORIES[t.category] : null;
      const catBadge = cat ? `<span style="font-family:var(--font-mono);font-size:10px;padding:1px 5px;border-radius:100px;background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44">${cat.label}</span>` : '';
      return `<div style="display:flex;align-items:center;gap:10px;padding:9px 16px 9px 28px;border-bottom:1px solid var(--border)">
        <div style="width:14px;height:14px;border-radius:4px;border:1.5px solid ${t.done?'var(--neon)':'var(--border)'};background:${t.done?'var(--neon)':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px;color:var(--ink)">${t.done?'✓':''}</div>
        <span style="flex:1;font-size:13px;color:${t.done?'var(--muted)':'var(--cream)'};${t.done?'text-decoration:line-through':''}">${escHtml(t.title)}</span>
        ${catBadge}
        ${t.dueDate ? `<span style="font-family:var(--font-mono);font-size:10px;color:var(--muted)">${fmtDate(t.dueDate)}</span>` : ''}
      </div>`;
    };

    let html = '';
    let totalTasks = 0;
    linkedEvents.forEach(ev => {
      const evTaskIds = (ev.activities || []).filter(a => a.taskId).map(a => a.taskId);
      const evTasks = TASKS.filter(t => evTaskIds.includes(t.id));
      if (!evTasks.length) return;
      totalTasks += evTasks.length;
      const dateLabel = ev.date ? fmtDate(ev.date) : '';
      html += `<div style="display:flex;align-items:center;gap:8px;padding:10px 16px 7px;border-bottom:1px solid var(--border);background:var(--elevated);position:sticky;top:0;z-index:1">
        <span style="width:7px;height:7px;border-radius:50%;background:${proj.color};flex-shrink:0"></span>
        <span style="font-family:var(--font-mono);font-size:10px;letter-spacing:0.06em;color:var(--cream);font-weight:500;flex:1">${escHtml(ev.title || 'Milestone')}</span>
        ${dateLabel ? `<span style="font-family:var(--font-mono);font-size:10px;color:var(--muted)">${dateLabel}</span>` : ''}
      </div>`;
      evTasks.forEach(t => { html += renderTask(t); });
    });

    if (!totalTasks) {
      html = `<div style="padding:20px 16px;font-size:13px;color:var(--muted)">No tasks linked to <strong>${escHtml(proj.title)}</strong> yet. Link tasks via milestone activities in Life OS.</div>`;
    }
    listEl.innerHTML = html;
  }
  document.getElementById('person-tasks-overlay').classList.add('open');
}

function showPersonTasks(person) {
  const tasks = TASKS.filter(t => t.people && t.people.includes(person.id));
  const titleEl = document.getElementById('person-tasks-title');
  const listEl  = document.getElementById('person-tasks-list');
  if (titleEl) {
    titleEl.innerHTML = `<span style="display:inline-flex;align-items:center;gap:8px">
      <span style="width:20px;height:20px;border-radius:50%;background:${person.color};display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:#0d0c0a">${escHtml(person.initials)}</span>
      Tasks linked to @${escHtml(person.name)}
    </span>`;
  }
  if (listEl) {
    if (!tasks.length) {
      listEl.innerHTML = `<div style="padding:20px 16px;font-size:13px;color:var(--muted)">No tasks linked to @${escHtml(person.name)} yet.</div>`;
    } else {
      const open = tasks.filter(t => !t.done);
      const done = tasks.filter(t => t.done);
      const renderGroup = (arr, label) => arr.length ? `
        <div style="font-family:var(--font-mono);font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:var(--muted);padding:10px 16px 4px">${label}</div>
        ${arr.map(t => `
          <div style="display:flex;align-items:center;gap:10px;padding:9px 16px;border-bottom:1px solid var(--border)">
            <div style="width:14px;height:14px;border-radius:4px;border:1.5px solid ${t.done?'var(--neon)':'var(--border)'};background:${t.done?'var(--neon)':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px;color:var(--ink)">${t.done?'✓':''}</div>
            <span style="flex:1;font-size:13px;color:${t.done?'var(--muted)':'var(--cream)'};${t.done?'text-decoration:line-through':''}">${escHtml(t.title)}</span>
            ${t.dueDate ? `<span style="font-family:var(--font-mono);font-size:10px;color:var(--muted)">${fmtDate(t.dueDate)}</span>` : ''}
          </div>`).join('')}` : '';
      listEl.innerHTML = renderGroup(open, 'Open') + renderGroup(done, 'Done');
    }
  }
  document.getElementById('person-tasks-overlay').classList.add('open');
}

function openCmdPalette() {
  const pal = document.getElementById('cmd-palette');
  pal.classList.add('open');
  setTimeout(() => document.getElementById('cmd-input')?.focus(), 50);
  renderCmdResults('');
}

function closeCmdPalette() {
  document.getElementById('cmd-palette').classList.remove('open');
  document.getElementById('cmd-input').value = '';
}

function renderCmdResults(query) {
  const container = document.getElementById('cmd-results');
  const commands = getCmdCommands();
  const filtered = commands.filter(c =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );
  if (!filtered.length) {
    container.innerHTML = `<div class="cmd-empty">the cosmos found nothing. try fewer letters.</div>`;
    return;
  }
  container.innerHTML = filtered.map((c, i) => `
    <div class="cmd-result-item ${i===0?'selected':''}" data-cmd="${i}">
      ${c._personColor
        ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:${c._personColor};font-size:7px;font-weight:600;color:#0d0c0a;flex-shrink:0">${escHtml(c._personInitials)}</span>`
        : c._projColor
          ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:4px;background:${c._projColor};font-size:10px;color:#0d0c0a;flex-shrink:0">◉</span>`
          : `<span class="cmd-result-icon">${c.icon}</span>`}
      ${escHtml(c.label)}
      ${c.keys ? `<span class="cmd-result-keys">${c.keys}</span>` : ''}
    </div>`).join('');

  container.querySelectorAll('.cmd-result-item').forEach((item, idx) => {
    item.addEventListener('click', () => {
      filtered[idx].action();
      closeCmdPalette();
    });
  });
}

document.getElementById('cmd-input')?.addEventListener('input', e => {
  renderCmdResults(e.target.value);
});

document.getElementById('cmd-input')?.addEventListener('keydown', e => {
  const items = document.querySelectorAll('#cmd-results .cmd-result-item');
  if (!items.length) return;
  const selIdx = [...items].findIndex(i => i.classList.contains('selected'));
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    items[selIdx]?.classList.remove('selected');
    const next = items[(selIdx + 1) % items.length];
    next?.classList.add('selected');
    next?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    items[selIdx]?.classList.remove('selected');
    const prev = items[(selIdx - 1 + items.length) % items.length];
    prev?.classList.add('selected');
    prev?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const sel = document.querySelector('#cmd-results .cmd-result-item.selected');
    if (sel) sel.click();
  }
});

document.getElementById('cmd-palette')?.addEventListener('click', e => {
  if (e.target.id === 'cmd-palette') closeCmdPalette();
});

/* ── Keyboard shortcuts ────────────────────────────────── */

/* Task-rail selection (j/k/x/s) */
let _kbSelTaskId = null;

function _kbVisibleRows() {
  return [...document.querySelectorAll('#tasks-body .task-row')]
    .filter(r => r.offsetParent !== null);
}
function _kbSelect(row) {
  document.querySelectorAll('.task-row.kb-selected').forEach(r => r.classList.remove('kb-selected'));
  if (!row) { _kbSelTaskId = null; return; }
  row.classList.add('kb-selected');
  _kbSelTaskId = row.dataset.taskId;
  row.scrollIntoView({ block: 'nearest' });
}
function _kbMove(dir) {
  const rows = _kbVisibleRows();
  if (!rows.length) return;
  const idx = rows.findIndex(r => r.dataset.taskId === _kbSelTaskId);
  const next = idx === -1 ? (dir > 0 ? rows[0] : rows[rows.length - 1])
                          : rows[Math.min(rows.length - 1, Math.max(0, idx + dir))];
  _kbSelect(next);
}

/* "?" shortcut chart */
function toggleShortcutChart() {
  let el = document.getElementById('kb-chart');
  if (el) { el.remove(); return; }
  el = document.createElement('div');
  el.id = 'kb-chart';
  const rows = [
    ['n', 'new task'], ['j / k', 'drift down / up the rail'], ['x', 'complete selection'],
    ['s', 'edit / schedule selection'], ['e', 'entropy — roll a random task'],
    ['t', 'today'], ['[  /  ]', 'previous / next day'],
    ['⌘K · ⌘Space', 'command palette'], ['esc', 'close the nearest thing'], ['?', 'this chart'],
  ];
  el.innerHTML = `<div class="kb-chart-card" role="dialog" aria-label="Keyboard shortcuts">
    <div class="kb-chart-title">star chart</div>
    ${rows.map(([k, d]) => `<div class="kb-chart-row"><span class="kb-chart-key">${k}</span><span class="kb-chart-desc">${d}</span></div>`).join('')}
  </div>`;
  el.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
}

document.addEventListener('keydown', e => {
  const inField = e.target.matches('input,textarea,select,[contenteditable="true"]');

  // Cmd/Ctrl+K or Cmd/Ctrl+Space — command palette (skip if a modal overlay is already open)
  if ((e.metaKey || e.ctrlKey) && (e.key === ' ' || e.key.toLowerCase() === 'k')) {
    e.preventDefault();
    const pal = document.getElementById('cmd-palette');
    if (pal.classList.contains('open')) { closeCmdPalette(); }
    else if (!document.querySelector('.overlay.open')) { openCmdPalette(); }
    return;
  }

  if (!inField && !e.metaKey && !e.ctrlKey && !e.altKey) {
    // N — new task from anywhere: jump to the Tasks page and focus its capture input
    if (e.key === 'n') {
      e.preventDefault();
      if (_mainPanel !== 'alltasks') showMainPanel('alltasks');
      setTimeout(() => {
        const inp = document.getElementById('atk-add-input') || document.getElementById('task-add-input');
        inp?.focus();
      }, _mainPanel === 'alltasks' ? 0 : 40);
      return;
    }
    // j / k — walk the task rail
    if (e.key === 'j') { _kbMove(1);  return; }
    if (e.key === 'k') { _kbMove(-1); return; }
    // x — complete the selected task (routes through the mandatory close prompt)
    if (e.key === 'x' && _kbSelTaskId) { handleCheckClick(_kbSelTaskId); return; }
    // s — schedule/edit the selected task
    if (e.key === 's' && _kbSelTaskId) { openTaskEditModal(_kbSelTaskId); return; }
    // e — entropy: let the universe pick
    if (e.key === 'e') { if (typeof rollEntropy === 'function') rollEntropy(); return; }
    // t — jump to today
    if (e.key === 't') { document.getElementById('cal-today')?.click(); return; }
    // [ / ] — previous / next day
    if (e.key === '[') { document.getElementById('cal-prev')?.click(); return; }
    if (e.key === ']') { document.getElementById('cal-next')?.click(); return; }
    // ? — shortcut chart
    if (e.key === '?') { toggleShortcutChart(); return; }
  }
  // ESC — close topmost open thing
  if (e.key === 'Escape') {
    const chart = document.getElementById('kb-chart');
    if (chart) { chart.remove(); return; }
    // Focus is a page now — ESC leaves it back to the dashboard.
    if (_mainPanel === 'focus') { showMainPanel('default'); return; }
    if (document.querySelector('.task-row.kb-selected')) { _kbSelect(null); return; }
    if (document.getElementById('cmd-palette').classList.contains('open')) {
      closeCmdPalette(); return;
    }
    if (orb.classList.contains('expanded')) {
      closeOrb(); return;
    }
    document.querySelectorAll('.overlay.open').forEach(o => { if (!LOCKED_OVERLAYS.has(o.id)) o.classList.remove('open'); });
  }
});

/* ── Mobile nav ────────────────────────────────────────── */
document.querySelectorAll('.mob-nav-btn[data-mob]').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.mob;
    document.querySelectorAll('.mob-nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Close drawer
    document.getElementById('mob-more-drawer').classList.remove('open');

    if (target === 'more') {
      document.getElementById('mob-more-drawer').classList.toggle('open');
    } else if (target === 'orb') {
      openOrb();
    } else if (target === 'tasks') {
      document.getElementById('panel-tasks').classList.add('mob-active');
    } else {
      document.getElementById('panel-tasks').classList.remove('mob-active');
    }
  });
});

// Drawer items — overlays
document.querySelectorAll('.drawer-item[data-open]').forEach(item => {
  item.addEventListener('click', () => {
    document.getElementById('mob-more-drawer').classList.remove('open');
    openOverlay(item.dataset.open);
  });
});

// Drawer items — full panels (habits, lists, insights)
document.querySelectorAll('.drawer-item[data-mob-panel]').forEach(item => {
  item.addEventListener('click', () => {
    document.getElementById('mob-more-drawer').classList.remove('open');
    showMainPanel(item.dataset.mobPanel);
  });
});
document.querySelectorAll('.drawer-item[data-panel-nav]').forEach(item => {
  item.addEventListener('click', () => {
    document.getElementById('mob-more-drawer').classList.remove('open');
    showMainPanel(item.dataset.panelNav);
  });
});

/* ── Cursor spotlight ──────────────────────────────────── */
const spotlight = document.getElementById('cursor-spotlight');
let spotlightVisible = false;
document.addEventListener('mousemove', e => {
  spotlight.style.left = e.clientX + 'px';
  spotlight.style.top  = e.clientY + 'px';
  if (!spotlightVisible) {
    spotlight.style.opacity = '1';
    spotlightVisible = true;
  }
});

document.addEventListener('mouseleave', () => {
  spotlight.style.opacity = '0';
  spotlightVisible = false;
});

/* ── View tabs ─────────────────────────────────────────── */
document.querySelectorAll('.view-tab[data-view]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.view-tab[data-view]').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    _calView = tab.dataset.view;
    renderCalendar();
  });
});

/* ── Sign-in crystal background ──────────────────────── */
(function initSigninCrystal() {
  const cv = document.getElementById('signin-crystal-bg');
  if (!cv) return;
  cv.width  = cv.offsetWidth  * devicePixelRatio;
  cv.height = cv.offsetHeight * devicePixelRatio;
  const W = cv.width, H = cv.height;
  const ctx = cv.getContext('2d');

  // Seed points — denser toward centre
  const pts = [];
  for (let i = 0; i < 28; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 0.6) * 0.48 * Math.min(W, H);
    pts.push({ x: W/2 + Math.cos(a)*r, y: H/2 + Math.sin(a)*r });
  }
  for (let i = 0; i < 8; i++) pts.push({ x: Math.random()*W, y: Math.random()*H });

  // Build triangles (fan from centre only)
  const tris = [];
  const centre = { x: W/2, y: H/2 };
  for (let i = 0; i < pts.length; i++) {
    const j = (i+1) % pts.length;
    tris.push([centre, pts[i], pts[j]]);
  }

  // Assign luminance per triangle
  const triData = tris.map(tri => {
    const mx = (tri[0].x+tri[1].x+tri[2].x)/3;
    const my = (tri[0].y+tri[1].y+tri[2].y)/3;
    const d = Math.sqrt((mx-W/2)**2 + (my-H/2)**2);
    const norm = d / Math.sqrt((W/2)**2+(H/2)**2);
    const angle = Math.atan2(my-H*0.15, mx-W*0.3);
    const brightness = Math.sin(angle+Math.PI)*0.5+0.5;
    return {
      pts: tri,
      fill:   brightness*(0.03+norm*0.02),
      stroke: 0.03+norm*0.08,
      phase:  Math.random()*Math.PI*2,
      pulse:  Math.random()*0.006+0.002,
    };
  });

  let t = 0;
  function loop() {
    t += 0.018;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = '#080706'; ctx.fillRect(0,0,W,H);

    const lx = W*(0.3+0.2*Math.sin(t*0.35));
    const ly = H*(0.15+0.1*Math.cos(t*0.28));
    const maxL = Math.sqrt(W*W+H*H)*0.5;

    triData.forEach(tri => {
      tri.phase += tri.pulse;
      const mx = (tri.pts[0].x+tri.pts[1].x+tri.pts[2].x)/3;
      const my = (tri.pts[0].y+tri.pts[1].y+tri.pts[2].y)/3;
      const ld = Math.sqrt((lx-mx)**2+(ly-my)**2);
      const lit = Math.max(0, 1-ld/maxL)*0.8 + Math.sin(tri.phase)*0.04;

      ctx.beginPath();
      ctx.moveTo(tri.pts[0].x, tri.pts[0].y);
      ctx.lineTo(tri.pts[1].x, tri.pts[1].y);
      ctx.lineTo(tri.pts[2].x, tri.pts[2].y);
      ctx.closePath();
      ctx.fillStyle   = `rgba(255,255,255,${(tri.fill+lit*0.04).toFixed(4)})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${(tri.stroke+lit*0.06).toFixed(4)})`;
      ctx.lineWidth   = 0.5*devicePixelRatio;
      ctx.stroke();
    });

    // Centre glow
    const grd = ctx.createRadialGradient(W/2,H/2,0, W/2,H/2, W*0.22);
    grd.addColorStop(0, 'rgba(255,255,255,0.04)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd; ctx.fillRect(0,0,W,H);

    requestAnimationFrame(loop);
  }
  loop();
})();

/* ── Sign-in overlay ──────────────────────────────────── */
function dismissSigninOverlay() {
  const overlay = document.getElementById('signin-overlay');
  if (!overlay) return;
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 0.4s ease';
  setTimeout(() => { overlay.style.display = 'none'; }, 400);
}

function waitForFirebaseAuth(fn) {
  if (window.CDX_AUTH && window.CDX_FB) { fn(); return; }
  setTimeout(() => waitForFirebaseAuth(fn), 100);
}

// onAuthStateChanged in the ESM module handles returning Google sessions automatically.
// No silent sign-in attempt needed — Google persists the session via IndexedDB.

// Show redirect auth errors on the login page
window.addEventListener('cdx-redirect-auth-error', (e) => {
  const errEl = document.getElementById('signin-error');
  const btn = document.getElementById('signin-btn');
  if (!errEl) return;
  const err = e.detail;
  const msg = err.code === 'auth/unauthorized-domain'
    ? 'This domain is not authorised for sign-in. Please contact the app owner.'
    : `Sign-in failed: ${err.message || err.code}`;
  errEl.textContent = msg;
  errEl.style.display = 'block';
  if (btn) { btn.disabled = false; btn.textContent = 'Continue with Google'; }
});

// If a redirect error was already dispatched before the DOM was ready, show it now
document.addEventListener('DOMContentLoaded', () => {
  if (window.__cdxRedirectAuthError) {
    const errEl = document.getElementById('signin-error');
    if (errEl) { errEl.textContent = `Sign-in failed: ${window.__cdxRedirectAuthError}`; errEl.style.display = 'block'; }
  }
});

document.getElementById('signin-btn')?.addEventListener('click', () => {
  const btn = document.getElementById('signin-btn');
  const errEl = document.getElementById('signin-error');
  btn.innerHTML = '<span style="display:inline-block;width:18px;height:18px;border:2px solid #ccc;border-top-color:#333;border-radius:50%;animation:spin 0.7s linear infinite"></span>';
  btn.disabled = true;
  errEl.style.display = 'none';

  const resetBtn = (errMsg = '') => {
    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 48 48" style="flex-shrink:0"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Try again`;
    btn.disabled = false;
    if (errMsg) { errEl.textContent = errMsg; errEl.style.display = 'block'; }
  };

  waitForFirebaseAuth(() => {
    const provider = new window.CDX_FB.GoogleAuthProvider();
    window.CDX_FB.signInWithPopup(window.CDX_AUTH, provider)
      .then(() => { /* onAuthStateChanged → cdx-auth-ready → dismiss overlay */ })
      .catch(err => {
        console.error('Google sign-in failed:', err);
        // Popup blocked or internal error (e.g. third-party cookies disabled) — fall back to redirect
        if (err.code === 'auth/popup-blocked' || err.code === 'auth/internal-error') {
          window.CDX_FB.signInWithRedirect(window.CDX_AUTH, provider);
          return;
        }
        const msg = err.code === 'auth/popup-closed-by-user'
          ? 'Sign-in cancelled. Click the button to try again.'
          : `Sign-in failed: ${err.message}`;
        resetBtn(msg);
      });
  });
});

// If returning visitor already has an anonymous session, skip sign-in screen
window.addEventListener('cdx-auth-ready', () => {
  dismissSigninOverlay();
});

/* ═══════════════════════════════════════════════════════════
   SOMEDAY GRAVEYARD
═══════════════════════════════════════════════════════════ */
function renderSomedaySection(body, somedayTasks, startIdx) {
  if (!somedayTasks.length) return;
  const stored = localStorage.getItem('cdx_someday_open');
  const isOpen = stored === 'true';

  const section = document.createElement('div');
  section.className = 'someday-section';

  const header = document.createElement('div');
  header.className = 'someday-section-header' + (isOpen ? ' open' : '');
  header.innerHTML = `<span class="someday-toggle-icon">›</span> Someday — ${somedayTasks.length} task${somedayTasks.length !== 1 ? 's' : ''}`;
  header.addEventListener('click', () => {
    header.classList.toggle('open');
    list.style.display = header.classList.contains('open') ? '' : 'none';
    localStorage.setItem('cdx_someday_open', header.classList.contains('open') ? 'true' : 'false');
  });

  const list = document.createElement('div');
  list.className = 'someday-list';
  list.style.display = isOpen ? '' : 'none';

  let rowIdx = startIdx;
  somedayTasks.forEach(task => {
    const row = buildTaskRow(task, rowIdx++);
    // Add restore button
    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'someday-restore-btn';
    restoreBtn.textContent = '↑ Restore';
    restoreBtn.title = 'Move back to active tasks';
    restoreBtn.addEventListener('click', e => { e.stopPropagation(); restoreFromSomeday(task.id); });
    row.querySelector('.task-actions-group')?.prepend(restoreBtn);
    list.appendChild(row);
  });

  section.appendChild(header);
  section.appendChild(list);
  body.appendChild(section);
}

async function restoreFromSomeday(taskId) {
  await updateTask(taskId, { someday: false });
  showToast('Task restored to active list', 'success');
}

/* ═══════════════════════════════════════════════════════════
   DAILY RITUAL
═══════════════════════════════════════════════════════════ */
/* One-click re-entry: every overdue task moves to tomorrow. Reversible. */
async function rescheduleAllOverdue() {
  const today = localDateStr(new Date());
  const overdue = TASKS.filter(t => !t.done && t.dueDate && t.dueDate < today);
  if (!overdue.length) { showToast('no slipped orbits. all clear.', 'info'); return; }
  const tomorrow = localDateStr(new Date(Date.now() + 86400000));
  const previous = overdue.map(t => ({ id: t.id, dueDate: t.dueDate }));
  for (const t of overdue) await updateTask(t.id, { dueDate: tomorrow });
  showUndoToast(`${overdue.length} task${overdue.length > 1 ? 's' : ''} re-entered — tomorrow morning.`, async () => {
    for (const p of previous) await updateTask(p.id, { dueDate: p.dueDate });
  });
}

function computeMomentumScore() {
  // Habit streak contribution (up to 50pts)
  const today = localDateStr(new Date());
  let habitPts = 0;
  if (_habits.length > 0) {
    let streakSum = 0;
    _habits.forEach(h => {
      let streak = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const ds = localDateStr(d);
        if (_habitLogs[ds]?.completions?.[h.id]) streak++;
        else break;
      }
      streakSum += streak;
    });
    habitPts = Math.min(50, Math.round((streakSum / (_habits.length * 7)) * 50));
  }

  // Task completion today (up to 30pts)
  const doneTodayCount = TASKS.filter(t => t.done && t.doneDate === today).length;
  const taskPts = Math.min(30, doneTodayCount * 5);

  // Pending overdue penalty (−5 per overdue, max −20)
  const overduePenalty = Math.min(20, TASKS.filter(t => !t.done && t.dueDate && t.dueDate < today).length * 5);

  const score = Math.max(0, habitPts + taskPts - overduePenalty);
  return { score, habitPts, taskPts, overduePenalty };
}

function openDailyRitual() {
  if (new Date().getHours() >= 11) return; // only show before 11 AM
  const today = localDateStr(new Date());
  const last = localStorage.getItem('cdx_ritual_date');
  if (last === today) return; // already shown today
  if (document.querySelector('.overlay.open')) return; // don't bury active modals

  const overlay = document.getElementById('ritual-overlay');
  if (!overlay) return;

  // Set date label
  const dateLabel = document.getElementById('ritual-date-label');
  if (dateLabel) {
    const d = new Date();
    dateLabel.textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  // Show momentum score
  const { score, habitPts, taskPts, overduePenalty } = computeMomentumScore();
  const mWrap = document.getElementById('ritual-momentum-wrap');
  const mScore = document.getElementById('ritual-momentum-score');
  const mSub = document.getElementById('ritual-momentum-sub');
  if (mWrap && score > 0) {
    mWrap.style.display = '';
    if (mScore) mScore.textContent = score;
    if (mSub) {
      const parts = [];
      if (habitPts > 0) parts.push(`+${habitPts} habits`);
      if (taskPts > 0)  parts.push(`+${taskPts} tasks`);
      if (overduePenalty > 0) parts.push(`−${overduePenalty} overdue`);
      mSub.textContent = parts.join('  ·  ');
    }
  }

  overlay.classList.add('open');
  setTimeout(() => document.getElementById('ritual-focus-input')?.focus(), 300);
}

function initDailyRitual() {
  const overlay = document.getElementById('ritual-overlay');
  if (!overlay) return;

  let _ritualEnergy = '';

  // Energy buttons
  overlay.querySelectorAll('.ritual-energy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.ritual-energy-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _ritualEnergy = btn.dataset.energy;
    });
  });

  function closeRitual() {
    overlay.classList.remove('open');
    localStorage.setItem('cdx_ritual_date', localDateStr(new Date()));
  }

  document.getElementById('ritual-skip-btn')?.addEventListener('click', closeRitual);

  document.getElementById('ritual-start-btn')?.addEventListener('click', () => {
    const focus = document.getElementById('ritual-focus-input')?.value.trim();
    if (focus) localStorage.setItem('cdx_daily_focus', focus);
    if (_ritualEnergy) localStorage.setItem('cdx_daily_energy', _ritualEnergy);
    // Persist to the synced habitLogs doc (not localStorage-only) so the day's
    // focus + energy survive a cache clear and follow the user across devices.
    const uid = (typeof getHabitsUid === 'function') ? getHabitsUid() : null;
    if (uid && window.CDX_FB && window.CDX_DB && (focus || _ritualEnergy)) {
      const ds = localDateStr(new Date());
      if (typeof _habitLogs !== 'undefined') {
        _habitLogs[ds] = _habitLogs[ds] || { date: ds, completions: {} };
        if (focus) _habitLogs[ds].nonNegotiable = focus;
        if (_ritualEnergy) _habitLogs[ds].dailyEnergy = _ritualEnergy;
      }
      const { doc, setDoc } = window.CDX_FB;
      const payload = { date: ds };
      if (focus) payload.nonNegotiable = focus;
      if (_ritualEnergy) payload.dailyEnergy = _ritualEnergy;
      setDoc(doc(window.CDX_DB, 'users', uid, 'habitLogs', ds), payload, { merge: true })
        .catch(e => console.warn('daily ritual persist failed:', e.message));
    }
    closeRitual();
    showToast('Day started — ' + (focus ? `"${focus}"` : 'good luck!'), 'success', 4000);
  });

  document.getElementById('ritual-focus-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('ritual-start-btn')?.click();
  });
}

/* ═══════════════════════════════════════════════════════════
   RE-ENTRY SNAPSHOT MODAL
═══════════════════════════════════════════════════════════ */
let _reentryTaskId = null;

function openReentryModal(taskId) {
  const task = TASKS.find(t => t.id === taskId);
  if (!task) return;
  _reentryTaskId = taskId;
  const modal = document.getElementById('reentry-modal');
  if (!modal) return;
  const label = document.getElementById('reentry-task-label');
  if (label) label.textContent = task.title;
  const input = document.getElementById('reentry-snapshot-input');
  if (input) { input.value = task.reentrySnapshot || ''; input.focus(); }
  modal.classList.add('open');
}

function closeReentryModal() {
  document.getElementById('reentry-modal')?.classList.remove('open');
  _reentryTaskId = null;
}

function initReentryModal() {
  const modal = document.getElementById('reentry-modal');
  if (!modal) return;

  document.getElementById('reentry-close-btn')?.addEventListener('click', closeReentryModal);
  document.getElementById('reentry-skip-btn')?.addEventListener('click', closeReentryModal);

  document.getElementById('reentry-save-btn')?.addEventListener('click', async () => {
    if (!_reentryTaskId) return;
    const snapshot = document.getElementById('reentry-snapshot-input')?.value.trim();
    if (snapshot) {
      await updateTask(_reentryTaskId, { reentrySnapshot: snapshot });
      showToast('Snapshot saved', 'success');
    }
    closeReentryModal();
  });
}

/* ═══════════════════════════════════════════════════════════
   COMMIT MODE
═══════════════════════════════════════════════════════════ */
let _commitTaskId = null;
let _commitInterval = null;
let _commitElapsed = 0;
let _commitSnapshotShown = false;

function openCommitMode(taskId) {
  const task = TASKS.find(t => t.id === taskId);
  if (!task) return;

  _commitTaskId = taskId;
  _commitElapsed = 0;
  _commitSnapshotShown = false;

  const overlay = document.getElementById('commit-overlay');
  if (!overlay) return;

  const titleEl = document.getElementById('commit-task-title');
  if (titleEl) titleEl.textContent = task.title;

  const timerEl = document.getElementById('commit-timer');
  if (timerEl) timerEl.textContent = '00:00';

  const promptEl = document.getElementById('commit-snapshot-prompt');
  if (promptEl) promptEl.style.display = 'none';

  const snapshotInput = document.getElementById('commit-snapshot-input');
  if (snapshotInput) snapshotInput.value = '';

  overlay.classList.add('open');

  clearInterval(_commitInterval);
  _commitInterval = setInterval(() => {
    _commitElapsed++;
    const m = Math.floor(_commitElapsed / 60);
    const s = _commitElapsed % 60;
    if (timerEl) timerEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;

    // Show snapshot prompt at 10 minutes
    if (_commitElapsed === 600 && !_commitSnapshotShown) {
      _commitSnapshotShown = true;
      if (promptEl) promptEl.style.display = '';
    }
  }, 1000);
}

function closeCommitMode() {
  clearInterval(_commitInterval);
  _commitInterval = null;
  if (_commitTaskId && _commitElapsed > 0) {
    updateTask(_commitTaskId, { timeSpentSeconds: _commitElapsed });
  }
  _commitTaskId = null;
  document.getElementById('commit-overlay')?.classList.remove('open');
}

function initCommitMode() {
  const overlay = document.getElementById('commit-overlay');
  if (!overlay) return;

  document.getElementById('commit-exit-btn')?.addEventListener('click', () => {
    if (_commitTaskId) {
      openReentryModal(_commitTaskId);
    }
    closeCommitMode();
  });

  document.getElementById('commit-pause-btn')?.addEventListener('click', () => {
    if (_commitTaskId) openReentryModal(_commitTaskId);
    closeCommitMode();
  });

  document.getElementById('commit-done-btn')?.addEventListener('click', () => {
    const taskId = _commitTaskId;
    closeCommitMode();
    // Route through the mandatory close prompt (theme + logged time) instead of
    // silently completing — keeps focus-time attribution deliberate.
    if (taskId) handleCheckClick(taskId);
  });

  document.getElementById('commit-snapshot-save-btn')?.addEventListener('click', async () => {
    const snapshot = document.getElementById('commit-snapshot-input')?.value.trim();
    if (snapshot && _commitTaskId) {
      await updateTask(_commitTaskId, { reentrySnapshot: snapshot });
      showToast('Snapshot saved — keep going!', 'success');
    }
    const promptEl = document.getElementById('commit-snapshot-prompt');
    if (promptEl) promptEl.style.display = 'none';
  });
}

/* ═══════════════════════════════════════════════════════════
   FRICTION TAGGING MODAL
═══════════════════════════════════════════════════════════ */
let _frictionTaskId = null;
let _frictionReason = '';

function openFrictionModal(taskId) {
  const task = TASKS.find(t => t.id === taskId);
  if (!task) return;
  _frictionTaskId = taskId;
  _frictionReason = '';

  const modal = document.getElementById('friction-modal');
  if (!modal) return;

  const label = document.getElementById('friction-task-label');
  if (label) label.textContent = task.title;

  // Reset reasons
  modal.querySelectorAll('.friction-reason-btn').forEach(b => b.classList.remove('active'));

  modal.classList.add('open');
}

function closeFrictionModal() {
  document.getElementById('friction-modal')?.classList.remove('open');
  _frictionTaskId = null;
  _frictionReason = '';
}

function initFrictionModal() {
  const modal = document.getElementById('friction-modal');
  if (!modal) return;

  document.getElementById('friction-close-btn')?.addEventListener('click', closeFrictionModal);

  modal.querySelectorAll('.friction-reason-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.friction-reason-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _frictionReason = btn.dataset.reason;
    });
  });

  document.getElementById('friction-kill-btn')?.addEventListener('click', async () => {
    if (!_frictionTaskId) return;
    if (await cdxConfirm('Delete this task permanently?')) {
      await deleteTask(_frictionTaskId);
      closeFrictionModal();
    }
  });

  document.getElementById('friction-someday-btn')?.addEventListener('click', async () => {
    if (!_frictionTaskId) return;
    const updates = { someday: true };
    if (_frictionReason) updates.frictionReason = _frictionReason;
    await updateTask(_frictionTaskId, updates);
    showToast('Moved to Someday', 'info');
    closeFrictionModal();
  });

  document.getElementById('friction-keep-btn')?.addEventListener('click', async () => {
    if (!_frictionTaskId) return;
    // Reset deferral count + tag reason
    const updates = { deferrals: 0 };
    if (_frictionReason) updates.frictionReason = _frictionReason;
    await updateTask(_frictionTaskId, updates);
    showToast('Friction tagged — you\'ve got this', 'success');
    closeFrictionModal();
  });
}

/* ═══════════════════════════════════════════════════════════
   DONE WALL
═══════════════════════════════════════════════════════════ */
let _doneWallFilter = 'all';

function loadDoneWall() {
  _doneWallFilter = 'all';
  document.querySelectorAll('.done-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
  renderDoneWall();
}

function renderDoneWall() {
  const today = localDateStr(new Date());
  const startOfWeek = (() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); return localDateStr(d);
  })();
  const startOfMonth = today.slice(0, 7) + '-01';

  let tasks = TASKS.filter(t => t.done);
  if (_doneWallFilter === 'today')  tasks = tasks.filter(t => t.doneDate === today);
  if (_doneWallFilter === 'week')   tasks = tasks.filter(t => t.doneDate >= startOfWeek);
  if (_doneWallFilter === 'month')  tasks = tasks.filter(t => t.doneDate >= startOfMonth);

  // Stats
  const statsEl = document.getElementById('done-wall-stats');
  if (statsEl) {
    const totalDone = TASKS.filter(t => t.done).length;
    const todayDone = TASKS.filter(t => t.done && t.doneDate === today).length;
    const weekDone  = TASKS.filter(t => t.done && t.doneDate >= startOfWeek).length;
    // Habit streaks: longest active
    let maxStreak = 0;
    _habits.forEach(h => {
      let s = 0;
      for (let i = 0; i < 30; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        if (_habitLogs[localDateStr(d)]?.completions?.[h.id]) s++;
        else break;
      }
      if (s > maxStreak) maxStreak = s;
    });
    statsEl.innerHTML = `
      <div class="done-stat-card"><div class="done-stat-number">${totalDone}</div><div class="done-stat-label">All time</div></div>
      <div class="done-stat-card"><div class="done-stat-number">${weekDone}</div><div class="done-stat-label">This week</div></div>
      <div class="done-stat-card"><div class="done-stat-number">${todayDone}</div><div class="done-stat-label">Today</div></div>
      <div class="done-stat-card"><div class="done-stat-number">${maxStreak}</div><div class="done-stat-label">Best habit streak</div></div>`;
  }

  // Grid
  const grid = document.getElementById('done-grid');
  if (!grid) return;
  if (!tasks.length) {
    grid.innerHTML = `<div style="font-family:var(--font-mono);font-size:12px;color:var(--muted);text-align:center;padding:40px 0">Nothing here yet — go complete something!</div>`;
    return;
  }
  grid.innerHTML = tasks.map(task => {
    const cat = task.category ? CATEGORIES[task.category] : null;
    const catBadge = cat
      ? `<span style="font-family:var(--font-mono);font-size:10px;padding:1px 6px;border-radius:100px;background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44;white-space:nowrap">${cat.label}</span>`
      : '';
    const dateLabel = task.doneDate ? fmtDate(task.doneDate) : '';
    const timeBadge = task.timeSpentMinutes
      ? `<span style="font-family:var(--font-mono);font-size:10px;color:var(--neon);white-space:nowrap">⏱ ${task.timeSpentMinutes < 60 ? task.timeSpentMinutes + 'm' : (task.timeSpentMinutes / 60).toFixed(1) + 'h'}</span>`
      : '';
    return `<div class="done-card">
      <span style="font-family:var(--font-mono);font-size:10px;color:var(--neon);flex-shrink:0">✓</span>
      <span class="done-card-title">${escHtml(task.title)}</span>
      <div class="done-card-meta">${catBadge}${timeBadge}</div>
      ${dateLabel ? `<span class="done-card-date">${dateLabel}</span>` : ''}
    </div>`;
  }).join('');
}

function initDoneWall() {
  document.getElementById('done-filter-bar')?.addEventListener('click', e => {
    const btn = e.target.closest('.done-filter-btn');
    if (!btn) return;
    _doneWallFilter = btn.dataset.filter;
    document.querySelectorAll('.done-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === _doneWallFilter));
    renderDoneWall();
  });

  // Fold/unfold toggle
  let _doneWallFolded = false;
  const foldBtn = document.getElementById('done-wall-fold-btn');
  const wrap    = document.getElementById('done-grid-wrap');
  const header  = document.getElementById('done-wall-header');
  const toggle  = () => {
    _doneWallFolded = !_doneWallFolded;
    if (wrap) wrap.style.display = _doneWallFolded ? 'none' : '';
    if (foldBtn) foldBtn.textContent = _doneWallFolded ? '▼ unfold' : '▲ fold';
  };
  foldBtn?.addEventListener('click', e => { e.stopPropagation(); toggle(); });
  header?.addEventListener('click', toggle);

  // Insights viz tab switching
  window._insVizTab = window._insVizTab || 'pulse';
  document.querySelector('.ins-viz-tabs')?.addEventListener('click', e => {
    const btn = e.target.closest('.ins-viz-tab');
    if (!btn) return;
    window._insVizTab = btn.dataset.viz;
    document.querySelectorAll('.ins-viz-tab').forEach(b => b.classList.toggle('active', b.dataset.viz === window._insVizTab));
    if (typeof renderInsights === 'function') renderInsights();
  });
}

/* ── Teardown — call on signout to prevent listener leaks ── */
function cleanupAllListeners() {
  // Data collection listeners
  if (_tasksUnsub)       { _tasksUnsub();       _tasksUnsub       = null; }
  if (_calEventsUnsub)   { _calEventsUnsub();   _calEventsUnsub   = null; }
  if (_holidaysUnsub)    { _holidaysUnsub();    _holidaysUnsub    = null; }
  if (_listsUnsub)       { _listsUnsub();       _listsUnsub       = null; }
  if (_msProjUnsub)      { _msProjUnsub();      _msProjUnsub      = null; }
  if (_msEventsUnsub)    { _msEventsUnsub();    _msEventsUnsub    = null; }
  if (_msListsUnsub)     { _msListsUnsub();     _msListsUnsub     = null; }
  // Config listeners
  if (_catUnsub)         { _catUnsub();         _catUnsub         = null; }
  if (_peopleUnsub)      { _peopleUnsub();      _peopleUnsub      = null; }
  // Habits/routines/behaviour listeners
  if (_habitsUnsub)      { _habitsUnsub();      _habitsUnsub      = null; }
  if (_habitLogsUnsub)   { _habitLogsUnsub();   _habitLogsUnsub   = null; }
  if (_routinesUnsub)    { _routinesUnsub();    _routinesUnsub    = null; }
  if (_behavUnsub)       { _behavUnsub();       _behavUnsub       = null; }
  if (_hbSettingsUnsub)  { _hbSettingsUnsub();  _hbSettingsUnsub  = null; }
  if (_valuesUnsub)      { _valuesUnsub();      _valuesUnsub      = null; }
  if (_stacksUnsub)      { _stacksUnsub();      _stacksUnsub      = null; }
  // Intervals
  if (_calNowLineInterval) { clearInterval(_calNowLineInterval); _calNowLineInterval = null; }
  if (_cosmodexInterval)   { clearInterval(_cosmodexInterval);   _cosmodexInterval   = null; }
  // Reset global data state so a subsequent login starts clean
  TASKS = []; CAL_EVENTS = []; HOLIDAYS = {}; LISTS = [];
  MILESTONE_PROJECTS = []; MILESTONE_EVENTS = []; MILESTONE_LISTS = [];
  _values = []; _stacks = [];
  _listView = null;
}

window.addEventListener('cdx-auth-signout', () => {
  cleanupAllListeners();
});

/* ── Boot task system after auth ──────────────────────── */
window.addEventListener('cdx-auth-ready', () => {
  waitForFirebase(() => {
    // Subscribe to Firestore categories config
    const _catUser = window.CDX_USER;
    if (_catUser && window.CDX_FB && window.CDX_DB) {
      const { doc, onSnapshot } = window.CDX_FB;

      if (_catUnsub) { _catUnsub(); _catUnsub = null; }
      _catUnsub = onSnapshot(doc(window.CDX_DB, 'users', _catUser.uid, 'config', 'categories'), snap => {
        if (snap.exists()) {
          const data = snap.data();
          if (data?.categories && typeof data.categories === 'object' && Object.keys(data.categories).length) {
            // Firestore is the single source of truth: overwrite so deletions on
            // another device propagate here instead of resurrecting via merge.
            CATEGORIES = data.categories;
            saveCategoriesLocal();
            renderSettingsCatList?.();
            renderSettingsCats?.();
            rebuildCategorySelects?.();
          }
        }
      }, err => console.warn('Categories snapshot error:', err));

      // Subscribe to people config
      if (_peopleUnsub) { _peopleUnsub(); _peopleUnsub = null; }
      _peopleUnsub = onSnapshot(doc(window.CDX_DB, 'users', _catUser.uid, 'config', 'people'), snap => {
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data?.people)) {
            // Firestore is the single source of truth: overwrite so a person
            // deleted on another device isn't resurrected by a local-only merge.
            PEOPLE = data.people;
            localStorage.setItem('cdx_people', JSON.stringify(PEOPLE));
            renderSettingsPeople?.();
          }
        }
      }, err => console.warn('People snapshot error:', err));
    }
    // Rebuild selects with any custom categories loaded from localStorage
    rebuildCategorySelects();
    initData();
    initCalDropZones();
    initEventModal();
    initAddTaskForm();
    initTimePickerPopover();
    initScheduleModal();
    initTaskEditModal();
    initSettingsPanel();
    initCalNav();
    renderCalendar();
    initListsPage();
    initHabitsPage();
    initMilestonesPanel();
    initFocusBuckets();
    initOrbAddTask();
    initDailyRitual();
    initReentryModal();
    initCommitMode();
    initFrictionModal();
    initDoneWall();
    updateDashboardHero();
    // (Removed: the first-open "single focus for today" ritual prompt. Today's
    //  anchor is now captured on the dashboard, so the startup prompt is redundant.)
  });
}, { once: true });

/* ─────────────────────────────────────────────────────────────
   NOTES CANVAS
───────────────────────────────────────────────────────────── */
// Shared across Notes and Pomo scribble canvases
const SCRIB_COLORS = ['#f5f0e8','#c9a227','#6b9fd4','#6b8f5e','#c45c2a','#d4913a','#1a1510'];
const SCRIB_SIZES  = [1, 2, 4, 8, 16];
(function() {
  // SCRIB_COLORS and SCRIB_SIZES are global (defined above)
  let _notesInited = false;

  window.initNotesCanvas = function() {
    const cv = document.getElementById('notes-canvas');
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    function sizeCanvas() {
      const rect = cv.getBoundingClientRect();
      const w = rect.width || cv.offsetWidth || 700;
      const h = rect.height || cv.offsetHeight || 440;
      const tmp = document.createElement('canvas');
      tmp.width = cv.width; tmp.height = cv.height;
      tmp.getContext('2d').drawImage(cv, 0, 0);
      cv.width  = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.width  = w + 'px';
      cv.style.height = h + 'px';
      const ctx = cv.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.drawImage(tmp, 0, 0, w, h);
    }
    if (!_notesInited) {
      _notesInited = true;
      requestAnimationFrame(sizeCanvas);

      let color = SCRIB_COLORS[0], penSz = 2, eraser = false, drawing = false, lx = 0, ly = 0;

      // Pen size bar
      const penBar = document.getElementById('notes-pen-bar');
      SCRIB_SIZES.forEach(sz => {
        const b = document.createElement('button');
        b.className = 'pen-size-btn' + (sz === 2 ? ' active' : '');
        const dp = Math.min(sz + 4, 18);
        b.innerHTML = `<span style="width:${dp}px;height:${dp}px;border-radius:50%;background:currentColor;display:inline-block"></span>`;
        b.addEventListener('click', () => {
          penSz = sz; eraser = false;
          penBar.querySelectorAll('.pen-size-btn').forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          document.getElementById('notes-eraser-btn').classList.remove('active');
        });
        penBar.appendChild(b);
      });

      // Color swatches
      const colBar = document.getElementById('notes-color-bar');
      SCRIB_COLORS.forEach(c => {
        const s = document.createElement('div');
        s.className = 'scribble-swatch' + (c === color ? ' active' : '');
        s.style.background = c;
        s.addEventListener('click', () => {
          color = c; eraser = false;
          colBar.querySelectorAll('.scribble-swatch').forEach(x => x.classList.remove('active'));
          s.classList.add('active');
          document.getElementById('notes-eraser-btn').classList.remove('active');
        });
        colBar.appendChild(s);
      });

      document.getElementById('notes-eraser-btn').addEventListener('click', function() {
        eraser = !eraser; this.classList.toggle('active', eraser);
      });
      document.getElementById('notes-clear-btn').addEventListener('click', () => {
        cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
      });
      document.getElementById('notes-save-btn').addEventListener('click', () => {
        const link = document.createElement('a');
        const today = localDateStr(new Date());
        link.download = `cosmodex-notes-${today}.png`;
        const tmp = document.createElement('canvas');
        tmp.width = cv.width; tmp.height = cv.height;
        const tc = tmp.getContext('2d');
        tc.fillStyle = '#0e0c08';
        tc.fillRect(0, 0, tmp.width, tmp.height);
        tc.drawImage(cv, 0, 0);
        link.href = tmp.toDataURL('image/png'); link.click();
      });

      function getPos(e) {
        const r = cv.getBoundingClientRect();
        const sx = cv.width / dpr / r.width, sy = cv.height / dpr / r.height;
        return [(e.clientX - r.left) * sx, (e.clientY - r.top) * sy];
      }
      function startDraw(e) {
        e.preventDefault(); drawing = true; [lx, ly] = getPos(e);
        const ctx = cv.getContext('2d');
        ctx.save();
        if (eraser) { ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(lx, ly, penSz * 3, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,1)'; ctx.fill(); }
        else { ctx.beginPath(); ctx.arc(lx, ly, penSz / 2, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
        ctx.restore();
      }
      function moveDraw(e) {
        if (!drawing) return; e.preventDefault();
        const [x, y] = getPos(e);
        const ctx = cv.getContext('2d');
        ctx.save();
        if (eraser) { ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(x, y, penSz * 3, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,1)'; ctx.fill(); }
        else { ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(x, y); ctx.strokeStyle = color; ctx.lineWidth = penSz; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); }
        ctx.restore(); lx = x; ly = y;
      }
      function endDraw() { drawing = false; }
      cv.addEventListener('pointerdown',  startDraw, { passive: false });
      cv.addEventListener('pointermove',  moveDraw,  { passive: false });
      cv.addEventListener('pointerup',    endDraw,   { passive: false });
      cv.addEventListener('pointercancel',endDraw,   { passive: false });
    } else {
      requestAnimationFrame(sizeCanvas);
    }
  };
})();

/* ─────────────────────────────────────────────────────────────
   FOCUS / POMODORO
───────────────────────────────────────────────────────────── */
(function() {
  const PMIN = 1, PMAX = 90;

  let pomoDur = 25;
  const pomo = { running: false, totalSecs: 25 * 60, remainSecs: 25 * 60, interval: null, sessions: 0, _endTarget: 0 };
  let _breathInterval = null;
  const _breathPhases = ['Breathe in ↑', 'Hold', 'Breathe out ↓', 'Hold'];
  let _breathIdx = 0;
  let focusChecklist = [];

  function clamp(v) { return Math.max(PMIN, Math.min(PMAX, Math.round(v))); }

  function setDuration(v) {
    pomoDur = clamp(v);
    if (!pomo.running) { pomo.totalSecs = pomoDur * 60; pomo.remainSecs = pomoDur * 60; }
    const el = document.getElementById('pomo-sw-val'); if (el) el.textContent = String(pomoDur);
    buildTicks(); renderPomo();
  }

  function buildTicks() {
    const c = document.getElementById('pomo-ticks'); if (!c) return; c.innerHTML = '';
    for (let i = -12; i <= 12; i++) {
      const val = pomoDur + i, el = document.createElement('div');
      if (val < PMIN || val > PMAX) { el.style.width = '3px'; c.appendChild(el); continue; }
      el.className = 'pomo-tick' + (i === 0 ? ' current' : val % 5 === 0 ? ' major' : '');
      el.style.height = i === 0 ? '14px' : val % 5 === 0 ? '9px' : '5px';
      c.appendChild(el);
    }
  }

  function drawPomoRing() {
    const cv = document.getElementById('pomo-ring'); if (!cv) return;
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, R = W * 0.40;
    const lw = Math.max(6, W * 0.045);
    ctx.clearRect(0, 0, W, H);
    const frac = pomo.totalSecs > 0 ? pomo.remainSecs / pomo.totalSecs : 1;
    const sa = -Math.PI / 2, ea = sa + (1 - frac) * Math.PI * 2;
    // Track
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = lw; ctx.stroke();
    // Progress — design-system white glow
    if (frac < 1) {
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R, sa, ea);
      ctx.strokeStyle = pomo.running ? '#ffffff' : pomo.remainSecs < pomo.totalSecs ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.4)';
      ctx.lineWidth = lw; ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(255,255,255,0.55)'; ctx.shadowBlur = pomo.running ? 16 : 6;
      ctx.stroke();
      ctx.restore();
    }
  }

  function renderPomo() {
    const m = Math.floor(pomo.remainSecs / 60), s = pomo.remainSecs % 60;
    const tEl = document.getElementById('pomo-time');
    if (tEl) tEl.textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
    const phEl = document.getElementById('pomo-phase');
    if (phEl) phEl.textContent = pomo.running ? 'Focusing' : pomo.remainSecs === 0 ? 'Complete ✓' : pomo.remainSecs < pomo.totalSecs ? 'Paused' : 'Ready';
    const startBtn = document.getElementById('pomo-start');
    if (startBtn) startBtn.textContent = pomo.running ? 'Pause' : pomo.remainSecs > 0 && pomo.remainSecs < pomo.totalSecs ? 'Resume' : 'Start';
    document.querySelectorAll('.pomo-sess-dot').forEach((d, i) => d.classList.toggle('done', i < pomo.sessions));
    const sw = document.querySelector('.pomo-swipe-section');
    if (sw) { sw.style.opacity = pomo.running ? '0.4' : '1'; sw.style.pointerEvents = pomo.running ? 'none' : 'auto'; }
    if (!pomo.running) document.getElementById('pomo-lock-msg')?.classList.remove('show');
    drawPomoRing();
  }

  function startBreathing() {
    _breathIdx = 0;
    const el = document.getElementById('pomo-breath-phase'); if (el) el.textContent = _breathPhases[0];
    clearInterval(_breathInterval);
    _breathInterval = setInterval(() => {
      _breathIdx = (_breathIdx + 1) % 4;
      const el = document.getElementById('pomo-breath-phase'); if (el) el.textContent = _breathPhases[_breathIdx];
    }, 4000);
  }
  function stopBreathing() { clearInterval(_breathInterval); _breathInterval = null; }

  function renderFocusChecklist() {
    const el = document.getElementById('pomo-check-items'); if (!el) return;
    el.innerHTML = '';
    focusChecklist.forEach((item, i) => {
      const div = document.createElement('div');
      div.className = 'pomo-check-item' + (item.done ? ' done' : '');
      div.innerHTML = `<div class="pomo-check-box">${item.done ? '✓' : ''}</div><span class="pomo-check-txt">${escHtml(item.text)}</span>`;
      div.querySelector('.pomo-check-box').addEventListener('click', () => {
        focusChecklist[i].done = !focusChecklist[i].done; renderFocusChecklist();
      });
      el.appendChild(div);
    });
  }

  let _pomoEvent = null; // active calendar event (set when opened from calendar)

  window.setPomoEvent = function(ev) {
    _pomoEvent = ev || null;
    if (ev && ev.duration) {
      const mins = Math.max(1, Math.round(ev.duration));
      setDuration(mins);
    }
    // Show/hide delete event button (only for real calendar events, not task-only focus)
    const delBtn = document.getElementById('pomo-del-event-btn');
    if (delBtn) delBtn.style.display = (_pomoEvent && !_pomoEvent._taskOnly) ? 'inline-flex' : 'none';
    // Hide completion prompt when opening fresh
    const prompt = document.getElementById('pomo-complete-prompt');
    if (prompt) prompt.style.display = 'none';
  };

  // Focus-task picker: today's open tasks by default, search across all uncompleted.
  function _pomoRenderTaskList(query) {
    const listEl = document.getElementById('pomo-task-list');
    const lblEl  = document.getElementById('pomo-tasks-lbl');
    if (!listEl) return;
    const q = (query || '').trim().toLowerCase();
    const today = localDateStr(new Date());
    let tasks;
    if (q) { tasks = TASKS.filter(t => !t.done && (t.title || '').toLowerCase().includes(q)).slice(0, 25); if (lblEl) lblEl.textContent = 'SEARCH · UNCOMPLETED'; }
    else   { tasks = TASKS.filter(t => !t.done && t.dueDate === today);                                   if (lblEl) lblEl.textContent = "FOCUS TASK · TODAY"; }
    const activeId = _pomoEvent && _pomoEvent.taskId;
    if (!tasks.length) {
      listEl.innerHTML = `<div class="pomo-task-empty">${q ? 'No matching open tasks' : 'Nothing due today — search to pick a task'}</div>`;
      return;
    }
    listEl.innerHTML = tasks.map(t => {
      const cat = t.category ? CATEGORIES[t.category] : null;
      return `<div class="pomo-task-item${t.id === activeId ? ' active' : ''}" data-pomo-task="${escAttr(t.id)}">
        <span class="pomo-task-dot" style="background:${getCatColor(t.category)}"></span>
        <span class="pomo-task-title">${escHtml(t.title)}</span>
        ${cat ? `<span class="pomo-task-cat">${escHtml(cat.label.toUpperCase())}</span>` : ''}
        ${t.id === activeId ? '<span class="pomo-task-live">● FOCUS</span>' : ''}
      </div>`;
    }).join('');
    listEl.querySelectorAll('[data-pomo-task]').forEach(el => el.onclick = () => {
      const t = TASKS.find(x => x.id === el.dataset.pomoTask); if (t) _pomoSelectTask(t);
    });
  }

  function _pomoSelectTask(task) {
    _pomoEvent = task ? { taskId: task.id, title: task.title, _taskOnly: true } : null;
    const titleEl = document.getElementById('pomo-ev-title');
    if (titleEl) titleEl.textContent = task ? task.title : '—';
    const nameEl = document.getElementById('pomo-focusname');
    if (nameEl) nameEl.textContent = task ? task.title : 'No task — free focus';
    const delBtn = document.getElementById('pomo-del-event-btn');
    if (delBtn) delBtn.style.display = 'none';
    _pomoRenderTaskList(document.getElementById('pomo-task-search')?.value || '');
  }

  // Commit ritual → Begin hands off here: set task + duration and reset to a fresh session.
  window.setPomoTask = function(task, durMins) {
    if (durMins) setDuration(durMins);
    clearInterval(pomo.interval); pomo.running = false;
    pomo.totalSecs = pomoDur * 60; pomo.remainSecs = pomoDur * 60;
    _pomoSelectTask(task || null);
    renderPomo();
  };
  window.setPomoTitle = function(title) {
    _pomoEvent = title ? { title, _taskOnly: true } : null;
    const titleEl = document.getElementById('pomo-ev-title');
    if (titleEl) titleEl.textContent = title || '—';
    const nameEl = document.getElementById('pomo-focusname');
    if (nameEl) nameEl.textContent = title || 'No task — free focus';
  };

  window.initPomoOverlay = function() {
    buildTicks(); renderPomo(); startBreathing(); renderFocusChecklist();
    // Focus-task picker: default to today's tasks; search picks other open tasks.
    _pomoRenderTaskList('');
    const searchEl = document.getElementById('pomo-task-search');
    if (searchEl && !searchEl.dataset.wired) { searchEl.dataset.wired = '1'; searchEl.addEventListener('input', e => _pomoRenderTaskList(e.target.value)); }
    // Reset completion prompt
    const prompt = document.getElementById('pomo-complete-prompt');
    if (prompt) prompt.style.display = 'none';
    // Wire delete event button
    const delBtn = document.getElementById('pomo-del-event-btn');
    if (delBtn) {
      delBtn.style.display = (_pomoEvent && !_pomoEvent._taskOnly) ? 'inline-flex' : 'none';
      delBtn.onclick = async () => {
        if (!_pomoEvent) return;
        if (!await cdxConfirm(`Delete event "${_pomoEvent.title}"?`)) return;
        const { deleteDoc } = window.CDX_FB;
        const ev = _pomoEvent;
        try {
          await deleteDoc(_ud('calEvents', ev.id));
          // Keep parity with the event-modal delete: unschedule the linked task (don't orphan its calEventId)
          const linkedTask = ev.taskId ? TASKS.find(t => t.id === ev.taskId) : TASKS.find(t => t.calEventId === ev.id);
          if (linkedTask) await updateTask(linkedTask.id, { calEventId: null });
        } catch(e) {}
        _pomoEvent = null; delBtn.style.display = 'none';
        showToast('Event deleted', 'success');
      };
    }
  };

  // Duration swipe
  let swX = null, swDur = null;
  const swTrack = document.getElementById('pomo-sw-track');
  if (swTrack) {
    swTrack.addEventListener('pointerdown', e => { swX = e.clientX; swDur = pomoDur; swTrack.setPointerCapture(e.pointerId); e.preventDefault(); });
    swTrack.addEventListener('pointermove', e => { if (swX === null) return; setDuration(swDur + Math.round((e.clientX - swX) / 12)); });
    swTrack.addEventListener('pointerup',   () => swX = null);
    swTrack.addEventListener('pointercancel', () => swX = null);
    swTrack.addEventListener('wheel', e => { e.preventDefault(); setDuration(pomoDur + (e.deltaY > 0 ? -1 : 1)); }, { passive: false });
  }
  document.getElementById('pomo-sw-minus')?.addEventListener('click', () => setDuration(pomoDur - 1));
  document.getElementById('pomo-sw-plus')?.addEventListener('click',  () => setDuration(pomoDur + 1));

  // Start / Pause
  document.getElementById('pomo-start')?.addEventListener('click', () => {
    if (pomo.running) {
      clearInterval(pomo.interval); pomo.running = false;
    } else {
      if (pomo.remainSecs === 0) { pomo.totalSecs = pomoDur * 60; pomo.remainSecs = pomoDur * 60; }
      pomo.running = true;
      pomo._endTarget = Date.now() + pomo.remainSecs * 1000;
      pomo.interval = setInterval(() => {
        pomo.remainSecs = Math.max(0, Math.round((pomo._endTarget - Date.now()) / 1000));
        if (pomo.remainSecs <= 0) {
          clearInterval(pomo.interval); pomo.running = false; pomo.remainSecs = 0;
          pomo.sessions = Math.min(4, pomo.sessions + 1);
          stopBreathing();
          document.getElementById('pomo-lock-msg')?.classList.remove('show');
          // Completion chime
          try { const ac = new (window.AudioContext || window.webkitAudioContext)(); [0, 0.35, 0.7].forEach((t, i) => { const osc = ac.createOscillator(), g = ac.createGain(); osc.connect(g); g.connect(ac.destination); osc.frequency.value = [528,660,792][i]; g.gain.value = 0.18; osc.start(ac.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.9); osc.stop(ac.currentTime + t + 0.9); }); } catch(e) {}
          // Show task completion prompt if there's a linked task
          const elapsedSecs = pomo.totalSecs;
          const promptEl = document.getElementById('pomo-complete-prompt');
          if (promptEl && _pomoEvent?.taskId) {
            promptEl.style.display = 'block';
            document.getElementById('pomo-done-yes').onclick = () => {
              promptEl.style.display = 'none';
              // Route through the mandatory close prompt (theme + logged time)
              const tid = _pomoEvent?.taskId;
              if (tid) handleCheckClick(tid);
            };
            document.getElementById('pomo-done-no').onclick = () => { promptEl.style.display = 'none'; };
          }
        }
        renderPomo();
      }, 500);
    }
    renderPomo();
  });

  // Reset
  document.getElementById('pomo-reset')?.addEventListener('click', () => {
    clearInterval(pomo.interval); pomo.running = false;
    pomo.totalSecs = pomoDur * 60; pomo.remainSecs = pomoDur * 60;
    renderPomo();
  });

  // Leave — pomo is a page now; return to the dashboard.
  document.getElementById('pomo-close')?.addEventListener('click', () => {
    stopBreathing(); showMainPanel('default');
  });
  // Withdraw: reset timer state without closing any overlay
  document.getElementById('pomo-withdraw')?.addEventListener('click', () => {
    clearInterval(pomo.interval); pomo.running = false;
    pomo.totalSecs = pomoDur * 60; pomo.remainSecs = pomoDur * 60;
    renderPomo(); stopBreathing();
    document.getElementById('pomo-lock-msg')?.classList.remove('show');
  });

  // Checklist
  function addCheckItem() {
    const inp = document.getElementById('pomo-check-input'); if (!inp) return;
    const text = inp.value.trim(); if (!text) return;
    focusChecklist.push({ text, done: false }); inp.value = ''; renderFocusChecklist();
  }
  document.getElementById('pomo-check-add-btn')?.addEventListener('click', addCheckItem);
  document.getElementById('pomo-check-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') addCheckItem(); });

  // Floating pomo panel collapse/expand
  let _pomoCollapsed = localStorage.getItem('cosmodex_pomo_collapsed') === '1';
  function togglePomoCol() {
    const panel = document.getElementById('td-pomo-float');
    if (!panel) return;
    _pomoCollapsed = !_pomoCollapsed;
    panel.classList.toggle('pf-collapsed', _pomoCollapsed);
    localStorage.setItem('cosmodex_pomo_collapsed', _pomoCollapsed ? '1' : '0');
  }
  if (_pomoCollapsed) {
    document.getElementById('td-pomo-float')?.classList.add('pf-collapsed');
  }
  document.getElementById('td-pomo-toggle')?.addEventListener('click', togglePomoCol);
})();


/* ══ KINETIC: Bubble time-drag — spin the day dial to preview any hour ══ */
(function initOrbTimeDrag() {
  const cvs = document.getElementById('cosmodex-canvas');
  if (!cvs) return;
  window._orbTimeOffset = 0;
  let drag = null, springRaf = null;

  const center = () => {
    const r = cvs.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  cvs.addEventListener('pointerdown', e => {
    if (!orb.classList.contains('expanded')) return;
    if (springRaf) { cancelAnimationFrame(springRaf); springRaf = null; }
    const c = center();
    drag = { lastA: Math.atan2(e.clientY - c.y, e.clientX - c.x), c };
    try { cvs.setPointerCapture(e.pointerId); } catch {}
    cvs.classList.add('orb-dragging');
  });
  cvs.addEventListener('pointermove', e => {
    if (!drag) return;
    const a = Math.atan2(e.clientY - drag.c.y, e.clientX - drag.c.x);
    let dA = a - drag.lastA;
    if (dA > Math.PI) dA -= Math.PI * 2;
    if (dA < -Math.PI) dA += Math.PI * 2;
    drag.lastA = a;
    drag.moved = (drag.moved || 0) + Math.abs(dA);
    // full turn of the dial = 24 h; clamp preview to ±48 h
    window._orbTimeOffset = Math.max(-172800e3, Math.min(172800e3,
      window._orbTimeOffset + (dA / (Math.PI * 2)) * 86400e3));
    drawCosmodex();
  });
  const endDrag = () => {
    if (!drag) return;
    const wasSpin = (drag.moved || 0) > 0.02;
    drag = null;
    cvs.classList.remove('orb-dragging');
    if (!wasSpin) { window._orbTimeOffset = 0; drawCosmodex(); return; } // plain click: petal taps still work
    const from = window._orbTimeOffset, t0 = performance.now(), D = 700;
    const spring = () => {
      const p = Math.min(1, (performance.now() - t0) / D);
      window._orbTimeOffset = from * (1 - (1 - Math.pow(1 - p, 3)));
      drawCosmodex();
      springRaf = p < 1 ? requestAnimationFrame(spring) : null;
    };
    spring();
  };
  cvs.addEventListener('pointerup', endDrag);
  cvs.addEventListener('pointercancel', endDrag);
})();

/* ══════════════════════════════════════════════════════════════════════
   TASKS PAGE — full "every task you've captured" view (left-nav "Tasks").
   Reuses the dashboard's buildTaskRow() + shared task-list event wiring, so
   rows behave exactly like the Today list. Timeboxing (drag-to-schedule) is
   intentionally disabled here — this page is for triage, not calendar work.
   Chrome (filter pills, search, sort, inline add) follows the design kit.
   ══════════════════════════════════════════════════════════════════════ */
let _atkFilter = 'all';
let _atkSort   = 'smart';
let _atkQuery  = '';

const _ATK_FILTERS = [
  { id:'all',     label:'All',       match: () => true },
  { id:'today',   label:'Today',     match: (t, today) => !t.done && !t.someday && t.dueDate === today },
  { id:'week',    label:'This week', match: (t, today, wk) => !t.done && !t.someday && t.dueDate && t.dueDate >= today && t.dueDate <= wk },
  { id:'overdue', label:'Overdue',   match: (t, today) => !t.done && !t.someday && t.dueDate && t.dueDate < today },
  { id:'recur',   label:'Recurring', match: (t) => !!t.recurrence },
  { id:'someday', label:'Someday',   match: (t) => !t.done && !!t.someday },
  { id:'done',    label:'Done',      match: (t) => t.done },
];
const _ATK_SORTS = [
  { id:'smart',   label:'Smart' },
  { id:'due',     label:'Due' },
  { id:'created', label:'Created' },
  { id:'prio',    label:'Priority' },
];
const _ATK_PRIO_RANK = { high: 0, med: 1, low: 2 };

function _atkCreatedMs(t) {
  if (!t.createdAt) return 0;
  return t.createdAt.toDate ? t.createdAt.toDate().getTime() : new Date(t.createdAt).getTime();
}

function _atkMatch(fid, t, today, wk) {
  const f = _ATK_FILTERS.find(x => x.id === fid) || _ATK_FILTERS[0];
  return f.match(t, today, wk);
}

// Build the static page chrome once; the list re-renders on filter/search/sort.
function renderTasksPage() {
  const panel = document.getElementById('panel-alltasks');
  if (!panel) return;
  if (!document.getElementById('alltasks-body')) {
    panel.innerHTML = `
      <div class="atk-layout">
        <div class="atk-main">
          <div class="atk-scroll">
            <div class="atk-head">
              <div>
                <div class="atk-eyebrow" id="atk-count-line">TASKS</div>
                <div class="atk-title">Tasks</div>
                <div class="atk-sub">Everything you've captured — one list, one truth.</div>
              </div>
            </div>
            <div class="atk-filters" id="atk-filters"></div>
            <div class="atk-searchsort">
              <div class="atk-search">
                <span class="atk-search-ic">⌕</span>
                <input id="atk-search-input" placeholder="Search every task you've captured…" autocomplete="off">
                <span class="atk-shown" id="atk-shown"></span>
              </div>
              <div class="atk-sortwrap">
                <span class="atk-eyebrow">SORT</span>
                <div class="atk-sort" id="atk-sort"></div>
              </div>
            </div>
            <div class="atk-add">
              <span class="atk-add-plus">+</span>
              <input id="atk-add-input" placeholder="Capture a task… press Enter to add" autocomplete="off">
              <span class="atk-eyebrow">ENTER ↵</span>
            </div>
            <div class="atk-colhead">
              <span></span><span></span>
              <span>Task</span><span>List</span><span>Due</span><span>Category</span>
              <span style="text-align:right">Prio</span>
            </div>
            <div class="atk-list" id="alltasks-body"></div>
          </div>
        </div>
        <aside class="atk-detail" id="atk-detail"></aside>
      </div>`;

    // Sort toggle
    document.getElementById('atk-sort').innerHTML = _ATK_SORTS.map(s =>
      `<button class="atk-sort-btn" data-atk-sort="${s.id}">${s.label}</button>`).join('');
    document.getElementById('atk-sort').addEventListener('click', e => {
      const b = e.target.closest('[data-atk-sort]'); if (!b) return;
      _atkSort = b.dataset.atkSort; renderAllTasksList();
    });
    // Filter pills (delegated)
    document.getElementById('atk-filters').addEventListener('click', e => {
      const b = e.target.closest('[data-atk-filter]'); if (!b) return;
      _atkFilter = b.dataset.atkFilter; renderAllTasksList();
    });
    // Search
    document.getElementById('atk-search-input').addEventListener('input', e => {
      _atkQuery = e.target.value; renderAllTasksList();
    });
    // Inline add — reuse the app's addTask()
    const addInput = document.getElementById('atk-add-input');
    addInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && addInput.value.trim()) {
        addTask(addInput.value.trim());
        addInput.value = '';
      }
    });
  }
  renderAllTasksList();
  renderAtkDetail();
}

function renderAllTasksList() {
  const body = document.getElementById('alltasks-body');
  if (!body) return;
  const today = localDateStr(new Date());
  const wkDate = new Date(); wkDate.setDate(wkDate.getDate() + 6);
  const wk = localDateStr(wkDate);
  const q = _atkQuery.trim().toLowerCase();

  // Counts per filter (over all tasks, ignoring category visibility — one truth)
  const counts = {};
  _ATK_FILTERS.forEach(f => { counts[f.id] = TASKS.filter(t => _atkMatch(f.id, t, today, wk)).length; });

  // Filter pills
  const filtersEl = document.getElementById('atk-filters');
  if (filtersEl) filtersEl.innerHTML = _ATK_FILTERS.map(f =>
    `<button class="atk-pill${_atkFilter === f.id ? ' active' : ''}" data-atk-filter="${f.id}">${f.label}<span class="atk-pill-n">${counts[f.id]}</span></button>`).join('');
  // Sort active state
  document.querySelectorAll('#atk-sort .atk-sort-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.atkSort === _atkSort));

  // Apply filter + search
  let rows = TASKS.filter(t => _atkMatch(_atkFilter, t, today, wk));
  if (q) rows = rows.filter(t =>
    (t.title || '').toLowerCase().includes(q) ||
    (t.category ? (CATEGORIES[t.category]?.label || t.category) : '').toLowerCase().includes(q));

  // Sort
  const dueKey = t => t.dueDate || '9999-99-99';
  if (_atkSort === 'due')          rows = [...rows].sort((a, b) => dueKey(a).localeCompare(dueKey(b)));
  else if (_atkSort === 'created') rows = [...rows].sort((a, b) => _atkCreatedMs(b) - _atkCreatedMs(a));
  else if (_atkSort === 'prio')    rows = [...rows].sort((a, b) => (_ATK_PRIO_RANK[a.priority] ?? 3) - (_ATK_PRIO_RANK[b.priority] ?? 3));
  else /* smart */                 rows = [...rows].sort((a, b) =>
    (a.done - b.done) || (dueKey(a).localeCompare(dueKey(b))) || ((_ATK_PRIO_RANK[a.priority] ?? 3) - (_ATK_PRIO_RANK[b.priority] ?? 3)));

  // Header counts + shown
  const openCount = TASKS.filter(t => !t.done).length;
  const countLine = document.getElementById('atk-count-line');
  if (countLine) countLine.textContent = `${TASKS.length} CAPTURED · ${openCount} OPEN`;
  const shownEl = document.getElementById('atk-shown');
  if (shownEl) shownEl.textContent = `${rows.length} SHOWN`;

  // Render design-kit tabular rows (checkbox · dot · title · list · due · cat · prio)
  const projMap = _buildTaskToProjectMap();
  body.innerHTML = '';
  if (!rows.length) {
    body.innerHTML = `<div class="atk-empty">— None —<br><span>Nothing matches this filter</span></div>`;
    return;
  }
  rows.forEach(task => body.appendChild(buildAtkRow(task, projMap, today)));
}

/* ── Tabular row + detail drawer (design-kit Tasks.jsx) ───────────────────
   The Tasks page uses its own clean row/grid + a right-hand detail drawer,
   distinct from the dashboard's rich stacked rows. Real task fields map to
   the design's columns; the drawer surfaces status/notes/subtasks/actions. */
let _atkSelectedId = null;

function _recurLabel(r) {
  if (!r) return '';
  const m = { daily:'Daily', weekdays:'Weekdays', weekly:'Weekly', monthly:'Monthly', yearly:'Yearly' };
  if (m[r]) return m[r];
  return r.startsWith('custom:') ? r.replace('custom:', '') : r;
}

function _atkRelTime(task) {
  const ms = _atkCreatedMs(task);
  if (!ms) return '';
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1)  return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)  return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7)    return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5)    return `${w}w ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12)  return `${mo}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

function _atkPrioLevel(p) { return p === 'high' ? 3 : p === 'med' ? 2 : p === 'low' ? 1 : 0; }
function _atkPrioDots(p) {
  const lvl = _atkPrioLevel(p);
  return [1,2,3].map(i => `<span class="atk-dot${i <= lvl ? ' on' : ''}"></span>`).join('');
}

function buildAtkRow(task, projMap, today) {
  const row = document.createElement('div');
  row.className = 'atk-row' + (task.id === _atkSelectedId ? ' sel' : '') + (task.done ? ' done' : '');
  row.dataset.taskId = task.id;

  const cat       = task.category ? CATEGORIES[task.category] : null;
  const catClr    = getCatColor(task.category);
  const proj      = projMap[task.id];
  const isOverdue = task.dueDate && task.dueDate < today && !task.done;

  const recur   = task.recurrence ? `<span class="atk-tel">↻ ${escHtml(_recurLabel(task.recurrence).toUpperCase())}</span>` : '';
  const note    = task.notes ? `<span class="atk-tel">✎ NOTE</span>` : '';
  const created = _atkCreatedMs(task) ? `<span class="atk-tel dim">${escHtml(_atkRelTime(task).toUpperCase())}</span>` : '';

  const dueCell = task.dueDate
    ? `<span class="atk-due${isOverdue ? ' overdue' : ''}">${isOverdue ? '△ ' : ''}${escHtml(fmtDate(task.dueDate).toUpperCase())}</span>`
    : (task.someday ? `<span class="atk-due someday">SOMEDAY</span>` : `<span class="atk-dash">—</span>`);

  row.innerHTML = `
    <div class="atk-check${task.done ? ' done' : ''}" data-atk-check="${escAttr(task.id)}">${task.done ? '✓' : ''}</div>
    <span class="atk-catdot" style="${cat ? `background:${catClr};box-shadow:0 0 6px ${catClr}88` : 'background:transparent;border:1px solid rgba(255,255,255,.15)'}"></span>
    <div class="atk-titlecell">
      <div class="atk-rtitle${task.done ? ' done' : ''}">${escHtml(task.title)}</div>
      <div class="atk-rmeta">${recur}${note}${created}</div>
    </div>
    <span class="atk-tel list"${proj ? ` style="color:${proj.projectColor}"` : ''}>${proj ? escHtml(proj.projectTitle) : '<span class="atk-dash">—</span>'}</span>
    <div class="atk-duecell">${dueCell}</div>
    <span class="atk-tel">${cat ? escHtml(cat.label.toUpperCase()) : '<span class="atk-dash">—</span>'}</span>
    <div class="atk-priocell">${_atkPrioDots(task.priority)}</div>`;

  row.addEventListener('click', e => {
    if (e.target.closest('[data-atk-check]')) return;
    openAtkDetail(task.id);
  });
  row.querySelector('[data-atk-check]').addEventListener('click', e => {
    e.stopPropagation();
    // Completing routes through the theme/time prompt; reopening skips it
    if (task.done) toggleTask(task.id); else handleCheckClick(task.id, e);
  });
  return row;
}

function openAtkDetail(taskId) {
  _atkSelectedId = taskId;
  renderAllTasksList();
  renderAtkDetail();
}

function renderAtkDetail() {
  const el = document.getElementById('atk-detail');
  if (!el) return;
  const task = TASKS.find(t => t.id === _atkSelectedId);
  if (!task) {
    _atkSelectedId = null;
    el.classList.remove('open');
    el.innerHTML = `<div class="atk-detail-empty"><div class="atk-detail-empty-mark">✦</div><div>Select a task<br><span>to see its full context</span></div></div>`;
    return;
  }
  el.classList.add('open');

  const cat     = task.category ? CATEGORIES[task.category] : null;
  const catClr  = getCatColor(task.category);
  const proj    = _buildTaskToProjectMap()[task.id];
  const dueTxt  = task.dueDate ? fmtDate(task.dueDate) : (task.someday ? 'Someday' : '—');
  const recurTxt= task.recurrence ? _recurLabel(task.recurrence) : '—';
  const created = _atkCreatedMs(task) ? _atkRelTime(task) : '—';
  const prioTxt = task.priority ? task.priority.toUpperCase() : '—';

  const subs = task.subtasks || [];
  const subsHtml = subs.length
    ? subs.map(s => `<div class="atk-sub-item">
        <div class="atk-subcheck${s.done ? ' done' : ''}" data-atk-subcheck="${escAttr(s.id)}">${s.done ? '✓' : ''}</div>
        <span class="${s.done ? 'done' : ''}">${escHtml(s.title)}</span></div>`).join('')
    : `<div class="atk-subs-empty">— None —</div>`;

  const eyebrow = `${cat ? escHtml(cat.label.toUpperCase()) : 'NO CATEGORY'}${proj ? ' · ' + escHtml(proj.projectTitle.toUpperCase()) : ''}`;

  el.innerHTML = `
    <div class="atk-detail-head">
      <div class="atk-detail-topline">
        <span class="atk-catdot" style="${cat ? `background:${catClr};box-shadow:0 0 6px ${catClr}88` : 'background:transparent;border:1px solid rgba(255,255,255,.15)'}"></span>
        <span class="atk-tel atk-prio-click" data-atk-edit title="Click to edit category">${eyebrow}</span>
        <div style="flex:1"></div>
        <button class="atk-detail-x" data-atk-close>×</button>
      </div>
      <div class="atk-detail-title${task.done ? ' done' : ''}">${escHtml(task.title)}</div>
    </div>
    <div class="atk-detail-body">
      <div>
        <div class="atk-eyebrow" style="margin-bottom:8px">STATUS</div>
        <button class="atk-status-btn${task.done ? ' done' : ''}" data-atk-toggle>${task.done ? '✓ Done — reopen' : '● Mark done'}</button>
      </div>
      <div class="atk-detail-grid">
        <div><div class="atk-eyebrow">DUE</div><div class="atk-detail-val atk-prio-click" data-atk-edit title="Click to edit">${escHtml(dueTxt)}</div></div>
        <div><div class="atk-eyebrow">RECURRENCE</div><div class="atk-detail-val atk-prio-click" data-atk-edit title="Click to edit">↻ ${escHtml(recurTxt)}</div></div>
        <div><div class="atk-eyebrow">PRIORITY</div><div class="atk-detail-val atk-prio-click" data-atk-prio title="Click to cycle"><span class="atk-priocell inline">${_atkPrioDots(task.priority)}</span> ${prioTxt}</div></div>
        <div><div class="atk-eyebrow">CREATED</div><div class="atk-detail-val">${escHtml(created)}</div></div>
      </div>
      <div>
        <div class="atk-eyebrow" style="margin-bottom:8px">NOTES</div>
        <textarea class="atk-notes" data-atk-notes placeholder="No notes yet…">${escHtml(task.notes || '')}</textarea>
      </div>
      <div>
        <div class="atk-eyebrow" style="margin-bottom:8px">SUBTASKS</div>
        <div class="atk-subs">${subsHtml}</div>
        <input class="atk-subadd" data-atk-subadd placeholder="Add subtask… press Enter" autocomplete="off">
      </div>
    </div>
    <div class="atk-detail-foot">
      <button class="atk-foot-btn" data-atk-edit>✎ Edit</button>
      ${task.done ? '' : '<button class="atk-foot-btn" data-atk-focus>◉ Focus</button>'}
      <button class="atk-foot-btn" data-atk-sched>☷ Schedule</button>
      <button class="atk-foot-btn" data-atk-dup title="Duplicate this task">⧉ Duplicate</button>
      <button class="atk-foot-btn danger" data-atk-del title="Delete task">🗑 Delete</button>
    </div>`;

  el.querySelector('[data-atk-close]').onclick = () => { _atkSelectedId = null; renderAllTasksList(); renderAtkDetail(); };
  el.querySelectorAll('[data-atk-edit]').forEach(b => b.onclick = () => openTaskEditModal(task.id));
  el.querySelector('[data-atk-toggle]').onclick = (e) => {
    // Reopening skips the prompt; completing routes through the theme/time popover
    if (task.done) toggleTask(task.id); else handleCheckClick(task.id, e);
  };
  el.querySelector('[data-atk-prio]').onclick = () => {
    const order = ['high', 'med', 'low'];
    const next = order[(order.indexOf(task.priority) + 1) % order.length];
    updateTask(task.id, { priority: next });
  };
  const notes = el.querySelector('[data-atk-notes]');
  notes.addEventListener('blur', () => {
    if ((task.notes || '') !== notes.value) updateTask(task.id, { notes: notes.value });
  });
  el.querySelectorAll('[data-atk-subcheck]').forEach(c =>
    c.onclick = () => toggleSubtask(task.id, c.dataset.atkSubcheck));
  const subAdd = el.querySelector('[data-atk-subadd]');
  subAdd.addEventListener('keydown', e => {
    if (e.key === 'Enter' && subAdd.value.trim()) { addSubtask(task.id, subAdd.value.trim()); subAdd.value = ''; }
  });
  const focusBtn = el.querySelector('[data-atk-focus]');
  if (focusBtn) focusBtn.onclick = () => openCommitRitual(task.id);
  el.querySelector('[data-atk-sched]').onclick = () => openScheduleModal(task.dueDate || localDateStr(new Date()), '09:00', task.id, null);
  el.querySelector('[data-atk-dup]').onclick = () => duplicateTask(task.id);
  el.querySelector('[data-atk-del]').onclick = () => deleteTask(task.id);
}

/* ═══════════════════════════════════════════════════════════
   COMMIT RITUAL  (design: "What is the one thing?")
   Nav 'Commit' → ritual → Begin hands the chosen task + duration
   to the Focus (pomodoro) overlay via window.setPomoTask.
   ═══════════════════════════════════════════════════════════ */
let _ritualTaskId = null;
let _ritualDur = 45;
let _ritualWired = false;

function _ritualRenderSuggest(query) {
  const el = document.getElementById('cr-suggest');
  const lbl = document.getElementById('cr-suggest-lbl');
  if (!el) return;
  const q = (query || '').trim().toLowerCase();
  const today = localDateStr(new Date());
  let tasks;
  if (q) { tasks = TASKS.filter(t => !t.done && (t.title || '').toLowerCase().includes(q)).slice(0, 20); if (lbl) lbl.textContent = 'SEARCH · UNCOMPLETED'; }
  else   { tasks = TASKS.filter(t => !t.done && t.dueDate === today);                                   if (lbl) lbl.textContent = "TODAY'S TASKS"; }
  if (!tasks.length) {
    el.innerHTML = `<div class="cr-suggest-empty">${q ? 'No matching open tasks' : 'Nothing due today — type a focus or search'}</div>`;
    return;
  }
  el.innerHTML = tasks.map(t => {
    const cat = t.category ? CATEGORIES[t.category] : null;
    return `<button class="cr-suggest-item${t.id === _ritualTaskId ? ' active' : ''}" data-cr-task="${escAttr(t.id)}">
      <span class="cr-suggest-dot" style="background:${getCatColor(t.category)}"></span>
      <span class="cr-suggest-t">${escHtml(t.title)}</span>
      ${cat ? `<span class="cr-suggest-cat">${escHtml(cat.label.toUpperCase())}</span>` : ''}
    </button>`;
  }).join('');
  el.querySelectorAll('[data-cr-task]').forEach(b => b.onclick = () => {
    const t = TASKS.find(x => x.id === b.dataset.crTask); if (!t) return;
    _ritualTaskId = t.id;
    const inp = document.getElementById('cr-intent'); if (inp) inp.value = t.title;
    _ritualRenderSuggest(''); // show today's list with this one highlighted
  });
}

function openCommitRitual(preselectTaskId) {
  const ov = document.getElementById('commit-ritual-overlay');
  if (!ov) return;
  _ritualDur = 45;
  // Preselect a task when launched from a task's Focus button so every focus
  // entry point flows through one ritual → one Focus Timer (no parallel screens).
  const pre = preselectTaskId ? TASKS.find(t => t.id === preselectTaskId) : null;
  _ritualTaskId = pre ? pre.id : null;
  const inp = document.getElementById('cr-intent'); if (inp) inp.value = pre ? pre.title : '';
  document.querySelectorAll('#cr-durs .cr-dur').forEach(b => b.classList.toggle('active', +b.dataset.dur === _ritualDur));
  _ritualRenderSuggest('');

  if (!_ritualWired) {
    _ritualWired = true;
    const close = () => ov.classList.remove('open');
    document.getElementById('cr-close')?.addEventListener('click', close);
    document.getElementById('cr-leave')?.addEventListener('click', close);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && ov.classList.contains('open')) close(); });
    inp?.addEventListener('input', e => { _ritualTaskId = null; _ritualRenderSuggest(e.target.value); });
    document.getElementById('cr-durs')?.addEventListener('click', e => {
      const b = e.target.closest('[data-dur]'); if (!b) return;
      _ritualDur = +b.dataset.dur;
      document.querySelectorAll('#cr-durs .cr-dur').forEach(x => x.classList.toggle('active', x === b));
    });
    document.getElementById('cr-begin')?.addEventListener('click', () => {
      const task = _ritualTaskId ? TASKS.find(t => t.id === _ritualTaskId) : null;
      const intent = (document.getElementById('cr-intent')?.value || '').trim();
      // A task or an intent is optional — you can just start the timer.
      window.setPomoTask && window.setPomoTask(task || null, _ritualDur);
      if (!task && window.setPomoTitle) window.setPomoTitle(intent || null);
      close();
      showMainPanel('focus');
    });
  }
  ov.classList.add('open');
  setTimeout(() => document.getElementById('cr-intent')?.focus(), 60);
}

document.getElementById('btn-commit')?.addEventListener('click', openCommitRitual);


/* ═══════════════════════════════════════════════════════════════════════════
   MINIMALIST DASHBOARD — compact today spine + telemetry cards
   Replaces the old calendar+tasks two-pane home. All CRUD reuses existing
   global functions (addTask / toggleTask / showEventModal / openScheduleModal /
   _calMilestones / _planMilestonePicker / openCommitRitual).
   ═══════════════════════════════════════════════════════════════════════════ */
function _dashFmtTime(t) {
  if (!t) return '';
  return (typeof fmtTimeSched === 'function') ? fmtTimeSched(t) : t;
}
function _dashPrioRank(p) { return p === 'high' ? 3 : p === 'low' ? 1 : 2; }

/* Dashboard today = a 30-minute time-block grid (08:00–22:00). Tasks from the
   "Due today" card are dragged onto a block to schedule them; placed events can
   be dragged to a new block. Drag state is held in a page-local var (reliable
   in-page; dataTransfer is also set so the browser initiates the drag). */
const DASH_H0 = 8, DASH_H1 = 22, DASH_SLOT_H = 30;
const DASH_SLOTS = (DASH_H1 - DASH_H0) * 2;
let _dashDragPayload = null;

function _dashSlotTime(idx) {
  const mins = DASH_H0 * 60 + idx * 30;
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

function _dashRenderTodayLine() {
  const body = document.getElementById('dash-cal-body');
  if (!body) return;
  const today = localDateStr(new Date());
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const gridStart = DASH_H0 * 60, gridEnd = DASH_H1 * 60;

  // 1. Milestones — pinned above the grid (reuse the global flag banner)
  const msHtml = (typeof _calMilestones === 'function') ? _calMilestones(today) : '';

  // 2. Rail + drop-zone slots
  let rail = '', slots = '';
  for (let s = 0; s < DASH_SLOTS; s++) {
    const time = _dashSlotTime(s);
    const onHour = time.endsWith(':00');
    rail  += `<div class="dash-slot-rail${onHour ? ' hour' : ''}" style="height:${DASH_SLOT_H}px">${onHour ? escHtml(_dashFmtTime(time)) : ''}</div>`;
    slots += `<div class="dash-slot${onHour ? ' hour' : ''}" data-slot="${time}" style="height:${DASH_SLOT_H}px"></div>`;
  }

  // 3. Timed events → positioned chips (draggable to move)
  const events = (CAL_EVENTS || []).filter(e => e.date === today && !e.allDay && e.startTime);
  let chips = '';
  events.forEach(ev => {
    const [h, m] = ev.startTime.split(':').map(Number);
    const startMins = h * 60 + (m || 0);
    if (startMins >= gridEnd) return;
    const dur = ev.duration || 30;
    const top = Math.max(0, (startMins - gridStart) / 30) * DASH_SLOT_H;
    const height = Math.max((dur / 30) * DASH_SLOT_H - 2, 22);
    const task = ev.taskId ? TASKS.find(t => t.id === ev.taskId) : null;
    const color = getCatColor(task?.category);
    const past = startMins + dur <= nowMins;
    chips += `<div class="dash-chip${task?.done ? ' done' : ''}${past ? ' past' : ''}" draggable="true"
        data-ev-chip="${escAttr(ev.id)}" style="top:${top}px;height:${height}px;--nc:${color}">
        <span class="dash-chip-time">${escHtml(_dashFmtTime(ev.startTime))}</span>
        <span class="dash-chip-title">${escHtml(ev.title)}</span>
      </div>`;
  });

  // 4. Now-line
  let nowLine = '';
  if (nowMins >= gridStart && nowMins <= gridEnd) {
    const top = ((nowMins - gridStart) / 30) * DASH_SLOT_H;
    nowLine = `<div class="dash-nowline" style="top:${top}px"><span class="dash-nowline-dot"></span></div>`;
  }

  body.innerHTML =
    (msHtml ? `<div class="dash-ms-row">${msHtml}</div>` : '') +
    `<div class="dash-day-grid">
       <div class="dash-slot-railcol">${rail}</div>
       <div class="dash-slot-col">${slots}
         <div class="dash-chip-layer">${chips}${nowLine}</div>
         <div class="dash-drop-marker" style="display:none"></div>
       </div>
     </div>`;

  if (typeof _wireCalMilestones === 'function') _wireCalMilestones(body);
  _dashWireGrid(body, today);
}

function _dashWireGrid(body, dateStr) {
  const col = body.querySelector('.dash-slot-col');
  const marker = body.querySelector('.dash-drop-marker');
  if (col && marker) {
    const slotIdxAt = clientY => {
      const r = col.getBoundingClientRect();
      return Math.max(0, Math.min(DASH_SLOTS - 1, Math.floor((clientY - r.top) / DASH_SLOT_H)));
    };
    col.addEventListener('dragover', e => {
      if (!_dashDragPayload) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      marker.style.display = 'block';
      marker.style.top = (slotIdxAt(e.clientY) * DASH_SLOT_H) + 'px';
    });
    col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) marker.style.display = 'none'; });
    col.addEventListener('drop', e => {
      e.preventDefault();
      marker.style.display = 'none';
      const p = _dashDragPayload; _dashDragPayload = null;
      if (!p) return;
      const time = _dashSlotTime(slotIdxAt(e.clientY));
      if (p.kind === 'task') scheduleTaskAt(p.id, dateStr, time, 30);
      else if (p.kind === 'event') moveCalEventTo(p.id, dateStr, time);
    });
  }
  // Placed event chips — drag to move, click to edit
  body.querySelectorAll('[data-ev-chip]').forEach(el => {
    el.addEventListener('dragstart', e => {
      _dashDragPayload = { kind: 'event', id: el.dataset.evChip };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'event:' + el.dataset.evChip);
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => { _dashDragPayload = null; el.classList.remove('dragging'); });
    el.addEventListener('click', e => {
      const ev = (CAL_EVENTS || []).find(x => x.id === el.dataset.evChip);
      if (ev) showEventModal(ev, e.clientX, e.clientY);
    });
  });
}

// Cache of today's anchor from Planning › "The week, shaped"
let _dashWeekAnchor = { key: null, text: '', loading: false };
function _dashLoadWeekAnchor() {
  if (typeof _planWeekKey !== 'function' || typeof _planLoadDoc !== 'function') return;
  const key = _planWeekKey();
  if (_dashWeekAnchor.key === key || _dashWeekAnchor.loading) return; // already have / fetching this week
  _dashWeekAnchor.loading = true;
  _planLoadDoc('weeklyPlans', key).then(d => {
    const days = _planWeekDays();
    const idx  = days.indexOf(localDateStr(new Date()));
    _dashWeekAnchor = { key, text: (d.weekShaped && idx >= 0 ? (d.weekShaped[idx] || '') : '').trim(), loading: false };
    if (_mainPanel === 'default') _dashRenderNonNeg();
  }).catch(() => { _dashWeekAnchor.loading = false; });
}
// Force a re-fetch of today's anchor on next dashboard render (e.g. after editing Planning)
window._dashInvalidateAnchor = () => { _dashWeekAnchor.key = null; };

function _dashRenderNonNeg() {
  const nnEl = document.getElementById('dash-nn');
  if (!nnEl) return;
  const today = localDateStr(new Date());
  const anchor = _dashWeekAnchor.text;
  if (anchor) {
    nnEl.innerHTML = `<div class="dash-eyebrow">TODAY'S NON-NEGOTIABLE</div>
      <div class="dash-nn-title">“${escHtml(anchor)}”</div>
      <div class="dash-nn-meta">THIS WEEK, SHAPED · TODAY'S ANCHOR</div>`;
    return;
  }
  // Fallback: highest-priority incomplete task due today or overdue
  const pool = (TASKS || []).filter(t => !t.someday && !t.done && t.dueDate && t.dueDate <= today)
    .sort((a, b) => (_dashPrioRank(b.priority) - _dashPrioRank(a.priority)) || (a.dueDate < b.dueDate ? -1 : 1));
  const nn = pool[0];
  nnEl.innerHTML = `<div class="dash-eyebrow">TODAY'S NON-NEGOTIABLE</div>` + (nn
    ? `<div class="dash-nn-title" data-open="${escAttr(nn.id)}">“${escHtml(nn.title)}”</div>
       <div class="dash-nn-meta">${nn.dueDate < today ? 'OVERDUE · ' : ''}${(nn.priority || 'med').toUpperCase()} PRIORITY</div>`
    : `<div class="dash-nn-title muted">Set today's anchor.</div>
       <div class="dash-nn-meta">Planning › This week › "The week, shaped"</div>`);
  nn && nnEl.querySelector('[data-open]')?.addEventListener('click', () => {
    showMainPanel('alltasks');
    setTimeout(() => window.openAtkDetail?.(nn.id), 40);
  });
}

function _dashRenderCards() {
  const today = localDateStr(new Date());

  // ── Non-negotiable: today's anchor from Planning › "The week, shaped",
  //    falling back to the highest-priority task due today/overdue ──
  _dashLoadWeekAnchor();
  _dashRenderNonNeg();

  // ── Streak: consecutive days with a completed task + last-7 bar ──
  const stEl = document.getElementById('dash-streak');
  if (stEl) {
    const doneDays = new Set((TASKS || []).filter(t => t.done && t.doneDate).map(t => t.doneDate));
    const dstr = d => localDateStr(d);
    // streak counts back from today (with a one-day grace if today is empty so far)
    let streak = 0; const cur = new Date();
    if (!doneDays.has(dstr(cur))) cur.setDate(cur.getDate() - 1);
    while (doneDays.has(dstr(cur))) { streak++; cur.setDate(cur.getDate() - 1); }
    // last 7 calendar days (Mon-anchored week not required — rolling 7)
    const ws = weekStart(new Date());
    const cells = [];
    for (let i = 0; i < 7; i++) { const d = new Date(ws); d.setDate(d.getDate() + i); cells.push({ ds: dstr(d), today: dstr(d) === today }); }
    stEl.innerHTML = `<div class="dash-eyebrow">STREAK · DAILY</div>
      <div class="dash-streak-num"><span class="dash-big">${streak}</span><span class="dash-big-unit">day${streak === 1 ? '' : 's'}</span></div>
      <div class="dash-streak-bar">${cells.map(c =>
        `<div class="dash-streak-cell${doneDays.has(c.ds) ? ' on' : ''}${c.today ? ' today' : ''}"></div>`).join('')}</div>
      <div class="dash-eyebrow" style="margin-top:8px">M · T · W · T · F · S · S</div>`;
  }

  // ── Deep work / commit ──
  const cmEl = document.getElementById('dash-commit');
  if (cmEl) {
    const running = _commitInterval && _commitTaskId;
    if (running) {
      const task = TASKS.find(t => t.id === _commitTaskId);
      const m = Math.floor(_commitElapsed / 60), s = _commitElapsed % 60;
      cmEl.innerHTML = `<div class="dash-eyebrow">RUNNING · COMMIT MODE</div>
        <div class="dash-commit-timer" id="dash-commit-timer">${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}</div>
        <div class="dash-commit-task">${escHtml(task?.title || 'Focus session')}</div>`;
    } else {
      // Real telemetry: minutes of logged task time today (close-prompt only)
      let secs = 0;
      (TASKS || []).forEach(t => { if ((t.doneDate || t.dueDate) === today) secs += taskEffortSecs(t); });
      const mins = Math.round(secs / 60);
      cmEl.innerHTML = `<div class="dash-eyebrow">DEEP WORK · TODAY</div>
        <div class="dash-commit-timer">${mins}<span class="dash-big-unit">min</span></div>
        <button class="dash-cta" id="dash-begin-commit">◈ Begin commit</button>`;
      cmEl.querySelector('#dash-begin-commit')?.addEventListener('click', () => openCommitRitual());
    }
  }
}

/* ── Today's rituals: habits + morning/evening routine steps ──
   Reads the habits-module globals (_habits / _routines / _habitLogs), which are
   already subscribed at boot by initHabitsPage(). Toggling reuses habitToggle().  */
function _dashRenderRituals() {
  const el = document.getElementById('dash-rituals');
  if (!el) return;
  const ds = localDateStr(new Date());
  const habits = (typeof _habits !== 'undefined' ? _habits : [])
    .filter(h => h && h.status !== 'archived' && h.status !== 'graduated');
  // Firestore-backed routine completion (synced across devices) instead of localStorage.
  const routineDone = (typeof _routineDoneMap === 'function') ? _routineDoneMap(ds) : {};
  const morning = (typeof _routines !== 'undefined' ? _routines.morning : []) || [];
  const evening = (typeof _routines !== 'undefined' ? _routines.evening : []) || [];
  const logDone = id => !!(typeof _habitLogs !== 'undefined' && _habitLogs[ds]?.completions?.[id]);

  if (!habits.length && !morning.length && !evening.length) {
    el.innerHTML = `<div class="dash-eyebrow">TODAY'S RITUALS</div>
      <div class="dash-nn-title muted" style="font-size:14px">No rituals yet.</div>
      <div class="dash-nn-meta">Add habits &amp; routines in the Habits page.</div>`;
    return;
  }

  const habitDone = habits.filter(h => logDone(h.id)).length;
  const rows = [];
  habits.forEach(h => {
    const done = logDone(h.id);
    const name = h.tinyBehavior || h.name || 'Habit';
    rows.push(`<div class="dash-ritual-row${done ? ' done' : ''}" data-ritual-habit="${escAttr(h.id)}">
      <span class="dash-ritual-check${done ? ' on' : ''}">${done ? '✓' : ''}</span>
      <span class="dash-ritual-name">${escHtml(name)}</span>
      <span class="dash-ritual-dot" style="--nc:${getCatColor(h.category)}"></span>
    </div>`);
  });
  const routineBlock = (label, steps, kind) => {
    if (!steps.length) return '';
    return `<div class="dash-ritual-sub">${label}</div>` + steps.map((s, i) => {
      const key = (kind === 'morning' ? 'm' : 'e') + i;
      const done = !!routineDone[key];
      return `<div class="dash-ritual-row${done ? ' done' : ''}" data-ritual-step="${escAttr(key)}">
        <span class="dash-ritual-check${done ? ' on' : ''}">${done ? '✓' : ''}</span>
        <span class="dash-ritual-name">${escHtml(s.text || '')}</span>
        ${s.time ? `<span class="dash-ritual-time">${escHtml(s.time)}</span>` : ''}
      </div>`;
    }).join('');
  };

  el.innerHTML =
    `<div class="dash-eyebrow">TODAY'S RITUALS · ${habitDone}/${habits.length}</div>` +
    (habits.length ? `<div class="dash-ritual-list">${rows.join('')}</div>` : '') +
    routineBlock('MORNING', morning, 'morning') +
    routineBlock('EVENING', evening, 'evening');

  // Habit toggle (simple click on the dashboard)
  el.querySelectorAll('[data-ritual-habit]').forEach(r => r.addEventListener('click', () => {
    habitToggle(r.dataset.ritualHabit, ds).then(() => _dashRenderRituals());
  }));
  // Routine-step toggle → Firestore-backed (synced), re-renders on resolve
  el.querySelectorAll('[data-ritual-step]').forEach(r => r.addEventListener('click', () => {
    if (typeof toggleRoutineStep === 'function') toggleRoutineStep(ds, r.dataset.ritualStep).then(() => _dashRenderRituals());
    else _dashRenderRituals();
  }));
}

/* ── Tasks due today: quick-timebox list ──
   Incomplete tasks whose dueDate is today (or overdue). Each row is a one-click
   entry into the Commit Ritual (timebox → focus timer) for that task. */
function _dashRenderTasks() {
  const el = document.getElementById('dash-tasks');
  if (!el) return;
  const today = localDateStr(new Date());
  const due = (TASKS || [])
    .filter(t => !t.done && t.dueDate && t.dueDate <= today)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));

  if (!due.length) {
    el.innerHTML = `<div class="dash-eyebrow">DUE TODAY · TIMEBOX</div>
      <div class="dash-nn-title muted" style="font-size:14px">Nothing due today.</div>
      <div class="dash-nn-meta">Enjoy the open runway — or pull work forward.</div>`;
    return;
  }

  const rows = due.map(t => {
    const overdue = t.dueDate < today;
    return `<div class="dash-task-row" draggable="true" data-dash-task="${escAttr(t.id)}" title="Drag onto the timeline to place it — or click to pick a time">
      <span class="dash-task-grip">⠿</span>
      <span class="dash-task-dot" style="--nc:${getCatColor(t.category)}"></span>
      <span class="dash-task-name">${escHtml(t.title)}</span>
      ${overdue ? '<span class="dash-task-over">OVERDUE</span>' : ''}
      <span class="dash-task-box">◷ Timebox</span>
    </div>`;
  }).join('');

  el.innerHTML =
    `<div class="dash-eyebrow">DUE TODAY · ${due.length} · DRAG TO TIMEBOX</div>
     <div class="dash-task-list">${rows}</div>`;

  el.querySelectorAll('[data-dash-task]').forEach(r => {
    r.addEventListener('dragstart', e => {
      _dashDragPayload = { kind: 'task', id: r.dataset.dashTask };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'task:' + r.dataset.dashTask);
      r.classList.add('dragging');
    });
    r.addEventListener('dragend', () => { _dashDragPayload = null; r.classList.remove('dragging'); });
    // Plain click (no drag) → open the schedule modal to pick a time today
    r.addEventListener('click', () => openScheduleModal(today, '09:00', r.dataset.dashTask, null));
  });
}

function renderDashboardBoard() {
  if (_mainPanel !== 'default') return;
  const titleEl = document.getElementById('dash-cal-title');
  if (titleEl) titleEl.textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  _dashRenderTodayLine();
  _dashRenderCards();
  _dashRenderRituals();
  _dashRenderTasks();
}
window.renderDashboardBoard = renderDashboardBoard;

// Toolbar actions
(function _wireDashQuickAdd() {
  const qa = document.getElementById('dash-quick-add');
  const inp = document.getElementById('dash-quick-add-input');
  const hide = () => { if (qa) qa.style.display = 'none'; if (inp) inp.value = ''; };
  document.getElementById('dash-add-task')?.addEventListener('click', () => {
    if (!qa) return;
    const showing = qa.style.display !== 'none';
    qa.style.display = showing ? 'none' : '';
    if (!showing) setTimeout(() => inp?.focus(), 20);
  });
  inp?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const v = inp.value.trim();
      if (v) addTask(v, 'med', localDateStr(new Date()));
      hide();
    } else if (e.key === 'Escape') { hide(); }
  });
  inp?.addEventListener('blur', () => setTimeout(hide, 120));
})();
document.getElementById('dash-add-event')?.addEventListener('click', () => {
  openQuickCalModal(localDateStr(new Date()), '09:00');
});
document.getElementById('dash-add-ms')?.addEventListener('click', () => {
  window._planMilestonePicker
    ? window._planMilestonePicker(localDateStr(new Date()))
    : document.getElementById('cal-add-milestone')?.click();
});

// Keep the running-commit timer live while the dashboard is visible
setInterval(() => {
  if (_mainPanel !== 'default') return;
  if (_commitInterval && _commitTaskId) {
    const el = document.getElementById('dash-commit-timer');
    if (el) {
      const m = Math.floor(_commitElapsed / 60), s = _commitElapsed % 60;
      el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }
  }
}, 1000);
