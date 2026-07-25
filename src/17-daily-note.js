/* ── Valerie · daily note ─────────────────────────────────────────────────
   A markdown diary shown at the bottom of the dashboard, bound to the day the
   pills select (_dashCalDate). In the desktop app it reads/writes plain .md
   files directly in the Obsidian iCloud vault (060 ▲ Star logs / Daily) via the
   Rust commands — no Firebase, so Obsidian and Cosmodex share ONE file. On the
   web (no filesystem) it shows a hint instead. A note is never auto-created;
   the user creates it with a button, seeded from the Valerie daily template.

   Editing is a live split: a raw-markdown textarea (the source of truth, so
   Obsidian syntax — callouts, [[wikilinks]], %%comments%% — is never mangled)
   beside a continuously-rendered reading-mode preview, plus a small formatting
   toolbar. Because Obsidian and Cosmodex share the file, the note is re-read
   from disk whenever the window regains focus (unless you're mid-edit here),
   so an edit made in Obsidian is picked up instead of being clobbered. */
(function _dailyNoteModule() {
  let _saveTimer = null;
  let _content = '';        // in-memory source of truth (raw markdown)
  let _focusHooked = false; // window focus/visibility listener attached once
  let _mode = 'edit';       // 'edit' (textarea) | 'read' (rendered, locked)

  function _invoke() { const t = window.__TAURI__; return t && t.core && t.core.invoke; }

  function _label(dateStr) {
    const d = new Date(dateStr + 'T00:00');
    const diff = Math.round((new Date(dateStr) - new Date(localDateStr(new Date()))) / 86400000);
    const rel = diff === 0 ? 'TODAY' : diff === 1 ? 'TOMORROW' : diff === -1 ? 'YESTERDAY' : '';
    const nice = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    return (rel ? rel + ' · ' : '') + nice;
  }

  function _status(t) { const s = document.getElementById('dash-note-status'); if (s) s.textContent = t; }

  // Minimal, safe markdown → HTML for the live preview. Renders enough Obsidian
  // syntax to look like reading mode: headings, bold/italic/code, lists, task
  // checkboxes, blockquotes, rules, links, [[wikilinks]], > [!callouts], and it
  // hides %%comment%% blocks. Never used to write back — display only.
  function _md(src) {
    src = String(src || '').replace(/%%[\s\S]*?%%/g, '');   // hide Obsidian comments
    // Escape HTML inside inline() only — structure is detected on the raw line,
    // so `>` (callouts/blockquotes) survives instead of becoming &gt; up front.
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const inline = s => esc(s)
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<span class="md-wl">$2</span>')
      .replace(/\[\[([^\]]+)\]\]/g, '<span class="md-wl">$1</span>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*(?!\s)([^*]+?)\*/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    const lines = src.split('\n');
    let html = '', inList = false, i = 0;
    const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
    const taskLine = cl => {
      const done = /\[[xX]\]/.test(cl);
      return `${done ? '☑' : '☐'} ${inline(cl.replace(/^\s*[-*]\s+\[[ xX]\]\s/, ''))}`;
    };
    while (i < lines.length) {
      const l = lines[i].replace(/\s+$/, '');
      // Obsidian callout: > [!Type]±  Title  followed by its > content lines.
      const cm = l.match(/^>\s*\[!(\w+)\]([-+]?)\s*(.*)$/);
      if (cm) {
        closeList();
        const title = cm[3] || cm[1];
        let inner = ''; i++;
        while (i < lines.length && /^>/.test(lines[i])) {
          const cl = lines[i].replace(/^>\s?/, '').replace(/\s+$/, '');
          if (/^\s*[-*]\s+\[[ xX]\]\s/.test(cl)) inner += `<div class="md-task">${taskLine(cl)}</div>`;
          else if (/^\s*[-*]\s+/.test(cl)) inner += `<div>• ${inline(cl.replace(/^\s*[-*]\s+/, ''))}</div>`;
          else if (cl.trim() === '') inner += '<br>';
          else inner += `<div>${inline(cl)}</div>`;
          i++;
        }
        html += `<div class="md-callout"><div class="md-callout-t">${inline(title)}</div>${inner}</div>`;
        continue;
      }
      if (/^#{1,6}\s/.test(l)) { closeList(); const lvl = l.match(/^#+/)[0].length; html += `<h${lvl}>${inline(l.replace(/^#+\s/, ''))}</h${lvl}>`; }
      else if (/^\s*[-*]\s+\[[ xX]\]\s/.test(l)) { if (!inList) { html += '<ul class="md-tasks">'; inList = true; } html += `<li class="${/\[[xX]\]/.test(l) ? 'done' : ''}">${taskLine(l)}</li>`; }
      else if (/^\s*[-*]\s+/.test(l)) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`; }
      else if (/^>\s?/.test(l)) { closeList(); html += `<blockquote>${inline(l.replace(/^>\s?/, ''))}</blockquote>`; }
      else if (/^(-{3,}|\*{3,})$/.test(l)) { closeList(); html += '<hr>'; }
      else if (l.trim() === '') { closeList(); }
      else { closeList(); html += `<p>${inline(l)}</p>`; }
      i++;
    }
    closeList();
    return html;
  }

  async function _save(dateStr) {
    const invoke = _invoke(); if (!invoke) return;
    try { await invoke('write_daily_note', { date: dateStr, content: _content }); _status('Saved'); }
    catch (e) { _status('Save failed'); console.warn('daily note save:', e); }
  }

  // Toolbar: wrap/insert markdown around the textarea selection. Non-destructive
  // — it only edits the raw text, so Obsidian syntax is never rewritten for us.
  function _applyMd(ta, kind) {
    const s = ta.selectionStart, e = ta.selectionEnd, val = ta.value, sel = val.slice(s, e);
    const linePfx = { h: '## ', ul: '- ', task: '- [ ] ', quote: '> ' };
    if (linePfx[kind]) {
      const ls = val.lastIndexOf('\n', s - 1) + 1;
      const block = val.slice(ls, e), pfx = linePfx[kind];
      const nb = block.split('\n').map(l => pfx + l).join('\n');
      ta.value = val.slice(0, ls) + nb + val.slice(e);
      ta.selectionStart = s + pfx.length; ta.selectionEnd = e + (nb.length - block.length);
    } else {
      const wraps = { b: ['**', '**'], i: ['*', '*'], code: ['`', '`'], link: ['[', '](url)'] };
      const [p, q] = wraps[kind];
      ta.value = val.slice(0, s) + p + sel + q + val.slice(e);
      if (kind === 'link' && sel) { ta.selectionStart = s + sel.length + 3; ta.selectionEnd = s + sel.length + 6; } // select "url"
      else if (kind === 'link') { ta.selectionStart = ta.selectionEnd = s + 1; }
      else { ta.selectionStart = s + p.length; ta.selectionEnd = e + p.length; }
    }
    ta.focus();
    ta.dispatchEvent(new Event('input'));
  }

  // One pane, two modes: Edit (raw-markdown textarea + toolbar) and Read (the
  // rendered reading view, locked). The pills up top toggle between them.
  function _renderBody(dateStr) {
    const body = document.getElementById('dash-note-body'); if (!body) return;
    if (_mode === 'read') {
      body.innerHTML = `<div class="dash-note-preview dash-note-read">${_md(_content)}</div>`;
      return;
    }
    body.innerHTML =
      `<div class="dash-note-toolbar" id="dash-note-tb">
         <button type="button" data-md="h" title="Heading">H</button>
         <button type="button" data-md="b" title="Bold"><b>B</b></button>
         <button type="button" data-md="i" title="Italic"><i>I</i></button>
         <button type="button" data-md="ul" title="Bullet list">•&nbsp;List</button>
         <button type="button" data-md="task" title="Task">☑</button>
         <button type="button" data-md="quote" title="Quote">❝</button>
         <button type="button" data-md="code" title="Code">&lt;/&gt;</button>
         <button type="button" data-md="link" title="Link">🔗</button>
       </div>
       <textarea class="dash-note-textarea dash-note-edit" id="dash-note-text" spellcheck="true" placeholder="Dear Amit, it’s Valerie…"></textarea>`;
    const ta = body.querySelector('#dash-note-text');
    ta.value = _content;
    ta.addEventListener('input', () => {
      _content = ta.value; _status('Saving…');
      clearTimeout(_saveTimer);
      _saveTimer = setTimeout(() => _save(dateStr), 600);
    });
    body.querySelector('#dash-note-tb').addEventListener('click', e => {
      const btn = e.target.closest('button[data-md]'); if (btn) _applyMd(ta, btn.dataset.md);
    });
  }

  // Re-read from disk when the window regains focus, so an edit made in Obsidian
  // shows here instead of being overwritten by our cached copy. Skipped while the
  // textarea is focused (we're the active editor) to avoid discarding live edits.
  function _hookFocusReload() {
    if (_focusHooked) return;
    _focusHooked = true;
    const reload = () => {
      if (document.hidden) return;
      if (!document.getElementById('dash-note-panel')) return;      // not on dashboard
      if (document.activeElement && document.activeElement.id === 'dash-note-text') return; // editing here
      window._dashRenderNote && window._dashRenderNote();
    };
    window.addEventListener('focus', reload);
    document.addEventListener('visibilitychange', reload);
  }

  window._dashRenderNote = async function () {
    const el = document.getElementById('dash-note-panel'); if (!el) return;
    const dateStr = localDateStr(_dashCalDate);
    const invoke = _invoke();
    const label = _label(dateStr);
    const head = `<div class="dash-note-head"><span class="dash-eyebrow">✒ VALERIE · ${escHtml(label)}</span>`;

    // Web (no filesystem): the diary lives in iCloud, reachable only from the Mac app.
    if (!invoke) {
      el.innerHTML = head + `</div>
        <div class="dash-note-empty">Your diary lives in your iCloud vault. Open Cosmodex on your Mac to read or write this day’s entry.</div>`;
      return;
    }
    _hookFocusReload();

    let content = null;
    try { content = await invoke('read_daily_note', { date: dateStr }); } catch (e) { content = null; }

    // No file yet — never auto-create; offer a button seeded from the template.
    if (content == null) {
      el.innerHTML = head + `</div>
        <div class="dash-note-empty">
          <div class="dash-note-empty-t">No entry for this day.</div>
          <button class="dash-note-create" id="dash-note-create" type="button">＋ Create note</button>
        </div>`;
      el.querySelector('#dash-note-create').onclick = async () => {
        let seed = '';
        try { seed = await invoke('read_daily_template'); } catch (e) {}
        if (!seed || !seed.trim()) seed = `# ${label}\n\n`;
        try { await invoke('write_daily_note', { date: dateStr, content: seed }); }
        catch (e) { if (typeof showToast === 'function') showToast('Could not create the note', 'error'); return; }
        window._dashRenderNote();
      };
      return;
    }

    _content = content;
    el.innerHTML = head +
      `<div class="dash-note-actions">
         <span class="dash-note-status" id="dash-note-status">Saved</span>
         <div class="dash-note-pills" id="dash-note-pills">
           <button type="button" data-mode="edit"${_mode === 'edit' ? ' class="active"' : ''}>Edit</button>
           <button type="button" data-mode="read"${_mode === 'read' ? ' class="active"' : ''}>Read</button>
         </div>
       </div></div>
       <div class="dash-note-body" id="dash-note-body"></div>`;
    el.querySelector('#dash-note-pills').addEventListener('click', e => {
      const btn = e.target.closest('button[data-mode]'); if (!btn || btn.dataset.mode === _mode) return;
      _mode = btn.dataset.mode;
      el.querySelectorAll('#dash-note-pills button').forEach(b => b.classList.toggle('active', b.dataset.mode === _mode));
      _renderBody(dateStr);
    });
    _renderBody(dateStr);
  };
})();
