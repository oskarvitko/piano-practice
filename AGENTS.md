# Piano Practice

The application lives at this repository root. `piano-practice-codex-blue/` contains the original specification and design references only; keep those source documents intact.

Read `piano-practice-codex-blue/AGENTS.md` and its `docs/` before changing behavior. Russian UI, React + strict TypeScript + Vite, local-only PWA, GitHub Pages base `/piano-practice/`. Core music, lesson, review and timer logic must remain independent of React, IndexedDB and bundled program content. Program definitions are immutable; attempts, completion and review schedules belong in Dexie. Never start audio automatically.

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` after changes. Preserve local piano sample attribution. Do not claim real iPhone testing or deployment unless actually performed. See `docs/VERIFICATION.md` for the current verification record.
