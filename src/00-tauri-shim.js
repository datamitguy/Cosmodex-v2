/* ── Desktop (Tauri) compatibility shims ──────────────────────────────────
   Only active inside the Tauri desktop app (window.__TAURI__ present). The web
   build is untouched — every guard is evaluated at event time and no-ops in a
   normal browser, so this file is safe to ship everywhere. */
(function _tauriShims() {
  // Open external http(s) links in the system browser. Inside a webview an
  // <a target="_blank"> or external href otherwise just does nothing.
  document.addEventListener('click', function (e) {
    var t = window.__TAURI__;
    var invoke = t && t.core && t.core.invoke;
    if (!invoke) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (/^https?:\/\//i.test(href)) {
      e.preventDefault();
      invoke('plugin:opener|open_url', { url: href }).catch(function () {});
    }
  }, true);
})();
