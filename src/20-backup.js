/* ─────────────────────────────────────────────────────────────
   BACKUP EXPORT
   Snapshots the live Firestore working set into one markdown file. The point
   is analysis, not disaster recovery: every collection becomes a flat table
   with one row per record so the file can be read in Obsidian, grepped, or
   handed to an LLM to hunt for habit and productivity patterns.

   Desktop writes into the vault (060 ▲ Star logs/Cosmodex Backups/). On the
   web build there is no filesystem, so it downloads instead.
───────────────────────────────────────────────────────────── */

// Pipes and newlines would break the markdown table this lands in.
function _bkCell(v) {
  if (v === null || v === undefined || v === '') return '—';
  return String(v).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim() || '—';
}

// Firestore timestamps arrive as {seconds} or Date depending on the path.
function _bkDate(v) {
  if (!v) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  if (v.seconds) return new Date(v.seconds * 1000).toISOString().slice(0, 10);
  if (v.toDate) { try { return v.toDate().toISOString().slice(0, 10); } catch (e) { return ''; } }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return '';
}

function _bkTable(headers, rows) {
  if (!rows.length) return '_none_\n';
  return '| ' + headers.join(' | ') + ' |\n'
    + '|' + headers.map(() => '---').join('|') + '|\n'
    + rows.map(r => '| ' + r.map(_bkCell).join(' | ') + ' |').join('\n') + '\n';
}

function buildBackupMarkdown() {
  const now = new Date();
  const stamp = localDateStr(now);
  const projName = id => (MILESTONE_PROJECTS.find(p => p.id === id) || {}).title || '';
  const catName = k => (CATEGORIES[k] && (CATEGORIES[k].label || CATEGORIES[k].name)) || k || '';

  const tasks = (TASKS || []).map(t => [
    t.title, t.done ? 'done' : 'open', _bkDate(t.doneDate), t.doneAt || '',
    _bkDate(t.dueDate), _bkDate(t.createdAt), catName(t.category), projName(t.projectId),
    t.timeSpentMinutes || '', t.priority, t.energyType, t.recurrence,
    (t.subtasks || []).length || '', (t.people || []).join(' ')
  ]);

  const events = (CAL_EVENTS || []).map(e => [
    e.title, _bkDate(e.date), e.startTime, e.endTime, e.duration, catName(e.category), e.taskId
  ]);

  const commitments = (MILESTONE_PROJECTS || []).map(p => {
    const linked = (TASKS || []).filter(t => t.projectId === p.id);
    const done = linked.filter(t => t.done).length;
    return [p.title, _bkDate(p.startDate), _bkDate(p.endDate), p.isArchived ? 'archived' : 'active',
      linked.length, done, linked.length ? Math.round(done / linked.length * 100) + '%' : '—'];
  });

  // Habit logs are keyed by date → { completions: { habitId: bool } }.
  const habitRows = Object.keys(_habitLogs || {}).sort().map(ds => {
    const comp = (_habitLogs[ds] || {}).completions || {};
    const done = Object.keys(comp).filter(k => comp[k]);
    return [ds, done.length, (_habits || []).length,
      done.map(id => ((_habits || []).find(h => h.id === id) || {}).name || id).join(', ')];
  });

  const drills = (DRILL_RESPONSES || []).map(d => [
    _bkDate(d.date), d.provider, d.score, d.total, d.durationSecs
  ]);

  // A day-level roll-up is what most pattern questions actually need.
  const byDay = {};
  (TASKS || []).forEach(t => {
    if (!t.done || !t.doneDate) return;
    const d = _bkDate(t.doneDate); if (!d) return;
    byDay[d] = byDay[d] || { n: 0, mins: 0, cats: {} };
    byDay[d].n++;
    byDay[d].mins += t.timeSpentMinutes || 0;
    const c = catName(t.category) || 'uncategorised';
    byDay[d].cats[c] = (byDay[d].cats[c] || 0) + 1;
  });
  const dayRows = Object.keys(byDay).sort().map(d => {
    const r = byDay[d];
    const top = Object.keys(r.cats).sort((a, b) => r.cats[b] - r.cats[a])[0];
    const hl = (_habitLogs || {})[d];
    const hDone = hl ? Object.values(hl.completions || {}).filter(Boolean).length : '';
    return [d, new Date(d + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' }),
      r.n, r.mins || '', top, hDone];
  });

  const openTasks = (TASKS || []).filter(t => !t.done).length;
  const doneTasks = (TASKS || []).length - openTasks;
  const totalMins = (TASKS || []).reduce((s, t) => s + (t.timeSpentMinutes || 0), 0);

  return `---
type: cosmodex-backup
exported: ${now.toISOString()}
date: ${stamp}
tasks_total: ${(TASKS || []).length}
tasks_open: ${openTasks}
tasks_done: ${doneTasks}
logged_minutes: ${totalMins}
commitments: ${(MILESTONE_PROJECTS || []).length}
events: ${(CAL_EVENTS || []).length}
habits: ${(_habits || []).length}
days_logged: ${dayRows.length}
---

# Cosmodex backup — ${stamp}

Full snapshot of the Cosmodex working set, exported for pattern analysis.
Every table is one row per record; dates are \`YYYY-MM-DD\`.

## Daily roll-up

One row per day on which something was completed — the fastest table to reason
over for throughput, effort and habit-adherence questions.

${_bkTable(['date', 'day', 'tasks done', 'minutes logged', 'top category', 'habits done'], dayRows)}
## Tasks

${_bkTable(['title', 'state', 'done', 'done at', 'due', 'created', 'category',
    'commitment', 'minutes', 'priority', 'energy', 'recurrence', 'subtasks', 'people'], tasks)}
## Commitments

${_bkTable(['name', 'start', 'end', 'status', 'linked tasks', 'done', 'progress'], commitments)}
## Calendar events

${_bkTable(['title', 'date', 'start', 'end', 'duration', 'category', 'task'], events)}
## Habit log

${_bkTable(['date', 'completed', 'of', 'habits'], habitRows)}
## Drill responses

${_bkTable(['date', 'provider', 'score', 'total', 'seconds'], drills)}
## Categories

${_bkTable(['key', 'label'], Object.keys(CATEGORIES || {}).map(k => [k, catName(k)]))}`;
}

async function runBackup(btn) {
  const label = btn && btn.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Exporting…'; }
  try {
    const md = buildBackupMarkdown();
    const filename = `cosmodex-backup-${localDateStr(new Date())}.md`;
    const invoke = window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke;
    if (invoke) {
      const path = await invoke('write_backup', { filename, content: md });
      showToast('Backup written to ' + path.split('/').slice(-2).join('/'), 'success');
    } else {
      // Web build: no filesystem, so hand it to the browser.
      const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      showToast('Backup downloaded', 'success');
    }
  } catch (err) {
    console.error('backup failed:', err);
    showToast('Backup failed: ' + err, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = label; }
  }
}

document.getElementById('settings-backup-btn')?.addEventListener('click', function () {
  runBackup(this);
});
