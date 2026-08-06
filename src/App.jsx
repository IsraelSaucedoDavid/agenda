import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Plus, Search, Trash2, ChevronRight, ChevronDown, ChevronLeft,
  Type, Heading1, Heading2, Heading3, CheckSquare, List, ListOrdered,
  Quote, Minus, MessageSquare, PanelLeftClose, PanelLeft, CornerDownRight,
  FileText, CalendarDays, ListChecks, X, Sun, Moon, Settings, Download, Upload, Bell, AlertCircle, AlertTriangle, Menu, User, Check, Pencil,
  Shield, Loader2, Users, Megaphone, Camera, Mic, Link, Play, Square, Pause, ExternalLink, Image, Music, UploadCloud, RotateCcw,
  BarChart3, Flame, Award, TrendingUp, Target, Zap, CheckCircle2, UserPlus, Share2, Globe, Lock, Eye, UserCheck,
  FolderPlus, Folder, FolderOpen, MoreHorizontal, GripVertical
} from "lucide-react";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, KeyboardSensor, closestCenter, pointerWithin, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "./supabase";
import Auth from "./Auth";
import OrbitaMark from "./brand";

/* ------------------------------------------------------------------ *
 *  Órbita — páginas, notas, pendientes y calendario.
 *  Guarda en este dispositivo (localStorage). Tema claro/oscuro,
 *  recordatorios y respaldo export/import.
 * ------------------------------------------------------------------ */

const KEY = "orbita:v2";
const SETTINGS_KEY = "orbita:settings";
const uid = () => Math.random().toString(36).slice(2, 10);

const store = {
  load(userId) { 
    try { 
      const key = userId ? `${KEY}:${userId}` : KEY;
      const r = localStorage.getItem(key); 
      return r ? JSON.parse(r) : null; 
    } catch { return null; } 
  },
  save(d, userId) { 
    try { 
      const key = userId ? `${KEY}:${userId}` : KEY;
      localStorage.setItem(key, JSON.stringify(d)); 
    } catch { /* sin espacio */ } 
  },
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
const toNotifyAt = (date, time) => {
  if (!date || !time) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const dt = new Date(y, m - 1, d, hh, mm);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
};

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBuffersEqual(a, b) {
  const aBytes = a instanceof Uint8Array ? a : new Uint8Array(a.buffer || a);
  const bBytes = b instanceof Uint8Array ? b : new Uint8Array(b.buffer || b);
  if (aBytes.length !== bBytes.length) return false;
  for (let i = 0; i < aBytes.length; i++) {
    if (aBytes[i] !== bBytes[i]) return false;
  }
  return true;
}

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
  { type: "image",   label: "Imagen",     hint: "Sube o toma una foto", icon: Camera },
  { type: "audio",   label: "Nota de voz", hint: "Graba una nota de audio", icon: Mic },
  { type: "link",    label: "Enlace web", hint: "Inserta un enlace enriquecido", icon: Link },
];

const emptyBlock = (type = "text") => ({ id: uid(), type, text: "", checked: false, date: null, time: null, completedAt: null });
const newPage = (parentId = null) => ({ id: uid(), title: "", icon: "📄", parentId, blocks: [emptyBlock()] });

/* ================================================================== */

