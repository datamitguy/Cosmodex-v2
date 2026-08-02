// Desktop Google sign-in: system-browser OAuth 2.0 with PKCE + a localhost
// loopback. The webview's origin (tauri://localhost) can't complete Firebase's
// popup flow, so we do the OAuth round-trip in the real browser, capture the
// code on a loopback port, exchange it in Rust (client secret never leaves the
// binary), and hand the Google id_token back to JS for signInWithCredential().

use base64::Engine;
use sha2::{Digest, Sha256};
use std::time::Duration;

const CLIENT_ID: &str = env!("COSMODEX_OAUTH_CLIENT_ID");
const CLIENT_SECRET: &str = env!("COSMODEX_OAUTH_CLIENT_SECRET");

fn rand_string(len: usize) -> String {
    use rand::Rng;
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    let mut rng = rand::thread_rng();
    (0..len)
        .map(|_| CHARS[rng.gen_range(0..CHARS.len())] as char)
        .collect()
}

fn pkce_challenge(verifier: &str) -> String {
    let digest = Sha256::digest(verifier.as_bytes());
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(digest)
}

fn oauth_flow() -> Result<String, String> {
    // 1. Loopback server on an ephemeral port.
    let server = tiny_http::Server::http("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = match server.server_addr() {
        tiny_http::ListenAddr::IP(a) => a.port(),
        _ => return Err("could not determine loopback port".into()),
    };
    let redirect_uri = format!("http://127.0.0.1:{port}");

    // 2. PKCE + anti-forgery state.
    let verifier = rand_string(64);
    let challenge = pkce_challenge(&verifier);
    let state = rand_string(24);

    // 3. Build the consent URL and open the user's real browser.
    let mut auth = url::Url::parse("https://accounts.google.com/o/oauth2/v2/auth")
        .map_err(|e| e.to_string())?;
    auth.query_pairs_mut()
        .append_pair("response_type", "code")
        .append_pair("client_id", CLIENT_ID)
        .append_pair("redirect_uri", &redirect_uri)
        .append_pair("scope", "openid email profile")
        .append_pair("code_challenge", &challenge)
        .append_pair("code_challenge_method", "S256")
        .append_pair("state", &state)
        .append_pair("prompt", "select_account");
    open::that(auth.as_str()).map_err(|e| format!("could not open browser: {e}"))?;

    // 4. Wait (up to 5 min) for Google to redirect back with the code.
    let deadline = std::time::Instant::now() + Duration::from_secs(300);
    let code = loop {
        let remaining = deadline.saturating_duration_since(std::time::Instant::now());
        if remaining.is_zero() {
            return Err("timed out waiting for Google sign-in".into());
        }
        match server.recv_timeout(remaining) {
            Ok(Some(req)) => {
                let full = format!("http://127.0.0.1{}", req.url());
                let parsed = url::Url::parse(&full).map_err(|e| e.to_string())?;
                let mut got_code = None;
                let mut got_state = None;
                for (k, v) in parsed.query_pairs() {
                    match k.as_ref() {
                        "code" => got_code = Some(v.to_string()),
                        "state" => got_state = Some(v.to_string()),
                        _ => {}
                    }
                }
                if got_code.is_none() {
                    // favicon or stray request — ack and keep waiting
                    let _ = req.respond(tiny_http::Response::empty(404));
                    continue;
                }
                let html = "<html><body style='font-family:-apple-system,sans-serif;background:#000;color:#fff;text-align:center;padding-top:80px'><h2 style='font-weight:400'>Signed in \u{2713}</h2><p style='opacity:.7'>You can close this tab and return to Cosmodex.</p></body></html>";
                let header = "Content-Type: text/html; charset=utf-8"
                    .parse::<tiny_http::Header>()
                    .map_err(|_| "header parse".to_string())?;
                let _ = req.respond(tiny_http::Response::from_string(html).with_header(header));
                if got_state.as_deref() != Some(state.as_str()) {
                    return Err("state mismatch (possible CSRF) — sign-in aborted".into());
                }
                break got_code.unwrap();
            }
            Ok(None) => return Err("timed out waiting for Google sign-in".into()),
            Err(e) => return Err(e.to_string()),
        }
    };

    // 5. Exchange the code for tokens (secret + verifier stay in Rust).
    let resp = ureq::post("https://oauth2.googleapis.com/token")
        .send_form(&[
            ("code", code.as_str()),
            ("client_id", CLIENT_ID),
            ("client_secret", CLIENT_SECRET),
            ("redirect_uri", redirect_uri.as_str()),
            ("grant_type", "authorization_code"),
            ("code_verifier", verifier.as_str()),
        ])
        .map_err(|e| format!("token exchange failed: {e}"))?;
    let json: serde_json::Value = resp.into_json().map_err(|e| e.to_string())?;
    json.get("id_token")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "no id_token in Google response".into())
}

