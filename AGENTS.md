# Repository Guidelines

## Project Structure & Module Organization
- `index.html` hosts the menu UI, styles, and bootstraps the game.
- `game.js` contains the full game logic and Web Audio helpers.
- `music/` holds background music assets (`.mp3`).
- `README.md` links to the live demo.

## Build, Test, and Development Commands
- `npm install` installs dependencies (Vite toolchain is present).
- `npm run dev` starts a Vite dev server for local iteration on `index.html`.
- `npm run build` runs `tsc -b` then `vite build` (requires adding `tsconfig.json` if you move to TypeScript).
- `npm run preview` serves the production build output.
- Quick local run without tooling: open `index.html` directly in a browser.

## Coding Style & Naming Conventions
- Indentation: 4 spaces, no tabs.
- JavaScript: use `camelCase` for variables/functions and `PascalCase` for classes.
- Keep DOM ids and classes consistent with existing patterns (e.g., `gameCanvas`, `menuScreen`).
- Prefer small, focused functions; add brief comments only for non-obvious logic.

## Testing Guidelines
- No automated tests are currently configured.
- If you add tests, place them under `tests/` and use `*.test.js` naming.
- Document any new test command in `package.json` and update this guide.

## Commit & Pull Request Guidelines
- Commit history uses short, imperative, lowercase messages (e.g., `add music and splitscreen`).
- PRs should include:
  - A concise description of user-facing changes.
  - Screenshots or short clips for UI/gameplay changes.
  - Notes on new assets added under `music/` (source/license if applicable).

## Assets & Configuration Notes
- Audio files live in `music/` and are loaded by `game.js`.
- Keep file names lowercase with underscores to match existing assets (e.g., `bgm_action_1.mp3`).