export default function App() {
  const [pages, setPages] = useState({});
  const [order, setOrder] = useState([]);
  const [folders, setFolders] = useState({});
  const [folderOrder, setFolderOrder] = useState([]);
  const [currentId, setCurrentId] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("page");
    if (fromUrl) return fromUrl;
    return localStorage.getItem("orbita:last_active_page") || null;
  });
  const [view, setView] = useState(() => localStorage.getItem("orbita:last_active_view") || "docs");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [loading, setLoading] = useState(true);
  const isDirtyRef = useRef(false);
  const [theme, setTheme] = useState("light");
  const [notifOn, setNotifOn] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState("synced"); // "synced", "syncing", "offline"
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [announcement, setAnnouncement] = useState(null);
  const [sharedPages, setSharedPages] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("orbita:shared_pages") || "[]");
    } catch { return []; }
  });
  const [sharedByMe, setSharedByMe] = useState([]);  // páginas que yo compartí con otros
  const [openTicketsCount, setOpenTicketsCount] = useState(0);
  const [newTicketAlert, setNewTicketAlert] = useState(null);
  const [toast, setToast] = useState(null); // { text, type: "success" | "error" }
  const [confirmDialog, setConfirmDialog] = useState(null); // { title, message, onConfirm }
  const [notifications, setNotifications] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("orbita:notifications") || "[]");
    } catch { return []; }
  });
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [acceptedShares, setAcceptedShares] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("orbita:accepted_shares") || "[]");
    } catch { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem("orbita:notifications", JSON.stringify(notifications)); } catch { /* ignore */ }
  }, [notifications]);

  useEffect(() => {
    try { localStorage.setItem("orbita:accepted_shares", JSON.stringify(acceptedShares)); } catch { /* ignore */ }
  }, [acceptedShares]);

  useEffect(() => {
    try { localStorage.setItem("orbita:shared_pages", JSON.stringify(sharedPages)); } catch { /* ignore */ }
  }, [sharedPages]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const showToast = useCallback((text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  const getInitialPageId = useCallback((orderList) => {
    if (!orderList || orderList.length === 0) return null;
    const saved = localStorage.getItem("orbita:last_active_page");
    return (saved && orderList.includes(saved)) ? saved : orderList[0];
  }, []);

  useEffect(() => {
    if (currentId) {
      localStorage.setItem("orbita:last_active_page", currentId);
    }
  }, [currentId]);

  useEffect(() => {
    if (!order.length) return;
    setCurrentId(id => {
      if (id && (order.includes(id) || pages[id]?.isSharedWithMe)) return id;
      return getInitialPageId(order);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  useEffect(() => {
    localStorage.setItem("orbita:last_active_view", view);
  }, [view]);

  /* --- control de sesión Supabase --- */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    const fetchProfile = async () => {
      try {
        let { data, error } = await supabase
          .from("profiles")
          .select("role, is_blocked, display_name, bio, avatar_url")
          .eq("id", user.id)
          .maybeSingle();

        // Reintento con retraso si hay latencia en el trigger
        if (error && error.code === "PGRST116") {
          await new Promise(resolve => setTimeout(resolve, 850));
          const retry = await supabase
            .from("profiles")
            .select("role, is_blocked, display_name, bio, avatar_url")
            .eq("id", user.id)
            .maybeSingle();
          data = retry.data;
          error = retry.error;
        }

        // Extraer metadata de OAuth (Google/Registro)
        const metaName = user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.display_name || "";
        const metaAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || "";

        if (!data) {
          // Si el perfil no existe, crearlo automáticamente con datos de Google o registro
          const initialProfile = {
            id: user.id,
            email: user.email,
            display_name: metaName || null,
            avatar_url: metaAvatar || null,
            bio: "¡Hola! Estoy usando Órbita.",
            updated_at: new Date().toISOString()
          };
          await supabase.from("profiles").upsert(initialProfile);
          setProfile(initialProfile);
        } else {
          // Si el perfil ya existe pero le falta nombre o foto y Google los tiene, auto-completar
          let needsUpdate = false;
          const patch = { id: user.id, email: user.email, updated_at: new Date().toISOString() };

          if (!data.display_name && metaName) {
            data.display_name = metaName;
            patch.display_name = metaName;
            needsUpdate = true;
          }
          if (!data.avatar_url && metaAvatar) {
            data.avatar_url = metaAvatar;
            patch.avatar_url = metaAvatar;
            needsUpdate = true;
          }

          if (needsUpdate) {
            await supabase.from("profiles").upsert(patch);
          }

          setProfile(data);
        }
      } catch (err) {
        console.error("Error al obtener el perfil:", err);
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const updateProfileData = async (displayName, bioText) => {
    if (!user || !supabase) return;
    try {
      const payload = {
        id: user.id,
        email: user.email,
        display_name: displayName,
        bio: bioText,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from("profiles")
        .upsert(payload);

      if (error) throw error;
      setProfile(prev => prev ? { ...prev, display_name: displayName, bio: bioText } : { display_name: displayName, bio: bioText });
      showToast("Perfil actualizado con éxito");
      return true;
    } catch (err) {
      console.error("Error al actualizar perfil:", err);
      showToast("No se pudo actualizar el perfil", "error");
      return false;
    }
  };

  const uploadAvatar = async (fileOrBlob) => {
    if (!user || !supabase || !fileOrBlob) return;
    try {
      if (!fileOrBlob.type.startsWith("image/")) {
        showToast("El archivo seleccionado debe ser una imagen.", "error");
        return;
      }
      const fileExt = fileOrBlob.name ? fileOrBlob.name.split(".").pop() : fileOrBlob.type.split("/").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, fileOrBlob, { cacheControl: "3600", upsert: true, contentType: fileOrBlob.type });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      const payload = {
        id: user.id,
        email: user.email,
        avatar_url: publicUrl,
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from("profiles")
        .upsert(payload);

      if (updateError) throw updateError;

      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : { avatar_url: publicUrl });
      showToast("Foto de perfil actualizada");
    } catch (err) {
      console.error("Error al subir avatar:", err);
      showToast("No se pudo subir la foto de perfil", "error");
    }
  };

  const removeAvatar = async () => {
    if (!user || !supabase) return;
    try {
      const payload = {
        id: user.id,
        email: user.email,
        avatar_url: null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from("profiles")
        .upsert(payload);

      if (error) throw error;
      setProfile(prev => prev ? { ...prev, avatar_url: null } : { avatar_url: null });
      showToast("Foto de perfil eliminada");
    } catch (err) {
      console.error("Error al eliminar avatar:", err);
      showToast("No se pudo eliminar la foto de perfil", "error");
    }
  };

  const deleteAccount = async () => {
    if (!user || !supabase) return;
    try {
      showToast("Eliminando tu cuenta y datos...");

      // 1. Intentar borrado atómico vía RPC en Supabase
      const { error: rpcError } = await supabase.rpc("delete_user_account");
      if (rpcError) {
        console.warn("RPC delete_user_account no disponible o falló, usando borrado directo:", rpcError);
        await supabase.from("user_workspaces").delete().eq("user_id", user.id);
        if (user.email) {
          await supabase.from("page_shares").delete().eq("shared_with_email", user.email.toLowerCase());
        }
        await supabase.from("profiles").delete().eq("id", user.id);
      }

      // 2. Limpiar cache local y cerrar sesión
      const userId = user.id;
      if (userId) {
        localStorage.removeItem(`${KEY}:${userId}`);
      }
      localStorage.removeItem(KEY);
      localStorage.clear();

      await supabase.auth.signOut();
      setProfile(null);
      setPages({});
      setOrder([]);
      setCurrentId(null);

      showToast("Tu cuenta ha sido eliminada por completo");
    } catch (err) {
      console.error("Error al eliminar cuenta:", err);
      showToast("No se pudo eliminar la cuenta por completo", "error");
    }
  };

  const handleLogout = async () => {
    const userId = user?.id;
    await supabase.auth.signOut();
    if (userId) {
      localStorage.removeItem(`${KEY}:${userId}`);
    }
    localStorage.removeItem(KEY);
    setPages({});
    setOrder([]);
    setCurrentId(null);
  };

  /* --- cliente de sincronización --- */
  const syncWithServer = useCallback(async (localData, currentUser) => {
    const activeUser = currentUser || user;
    if (!activeUser) return;
    setSyncStatus("syncing");
    try {
      const { data: serverData, error } = await supabase
        .from("user_workspaces")
        .select("pages, order, folders, folder_order, updated_at")
        .eq("user_id", activeUser.id)
        .maybeSingle();

      if (error) throw error;



      // Caso 1: El servidor no tiene datos guardados todavía
      if (!serverData) {
        const payloadToUpload = localData || (() => {
          const seed = seedWorkspace();
          const t = new Date().toISOString();
          return { ...seed, updatedAt: t };
        })();

        const { error: insertError } = await supabase
          .from("user_workspaces")
          .insert({
            user_id: activeUser.id,
            pages: payloadToUpload.pages,
            order: payloadToUpload.order,
            folders: payloadToUpload.folders || {},
            folder_order: payloadToUpload.folderOrder || [],
            updated_at: payloadToUpload.updatedAt || new Date().toISOString()
          });

        if (insertError) throw insertError;
        
        if (!localData) {
          setPages(payloadToUpload.pages);
          setOrder(payloadToUpload.order);
          setCurrentId(id => id || getInitialPageId(payloadToUpload.order));
          store.save(payloadToUpload, activeUser.id);
        }
        setSyncStatus("synced");
        setLoading(false);
        return;
      }

      const localTime = new Date(localData?.updatedAt || 0).getTime();
      const serverTime = new Date(serverData.updated_at || 0).getTime();

      // Caso 2: El servidor tiene datos más recientes
      if (serverTime > localTime) {
        if (serverData.pages && serverData.order && serverData.order.length > 0) {
          if (serverData.folders) { setFolders(serverData.folders); }
          if (serverData.folder_order) { setFolderOrder(serverData.folder_order); }
          const newPayload = {
            pages: serverData.pages,
            order: serverData.order,
            updatedAt: serverData.updated_at
          };
          // Preservar páginas compartidas-conmigo: syncWithServer solo trae las páginas
          // propias del usuario desde Supabase, por lo que si sobreescribimos `pages`
          // sin fusionar las compartidas, se borran del estado local y el editor
          // queda en blanco hasta el siguiente fetchSharedPages.
          setPages(prev => {
            const sharedEntries = Object.fromEntries(
              Object.entries(prev).filter(([, pg]) => pg?.isSharedWithMe)
            );
            return { ...serverData.pages, ...sharedEntries };
          });
          setOrder(serverData.order);
          // No cambiar currentId si apunta a una página compartida (no está en serverData.order)
          setCurrentId(id => {
            if (!id) return getInitialPageId(serverData.order);
            if (serverData.order.includes(id)) return id;
            // Si el currentId es una página compartida-conmigo, mantenerlo
            const currentPg = serverData.pages[id];
            if (!currentPg) return id; // página compartida, mantener
            return getInitialPageId(serverData.order);
          });
          store.save(newPayload, activeUser.id);
          setSyncStatus("synced");
        } else {
          console.warn("El servidor retornó datos de sincronización vacíos o corruptos, ignorando.");
          setSyncStatus("offline");
        }
      }
      // Caso 3: El cliente tiene datos más recientes (cambios locales offline)
      else if (localTime > serverTime && localData) {
        // SEGURIDAD: Si el cliente está vacío (cero páginas y orden vacío) pero el servidor
        // tiene páginas guardadas, se trata de una inicialización accidental / caché limpia.
        // ¡NO debemos sobrescribir ni borrar los datos del servidor!
        const localPagesCount = Object.keys(localData.pages || {}).length;
        const serverPagesCount = Object.keys(serverData.pages || {}).length;
        
        if (localPagesCount === 0 && serverPagesCount > 0 && !isDirtyRef.current) {
          console.warn("Sincronización: Se previno sobrescribir el servidor con un cliente vacío.");
          setPages(serverData.pages);
          setOrder(serverData.order || []);
          if (serverData.folders) setFolders(serverData.folders);
          if (serverData.folder_order) setFolderOrder(serverData.folder_order);
          store.save({ pages: serverData.pages, order: serverData.order || [], folders: serverData.folders || {}, folderOrder: serverData.folder_order || [], updatedAt: serverData.updated_at }, activeUser.id);
          setSyncStatus("synced");
          return;
        }

        const { error: updateError } = await supabase
          .from("user_workspaces")
          .upsert({
            user_id: activeUser.id,
            pages: localData.pages,
            order: localData.order,
            folders: localData.folders || {},
            folder_order: localData.folderOrder || [],
            updated_at: localData.updatedAt
          });

        if (updateError) throw updateError;
        setSyncStatus("synced");
      }
      // Caso 4: Están iguales
      else {
        setSyncStatus("synced");
      }
    } catch (err) {
      console.warn("Sincronización fallida:", err);
      setSyncStatus("offline");
    } finally {
      setLoading(false);
    }
  }, [user]);

  const lastUserId = useRef(null);

  /* --- carga de contenido --- */
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setPages({});
      setOrder([]);
      setCurrentId(null);
      setLoading(false);
      lastUserId.current = null;
      return;
    }

    // Si es el mismo usuario (evita refrescos por onAuthStateChange al cambiar de ventana),
    // no re-inicializar el estado local para no borrar temporalmente páginas compartidas.
    if (lastUserId.current === user.id) {
      const localData = store.load(user.id);
      syncWithServer(localData, user);
      return;
    }

    lastUserId.current = user.id;
    setLoading(true);
    const localData = store.load(user.id);
    if (localData && localData.pages) {
      // Auto-purga: eliminar definitivamente páginas en papelera con más de 30 días
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const purgedPages = Object.fromEntries(
        Object.entries(localData.pages).filter(([, pg]) =>
          !pg.deletedAt || (now - new Date(pg.deletedAt).getTime()) < THIRTY_DAYS_MS
        )
      );
      const purgedOrder = (localData.order || []).filter(id => purgedPages[id]);
      if (localData.folders) setFolders(localData.folders);
      if (localData.folderOrder) setFolderOrder(localData.folderOrder);
      setPages(purgedPages);
      setOrder(purgedOrder);
      setCurrentId(id => id && (purgedOrder.includes(id) || purgedPages[id]?.isSharedWithMe) ? id : getInitialPageId(purgedOrder));
    }
    syncWithServer(localData, user);
  }, [user, authLoading, syncWithServer]);

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

  /* --- carga de anuncios activos --- */
  useEffect(() => {
    if (!user) {
      setAnnouncement(null);
      return;
    }
    const fetchActiveAnnouncement = async () => {
      try {
        const { data, error } = await supabase
          .from("announcements")
          .select("content, is_active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (!error && data) {
          const dismissed = localStorage.getItem("orbita:dismissed_announcement");
          if (data.is_active && dismissed !== data.content) {
            setAnnouncement(data.content);
          } else {
            setAnnouncement(null);
          }
        } else {
          setAnnouncement(null);
        }
      } catch (err) {
        console.error("Error al cargar anuncio:", err);
      }
    };
    fetchActiveAnnouncement();
  }, [user]);

  /* --- carga de páginas compartidas ---
   * IMPORTANTE: usar siempre fetchSharedPagesRef.current() en callbacks
   * para evitar stale closures cuando acceptedShares cambia antes del re-render
   */
  const fetchSharedPagesRef = useRef(null);
  const fetchSharedPages = useCallback(async () => {
    if (!user || !supabase) {
      setSharedPages([]);
      return;
    }
    const userEmail = user.email?.toLowerCase();
    try {
      const { data: shares, error } = await supabase
        .from("page_shares")
        .select("*")
        .eq("shared_with_email", userEmail);



      if (!error && shares) {
        const activeShares = [];
        const pageUpdates = {};
        const pagesToDelete = [];
        const newNotifs = [];

        // Consultar workspaces de los propietarios en paralelo usando Promise.all
        await Promise.all(
          shares.map(async (sp) => {
            try {
              const { data: wsData, error: wsError } = await supabase
                .from("user_workspaces")
                .select("pages")
                .eq("user_id", sp.owner_id)
                .maybeSingle();

              const exists = !!(wsData?.pages && wsData.pages[sp.page_id]);
              const ownerPage = exists ? wsData.pages[sp.page_id] : null;
              const isAccepted = sp.status === "accepted" || !sp.status || acceptedShares.includes(sp.id);



              if (exists && ownerPage) {
                if (ownerPage.deletedAt) {
                  pagesToDelete.push(sp.page_id);
                  return;
                }

                if (!isAccepted) {
                  newNotifs.push({
                    id: `invite:${sp.id}`,
                    type: "page_invite",
                    shareId: sp.id,
                    pageId: sp.page_id,
                    pageTitle: ownerPage.title || "Sin título",
                    ownerEmail: sp.owner_email || "Un usuario",
                    ownerId: sp.owner_id,
                    permission: sp.permission || "view",
                    title: "📩 ¡Nueva invitación a colaborar!",
                    body: `Te invitaron a colaborar en "${ownerPage.title || "Sin título"}"`,
                    status: "pending",
                    read: false,
                    createdAt: sp.created_at || new Date().toISOString()
                  });
                  return;
                }

                activeShares.push(sp);
                pageUpdates[sp.page_id] = {
                  ...ownerPage,
                  parentId: undefined,
                  isShared: true,
                  isSharedWithMe: true,
                  ownerId: sp.owner_id,
                  permission: sp.permission
                };
              } else {
                pagesToDelete.push(sp.page_id);
                // Si la página ya no existe en el workspace del dueño, eliminamos el registro huérfano de la BD
                if (supabase) {
                  try {
                    await supabase.from("page_shares").delete().eq("id", sp.id);
                  } catch (delErr) {
                    console.warn("No se pudo eliminar el registro huérfano de page_shares:", delErr);
                  }
                }
              }
            } catch (wsErr) {
              console.warn("No se pudo leer workspace del propietario directamente:", wsErr);
            }
          })
        );

        if (pagesToDelete.length > 0) {
          setPages(p => {
            const next = { ...p };
            pagesToDelete.forEach(id => delete next[id]);
            return next;
          });
        }
        if (Object.keys(pageUpdates).length > 0) {
          setPages(p => ({ ...p, ...pageUpdates }));
        }
        if (newNotifs.length > 0) {
          setNotifications(prev => {
            const filtered = newNotifs.filter(n => !prev.some(x => x.shareId === n.shareId));
            return [...filtered, ...prev];
          });
        }
        setSharedPages(activeShares);
      }
    } catch (err) {
      console.error("Error al cargar invitaciones compartidas:", err);
    }
  }, [user, acceptedShares]);

  // Mantener el ref siempre apuntando a la función más reciente (evita stale closures)
  useEffect(() => { fetchSharedPagesRef.current = fetchSharedPages; }, [fetchSharedPages]);

  /* --- escucha de notificaciones en tiempo real --- */
  useEffect(() => {
    fetchSharedPages();

    if (!user || !supabase) return;
    const userEmail = user.email?.toLowerCase();

    // Escuchar notificaciones en tiempo real para este usuario
    const notifChannel = supabase.channel(`user_notifs:${userEmail}`);
    notifChannel
      .on("broadcast", { event: "new_shared_page_invite" }, ({ payload }) => {
        const notifId = `invite:${payload.shareId || Date.now()}`;
        setNotifications(prev => [
          {
            id: notifId,
            type: "page_invite",
            shareId: payload.shareId,
            pageId: payload.pageId,
            pageTitle: payload.pageTitle,
            ownerEmail: payload.ownerEmail,
            ownerId: payload.ownerId,
            permission: payload.permission,
            title: "📩 ¡Nueva invitación a colaborar!",
            body: `${payload.ownerEmail} te invitó a colaborar en "${payload.pageTitle || "Sin título"}"`,
            status: "pending",
            read: false,
            createdAt: new Date().toISOString()
          },
          ...prev
        ]);

        // Notificación nativa del sistema
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification("📩 Invitación a colaborar en Órbita", {
              body: `${payload.ownerEmail} te invitó a colaborar en "${payload.pageTitle || "Sin título"}"`,
              icon: "/icon-192.png"
            });
          } catch { /* ignore */ }
        }

        fetchSharedPages();
      })
      .on("broadcast", { event: "invite_response" }, ({ payload }) => {
        const isAcc = payload.accepted;
        setNotifications(prev => [
          {
            id: `resp:${Date.now()}`,
            type: "invite_response",
            title: isAcc ? "✅ Invitación Aceptada" : "❌ Invitación Rechazada",
            body: isAcc
              ? `${payload.responderEmail} aceptó tu invitación a "${payload.pageTitle}"`
              : `${payload.responderEmail} rechazó tu invitación a "${payload.pageTitle}"`,
            read: false,
            createdAt: new Date().toISOString()
          },
          ...prev
        ]);

        showToast(
          isAcc
            ? `✅ ${payload.responderEmail} aceptó tu invitación`
            : `❌ ${payload.responderEmail} rechazó la invitación`,
          isAcc ? "success" : "error"
        );
      })
      .on("broadcast", { event: "page_access_revoked" }, ({ payload }) => {
        const revokedPageId = payload.pageId;
        setSharedPages(prev => prev.filter(sp => sp.page_id !== revokedPageId));
        setPages(prev => {
          const next = { ...prev };
          delete next[revokedPageId];
          return next;
        });
        setCurrentId(cur => (cur === revokedPageId ? null : cur));

        setNotifications(prev => [
          {
            id: `revoked:${Date.now()}`,
            type: "access_revoked",
            title: "🚫 Acceso revocado",
            body: `El propietario eliminó o revocó tu acceso a "${payload.pageTitle || "la página compartida"}"`,
            read: false,
            createdAt: new Date().toISOString()
          },
          ...prev
        ]);

        showToast(`🚫 Se ha revocado tu acceso a "${payload.pageTitle || "la página compartida"}"`, "error");
        fetchSharedPages();
      })
      .subscribe();

    return () => {
      notifChannel.unsubscribe();
    };
  }, [user, fetchSharedPages]);

  /* --- cargar páginas compartidas POR el usuario actual --- */
  useEffect(() => {
    if (!user || !supabase) { setSharedByMe([]); return; }
    const fetchSharedByMe = async () => {
      try {
        const { data, error } = await supabase
          .from("page_shares")
          .select("page_id, shared_with_email, permission, status")
          .eq("owner_id", user.id);
        if (!error && data) {
          // Agrupar por page_id: { page_id, recipients: [{email, permission}] }
          const grouped = {};
          for (const row of data) {
            if (!grouped[row.page_id]) grouped[row.page_id] = { page_id: row.page_id, recipients: [] };
            grouped[row.page_id].recipients.push({ email: row.shared_with_email, permission: row.permission });
          }
          setSharedByMe(Object.values(grouped));
        }
      } catch (err) {
        console.warn("Error al cargar compartidos por mi:", err);
      }
    };
    fetchSharedByMe();
  }, [user]);
  useEffect(() => {
    if (profile?.role !== "admin") {
      setOpenTicketsCount(0);
      return;
    }
    const fetchOpenTicketsCount = async () => {
      try {
        const { count, error } = await supabase
          .from("support_tickets")
          .select("*", { count: "exact", head: true })
          .eq("status", "open");
        if (!error && count !== null) {
          setOpenTicketsCount(count);
        }
      } catch (err) {
        console.error("Error al obtener conteo de tickets:", err);
      }
    };
    fetchOpenTicketsCount();

    const channel = supabase
      .channel("support_tickets_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, (payload) => {
        fetchOpenTicketsCount();
        if (payload.eventType === "INSERT" && payload.new) {
          setNewTicketAlert({
            subject: payload.new.subject,
            email: payload.new.user_email
          });
          // Auto-hide alert after 7 seconds
          setTimeout(() => {
            setNewTicketAlert(null);
          }, 7000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  /* --- guarda contenido --- */
  const saveTimer = useRef();
  const syncTimer = useRef();
  useEffect(() => {
    if (loading || authLoading || !user) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const t = new Date().toISOString();
      
      // Guardar TODO en localStorage (incluyendo páginas compartidas) para que carguen
      // de forma instantánea al refrescar la app.
      const payloadLocal = { pages, order, folders, folderOrder, updatedAt: t };
      store.save(payloadLocal, user.id);
      
      // Filtrar las páginas compartidas-conmigo antes de subir a Supabase para que no
      // contaminen el workspace del usuario en el servidor.
      const ownPages = Object.fromEntries(
        Object.entries(pages).filter(([, pg]) => !pg.isSharedWithMe)
      );
      const ownOrder = order.filter(id => !pages[id]?.isSharedWithMe);
      const payloadSync = { pages: ownPages, order: ownOrder, folders, folderOrder, updatedAt: t };
      
      clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        syncWithServer(payloadSync, user);
      }, 1500);
    }, 300);
  }, [pages, order, folders, folderOrder, loading, authLoading, user, syncWithServer]);

  const page = pages[currentId];

  const updatePage = useCallback((id, patch) => {
    isDirtyRef.current = true;
    setPages(p => ({ ...p, [id]: { ...p[id], ...patch } }));
  }, []);
  const updateBlockInPage = useCallback((pageId, blockId, patch) => {
    isDirtyRef.current = true;
    setPages(p => {
      const pg = p[pageId]; if (!pg) return p;
      return { ...p, [pageId]: { ...pg, blocks: pg.blocks.map(b => (b.id === blockId ? { ...b, ...patch } : b)) } };
    });
  }, []);
  const toggleDone = useCallback((pageId, blockId, checked) => {
    updateBlockInPage(pageId, blockId, { checked, completedAt: checked ? new Date().toISOString() : null });
  }, [updateBlockInPage]);

  const addPage = (parentId = null) => {
    isDirtyRef.current = true;
    const np = newPage(parentId);
    setPages(p => ({ ...p, [np.id]: np }));
    setOrder(o => [...o, np.id]);
    if (parentId) setExpanded(e => ({ ...e, [parentId]: true }));
    setCurrentId(np.id); setView("docs");
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  /* ---- CRUD de Carpetas ---- */
  const FOLDER_COLORS = [
    "#6366f1", "#ec4899", "#f97316", "#eab308", "#22c55e", "#06b6d4",
    "#3b82f6", "#8b5cf6", "#ef4444", "#a16207", "#6b7280", "#10b981"
  ];

  const addFolder = (name = "", color = null, parentId = null) => {
    isDirtyRef.current = true;
    const fid = uid();
    const randomColor = FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)];
    const folder = { id: fid, name: name.trim() || "Nueva carpeta", color: color || randomColor, pageIds: [], parentId: parentId || null };
    setFolders(f => ({ ...f, [fid]: folder }));
    setFolderOrder(fo => [...fo, fid]);
    return fid;
  };

  const renameFolder = (fid, name, color) => {
    isDirtyRef.current = true;
    setFolders(f => ({ ...f, [fid]: { ...f[fid], name: name.trim() || "Sin nombre", color } }));
  };

  const deleteFolder = (fid) => {
    isDirtyRef.current = true;
    const toDelete = new Set([fid]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [id, folder] of Object.entries(folders)) {
        if (folder.parentId && toDelete.has(folder.parentId) && !toDelete.has(id)) { toDelete.add(id); changed = true; }
      }
    }
    const parentId = folders[fid]?.parentId || null;
    const heirPageIds = new Set();
    if (parentId) {
      for (const id of toDelete) {
        for (const pid of (folders[id]?.pageIds || [])) heirPageIds.add(pid);
      }
    }
    setFolders(f => {
      const next = { ...f };
      for (const id of toDelete) delete next[id];
      if (parentId && next[parentId]) {
        next[parentId] = { ...next[parentId], pageIds: Array.from(new Set([...next[parentId].pageIds, ...heirPageIds])) };
      }
      return next;
    });
    setFolderOrder(fo => fo.filter(id => !toDelete.has(id)));
  };

  const addPageToFolder = (pageId, fid) => {
    isDirtyRef.current = true;
    // Quitar de cualquier carpeta existente
    setFolders(f => {
      const next = {};
      for (const [id, folder] of Object.entries(f)) {
        next[id] = { ...folder, pageIds: folder.pageIds.filter(pid => pid !== pageId) };
      }
      // Agregar a la nueva carpeta
      if (next[fid]) {
        next[fid] = { ...next[fid], pageIds: [...next[fid].pageIds, pageId] };
      }
      return next;
    });
  };

  const removePageFromFolder = (pageId) => {
    isDirtyRef.current = true;
    setFolders(f => {
      const next = {};
      for (const [id, folder] of Object.entries(f)) {
        next[id] = { ...folder, pageIds: folder.pageIds.filter(pid => pid !== pageId) };
      }
      return next;
    });
  };

  const getFolderOfPage = (pageId) => {
    for (const [fid, folder] of Object.entries(folders)) {
      if (folder.pageIds.includes(pageId)) return fid;
    }
    return null;
  };

  /* --- drag & drop en la barra lateral (páginas y carpetas) --- */
  const [sidebarDragActive, setSidebarDragActive] = useState(null); // { type: "page"|"folder", id }
  const [sidebarHover, setSidebarHover] = useState(null);           // { id, mode: "highlight"|"insert" }
  const sidebarSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 400, tolerance: 8 } })
  );

  const movePageIntoFolder = (pageId, fid) => {
    isDirtyRef.current = true;
    setFolders(f => {
      const next = {};
      for (const [id, folder] of Object.entries(f)) {
        next[id] = { ...folder, pageIds: folder.pageIds.filter(pid => pid !== pageId) };
      }
      if (next[fid]) next[fid] = { ...next[fid], pageIds: [...(next[fid].pageIds || []), pageId] };
      return next;
    });
  };

  const movePageIntoFolderAt = (pageId, fid, atPageId) => {
    isDirtyRef.current = true;
    setFolders(f => {
      const next = {};
      for (const [id, folder] of Object.entries(f)) {
        next[id] = { ...folder, pageIds: folder.pageIds.filter(pid => pid !== pageId) };
      }
      const target = next[fid];
      if (!target) return next;
      const ids = [...target.pageIds];
      const idx = ids.indexOf(atPageId);
      if (idx === -1) ids.push(pageId);
      else ids.splice(idx, 0, pageId);
      next[fid] = { ...target, pageIds: ids };
      return next;
    });
  };

  const movePageToRoot = (pageId, atPageId) => {
    isDirtyRef.current = true;
    setFolders(f => {
      const next = {};
      for (const [id, folder] of Object.entries(f)) {
        next[id] = { ...folder, pageIds: folder.pageIds.filter(pid => pid !== pageId) };
      }
      return next;
    });
    setOrder(o => {
      const idx = o.indexOf(pageId);
      const toIdx = atPageId ? o.indexOf(atPageId) : -1;
      if (idx === -1) return o;
      if (toIdx === -1) return o;
      return arrayMove(o, idx, toIdx);
    });
  };

  const reorderFolderPages = (fid, pageId, atPageId) => {
    isDirtyRef.current = true;
    setFolders(f => {
      const folder = f[fid]; if (!folder) return f;
      const ids = [...folder.pageIds];
      const idx = ids.indexOf(pageId);
      const toIdx = ids.indexOf(atPageId);
      if (idx === -1 || toIdx === -1) return f;
      return { ...f, [fid]: { ...folder, pageIds: arrayMove(ids, idx, toIdx) } };
    });
  };

  const reorderPages = (pageId, atPageId) => {
    isDirtyRef.current = true;
    setOrder(o => {
      const idx = o.indexOf(pageId);
      const toIdx = o.indexOf(atPageId);
      if (idx === -1 || toIdx === -1) return o;
      return arrayMove(o, idx, toIdx);
    });
  };

  const reorderFolders = (fid, atFid) => {
    isDirtyRef.current = true;
    setFolderOrder(o => {
      const idx = o.indexOf(fid);
      const toIdx = o.indexOf(atFid);
      if (idx === -1 || toIdx === -1) return o;
      return arrayMove(o, idx, toIdx);
    });
  };

  const nestFolder = (fid, parentFid) => {
    if (fid === parentFid) return;
    let cur = parentFid;
    while (cur) {
      if (cur === fid) return; // evitar ciclos
      cur = folders[cur]?.parentId || null;
    }
    isDirtyRef.current = true;
    setFolders(f => ({ ...f, [fid]: { ...f[fid], parentId: parentFid } }));
    setFolderOrder(o => {
      const without = o.filter(x => x !== fid);
      const kids = Object.values(folders).filter(x => x.id !== fid && x.parentId === parentFid).map(x => x.id);
      const anchorIds = [parentFid, ...kids];
      let lastIdx = -1;
      without.forEach((id, i) => { if (anchorIds.includes(id)) lastIdx = i; });
      const next = [...without];
      next.splice(lastIdx + 1, 0, fid);
      return next;
    });
  };

  const moveFolderToRootEnd = (fid) => {
    isDirtyRef.current = true;
    setFolders(f => ({ ...f, [fid]: { ...f[fid], parentId: null } }));
    setFolderOrder(o => {
      const without = o.filter(x => x !== fid);
      const rootIds = Object.values(folders).filter(x => x.id !== fid && !x.parentId).map(x => x.id);
      let lastIdx = -1;
      without.forEach((id, i) => { if (rootIds.includes(id)) lastIdx = i; });
      const next = [...without];
      next.splice(lastIdx + 1, 0, fid);
      return next;
    });
  };

  const handleSidebarDragStart = (e) => {
    const [type, id] = e.active.id.split(":");
    setSidebarDragActive({ type, id });
    setSidebarHover(null);
  };

  const handleSidebarDragOver = (e) => {
    const { active, over } = e;
    if (!over) { setSidebarHover(null); return; }
    const aType = active.id.split(":")[0];
    const aId = active.id.split(":")[1];
    const [oType, oId] = over.id.split(":");
    let mode = "insert";
    if (aType === "page" && oType === "folder") mode = "highlight";
    if (aType === "folder" && oType === "folder") {
      const aParent = folders[aId]?.parentId || null;
      const oParent = folders[oId]?.parentId || null;
      mode = aParent === oParent ? "insert" : "highlight";
    }
    setSidebarHover({ id: oId, mode });
  };

  const handleSidebarDragEnd = (e) => {
    const { active, over } = e;
    setSidebarDragActive(null);
    setSidebarHover(null);
    if (!over || active.id === over.id) return;
    const [aType, aId] = active.id.split(":");
    const [oType, oId] = over.id.split(":");
    if (aType === "page") {
      if (oType === "folder") {
        movePageIntoFolder(aId, oId);
      } else {
        const aFolder = getFolderOfPage(aId);
        const oFolder = getFolderOfPage(oId);
        if (aFolder === oFolder) {
          if (aFolder) reorderFolderPages(aFolder, aId, oId);
          else reorderPages(aId, oId);
        } else {
          if (oFolder) movePageIntoFolderAt(aId, oFolder, oId);
          else movePageToRoot(aId, oId);
        }
      }
    } else {
      if (oType === "folder") {
        const aParent = folders[aId]?.parentId || null;
        const oParent = folders[oId]?.parentId || null;
        if (aParent === oParent) reorderFolders(aId, oId);
        else nestFolder(aId, oId);
      } else if (!folders[aId]?.parentId) {
        moveFolderToRootEnd(aId);
      }
    }
  };

  const sidebarCollision = (args) => {
    const collisions = pointerWithin(args);
    if (collisions.length <= 1) return collisions;
    const containers = (args.droppableContainers?.toArray?.() || []);
    const depthOf = (id) => {
      const container = containers.find(c => c.id === id);
      let n = container?.node; let d = 0;
      while (n) { n = n.parentElement; d++; }
      return d;
    };
    return [...collisions].sort((a, b) => depthOf(b.id) - depthOf(a.id));
  };

  // --- Soft delete: marca con deletedAt en lugar de borrar físicamente ---
  const softDeletePage = async (id) => {
    isDirtyRef.current = true;
    const now = new Date().toISOString();
    const toTrash = new Set([id]);

    setPages(p => {
      const next = { ...p };
      // Recopila la página y todas sus sub-páginas recursivamente
      let changed = true;
      while (changed) {
        changed = false;
        for (const pid of Object.keys(next)) {
          if (next[pid]?.parentId && toTrash.has(next[pid].parentId) && !toTrash.has(pid)) {
            toTrash.add(pid); changed = true;
          }
        }
      }
      toTrash.forEach(x => { if (next[x]) next[x] = { ...next[x], deletedAt: now }; });
      return next;
    });

    // Eliminar relaciones de compartir y notificar a colaboradores
    if (supabase) {
      try {
        const trashArray = Array.from(toTrash);
        const { data: shares } = await supabase
          .from("page_shares")
          .select("shared_with_email, page_id")
          .in("page_id", trashArray);

        if (shares && shares.length > 0) {
          shares.forEach(sp => {
            try {
              const notifChan = supabase.channel(`user_notifs:${sp.shared_with_email.toLowerCase()}`);
              notifChan.subscribe(async (status) => {
                if (status === "SUBSCRIBED") {
                  await notifChan.send({
                    type: "broadcast",
                    event: "page_access_revoked",
                    payload: { pageId: sp.page_id, pageTitle: pages[sp.page_id]?.title || "Sin título" }
                  });
                  setTimeout(() => notifChan.unsubscribe(), 1000);
                }
              });
            } catch { /* ignore */ }
          });
        }

        await supabase.from("page_shares").delete().in("page_id", trashArray);
      } catch (err) {
        console.warn("Error al revocar accesos en Supabase al mover a papelera:", err);
      }
    }

    // Si la página activa fue a la papelera, navega a otra
    setCurrentId(cur => {
      if (toTrash.has(cur)) {
        const alive = order.filter(pid => !toTrash.has(pid) && !pages[pid]?.deletedAt);
        return alive[0] || null;
      }
      return cur;
    });
    if (view === "docs") setView("docs");
  };

  // --- Restaurar página de la papelera ---
  const restorePage = (id) => {
    isDirtyRef.current = true;
    setPages(p => {
      const next = { ...p };
      // Restaura la página y todos sus hijos
      const toRestore = new Set([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const pid of Object.keys(next)) {
          if (next[pid]?.parentId && toRestore.has(next[pid].parentId) && !toRestore.has(pid)) {
            toRestore.add(pid); changed = true;
          }
        }
      }
      toRestore.forEach(x => { if (next[x]) next[x] = { ...next[x], deletedAt: null }; });
      return next;
    });
  };

  // --- Eliminar permanentemente una página y sus hijos ---
  const permanentDelete = async (id) => {
    isDirtyRef.current = true;
    const toRemove = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const pid of order) {
        const pg = pages[pid];
        if (pg && pg.parentId && toRemove.has(pg.parentId) && !toRemove.has(pid)) { toRemove.add(pid); changed = true; }
      }
    }
    // Eliminar registros de invitación en Supabase
    if (supabase) {
      try {
        await supabase.from("page_shares").delete().in("page_id", Array.from(toRemove));
      } catch { /* ignore */ }
    }
    setPages(p => { const next = { ...p }; toRemove.forEach(x => delete next[x]); return next; });
    setOrder(o => {
      const next = o.filter(x => !toRemove.has(x));
      if (toRemove.has(currentId)) setCurrentId(next[0] || null);
      return next;
    });
  };

  // --- Vaciar papelera: elimina permanentemente todas las páginas eliminadas ---
  const emptyTrash = () => {
    isDirtyRef.current = true;
    setPages(p => {
      const next = { ...p };
      Object.keys(next).forEach(id => { if (next[id]?.deletedAt) delete next[id]; });
      return next;
    });
    setOrder(o => o.filter(id => !pages[id]?.deletedAt));
  };

  const quickAdd = (text, date, time, checked = false) => {
    if (!text || !text.trim()) return;
    isDirtyRef.current = true;
    const block = {
      ...emptyBlock("todo"),
      text: text.trim(),
      date: date || null,
      time: time || null,
      notifyAt: toNotifyAt(date || null, time || null),
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

  // Excluye páginas en papelera, hijos y páginas ajenas (compartidas-conmigo) de la barra lateral principal
  const childrenOf = useCallback((pid) => order.filter(id => pages[id]?.parentId === pid && !pages[id]?.deletedAt && !pages[id]?.isSharedWithMe), [order, pages]);
  const roots = order.filter(id => !pages[id]?.parentId && !pages[id]?.deletedAt && !pages[id]?.isSharedWithMe);

  // Páginas raíz que NO están en ninguna carpeta
  const unFolderedRoots = roots.filter(id => !getFolderOfPage(id));

  // Contador de páginas en la papelera (solo raíces, no hijos)
  const trashedPages = useMemo(() => order.filter(id => pages[id]?.deletedAt && !pages[id]?.parentId), [order, pages]);

  const allTodos = useMemo(() => {
    const list = [];
    for (const pid of order) {
      const pg = pages[pid];
      // Excluir páginas eliminadas del Calendario y Agenda
      if (!pg || pg.deletedAt) continue;
      for (const b of pg.blocks) {
        if (b.type === "todo" && b.text.trim()) {
          const rawText = b.text;
          const matches = rawText.match(/#[a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]+/g) || [];
          const tags = matches.map(m => m.slice(1).toLowerCase());
          let cleanText = rawText;
          matches.forEach(m => {
            cleanText = cleanText.replace(m, "");
          });
          cleanText = cleanText.replace(/\s+/g, " ").trim();
          if (!cleanText) cleanText = rawText;

          list.push({ pageId: pid, pageTitle: pg.title || "Sin título", pageIcon: pg.icon, blockId: b.id,
                      text: rawText, cleanText, checked: b.checked, date: b.date || null, time: b.time || null, completedAt: b.completedAt || null, tags });
        }
      }
    }
    return list;
  }, [order, pages]);

  /* --- migración: calcula notifyAt para todos con hora ya guardados --- */
  const backfilledRef = useRef(false);
  useEffect(() => {
    if (backfilledRef.current) return;
    let changed = false;
    const next = {};
    for (const [pid, pg] of Object.entries(pages)) {
      if (!pg || !Array.isArray(pg.blocks)) { next[pid] = pg; continue; }
      let bChanged = false;
      const blocks = pg.blocks.map(b => {
        if (b && b.type === "todo" && b.date && b.time && !b.notifyAt) {
          bChanged = true;
          return { ...b, notifyAt: toNotifyAt(b.date, b.time) };
        }
        return b;
      });
      if (bChanged) changed = true;
      next[pid] = bChanged ? { ...pg, blocks } : pg;
    }
    if (changed) setPages(next);
    else backfilledRef.current = Object.keys(pages).length > 0;
  }, [pages]);

  const subscribeUserToPush = async () => {
    if (!user) return;
    try {
      if (!("serviceWorker" in navigator)) return;
      const registration = await navigator.serviceWorker.ready;
      
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.warn("Falta VITE_VAPID_PUBLIC_KEY en las variables de entorno.");
        return;
      }

      const currentKeyBytes = urlBase64ToUint8Array(vapidKey);

      let subscription = await registration.pushManager.getSubscription();
      const existingKeyBytes = subscription?.options?.applicationServerKey;
      const keyChanged = !!existingKeyBytes && !arrayBuffersEqual(existingKeyBytes, currentKeyBytes);

      if (keyChanged) {
        console.log("La clave VAPID cambió, re-suscribiendo a push...");
        await subscription.unsubscribe();
        subscription = null;
      }

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: currentKeyBytes
        });
      }
      
      const subJSON = subscription.toJSON();
      if (!subJSON.keys || !subJSON.keys.p256dh || !subJSON.keys.auth) {
        throw new Error("Claves de suscripción incompletas.");
      }

      const { error } = await supabase
        .from("push_subscriptions")
        .upsert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: subJSON.keys.p256dh,
          auth: subJSON.keys.auth
        }, { onConflict: "endpoint" });

      if (error) throw error;
      console.log("Suscripción Push registrada en Supabase.");
    } catch (err) {
      console.warn("No se pudo registrar la suscripción Push en Supabase:", err);
    }
  };

  const enableNotifs = async () => {
    if (!("Notification" in window)) {
      showToast("Este navegador no soporta notificaciones.", "error");
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        setNotifOn(true);
        showToast("Recordatorios activados correctamente");
        await subscribeUserToPush();
      } else {
        showToast("No se concedió el permiso de notificaciones.", "error");
      }
    } catch {
      showToast("No se pudo activar los recordatorios.", "error");
    }
  };

  useEffect(() => {
    if (user && notifOn) subscribeUserToPush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, notifOn]);

  /* --- respaldo --- */
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ pages, order, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `orbita-respaldo-${todayStr()}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const importData = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.pages || !Array.isArray(data.order)) throw new Error("formato");
        
        setConfirmDialog({
          title: "¿Importar respaldo?",
          message: "Esto reemplazará todo tu contenido actual de forma permanente. ¿Deseas continuar?",
          onConfirm: () => {
            setPages(data.pages);
            setOrder(data.order);
            setCurrentId(data.order[0] || null);
            setSettingsOpen(false);
            showToast("Respaldo importado con éxito");
          }
        });
      } catch {
        showToast("El archivo no es un respaldo válido de Órbita.", "error");
      }
    };
    reader.readAsText(file);
  };

  const searchHits = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return order.filter(id => {
      const pg = pages[id];
      // Excluir páginas en papelera del buscador
      if (!pg || pg.deletedAt) return false;
      return (pg.title || "").toLowerCase().includes(q) || pg.blocks.some(b => (b.text || "").toLowerCase().includes(q));
    });
  }, [search, order, pages]);

  const selectPage = (id) => { setCurrentId(id); setView("docs"); if (window.innerWidth < 768) setSidebarOpen(false); };

  if (authLoading || (user && profileLoading && !profile)) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: T.bg }}>
        <div className="text-sm" style={{ color: T.muted }}>Comprobando sesión…</div>
      </div>
    );
  }

  if (!user) {
    return <Auth onLoginSuccess={(u) => setUser(u)} />;
  }

  if (profile?.is_blocked) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center" style={{ background: T.bg, color: T.ink }}>
        <div className="max-w-md w-full rounded-2xl border p-8 shadow-2xl backdrop-blur-md" style={{ borderColor: T.border, background: T.sidebar }}>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl mx-auto mb-4" style={{ background: "rgba(239, 68, 68, 0.15)", color: "var(--danger, #ef4444)" }}>
            <AlertCircle size={24} />
          </div>
          <h1 className="font-serif text-2xl font-bold tracking-tight">
            Acceso Suspendido
          </h1>
          <p className="mt-4 text-sm leading-relaxed" style={{ color: T.muted }}>
            Tu cuenta ha sido bloqueada temporal o permanentemente por infringir las políticas de uso y normas de convivencia de Órbita.
          </p>
          <p className="mt-2 text-xs" style={{ color: T.muted }}>
            Si consideras que esto es un error o deseas apelar la decisión, por favor contáctanos en:
          </p>
          <div className="mt-4 rounded-lg p-3 text-sm font-semibold" style={{ border: "1px solid " + T.border, background: T.bg }}>
            soporte@saucedocode.com
          </div>
          <button
            onClick={handleLogout}
            className="mt-6 w-full rounded-lg py-2.5 text-xs font-semibold text-white shadow-md transition duration-200 hover:brightness-105 active:scale-[0.98]"
            style={{ background: "var(--danger, #ef4444)" }}
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: T.bg }}>
        <div className="text-sm" style={{ color: T.muted }}>Abriendo tu órbita…</div>
      </div>
    );
  }

  const NavBtn = ({ id, icon: Icon, label }) => (
    <button onClick={() => { setView(id); if (window.innerWidth < 768) setSidebarOpen(false); }}
            className="flex flex-1 flex-col items-center gap-1 rounded-md py-2 text-[12px] md:py-1.5 md:text-[11px] font-medium transition"
            style={{ background: view === id ? T.accentSoft : "transparent", color: view === id ? T.accent : T.muted }}>
      <Icon size={16} /> {label}
    </button>
  );

  return (
    <div className="flex h-full w-full overflow-hidden font-sans" style={{ background: T.bg, color: T.ink }}>
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-20 bg-black/30 md:hidden" />}

      {/* Alerta flotante de nuevo ticket de soporte para el administrador */}
      {newTicketAlert && (
        <div className="fixed top-5 right-5 left-5 sm:left-auto z-[100] flex w-auto sm:w-80 max-w-sm flex-col gap-1.5 rounded-xl border p-4 shadow-2xl animate-in slide-in-from-top-5 duration-300 bg-[var(--card, #1e1e1e)] text-left"
             style={{ borderColor: "var(--accent)" }}>
          <div className="flex items-center gap-2 text-[var(--accent)]">
            <Bell size={15} className="animate-bounce" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Nuevo Reporte de Soporte</span>
          </div>
          <p className="text-xs font-bold leading-tight text-[var(--ink, #ffffff)] truncate">{newTicketAlert.subject}</p>
          <p className="text-[10px] text-neutral-400 truncate">De: {newTicketAlert.email}</p>
          <button onClick={() => { setView("admin"); setNewTicketAlert(null); }} className="mt-1.5 text-[11px] font-bold text-left underline text-[var(--accent)] hover:text-opacity-80 transition outline-none">
            Ver en panel de administración →
          </button>
        </div>
      )}

      {sidebarOpen && (
        <aside className="fixed inset-y-0 left-0 z-30 flex h-full w-[82vw] max-w-72 flex-shrink-0 flex-col border-r md:static md:inset-auto md:w-64 md:max-w-none" style={{ background: T.sidebar, borderColor: T.border }}>
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <OrbitaMark size={24} className="shrink-0" />
              <span className="font-serif text-[15px] font-semibold tracking-tight">Órbita</span>
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
            <div className="flex items-center gap-1">
              {/* Botón Campanita de Notificaciones 🔔 */}
              <button onClick={() => setNotifPanelOpen(o => !o)} title="Notificaciones" className="relative hov rounded p-1 cursor-pointer">
                <Bell size={16} style={{ color: T.muted }} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-[var(--danger,#ef4444)] px-1 text-[8px] font-bold text-white animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button onClick={() => setSidebarOpen(false)} className="hov rounded p-1"><PanelLeftClose size={16} style={{ color: T.muted }} /></button>
            </div>
          </div>

          <div className="flex gap-1 px-3 pb-2">
            <NavBtn id="docs" icon={FileText} label="Páginas" />
            <NavBtn id="calendar" icon={CalendarDays} label="Calendario" />
            <NavBtn id="agenda" icon={ListChecks} label="Agenda" />
            <NavBtn id="analytics" icon={BarChart3} label="Analíticas" />
            {profile?.role === "admin" && (
              <NavBtn id="admin" icon={Shield} label="Admin" />
            )}
          </div>

          <div className="px-3 pb-2">
            <div className="flex items-center gap-2 rounded-md border px-2 py-1.5" style={{ borderColor: T.border, background: T.bg }}>
              <Search size={14} style={{ color: T.muted }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar"
                     className="w-full bg-transparent text-[13px] outline-none placeholder:text-neutral-400" style={{ color: T.ink }} />
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 pb-4">
            <DndContext sensors={sidebarSensors} collisionDetection={sidebarCollision}
                        onDragStart={handleSidebarDragStart} onDragOver={handleSidebarDragOver} onDragEnd={handleSidebarDragEnd}>
            {searchHits ? (
              <div className="pt-1">
                {searchHits.length === 0 && <p className="px-2 py-2 text-[13px]" style={{ color: T.muted }}>Sin resultados.</p>}
                {searchHits.map(id => <PageRow key={id} pg={pages[id]} depth={0} active={id === currentId} onClick={() => selectPage(id)} />)}
              </div>
            ) : (
              <>
                {/* Carpetas */}
                {folderOrder.filter(fid => {
                  const f = folders[fid];
                  return f && !f.parentId;
                }).map(fid => {
                  const folder = folders[fid];
                  return (
                    <FolderRow
                      key={fid}
                      folder={folder}
                      pages={pages}
                      childrenOf={childrenOf}
                      currentId={currentId}
                      view={view}
                      selectPage={selectPage}
                      expanded={expanded}
                      setExpanded={setExpanded}
                      addPage={addPage}
                      deletePage={softDeletePage}
                      setConfirmDialog={setConfirmDialog}
                      onEditFolder={(fid, name, color) => renameFolder(fid, name, color)}
                      onDeleteFolder={(fid) => deleteFolder(fid)}
                      folders={folders}
                      folderOrder={folderOrder}
                      addPageToFolder={addPageToFolder}
                      removePageFromFolder={removePageFromFolder}
                      getFolderOfPage={getFolderOfPage}
                      updatePage={updatePage}
                      onCreateSubfolder={(fid) => addFolder("", null, fid)}
                      hoverState={sidebarHover}
                    />
                  );
                })}

                {/* Páginas sin carpeta */}
                <Tree roots={unFolderedRoots} childrenOf={childrenOf} pages={pages} currentId={currentId} view={view}
                      selectPage={selectPage} expanded={expanded} setExpanded={setExpanded} addPage={addPage}
                      deletePage={softDeletePage} sharedPages={sharedPages} sharedByMe={sharedByMe} setConfirmDialog={setConfirmDialog}
                      folders={folders} folderOrder={folderOrder} addPageToFolder={addPageToFolder} removePageFromFolder={removePageFromFolder} getFolderOfPage={getFolderOfPage}
                      updatePage={updatePage} hoverState={sidebarHover} />
              </>
            )}
            <DragOverlay>
              {sidebarDragActive && (
                sidebarDragActive.type === "page" ? (
                  <div className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-[13px] shadow-lg"
                       style={{ background: T.sidebar, borderColor: T.border, color: T.ink, width: "max-content" }}>
                    <span>{pages[sidebarDragActive.id]?.icon}</span>
                    <span className="truncate">{pages[sidebarDragActive.id]?.title || "Sin título"}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-[13px] shadow-lg"
                       style={{ background: T.sidebar, borderColor: T.border, color: T.ink, width: "max-content" }}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: folders[sidebarDragActive.id]?.color }} />
                    <span className="truncate font-semibold">{folders[sidebarDragActive.id]?.name}</span>
                  </div>
                )
              )}
            </DragOverlay>
            </DndContext>

          </nav>

          <div className="border-t px-2 py-2" style={{ borderColor: T.border }}>
            <button onClick={() => addPage(null)} className="hov flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium" style={{ color: T.accent }}>
              <Plus size={15} /> Nueva página
            </button>
            <button onClick={() => { addFolder(); }} className="hov flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium" style={{ color: T.muted }}>
              <FolderPlus size={15} /> Nueva carpeta
            </button>
            <button onClick={() => setView("trash")}
                    className={`hov flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium mt-0.5 ${view === "trash" ? "font-semibold" : ""}`}
                    style={{ color: view === "trash" ? T.accent : T.muted }}>
              <Trash2 size={14} /> Papelera
              {trashedPages.length > 0 && (
                <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
                      style={{ background: "var(--danger, #ef4444)" }}>
                  {trashedPages.length}
                </span>
              )}
            </button>
            <div className="mt-1 flex gap-1">
              <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="hov flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px]" style={{ color: T.muted }}>
                {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />} {theme === "dark" ? "Claro" : "Oscuro"}
              </button>
              <button onClick={() => setSettingsOpen(true)} className="hov relative flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px]" style={{ color: T.muted }}>
                <Settings size={14} /> Ajustes
                {profile?.role === "admin" && openTicketsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[var(--danger, #ef4444)] text-[9px] font-bold text-white animate-pulse">
                    {openTicketsCount}
                  </span>
                )}
              </button>
            </div>
            
            {/* Widget de Perfil del Usuario */}
            <div className="mt-2 pt-2 border-t flex items-center gap-2 px-1" style={{ borderColor: T.border }}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="h-8 w-8 rounded-full object-cover border" style={{ borderColor: T.border }} />
              ) : (
                <div className="h-8 w-8 rounded-full flex items-center justify-center bg-[var(--accent-soft)] text-[var(--accent)] font-semibold text-xs border" style={{ borderColor: T.border }}>
                  {(profile?.display_name || user?.email || "U").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold leading-tight" style={{ color: T.ink }}>
                  {profile?.display_name || "Sin nombre"}
                </p>
                <p className="truncate text-[10px] leading-tight" style={{ color: T.muted }}>
                  {user?.email}
                </p>
              </div>
            </div>
          </div>
        </aside>
      )}

      <main className="relative flex h-full flex-1 flex-col overflow-y-auto">
        {announcement && (
          <div className="flex items-center justify-between px-6 py-2.5 text-xs font-semibold bg-[var(--accent-soft)] text-[var(--accent)] border-b border-[var(--border)] animate-in slide-in-from-top duration-200">
            <span className="flex items-center gap-1.5">📢 {announcement}</span>
            <button onClick={() => {
              localStorage.setItem("orbita:dismissed_announcement", announcement);
              setAnnouncement(null);
            }} className="hov rounded p-0.5"><X size={12} /></button>
          </div>
        )}

        {/* Cabecera Móvil Fija */}
        <header className="sticky top-0 z-20 flex h-14 flex-shrink-0 items-center justify-between border-b px-4 bg-header md:hidden"
                style={{ borderColor: T.border }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="hov rounded p-1.5 cursor-pointer" style={{ color: T.muted }}>
              <Menu size={20} />
            </button>
            <OrbitaMark size={22} className="shrink-0" />
            <span className="font-serif text-[15px] font-bold tracking-tight">
              {view === "calendar" ? "Calendario" :
               view === "agenda" ? "Agenda" :
               view === "analytics" ? "Analíticas" :
               view === "trash" ? "Papelera" :
               view === "admin" ? "Panel Admin" :
               page ? page.title || "Sin título" : "Órbita"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setNotifPanelOpen(o => !o)} className="relative hov rounded p-1.5 cursor-pointer" style={{ color: T.muted }}>
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-[var(--danger,#ef4444)] px-1 text-[8px] font-bold text-white animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)} className="hov absolute left-3 top-3 z-10 rounded p-1.5 hidden md:block"><PanelLeft size={17} style={{ color: T.muted }} /></button>
        )}

        {view === "calendar" ? (
          <CalendarView todos={allTodos} gotoTask={gotoTask} toggleDone={toggleDone} quickAdd={quickAdd} />
        ) : view === "agenda" ? (
          <AgendaView todos={allTodos} gotoTask={gotoTask} toggleDone={toggleDone} quickAdd={quickAdd} />
        ) : view === "analytics" ? (
          <AnalyticsView todos={allTodos} />
        ) : view === "trash" ? (
          <TrashView pages={pages} order={order} onRestore={(id) => { restorePage(id); showToast("Página restaurada"); }}
                     onDelete={(id) => { setConfirmDialog({ title: "¿Eliminar definitivamente?", message: "Esta acción es irreversible. La página y todo su contenido se perderá para siempre.", onConfirm: () => permanentDelete(id) }); }}
                     onEmpty={() => { setConfirmDialog({ title: "¿Vaciar papelera?", message: "Esto eliminará permanentemente todas las páginas en la papelera. No se puede deshacer.", onConfirm: emptyTrash }); }} />
        ) : view === "admin" && profile?.role === "admin" ? (
          <AdminDashboardView user={user} profile={profile} openTicketsCount={openTicketsCount} setOpenTicketsCount={setOpenTicketsCount} showToast={showToast} />
        ) : page ? (
          <Editor key={page.id} page={page} updatePage={updatePage} updateBlockInPage={updateBlockInPage}
                  onAddSub={() => addPage(page.id)} onDelete={() => softDeletePage(page.id)}
                  setConfirmDialog={setConfirmDialog} showToast={showToast} user={user} />
        ) : (
          <div className="grid flex-1 place-items-center px-6 text-center">
            <div>
              <img src="/ilustracion-empty.svg" alt="" className="mx-auto mb-3 w-56 select-none" draggable="false" />
              <p className="mb-1 font-serif text-lg">Tu órbita está vacía</p>
              <p className="mb-4 text-sm" style={{ color: T.muted }}>Crea tu primera página para empezar.</p>
              <button onClick={() => addPage(null)} className="rounded-md px-4 py-2 text-sm font-medium text-white transition" style={{ background: T.accent }}>Crear página</button>
            </div>
          </div>
        )}
      </main>

      {settingsOpen && (
        <SettingsModal theme={theme} setTheme={setTheme} notifOn={notifOn} enableNotifs={enableNotifs}
                       onExport={exportData} onImport={importData} onClose={() => setSettingsOpen(false)}
                       user={user} onLogout={handleLogout} profile={profile}
                       updateProfileData={updateProfileData} uploadAvatar={uploadAvatar}
                       removeAvatar={removeAvatar} deleteAccount={deleteAccount}
                       setConfirmDialog={setConfirmDialog} />
      )}

      {/* Panel desplegable de Notificaciones 🔔 */}
      {notifPanelOpen && (
        <NotificationPanel notifications={notifications} setNotifications={setNotifications}
                           onSelectNotif={(pageId) => {
                             if (pageId) {
                               selectPage(pageId);
                             }
                             setNotifPanelOpen(false);
                           }}
                           onAcceptInvite={async (n) => {
                             try {
                               if (n.shareId) {
                                 setAcceptedShares(prev => Array.from(new Set([...prev, n.shareId])));
                               }
                               if (supabase && n.shareId) {
                                 try {
                                   await supabase
                                     .from("page_shares")
                                     .update({ status: "accepted" })
                                     .eq("id", n.shareId);
                                 } catch { /* ignore if status col missing */ }
                               }
                               setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, status: "accepted", read: true } : item));
                               showToast("¡Invitación aceptada!");
                               setNotifPanelOpen(false);

                               // Cargar la página aceptada de inmediato en el estado local
                               // SIN depender de fetchSharedPages (evita stale closure de acceptedShares)
                               if (n.pageId && n.ownerEmail && supabase) {
                                 try {
                                   // Obtener workspace del propietario para leer los datos de la página
                                   const { data: wsData } = await supabase
                                     .from("user_workspaces")
                                     .select("pages")
                                     .eq("user_id", n.ownerId || null)
                                     .single();
                                   const ownerPage = wsData?.pages?.[n.pageId];
                                   if (ownerPage) {
                                     setPages(p => ({
                                       ...p,
                                       [n.pageId]: {
                                         ...ownerPage,
                                         parentId: undefined,
                                         isShared: true,
                                         isSharedWithMe: true,
                                         ownerId: n.ownerId,
                                         permission: n.permission || "view"
                                       }
                                     }));
                                     setSharedPages(prev => {
                                       const already = prev.find(s => s.page_id === n.pageId);
                                       if (already) return prev;
                                       return [...prev, { id: n.shareId, page_id: n.pageId, owner_id: n.ownerId, permission: n.permission || "view" }];
                                     });
                                   }
                                 } catch { /* fallback al refresh normal */ }
                               }

                               // Refrescar via ref para tener siempre la versión más reciente
                               setTimeout(() => {
                                 if (fetchSharedPagesRef.current) fetchSharedPagesRef.current();
                                 if (n.pageId) selectPage(n.pageId);
                               }, 200);

                               // Notificar al propietario
                               if (supabase && n.ownerEmail) {
                                 const respChan = supabase.channel(`user_notifs:${n.ownerEmail.toLowerCase()}`);
                                 respChan.subscribe(async (status) => {
                                   if (status === "SUBSCRIBED") {
                                     await respChan.send({
                                       type: "broadcast",
                                       event: "invite_response",
                                       payload: {
                                         responderEmail: user?.email,
                                         pageTitle: n.pageTitle || "Sin título",
                                         accepted: true
                                       }
                                     });
                                     setTimeout(() => respChan.unsubscribe(), 1000);
                                   }
                                 });
                               }
                             } catch {
                               showToast("Error al aceptar invitación", "error");
                             }
                           }}
                           onDeclineInvite={async (n) => {
                             try {
                               if (n.shareId) {
                                 setAcceptedShares(prev => prev.filter(id => id !== n.shareId));
                               }
                               if (supabase && n.shareId) {
                                 await supabase.from("page_shares").delete().eq("id", n.shareId);
                               }
                               setNotifications(prev => prev.filter(item => item.id !== n.id));
                               setSharedPages(prev => prev.filter(sp => sp.id !== n.shareId));
                               setPages(prev => {
                                 const next = { ...prev };
                                 if (n.pageId) delete next[n.pageId];
                                 return next;
                               });
                               showToast("Invitación rechazada");
                               setNotifPanelOpen(false);

                               // Notificar al propietario
                               if (supabase && n.ownerEmail) {
                                 const respChan = supabase.channel(`user_notifs:${n.ownerEmail.toLowerCase()}`);
                                 respChan.subscribe(async (status) => {
                                   if (status === "SUBSCRIBED") {
                                     await respChan.send({
                                       type: "broadcast",
                                       event: "invite_response",
                                       payload: {
                                         responderEmail: user?.email,
                                         pageTitle: n.pageTitle || "Sin título",
                                         accepted: false
                                       }
                                     });
                                     setTimeout(() => respChan.unsubscribe(), 1000);
                                   }
                                 });
                               }
                             } catch {
                               showToast("Error al rechazar invitación", "error");
                             }
                           }}
                           onClose={() => setNotifPanelOpen(false)} />
      )}

      {/* Notificaciones Toast flotantes globales */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-xl border px-4 py-3 shadow-2xl animate-in slide-in-from-bottom-5 duration-300 bg-[var(--card, #1e1e1e)] text-left"
             style={{
               borderColor: toast.type === "success" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)",
               color: "var(--ink, #ffffff)",
             }}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold leading-none"
                style={{
                  background: toast.type === "success" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  color: toast.type === "success" ? "#10b981" : "#ef4444",
                }}>
            {toast.type === "success" ? "✓" : "✕"}
          </span>
          <span className="text-xs font-semibold">{toast.text}</span>
        </div>
      )}

      {/* Diálogo Confirmación Global */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setConfirmDialog(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-xl border p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left"
               style={{ background: "var(--card, #1e1e1e)", borderColor: "var(--border)", color: "var(--ink)" }}>
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/20 text-amber-500">
                <AlertCircle size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="font-serif text-base font-bold">{confirmDialog.title}</h3>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{confirmDialog.message}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setConfirmDialog(null)} className="hov px-4 py-2 rounded-lg text-xs font-semibold border transition" style={{ borderColor: "var(--border)", color: "var(--ink)" }}>
                Cancelar
              </button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} className="px-4 py-2 rounded-lg text-xs font-semibold text-white shadow transition hover:brightness-105 active:scale-[0.98]" style={{ background: T.accent }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= Modal de Términos para Borrado de Cuenta ================= */
function DeleteAccountTermsModal({ onClose, onProceed }) {
  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(false);
  const [check3, setCheck3] = useState(false);

  const canProceed = check1 && check2 && check3;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={e => e.stopPropagation()}>
      <div onClick={e => e.stopPropagation()} className="relative w-full max-w-md rounded-2xl border border-red-500/30 bg-[#121212] text-white p-6 shadow-2xl space-y-5">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-red-400">Términos de Eliminación</h3>
              <p className="text-[11px] text-neutral-400">Debes aceptar los 3 puntos para continuar</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Warning Notice */}
        <div className="rounded-xl border border-red-500/20 bg-red-950/30 p-3.5 text-[11px] text-red-200/90 leading-relaxed">
          Estás a punto de iniciar el proceso para eliminar permanentemente tu cuenta de <strong>Órbita</strong>. Por favor lee y marca las casillas de conformidad:
        </div>

        {/* Terms Checklist */}
        <div className="space-y-2.5">
          <label className="flex items-start gap-3 p-3 rounded-xl border border-neutral-800 bg-neutral-900/80 hover:bg-neutral-800/80 transition cursor-pointer select-none">
            <input type="checkbox" checked={check1} onChange={e => setCheck1(e.target.checked)} className="mt-0.5 accent-red-500 h-4 w-4 rounded cursor-pointer" />
            <span className="text-[11px] text-neutral-300 leading-snug">
              Comprendo que se eliminarán <strong>permanentemente todas mis páginas, notas y configuraciones</strong>.
            </span>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-neutral-800 bg-neutral-900/80 hover:bg-neutral-800/80 transition cursor-pointer select-none">
            <input type="checkbox" checked={check2} onChange={e => setCheck2(e.target.checked)} className="mt-0.5 accent-red-500 h-4 w-4 rounded cursor-pointer" />
            <span className="text-[11px] text-neutral-300 leading-snug">
              Acepto que mis notas compartidas con otros colaboradores <strong>quedarán canceladas e inaccesibles</strong>.
            </span>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-neutral-800 bg-neutral-900/80 hover:bg-neutral-800/80 transition cursor-pointer select-none">
            <input type="checkbox" checked={check3} onChange={e => setCheck3(e.target.checked)} className="mt-0.5 accent-red-500 h-4 w-4 rounded cursor-pointer" />
            <span className="text-[11px] text-neutral-300 leading-snug">
              Reconozco que esta acción es <strong>IRREVERSIBLE</strong> y no podré recuperar mis datos.
            </span>
          </label>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 flex items-center justify-end gap-3 border-t border-neutral-800">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer">
            Cancelar
          </button>
          <button 
            disabled={!canProceed}
            onClick={onProceed}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-2 transition shadow-md ${
              canProceed 
                ? "bg-red-600 hover:bg-red-500 active:scale-95 cursor-pointer" 
                : "bg-neutral-800 text-neutral-500 cursor-not-allowed opacity-40"
            }`}
          >
            <Trash2 size={14} /> Continuar a Confirmación
          </button>
        </div>

      </div>
    </div>
  );
}

