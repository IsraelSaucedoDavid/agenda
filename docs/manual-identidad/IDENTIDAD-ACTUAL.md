# Identidad actual — Órbita / Espacio
**Manual de marca (estado vigente)** · Auditoría · `espacio-pwa`

> Documento que describe **cómo se ve y se siente hoy** la aplicación, con base en lectura directa del código
> (`src/App.jsx`, `src/Auth.jsx`, `src/index.css`, `index.html`, `vite.config.js`, `public/`).

---

## 1. Ficha del producto

| Campo | Valor |
|---|---|
| Tipo | PWA de espacio de trabajo personal (editor de bloques tipo Notion) |
| Funciones | Páginas, notas, pendientes, calendario, agenda, recordatorios, respaldo, papelera, analíticas, colaboración en tiempo real, compartir, notificaciones, panel de administración |
| Stack visual | React 18 + Tailwind CSS 4 + lucide-react + variables CSS |
| Instalable | Sí (manifest + Service Worker, `standalone`) |
| Idioma | Español (es) |
| Nombres en conflicto | **"Espacio"** (repo/README) vs **"Órbita"** (UI, manifest, meta, claves `orbita:*`) |

---

## 2. Logotipo

**Activo actual:** `public/favicon.svg` y marca de la barra lateral (`src/App.jsx`).

| Elemento | Descripción |
|---|---|
| Favicon | Cuadrado redondeado `#0E7C66` con la letra **E** en serif Georgia blanca |
| Marca en app | Cuadrado redondeado pequeño con la letra **Ó** (`background: T.accent`) |
| Wordmark | Texto "Órbita" en `font-serif` del sistema, junto a la marca |

**Diagnóstico**
- Es un **letterform genérico**, sin símbolo propio ni memoria gráfica. No se distingue de otras apps "letra sobre color".
- **Georgia** no está instalada en Android/iOS: en móvil se renderiza con la serif del sistema (Times), perdiendo el detalle.
- No hay versiones (negativo, monocromo, favicon nítido a 16px).

---

## 3. Paleta de color

Fuente: `src/index.css` (`:root` y `:root.dark`).

### Claro

| Token | Hex | Uso |
|---|---|---|
| `--bg` | `#FAFAF7` | Fondo general (blanco cálido) |
| `--sidebar` | `#F2F0EA` | Panel lateral |
| `--ink` | `#1C1B19` | Texto principal (casi negro cálido) |
| `--muted` | `#8A867D` | Texto secundario |
| `--border` | `#E5E2D9` | Bordes y divisores |
| `--accent` | `#0E7C66` | Acción principal (verde esmeralda) |
| `--accent-soft` | `#E3EFEA` | Fondo de acento |
| `--callout` | `#E9F3EF` | Fondo de notas |
| `--danger` | `#B4462F` | Errores / destructivo |
| `--card` | `#FFFFFF` | Superficies |

### Oscuro

| Token | Hex |
|---|---|
| `--bg` | `#1A1917` · `--sidebar` `#211F1C` |
| `--ink` | `#ECEAE4` · `--muted` `#9A968C` |
| `--border` | `#34302A` |
| `--accent` | `#3DAB90` · `--accent-soft` `#233029` |
| `--callout` | `#1E2C27` · `--danger` `#E0765C` · `--card` `#26231E` |

**Diagnóstico**
- ✅ Buenos cimientos: neutros **cálidos** (no grises fríos), acento esmeralda, contraste sólido de texto (`#1C1B19`/`#FAFAF7` ≈ 13:1).
- ⚠️ `--muted #8A867D` sobre `#FAFAF7` ≈ **3.5:1**: no alcanza AA (4.5:1) para texto pequeño.
- ⚠️ El teal `#0E7C66` es un color muy usado por otras herramientas de notas/áreas personales: no diferencia la marca.
- ⚠️ En el código se mezclan tokens con **colores hardcodeados** (ej. `text-neutral-400`, `bg-red-50`, `placeholder:text-neutral-300`), que rompen el tema oscuro en sitios puntuales.

---

## 4. Tipografía

Fuente: clases `font-serif` / `font-sans` de Tailwind (stacks del sistema). **No hay webfonts.**

| Rol | Stack actual | Notas |
|---|---|---|
| Títulos / serif | `ui-serif, Georgia, Cambria, Times New Roman, serif` | Favicon usa Georgia; títulos y editor en serif |
| Cuerpo / sans | `ui-sans-serif, system-ui, ...` | Interfaz general |