#[tauri::command]
async fn google_sign_in() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(oauth_flow)
        .await
        .map_err(|e| format!("sign-in task failed: {e}"))?
}

// ── Daily notes: plain-markdown files in the Obsidian iCloud vault ──
// Stored at ~/Library/Mobile Documents/…/Quasar/060 ▲ Star logs/Daily/<date>.md
// so Cosmodex and Obsidian share one source of truth — no Firebase, no sync race.

const VAULT_REL: &str =
    "Library/Mobile Documents/iCloud~md~obsidian/Documents/Quasar";

fn vault_root() -> std::path::PathBuf {
    std::path::PathBuf::from(std::env::var("HOME").unwrap_or_default()).join(VAULT_REL)
}
fn daily_dir() -> std::path::PathBuf {
    vault_root().join("060 \u{25b2} Star logs").join("Daily")
}
// Only accept a YYYY-MM-DD date so a caller can't escape the daily folder.
fn valid_date(d: &str) -> bool {
    d.len() == 10 && d.bytes().all(|b| b.is_ascii_digit() || b == b'-')
}

#[tauri::command]
fn read_daily_note(date: String) -> Option<String> {
    if !valid_date(&date) {
        return None;
    }
    std::fs::read_to_string(daily_dir().join(format!("{date}.md"))).ok()
}

#[tauri::command]
fn write_daily_note(date: String, content: String) -> Result<(), String> {
    if !valid_date(&date) {
        return Err("invalid date".into());
    }
    let dir = daily_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::fs::write(dir.join(format!("{date}.md")), content).map_err(|e| e.to_string())
}

// The "Valerie" daily template used to seed a freshly-created note.
#[tauri::command]
fn read_daily_template() -> String {
    let p = vault_root()
        .join("020 \u{25a2} Templates")
        .join("Daily Template.md");
    std::fs::read_to_string(p).unwrap_or_default()
}

// ── Quick-capture inbox ──
// One persistent file in the Clippings folder. An iPhone Shortcut (Action
// Button → Dictate) appends lines to it; Cosmodex just reads/writes the same
// file behind the "📥 Captures" pill so it can be triaged and cleaned. It is
// NOT folded into the daily note — a single running inbox, visible in Obsidian.
fn capture_inbox_path() -> std::path::PathBuf {
    vault_root().join("040 \u{25c6} Clippings").join("Capture Inbox.md")
}

// The original inbox lived at the vault root and the iPhone Shortcut still
// appends there. Rather than making the Shortcut the single point of failure,
// every read drains that file into the Clippings one and truncates it — the
// file itself is left in place so the Shortcut's reference stays valid.
fn legacy_inbox_path() -> std::path::PathBuf {
    vault_root().join("_Capture Inbox.md")
}

fn drain_legacy_inbox() {
    let legacy = legacy_inbox_path();
    let stray = match std::fs::read_to_string(&legacy) {
        Ok(s) => s,
        Err(_) => return,
    };
    if stray.trim().is_empty() {
        return;
    }
    let main = capture_inbox_path();
    if let Some(dir) = main.parent() {
        if std::fs::create_dir_all(dir).is_err() {
            return;
        }
    }
    let mut merged = std::fs::read_to_string(&main).unwrap_or_default();
    if !merged.is_empty() && !merged.ends_with('\n') {
        merged.push('\n');
    }
    merged.push_str(stray.trim_end());
    merged.push('\n');
    if std::fs::write(&main, merged).is_ok() {
        let _ = std::fs::write(&legacy, "");
    }
}

#[tauri::command]
fn read_capture_file() -> Option<String> {
    drain_legacy_inbox();
    std::fs::read_to_string(capture_inbox_path()).ok()
}

#[tauri::command]
fn write_capture_file(content: String) -> Result<(), String> {
    let p = capture_inbox_path();
    if let Some(dir) = p.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    std::fs::write(&p, content).map_err(|e| e.to_string())
}

// ── Backup export ──
// A full snapshot of the Firestore working set, written as one markdown file
// into the vault so it can be read in Obsidian and mined for patterns. Kept in
// Star logs since it is a log of activity, not a note.
#[tauri::command]
fn write_backup(filename: String, content: String) -> Result<String, String> {
    // Filename is generated by the app, but never trust it with path separators.
    if filename.contains('/') || filename.contains("..") {
        return Err("invalid filename".into());
    }
    let dir = vault_root()
        .join("060 \u{25b2} Star logs")
        .join("Cosmodex Backups");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let p = dir.join(&filename);
    std::fs::write(&p, content).map_err(|e| e.to_string())?;
    Ok(p.to_string_lossy().to_string())
}