/* ================= Ajustes ================= */
function SettingsModal({ theme, setTheme, notifOn, enableNotifs, onExport, onImport, onClose, user, onLogout, profile, updateProfileData, uploadAvatar, removeAvatar, deleteAccount, setConfirmDialog }) {
  const fileRef = useRef(null);
  const [activeTab, setActiveTab] = useState("general"); // "general", "profile", "support", "rules"
  
  const [tempName, setTempName] = useState(profile?.display_name || "");
  const [tempBio, setTempBio] = useState(profile?.bio || "¡Hola! Estoy usando Órbita.");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editingImageSrc, setEditingImageSrc] = useState(null);
  const [showDeleteTermsModal, setShowDeleteTermsModal] = useState(false);

  useEffect(() => {
    if (profile) {
      setTempName(profile.display_name || "");
      setTempBio(profile.bio || "¡Hola! Estoy usando Órbita.");
    }
  }, [profile]);
  
  // Soporte
  const [subject, setSubject] = useState("");
  const [desc, setDesc] = useState("");
  const [sending, setSending] = useState(false);
  const [supportMsg, setSupportMsg] = useState(null);
  const [supportErr, setSupportErr] = useState(null);

  const handleSendTicket = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !desc.trim()) return;

    // Anti-spam limit
    const lastSent = localStorage.getItem("orbita:last_ticket_time");
    if (lastSent && Date.now() - parseInt(lastSent) < 5 * 60 * 1000) {
      const minutesLeft = Math.ceil((5 * 60 * 1000 - (Date.now() - parseInt(lastSent))) / 60000);
      setSupportErr(`Por favor, espera ${minutesLeft} minuto(s) antes de enviar otro ticket.`);
      return;
    }

    setSending(true);
    setSupportMsg(null);
    setSupportErr(null);
    try {
      const { error } = await supabase
        .from("support_tickets")
        .insert({
          user_id: user.id,
          user_email: user.email,
          subject: subject.trim(),
          description: desc.trim()
        });
      if (error) throw error;

      localStorage.setItem("orbita:last_ticket_time", Date.now().toString());
      setSubject("");
      setDesc("");
      setSupportMsg("¡Tu reporte ha sido enviado con éxito! Daremos seguimiento interno.");
    } catch (err) {
      setSupportErr(err.message || "Error al enviar el ticket.");
    } finally {
      setSending(false);
    }
  };

  const themeBtn = (val, Icon, label) => (
    <button onClick={() => setTheme(val)} className="flex flex-1 items-center justify-center gap-1.5 rounded-md border py-2 text-[13px]"
            style={{ borderColor: theme === val ? T.accent : T.border, color: theme === val ? T.accent : T.ink, fontWeight: theme === val ? 600 : 400 }}>
      <Icon size={15} /> {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-2xl rounded-xl border p-5 shadow-2xl flex flex-col md:flex-row gap-6 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150" style={{ background: T.bg, borderColor: T.border, color: T.ink }}>
        
        {/* Barra lateral de Navegación del Modal */}
        <div className="w-full md:w-44 flex flex-row md:flex-col border-b md:border-b-0 md:border-r pb-4 md:pb-0 pr-0 md:pr-4 gap-1 flex-wrap md:flex-nowrap">
          <button onClick={() => setActiveTab("general")} className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md text-[13px] font-medium transition"
                  style={{ background: activeTab === "general" ? T.accentSoft : "transparent", color: activeTab === "general" ? T.accent : T.ink }}>
            <Settings size={15} /> General
          </button>
          <button onClick={() => setActiveTab("profile")} className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md text-[13px] font-medium transition"
                  style={{ background: activeTab === "profile" ? T.accentSoft : "transparent", color: activeTab === "profile" ? T.accent : T.ink }}>
            <User size={15} /> Perfil
          </button>
          <button onClick={() => setActiveTab("support")} className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md text-[13px] font-medium transition"
                  style={{ background: activeTab === "support" ? T.accentSoft : "transparent", color: activeTab === "support" ? T.accent : T.ink }}>
            <MessageSquare size={15} /> Soporte
          </button>
          <button onClick={() => setActiveTab("rules")} className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md text-[13px] font-medium transition"
                  style={{ background: activeTab === "rules" ? T.accentSoft : "transparent", color: activeTab === "rules" ? T.accent : T.ink }}>
            <AlertCircle size={15} /> Normas
          </button>
          <button onClick={onLogout} className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md text-[13px] font-semibold mt-auto" style={{ color: "var(--danger, #ef4444)" }}>
            <Minus size={15} /> Cerrar sesión
          </button>
        </div>

        {/* Panel de Contenido */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-serif text-lg font-bold capitalize">
              {activeTab === "general" ? "Ajustes Generales" : 
               activeTab === "profile" ? "Mi Perfil" : 
               activeTab === "support" ? "Soporte Técnico" : "Términos y Normas"}
            </h2>
            <button onClick={onClose} className="hov rounded p-1"><X size={16} style={{ color: T.muted }} /></button>
          </div>

          {/* TAB: GENERAL */}
          {activeTab === "general" && (
            <div className="space-y-4">
              <section>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: T.muted }}>Apariencia</p>
                <div className="flex gap-2">{themeBtn("light", Sun, "Claro")}{themeBtn("dark", Moon, "Oscuro")}</div>
              </section>

              <section>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: T.muted }}>Recordatorios</p>
                {notifOn ? (
                  <div className="flex items-start gap-2 rounded-md border px-3 py-2 text-[13px]" style={{ borderColor: T.border, color: T.accent }}>
                    <Bell size={15} className="mt-0.5 flex-shrink-0" /> Activados. Te avisamos de cada tarea a su hora, aunque la app esté cerrada.
                  </div>
                ) : (
                  <button onClick={enableNotifs} className="flex w-full items-center justify-center gap-1.5 rounded-md py-2 text-[13px] font-medium text-white" style={{ background: T.accent }}>
                    <Bell size={15} /> Activar recordatorios
                  </button>
                )}
              </section>

              <section>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: T.muted }}>Cuenta</p>
                <div className="flex items-center justify-between gap-2 rounded-lg border p-3 text-[13px]" style={{ borderColor: T.border }}>
                  <span className="truncate font-medium" style={{ color: T.ink }} title={user?.email}>{user?.email}</span>
                </div>
              </section>

              <section>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: T.muted }}>Datos (respaldo)</p>
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
                  Exporta de vez en cuando para guardar tus notas en un archivo o transferirlas a otro dispositivo.
                </p>
              </section>
            </div>
          )}

          {/* TAB: PROFILE */}
          {activeTab === "profile" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* WhatsApp-style avatar section */}
              <div className="flex flex-col items-center">
                <div className="relative group">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="h-24 w-24 rounded-full object-cover border-2 shadow-md transition group-hover:brightness-90" style={{ borderColor: T.accent }} />
                  ) : (
                    <div className="h-24 w-24 rounded-full flex items-center justify-center text-3xl font-bold text-[var(--accent)] bg-[var(--accent-soft)] border-2 border-dashed shadow-sm" style={{ borderColor: T.accent }}>
                      {(profile?.display_name || user?.email || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                  {/* Camera overlay button */}
                  <label className="absolute bottom-0 right-0 h-8 w-8 rounded-full flex items-center justify-center cursor-pointer shadow-md bg-[var(--accent)] text-white hover:brightness-105 active:scale-95 transition">
                    <Camera size={14} />
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => setEditingImageSrc(reader.result);
                        reader.readAsDataURL(file);
                        e.target.value = "";
                      }
                    }} />
                  </label>
                </div>
                {profile?.avatar_url ? (
                  <button onClick={removeAvatar} className="mt-2 flex items-center gap-1 text-[11px] font-medium text-[var(--danger,#ef4444)] hover:underline cursor-pointer">
                    <Trash2 size={12} /> Eliminar foto de perfil
                  </button>
                ) : (
                  <p className="text-[10px] mt-2" style={{ color: T.muted }}>Haz clic en la cámara para subir una foto de perfil</p>
                )}
              </div>

              {/* Display Name Section */}
              <div className="rounded-xl border p-4 shadow-sm" style={{ borderColor: T.border, background: T.sidebar }}>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: T.muted }}>Tu Nombre</p>
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <input type="text" value={tempName} onChange={e => setTempName(e.target.value.slice(0, 25))}
                             placeholder="Tu nombre de pantalla" maxLength={25} autoFocus
                             className="w-full border-b bg-transparent py-1 text-[13px] outline-none" style={{ borderColor: T.accent, color: T.ink }} />
                      <span className="absolute right-1 top-1 text-[10px]" style={{ color: tempName.length >= 25 ? "var(--danger)" : T.muted }}>
                        {tempName.length}/25
                      </span>
                    </div>
                    <button onClick={async () => {
                      const ok = await updateProfileData(tempName.trim(), tempBio);
                      if (ok) setIsEditingName(false);
                    }} className="rounded-lg p-1.5 bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition cursor-pointer"><Check size={14} /></button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold" style={{ color: T.ink }}>{profile?.display_name || "Sin nombre establecido"}</span>
                    <button onClick={() => { setTempName(profile?.display_name || ""); setIsEditingName(true); }} className="hov rounded p-1 cursor-pointer" style={{ color: T.muted }}><Pencil size={13} /></button>
                  </div>
                )}
                <p className="text-[10px] mt-1.5 leading-relaxed" style={{ color: T.muted }}>
                  Este no es un nombre de usuario o PIN. Este nombre será visible para tus colaboradores en Órbita.
                </p>
              </div>

              {/* Info / Status Section */}
              <div className="rounded-xl border p-4 shadow-sm" style={{ borderColor: T.border, background: T.sidebar }}>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: T.muted }}>Info. (Estado)</p>
                {isEditingBio ? (
                  <div className="flex items-center gap-2">
                    <input type="text" value={tempBio} onChange={e => setTempBio(e.target.value)}
                           placeholder="¿Qué estás pensando?" autoFocus
                           className="flex-1 border-b bg-transparent py-1 text-[13px] outline-none" style={{ borderColor: T.accent, color: T.ink }} />
                    <button onClick={async () => {
                      const ok = await updateProfileData(tempName, tempBio.trim());
                      if (ok) setIsEditingBio(false);
                    }} className="rounded-lg p-1.5 bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition cursor-pointer"><Check size={14} /></button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px]" style={{ color: T.ink }}>{profile?.bio || "¡Hola! Estoy usando Órbita."}</span>
                    <button onClick={() => { setTempBio(profile?.bio || ""); setIsEditingBio(true); }} className="hov rounded p-1 cursor-pointer" style={{ color: T.muted }}><Pencil size={13} /></button>
                  </div>
                )}

                {/* Pre-defined templates like WhatsApp status */}
                <div className="mt-3 pt-3 border-t flex flex-wrap gap-1.5" style={{ borderColor: T.border }}>
                  <p className="w-full text-[9px] font-bold uppercase tracking-wide mb-1" style={{ color: T.muted }}>Selecciona un estado rápido</p>
                  {["Disponible", "En Órbita 🚀", "Ocupado", "En reunión 📝", "Solo emergencias 🚨"].map(status => (
                    <button key={status} onClick={() => {
                      setTempBio(status);
                      updateProfileData(profile?.display_name || "", status);
                    }} className="text-[10px] px-2.5 py-1 rounded-full border hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition cursor-pointer"
                       style={{ borderColor: T.border, color: T.muted }}>
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Danger Zone: Delete Account */}
              <div className="rounded-xl border border-red-200 dark:border-red-900/40 p-4 bg-red-50/40 dark:bg-red-950/10 mt-6 shadow-sm">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--danger,#ef4444)]">Zona peligrosa</p>
                <p className="text-[11px] mb-3 leading-relaxed" style={{ color: T.muted }}>
                  Eliminar tu cuenta borrará permanentemente todas tus páginas, configuraciones, notas y foto de perfil. Esta acción no se puede deshacer.
                </p>
                <button onClick={() => setShowDeleteTermsModal(true)} className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-white bg-[var(--danger,#ef4444)] hover:brightness-105 active:scale-[0.98] transition cursor-pointer shadow-sm">
                  <Trash2 size={14} /> Eliminar mi cuenta
                </button>
              </div>
            </div>
          )}

          {/* TAB: SOPORTE */}
          {activeTab === "support" && (
            <form onSubmit={handleSendTicket} className="space-y-4">
              <p className="text-[12px] leading-relaxed" style={{ color: T.muted }}>
                ¿Tienes un problema técnico o una sugerencia? Manda un mensaje aquí. Nuestro equipo lo revisará y le dará seguimiento a la brevedad.
              </p>

              {supportMsg && (
                <div className="p-3 text-xs rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30 text-[var(--accent)] font-medium">
                  {supportMsg}
                </div>
              )}

              {supportErr && (
                <div className="p-3 text-xs rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-[var(--danger, #ef4444)] font-medium">
                  {supportErr}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: T.muted }}>Asunto</label>
                <input type="text" required placeholder="Ej. Error en calendario" value={subject} onChange={e => setSubject(e.target.value)}
                       className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none transition"
                       style={{ borderColor: T.border, background: T.bg, color: T.ink }} />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: T.muted }}>Detalle del mensaje</label>
                <textarea required rows={4} placeholder="Describe el problema de forma detallada..." value={desc} onChange={e => setDesc(e.target.value)}
                          className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none transition resize-none"
                          style={{ borderColor: T.border, background: T.bg, color: T.ink }} />
              </div>

              <button type="submit" disabled={sending} className="w-full py-2.5 rounded-lg text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow"
                      style={{ background: T.accent }}>
                {sending ? <Loader2 size={14} className="animate-spin" /> : "Enviar reporte de soporte"}
              </button>
            </form>
          )}

          {/* TAB: RULES */}
          {activeTab === "rules" && (
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1 text-xs leading-relaxed" style={{ color: T.ink }}>
              <div>
                <h3 className="font-semibold text-[13px] mb-1">Términos de Servicio</h3>
                <p style={{ color: T.muted }}>Al usar Órbita, aceptas que tus datos sean encriptados en la base de datos de la plataforma y guardados de forma de caché en el dispositivo. Eres responsable de exportar respaldos regularmente. Está prohibido dar mal uso a las herramientas y automatizaciones del sistema.</p>
              </div>
              <hr style={{ borderColor: T.border }} />
              <div>
                <h3 className="font-semibold text-[13px] mb-1">Normas de Convivencia</h3>
                <ul className="list-disc pl-4 space-y-1.5" style={{ color: T.muted }}>
                  <li><strong>Respeto absoluto:</strong> Cualquier ticket de soporte ofensivo, obsceno, insultante o con amenazas será sancionado de forma definitiva.</li>
                  <li><strong>Prohibición de Spam:</strong> No usar las cajas de texto ni soporte técnico para propagar spam, publicidad o código malicioso.</li>
                  <li><strong>Uso Legítimo:</strong> Queda prohibido alterar perfiles ajenos o vulnerar la seguridad de la base de datos de Órbita.</li>
                  <li><strong>Sanción:</strong> Los perfiles que violen estas normas serán suspendidos de forma indefinida por el equipo administrador.</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
      {editingImageSrc && (
        <ImageEditorModal 
          imageSrc={editingImageSrc} 
          onClose={() => setEditingImageSrc(null)}
          onSave={async (blob) => {
            await uploadAvatar(blob);
            setEditingImageSrc(null);
          }}
        />
      )}

      {showDeleteTermsModal && (
        <DeleteAccountTermsModal
          onClose={() => setShowDeleteTermsModal(false)}
          onProceed={() => {
            setShowDeleteTermsModal(false);
            if (setConfirmDialog) {
              setConfirmDialog({
                title: "¿Eliminar tu cuenta definitivamente?",
                message: "Confirmación final: Tu cuenta y todos tus datos serán eliminados permanentemente ahora mismo. ¿Deseas proceder?",
                onConfirm: () => {
                  onClose();
                  deleteAccount();
                }
              });
            }
          }}
        />
      )}
    </div>
  );
}