**Diagnóstico**
- ✅ Decisión editorial **serif para títulos + sans para UI** es una elección con carácter.
- ⚠️ Sin tipografía controlada: la app se ve distinta en Windows (Georgia), macOS, Android e iOS.
- ⚠️ Escala tipográfica informal (text-[13px], text-[15px], text-xs... con excepciones por componente), sin jerarquía definida.

---

## 5. Iconografía

| Origen | Dónde | Trazo |
|---|---|---|
| **lucide-react** | Navegación, acciones, menús | 2px por defecto, según instancia |
| **Emojis** | Íconos de página (`📄 📝 💡 ...`), estados vacíos (`🗂️`), avisos (`📢`), bloque de imagen (`📅`) | Depende del sistema |

**Diagnóstico**
- ✅ lucide es consistente y ligera.
- ⚠️ Los **emojis rompen la coherencia**: se ven distintos en cada plataforma (Windows vs Apple vs Android), tienen color no controlado y chocan con la sobriedad del resto.
- ⚠️ Mezcla de estilos: checkbox de pendiente usa `CheckSquare`, notificaciones `Bell`, pero la "vida" de las páginas son emojis de plataforma.

---

## 6. Imágenes e ilustraciones

| Pantalla | Recurso actual |
|---|---|
| Login | Blobs de gradiente esmeralda difuminados (`blur-[120px]`) + tarjeta blanca |
| Estado vacío (sin páginas) | Emoji `🗂️` + texto |
| Vacías (agenda/papelera) | Texto e íconos de línea |

**Diagnóstico**
- No hay ilustraciones propias ni dirección fotográfica. Los blobs de login son un recurso común (todas las apps lo usan).
- Los estados vacíos, siendo la primera impresión de onboarding, no comunican la marca.

---

## 7. Sistema de UI

| Elemento | Estado |
|---|---|
| Radius | Mezcla: `rounded-md` (6), `rounded-lg` (8), `rounded-xl` (12), `rounded-2xl` (16), `rounded-full`. Sin escala |
| Sombras | `shadow-sm`, `shadow-md`, `shadow-2xl` sin escala declarada |
| Glass | Header móvil con `backdrop-blur(12px)` y fondo 85% opaco (`bg-header`) — buen detalle |
| Motion | `animate-in`, `fade-in`, `slide-in`, `animate-bounce`, `animate-pulse` (ad-hoc) |
| Botón principal | Esmeralda + texto blanco; `hover:brightness-105 active:scale-[0.98]` |
| Tema | Claro/Oscuro completo, `color-scheme`, guardado en ajustes |
| Accesibilidad | Falta: foco visible consistente, contraste del `muted`, foco en teclado de menús |

---

## 8. Voz y tono

- Mensajes en español cercano: *"Tu órbita está vacía"*, *"Crea tu primera página"*, *"Instalar en mi celular"*.
- ✅ Cálido y humano. El único activo con personalidad real de marca.
- Existen Términos de Servicio y Normas de Convivencia redactados (login).

---

## 9. Matriz de consistencia

| Dimensión | Fuerza | Debilidad |
|---|---|---|
| Naming | — | **Doble nombre: Espacio / Órbita** (el problema #1) |
| Logo | — | Letterform genérico, sin símbolo |
| Color | Neutros cálidos, contraste de texto | Acento poco diferenciado, `muted` < AA, colores hardcodeados |
| Tipografía | Dirección serif+sans editorial | No controlada (sin webfont) |
| Iconografía | lucide consistente | Emojis rompen la unidad |
| Imágenes | — | Sin ilustraciones propias |
| UI | Glass, dark mode, micro-motion | Radius/sombras no sistemáticos |
| Voz | Cercana y en español | — |

---

## 10. Inventario de activos

```
public/favicon.svg          → logo actual (E sobre #0E7C66)
public/apple-touch-icon.png → ícono iOS (PNG derivado)
public/icon-192.png         → ícono PWA 192
public/icon-512.png         → ícono PWA 512
src/index.css               → tokens de color + temas
src/App.jsx                 → toda la UI (lucide + clases)
src/Auth.jsx                → pantalla de login
index.html                  → título "Órbita", theme-color #0E7C66
vite.config.js              → manifest PWA (name "Órbita", #0E7C66, #FAFAF7)
```

**Conclusión de la auditoría:** hay una identidad *funcional* con buen ADN (calidez, esmeralda, serif, español cercano) pero **inacabada**: sin símbolo propio, sin tipografía propia, sin sistema visual y con un conflicto de nombre sin resolver. La propuesta nueva se apoya en ese ADN y lo lleva al siguiente nivel.
