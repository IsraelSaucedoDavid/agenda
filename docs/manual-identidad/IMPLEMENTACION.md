# Órbita — Roadmap de implementación
Cómo llevar la nueva identidad al código, en orden y sin romper la app.

> Estado: **en curso**. Aplicadas: Fase 1 (tokens galaxia, `index.html`, manifest, favicon + PNG de
> iconos vía `scripts/render-icons.mjs`), Fase 2 (Fraunces + Inter en `src/main.jsx`) y Fase 3
> (marca `src/brand.jsx` en sidebar, header móvil y login; ilustraciones en `public/`). Fases 4–7 pendientes.

---

## Fase 1 · Tokens y marca (1 día)

### `src/index.css`
```css
:root { /* Amanecer estelar (claro) */
  --bg: #F8F6FF;            /* antes #FAFAF7 */
  --sidebar: #EFECFF;       /* antes #F2F0EA */
  --ink: #1E1936;           /* antes #1C1B19 */
  --muted: #5E5884;         /* antes #8A867D — mejora contraste AA */
  --border: #E1DDF6;        /* antes #E5E2D9 */
  --accent: #5B4BD8;        /* violeta nebulosa */
  --accent-soft: #ECE9FF;   /* antes #E3EFEA */
  --callout: #F0EEFF;       /* antes #E9F3EF */
  --comet: #0E7490;         /* NUEVO — cian de los anillos */
  --star: #D99A2B;          /* NUEVO — sol cálido (decorativo, foco de marca) */
  --danger: #C2415F;        /* rosa nebulosa */
  --card: #FFFFFF;
  /* radius y sombras sistémicos */
  --r-sm: 8px; --r-md: 12px; --r-lg: 16px;
  --sh-sm: 0 1px 2px rgba(11,7,34,.06);
  --sh-md: 0 8px 24px rgba(11,7,34,.14);
  --sh-lg: 0 20px 50px rgba(11,7,34,.24);
}
:root.dark { /* Espacio profundo (oscuro) */
  --bg: #0C0920; --sidebar: #131030; --ink: #F1EEFF; --muted: #9C94C9;
  --border: #2B2550; --accent: #8B7CFF; --accent-soft: #221C47;
  --callout: #1B1740; --comet: #5CC8FF; --star: #FFC24B;
  --danger: #E85D75; --card: #191438;
}
```
`@theme` (Tailwind 4) para exponer `--color-comet` y `--color-star` y poder usar `text-comet`/`bg-comet`.

### `index.html` y `vite.config.js`
- `theme-color`: `#0C0920` (espacio profundo).
- Manifest: `name/short_name` → **Órbita** (unificar), `theme_color #0C0920`,
  `background_color #0C0920`, íconos → los nuevos PNG derivados.

### `public/` — reemplazar activos
Regenerar a partir de `docs/manual-identidad/svg/`:
- `favicon.svg` → `svg/favicon.svg`
- `icon-192.png` / `icon-512.png` / `apple-touch-icon.png` → PNG derivados de `svg/app-icon.svg`
  y `svg/app-icon-maskable.svg` (zona segura 80% para maskable).

---

## Fase 2 · Tipografía (medio día)

1. `npm i @fontsource-variable/fraunces @fontsource-variable/inter`
2. En `src/main.jsx`:
   ```js
   import "@fontsource-variable/fraunces";
   import "@fontsource-variable/inter";
   ```
3. En `src/index.css`, configurar Tailwind:
   ```css
   @theme {
     --font-serif: "Fraunces Variable", ui-serif, Georgia, serif;
     --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
   }
   ```
4. Los `woff2` ya quedan en el precache de Workbox (`globPatterns: ["**/*.woff2"]`). Verificar con `npm run build`.
5. Revisar puntos de `font-serif` que hoy son el stack de sistema: sin cambios de clases, solo cambia el stack.

---

## Fase 3 · Logo en la UI (medio día)

- **Sidebar** (`src/App.jsx`, marca `Ó` en `T.accent`): sustituir el cuadrado con letra por el símbolo
  órbita (SVG inline o import). Mantener wordmark "Órbita".
- **Login** (`src/Auth.jsx`): usar la marca nueva en vez de `Sparkles`.
- **Favicon del editor**: usar el nuevo `favicon.svg`.

---

## Fase 4 · Ilustraciones y estados vacíos (medio día)

- **Login:** split layout con `svg/ilustracion-login.svg` (o como fondo superior en móvil).
- **Estados vacíos:** sustituir `🗂️` + `font-serif` por `svg/ilustracion-empty.svg` + microcopy:
  *"Tu órbita está vacía. Crea una página y ponla en movimiento."*
- Misma ilustración reutilizada (con variante) en agenda/papelera vacías.

---

## Fase 5 · Iconografía (1 día)

1. **Trazo unificado:** donde se use `lucide-react`, normalizar:
   ```js
   const iconProps = { strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" };
   ```
   o un wrapper `<Icon />` que lo inyecte.
2. **Set de módulos:** usar `svg/iconos-modulos.svg` (sprite) en la navegación
   Páginas/Calendario/Agenda/Analíticas/Ajustes/Papelera.
3. **Íconos de página (corto plazo):** enmarcar el emoji en una ficha `--accent-soft` rounded.

---

## Fase 6 · Pulido UI y accesibilidad (1 día)

- Unificar radius: reemplazar `rounded-md`/`lg`/`xl`/`2xl` dispersos por los tokens `--r-*` (o clases `rounded-*` de Tailwind según `@theme`).
- Sombras: `--sh-sm/md/lg`.
- **Foco visible**: anillo `2px --accent` con offset 2px en botones, inputs y menús.
- Corregir colores hardcodeados que rompen el tema oscuro:
  - `placeholder:text-neutral-300` → `placeholder:text-[var(--muted)]` (hoy en claro es casi invisible y en oscuro contrasta mal).
  - `text-neutral-400` (íconos de bloque) → `var(--muted)`.
  - `bg-red-50/dark:bg-red-950/20` y similares → mantener, pero definir `--danger-soft` en los tokens.
  - `bg-neutral-100/90` (pill de control de bloque) → `--card`/`--sidebar`.
- `bg-header` → actualizar al nuevo `--bg` (ya usa 85% + blur, solo cambia el color).

---

## Fase 7 · Verificación

```bash
npm install
npm run dev      # revisión visual clara + oscura, 320px → 1440px
npm run build    # confirmar que woff2 e iconos entran en el precache
```

**Checklist de QA visual:**
- [ ] Marca legible a 16px (favicon), 192px y 512px.
- [ ] Contraste de `--muted` ≥ 4.5:1 en claro.
- [ ] Foco visible en teclado (TAB) en toda la app.
- [ ] Sin emojis sin enmarcar en zonas "de sistema".
- [ ] Tema oscuro sin colores hardcodeados claros.
- [ ] PWA instalable con los nuevos íconos.

---

## Notas

- Los cambios son **incrementales** y cada fase deja la app funcional (comenzar siempre por la Fase 1).
- Si se aprueba **"Espacio"** en vez de **Órbita**, solo cambia el nombre en Fase 1 (manifest + title);
  el sistema visual (marca, paleta, tipografía) es idéntico.
- Pendiente de decisión de negocio: sustituir emojis de página por banco vectorial propio (Fase 5, medio plazo).
