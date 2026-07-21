/* ── Valerie · daily note ─────────────────────────────────────────────────
   A markdown diary shown at the bottom of the dashboard, bound to the day the
   pills select (_dashCalDate). In the desktop app it reads/writes plain .md
   files directly in the Obsidian iCloud vault (060 ▲ Star logs / Daily) via the
   Rust commands — no Firebase, so Obsidian and Cosmodex share one file. On the
   web (no filesystem) it shows a hint instead. A note is never auto-created;
   the user creates it with a button, seeded from the Valerie daily template. */
(function _dailyNoteModule() {
  let _saveTimer = null;
  let _preview = false;
  let _content = '';

  function _invoke() { const t = window.__TAURI__; return t && t.core && t.core.invoke; }

  function _label(dateStr) {
    const d = new Date(dateStr + 'T00:00');
    const diff = Math.round((new Date(dateStr) - new Date(localDateStr(new Date()))) / 86400000);
    const rel = diff === 0 ? 'TODAY' : diff === 1 ? 'TOMORROW' : diff === -1 ? 'YESTERDAY' : '';
    const nice = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    return (rel ? rel + ' · ' : '') + nice;
  }

  function _status(t) { const s = document.getElementById('dash-note-status'); if (s) s.textContent = t; }

  // Minimal, safe markdown → HTML for the preview (headings, bold/italic/code,
  // lists, task checkboxes, blockquotes, rules, links).
  function _md(src) {
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const inline = s => s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*(?!\s)([^*]+?)\*/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    let html = '', inList = false;
    const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
    esc(src).split('\n').forEach(raw => {
      const l = raw.replace(/\s+$/, '');
      if (/^#{1,6}\s/.test(l)) { closeList(); const lvl = l.match(/^#+/)[0].length; html += `<h${lvl}>${inline(l.replace(/^#+\s/, ''))}</h${lvl}>`; }
      else if (/^\s*[-*]\s+\[[ xX]\]\s/.test(l)) { if (!inList) { html += '<ul class="md-tasks">'; inList = true; } const done = /\[[xX]\]/.test(l); html += `<li class="${done ? 'done' : ''}">${done ? '☑' : '☐'} ${inline(l.replace(/^\s*[-*]\s+\[[ xX]\]\s/, ''))}</li>`; }
      else if (/^\s*[-*]\s+/.test(l)) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`; }
      else if (/^>\s?/.test(l)) { closeList(); html += `<blockquote>${inline(l.replace(/^>\s?/, ''))}</blockquote>`; }
      else if (/^(-{3,}|\*{3,})$/.test(l)) { closeList(); html += '<hr>'; }
      else if (l.trim() === '') { closeList(); }
      else { closeList(); html += `<p>${inline(l)}</p>`; }
    });
    closeList();
    return html;
  }

  async function _save(dateStr) {
    const invoke = _invoke(); if (!invoke) return;
    try { await invoke('write_daily_note', { date: dateStr, content: _content }); _status('Saved'); }
    catch (e) { _status('Save failed'); console.warn('daily note save:', e); }
  }

  function _renderBody(dateStr) {
    const body = document.getElementById('dash-note-body'); if (!body) return;
    if (_preview) {
      body.innerHTML = `<div class="dash-note-preview">${_md(_content)}</div>`;
    } else {
      body.innerHTML = `<textarea class="dash-note-textarea" id="dash-note-text" spellcheck="true" placeholder="Dear Amit, it’s Valerie…"></textarea>`;
      const ta = body.querySelector('#dash-note-text');
      ta.value = _content;
      ta.addEventListener('input', () => {
        _content = ta.value; _status('Saving…');
        clearTimeout(_saveTimer);
        _saveTimer = setTimeout(() => _save(dateStr), 600);
      });
    }
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

    let content = null;
    try { content = await invoke('read_daily_note', { date: dateStr }); } catch (e) { content = null; }

    // No file yet — never auto-create; offer a button.
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
        _preview = false;
        window._dashRenderNote();
      };
      return;
    }

    // Editor + preview toggle.
    _content = content;
    el.innerHTML = head +
      `<div class="dash-note-actions">
         <span class="dash-note-status" id="dash-note-status">Saved</span>
         <button class="dash-note-toggle" id="dash-note-toggle" type="button">${_preview ? 'Edit' : 'Preview'}</button>
       </div></div>
       <div class="dash-note-body" id="dash-note-body"></div>`;
    el.querySelector('#dash-note-toggle').onclick = () => {
      _preview = !_preview;
      el.querySelector('#dash-note-toggle').textContent = _preview ? 'Edit' : 'Preview';
      _renderBody(dateStr);
    };
    _renderBody(dateStr);
  };
})();
