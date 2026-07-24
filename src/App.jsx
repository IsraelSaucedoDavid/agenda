import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Plus, Search, Trash2, ChevronRight, ChevronDown, ChevronLeft,
  Type, Heading1, Heading2, Heading3, CheckSquare, List, ListOrdered,
  Quote, Minus, MessageSquare, PanelLeftClose, PanelLeft, CornerDownRight,
  FileText, CalendarDays, ListChecks, X, Sun, Moon, Settings, Download, Upload, Bell,
} from "lucide-react";

/* ------------------------------------------------------------------ *
 *  Espacio — páginas, notas, pendientes y calendario.
 *  Guarda en este dispositivo (localStorage). Tema claro/oscuro,
 *  recordatorios y respaldo export/import.
 * ------------------------------------------------------------------ */

const KEY = "espacio:v2";
const SETTINGS_KEY = "espacio:settings";
const uid = () => Math.random().toString(36).slice(2, 10);

const store = {
  load() { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch { return null; } },
  save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* sin espacio */ } },
};

/* ---- utilidades de fecha (cadenas YYYY-MM-DD en hora local) ---- */
const MONTHS = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const MONTHS_S = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const WEEK_S = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const pad = n => String(n).padStart(2, "0");
const toStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => toStr(new Date());
const fromStr = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = fromStr(s); d.setDate(d.getDate() + n); return toStr(d); };
const chipLabel = (date, time) => {
  const d = fromStr(date);
  const base = `${d.getDate()} ${MONTHS_S[d.getMonth()]}`;
  return time ? `${base}, ${time}` : base;
};

const EMOJIS = ["📄","📝","✅","💡","🎯","📊","💰","🚀","📅","🔥","⭐","📌","🗂️","🧠","🛠️","☕"];

const BLOCK_MENU = [
  { type: "text",    label: "Texto",     hint: "Escribe en plano",    icon: Type },
  { type: "h1",      label: "Título 1",   hint: "Encabezado grande",   icon: Heading1 },
  { type: "h2",      label: "Título 2",   hint: "Encabezado mediano",  icon: Heading2 },
  { type: "h3",      label: "Título 3",   hint: "Encabezado chico",    icon: Heading3 },
  { type: "todo",    label: "Pendiente",  hint: "Casilla con fecha",   icon: CheckSquare },
  { type: "bullet",  label: "Lista",      hint: "Lista con viñetas",   icon: List },
  { type: "number",  label: "Lista num.", hint: "Lista numerada",      icon: ListOrdered },
  { type: "quote",   label: "Cita",       hint: "Bloque destacado",    icon: Quote },
  { type: "callout", label: "Nota",       hint: "Aviso con recuadro",  icon: MessageSquare },
  { type: "divider", label: "Separador",  hint: "Línea divisoria",     icon: Minus },
];

const emptyBlock = (type = "text") => ({ id: uid(), type, text: "", checked: false, date: null, time: null, completedAt: null });
const newPage = (parentId = null) => ({ id: uid(), title: "", icon: "📄", parentId, blocks: [emptyBlock()] });

/* ================================================================== */

