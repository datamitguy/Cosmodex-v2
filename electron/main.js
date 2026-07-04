// Cosmodex desktop — thin Electron wrapper around the deployed web app.
//
// WHY load the hosted URL (not local files): Firebase Google sign-in only works
// from an *authorized domain*. The GitHub Pages origin (datamitguy.github.io) is
// already whitelisted in the Firebase console and every deploy lands there, so a
// remote load keeps auth working and stays automatically up to date. A file://
// load would use an unauthorized origin and break sign-in.
//
// Set COSMODEX_URL to point at a different build (e.g. a local http server).

const { app, BrowserWindow, shell, Menu } = require('electron');

const APP_URL = process.env.COSMODEX_URL
  || 'https://datamitguy.github.io/Cosmodex-v2/cosmodex-v2.html';

// Google's OAuth screen refuses "embedded" user agents. Presenting a plain,
// desktop-Chrome-like UA on the auth host avoids the "disallowed_useragent"
// error when signInWithPopup opens accounts.google.com.
const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#000000',
    title: 'Cosmodex',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadURL(APP_URL, { userAgent: DESKTOP_UA });

  // Firebase signInWithPopup opens a child window — allow it (with the same UA)
  // instead of swallowing it, so Google auth completes inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/accounts\.google\.com|firebaseapp\.com|__\/auth/.test(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520, height: 680, backgroundColor: '#ffffff',
          webPreferences: { contextIsolation: true, nodeIntegration: false }
        }
      };
    }
    // Any other external link opens in the user's real browser.
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// Give child (popup) windows the desktop UA too.
app.on('web-contents-created', (_e, contents) => {
  contents.setUserAgent(DESKTOP_UA);
});

app.whenReady().then(() => {
  // Minimal native menu (keeps Cmd+C/V, reload, devtools, quit working).
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
