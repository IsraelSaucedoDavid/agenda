# Graph Report - espacio-pwa  (2026-07-30)

## Corpus Check
- 11 files · ~9,056 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 102 nodes · 126 edges · 14 communities (11 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `57e42fc9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- server/package.json
- App.jsx
- devDependencies
- index.js
- package.json
- dependencies
- App
- addDays
- Espacio — tu mini-Notion instalable
- rules/graphify.md
- workflows/graphify.md
- Auth.jsx
- emptyBlock

## God Nodes (most connected - your core abstractions)
1. `App()` - 8 edges
2. `todayStr()` - 6 edges
3. `emptyBlock()` - 6 edges
4. `seedWorkspace()` - 6 edges
5. `Espacio — tu mini-Notion instalable` - 6 edges
6. `toStr()` - 5 edges
7. `fromStr()` - 5 edges
8. `addDays()` - 5 edges
9. `newPage()` - 5 edges
10. `AgendaView()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `addDays()` --calls--> `toStr()`  [EXTRACTED]
  src/App.jsx → src/App.jsx  _Bridges community 6 → community 7_
- `seedWorkspace()` --calls--> `todayStr()`  [EXTRACTED]
  src/App.jsx → src/App.jsx  _Bridges community 6 → community 13_
- `seedWorkspace()` --calls--> `addDays()`  [EXTRACTED]
  src/App.jsx → src/App.jsx  _Bridges community 7 → community 13_

## Import Cycles
- None detected.

## Communities (14 total, 3 thin omitted)

### Community 0 - "server/package.json"
Cohesion: 0.13
Nodes (14): cors, express, dependencies, cors, express, sqlite3, description, main (+6 more)

### Community 1 - "App.jsx"
Cohesion: 0.14
Nodes (8): BLOCK_MENU, EMOJIS, MONTHS, MONTHS_S, store, T, TYPE_STYLE, WEEK_S

### Community 2 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, tailwindcss, @tailwindcss/vite, vite, vite-plugin-pwa, @vitejs/plugin-react, tailwindcss, @tailwindcss/vite (+3 more)

### Community 3 - "index.js"
Cohesion: 0.20
Nodes (9): app, cors, db, dbDir, dbPath, express, fs, path (+1 more)

### Community 4 - "package.json"
Cohesion: 0.22
Nodes (8): name, private, scripts, build, dev, preview, type, version

### Community 5 - "dependencies"
Cohesion: 0.22
Nodes (9): lucide-react, dependencies, lucide-react, react, react-dom, @supabase/supabase-js, react, react-dom (+1 more)

### Community 6 - "App"
Cohesion: 0.53
Nodes (5): App(), CalendarView(), pad(), todayStr(), toStr()

### Community 7 - "addDays"
Cohesion: 0.60
Nodes (5): addDays(), AgendaView(), chipLabel(), DateChip(), fromStr()

### Community 8 - "Espacio — tu mini-Notion instalable"
Cohesion: 0.29
Nodes (6): 1. Probarlo en tu compu, 2. Publicarlo gratis en internet, 3. Instalarlo en el celular, Cómo se usa, Espacio — tu mini-Notion instalable, Siguiente paso: compartir con otra persona

### Community 13 - "emptyBlock"
Cohesion: 0.60
Nodes (5): Editor(), emptyBlock(), newPage(), seedWorkspace(), uid()

## Knowledge Gaps
- **49 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+44 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _49 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `server/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._