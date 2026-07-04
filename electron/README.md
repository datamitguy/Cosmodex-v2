# Cosmodex Desktop (Electron)

A thin native wrapper that runs Cosmodex in its own window instead of a browser
tab. It loads the deployed app from GitHub Pages, so it always shows the latest
release and keeps Firebase Google sign-in working (the Pages origin is an
authorized Firebase domain).

## Run it

```bash
cd electron
npm install
npm start
```

To point at a different build (e.g. a local server on :8080):

```bash
COSMODEX_URL=http://localhost:8080/cosmodex-v2.html npm start
```

## Build an installable app

```bash
npm run dist:mac   # → dist/Cosmodex-*.dmg
npm run dist:win   # → dist/Cosmodex Setup *.exe   (run on Windows)
```

## Notes

- **Google sign-in:** the wrapper presents a desktop-Chrome user agent and allows
  the Firebase auth popup window, which avoids Google's "disallowed_useragent"
  error seen in embedded browsers. If popup sign-in ever misbehaves, switch the
  app to `signInWithRedirect`.
- The `electron/` folder is not part of the web deploy — GitHub Pages ignores it.