// ── Observation log: the floating star-chart widget ──────────────────────────
// Its own webview (chart.html) so the main window's layout is untouched. State
// travels over Tauri events, not Firestore — the embedded countdown ticks every
// second and Firestore would bill a write for each one.
const CHART_LABEL: &str = "obs-chart";

fn spawn_chart(app: &tauri::AppHandle) -> Result<(), String> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};
    let w = WebviewWindowBuilder::new(app, CHART_LABEL, WebviewUrl::App("chart.html".into()))
        .title("Observation Log")
        .inner_size(264.0, 400.0)
        .min_inner_size(264.0, 230.0)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .shadow(false)
        .skip_taskbar(true)
        .resizable(true)
        .build()
        .map_err(|e| e.to_string())?;
    // Top-right, clear of the focus lens in the bottom-right.
    if let Ok(Some(mon)) = w.primary_monitor() {
        let s = mon.size();
        let sf = mon.scale_factor();
        let _ = w.set_position(tauri::PhysicalPosition::new(
            (s.width as f64 - 264.0 * sf - 32.0 * sf).max(0.0),
            48.0 * sf,
        ));
    }
    // CanJoinAllSpaces — follows the user onto every desktop.
    let _ = w.set_visible_on_all_workspaces(true);
    // tao stops there, so a full-screen app would hide the widget on its own
    // Space. FullScreenAuxiliary (1 << 8) is what keeps it on top of one.
    #[cfg(target_os = "macos")]
    if let Ok(ptr) = w.ns_window() {
        unsafe {
            use objc2::{msg_send, runtime::AnyObject};
            let ns = ptr as *mut AnyObject;
            let cur: usize = msg_send![ns, collectionBehavior];
            let _: () = msg_send![ns, setCollectionBehavior: cur | (1usize << 0) | (1usize << 8)];
        }
    }
    Ok(())
}

#[tauri::command]
fn chart_toggle(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri::Manager;
    if let Some(w) = app.get_webview_window(CHART_LABEL) {
        w.close().map_err(|e| e.to_string())?;
        return Ok(false);
    }
    spawn_chart(&app)?;
    Ok(true)
}

#[tauri::command]
fn chart_close(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(w) = app.get_webview_window(CHART_LABEL) {
        w.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Collapse the log to a one-line tape, or restore it. Rust owns this rather
/// than the webview because the minimum height has to be lowered before the
/// window can shrink past it — and raised again before it grows back.
#[tauri::command]
fn chart_tape(app: tauri::AppHandle, collapsed: bool) -> Result<(), String> {
    use tauri::{LogicalSize, Manager};
    let w = match app.get_webview_window(CHART_LABEL) {
        Some(w) => w,
        None => return Ok(()),
    };
    if collapsed {
        w.set_min_size(Some(LogicalSize::new(264.0, 30.0)))
            .map_err(|e| e.to_string())?;
        w.set_size(LogicalSize::new(264.0, 30.0))
            .map_err(|e| e.to_string())?;
        let _ = w.set_resizable(false);
    } else {
        w.set_min_size(Some(LogicalSize::new(264.0, 230.0)))
            .map_err(|e| e.to_string())?;
        w.set_size(LogicalSize::new(264.0, 400.0))
            .map_err(|e| e.to_string())?;
        let _ = w.set_resizable(true);
    }
    Ok(())
}

#[tauri::command]
fn chart_is_open(app: tauri::AppHandle) -> bool {
    use tauri::Manager;
    app.get_webview_window(CHART_LABEL).is_some()
}

// ── Calendar mirror: shell out to the bundled `cosmodex-cal` EventKit helper ──
// The helper is bundled as a sidecar (externalBin), so at runtime it sits next
// to the main executable inside Contents/MacOS/ (triple stripped).

// Append a line to ~/Library/Logs/Cosmodex/calendar.log so calendar-mirror
// problems can be diagnosed without a devtools console.
fn cal_log(msg: &str) {
    use std::io::Write;
    let home = std::env::var("HOME").unwrap_or_default();
    let dir = std::path::PathBuf::from(&home).join("Library/Logs/Cosmodex");
    let _ = std::fs::create_dir_all(&dir);
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(dir.join("calendar.log"))
    {
        let _ = writeln!(f, "[{secs}] {msg}");
    }
}

fn helper_path() -> Option<std::path::PathBuf> {
    let dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
    let bundled = dir.join("cosmodex-cal");
    if bundled.exists() {
        return Some(bundled);
    }
    // `tauri dev` leaves the sidecar under its triple-suffixed name.
    let dev = dir.join("cosmodex-cal-aarch64-apple-darwin");
    if dev.exists() {
        return Some(dev);
    }
    None
}

// Reconcile the whole desired calendar set in one pass. `payload` is the JSON
// the helper's `sync` command expects: {"items":[{id,title,start,end,allDay,notes}]}.
#[tauri::command]
fn calendar_sync(payload: String) -> Result<String, String> {
    use std::io::Write;
    use std::process::{Command, Stdio};
    let bin = match helper_path() {
        Some(b) => b,
        None => {
            cal_log("sync ERROR: helper binary not found next to the app executable");
            return Err("calendar helper not found".into());
        }
    };
    cal_log(&format!("sync: invoking {} (payload {} bytes)", bin.display(), payload.len()));
    let mut child = Command::new(&bin)
        .arg("sync")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| { cal_log(&format!("sync ERROR spawn: {e}")); e.to_string() })?;
    child
        .stdin
        .take()
        .ok_or("no stdin")?
        .write_all(payload.as_bytes())
        .map_err(|e| e.to_string())?;
    let out = child.wait_with_output().map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&out.stdout);
    let stderr = String::from_utf8_lossy(&out.stderr);
    cal_log(&format!("sync result: status={} stdout={} stderr={}", out.status, stdout.trim(), stderr.trim()));
    if !out.status.success() {
        return Err(format!("{stderr}{stdout}"));
    }
    Ok(stdout.to_string())
}

