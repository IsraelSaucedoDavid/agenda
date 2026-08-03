# Graph Report - espacio-pwa  (2026-07-31)

## Corpus Check
- 14 files · ~22,316 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 120 nodes · 147 edges · 14 communities (12 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e6ae421e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- server/package.json
- App.jsx
- devDependencies
- index.js
- package.json
- dependencies
- 🛡️ Reglas de Buenas Prácticas y Qué NO Hacer al Realizar Correcciones
- App
- Espacio — tu mini-Notion instalable
- rules/graphify.md
- workflows/graphify.md

## God Nodes (most connected - your core abstractions)
1. `App()` - 9 edges
2. `todayStr()` - 7 edges
3. `toStr()` - 6 edges
4. `fromStr()` - 6 edges
5. `emptyBlock()` - 6 edges
6. `seedWorkspace()` - 6 edges
7. `Espacio — tu mini-Notion instalable` - 6 edges
8. `uid()` - 5 edges
9. `addDays()` - 5 edges
10. `newPage()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `emptyBlock()` --calls--> `uid()`  [EXTRACTED]
  src/App.jsx → src/App.jsx  _Bridges community 1 → community 7_

## Import Cycles
- None detected.

## Communities (14 total, 2 thin omitted)

### Community 0 - "server/package.json"
Cohesion: 0.13
Nodes (14): cors, express, dependencies, cors, express, sqlite3, description, main (+6 more)

### Community 1 - "App.jsx"
Cohesion: 0.09
Nodes (13): AudioBlock(), BLOCK_MENU, EMOJIS, ImageBlock(), MONTHS, MONTHS_S, store, T (+5 more)

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

### Community 6 - "🛡️ Reglas de Buenas Prácticas y Qué NO Hacer al Realizar Correcciones"
Cohesion: 0.50
Nodes (3): ✅ Lista de Verificación (Checklist) Antes de Cada Commit, 🚫 Qué NO Hacer al Hacer una Corrección, 🛡️ Reglas de Buenas Prácticas y Qué NO Hacer al Realizar Correcciones

### Community 7 - "App"
Cohesion: 0.22
Nodes (16): addDays(), AgendaView(), AnalyticsView(), App(), CalendarView(), chipLabel(), DateChip(), Editor() (+8 more)

### Community 8 - "Espacio — tu mini-Notion instalable"
Cohesion: 0.29
Nodes (6): 1. Probarlo en tu compu, 2. Publicarlo gratis en internet, 3. Instalarlo en el celular, Cómo se usa, Espacio — tu mini-Notion instalable, Siguiente paso: compartir con otra persona

## Knowledge Gaps
- **53 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+48 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _53 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `server/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09116809116809117 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._