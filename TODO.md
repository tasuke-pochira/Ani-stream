# 📋 AniStream — TODO & Roadmap

> **Version**: 1.0.0  
> **Maintainer**: [@3cstat1c.fl](https://instagram.com/3cstat1c.fl)

---

## 🔴 Priority: High

- [ ] **Add more scraper providers** — Current chain is thin (2 providers). Research and integrate:
  - [ ] AllAnime direct API (if stable endpoints surface)
  - [ ] Zoro.to / AniWatch mirror scraper
  - [ ] 9anime provider with token rotation
  - [ ] Gogoanime v2 mirror detection
- [ ] **Implement scraper auto-updater** — Providers go down frequently. Add a remote config (e.g. GitHub Gist) that the app fetches to update domain lists without needing a new build.
- [ ] **Fix DDoS-Guard bypass reliability** — Current Puppeteer approach works but is slow (~8s). Investigate cookie-based bypass with `tough-cookie` to avoid spawning a browser entirely.
- [ ] **Add error recovery UI** — When all scrapers fail, show a user-friendly modal with a "Try Again" button and manual search option instead of silently falling back.

---

## 🟡 Priority: Medium

- [ ] **Subtitle support** — Detect and pass subtitle tracks (ASS/SRT) to MPV via `--sub-file`.
- [ ] **Download manager** — Implement progress bars and queue management for episode downloads.
- [ ] **Episode auto-play** — After an episode finishes in MPV, automatically resolve and play the next one.
- [ ] **MAL sync improvements** — Auto-update episode count on MAL when playback completes (currently requires manual mark).
- [ ] **Search result caching** — Cache Jikan/provider search results in SQLite to reduce API calls and speed up repeat searches.
- [ ] **Multi-page episode lists** — Some providers paginate episodes. Add pagination crawling for anime with 24+ episodes.
- [ ] **Quality preference memory** — Remember the user's last-used quality per anime instead of always defaulting to 1080p.

---

## 🟢 Priority: Low (Nice to Have)

- [ ] **Theme system** — Add a light mode and allow custom accent colors from the settings page.
- [ ] **Notification system** — Desktop toast notifications for new episodes of tracked anime (integrate with MAL watchlist).
- [ ] **Linux/macOS builds** — Extend the build system to produce `.AppImage` and `.dmg` packages.
- [ ] **Keyboard shortcuts** — Global hotkeys for play/pause, next episode, search.
- [ ] **Watch history timeline** — Visual timeline showing what was watched and when.
- [ ] **Plugin system** — Allow community-contributed scrapers as drop-in JS modules in a `plugins/` directory.
- [ ] **Bandwidth limiter** — Add a setting to cap download/streaming bandwidth.

---

## 🐛 Known Issues

- [ ] Self-signed certificate triggers Windows SmartScreen on first run — needs a proper code signing certificate ($200+/yr).
- [ ] MPV sometimes doesn't exit cleanly on Windows — leaves orphaned processes. Investigate `--input-ipc-server` for graceful shutdown.
- [ ] Browser profile temp dirs in `%TEMP%` may accumulate if the app crashes mid-scrape — add cleanup on startup.
- [ ] `pkg` warnings about dynamic `require()` — cosmetic only, does not affect functionality.

---

## ✅ Completed (v1.0.0)

- [x] Multi-source stream resolver with title normalization
- [x] Portable Windows build with bundled dependencies (MPV, ffmpeg, git, fzf)
- [x] System health diagnostics panel
- [x] MAL OAuth integration
- [x] Self-signing pipeline
- [x] Inno Setup installer with user-defined install path
- [x] Puppeteer `exec()` + `connect()` workaround for pkg compatibility
- [x] String-based `evaluate()` calls to prevent esbuild function mangling
- [x] Developer branding and versioning
