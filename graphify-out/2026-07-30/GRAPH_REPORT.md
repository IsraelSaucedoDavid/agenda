# Graph Report - espacio-pwa  (2026-07-30)

## Corpus Check
- 13 files · ~15,125 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 112 nodes · 137 edges · 16 communities (13 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `882ecb5b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- server/package.json
- App.jsx
- devDependencies
- index.js
- package.json
- dependencies
- todayStr
- addDays
- Espacio — tu mini-Notion instalable
- rules/graphify.md
- workflows/graphify.md
- App
- Auth.jsx

## God Nodes (most connected - your core abstractions)
1. `App()` - 9 edges
2. `todayStr()` - 6 edges
3. `emptyBlock()` - 6 edges
4. `seedWorkspace()` - 6 edges
5. `Espacio — tu mini-Notion instalable` - 6 edges
6. `uid()` - 5 edges
7. `toStr()` - 5 edges
8. `fromStr()` - 5 edges
9. `addDays()` - 5 edges
10. `newPage()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `pad()`  [EXTRACTED]
  src/App.jsx → src/App.jsx  _Bridges community 6 → community 12_
- `addDays()` --calls--> `toStr()`  [EXTRACTED]
  src/App.jsx → src/App.jsx  _Bridges community 6 → community 7_
- `seedWorkspace()` --calls--> `addDays()`  [EXTRACTED]
  src/App.jsx → src/App.jsx  _Bridges community 7 → community 12_

## Import Cycles
- None detected.

## Communities (16 total, 3 thin omitted)

### Community 0 - "server/package.json"
Cohesion: 0.13
Nodes (14): cors, express, dependencies, cors, express, sqlite3, description, main (+6 more)

### Community 1 - "App.jsx"
Cohesion: 0.12
Nodes (8): BLOCK_MENU, EMOJIS, MONTHS, MONTHS_S, store, T, TYPE_STYLE, WEEK_S

### Community 2 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, tailwindcss, @tailwindcss/vite, vite, vite-plugin-pwa, @vitejs/plugin-react, web-push, workbox-precaching (+7 more)

### Community 3 - "index.js"
Cohesion: 0.20
Nodes (9): app, cors, db, dbDir, dbPath, express, fs, path (+1 more)

### Community 4 - "package.json"
Cohesion: 0.22
Nodes (8): name, private, scripts, build, dev, preview, type, version

### Community 5 - "dependencies"
Cohesion: 0.22
Nodes (9): lucide-react, dependencies, lucide-react, react, react-dom, @supabase/supabase-js, react, react-dom (+1 more)

### Community 6 - "todayStr"
Cohesion: 0.67
Nodes (4): CalendarView(), pad(), todayStr(), toStr()

### Community 7 - "addDays"
Cohesion: 0.60
Nodes (5): addDays(), AgendaView(), chipLabel(), DateChip(), fromStr()

### Community 8 - "Espacio — tu mini-Notion instalable"
Cohesion: 0.29
Nodes (6): 1. Probarlo en tu compu, 2. Publicarlo gratis en internet, 3. Instalarlo en el celular, Cómo se usa, Espacio — tu mini-Notion instalable, Siguiente paso: compartir con otra persona

### Community 12 - "App"
Cohesion: 0.29
Nodes (9): App(), AudioBlock(), Editor(), emptyBlock(), ImageBlock(), newPage(), seedWorkspace(), uid() (+1 more)

## Knowledge Gaps
- **51 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+46 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _51 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `server/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._