/* ================= Editor de Foto de Perfil ================= */
function ImageEditorModal({ imageSrc, onClose, onSave }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedFilter, setSelectedFilter] = useState("none");
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef(null);
  const imgRef = useRef(null);

  const filters = [
    { id: "none", name: "Original" },
    { id: "grayscale", name: "B&N" },
    { id: "sepia", name: "Sepia" },
    { id: "warm", name: "Cálido" },
    { id: "cool", name: "Frío" },
    { id: "vivid", name: "Vívido" }
  ];

  const handleImageLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    setDimensions({ width: naturalWidth, height: naturalHeight });
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    const touch = e.touches[0];
    setDragStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setOffset({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y
    });
  };

  const handleSave = () => {
    const canvas = document.createElement("canvas");
    const size = 300; // tamaño final del avatar
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    if (!ctx || !imgRef.current) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    if (selectedFilter === "grayscale") {
      ctx.filter = "grayscale(100%)";
    } else if (selectedFilter === "sepia") {
      ctx.filter = "sepia(100%)";
    } else if (selectedFilter === "warm") {
      ctx.filter = "saturate(150%) sepia(20%)";
    } else if (selectedFilter === "cool") {
      ctx.filter = "hue-rotate(15deg) saturate(125%) brightness(105%)";
    } else if (selectedFilter === "vivid") {
      ctx.filter = "contrast(125%) brightness(105%) saturate(150%)";
    } else {
      ctx.filter = "none";
    }

    const naturalWidth = dimensions.width || imgRef.current.naturalWidth || 300;
    const naturalHeight = dimensions.height || imgRef.current.naturalHeight || 300;

    // Viewport de corte en DOM: 192px de diámetro
    const viewportSize = 192;
    const scaleFactor = 300 / viewportSize;
    const baseScale = viewportSize / Math.min(naturalWidth, naturalHeight);

    const drawWidth = naturalWidth * baseScale * zoom * scaleFactor;
    const drawHeight = naturalHeight * baseScale * zoom * scaleFactor;
    const drawX = (150 - (drawWidth / 2)) + (offset.x * scaleFactor);
    const drawY = (150 - (drawHeight / 2)) + (offset.y * scaleFactor);

    ctx.drawImage(imgRef.current, drawX, drawY, drawWidth, drawHeight);

    canvas.toBlob((blob) => {
      if (blob) {
        onSave(blob);
      }
    }, "image/jpeg", 0.9);
  };

  const getFilterStyle = (filterId) => {
    switch (filterId) {
      case "grayscale": return "grayscale(100%)";
      case "sepia": return "sepia(100%)";
      case "warm": return "saturate(150%) sepia(20%)";
      case "cool": return "hue-rotate(15deg) saturate(125%) brightness(105%)";
      case "vivid": return "contrast(125%) brightness(105%) saturate(150%)";
      default: return "none";
    }
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/85 p-4 animate-in fade-in duration-200" onClick={e => e.stopPropagation()}>
      <div className="w-full max-w-md rounded-2xl p-5 border shadow-2xl flex flex-col items-center bg-neutral-900 border-neutral-800 text-white" onClick={e => e.stopPropagation()}>
        <h3 className="font-serif text-lg font-bold mb-4 self-start">Editar foto de perfil</h3>
        
        <div 
          ref={containerRef}
          className="relative w-64 h-64 overflow-hidden bg-black rounded-lg cursor-move border border-neutral-700 select-none flex items-center justify-center"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
        >
          <img 
            ref={imgRef}
            src={imageSrc} 
            alt="Original" 
            draggable="false"
            onLoad={handleImageLoad}
            className="max-w-none origin-center pointer-events-none transition-transform duration-75"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              filter: getFilterStyle(selectedFilter),
              height: dimensions.width > dimensions.height ? "192px" : "auto",
              width: dimensions.width <= dimensions.height ? "192px" : "auto",
            }}
          />

          <div className="absolute inset-0 pointer-events-none border-[32px] border-black/60 rounded-lg flex items-center justify-center">
            <div className="w-[192px] h-[192px] rounded-full border border-dashed border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
          </div>
        </div>

        <div className="w-full mt-4 flex items-center gap-3 px-2">
          <span className="text-xs text-neutral-400">Zoom</span>
          <input 
            type="range" 
            min="1" 
            max="3" 
            step="0.05" 
            value={zoom} 
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="flex-1 accent-[var(--accent)] h-1 rounded-lg bg-neutral-700 cursor-pointer"
          />
        </div>

        <div className="w-full mt-5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 mb-2 px-1">Filtros</p>
          <div className="flex gap-2 overflow-x-auto pb-2 w-full scrollbar-thin">
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setSelectedFilter(filter.id)}
                className={`flex-shrink-0 flex flex-col items-center rounded-lg p-1.5 border transition cursor-pointer ${
                  selectedFilter === filter.id ? "border-[var(--accent)] bg-neutral-800" : "border-neutral-800 bg-neutral-950"
                }`}
              >
                <div className="w-12 h-12 rounded bg-neutral-800 overflow-hidden mb-1 flex items-center justify-center">
                  <img 
                    src={imageSrc} 
                    alt={filter.name} 
                    className="w-full h-full object-cover" 
                    style={{ filter: getFilterStyle(filter.id) }} 
                  />
                </div>
                <span className="text-[10px] text-neutral-300">{filter.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="w-full mt-6 flex justify-end gap-3 border-t border-neutral-800 pt-4">
          <button 
            onClick={onClose} 
            className="px-4 py-2 rounded-lg text-xs font-semibold border border-neutral-700 text-neutral-300 hover:bg-neutral-800 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave} 
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white shadow transition hover:brightness-105 active:scale-95 cursor-pointer"
            style={{ background: "var(--accent)" }}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= Árbol lateral ================= */
function Tree({ roots, childrenOf, pages, currentId, view, selectPage, expanded, setExpanded, addPage, deletePage, sharedPages, sharedByMe, setConfirmDialog, folders, folderOrder, addPageToFolder, removePageFromFolder, getFolderOfPage, updatePage, hoverState }) {
  const render = (id, depth) => {
    const pg = pages[id]; if (!pg) return null;
    const kids = childrenOf(id); const open = expanded[id];
    const isRoot = !pg.parentId;
    return (
      <div key={id}>
        <PageRow pg={pg} depth={depth} active={id === currentId && view === "docs"} hasKids={kids.length > 0} open={open}
                 onToggle={() => setExpanded(e => ({ ...e, [id]: !e[id] }))} onClick={() => selectPage(id)}
                 onAddSub={() => addPage(id)}
                 onDelete={() => {
                   if (setConfirmDialog) {
                     setConfirmDialog({
                       title: `¿Mover "${pg.title || "Sin título"}" a la papelera?`,
                       message: "Esta página se moverá a la papelera por 30 días. Si estaba compartida con colaboradores, se cancelará su acceso.",
                       onConfirm: () => deletePage(id)
                     });
                   } else {
                     if (confirm(`¿Borrar "${pg.title || "Sin título"}"?`)) deletePage(id);
                   }
                 }}
                 isRoot={isRoot}
                 folders={isRoot ? folders : null}
                 folderOrder={isRoot ? folderOrder : null}
                 currentFolderId={isRoot && getFolderOfPage ? getFolderOfPage(id) : null}
                 onAddToFolder={isRoot && addPageToFolder ? (fid) => addPageToFolder(id, fid) : null}
                 onRemoveFromFolder={isRoot && removePageFromFolder ? () => removePageFromFolder(id) : null}
                 onRename={pg.isSharedWithMe && pg.permission === "view" ? null : (newTitle) => updatePage(id, { title: newTitle })}
                 draggable hoverState={hoverState}
                 />
        {open && kids.map(k => render(k, depth + 1))}
      </div>
    );
  };

  return (
    <div className="pt-1">
      {roots.length === 0 && !sharedPages?.length && !sharedByMe?.length ? (
        <p className="px-2 pt-2 text-[13px]" style={{ color: T.muted }}>Aún no hay páginas sueltas.</p>
      ) : (
        roots.map(r => render(r, 0))
      )}

      {/* Sección Compartidas conmigo */}
      {sharedPages && sharedPages.length > 0 && (
        <div className="mt-4 border-t pt-3" style={{ borderColor: T.border }}>
          <p className="px-2 mb-1 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: T.accent }}>
            <Users size={12} /> Compartidas conmigo
          </p>
          {sharedPages.map(sp => {
            const pg = pages[sp.page_id];
            if (!pg || pg.deletedAt) return null;
            return (
              <PageRow key={sp.id} pg={pg} depth={0} active={sp.page_id === currentId && view === "docs"}
                       hasKids={false} open={false} onClick={() => selectPage(sp.page_id)} />
            );
          })}
        </div>
      )}

      {/* Sección Compartidos por ti */}
      {sharedByMe && sharedByMe.length > 0 && (
        <div className="mt-4 border-t pt-3" style={{ borderColor: T.border }}>
          <p className="px-2 mb-1.5 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: T.muted }}>
            <Share2 size={12} /> Compartidos por ti
          </p>
          {sharedByMe.map(entry => {
            const pg = pages[entry.page_id];
            if (!pg || pg.deletedAt) return null;
            return (
              <div key={entry.page_id}>
                <PageRow pg={pg} depth={0} active={entry.page_id === currentId && view === "docs"}
                         hasKids={false} open={false} onClick={() => selectPage(entry.page_id)} />
                <div className="ml-5 mb-1 flex flex-wrap gap-1">
                  {entry.recipients.map((r, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
                          style={{ background: T.accentSoft, color: T.accent }}>
                      <Users size={9} />{r.email}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================= Fila de Carpeta ================= */
function FolderRow({ folder, pages, childrenOf, currentId, view, selectPage, expanded, setExpanded, addPage, deletePage, setConfirmDialog, onEditFolder, onDeleteFolder, folders, folderOrder, addPageToFolder, removePageFromFolder, getFolderOfPage, updatePage, onCreateSubfolder, hoverState }) {
  const [open, setOpen] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [editingFolder, setEditingFolder] = useState(false);
  const menuRef = useRef(null);

  const { attributes: fAttrs, listeners: fListeners, setNodeRef: setFDragRef, isDragging: fDragging } = useDraggable({ id: `folder:${folder.id}` });
  const { setNodeRef: setFDropRef } = useDroppable({ id: `folder:${folder.id}` });
  const fSafeListeners = useMemo(() => ({
    ...fListeners,
    onPointerDown: (e) => { if (e.target && e.target.closest && e.target.closest("input, textarea")) return; fListeners.onPointerDown?.(e); },
  }), [fListeners]);
  const folderHover = hoverState && hoverState.id === folder.id ? hoverState.mode : null;

  const folderPageIds = (folder.pageIds || []).filter(pid => pages[pid] && !pages[pid].deletedAt && !pages[pid].isSharedWithMe);
  const subFolderIds = folderOrder.filter(fid => { const f = folders[fid]; return f && f.parentId === folder.id; });

  const confirmDelete = () => {
    const parentName = folder.parentId && folders[folder.parentId] ? folders[folder.parentId].name : null;
    if (setConfirmDialog) {
      setConfirmDialog({
        title: `¿Eliminar la carpeta "${folder.name}"?`,
        message: parentName
          ? `La carpeta se eliminará. Las páginas que contiene pasarán a la carpeta "${parentName}".`
          : "La carpeta y sus subcarpetas se eliminarán. Las páginas quedarán sueltas, no se eliminarán.",
        onConfirm: () => onDeleteFolder(folder.id)
      });
    }
  };

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const renderPage = (id, depth) => {
    const pg = pages[id]; if (!pg) return null;
    const kids = childrenOf(id); const isOpen = expanded[id];
    const isRoot = !pg.parentId;
    return (
      <div key={id}>
        <PageRow pg={pg} depth={depth} active={id === currentId && view === "docs"} hasKids={kids.length > 0} open={isOpen}
                 onToggle={() => setExpanded(e => ({ ...e, [id]: !e[id] }))} onClick={() => selectPage(id)}
                 onAddSub={() => addPage(id)}
                 onDelete={() => {
                   if (setConfirmDialog) {
                     setConfirmDialog({
                       title: `¿Mover "${pg.title || "Sin título"}" a la papelera?`,
                       message: "Esta página se moverá a la papelera por 30 días.",
                       onConfirm: () => deletePage(id)
                     });
                   }
                 }}
                 isRoot={isRoot}
                 folders={isRoot ? folders : null}
                 folderOrder={isRoot ? folderOrder : null}
                 currentFolderId={isRoot ? folder.id : null}
                 onAddToFolder={isRoot && addPageToFolder ? (fid) => addPageToFolder(id, fid) : null}
                 onRemoveFromFolder={isRoot && removePageFromFolder ? () => removePageFromFolder(id) : null}
                 onRename={pg.isSharedWithMe && pg.permission === "view" ? null : (newTitle) => updatePage(id, { title: newTitle })}
                 draggable hoverState={hoverState}
                 />
        {isOpen && kids.map(k => renderPage(k, depth + 1))}
      </div>
    );
  };


  return (
    <div ref={setFDropRef} className="mb-1">
      {/* Header de la carpeta */}
      <div ref={setFDragRef} {...fAttrs} {...fSafeListeners}
           className="group hov flex items-center rounded-md pr-1 pl-1 py-0.5"
           style={{
             background: folderHover === "highlight" ? T.accentSoft : "transparent",
             boxShadow: folderHover === "highlight" ? `0 0 0 2px ${T.accent} inset`
                        : folderHover === "insert" ? `0 2px 0 0 ${T.accent} inset`
                        : undefined,
             opacity: fDragging ? 0.4 : 1,
             position: fDragging ? "relative" : undefined,
             zIndex: fDragging ? 3 : undefined,
             cursor: fDragging ? "grabbing" : "default"
           }}>
        <button onClick={() => setOpen(o => !o)} className="hov rounded p-0.5 flex-shrink-0">
          {open ? <ChevronDown size={13} style={{ color: T.muted }} /> : <ChevronRight size={13} style={{ color: T.muted }} />}
        </button>
        <div className="flex-1 flex items-center gap-1.5 min-w-0 py-1" onClick={() => setOpen(o => !o)} style={{ cursor: "pointer" }}>
          <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: folder.color }} />
          {open ? <FolderOpen size={14} style={{ color: folder.color }} /> : <Folder size={14} style={{ color: folder.color }} />}
          <span className="truncate text-[13px] font-semibold" style={{ color: T.ink }}>{folder.name}</span>
          {folderPageIds.length > 0 && (
            <span className="text-[10px] rounded-full px-1.5 py-0.5 font-semibold flex-shrink-0"
                  style={{ background: T.accentSoft, color: T.accent }}>{folderPageIds.length}</span>
          )}
        </div>
        <div className="relative flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 transition" ref={menuRef}>
          <button onClick={(e) => { e.stopPropagation(); setShowMenu(v => !v); }} className="hov rounded p-1">
            <MoreHorizontal size={13} style={{ color: T.muted }} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-7 z-50 w-44 rounded-xl border shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-150"
                 style={{ background: T.sidebar, borderColor: T.border }} onClick={e => e.stopPropagation()}>
              <button onClick={() => { setShowMenu(false); onCreateSubfolder(folder.id); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-[var(--accent-soft)] transition text-left" style={{ color: T.ink }}>
                <FolderPlus size={13} /> Nueva subcarpeta
              </button>
              <button onClick={() => { setShowMenu(false); setEditingFolder(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-[var(--accent-soft)] transition text-left" style={{ color: T.ink }}>
                <Pencil size={13} /> Editar carpeta
              </button>
              <button onClick={() => { setShowMenu(false); confirmDelete(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-red-500/10 transition text-left" style={{ color: "var(--danger, #ef4444)" }}>
                <Trash2 size={13} /> Eliminar carpeta
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Páginas y subcarpetas dentro de la carpeta */}
      {open && (
        <div className="ml-2 pl-2 border-l" style={{ borderColor: folder.color + "60" }}>
          {subFolderIds.length === 0 && folderPageIds.length === 0 ? (
            <p className="px-2 py-1 text-[11px] italic" style={{ color: T.muted }}>Carpeta vacía</p>
          ) : (
            <>
              {subFolderIds.map(sfid => (
                <FolderRow
                  key={sfid}
                  folder={folders[sfid]}
                  pages={pages}
                  childrenOf={childrenOf}
                  currentId={currentId}
                  view={view}
                  selectPage={selectPage}
                  expanded={expanded}
                  setExpanded={setExpanded}
                  addPage={addPage}
                  deletePage={deletePage}
                  setConfirmDialog={setConfirmDialog}
                  onEditFolder={onEditFolder}
                  onDeleteFolder={onDeleteFolder}
                  folders={folders}
                  folderOrder={folderOrder}
                  addPageToFolder={addPageToFolder}
                  removePageFromFolder={removePageFromFolder}
                  getFolderOfPage={getFolderOfPage}
                  updatePage={updatePage}
                  onCreateSubfolder={onCreateSubfolder}
                  hoverState={hoverState}
                />
              ))}
              {folderPageIds.map(id => renderPage(id, 0))}
            </>
          )}
        </div>
      )}

      {/* Modal para editar la carpeta */}
      {editingFolder && (
        <FolderEditModal
          folder={folder}
          onClose={() => setEditingFolder(false)}
          onSave={(name, color) => { onEditFolder(folder.id, name, color); setEditingFolder(false); }}
        />
      )}
    </div>
  );
}

/* ================= Modal Editar / Crear Carpeta ================= */
const FOLDER_PALETTE = [
  "#6366f1", "#ec4899", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ef4444", "#a16207", "#6b7280", "#10b981"
];

function FolderEditModal({ folder, onClose, onSave }) {
  const [name, setName] = useState(folder?.name || "");
  const [color, setColor] = useState(folder?.color || FOLDER_PALETTE[0]);

  const handleSave = () => {
    onSave(name.trim() || "Nueva carpeta", color);
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
         onClick={e => e.stopPropagation()}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border p-6 shadow-2xl animate-in zoom-in-95 duration-150 space-y-5"
           style={{ background: T.sidebar, borderColor: T.border, color: T.ink }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: color }} />
            <h3 className="font-serif text-base font-bold">{folder ? "Editar carpeta" : "Nueva carpeta"}</h3>
          </div>
          <button onClick={onClose} className="hov rounded p-1"><X size={16} style={{ color: T.muted }} /></button>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: T.muted }}>Nombre</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value.slice(0, 40))}
            placeholder="Ej. Trabajo, Personal, Proyectos…"
            maxLength={40}
            autoFocus
            className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none transition"
            style={{ borderColor: T.border, background: T.bg, color: T.ink }}
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: T.muted }}>Color</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {FOLDER_PALETTE.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="h-7 w-7 rounded-full transition hover:scale-110 active:scale-95"
                style={{
                  background: c,
                  boxShadow: color === c ? `0 0 0 2px ${T.bg}, 0 0 0 4px ${c}` : "none"
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-[12px] cursor-pointer" style={{ color: T.muted }}>
              <span>Color libre:</span>
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="h-7 w-10 rounded cursor-pointer border-0 bg-transparent p-0"
              />
            </label>
            <span className="text-[11px] font-mono" style={{ color: T.muted }}>{color}</span>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t pt-4" style={{ borderColor: T.border }}>
          <button onClick={onClose} className="hov rounded-lg border px-4 py-2 text-[12px] font-semibold transition"
                  style={{ borderColor: T.border, color: T.muted }}>Cancelar</button>
          <button onClick={handleSave} className="rounded-lg px-5 py-2 text-[12px] font-semibold text-white shadow transition hover:brightness-105 active:scale-95"
                  style={{ background: color }}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

function PageRow({ pg, depth, active, hasKids, open, onToggle, onClick, onAddSub, onDelete, isRoot, folders, folderOrder, currentFolderId, onAddToFolder, onRemoveFromFolder, onRename, draggable, hoverState }) {
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(pg.title || "");
  const menuRef = useRef(null);
  const renameRef = useRef(null);

  const { attributes: pAttrs, listeners: pListeners, setNodeRef: setPDragRef, isDragging: pDragging } = useDraggable({ id: `page:${pg.id}` });
  const { setNodeRef: setPDropRef } = useDroppable({ id: `page:${pg.id}` });
  const pRef = useCallback(node => { setPDragRef(node); setPDropRef(node); }, [setPDragRef, setPDropRef]);
  const pSafeListeners = useMemo(() => ({
    ...pListeners,
    onPointerDown: (e) => { if (e.target && e.target.closest && e.target.closest("input, textarea")) return; pListeners.onPointerDown?.(e); },
  }), [pListeners]);
  const pageHover = hoverState && hoverState.id === pg.id ? hoverState.mode : null;

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  useEffect(() => {
    if (isRenaming && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [isRenaming]);

  const renderFolderOption = (fid, depth) => {
    const f = folders[fid];
    if (!f) return null;
    const isCurrent = fid === currentFolderId;
    const kids = folderOrder.filter(sfid => { const sf = folders[sfid]; return sf && sf.parentId === fid; });
    return (
      <div key={fid}>
        <button
          onClick={() => { if (!isCurrent) { onAddToFolder(fid); setShowMenu(false); } }}
          className="w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-[var(--accent-soft)] transition text-left"
          style={{ color: T.ink, paddingLeft: 12 + depth * 14, ...(isCurrent ? { opacity: 0.55, cursor: "default", fontWeight: 600 } : {}) }}
        >
          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: f.color }} />
          <span className="truncate">{f.name}</span>
          {isCurrent && <Check size={12} style={{ color: T.accent, marginLeft: "auto", flexShrink: 0 }} />}
        </button>
        {kids.map(k => renderFolderOption(k, depth + 1))}
      </div>
    );
  };

  const handleRenameSubmit = () => {
    if (onRename) onRename(renameValue.trim() || "Sin título");
    setIsRenaming(false);
  };

  return (
    <div ref={draggable ? pRef : undefined} {...(draggable ? pAttrs : {})} {...(draggable ? pSafeListeners : {})}
         className="hov group flex items-center rounded-md pr-0.5"
         style={{
           paddingLeft: 4 + depth * 14,
           background: active ? T.accentSoft : "transparent",
           ...(pageHover === "insert" ? { boxShadow: `0 2px 0 0 ${T.accent} inset, 0 -2px 0 0 transparent` } : {}),
           ...(pageHover === "highlight" ? { boxShadow: `0 0 0 2px ${T.accent} inset`, background: T.accentSoft } : {}),
           opacity: draggable && pDragging ? 0.35 : 1,
           position: draggable && pDragging ? "relative" : undefined,
           zIndex: draggable && pDragging ? 3 : undefined,
           cursor: draggable && pDragging ? "grabbing" : "default"
         }}>
      {hasKids ? (
        <button onClick={onToggle} className="hov rounded p-0.5 flex-shrink-0">
          {open ? <ChevronDown size={13} style={{ color: T.muted }} /> : <ChevronRight size={13} style={{ color: T.muted }} />}
        </button>
      ) : <span className="w-[18px] flex-shrink-0" />}

      {isRenaming ? (
        <input
          ref={renameRef}
          value={renameValue}
          onChange={e => setRenameValue(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); handleRenameSubmit(); }
            if (e.key === "Escape") { setRenameValue(pg.title || ""); setIsRenaming(false); }
          }}
          className="flex-1 min-w-0 bg-transparent text-[13px] outline-none border-b py-1"
          style={{ borderColor: T.accent, color: T.ink }}
        />
      ) : (
        <button onClick={onClick} className="flex flex-1 min-w-0 items-center gap-1.5 truncate py-1.5 text-left text-[13px]">
          <span className="text-[13px] leading-none flex-shrink-0">{pg.icon}</span>
          <span className="truncate" style={{ fontWeight: active ? 600 : 400 }}>{pg.title || "Sin título"}</span>
        </button>
      )}

      {onAddSub && !isRenaming && (
        <div className="relative flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 transition" ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(v => !v); }}
            className="hov rounded p-1"
            title="Acciones"
          >
            <MoreHorizontal size={13} style={{ color: T.muted }} />
          </button>

          {showMenu && (
            <div
              className="absolute right-0 top-7 z-50 w-52 rounded-xl border shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-150"
              style={{ background: T.sidebar, borderColor: T.border }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => { setShowMenu(false); setRenameValue(pg.title || ""); setIsRenaming(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-[var(--accent-soft)] transition text-left"
                style={{ color: T.ink }}
              >
                <Pencil size={13} /> Renombrar
              </button>

              <button
                onClick={() => { setShowMenu(false); onAddSub(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-[var(--accent-soft)] transition text-left"
                style={{ color: T.ink }}
              >
                <CornerDownRight size={13} /> Agregar subpágina
              </button>

              {isRoot && folders && folderOrder && (
                <>
                  <div className="my-1 border-t" style={{ borderColor: T.border }} />
                  <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: T.muted }}>Carpeta</p>

                  {currentFolderId && (
                    <button
                      onClick={() => { onRemoveFromFolder(); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-[var(--accent-soft)] transition text-left"
                      style={{ color: T.ink }}
                    >
                      <X size={12} style={{ color: T.muted }} />
                      <span>Sin carpeta</span>
                      <span className="ml-auto text-[10px] truncate max-w-[80px]" style={{ color: T.muted }}>
                        {folders[currentFolderId]?.name}
                      </span>
                    </button>
                  )}

                  {folderOrder.length === 0 && !currentFolderId ? (
                    <p className="px-3 py-2 text-[12px] italic" style={{ color: T.muted }}>Sin carpetas creadas</p>
                  ) : (
                    folderOrder.filter(fid => {
                      const f = folders[fid];
                      return f && !f.parentId;
                    }).map(fid => renderFolderOption(fid, 0))
                  )}
                </>
              )}

              <div className="my-1 border-t" style={{ borderColor: T.border }} />
              <button
                onClick={() => { setShowMenu(false); onDelete(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-red-500/10 transition text-left"
                style={{ color: "var(--danger, #ef4444)" }}
              >
                <Trash2 size={13} /> Mover a papelera
              </button>
            </div>
          )}
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
  const [selectedTag, setSelectedTag] = useState(null);

  const allTags = useMemo(() => {
    const set = new Set();
    for (const t of todos) {
      if (t.tags) {
        for (const tg of t.tags) set.add(tg);
      }
    }
    return Array.from(set).sort();
  }, [todos]);

  const filteredTodos = useMemo(() => {
    if (!selectedTag) return todos;
    return todos.filter(t => t.tags && t.tags.includes(selectedTag));
  }, [todos, selectedTag]);

  const byDate = useMemo(() => {
    const map = {};
    for (const t of filteredTodos) { if (!t.date) continue; (map[t.date] ||= []).push(t); }
    for (const k in map) map[k].sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
    return map;
  }, [filteredTodos]);

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

      {allTags.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5 border-b pb-3" style={{ borderColor: T.border }}>
          <span className="text-[11px] font-bold uppercase tracking-wider mr-1.5" style={{ color: T.muted }}>Filtrar por:</span>
          <button onClick={() => setSelectedTag(null)}
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-medium transition cursor-pointer"
                  style={{
                    background: !selectedTag ? T.accent : T.sidebar,
                    color: !selectedTag ? "#fff" : T.ink,
                    border: `1px solid ${!selectedTag ? T.accent : T.border}`
                  }}>
            Todos
          </button>
          {allTags.map(tg => {
            const active = selectedTag === tg;
            return (
              <button key={tg} onClick={() => setSelectedTag(tg)}
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-medium transition cursor-pointer"
                      style={{
                        background: active ? T.accent : T.sidebar,
                        color: active ? "#fff" : T.ink,
                        border: `1px solid ${active ? T.accent : T.border}`
                      }}>
                #{tg}
              </button>
            );
          })}
        </div>
      )}

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
                        className="md:opacity-0 md:group-hover:opacity-100 transition"><Plus size={12} style={{ color: T.muted }} /></button>
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
                      {t.time ? `${t.time} ` : ""}{t.cleanText}
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
                      {t.cleanText}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 text-[11px] mt-1" style={{ color: T.muted }}>
                      <span>{t.pageIcon} {t.pageTitle}</span>
                      {t.time && <span>· {t.time}</span>}
                      {t.tags && t.tags.map(tg => (
                        <span key={tg} onClick={(e) => { e.stopPropagation(); setSelectedTag(tg === selectedTag ? null : tg); }}
                              className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase transition hover:opacity-80 cursor-pointer"
                              style={{ background: tg === selectedTag ? T.accent : T.border, color: tg === selectedTag ? "#fff" : T.accent }}>
                          #{tg}
                        </span>
                      ))}
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
  const [selectedTag, setSelectedTag] = useState(null);

  const allTags = useMemo(() => {
    const set = new Set();
    for (const t of todos) {
      if (t.tags) {
        for (const tg of t.tags) set.add(tg);
      }
    }
    return Array.from(set).sort();
  }, [todos]);

  const filteredTodos = useMemo(() => {
    if (!selectedTag) return todos;
    return todos.filter(t => t.tags && t.tags.includes(selectedTag));
  }, [todos, selectedTag]);

  const pend = filteredTodos.filter(t => !t.checked);
  const byDate = (a, b) => (a.date || "9").localeCompare(b.date || "9") || (a.time || "99").localeCompare(b.time || "99");

  const groups = [
    { key: "over", label: "Atrasado", color: "var(--danger)", items: pend.filter(t => t.date && t.date < today).sort(byDate) },
    { key: "today", label: "Hoy", color: T.accent, items: pend.filter(t => t.date === today).sort(byDate) },
    { key: "tom", label: "Mañana", color: T.ink, items: pend.filter(t => t.date === tomorrow).sort(byDate) },
    { key: "week", label: "Próximos 7 días", color: T.ink, items: pend.filter(t => t.date > tomorrow && t.date <= in7).sort(byDate) },
    { key: "later", label: "Más adelante", color: T.ink, items: pend.filter(t => t.date > in7).sort(byDate) },
    { key: "none", label: "Sin fecha", color: T.muted, items: pend.filter(t => !t.date) },
  ];

  const done = filteredTodos.filter(t => t.checked && t.completedAt);
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
        <span className="block text-[14px] leading-snug" style={{ textDecoration: t.checked ? "line-through" : "none", color: t.checked ? T.muted : T.ink }}>{t.cleanText}</span>
        <span className="flex flex-wrap items-center gap-1.5 text-[11px] mt-0.5" style={{ color: T.muted }}>
          <span>{t.pageIcon} {t.pageTitle}</span>{t.date && <span>· {chipLabel(t.date, t.time)}</span>}
          {t.tags && t.tags.map(tg => (
            <span key={tg} onClick={(e) => { e.stopPropagation(); setSelectedTag(tg === selectedTag ? null : tg); }}
                  className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase transition hover:opacity-80 cursor-pointer"
                  style={{ background: tg === selectedTag ? T.accent : T.border, color: tg === selectedTag ? "#fff" : T.accent }}>
              #{tg}
            </span>
          ))}
        </span>
      </button>
    </div>
  );

  const fieldStyle = { borderColor: T.border, background: "var(--card)", color: T.ink };

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-24 pt-14 sm:px-8">
      <h1 className="mb-4 font-serif text-2xl font-bold">Agenda</h1>

      {allTags.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5 border-b pb-3" style={{ borderColor: T.border }}>
          <span className="text-[11px] font-bold uppercase tracking-wider mr-1.5" style={{ color: T.muted }}>Filtrar por:</span>
          <button onClick={() => setSelectedTag(null)}
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-medium transition cursor-pointer"
                  style={{
                    background: !selectedTag ? T.accent : T.sidebar,
                    color: !selectedTag ? "#fff" : T.ink,
                    border: `1px solid ${!selectedTag ? T.accent : T.border}`
                  }}>
            Todos
          </button>
          {allTags.map(tg => {
            const active = selectedTag === tg;
            return (
              <button key={tg} onClick={() => setSelectedTag(tg)}
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-medium transition cursor-pointer"
                      style={{
                        background: active ? T.accent : T.sidebar,
                        color: active ? "#fff" : T.ink,
                        border: `1px solid ${active ? T.accent : T.border}`
                      }}>
                #{tg}
              </button>
            );
          })}
        </div>
      )}

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
function Editor({ page, updatePage, updateBlockInPage, onAddSub, onDelete, setConfirmDialog, showToast, user }) {
  const [focusId, setFocusId] = useState(null);
  const [pickIcon, setPickIcon] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const channelRef = useRef(null);

  const isOwner = !page.isSharedWithMe || (page.ownerId && page.ownerId === user?.id);
  const readOnly = !isOwner && page.permission === "view";

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 400, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const setBlocks = (blocks) => updatePage(page.id, { blocks });
  const changeBlock = (id, patch) => {
    if (readOnly) return;
    updateBlockInPage(page.id, id, patch);
    // Broadcast el cambio en tiempo real a otros clientes
    if (channelRef.current && supabase) {
      channelRef.current.send({
        type: "broadcast",
        event: "block_change",
        payload: { blockId: id, patch, userId: user?.id }
      });
    }
  };

  const commitBlocks = (next) => {
    if (readOnly) return;
    setBlocks(next);

    // Broadcast el cambio en tiempo real a otros clientes
    if (channelRef.current && supabase) {
      channelRef.current.send({
        type: "broadcast",
        event: "page_update",
        payload: { page: { ...page, blocks: next }, userId: user?.id }
      });
    }
  };

  const handleBlockDragEnd = (e) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = page.blocks.findIndex(b => b.id === active.id);
    const newIndex = page.blocks.findIndex(b => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    commitBlocks(arrayMove(page.blocks, oldIndex, newIndex));
  };

  // Suscripción Realtime a Presence y Broadcast para la página activa
  useEffect(() => {
    if (!supabase || !page?.id || !user) return;

    const channel = supabase.channel(`page:${page.id}`, {
      config: { presence: { key: user.id } }
    });

    channelRef.current = channel;

    channel
      .on("broadcast", { event: "block_change" }, ({ payload }) => {
        if (payload.userId !== user.id) {
          updateBlockInPage(page.id, payload.blockId, payload.patch);
        }
      })
      .on("broadcast", { event: "page_update" }, ({ payload }) => {
        if (payload.userId !== user.id && payload.page) {
          updatePage(page.id, payload.page);
        }
      })
      .on("broadcast", { event: "request_page_sync" }, ({ payload }) => {
        if (payload.requesterId !== user.id && page) {
          channel.send({
            type: "broadcast",
            event: "page_sync_data",
            payload: { page, userId: user.id }
          });
        }
      })
      .on("broadcast", { event: "page_sync_data" }, ({ payload }) => {
        if (payload.userId !== user.id && payload.page) {
          updatePage(page.id, payload.page);
        }
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const usersList = [];
        Object.values(state).forEach(presences => {
          presences.forEach(p => {
            if (p.email) usersList.push(p);
          });
        });
        setOnlineUsers(usersList);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId: user.id,
            email: user.email,
            onlineAt: new Date().toISOString()
          });

          // Solicitar sync al entrar a la página
          channel.send({
            type: "broadcast",
            event: "request_page_sync",
            payload: { requesterId: user.id }
          });
        }
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [page?.id, user, updateBlockInPage, updatePage]);

  const [collaborators, setCollaborators] = useState([]);

  useEffect(() => {
    if (!supabase || !page?.id) return;
    const fetchCollabs = async () => {
      try {
        const { data } = await supabase
          .from("page_shares")
          .select("shared_with_email, permission, status")
          .eq("page_id", page.id);
        if (data) setCollaborators(data);
      } catch { /* ignore */ }
    };
    fetchCollabs();
  }, [page?.id]);

  const insertAfter = (id, block) => {
    if (readOnly) return;
    const i = page.blocks.findIndex(b => b.id === id);
    const next = [...page.blocks]; next.splice(i + 1, 0, block); setBlocks(next); setFocusId(block.id);
  };
  const removeBlock = (id) => {
    if (readOnly) return;
    const i = page.blocks.findIndex(b => b.id === id);
    if (page.blocks.length === 1) { setBlocks([emptyBlock()]); return; }
    setBlocks(page.blocks.filter(b => b.id !== id));
    const prev = page.blocks[i - 1]; if (prev) setFocusId(prev.id);
  };

  const todos = page.blocks.filter(b => b.type === "todo");
  const doneCount = todos.filter(b => b.checked).length;

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pb-40 pt-14 sm:px-12">
      {/* Indicador de Usuarios Compartidos y Conectados en Tiempo Real */}
      {(collaborators.length > 0 || onlineUsers.length > 1) && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs animate-in fade-in duration-200 shadow-sm"
             style={{ borderColor: T.border, background: T.sidebar }}>
          <Users size={14} style={{ color: T.accent }} />
          <span className="font-semibold" style={{ color: T.ink }}>
            {onlineUsers.length > 1 ? "Colaborando en vivo:" : "Compartido con:"}
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {onlineUsers.map((u, i) => (
              <span key={`online-${i}`} className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                    style={{ background: u.userId === user?.id ? T.accentSoft : T.bg, color: u.userId === user?.id ? T.accent : T.ink }}>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {u.email === user?.email ? "Tú" : u.email}
              </span>
            ))}
            {collaborators
              .filter(c => !onlineUsers.some(u => u.email?.toLowerCase() === c.shared_with_email?.toLowerCase()))
              .map((c, i) => (
                <span key={`collab-${i}`} className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                      style={{ background: T.bg, color: T.muted }}>
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                  {c.shared_with_email}
                </span>
              ))}
          </div>
        </div>
      )}

      <div className="relative mb-1">
        {readOnly ? (
          <div className="mb-2 rounded-lg px-1 text-5xl">{page.icon}</div>
        ) : (
          <button onClick={() => setPickIcon(v => !v)} className="hov mb-2 rounded-lg px-1 text-5xl">{page.icon}</button>
        )}
        {pickIcon && (
          <div className="absolute z-20 mb-2 flex max-w-xs flex-wrap gap-1 rounded-lg border p-2 shadow-lg" style={{ background: T.bg, borderColor: T.border }}>
            {EMOJIS.map(e => <button key={e} onClick={() => { updatePage(page.id, { icon: e }); setPickIcon(false); }} className="hov rounded p-1 text-xl">{e}</button>)}
          </div>
        )}
      </div>

      <textarea value={page.title} onChange={e => updatePage(page.id, { title: e.target.value })}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (!readOnly) setFocusId(page.blocks[0]?.id); } }}
                readOnly={readOnly}
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
          {readOnly ? (
            <span className="flex items-center gap-1 rounded px-2.5 py-1 text-[12px] font-semibold" style={{ color: T.muted, background: T.bg }}>
              <Lock size={12} /> Solo lectura
            </span>
          ) : (
            <button onClick={() => setShareOpen(true)} className="hov flex items-center gap-1 rounded px-2.5 py-1 text-[12px] font-semibold text-[var(--accent)] bg-[var(--accent-soft)] transition cursor-pointer">
              <Share2 size={13} /> Compartir
            </button>
          )}
          {isOwner && (
            <>
              <button onClick={onAddSub} className="hov flex items-center gap-1 rounded px-2 py-1"><CornerDownRight size={13} /> Sub-página</button>
              <button onClick={() => {
                if (setConfirmDialog) {
                  setConfirmDialog({
                    title: `¿Mover "${page.title || "Sin título"}" a la papelera?`,
                    message: "La página se moverá a la papelera durante 30 días. Si la tenías compartida, los colaboradores perderán el acceso.",
                    onConfirm: onDelete
                  });
                } else {
                  if (confirm("¿Mover esta página a la papelera?")) onDelete();
                }
              }} className="hov flex items-center gap-1 rounded px-2 py-1"><Trash2 size={13} /> Borrar</button>
            </>
          )}
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleBlockDragEnd}>
        <SortableContext items={page.blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
          {page.blocks.map((b, idx) => (
            <SortableBlock key={b.id} block={b} index={idx} focusId={focusId} clearFocus={() => setFocusId(null)}
                           onChange={patch => changeBlock(b.id, patch)}
                           onEnter={(afterType, carry) => insertAfter(b.id, { ...emptyBlock(afterType), text: carry })}
                           onDelete={() => removeBlock(b.id)}
                           onFocusPrev={() => { const p = page.blocks[idx - 1]; if (p) setFocusId(p.id); }}
                           showToast={showToast} user={user} readOnly={readOnly} />
          ))}
        </SortableContext>
      </DndContext>

      <div onClick={() => { if (!readOnly) insertAfter(page.blocks[page.blocks.length - 1].id, emptyBlock()); }}
           className={`mt-1 h-24 ${readOnly ? "" : "cursor-text"}`} />

      {/* Modal para Compartir Página */}
      {shareOpen && (
        <ShareModal page={page} user={user} onClose={() => setShareOpen(false)} showToast={showToast} />
      )}
    </div>
  );
}

/* ================= Modal de Compartir ================= */
function ShareModal({ page, user, onClose, showToast }) {
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState("edit");
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);

  const isOwner = !page.isSharedWithMe || (page.ownerId && page.ownerId === user?.id);

  const loadShares = useCallback(async () => {
    if (!supabase || !page?.id) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("page_shares")
        .select("*")
        .eq("page_id", page.id);

      if (!error && data) {
        setShares(data);
      }
    } catch {
      /* Fallback elegante si la tabla aún se está aprovisionando en Supabase */
    } finally {
      setLoading(false);
    }
  }, [page?.id]);

  useEffect(() => {
    loadShares();
  }, [loadShares]);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!isOwner) {
      if (showToast) showToast("Solo el propietario de la página puede invitar a otros colaboradores.", "error");
      return;
    }
    if (!email.trim() || !page?.id || !user) return;
    setInviting(true);

    try {
      if (supabase) {
        const targetEmail = email.trim().toLowerCase();
        const { data: existing } = await supabase
          .from("page_shares")
          .select("id")
          .eq("page_id", page.id)
          .eq("shared_with_email", targetEmail)
          .maybeSingle();

        let insertedShare = null;
        if (existing) {
          let { data: updatedData, error: updateErr } = await supabase
            .from("page_shares")
            .update({ permission, status: "pending" })
            .eq("id", existing.id)
            .select()
            .single();

          if (updateErr && (updateErr.code === "PGRST204" || updateErr.message?.includes("status"))) {
            const { data: retryUpd, error: retryErr } = await supabase
              .from("page_shares")
              .update({ permission })
              .eq("id", existing.id)
              .select()
              .single();
            if (retryErr) throw retryErr;
            updatedData = retryUpd;
            updateErr = null;
          }
          if (updateErr) throw updateErr;
          insertedShare = updatedData;
        } else {
          let { data: insertedData, error: insertErr } = await supabase
            .from("page_shares")
            .insert({
              page_id: page.id,
              owner_id: user.id,
              shared_with_email: targetEmail,
              permission,
              status: "pending"
            })
            .select()
            .single();

          if (insertErr && (insertErr.code === "PGRST204" || insertErr.message?.includes("status"))) {
            const { data: retryIns, error: retryErr } = await supabase
              .from("page_shares")
              .insert({
                page_id: page.id,
                owner_id: user.id,
                shared_with_email: targetEmail,
                permission
              })
              .select()
              .single();
            if (retryErr) throw retryErr;
            insertedData = retryIns;
            insertErr = null;
          }
          if (insertErr) throw insertErr;
          insertedShare = insertedData;
        }

        // Transmitir notificación de invitación en tiempo real al destinatario
        try {
          const notifChan = supabase.channel(`user_notifs:${targetEmail}`);
          notifChan.subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
              await notifChan.send({
                type: "broadcast",
                event: "new_shared_page_invite",
                payload: {
                  shareId: insertedShare?.id,
                  pageId: page.id,
                  pageTitle: page.title || "Sin título",
                  ownerEmail: user.email,
                  ownerId: user.id,
                  permission
                }
              });
              setTimeout(() => notifChan.unsubscribe(), 1000);
            }
          });
        } catch { /* ignore */ }
      }

      if (showToast) showToast(`Invitación enviada a ${email}`);
      setEmail("");
      loadShares();
    } catch (err) {
      console.error("Error al compartir página:", err);
      if (err?.code === "42501") {
        if (showToast) showToast("Permiso denegado por política de seguridad RLS en Supabase.", "error");
      } else {
        if (showToast) showToast("No se pudo invitar al usuario. Revisa la conexión.", "error");
      }
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async (shareId, shareEmail) => {
    if (!isOwner) {
      if (showToast) showToast("Solo el propietario de la página puede revocar accesos.", "error");
      return;
    }
    try {
      if (supabase && shareId) {
        await supabase.from("page_shares").delete().eq("id", shareId);

        // Notificar en tiempo real al usuario desvinculado
        try {
          const targetEmail = shareEmail.toLowerCase();
          const notifChan = supabase.channel(`user_notifs:${targetEmail}`);
          notifChan.subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
              await notifChan.send({
                type: "broadcast",
                event: "page_access_revoked",
                payload: { pageId: page.id, pageTitle: page.title || "Sin título" }
              });
              setTimeout(() => notifChan.unsubscribe(), 1000);
            }
          });
        } catch { /* ignore */ }
      }
      setShares(s => s.filter(item => item.id !== shareId));
      if (showToast) showToast(`Acceso revocado a ${shareEmail}`);
    } catch {
      if (showToast) showToast("Error al revocar acceso", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-2xl border p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left"
           style={{ background: T.sidebar, borderColor: T.border, color: T.ink }}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
              <Share2 size={16} />
            </span>
            <div>
              <h2 className="font-serif text-base font-bold">Compartir página</h2>
              <p className="text-[11px] truncate max-w-[200px]" style={{ color: T.muted }}>{page.title || "Sin título"}</p>
            </div>
          </div>
          <button onClick={onClose} className="hov rounded p-1"><X size={16} style={{ color: T.muted }} /></button>
        </div>

        {/* Mensaje de Privilegios para Colaboradores vs Propietarios */}
        {isOwner ? (
          /* Formulario de Invitación (Solo para Propietarios) */
          <form onSubmit={handleInvite} className="mb-5 space-y-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: T.muted }}>
                Correo del colaborador
              </label>
              <div className="flex gap-2">
                <input type="email" required placeholder="correo@ejemplo.com" value={email} onChange={e => setEmail(e.target.value)}
                       className="flex-1 rounded-xl border px-3 py-2 text-xs outline-none transition"
                       style={{ borderColor: T.border, background: T.bg, color: T.ink }} />
                <select value={permission} onChange={e => setPermission(e.target.value)}
                        className="rounded-xl border px-2 py-2 text-xs outline-none cursor-pointer"
                        style={{ borderColor: T.border, background: T.bg, color: T.ink }}>
                  <option value="edit">Puede editar</option>
                  <option value="view">Solo ver</option>
                </select>
              </div>
            </div>
            <button type="submit" disabled={inviting} className="w-full py-2.5 rounded-xl text-xs font-semibold text-white shadow transition flex items-center justify-center gap-1.5 hover:brightness-105 active:scale-[0.98]"
                    style={{ background: T.accent }}>
              {inviting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              {inviting ? "Enviando..." : "Invitar colaborador"}
            </button>
          </form>
        ) : (
          <div className="mb-5 rounded-xl border p-3 text-xs bg-[var(--accent-soft)] text-[var(--accent)] flex items-center gap-2">
            <Lock size={15} className="flex-shrink-0" />
            <span>Página compartida contigo. Solo el propietario de esta página puede gestionar invitaciones o revocar permisos.</span>
          </div>
        )}

        {/* Lista de Colaboradores */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: T.muted }}>Personas con acceso</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {/* Propietario */}
            <div className="flex items-center justify-between rounded-xl border p-2.5 text-xs" style={{ borderColor: T.border, background: T.bg }}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)] font-bold text-[10px]">P</span>
                <span className="truncate font-medium">{isOwner ? user?.email : (page.ownerEmail || "Propietario")}</span>
              </div>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800" style={{ color: T.muted }}>Propietario</span>
            </div>

            {/* Lista de invitados */}
            {loading ? (
              <p className="text-[11px] py-2 text-center" style={{ color: T.muted }}>Cargando colaboradores...</p>
            ) : shares.length === 0 ? (
              <p className="text-[11px] py-2 text-center" style={{ color: T.muted }}>Aún no hay colaboradores invitados.</p>
            ) : (
              shares.map(item => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border p-2.5 text-xs" style={{ borderColor: T.border, background: T.bg }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 font-bold text-[10px]">C</span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.shared_with_email}</p>
                      <p className="text-[9px]" style={{ color: T.muted }}>{item.permission === "edit" ? "Puede editar" : "Solo ver"}</p>
                    </div>
                  </div>
                  {isOwner ? (
                    <button onClick={() => handleRevoke(item.id, item.shared_with_email)} className="text-[10px] font-semibold text-[var(--danger,#ef4444)] hover:underline cursor-pointer">
                      Revocar
                    </button>
                  ) : (
                    <span className="text-[10px] font-medium" style={{ color: T.muted }}>
                      {item.permission === "edit" ? "Edición" : "Lectura"}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= Panel Desplegable de Notificaciones ================= */
function NotificationPanel({ notifications, setNotifications, onSelectNotif, onAcceptInvite, onDeclineInvite, onClose }) {
  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const handleNotifClick = (n) => {
    setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
    if (n.pageId && n.status !== "pending") {
      onSelectNotif(n.pageId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-start justify-start p-4 bg-black/20" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
           className="mt-14 ml-0 md:ml-64 w-80 max-w-full rounded-2xl border p-4 shadow-2xl animate-in slide-in-from-top-4 duration-200 text-left"
           style={{ background: T.sidebar, borderColor: T.border, color: T.ink }}>
        <div className="mb-3 flex items-center justify-between border-b pb-2.5" style={{ borderColor: T.border }}>
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-[var(--accent)]" />
            <h3 className="font-serif text-sm font-bold">Notificaciones</h3>
          </div>
          <div className="flex items-center gap-1">
            {notifications.some(n => !n.read) && (
              <button onClick={markAllAsRead} title="Marcar leídas" className="text-[10px] font-semibold text-[var(--accent)] hover:underline mr-1 cursor-pointer">
                Leídas
              </button>
            )}
            {notifications.length > 0 && (
              <button onClick={clearAll} title="Limpiar todo" className="text-[10px] font-semibold text-[var(--muted)] hover:underline mr-1 cursor-pointer">
                Limpiar
              </button>
            )}
            <button onClick={onClose} className="hov rounded p-1"><X size={14} style={{ color: T.muted }} /></button>
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="py-8 text-center" style={{ color: T.muted }}>
            <span className="text-2xl mb-1 block">🔔</span>
            <p className="text-xs font-medium">Sin notificaciones pendientes</p>
            <p className="text-[10px] mt-0.5">Aquí verás los avisos cuando te compartan contenido.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {notifications.map(n => (
              <div key={n.id} onClick={() => handleNotifClick(n)}
                   className={`group flex flex-col gap-1.5 rounded-xl border p-2.5 text-xs transition cursor-pointer hover:shadow-sm ${!n.read ? "bg-[var(--accent-soft)]" : "bg-[var(--card)]"}`}
                   style={{ borderColor: !n.read ? T.accent : T.border }}>
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                    {n.type === "page_invite" ? <UserPlus size={12} /> : n.type === "access_revoked" ? <Lock size={12} /> : <Share2 size={12} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className="font-semibold truncate text-[12px]" style={{ color: T.ink }}>{n.title}</p>
                      {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] flex-shrink-0" />}
                    </div>
                    <p className="text-[11px] leading-tight" style={{ color: T.muted }}>{n.body}</p>
                    <span className="mt-1 block text-[9px] opacity-70" style={{ color: T.muted }}>
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Botones de Aceptar / Rechazar Invitación */}
                {n.type === "page_invite" && n.status === "pending" && (
                  <div className="mt-1 flex items-center gap-2 pt-1 border-t border-dashed" style={{ borderColor: T.border }}>
                    <button onClick={(e) => { e.stopPropagation(); onAcceptInvite(n); }}
                            className="flex-1 rounded-lg py-1 text-[11px] font-bold text-white shadow-sm transition hover:brightness-105 active:scale-[0.98] cursor-pointer"
                            style={{ background: T.accent }}>
                      Aceptar
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDeclineInvite(n); }}
                            className="flex-1 rounded-lg py-1 text-[11px] font-semibold border transition hover:bg-red-500/10 active:scale-[0.98] cursor-pointer"
                            style={{ borderColor: T.border, color: "var(--danger, #ef4444)" }}>
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= Chip de fecha ================= */
function DateChip({ block, onChange, readOnly }) {
  const [open, setOpen] = useState(false);
  const has = !!block.date;
  const fieldStyle = { borderColor: T.border, background: "var(--card)", color: T.ink };
  if (readOnly) {
    return (
      <span className="mt-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]" style={{ background: has ? T.accentSoft : "transparent", color: has ? T.accent : T.muted }}>
        <CalendarDays size={12} /> {has ? chipLabel(block.date, block.time) : "Fecha"}
      </span>
    );
  }
  return (
    <div className="relative flex-shrink-0">
      <button onClick={() => setOpen(o => !o)}
              className={`mt-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition ${has ? "" : "md:opacity-0 md:group-hover:opacity-100"}`}
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
          <input type="date" value={block.date || ""} onChange={e => onChange({ date: e.target.value || null, notifyAt: toNotifyAt(e.target.value || null, block.time || null) })} className="mb-2 w-full rounded border px-2 py-1 text-[13px]" style={fieldStyle} />
          <label className="mb-1 block text-[11px]" style={{ color: T.muted }}>Hora (opcional)</label>
          <input type="time" value={block.time || ""} onChange={e => onChange({ time: e.target.value || null, notifyAt: toNotifyAt(block.date || null, e.target.value || null) })} className="mb-2 w-full rounded border px-2 py-1 text-[13px]" style={fieldStyle} />
          <button onClick={() => { onChange({ date: null, time: null, notifyAt: null }); setOpen(false); }} className="text-[12px]" style={{ color: T.muted }}>Quitar fecha</button>
        </div>
      )}
    </div>
  );
}

/* ================= Componente Bloque de Imagen ================= */
function ImageBlock({ block, onChange, onDelete, user, showToast, readOnly }) {
  const handleImageFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    onChange({ uploading: true });
    
    try {
      let imageUrl = "";
      if (supabase && user) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${uid()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from("uploads")
          .upload(filePath, file);
          
        if (!uploadError) {
          const { data } = supabase.storage.from("uploads").getPublicUrl(filePath);
          imageUrl = data.publicUrl;
        }
      }
      
      if (!imageUrl) {
        imageUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
      }
      
      onChange({ imageUrl, uploading: false });
      if (showToast) showToast("Imagen cargada con éxito");
    } catch (err) {
      console.error("Error al cargar la imagen:", err);
      onChange({ uploading: false });
      if (showToast) showToast("No se pudo cargar la imagen.", "error");
    }
  };

  return (
    <div className="group relative my-3 rounded-xl border p-2 transition hover:shadow-md select-none w-full animate-in fade-in duration-200" style={{ borderColor: T.border, background: T.sidebar }}>
      {block.imageUrl ? (
        <div className="relative overflow-hidden rounded-lg">
          <img src={block.imageUrl} alt="Cargada" className="max-h-[350px] w-full object-cover" />
          {!readOnly && (
            <button onClick={onDelete} className="absolute right-2 top-2 rounded-full p-1.5 shadow-lg bg-black/60 hover:bg-black/80 text-white transition cursor-pointer">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          {block.uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={24} className="animate-spin text-[var(--accent)]" style={{ color: T.accent }} />
              <span className="text-xs" style={{ color: T.muted }}>Subiendo imagen...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-full p-3 bg-neutral-100 dark:bg-neutral-800" style={{ color: T.accent }}>
                <Image size={24} />
              </div>
              <p className="text-xs font-semibold" style={{ color: T.ink }}>Bloque de Imagen</p>
              <p className="text-[10px] px-4" style={{ color: T.muted }}>Sube un archivo o usa la cámara de tu dispositivo</p>
              {!readOnly && (
              <div className="flex gap-2 mt-2">
                <label className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition shadow cursor-pointer hover:brightness-105" style={{ background: T.accent }}>
                  <UploadCloud size={13} /> Seleccionar
                  <input type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
                </label>
                <label className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800" style={{ borderColor: T.border, color: T.ink }}>
                  <Camera size={13} /> Cámara
                  <input type="file" accept="image/*" capture="environment" onChange={handleImageFile} className="hidden" />
                </label>
              </div>
              )}
            </div>
          )}
          {!readOnly && (
          <button onClick={onDelete} className="absolute right-2 top-2 md:opacity-0 md:group-hover:opacity-100 transition rounded p-1 cursor-pointer"><X size={14} style={{ color: T.muted }} /></button>
          )}
        </div>
      )}
    </div>
  );
}

/* ================= Componente Bloque de Audio ================= */
function AudioBlock({ block, onChange, onDelete, user, showToast, readOnly }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const options = { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/aac" };
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      
      mediaRecorder.onstop = async () => {
        clearInterval(timerRef.current);
        const blob = new Blob(audioChunksRef.current, { type: options.mimeType });
        onChange({ uploading: true });
        
        try {
          let audioUrl = "";
          if (supabase && user) {
            const fileName = `${uid()}.${options.mimeType.split("/")[1]}`;
            const filePath = `${user.id}/${fileName}`;
            
            const { error: uploadError } = await supabase.storage
              .from("uploads")
              .upload(filePath, blob);
              
            if (!uploadError) {
              const { data } = supabase.storage.from("uploads").getPublicUrl(filePath);
              audioUrl = data.publicUrl;
            }
          }
          
          if (!audioUrl) {
            audioUrl = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });
          }
          
          onChange({ audioUrl, uploading: false });
          if (showToast) showToast("Nota de voz guardada");
        } catch (err) {
          console.error("Error al guardar audio:", err);
          onChange({ uploading: false });
          if (showToast) showToast("No se pudo guardar la nota de voz.", "error");
        }
        
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    } catch (err) {
      console.error("Error al acceder al micrófono:", err);
      if (showToast) showToast("No se pudo acceder al micrófono.", "error");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(block.audioUrl);
      audioRef.current.onloadedmetadata = () => {
        setAudioDuration(audioRef.current.duration);
      };
      audioRef.current.ontimeupdate = () => {
        setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
      };
      audioRef.current.onended = () => {
        setIsPlaying(false);
        setProgress(0);
      };
    }
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="group relative my-3 rounded-xl border p-3.5 transition hover:shadow-md select-none w-full animate-in fade-in duration-200" style={{ borderColor: T.border, background: T.sidebar }}>
      {block.audioUrl ? (
        <div className="flex items-center gap-3">
          <button onClick={togglePlay} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white shadow transition cursor-pointer hover:scale-105 active:scale-95" style={{ background: T.accent }}>
            {isPlaying ? <Pause size={15} fill="white" /> : <Play size={15} fill="white" className="ml-0.5" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate" style={{ color: T.ink }}>Nota de voz</p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: T.border }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: T.accent }} />
              </div>
              <span className="text-[10px] font-medium" style={{ color: T.muted }}>
                {audioRef.current ? formatTime(audioRef.current.currentTime) : "0:00"} / {audioDuration ? formatTime(audioDuration) : "Grabar"}
              </span>
            </div>
          </div>
          {!readOnly && (
          <button onClick={onDelete} className="rounded-full p-1.5 text-neutral-400 hover:text-red-500 transition hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer">
            <Trash2 size={14} />
          </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-5 text-center">
          {block.uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={24} className="animate-spin text-[var(--accent)]" style={{ color: T.accent }} />
              <span className="text-xs" style={{ color: T.muted }}>Guardando audio...</span>
            </div>
          ) : recording ? (
            <div className="flex flex-col items-center gap-3">
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/20 text-red-500 animate-pulse">
                <Mic size={24} />
                <span className="absolute -inset-1.5 rounded-full border border-red-500/30 animate-ping" />
              </div>
              <span className="text-xs font-semibold text-red-500">Grabando... {formatTime(seconds)}</span>
              <button onClick={stopRecording} className="flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-red-600 transition cursor-pointer">
                <Square size={11} fill="white" /> Detener grabación
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-full p-3 bg-neutral-100 dark:bg-neutral-800" style={{ color: T.accent }}>
                <Mic size={24} />
              </div>
              <p className="text-xs font-semibold" style={{ color: T.ink }}>Nota de voz</p>
              <p className="text-[10px]" style={{ color: T.muted }}>Graba tus pensamientos en formato de audio</p>
              {!readOnly && (
              <button onClick={startRecording} className="mt-2 flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition shadow hover:brightness-105 active:scale-98 cursor-pointer" style={{ background: T.accent }}>
                <Mic size={13} /> Comenzar a grabar
              </button>
              )}
            </div>
          )}
          {!readOnly && (
          <button onClick={onDelete} className="absolute right-2 top-2 md:opacity-0 md:group-hover:opacity-100 transition rounded p-1 cursor-pointer"><X size={14} style={{ color: T.muted }} /></button>
          )}
        </div>
      )}
    </div>
  );
}

/* ================= Componente Bloque de Enlace ================= */
function LinkBlock({ block, onChange, onDelete, readOnly }) {
  const handleUrlChange = (e) => {
    onChange({ text: e.target.value });
  };

  const handleLoadLink = () => {
    const url = block.text.trim();
    if (!url) return;
    
    let isYT = false;
    let ytId = "";
    let isSpotify = false;
    let spotifyEmbedUrl = "";
    
    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const ytMatch = url.match(ytRegex);
    if (ytMatch && ytMatch[1]) {
      isYT = true;
      ytId = ytMatch[1];
    }
    
    if (url.includes("spotify.com/")) {
      isSpotify = true;
      spotifyEmbedUrl = url.replace("spotify.com/", "spotify.com/embed/");
    }
    
    let hostname = "";
    try {
      hostname = new URL(url).hostname;
    } catch {
      hostname = url;
    }

    onChange({
      linkLoaded: true,
      isYT,
      ytId,
      isSpotify,
      spotifyEmbedUrl,
      linkTitle: isYT ? "Video de YouTube" : isSpotify ? "Reproductor de Spotify" : hostname,
      linkDescription: `Enlace externo a ${hostname}. Haz clic para abrir en una pestaña nueva o editar el título.`,
      hostname
    });
  };

  return (
    <div className="group relative my-3 rounded-xl border p-3 transition hover:shadow-md select-none w-full animate-in fade-in duration-200" style={{ borderColor: T.border, background: T.sidebar }}>
      {block.linkLoaded ? (
        <div>
          {block.isYT ? (
            <div className="overflow-hidden rounded-lg border shadow-sm aspect-video w-full" style={{ borderColor: T.border }}>
              <iframe src={`https://www.youtube.com/embed/${block.ytId}`} title={block.linkTitle} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="h-full w-full animate-in fade-in duration-300" />
            </div>
          ) : block.isSpotify ? (
            <div className="overflow-hidden rounded-lg border shadow-sm w-full" style={{ borderColor: T.border }}>
              <iframe src={block.spotifyEmbedUrl} width="100%" height="80" frameBorder="0" allowtransparency="true" allow="encrypted-media" className="rounded-lg" />
            </div>
          ) : (
            <div className="flex gap-3">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800" style={{ color: T.accent }}>
                <Link size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <input type="text" value={block.linkTitle || ""} readOnly={readOnly} onChange={e => onChange({ linkTitle: e.target.value })}
                       className="block w-full bg-transparent font-serif text-sm font-bold leading-tight outline-none border-b border-transparent focus:border-neutral-300" style={{ color: T.ink }} />
                <textarea rows={2} value={block.linkDescription || ""} readOnly={readOnly} onChange={e => onChange({ linkDescription: e.target.value })}
                          className="block w-full mt-1 resize-none bg-transparent text-[11px] leading-relaxed outline-none border-b border-transparent focus:border-neutral-300" style={{ color: T.muted }} />
                <a href={block.text} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1 text-[10px] hover:underline" style={{ color: T.accent }}>
                  <span>{block.hostname || block.text}</span>
                  <ExternalLink size={10} />
                </a>
              </div>
            </div>
          )}
          {!readOnly && (
          <button onClick={onDelete} className="absolute right-2 top-2 rounded-full p-1.5 shadow bg-white dark:bg-neutral-800 border text-neutral-400 hover:text-red-500 transition cursor-pointer" style={{ borderColor: T.border }}>
            <Trash2 size={13} />
          </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 w-full">
          <input type="text" autoFocus value={block.text} readOnly={readOnly} onChange={handleUrlChange}
                 onKeyDown={e => { if (e.key === "Enter") handleLoadLink(); }}
                 placeholder="Pega un enlace (YouTube, Spotify, etc.) y presiona Enter..."
                 className="w-full flex-1 rounded border px-3 py-1.5 text-xs outline-none bg-[var(--card)]" style={{ borderColor: T.border, color: T.ink }} />
          {!readOnly && (
          <>
            <button onClick={handleLoadLink} className="rounded px-3 py-1.5 text-xs font-semibold text-white transition shadow cursor-pointer hover:brightness-105" style={{ background: T.accent }}>
              Cargar
            </button>
            <button onClick={onDelete} className="rounded p-1 text-neutral-400 hover:text-red-500 transition cursor-pointer"><X size={15} /></button>
          </>
          )}
        </div>
      )}
    </div>
  );
}

/* ================= Bloque ordenable (drag & drop) ================= */
function SortableBlock(props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.block.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    position: isDragging ? "relative" : undefined,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <Block {...props} dragHandle={{ attributes, listeners, isDragging }} />
    </div>
  );
}

/* ================= Bloque ================= */
function Block({ block, index, focusId, clearFocus, onChange, onEnter, onDelete, onFocusPrev, showToast, user, dragHandle, readOnly }) {
  const ref = useRef(null);
  const [menu, setMenu] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);

  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e) => { if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moreOpen]);

  const grow = () => { const el = ref.current; if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } };
  useEffect(grow, [block.text, block.type]);

  useEffect(() => {
    if (focusId === block.id && ref.current) {
      ref.current.focus(); const len = ref.current.value.length; ref.current.setSelectionRange(len, len); clearFocus();
    }
  }, [focusId, block.id, clearFocus]);

  const numIndex = useMemo(() => {
    let n = 1;
    // We don't have blocks array passed in directly, but we can compute or fallback.
    // If blocks is needed for number indexing, we can pass it or fallback.
    return n;
  }, [index]);

  const applyType = (type) => { onChange({ type, text: "" }); setMenu(null); };

  const handleChange = (e) => {
    const v = e.target.value;
    const q = v.slice(1).trim();
    if (v.startsWith("/") && !q.includes(" ")) setMenu({ query: q }); else if (menu) setMenu(null);
    const sc = { "# ": "h1", "## ": "h2", "### ": "h3", "- ": "bullet", "* ": "bullet", "1. ": "number", "[] ": "todo", "[ ] ": "todo", "> ": "quote" };
    for (const [k, t] of Object.entries(sc)) { if (v === k) { onChange({ type: t, text: "" }); return; } }
    if (v === "---") { onChange({ type: "divider", text: "" }); return; }
    onChange({ text: v });
  };

  const handleKeyDown = (e) => {
    if (readOnly) return;
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

  let blockContent = null;

  if (block.type === "image") {
    blockContent = <ImageBlock block={block} onChange={onChange} onDelete={onDelete} user={user} showToast={showToast} readOnly={readOnly} />;
  } else if (block.type === "audio") {
    blockContent = <AudioBlock block={block} onChange={onChange} onDelete={onDelete} user={user} showToast={showToast} readOnly={readOnly} />;
  } else if (block.type === "link") {
    blockContent = <LinkBlock block={block} onChange={onChange} onDelete={onDelete} readOnly={readOnly} />;
  } else if (block.type === "divider") {
    blockContent = <hr className="w-full" style={{ borderColor: T.border }} />;
  } else {
    const s = TYPE_STYLE[block.type] || TYPE_STYLE.text;
    blockContent = (
      <div className="flex items-start gap-1.5 w-full min-w-0">
        {block.type === "todo" && (
          <button onClick={() => { if (!readOnly) onChange({ checked: !block.checked, completedAt: !block.checked ? new Date().toISOString() : null }); }}
                  className={`mt-[6px] grid h-[18px] w-[18px] flex-shrink-0 place-items-center rounded border transition ${readOnly ? "" : "cursor-pointer"}`}
                  style={{ borderColor: block.checked ? T.accent : T.border, background: block.checked ? T.accent : "transparent" }}>
            {block.checked && <CheckSquare size={12} className="text-white" strokeWidth={3} />}
          </button>
        )}
        {block.type === "bullet" && <span className="mt-[9px] flex-shrink-0 select-none" style={{ color: T.ink }}>•</span>}
        {block.type === "number" && <span className="mt-[3px] flex-shrink-0 select-none text-[15px]" style={{ color: T.muted }}>{index + 1}.</span>}

        <div className="relative flex-1 min-w-0">
          <textarea ref={ref} rows={1} value={block.text} onChange={handleChange} onKeyDown={handleKeyDown} readOnly={readOnly}
                    placeholder={index === 0 && block.type === "text" ? "Escribe, o pulsa “/” para comandos" : ""}
                    className={`w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-neutral-300 ${s.cls}`}
                    style={{ ...s.style, textDecoration: block.type === "todo" && block.checked ? "line-through" : "none", color: block.type === "todo" && block.checked ? T.muted : (s.style?.color || T.ink) }} />
          {menu && <MenuList query={menu.query} onPick={applyType} />}
        </div>

        {block.type === "todo" && <DateChip block={block} onChange={onChange} readOnly={readOnly} />}
      </div>
    );
  }

  return (
    <div className="group relative flex items-start w-full min-w-0 py-1 hover:bg-neutral-50/40 dark:hover:bg-neutral-800/10 rounded-lg px-2 transition-all">
      <div className="flex-1 min-w-0 pr-14 md:pr-0">
        {blockContent}
      </div>

      {/* Control pill (drag handle, menú …) */}
      {!readOnly && (
      <div className="absolute right-2 top-2 flex items-center gap-0.5 bg-neutral-100/90 dark:bg-neutral-800/90 backdrop-blur-sm border border-neutral-200 dark:border-neutral-700/60 rounded-xl px-1.5 py-0.5 shadow-md opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10">
        <button
          {...(dragHandle?.attributes || {})}
          {...(dragHandle?.listeners || {})}
          title="Arrastrar para mover"
          className={`hov rounded p-1 text-neutral-400 hover:text-[var(--accent)] transition ${dragHandle?.isDragging ? "cursor-grabbing" : "cursor-grab"}`}
          style={{ touchAction: "none", WebkitUserSelect: "none" }}
        >
          <GripVertical size={13} />
        </button>
        <div className="relative" ref={moreRef}>
          <button onClick={() => setMoreOpen(v => !v)} title="Opciones del bloque" className="hov rounded p-1 cursor-pointer text-neutral-400 hover:text-[var(--accent)] active:scale-95 transition">
            <MoreHorizontal size={13} />
          </button>
          {moreOpen && (
            <div className="absolute right-0 top-7 z-50 w-44 rounded-xl border shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-150"
                 style={{ background: T.sidebar, borderColor: T.border }} onClick={e => e.stopPropagation()}>
              <button onClick={() => { setMoreOpen(false); onDelete(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-red-500/10 transition text-left"
                      style={{ color: "var(--danger, #ef4444)" }}>
                <Trash2 size={13} /> Eliminar bloque
              </button>
            </div>
          )}
        </div>
      </div>
      )}
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
      else if (e.key === "Enter") { if (items[sel]) { e.preventDefault(); e.stopPropagation(); onPick(items[sel].type); } }
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
  danger: "var(--danger)",
};

function seedWorkspace() {
  const t = todayStr();
  const home = newPage(null); home.icon = "🏠"; home.title = "Inicio";
  home.blocks = [
    { ...emptyBlock("callout"), text: "Tu órbita: páginas + calendario. Ponle fecha a un pendiente con el 📅 y aparece en Calendario y Agenda. Activa recordatorios y tema oscuro en Ajustes." },
    { ...emptyBlock("h2"), text: "Pendientes" },
    { ...emptyBlock("todo"), text: "Instalar Órbita en mi celular", date: t },
    { ...emptyBlock("todo"), text: "Compartir la idea con mi socio", date: addDays(t, 1) },
    { ...emptyBlock("todo"), text: "Definir cómo lo alojamos gratis", date: addDays(t, 3), time: "10:00" },
    { ...emptyBlock("text"), text: "" },
  ];
  const proj = newPage(null); proj.icon = "🚀"; proj.title = "Proyecto";
  proj.blocks = [{ ...emptyBlock("h3"), text: "Ideas" }, { ...emptyBlock("text"), text: "" }];
  return { pages: { [home.id]: home, [proj.id]: proj }, order: [home.id, proj.id] };
}

/* ================= Vista de Administración Especializada ================= */
function AdminDashboardView({ user, profile, openTicketsCount, setOpenTicketsCount, showToast }) {
  const [adminTab, setAdminTab] = useState("tickets"); // "tickets", "users", "broadcast"
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [annActive, setAnnActive] = useState(true);
  const [annSending, setAnnSending] = useState(false);
  const [stats, setStats] = useState({ totalUsers: 0, activeUsers: 0, openTickets: 0 });

  // Custom UI Alerts
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const fetchAdminData = async () => {
    setTicketsLoading(true);
    setUsersLoading(true);
    try {
      // Cargar tickets
      const { data: ticketData, error: tErr } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (!tErr && ticketData) setTickets(ticketData);

      // Cargar perfiles
      const { data: userData, error: uErr } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (!uErr && userData) setUsersList(userData);

      // Cargar último anuncio
      const { data: annData } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (annData) {
        setAnnContent(annData.content);
        setAnnActive(annData.is_active);
      }

      // Calcular estadísticas
      if (userData && ticketData) {
        const now = Date.now();
        const activeCount = userData.filter(u => {
          const updatedAt = new Date(u.updated_at).getTime();
          return now - updatedAt < 48 * 60 * 60 * 1000;
        }).length;

        const pendingTickets = ticketData.filter(t => t.status === "open").length;
        setOpenTicketsCount(pendingTickets);

        setStats({
          totalUsers: userData.length,
          activeUsers: activeCount,
          openTickets: pendingTickets
        });
      }
    } catch (err) {
      console.error("Error al cargar datos de administración:", err);
    } finally {
      setTicketsLoading(false);
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const toggleBlockUser = async (targetId, currentBlocked) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_blocked: !currentBlocked })
        .eq("id", targetId);
      if (error) throw error;
      
      const nextBlocked = !currentBlocked;
      setUsersList(prev => prev.map(u => u.id === targetId ? { ...u, is_blocked: nextBlocked } : u));
      
      // Actualizar conteo de activos
      setStats(prev => {
        const nextUsers = usersList.map(u => u.id === targetId ? { ...u, is_blocked: nextBlocked } : u);
        const now = Date.now();
        const activeCount = nextUsers.filter(u => {
          const updatedAt = new Date(u.updated_at).getTime();
          return now - updatedAt < 48 * 60 * 60 * 1000;
        }).length;
        return { ...prev, totalUsers: nextUsers.length, activeUsers: activeCount };
      });

      showToast(nextBlocked ? "Usuario suspendido correctamente" : "Acceso restaurado correctamente");
    } catch (err) {
      showToast(err.message || "Error al actualizar usuario", "error");
    }
  };

  const updateTicketStatus = async (ticketId, newStatus) => {
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: newStatus })
        .eq("id", ticketId);
      if (error) throw error;
      
      const nextTickets = tickets.map(t => t.id === ticketId ? { ...t, status: newStatus } : t);
      setTickets(nextTickets);
      
      const pendingTickets = nextTickets.filter(t => t.status === "open").length;
      setOpenTicketsCount(pendingTickets);

      setStats(prev => ({
        ...prev,
        openTickets: pendingTickets
      }));

      showToast("Estado de ticket actualizado");
    } catch (err) {
      showToast(err.message || "Error al actualizar ticket", "error");
    }
  };

  const deleteTicketConfirm = async (ticketId) => {
    try {
      const { error } = await supabase
        .from("support_tickets")
        .delete()
        .eq("id", ticketId);
      if (error) throw error;
      
      const nextTickets = tickets.filter(t => t.id !== ticketId);
      setTickets(nextTickets);
      
      const pendingTickets = nextTickets.filter(t => t.status === "open").length;
      setOpenTicketsCount(pendingTickets);

      setStats(prev => ({
        ...prev,
        openTickets: pendingTickets
      }));

      showToast("Ticket eliminado con éxito");
    } catch (err) {
      showToast(err.message || "Error al eliminar ticket", "error");
    }
  };

  const handleSaveAnnouncement = async () => {
    if (!annContent.trim()) return;
    setAnnSending(true);
    try {
      const { error } = await supabase
        .from("announcements")
        .insert({
          content: annContent.trim(),
          is_active: annActive
        });
      if (error) throw error;
      showToast("Anuncio global publicado y actualizado");
    } catch (err) {
      showToast(err.message || "Error al guardar anuncio", "error");
    } finally {
      setAnnSending(false);
    }
  };

  const filteredTickets = tickets.filter(t => {
    if (statusFilter === "all") return true;
    return t.status === statusFilter;
  });

  const filteredUsers = usersList.filter(u => 
    u.email.toLowerCase().includes(searchEmail.toLowerCase())
  );

  return (
    <div className="flex-1 p-6 md:p-10 max-w-4xl mx-auto w-full space-y-6 text-[var(--ink)]">
      {/* Cabecera */}
      <div className="flex items-center gap-3 border-b pb-4" style={{ borderColor: T.border }}>
        <div className="p-2.5 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <Shield size={24} />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight">Panel de Administración</h1>
          <p className="text-xs" style={{ color: T.muted }}>Gestiona los usuarios, revisa reportes de soporte y publica anuncios globales.</p>
        </div>
      </div>

      {/* Cartas de Estadísticas Premium */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 border rounded-2xl flex items-center justify-between shadow-sm hover:shadow transition duration-200" style={{ borderColor: T.border, background: T.sidebar }}>
          <div className="text-left">
            <span className="block text-xs font-semibold uppercase tracking-wider" style={{ color: T.muted }}>Total Usuarios</span>
            <span className="text-2xl font-bold font-serif leading-none mt-1.5 block">{stats.totalUsers}</span>
          </div>
          <div className="p-3 rounded-lg bg-blue-100/60 dark:bg-blue-950/20 text-blue-500">
            <Users size={20} />
          </div>
        </div>

        <div className="p-5 border rounded-2xl flex items-center justify-between shadow-sm hover:shadow transition duration-200" style={{ borderColor: T.border, background: T.sidebar }}>
          <div className="text-left">
            <span className="block text-xs font-semibold uppercase tracking-wider" style={{ color: T.muted }}>Activos (48h)</span>
            <span className="text-2xl font-bold font-serif text-emerald-500 leading-none mt-1.5 block">{stats.activeUsers}</span>
          </div>
          <div className="p-3 rounded-lg bg-emerald-100/60 dark:bg-emerald-950/20 text-emerald-500">
            <Users size={20} />
          </div>
        </div>

        <div className="p-5 border rounded-2xl flex items-center justify-between shadow-sm hover:shadow transition duration-200" style={{ borderColor: T.border, background: T.sidebar }}>
          <div className="text-left">
            <span className="block text-xs font-semibold uppercase tracking-wider" style={{ color: T.muted }}>Tickets Abiertos</span>
            <span className="text-2xl font-bold font-serif leading-none mt-1.5 block" style={{ color: stats.openTickets > 0 ? "var(--danger)" : "inherit" }}>
              {stats.openTickets}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-red-100/60 dark:bg-red-950/20 text-[var(--danger)]">
            <MessageSquare size={20} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b gap-4 sm:gap-6 overflow-x-auto" style={{ borderColor: T.border }}>
        <button onClick={() => setAdminTab("tickets")}
                className="pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition outline-none whitespace-nowrap"
                style={{ borderColor: adminTab === "tickets" ? T.accent : "transparent", color: adminTab === "tickets" ? T.accent : T.muted }}>
          Soporte ({stats.openTickets})
        </button>
        <button onClick={() => setAdminTab("users")}
                className="pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition outline-none whitespace-nowrap"
                style={{ borderColor: adminTab === "users" ? T.accent : "transparent", color: adminTab === "users" ? T.accent : T.muted }}>
          Moderación
        </button>
        <button onClick={() => setAdminTab("broadcast")}
                className="pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition outline-none whitespace-nowrap"
                style={{ borderColor: adminTab === "broadcast" ? T.accent : "transparent", color: adminTab === "broadcast" ? T.accent : T.muted }}>
          Anuncio Global
        </button>
      </div>

      {/* Contenido: Tickets */}
      {adminTab === "tickets" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <p className="text-xs" style={{ color: T.muted }}>Listado de dudas, reportes de error y feedback enviados por los usuarios.</p>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-lg border px-3 py-1.5 text-xs outline-none shadow-sm" style={{ borderColor: T.border, background: T.sidebar, color: T.ink }}>
              <option value="all">Todos los estados</option>
              <option value="open">Abiertos</option>
              <option value="in_progress">En proceso</option>
              <option value="resolved">Resueltos</option>
              <option value="cancelled">Cancelados</option>
            </select>
          </div>

          <div className="space-y-3">
            {ticketsLoading ? (
              <div className="text-center py-10 text-xs" style={{ color: T.muted }}><Loader2 size={20} className="animate-spin inline mr-2" /> Cargando reportes...</div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-xl" style={{ borderColor: T.border }}>
                <p className="text-xs italic" style={{ color: T.muted }}>No se encontraron reportes con este estado.</p>
              </div>
            ) : (
              filteredTickets.map(t => (
                <div key={t.id} className="p-5 border rounded-2xl space-y-3 text-left hover:shadow-sm transition" style={{ borderColor: T.border, background: T.sidebar }}>
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="min-w-0 flex-1 break-words text-[14px] font-bold" style={{ color: T.ink }}>{t.subject}</h3>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <select value={t.status} onChange={e => updateTicketStatus(t.id, e.target.value)} className="text-[10px] font-bold rounded border px-2 py-0.5 outline-none"
                              style={{
                                borderColor: T.border,
                                background: t.status === "resolved" ? "rgba(16, 185, 129, 0.1)" : t.status === "in_progress" ? "rgba(245, 158, 11, 0.1)" : t.status === "cancelled" ? "rgba(107, 114, 128, 0.15)" : "rgba(239, 68, 68, 0.1)",
                                color: t.status === "resolved" ? "#10b981" : t.status === "in_progress" ? "#f59e0b" : t.status === "cancelled" ? "#6b7280" : "#ef4444"
                              }}>
                        <option value="open">Abierto</option>
                        <option value="in_progress">En Proceso</option>
                        <option value="resolved">Resuelto</option>
                        <option value="cancelled">Cancelado</option>
                      </select>
                      <button onClick={() => setConfirmDeleteId(t.id)} className="hov p-1 rounded text-neutral-400 hover:text-[var(--danger, #ef4444)] transition" title="Eliminar permanentemente">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: T.ink }}>{t.description}</p>
                  
                  <div className="text-[11px] pt-2 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1" style={{ borderColor: T.border, color: T.muted }}>
                    <span>Enviado por: <strong style={{ color: T.ink }}>{t.user_email}</strong></span>
                    <span>Fecha: {new Date(t.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Contenido: Usuarios */}
      {adminTab === "users" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-xs" style={{ color: T.muted }}>Busca perfiles de usuarios registrados para administrar sus accesos o suspender cuentas.</p>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
              <input type="text" placeholder="Buscar por correo..." value={searchEmail} onChange={e => setSearchEmail(e.target.value)}
                     className="w-full rounded-lg border pl-9 pr-3 py-1.5 text-xs outline-none" style={{ borderColor: T.border, background: T.sidebar, color: T.ink }} />
            </div>
          </div>

          <div className="border rounded-2xl overflow-hidden shadow-sm" style={{ borderColor: T.border, background: T.sidebar }}>
            {usersLoading ? (
              <div className="text-center py-10 text-xs" style={{ color: T.muted }}><Loader2 size={20} className="animate-spin inline mr-2" /> Cargando lista de usuarios...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-10 text-xs italic" style={{ color: T.muted }}>No se encontraron perfiles de usuario.</div>
            ) : (
              <div className="divide-y" style={{ borderColor: T.border }}>
                {filteredUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between gap-4 p-4 hover:bg-[var(--accent-soft)]/20 transition">
                    <div className="min-w-0 text-left">
                      <span className="block text-xs font-semibold truncate" style={{ color: T.ink }} title={u.email}>{u.email}</span>
                      <span className="text-[10px] block mt-0.5" style={{ color: T.muted }}>Rol: <strong className="capitalize">{u.role}</strong> · Registrado: {new Date(u.created_at).toLocaleDateString()}</span>
                    </div>
                    <div>
                      {u.id !== user.id ? (
                        <button onClick={() => toggleBlockUser(u.id, u.is_blocked)} className="rounded-lg px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-105 active:scale-[0.98] shadow-sm"
                                style={{ background: u.is_blocked ? T.accent : "var(--danger)" }}>
                          {u.is_blocked ? "Restaurar Acceso" : "Suspender Cuenta"}
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-400">Tú (Admin)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contenido: Anuncios */}
      {adminTab === "broadcast" && (
        <div className="max-w-xl text-left space-y-4">
          <p className="text-xs" style={{ color: T.muted }}>Crea un aviso de difusión global. Aparecerá en tiempo real en el encabezado de todos los usuarios activos de la plataforma.</p>
          
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: T.muted }}>Contenido del anuncio</label>
              <textarea rows={3} placeholder="Ej. ¡Lanzamos la versión 2.0! Revisa el nuevo calendario." value={annContent} onChange={e => setAnnContent(e.target.value)}
                        className="w-full rounded-xl border px-3 py-2 text-[13px] outline-none transition resize-none shadow-sm"
                        style={{ borderColor: T.border, background: T.sidebar, color: T.ink }} />
            </div>

            <div className="flex items-center gap-2 select-none cursor-pointer p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800/40" onClick={() => setAnnActive(!annActive)}>
              <input type="checkbox" checked={annActive} readOnly className="rounded cursor-pointer" />
              <span className="text-xs font-medium" style={{ color: T.ink }}>Habilitar anuncio inmediatamente</span>
            </div>

            {/* Vista Previa del Anuncio */}
            {annContent.trim() && (
              <div className="p-3 rounded-lg border text-xs" style={{ borderColor: T.border, background: T.sidebar }}>
                <span className="block text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: T.muted }}>Vista previa del banner:</span>
                <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-[var(--accent-soft)] text-[var(--accent)] border" style={{ borderColor: T.border }}>
                  <span className="font-semibold truncate">📢 {annContent}</span>
                  <span className="opacity-60 text-[10px]">✕</span>
                </div>
              </div>
            )}

            <button onClick={handleSaveAnnouncement} disabled={annSending} className="w-full py-2.5 rounded-lg text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow"
                    style={{ background: T.accent }}>
              {annSending ? <Loader2 size={14} className="animate-spin" /> : <Megaphone size={14} />} 
              {annSending ? "Publicando..." : "Publicar Anuncio Global"}
            </button>
          </div>
        </div>
      )}



      {/* Cuadro de diálogo Modal personalizado para confirmación de eliminación */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setConfirmDeleteId(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-xl border p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left"
               style={{ background: "var(--card, #1e1e1e)", borderColor: "var(--border)", color: "var(--ink)" }}>
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950/20 text-[var(--danger, #ef4444)]">
                <AlertCircle size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="font-serif text-base font-bold">¿Eliminar reporte?</h3>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Esta acción no se puede deshacer. Se borrará permanentemente de la base de datos.</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="hov px-4 py-2 rounded-lg text-xs font-semibold border transition" style={{ borderColor: "var(--border)", color: "var(--ink)" }}>
                Cancelar
              </button>
              <button onClick={() => { deleteTicketConfirm(confirmDeleteId); setConfirmDeleteId(null); }} className="px-4 py-2 rounded-lg text-xs font-semibold text-white shadow transition hover:brightness-105 active:scale-[0.98]" style={{ background: "var(--danger, #ef4444)" }}>
                Eliminar ticket
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* ================= Vista Papelera ================= */
function TrashView({ pages, order, onRestore, onDelete, onEmpty }) {
  const trashed = order.filter(id => pages[id]?.deletedAt);
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const daysLeft = (deletedAt) => {
    const elapsed = now - new Date(deletedAt).getTime();
    return Math.max(0, Math.ceil((THIRTY_DAYS_MS - elapsed) / (24 * 60 * 60 * 1000)));
  };
  const badgeStyle = (days) => {
    if (days > 14) return { bg: "rgba(16,185,129,0.12)", color: "#10b981" };
    if (days > 6)  return { bg: "rgba(245,158,11,0.12)", color: "#f59e0b" };
    return { bg: "rgba(239,68,68,0.12)", color: "#ef4444" };
  };
  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-24 pt-14 sm:px-8">
      <div className="mb-6 flex items-center gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold">Papelera</h1>
          <p className="text-[12px] mt-0.5" style={{ color: T.muted }}>Las páginas se eliminan definitivamente después de 30 días.</p>
        </div>
        {trashed.length > 0 && (
          <button onClick={onEmpty} className="ml-auto flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition" style={{ borderColor: "var(--danger,#ef4444)", color: "var(--danger,#ef4444)" }}>
            <Trash2 size={13} /> Vaciar papelera
          </button>
        )}
      </div>
      {trashed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <div className="text-5xl">🗑️</div>
          <p className="font-serif text-lg font-semibold" style={{ color: T.ink }}>La papelera está vacía</p>
          <p className="text-sm" style={{ color: T.muted }}>Las páginas que elimines aparecerán aquí durante 30 días.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {trashed.map(id => {
            const pg = pages[id];
            const days = daysLeft(pg.deletedAt);
            const badge = badgeStyle(days);
            const deletedDate = new Date(pg.deletedAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
            return (
              <div key={id} className="group flex items-center gap-3 rounded-xl border px-4 py-3 transition hover:shadow-md" style={{ borderColor: T.border, background: T.sidebar }}>
                <span className="text-2xl flex-shrink-0">{pg.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold" style={{ color: T.ink }}>{pg.title || "Sin título"}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: T.muted }}>Eliminada el {deletedDate}</p>
                </div>
                <span className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: badge.bg, color: badge.color }}>{days === 0 ? "Hoy" : `${days}d restantes`}</span>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button onClick={() => onRestore(id)} title="Restaurar" className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition" style={{ borderColor: T.accent, color: T.accent, background: T.accentSoft }}><RotateCcw size={12} /> Restaurar</button>
                  <button onClick={() => onDelete(id)} title="Eliminar definitivamente" className="rounded-lg border p-1.5 transition" style={{ borderColor: T.border, color: "var(--danger,#ef4444)" }}><Trash2 size={13} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================= Vista de Analíticas y Productividad ================= */
function AnalyticsView({ todos }) {
  const total = todos.length;
  const completedTodos = todos.filter(t => t.checked);
  const completed = completedTodos.length;
  const pending = total - completed;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // 1. Cálculo de Streaks (Racha)
  const { currentStreak, maxStreak } = useMemo(() => {
    const datesSet = new Set();
    completedTodos.forEach(t => {
      const dateStr = t.completedAt ? toStr(new Date(t.completedAt)) : (t.date || todayStr());
      datesSet.add(dateStr);
    });

    let streak = 0;
    let checkDate = new Date();
    let todayFormatted = toStr(checkDate);

    if (!datesSet.has(todayFormatted)) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayFormatted = toStr(yesterday);
      if (datesSet.has(yesterdayFormatted)) {
        checkDate = yesterday;
      }
    }

    while (datesSet.has(toStr(checkDate))) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    const sortedDates = Array.from(datesSet).sort();
    let maxS = 0;
    let tempS = 0;
    let prevD = null;

    sortedDates.forEach(dStr => {
      if (!prevD) {
        tempS = 1;
      } else {
        const dPrev = fromStr(prevD);
        dPrev.setDate(dPrev.getDate() + 1);
        if (toStr(dPrev) === dStr) {
          tempS++;
        } else {
          tempS = 1;
        }
      }
      prevD = dStr;
      if (tempS > maxS) maxS = tempS;
    });

    return { currentStreak: streak, maxStreak: Math.max(streak, maxS) };
  }, [completedTodos]);

  // 2. Actividad de los últimos 7 días
  const last7Days = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStr = toStr(d);
      
      const dayLabel = i === 0 ? "Hoy" : WEEK_S[(d.getDay() + 6) % 7];
      const dateLabel = i === 0 ? "" : String(d.getDate());
      const label = i === 0 ? "Hoy" : `${dayLabel} ${dateLabel}`;
      
      const count = completedTodos.filter(t => {
        const cDate = t.completedAt ? toStr(new Date(t.completedAt)) : (t.date || "");
        return cDate === dayStr;
      }).length;

      days.push({ dayStr, label, dayLabel, dateLabel, count, isToday: i === 0 });
    }
    return days;
  }, [completedTodos]);

  const maxCount7Days = Math.max(1, ...last7Days.map(d => d.count));

  // 3. Sistema de Gamificación / Nivel
  const levelInfo = useMemo(() => {
    if (completed >= 100) return { title: "Maestro de la Órbita 👑", level: 5, progress: 100, target: 100 };
    if (completed >= 50) return { title: "Imparable 🚀", level: 4, progress: Math.round(((completed - 50) / 50) * 100), target: 100 };
    if (completed >= 25) return { title: "Constante 🔥", level: 3, progress: Math.round(((completed - 25) / 25) * 100), target: 50 };
    if (completed >= 10) return { title: "Enfocado 🎯", level: 2, progress: Math.round(((completed - 10) / 15) * 100), target: 25 };
    return { title: "Iniciado 📑", level: 1, progress: Math.round((completed / 10) * 100), target: 10 };
  }, [completed]);

  // 4. Desglose por etiquetas
  const tagsStats = useMemo(() => {
    const map = {};
    todos.forEach(t => {
      if (t.tags && t.tags.length > 0) {
        t.tags.forEach(tag => {
          if (!map[tag]) map[tag] = { total: 0, completed: 0 };
          map[tag].total++;
          if (t.checked) map[tag].completed++;
        });
      }
    });
    return Object.entries(map)
      .map(([name, stat]) => ({
        name,
        total: stat.total,
        completed: stat.completed,
        pct: Math.round((stat.completed / stat.total) * 100)
      }))
      .sort((a, b) => b.total - a.total);
  }, [todos]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-24 pt-6 md:pt-14 sm:px-8 animate-in fade-in duration-200">
      <div className="mb-6">
        <h1 className="font-serif text-xl md:text-2xl font-bold flex items-center gap-2">
          <BarChart3 size={24} style={{ color: T.accent }} /> Productividad y Analíticas
        </h1>
        <p className="text-[12px] md:text-[13px] mt-0.5" style={{ color: T.muted }}>
          Rastrea tu rendimiento, mantén tu racha de enfoque y alcanza nuevos niveles de organización.
        </p>
      </div>

      {/* Grid de Métricas Principales */}
      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-2xl border p-4 shadow-sm transition hover:shadow-md" style={{ borderColor: T.border, background: T.sidebar }}>
          <div className="flex items-center justify-between text-amber-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Racha Actual</span>
            <Flame size={18} className="animate-pulse" />
          </div>
          <p className="text-2xl font-bold font-serif">{currentStreak} <span className="text-xs font-normal" style={{ color: T.muted }}>días</span></p>
          <p className="text-[10px] mt-1" style={{ color: T.muted }}>Racha diaria consecutiva</p>
        </div>

        <div className="rounded-2xl border p-4 shadow-sm transition hover:shadow-md" style={{ borderColor: T.border, background: T.sidebar }}>
          <div className="flex items-center justify-between text-indigo-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Mejor Racha</span>
            <Award size={18} />
          </div>
          <p className="text-2xl font-bold font-serif">{maxStreak} <span className="text-xs font-normal" style={{ color: T.muted }}>días</span></p>
          <p className="text-[10px] mt-1" style={{ color: T.muted }}>Récord histórico</p>
        </div>

        <div className="rounded-2xl border p-4 shadow-sm transition hover:shadow-md" style={{ borderColor: T.border, background: T.sidebar }}>
          <div className="flex items-center justify-between text-emerald-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Tasa Éxito</span>
            <TrendingUp size={18} />
          </div>
          <p className="text-2xl font-bold font-serif">{completionRate}%</p>
          <p className="text-[10px] mt-1" style={{ color: T.muted }}>{completed} de {total} completadas</p>
        </div>

        <div className="rounded-2xl border p-4 shadow-sm transition hover:shadow-md" style={{ borderColor: T.border, background: T.sidebar }}>
          <div className="flex items-center justify-between text-sky-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Pendientes</span>
            <Target size={18} />
          </div>
          <p className="text-2xl font-bold font-serif">{pending}</p>
          <p className="text-[10px] mt-1" style={{ color: T.muted }}>Tareas activas por hacer</p>
        </div>
      </div>

      {/* Gamificación: Nivel del Usuario */}
      <div className="mb-6 rounded-2xl border p-5 shadow-sm" style={{ borderColor: T.border, background: T.sidebar }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: T.accent }}>Nivel {levelInfo.level} de Productividad</span>
            <h3 className="font-serif text-lg font-bold">{levelInfo.title}</h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] font-bold text-lg">
            <Zap size={20} />
          </div>
        </div>
        <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-3 overflow-hidden border" style={{ borderColor: T.border }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${levelInfo.progress}%`, background: T.accent }} />
        </div>
        <div className="flex justify-between items-center mt-2 text-[11px]" style={{ color: T.muted }}>
          <span>{completed} tareas completadas</span>
          <span>{levelInfo.level < 5 ? `Siguiente nivel a las ${levelInfo.target} tareas` : "¡Nivel Máximo Alcanzado!"}</span>
        </div>
      </div>

      {/* Gráficos y Desglose por Etiquetas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Actividad de los últimos 7 días */}
        <div className="rounded-2xl border p-5 shadow-sm flex flex-col justify-between" style={{ borderColor: T.border, background: T.sidebar }}>
          <div>
            <h3 className="font-serif text-sm font-bold mb-1">Actividad Semanal</h3>
            <p className="text-[11px] mb-6" style={{ color: T.muted }}>Pendientes completados en los últimos 7 días</p>
          </div>
          <div className="flex items-end justify-between gap-2 h-36 pt-4 border-b pb-2" style={{ borderColor: T.border }}>
            {last7Days.map(d => {
              const heightPct = Math.round((d.count / maxCount7Days) * 100);
              return (
                <div key={d.dayStr} className="flex-1 flex flex-col items-center gap-1 group h-full justify-end">
                  <span className="text-[10px] font-bold opacity-80 group-hover:opacity-100 transition" style={{ color: d.count > 0 ? T.accent : T.muted }}>
                    {d.count > 0 ? d.count : ""}
                  </span>
                  <div className="w-full max-w-[28px] rounded-t-md transition-all duration-300 group-hover:brightness-110"
                       style={{
                         height: d.count > 0 ? `${Math.max(12, heightPct)}%` : "4px",
                         background: d.count > 0 ? (d.isToday ? T.accent : "var(--accent-soft)") : "var(--border)",
                         borderTop: d.count > 0 ? `2px solid ${T.accent}` : "none"
                       }} />
                  <span className="text-[10px] flex flex-col items-center leading-tight font-medium" style={{ color: d.isToday ? T.accent : T.muted }}>
                    <span>{d.dayLabel}</span>
                    {d.dateLabel && <span className="text-[9px] opacity-75">{d.dateLabel}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Desglose por Etiquetas (#Tags) */}
        <div className="rounded-2xl border p-5 shadow-sm flex flex-col justify-between" style={{ borderColor: T.border, background: T.sidebar }}>
          <div>
            <h3 className="font-serif text-sm font-bold mb-1">Progreso por Etiquetas (#Tags)</h3>
            <p className="text-[11px] mb-4" style={{ color: T.muted }}>Estado de avance según tus hashtags</p>
          </div>
          {tagsStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center" style={{ color: T.muted }}>
              <span className="text-2xl mb-1">🏷️</span>
              <p className="text-xs font-semibold">Sin etiquetas registradas</p>
              <p className="text-[11px] mt-0.5">Agrega hashtags como #Trabajo o #Personal a tus tareas.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
              {tagsStats.map(tag => (
                <div key={tag.name} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold" style={{ color: T.accent }}>#{tag.name}</span>
                    <span className="text-[11px]" style={{ color: T.muted }}>{tag.completed}/{tag.total} ({tag.pct}%)</span>
                  </div>
                  <div className="w-full bg-[var(--card)] rounded-full h-2 overflow-hidden border" style={{ borderColor: T.border }}>
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${tag.pct}%`, background: T.accent }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