// Trigger the one-time Calendar permission prompt on demand.
#[tauri::command]
fn calendar_access() -> Result<String, String> {
    let bin = helper_path().ok_or("calendar helper not found")?;
    let out = std::process::Command::new(bin)
        .arg("access")
        .output()
        .map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

// Reconcile Cosmodex tasks into the "Cosmodex" Apple Reminders list. `payload`
// is {"items":[{id,title,due?,notes?,completed?}]} — same shape the helper's
// `remind-sync` command expects.
#[tauri::command]
fn reminders_sync(payload: String) -> Result<String, String> {
    use std::io::Write;
    use std::process::{Command, Stdio};
    let bin = match helper_path() {
        Some(b) => b,
        None => {
            cal_log("remind-sync ERROR: helper binary not found next to the app executable");
            return Err("reminders helper not found".into());
        }
    };
    cal_log(&format!("remind-sync: invoking {} (payload {} bytes)", bin.display(), payload.len()));
    let mut child = Command::new(&bin)
        .arg("remind-sync")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| { cal_log(&format!("remind-sync ERROR spawn: {e}")); e.to_string() })?;
    child
        .stdin
        .take()
        .ok_or("no stdin")?
        .write_all(payload.as_bytes())
        .map_err(|e| e.to_string())?;
    let out = child.wait_with_output().map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&out.stdout);
    let stderr = String::from_utf8_lossy(&out.stderr);
    cal_log(&format!("remind-sync result: status={} stdout={} stderr={}", out.status, stdout.trim(), stderr.trim()));
    if !out.status.success() {
        return Err(format!("{stderr}{stdout}"));
    }
    Ok(stdout.to_string())
}

// Trigger the one-time Reminders permission prompt on demand.
#[tauri::command]
fn reminders_access() -> Result<String, String> {
    let bin = helper_path().ok_or("reminders helper not found")?;
    let out = std::process::Command::new(bin)
        .arg("remind-access")
        .output()
        .map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            // Trigger the Calendar permission prompt from the app process at
            // launch so TCC attributes it to "Cosmodex" (not the spawned helper).
            std::thread::spawn(|| match helper_path() {
                Some(bin) => {
                    cal_log(&format!("startup: helper at {}", bin.display()));
                    match std::process::Command::new(&bin).arg("access").output() {
                        Ok(o) => cal_log(&format!(
                            "startup access: status={} stdout={} stderr={}",
                            o.status,
                            String::from_utf8_lossy(&o.stdout).trim(),
                            String::from_utf8_lossy(&o.stderr).trim()
                        )),
                        Err(e) => cal_log(&format!("startup access ERROR: {e}")),
                    }
                }
                None => cal_log("startup: helper binary NOT FOUND next to the app executable"),
            });
            // Same for Reminders access, attributed to "Cosmodex".
            std::thread::spawn(|| if let Some(bin) = helper_path() {
                match std::process::Command::new(&bin).arg("remind-access").output() {
                    Ok(o) => cal_log(&format!(
                        "startup remind-access: status={} stdout={} stderr={}",
                        o.status,
                        String::from_utf8_lossy(&o.stdout).trim(),
                        String::from_utf8_lossy(&o.stderr).trim()
                    )),
                    Err(e) => cal_log(&format!("startup remind-access ERROR: {e}")),
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            google_sign_in,
            read_daily_note,
            write_daily_note,
            read_daily_template,
            read_capture_file,
            write_capture_file,
            calendar_sync,
            calendar_access,
            reminders_sync,
            reminders_access,
            write_backup,
            chart_toggle,
            chart_close,
            chart_tape,
            chart_is_open
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