export default function App() {
  const [pages, setPages] = useState({});
  const [order, setOrder] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [view, setView] = useState("docs");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState("light");
  const [notifOn, setNotifOn] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState("synced"); // "synced", "syncing", "offline"

  /* --- cliente de sincronización --- */
  const syncWithServer = useCallback(async (localData) => {
    if (!localData || !localData.order?.length) return;
    setSyncStatus("syncing");
    try {
      const res = await fetch("/api/sync");
      if (!res.ok) throw new Error("HTTP error " + res.status);
      const serverData = await res.json();

      // Caso 1: Servidor no tiene datos guardados todavía
      if (!serverData.updatedAt) {
        const uploadRes = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(localData),
        });
        if (!uploadRes.ok) throw new Error("Upload error");
        setSyncStatus("synced");
        return;
      }

      const localTime = new Date(localData.updatedAt || 0).getTime();
      const serverTime = new Date(serverData.updatedAt || 0).getTime();

      // Caso 2: El servidor tiene datos más recientes
      if (serverTime > localTime) {
        setPages(serverData.pages);
        setOrder(serverData.order);
        try { localStorage.setItem(KEY, JSON.stringify(serverData)); } catch {}
        setSyncStatus("synced");
      }
      // Caso 3: El cliente tiene datos más recientes (cambios locales offline)
      else if (localTime > serverTime) {
        const uploadRes = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(localData),
        });
        if (!uploadRes.ok) throw new Error("Upload error");
        setSyncStatus("synced");
      }
      // Caso 4: Están iguales
      else {
        setSyncStatus("synced");
      }
    } catch (err) {
      console.warn("Sincronización fallida:", err);
      setSyncStatus("offline");
    }
  }, []);

  /* --- carga de contenido --- */
  useEffect(() => {
    const data = store.load();
    let initialData = data;
    if (data && data.order?.length) {
      setPages(data.pages); setOrder(data.order); setCurrentId(data.order[0]);
    } else {
      const seed = seedWorkspace();
      const t = new Date().toISOString();
      const seedWithTime = { ...seed, updatedAt: t };
      setPages(seedWithTime.pages); setOrder(seedWithTime.order); setCurrentId(seedWithTime.order[0]);
      store.save(seedWithTime);
      initialData = seedWithTime;
    }
    setLoading(false);
    syncWithServer(initialData);
  }, [syncWithServer]);

  /* --- carga de ajustes --- */
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      if (s.theme) setTheme(s.theme);
      else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) setTheme("dark");
      if (s.notifOn && "Notification" in window && Notification.permission === "granted") setNotifOn(true);
    } catch { /* nada */ }
  }, []);

  /* --- aplica y guarda tema/ajustes --- */
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme, notifOn })); } catch { /* nada */ }
  }, [theme, notifOn]);

  /* --- guarda contenido --- */
  const saveTimer = useRef();
  useEffect(() => {
    if (loading) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const t = new Date().toISOString();
      const payload = { pages, order, updatedAt: t };
      store.save(payload);
      syncWithServer(payload);
    }, 1200);
  }, [pages, order, loading, syncWithServer]);

  const page = pages[currentId];

  const updatePage = useCallback((id, patch) => setPages(p => ({ ...p, [id]: { ...p[id], ...patch } })), []);
  const updateBlockInPage = useCallback((pageId, blockId, patch) => {
    setPages(p => {
      const pg = p[pageId]; if (!pg) return p;
      return { ...p, [pageId]: { ...pg, blocks: pg.blocks.map(b => (b.id === blockId ? { ...b, ...patch } : b)) } };
    });
  }, []);
  const toggleDone = useCallback((pageId, blockId, checked) => {
    updateBlockInPage(pageId, blockId, { checked, completedAt: checked ? new Date().toISOString() : null });
  }, [updateBlockInPage]);

  const addPage = (parentId = null) => {
    const np = newPage(parentId);
    setPages(p => ({ ...p, [np.id]: np }));
    setOrder(o => [...o, np.id]);
    if (parentId) setExpanded(e => ({ ...e, [parentId]: true }));
    setCurrentId(np.id); setView("docs");
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const deletePage = (id) => {
    const toRemove = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const pid of order) {
        const pg = pages[pid];
        if (pg && pg.parentId && toRemove.has(pg.parentId) && !toRemove.has(pid)) { toRemove.add(pid); changed = true; }
      }
    }
    setPages(p => { const next = { ...p }; toRemove.forEach(x => delete next[x]); return next; });
    setOrder(o => {
      const next = o.filter(x => !toRemove.has(x));
      if (toRemove.has(currentId)) setCurrentId(next[0] || null);
      return next;
    });
  };

  const quickAdd = (text, date, time, checked = false) => {
    if (!text || !text.trim()) return;
    const block = {
      ...emptyBlock("todo"),
      text: text.trim(),
      date: date || null,
      time: time || null,
      checked,
      completedAt: checked ? new Date().toISOString() : null
    };
    const inboxId = order.find(pid => pages[pid]?.inbox);
    if (!inboxId) {
      const np = { ...newPage(null), icon: "📥", title: "Bandeja de entrada", inbox: true, blocks: [block] };
      setPages(p => ({ ...p, [np.id]: np }));
      setOrder(o => [...o, np.id]);
    } else {
      setPages(p => {
        const pg = p[inboxId];
        const cleaned = pg.blocks.filter(b => !(b.type === "text" && b.text === ""));
        return { ...p, [inboxId]: { ...pg, blocks: [...cleaned, block] } };
      });
    }
  };

  const gotoTask = (pageId) => {
    setCurrentId(pageId); setView("docs");
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const childrenOf = useCallback((pid) => order.filter(id => pages[id]?.parentId === pid), [order, pages]);
  const roots = order.filter(id => !pages[id]?.parentId);

  const allTodos = useMemo(() => {
    const list = [];
    for (const pid of order) {
      const pg = pages[pid]; if (!pg) continue;
      for (const b of pg.blocks) {
        if (b.type === "todo" && b.text.trim()) {
          list.push({ pageId: pid, pageTitle: pg.title || "Sin título", pageIcon: pg.icon, blockId: b.id,
                      text: b.text, checked: b.checked, date: b.date || null, time: b.time || null, completedAt: b.completedAt || null });
        }
      }
    }
    return list;
  }, [order, pages]);

  /* --- recordatorios: revisa cada 20s y avisa a la hora exacta --- */
  const todosRef = useRef(allTodos);
  const notifiedRef = useRef(new Set());
  useEffect(() => { todosRef.current = allTodos; }, [allTodos]);
  useEffect(() => {
    if (!notifOn) return;
    const tick = () => {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      const now = new Date();
      const day = toStr(now);
      const hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      for (const t of todosRef.current) {
        if (t.checked || !t.date || !t.time) continue;
        if (t.date === day && t.time === hm && !notifiedRef.current.has(t.blockId)) {
          notifiedRef.current.add(t.blockId);
          try { new Notification("⏰ " + t.text, { body: `${t.pageIcon} ${t.pageTitle}`, icon: "/icon-192.png" }); } catch { /* nada */ }
        }
      }
    };
    const iv = setInterval(tick, 20000);
    tick();
    return () => clearInterval(iv);
  }, [notifOn]);

  const enableNotifs = async () => {
    if (!("Notification" in window)) { alert("Este navegador no soporta notificaciones."); return; }
    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted") setNotifOn(true);
      else alert("No se concedió el permiso de notificaciones.");
    } catch { alert("No se pudo activar los recordatorios."); }
  };

  /* --- respaldo --- */
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ pages, order, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `espacio-respaldo-${todayStr()}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const importData = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.pages || !Array.isArray(data.order)) throw new Error("formato");
        if (!confirm("Esto reemplazará TODO tu contenido actual con el del respaldo. ¿Continuar?")) return;
        setPages(data.pages); setOrder(data.order); setCurrentId(data.order[0] || null);
        setSettingsOpen(false);
        alert("Respaldo importado con éxito.");
      } catch { alert("El archivo no es un respaldo válido de Espacio."); }
    };
    reader.readAsText(file);
  };

  const searchHits = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return order.filter(id => {
      const pg = pages[id]; if (!pg) return false;
      return (pg.title || "").toLowerCase().includes(q) || pg.blocks.some(b => (b.text || "").toLowerCase().includes(q));
    });
  }, [search, order, pages]);

  const selectPage = (id) => { setCurrentId(id); setView("docs"); if (window.innerWidth < 768) setSidebarOpen(false); };

  if (loading) {
    return <div className="flex h-full items-center justify-center" style={{ background: T.bg }}>
      <div className="text-sm" style={{ color: T.muted }}>Abriendo tu espacio…</div></div>;
  }

  const NavBtn = ({ id, icon: Icon, label }) => (
    <button onClick={() => { setView(id); if (window.innerWidth < 768) setSidebarOpen(false); }}
            className="flex flex-1 flex-col items-center gap-1 rounded-md py-1.5 text-[11px] font-medium transition"
            style={{ background: view === id ? T.accentSoft : "transparent", color: view === id ? T.accent : T.muted }}>
      <Icon size={16} /> {label}
    </button>
  );

  return (
    <div className="flex h-full w-full overflow-hidden font-sans" style={{ background: T.bg, color: T.ink }}>
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-20 bg-black/30 md:hidden" />}

      {sidebarOpen && (
        <aside className="fixed z-30 flex h-full w-64 flex-shrink-0 flex-col border-r md:static" style={{ background: T.sidebar, borderColor: T.border }}>
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-md text-xs font-bold text-white" style={{ background: T.accent }}>E</span>
              <span className="font-serif text-[15px] font-semibold tracking-tight">Espacio</span>
              <div className="flex items-center ml-1" title={
                syncStatus === "synced" ? "Sincronizado con el servidor" : 
                syncStatus === "syncing" ? "Sincronizando..." : 
                "Sin conexión (guardado en este dispositivo)"
              }>
                {syncStatus === "syncing" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                )}
                {syncStatus === "synced" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                )}
                {syncStatus === "offline" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                )}
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="hov rounded p-1"><PanelLeftClose size={16} style={{ color: T.muted }} /></button>
          </div>

          <div className="flex gap-1 px-3 pb-2">
            <NavBtn id="docs" icon={FileText} label="Páginas" />
            <NavBtn id="calendar" icon={CalendarDays} label="Calendario" />
            <NavBtn id="agenda" icon={ListChecks} label="Agenda" />
          </div>

          <div className="px-3 pb-2">
            <div className="flex items-center gap-2 rounded-md border px-2 py-1.5" style={{ borderColor: T.border, background: T.bg }}>
              <Search size={14} style={{ color: T.muted }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar"
                     className="w-full bg-transparent text-[13px] outline-none placeholder:text-neutral-400" style={{ color: T.ink }} />
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 pb-4">
            {searchHits ? (
              <div className="pt-1">
                {searchHits.length === 0 && <p className="px-2 py-2 text-[13px]" style={{ color: T.muted }}>Sin resultados.</p>}
                {searchHits.map(id => <PageRow key={id} pg={pages[id]} depth={0} active={id === currentId} onClick={() => selectPage(id)} />)}
              </div>
            ) : (
              <Tree roots={roots} childrenOf={childrenOf} pages={pages} currentId={currentId} view={view}
                    selectPage={selectPage} expanded={expanded} setExpanded={setExpanded} addPage={addPage} deletePage={deletePage} />
            )}
          </nav>

          <div className="border-t px-2 py-2" style={{ borderColor: T.border }}>
            <button onClick={() => addPage(null)} className="hov flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium" style={{ color: T.accent }}>
              <Plus size={15} /> Nueva página
            </button>
            <div className="mt-1 flex gap-1">
              <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="hov flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px]" style={{ color: T.muted }}>
                {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />} {theme === "dark" ? "Claro" : "Oscuro"}
              </button>
              <button onClick={() => setSettingsOpen(true)} className="hov flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px]" style={{ color: T.muted }}>
                <Settings size={14} /> Ajustes
              </button>
            </div>
          </div>
        </aside>
      )}

      <main className="relative flex h-full flex-1 flex-col overflow-y-auto">
        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)} className="hov absolute left-3 top-3 z-10 rounded p-1.5"><PanelLeft size={17} style={{ color: T.muted }} /></button>
        )}

        {view === "calendar" ? (
          <CalendarView todos={allTodos} gotoTask={gotoTask} toggleDone={toggleDone} quickAdd={quickAdd} />
        ) : view === "agenda" ? (
          <AgendaView todos={allTodos} gotoTask={gotoTask} toggleDone={toggleDone} quickAdd={quickAdd} />
        ) : page ? (
          <Editor key={page.id} page={page} updatePage={updatePage} updateBlockInPage={updateBlockInPage}
                  onAddSub={() => addPage(page.id)} onDelete={() => deletePage(page.id)} />
        ) : (
          <div className="grid flex-1 place-items-center px-6 text-center">
            <div>
              <div className="mb-3 text-4xl">🗂️</div>
              <p className="mb-1 font-serif text-lg">Tu espacio está vacío</p>
              <p className="mb-4 text-sm" style={{ color: T.muted }}>Crea tu primera página para empezar.</p>
              <button onClick={() => addPage(null)} className="rounded-md px-4 py-2 text-sm font-medium text-white transition" style={{ background: T.accent }}>Crear página</button>
            </div>
          </div>
        )}
      </main>

      {settingsOpen && (
        <SettingsModal theme={theme} setTheme={setTheme} notifOn={notifOn} enableNotifs={enableNotifs}
                       onExport={exportData} onImport={importData} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}

/* ================= Ajustes ================= */
function SettingsModal({ theme, setTheme, notifOn, enableNotifs, onExport, onImport, onClose }) {
  const fileRef = useRef(null);
  const themeBtn = (val, Icon, label) => (
    <button onClick={() => setTheme(val)} className="flex flex-1 items-center justify-center gap-1.5 rounded-md border py-2 text-[13px]"
            style={{ borderColor: theme === val ? T.accent : T.border, color: theme === val ? T.accent : T.ink, fontWeight: theme === val ? 600 : 400 }}>
      <Icon size={15} /> {label}
    </button>
  );
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-xl border p-5 shadow-2xl" style={{ background: T.bg, borderColor: T.border, color: T.ink }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg font-bold">Ajustes</h2>
          <button onClick={onClose} className="hov rounded p-1"><X size={16} style={{ color: T.muted }} /></button>
        </div>

        <section className="mb-4">
          <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide" style={{ color: T.muted }}>Apariencia</p>
          <div className="flex gap-2">{themeBtn("light", Sun, "Claro")}{themeBtn("dark", Moon, "Oscuro")}</div>
        </section>

        <section className="mb-4">
          <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide" style={{ color: T.muted }}>Recordatorios</p>
          {notifOn ? (
            <div className="flex items-start gap-2 rounded-md border px-3 py-2 text-[13px]" style={{ borderColor: T.border, color: T.accent }}>
              <Bell size={15} className="mt-0.5 flex-shrink-0" /> Activados. Te avisa a la hora de cada tarea, mientras la app esté abierta.
            </div>
          ) : (
            <button onClick={enableNotifs} className="flex w-full items-center justify-center gap-1.5 rounded-md py-2 text-[13px] font-medium text-white" style={{ background: T.accent }}>
              <Bell size={15} /> Activar recordatorios
            </button>
          )}
        </section>

        <section>
          <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide" style={{ color: T.muted }}>Datos (respaldo)</p>
          <div className="flex gap-2">
            <button onClick={onExport} className="hov flex flex-1 items-center justify-center gap-1.5 rounded-md border py-2 text-[13px]" style={{ borderColor: T.border }}>
              <Download size={15} /> Exportar
            </button>
            <button onClick={() => fileRef.current?.click()} className="hov flex flex-1 items-center justify-center gap-1.5 rounded-md border py-2 text-[13px]" style={{ borderColor: T.border }}>
              <Upload size={15} /> Importar
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
                   onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ""; }} />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed" style={{ color: T.muted }}>
            Tus datos viven solo en este dispositivo. Exporta de vez en cuando para no perderlos y para pasarlos a otro aparato.
          </p>
        </section>
      </div>
    </div>
  );
}

/* ================= Árbol lateral ================= */
function Tree({ roots, childrenOf, pages, currentId, view, selectPage, expanded, setExpanded, addPage, deletePage }) {
  const render = (id, depth) => {
    const pg = pages[id]; if (!pg) return null;
    const kids = childrenOf(id); const open = expanded[id];
    return (
      <div key={id}>
        <PageRow pg={pg} depth={depth} active={id === currentId && view === "docs"} hasKids={kids.length > 0} open={open}
                 onToggle={() => setExpanded(e => ({ ...e, [id]: !e[id] }))} onClick={() => selectPage(id)}
                 onAddSub={() => addPage(id)}
                 onDelete={() => { if (confirm(`¿Borrar "${pg.title || "Sin título"}" y sus sub-páginas?`)) deletePage(id); }} />
        {open && kids.map(k => render(k, depth + 1))}
      </div>
    );
  };
  if (roots.length === 0) return <p className="px-2 pt-2 text-[13px]" style={{ color: T.muted }}>Aún no hay páginas.</p>;
  return <div className="pt-1">{roots.map(r => render(r, 0))}</div>;
}

function PageRow({ pg, depth, active, hasKids, open, onToggle, onClick, onAddSub, onDelete }) {
  return (
    <div className="hov group flex items-center rounded-md pr-1" style={{ paddingLeft: 4 + depth * 14, background: active ? T.accentSoft : "transparent" }}>
      {hasKids ? (
        <button onClick={onToggle} className="hov rounded p-0.5">
          {open ? <ChevronDown size={13} style={{ color: T.muted }} /> : <ChevronRight size={13} style={{ color: T.muted }} />}
        </button>
      ) : <span className="w-[18px]" />}
      <button onClick={onClick} className="flex flex-1 items-center gap-1.5 truncate py-1.5 text-left text-[13px]">
        <span className="text-[13px] leading-none">{pg.icon}</span>
        <span className="truncate" style={{ fontWeight: active ? 600 : 400 }}>{pg.title || "Sin título"}</span>
      </button>
      {onAddSub && (
        <div className="flex opacity-0 transition group-hover:opacity-100">
          <button onClick={onAddSub} title="Sub-página" className="hov rounded p-1"><Plus size={13} style={{ color: T.muted }} /></button>
          <button onClick={onDelete} title="Borrar" className="hov rounded p-1"><Trash2 size={13} style={{ color: T.muted }} /></button>
        </div>
      )}
    </div>
  );
}

/* ================= Vista Calendario ================= */
function CalendarView({ todos, gotoTask, toggleDone, quickAdd }) {
  const now = new Date();
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [addModal, setAddModal] = useState(null); // null o { date, text, time, checked }
  const today = todayStr();
  const [selectedDate, setSelectedDate] = useState(today);

  const byDate = useMemo(() => {
    const map = {};
    for (const t of todos) { if (!t.date) continue; (map[t.date] ||= []).push(t); }
    for (const k in map) map[k].sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
    return map;
  }, [todos]);

  const first = new Date(cur.y, cur.m, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(cur.y, cur.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${cur.y}-${pad(cur.m + 1)}-${pad(d)}`);

  const shift = (n) => setCur(c => { const d = new Date(c.y, c.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const goToday = () => { setCur({ y: now.getFullYear(), m: now.getMonth() }); setSelectedDate(today); };
  
  const handleSaveModal = () => {
    if (addModal && addModal.text.trim()) {
      quickAdd(addModal.text, addModal.date, addModal.time || null, addModal.checked);
      setSelectedDate(addModal.date); // Select the day of the newly added activity
      setAddModal(null);
    }
  };

  const fieldStyle = { borderColor: T.border, background: "var(--card)", color: T.ink };

  return (
    <div className="mx-auto w-full max-w-4xl px-3 pb-24 pt-14 sm:px-8">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="font-serif text-xl md:text-2xl font-bold capitalize">{MONTHS[cur.m]} {cur.y}</h1>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => shift(-1)} className="hov rounded-md border p-1.5" style={{ borderColor: T.border }}><ChevronLeft size={16} /></button>
          <button onClick={goToday} className="hov rounded-md border px-3 py-1.5 text-[13px] font-medium" style={{ borderColor: T.border }}>Hoy</button>
          <button onClick={() => shift(1)} className="hov rounded-md border p-1.5" style={{ borderColor: T.border }}><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border" style={{ borderColor: T.border, background: T.border }}>
        {WEEK_S.map(w => <div key={w} className="py-2 text-center text-[10px] md:text-[11px] font-semibold" style={{ background: T.sidebar, color: T.muted }}>{w}</div>)}
        {cells.map((ds, i) => {
          if (!ds) return <div key={i} style={{ background: T.bg }} className="min-h-[56px] md:min-h-[92px]" />;
          const items = byDate[ds] || [];
          const isToday = ds === today;
          const isSelected = ds === selectedDate;
          return (
            <div key={ds} onClick={() => setSelectedDate(ds)}
                 className="group min-h-[56px] md:min-h-[92px] p-1 md:p-1.5 cursor-pointer transition select-none relative"
                 style={{
                   background: T.bg,
                   boxShadow: isSelected ? `inset 0 0 0 2px ${T.accent}` : "none",
                   zIndex: isSelected ? 10 : "auto"
                 }}>
              <div className="mb-1 flex items-center justify-between">
                <span className="grid h-5 w-5 place-items-center rounded-full text-[10px] md:text-[11px] font-medium" style={{ background: isToday ? T.accent : "transparent", color: isToday ? "#fff" : T.muted }}>{fromStr(ds).getDate()}</span>
                <button onClick={(e) => { e.stopPropagation(); setAddModal({ date: ds, text: "", time: "", checked: false }); }}
                        className="opacity-0 md:group-hover:opacity-100 transition"><Plus size={12} style={{ color: T.muted }} /></button>
              </div>

              {/* Vista escritorio: Texto de tareas (max 3) */}
              <div className="hidden md:block space-y-1">
                {items.slice(0, 3).map(t => (
                  <div key={t.blockId} className="group/item flex items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] transition hover:brightness-95"
                       style={{ background: t.checked ? T.border : T.accentSoft, color: t.checked ? T.muted : T.ink }}
                       onClick={(e) => e.stopPropagation() /* Prevent day selection change when clicking inner buttons */}>
                    <button onClick={(e) => { e.stopPropagation(); toggleDone(t.pageId, t.blockId, !t.checked); }}
                            className="grid h-3.5 w-3.5 flex-shrink-0 place-items-center rounded border transition"
                            style={{ borderColor: t.checked ? T.accent : T.border, background: t.checked ? T.accent : "transparent" }}>
                      {t.checked && <CheckSquare size={9} className="text-white" strokeWidth={3} />}
                    </button>
                    <button onClick={() => gotoTask(t.pageId)} title={t.text}
                            className="min-w-0 flex-1 truncate text-left"
                            style={{ textDecoration: t.checked ? "line-through" : "none" }}>
                      {t.time ? `${t.time} ` : ""}{t.text}
                    </button>
                  </div>
                ))}
                {items.length > 3 && <span className="px-1 text-[10px]" style={{ color: T.muted }}>+{items.length - 3} más</span>}
              </div>

              {/* Vista móvil: Indicadores de puntos compactos */}
              <div className="flex md:hidden flex-wrap justify-center gap-0.5 mt-0.5">
                {items.slice(0, 4).map(t => (
                  <span key={t.blockId} className="h-1.5 w-1.5 rounded-full"
                        style={{ background: t.checked ? T.border : T.accent }} />
                ))}
                {items.length > 4 && <span className="text-[8px] leading-none" style={{ color: T.muted }}>+</span>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 hidden md:block text-[12px]" style={{ color: T.muted }}>Pasa el cursor por un día y pulsa <Plus size={11} className="inline" /> para agendar. Toca una tarea para ir a su página.</p>
      <p className="mt-2 block md:hidden text-[11px]" style={{ color: T.muted }}>Toca un día para ver su detalle o registrar una actividad.</p>

      {/* Detalle del día seleccionado (visible en móvil y útil en escritorio) */}
      {selectedDate && (
        <div className="mt-5 rounded-xl border p-4 shadow-sm" style={{ borderColor: T.border, background: T.sidebar }}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-serif text-[15px] font-bold">
              {(() => {
                const d = fromStr(selectedDate);
                return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
              })()}
            </h3>
            <button onClick={() => setAddModal({ date: selectedDate, text: "", time: "", checked: false })}
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium text-white transition cursor-pointer"
                    style={{ background: T.accent }}>
              <Plus size={14} /> Nueva actividad
            </button>
          </div>
          
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {(byDate[selectedDate] || []).length === 0 ? (
              <p className="text-[13px] py-4 text-center italic" style={{ color: T.muted }}>No hay actividades registradas para este día.</p>
            ) : (
              (byDate[selectedDate] || []).map(t => (
                <div key={t.blockId} className="flex items-start gap-2 rounded-lg p-2.5 transition hover:brightness-95"
                     style={{ background: T.bg }}>
                  <button onClick={() => toggleDone(t.pageId, t.blockId, !t.checked)}
                          className="mt-0.5 grid h-[18px] w-[18px] flex-shrink-0 place-items-center rounded border transition"
                          style={{ borderColor: t.checked ? T.accent : T.border, background: t.checked ? T.accent : "transparent" }}>
                    {t.checked && <CheckSquare size={12} className="text-white" strokeWidth={3} />}
                  </button>
                  <button onClick={() => gotoTask(t.pageId)} className="min-w-0 flex-1 text-left">
                    <span className="block text-[14px] leading-snug"
                          style={{ textDecoration: t.checked ? "line-through" : "none", color: t.checked ? T.muted : T.ink }}>
                      {t.text}
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] mt-0.5" style={{ color: T.muted }}>
                      <span>{t.pageIcon} {t.pageTitle}</span>
                      {t.time && <span>· {t.time}</span>}
                    </span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal para agregar actividad rápida */}
      {addModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setAddModal(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-xl border p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150" style={{ background: T.bg, borderColor: T.border, color: T.ink }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-lg font-bold">Agregar actividad</h2>
              <button onClick={() => setAddModal(null)} className="hov rounded p-1"><X size={16} style={{ color: T.muted }} /></button>
            </div>

            <section className="mb-4">
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide" style={{ color: T.muted }}>Fecha</label>
              <div className="text-[14px] font-medium" style={{ color: T.ink }}>
                {(() => { const d = fromStr(addModal.date); return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`; })()}
              </div>
            </section>

            <section className="mb-4">
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide" style={{ color: T.muted }}>Descripción</label>
              <input type="text" autoFocus value={addModal.text} onChange={e => setAddModal({ ...addModal, text: e.target.value })}
                     onKeyDown={e => { if (e.key === "Enter") handleSaveModal(); }}
                     placeholder="Escribe qué hiciste o tienes que hacer..."
                     className="w-full rounded border px-3 py-2 text-[14px] outline-none" style={fieldStyle} />
            </section>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <section>
                <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide" style={{ color: T.muted }}>Hora (opcional)</label>
                <input type="time" value={addModal.time || ""} onChange={e => setAddModal({ ...addModal, time: e.target.value })}
                       className="w-full rounded border px-2 py-1.5 text-[13px]" style={fieldStyle} />
              </section>
              <section>
                <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide" style={{ color: T.muted }}>Estado</label>
                <button onClick={() => setAddModal({ ...addModal, checked: !addModal.checked })}
                        className="flex w-full items-center justify-center gap-1.5 rounded-md border py-1.5 text-[13px] font-medium transition cursor-pointer"
                        style={{ borderColor: addModal.checked ? T.accent : T.border, background: addModal.checked ? T.accentSoft : "transparent", color: addModal.checked ? T.accent : T.muted }}>
                  {addModal.checked ? <CheckSquare size={14} /> : <Minus size={14} />}
                  {addModal.checked ? "Realizada" : "Por hacer"}
                </button>
              </section>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t pt-4" style={{ borderColor: T.border }}>
              <button onClick={() => setAddModal(null)} className="hov rounded-md border px-4 py-2 text-[13px] font-medium" style={{ borderColor: T.border, color: T.muted }}>Cancelar</button>
              <button onClick={handleSaveModal} disabled={!addModal.text.trim()} className="rounded-md px-4 py-2 text-[13px] font-medium text-white transition disabled:opacity-50" style={{ background: T.accent }}>Agregar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= Vista Agenda ================= */
function AgendaView({ todos, gotoTask, toggleDone, quickAdd }) {
  const today = todayStr();
  const tomorrow = addDays(today, 1);
  const in7 = addDays(today, 7);
  const [qText, setQText] = useState("");
  const [qDate, setQDate] = useState(today);
  const [qTime, setQTime] = useState("");
  const [qChecked, setQChecked] = useState(false);

  const pend = todos.filter(t => !t.checked);
  const byDate = (a, b) => (a.date || "9").localeCompare(b.date || "9") || (a.time || "99").localeCompare(b.time || "99");

  const groups = [
    { key: "over", label: "Atrasado", color: "var(--danger)", items: pend.filter(t => t.date && t.date < today).sort(byDate) },
    { key: "today", label: "Hoy", color: T.accent, items: pend.filter(t => t.date === today).sort(byDate) },
    { key: "tom", label: "Mañana", color: T.ink, items: pend.filter(t => t.date === tomorrow).sort(byDate) },
    { key: "week", label: "Próximos 7 días", color: T.ink, items: pend.filter(t => t.date > tomorrow && t.date <= in7).sort(byDate) },
    { key: "later", label: "Más adelante", color: T.ink, items: pend.filter(t => t.date > in7).sort(byDate) },
    { key: "none", label: "Sin fecha", color: T.muted, items: pend.filter(t => !t.date) },
  ];

  const done = todos.filter(t => t.checked && t.completedAt);
  const doneByDay = {};
  for (const t of done) { const day = t.completedAt.slice(0, 10); (doneByDay[day] ||= []).push(t); }
  const doneDays = Object.keys(doneByDay).sort((a, b) => b.localeCompare(a));

  const submit = () => { if (qText.trim()) { quickAdd(qText, qDate || null, qTime || null, qChecked); setQText(""); setQTime(""); setQChecked(false); } };

  const Row = ({ t }) => (
    <div className="hov group flex items-start gap-2 rounded-md px-2 py-1.5">
      <button onClick={() => toggleDone(t.pageId, t.blockId, !t.checked)}
              className="mt-0.5 grid h-[18px] w-[18px] flex-shrink-0 place-items-center rounded border transition"
              style={{ borderColor: t.checked ? T.accent : T.border, background: t.checked ? T.accent : "transparent" }}>
        {t.checked && <CheckSquare size={12} className="text-white" strokeWidth={3} />}
      </button>
      <button onClick={() => gotoTask(t.pageId)} className="min-w-0 flex-1 text-left">
        <span className="block text-[14px] leading-snug" style={{ textDecoration: t.checked ? "line-through" : "none", color: t.checked ? T.muted : T.ink }}>{t.text}</span>
        <span className="flex items-center gap-1.5 text-[11px]" style={{ color: T.muted }}>
          <span>{t.pageIcon} {t.pageTitle}</span>{t.date && <span>· {chipLabel(t.date, t.time)}</span>}
        </span>
      </button>
    </div>
  );

  const fieldStyle = { borderColor: T.border, background: "var(--card)", color: T.ink };

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-24 pt-14 sm:px-8">
      <h1 className="mb-4 font-serif text-2xl font-bold">Agenda</h1>

      <div className="mb-6 flex flex-col md:flex-row md:items-center gap-2 rounded-lg border p-2" style={{ borderColor: T.border, background: T.sidebar }}>
        <input value={qText} onChange={e => setQText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submit(); }}
               placeholder="Agregar tarea…" className="w-full md:flex-1 bg-transparent px-1 py-1.5 text-[14px] outline-none placeholder:text-neutral-400" style={{ color: T.ink }} />
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          <input type="date" value={qDate} onChange={e => setQDate(e.target.value)} className="flex-1 md:flex-none rounded border px-2 py-1.5 text-[12px] min-w-[110px]" style={fieldStyle} />
          <input type="time" value={qTime} onChange={e => setQTime(e.target.value)} className="flex-1 md:flex-none rounded border px-2 py-1.5 text-[12px] min-w-[70px]" style={fieldStyle} />
          <button onClick={() => setQChecked(!qChecked)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 rounded border px-2 py-1.5 text-[12px] font-medium transition cursor-pointer"
                  style={{ borderColor: qChecked ? T.accent : T.border, background: qChecked ? T.accentSoft : "transparent", color: qChecked ? T.accent : T.muted }}>
            {qChecked ? <CheckSquare size={13} /> : <Minus size={13} />}
            {qChecked ? "Realizada" : "Por hacer"}
          </button>
          <button onClick={submit} className="w-full md:w-auto rounded-md px-3 py-1.5 text-[13px] font-medium text-white cursor-pointer" style={{ background: T.accent }}>Agregar</button>
        </div>
      </div>

      {groups.every(g => g.items.length === 0) && done.length === 0 && (
        <p className="text-[14px]" style={{ color: T.muted }}>No hay tareas todavía. Agrega una arriba o ponles fecha a tus pendientes en las páginas.</p>
      )}

      {groups.map(g => g.items.length > 0 && (
        <section key={g.key} className="mb-5">
          <h2 className="mb-1 flex items-center gap-2 px-2 text-[12px] font-semibold uppercase tracking-wide" style={{ color: g.color }}>
            {g.label} <span className="font-normal" style={{ color: T.muted }}>{g.items.length}</span>
          </h2>
          {g.items.map(t => <Row key={t.blockId} t={t} />)}
        </section>
      ))}

      {doneDays.length > 0 && (
        <section className="mt-8 border-t pt-5" style={{ borderColor: T.border }}>
          <h2 className="mb-2 flex items-center gap-2 px-2 text-[13px] font-semibold" style={{ color: T.ink }}>
            <ListChecks size={15} style={{ color: T.accent }} /> Bitácora — lo que ya hiciste
          </h2>
          {doneDays.map(day => (
            <div key={day} className="mb-3">
              <p className="px-2 pb-0.5 text-[11px] font-medium capitalize" style={{ color: T.muted }}>
                {(() => { const d = fromStr(day); return `${WEEK_S[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS_S[d.getMonth()]}`; })()}
              </p>
              {doneByDay[day].map(t => <Row key={t.blockId} t={t} />)}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

/* ================= Editor ================= */
function Editor({ page, updatePage, updateBlockInPage, onAddSub, onDelete }) {
  const [focusId, setFocusId] = useState(null);
  const [pickIcon, setPickIcon] = useState(false);

  const setBlocks = (blocks) => updatePage(page.id, { blocks });
  const changeBlock = (id, patch) => updateBlockInPage(page.id, id, patch);

  const insertAfter = (id, block) => {
    const i = page.blocks.findIndex(b => b.id === id);
    const next = [...page.blocks]; next.splice(i + 1, 0, block); setBlocks(next); setFocusId(block.id);
  };
  const removeBlock = (id) => {
    const i = page.blocks.findIndex(b => b.id === id);
    if (page.blocks.length === 1) { setBlocks([emptyBlock()]); return; }
    setBlocks(page.blocks.filter(b => b.id !== id));
    const prev = page.blocks[i - 1]; if (prev) setFocusId(prev.id);
  };

  const todos = page.blocks.filter(b => b.type === "todo");
  const doneCount = todos.filter(b => b.checked).length;

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pb-40 pt-14 sm:px-12">
      <div className="relative mb-1">
        <button onClick={() => setPickIcon(v => !v)} className="hov mb-2 rounded-lg px-1 text-5xl">{page.icon}</button>
        {pickIcon && (
          <div className="absolute z-20 mb-2 flex max-w-xs flex-wrap gap-1 rounded-lg border p-2 shadow-lg" style={{ background: T.bg, borderColor: T.border }}>
            {EMOJIS.map(e => <button key={e} onClick={() => { updatePage(page.id, { icon: e }); setPickIcon(false); }} className="hov rounded p-1 text-xl">{e}</button>)}
          </div>
        )}
      </div>

      <textarea value={page.title} onChange={e => updatePage(page.id, { title: e.target.value })}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); setFocusId(page.blocks[0]?.id); } }}
                rows={1} placeholder="Sin título"
                className="w-full resize-none overflow-hidden bg-transparent font-serif text-4xl font-bold leading-tight outline-none placeholder:text-neutral-300" style={{ color: T.ink }} />

      <div className="mb-6 mt-3 flex flex-wrap items-center gap-2 border-b pb-3 text-[13px]" style={{ borderColor: T.border, color: T.muted }}>
        {todos.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-24 overflow-hidden rounded-full" style={{ background: T.border }}>
              <span className="block h-full rounded-full transition-all" style={{ width: `${(doneCount / todos.length) * 100}%`, background: T.accent }} />
            </span>{doneCount}/{todos.length} pendientes
          </span>
        )}
        <div className="ml-auto flex gap-1">
          <button onClick={onAddSub} className="hov flex items-center gap-1 rounded px-2 py-1"><CornerDownRight size={13} /> Sub-página</button>
          <button onClick={() => { if (confirm("¿Borrar esta página?")) onDelete(); }} className="hov flex items-center gap-1 rounded px-2 py-1"><Trash2 size={13} /> Borrar</button>
        </div>
      </div>

      <div>
        {page.blocks.map((b, idx) => (
          <Block key={b.id} block={b} index={idx} blocks={page.blocks} focusId={focusId} clearFocus={() => setFocusId(null)}
                 onChange={patch => changeBlock(b.id, patch)}
                 onEnter={(afterType, carry) => insertAfter(b.id, { ...emptyBlock(afterType), text: carry })}
                 onDelete={() => removeBlock(b.id)}
                 onFocusPrev={() => { const p = page.blocks[idx - 1]; if (p) setFocusId(p.id); }} />
        ))}
      </div>

      <div onClick={() => insertAfter(page.blocks[page.blocks.length - 1].id, emptyBlock())} className="mt-1 h-24 cursor-text" />
    </div>
  );
}

/* ================= Chip de fecha ================= */
function DateChip({ block, onChange }) {
  const [open, setOpen] = useState(false);
  const has = !!block.date;
  const fieldStyle = { borderColor: T.border, background: "var(--card)", color: T.ink };
  return (
    <div className="relative flex-shrink-0">
      <button onClick={() => setOpen(o => !o)}
              className={`mt-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition ${has ? "" : "opacity-0 group-hover:opacity-100"}`}
              style={{ background: has ? T.accentSoft : "transparent", color: has ? T.accent : T.muted }}>
        <CalendarDays size={12} /> {has ? chipLabel(block.date, block.time) : "Fecha"}
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-30 w-52 rounded-lg border p-2 shadow-xl" style={{ background: T.bg, borderColor: T.border }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-semibold" style={{ color: T.ink }}>Programar</span>
            <button onClick={() => setOpen(false)}><X size={14} style={{ color: T.muted }} /></button>
          </div>
          <label className="mb-1 block text-[11px]" style={{ color: T.muted }}>Día</label>
          <input type="date" value={block.date || ""} onChange={e => onChange({ date: e.target.value || null })} className="mb-2 w-full rounded border px-2 py-1 text-[13px]" style={fieldStyle} />
          <label className="mb-1 block text-[11px]" style={{ color: T.muted }}>Hora (opcional)</label>
          <input type="time" value={block.time || ""} onChange={e => onChange({ time: e.target.value || null })} className="mb-2 w-full rounded border px-2 py-1 text-[13px]" style={fieldStyle} />
          <button onClick={() => { onChange({ date: null, time: null }); setOpen(false); }} className="text-[12px]" style={{ color: T.muted }}>Quitar fecha</button>
        </div>
      )}
    </div>
  );
}

/* ================= Bloque ================= */
function Block({ block, index, blocks, focusId, clearFocus, onChange, onEnter, onDelete, onFocusPrev }) {
  const ref = useRef(null);
  const [menu, setMenu] = useState(null);

  const grow = () => { const el = ref.current; if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } };
  useEffect(grow, [block.text, block.type]);

  useEffect(() => {
    if (focusId === block.id && ref.current) {
      ref.current.focus(); const len = ref.current.value.length; ref.current.setSelectionRange(len, len); clearFocus();
    }
  }, [focusId, block.id, clearFocus]);

  const numIndex = useMemo(() => { let n = 1; for (let i = index - 1; i >= 0; i--) { if (blocks[i].type === "number") n++; else break; } return n; }, [index, blocks]);

  const applyType = (type) => { onChange({ type, text: "" }); setMenu(null); };

  const handleChange = (e) => {
    const v = e.target.value;
    if (v.startsWith("/") && !v.includes(" ")) setMenu({ query: v.slice(1) }); else if (menu) setMenu(null);
    const sc = { "# ": "h1", "## ": "h2", "### ": "h3", "- ": "bullet", "* ": "bullet", "1. ": "number", "[] ": "todo", "[ ] ": "todo", "> ": "quote" };
    for (const [k, t] of Object.entries(sc)) { if (v === k) { onChange({ type: t, text: "" }); return; } }
    if (v === "---") { onChange({ type: "divider", text: "" }); return; }
    onChange({ text: v });
  };

  const handleKeyDown = (e) => {
    if (menu && e.key === "Escape") { setMenu(null); return; }
    if (e.key === "Enter" && !e.shiftKey && !menu) {
      e.preventDefault();
      const el = ref.current; const pos = el.selectionStart;
      const before = block.text.slice(0, pos); const after = block.text.slice(pos);
      if (block.text === "" && ["todo", "bullet", "number", "quote"].includes(block.type)) { onChange({ type: "text" }); return; }
      const carry = ["todo", "bullet", "number"].includes(block.type) ? block.type : "text";
      onChange({ text: before }); onEnter(carry, after);
    }
    if (e.key === "Backspace") {
      const el = ref.current;
      if (el.selectionStart === 0 && el.selectionEnd === 0) {
        if (block.type !== "text") { e.preventDefault(); onChange({ type: "text" }); return; }
        if (block.text === "") { e.preventDefault(); onDelete(); } else if (index > 0) { e.preventDefault(); onFocusPrev(); }
      }
    }
  };

  if (block.type === "divider") {
    return (
      <div className="group flex items-center py-2">
        <hr className="w-full" style={{ borderColor: T.border }} />
        <button onClick={onDelete} className="ml-2 opacity-0 transition group-hover:opacity-100"><Trash2 size={13} style={{ color: T.muted }} /></button>
      </div>
    );
  }

  const s = TYPE_STYLE[block.type] || TYPE_STYLE.text;

  return (
    <div className="hov group relative flex items-start gap-1.5 rounded-md py-0.5 pl-1">
      {block.type === "todo" && (
        <button onClick={() => onChange({ checked: !block.checked, completedAt: !block.checked ? new Date().toISOString() : null })}
                className="mt-[6px] grid h-[18px] w-[18px] flex-shrink-0 place-items-center rounded border transition"
                style={{ borderColor: block.checked ? T.accent : T.border, background: block.checked ? T.accent : "transparent" }}>
          {block.checked && <CheckSquare size={12} className="text-white" strokeWidth={3} />}
        </button>
      )}
      {block.type === "bullet" && <span className="mt-[9px] flex-shrink-0 select-none" style={{ color: T.ink }}>•</span>}
      {block.type === "number" && <span className="mt-[3px] flex-shrink-0 select-none text-[15px]" style={{ color: T.muted }}>{numIndex}.</span>}

      <div className="relative flex-1">
        <textarea ref={ref} rows={1} value={block.text} onChange={handleChange} onKeyDown={handleKeyDown}
                  placeholder={index === 0 && block.type === "text" ? "Escribe, o pulsa “/” para comandos" : ""}
                  className={`w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-neutral-300 ${s.cls}`}
                  style={{ ...s.style, textDecoration: block.type === "todo" && block.checked ? "line-through" : "none", color: block.type === "todo" && block.checked ? T.muted : (s.style?.color || T.ink) }} />
        {menu && <MenuList query={menu.query} onPick={applyType} />}
      </div>

      {block.type === "todo" && <DateChip block={block} onChange={onChange} />}
    </div>
  );
}

function MenuList({ query, onPick }) {
  const items = BLOCK_MENU.filter(i => i.label.toLowerCase().includes(query.toLowerCase()) || i.type.includes(query.toLowerCase()));
  const [sel, setSel] = useState(0);
  useEffect(() => setSel(0), [query]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(s + 1, items.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
      else if (e.key === "Enter") { if (items[sel]) { e.preventDefault(); onPick(items[sel].type); } }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [items, sel, onPick]);
  if (items.length === 0) return null;
  return (
    <div className="absolute left-0 top-7 z-30 w-60 overflow-hidden rounded-lg border py-1 shadow-xl" style={{ background: T.bg, borderColor: T.border }}>
      {items.map((it, i) => {
        const Icon = it.icon;
        return (
          <button key={it.type} onMouseEnter={() => setSel(i)} onClick={() => onPick(it.type)}
                  className="flex w-full items-center gap-3 px-3 py-1.5 text-left transition" style={{ background: i === sel ? T.accentSoft : "transparent" }}>
            <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded border" style={{ borderColor: T.border, background: T.sidebar }}><Icon size={15} style={{ color: T.ink }} /></span>
            <span><span className="block text-[13px] font-medium" style={{ color: T.ink }}>{it.label}</span><span className="block text-[11px]" style={{ color: T.muted }}>{it.hint}</span></span>
          </button>
        );
      })}
    </div>
  );
}

const TYPE_STYLE = {
  text:    { cls: "text-[15px] leading-7", style: {} },
  h1:      { cls: "font-serif text-3xl font-bold leading-snug pt-3", style: {} },
  h2:      { cls: "font-serif text-2xl font-bold leading-snug pt-2", style: {} },
  h3:      { cls: "font-serif text-lg font-semibold leading-snug pt-1", style: {} },
  todo:    { cls: "text-[15px] leading-7", style: {} },
  bullet:  { cls: "text-[15px] leading-7", style: {} },
  number:  { cls: "text-[15px] leading-7", style: {} },
  quote:   { cls: "text-[15px] italic leading-7 pl-3 border-l-2", style: { borderColor: "var(--accent)" } },
  callout: { cls: "text-[15px] leading-7 rounded-lg p-3", style: { background: "var(--callout)" } },
};

const T = {
  bg: "var(--bg)", sidebar: "var(--sidebar)", ink: "var(--ink)", muted: "var(--muted)",
  border: "var(--border)", accent: "var(--accent)", accentSoft: "var(--accent-soft)",
};

function seedWorkspace() {
  const t = todayStr();
  const home = newPage(null); home.icon = "🏠"; home.title = "Inicio";
  home.blocks = [
    { ...emptyBlock("callout"), text: "Tu espacio: páginas + calendario. Ponle fecha a un pendiente con el 📅 y aparece en Calendario y Agenda. Activa recordatorios y tema oscuro en Ajustes." },
    { ...emptyBlock("h2"), text: "Pendientes" },
    { ...emptyBlock("todo"), text: "Instalar el espacio en mi celular", date: t },
    { ...emptyBlock("todo"), text: "Compartir la idea con mi socio", date: addDays(t, 1) },
    { ...emptyBlock("todo"), text: "Definir cómo lo alojamos gratis", date: addDays(t, 3), time: "10:00" },
    { ...emptyBlock("text"), text: "" },
  ];
  const proj = newPage(null); proj.icon = "🚀"; proj.title = "Proyecto";
  proj.blocks = [{ ...emptyBlock("h3"), text: "Ideas" }, { ...emptyBlock("text"), text: "" }];
  return { pages: { [home.id]: home, [proj.id]: proj }, order: [home.id, proj.id] };
}
