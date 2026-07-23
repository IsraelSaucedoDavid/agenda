# Espacio — tu mini-Notion instalable

Un espacio de trabajo con páginas, notas y pendientes. Funciona en cualquier
navegador (Windows, Mac, Linux, iPhone, Android) y se puede **instalar como app**
en el celular gracias a que es una PWA.

Los datos se guardan **en el dispositivo** (localStorage). Cada quien tiene su
copia. Para compartir con otra persona hace falta un backend (ver el final).

---

## 1. Probarlo en tu compu

Necesitas Node.js instalado (https://nodejs.org, versión 18 o mayor).

```bash
npm install      # solo la primera vez
npm run dev      # abre http://localhost:5173
```

## 2. Publicarlo gratis en internet

Primero genera la versión final:

```bash
npm run build    # crea la carpeta dist/
```

Luego sube la carpeta `dist/` a cualquiera de estos (todos con plan gratis):

- **Netlify** — arrastra la carpeta `dist` a https://app.netlify.com/drop. Listo.
- **Vercel** — https://vercel.com, conecta el proyecto y publica.
- **GitHub Pages** — sube el repo y activa Pages.

Te darán una URL tipo `https://tu-espacio.netlify.app`.

> Importante: la instalación como app y el modo sin conexión solo funcionan
> sobre **https** (o en localhost). Netlify y Vercel ya te dan https gratis.

## 3. Instalarlo en el celular

Abre tu URL en el navegador del teléfono:

- **Android (Chrome):** menú ⋮ → "Instalar aplicación" / "Agregar a pantalla de inicio".
- **iPhone (Safari):** botón compartir → "Agregar a pantalla de inicio".

Aparece el ícono como una app normal y se abre a pantalla completa.

---

## Cómo se usa

**Páginas y notas**
- Pulsa **"/"** dentro de una línea para insertar títulos, listas, pendientes, etc.
- Atajos rápidos: `# ` título, `- ` lista, `[] ` pendiente, `> ` cita, `---` separador.
- **Enter** crea una línea nueva; **Backspace** al inicio la borra o la convierte en texto.
- Crea sub-páginas desde el panel izquierdo o con el botón "Sub-página".

**Fechas y calendario** (arriba en el panel: Páginas / Calendario / Agenda)
- En cualquier pendiente, pulsa el **📅** de la derecha para ponerle día y hora.
- **Calendario:** vista mensual con tus tareas en su día. Pasa el cursor por un día
  y pulsa **+** para agendar algo rápido. Toca una tarea para ir a su página.
- **Agenda:** tus pendientes ordenados en Atrasado / Hoy / Mañana / Próximos 7 días /
  Más adelante / Sin fecha, con una barra para agregar tareas al vuelo.
- **Bitácora:** cuando marcas un pendiente como hecho, queda registrado con su fecha
  en la parte de abajo de la Agenda ("lo que ya hiciste").
- Las tareas agregadas rápido caen en la página **Bandeja de entrada**.

**Ajustes** (botón abajo a la izquierda)
- **Tema claro / oscuro** — cámbialo ahí o con el botón rápido del panel. Se recuerda.
- **Recordatorios** — actívalos para recibir un aviso a la hora de cada tarea.
  Funcionan mientras la app está abierta; para avisos con la app cerrada hace
  falta un servidor (viene con el paso de Supabase).
- **Respaldo** — "Exportar" baja un archivo con TODO tu contenido; "Importar" lo
  restaura. Hazlo cada tanto: es tu seguro contra perder datos y sirve para pasar
  tu información a otro dispositivo.

---

## Siguiente paso: compartir con otra persona

Hoy cada dispositivo guarda su propia copia. Para que tú y tu socio vean lo mismo
en tiempo real, hay que reemplazar el guardado local por una base de datos en la
nube. La opción gratis y más sencilla es **Supabase** (Postgres + login + tiempo
real). El cambio se concentra en el objeto `store` de `src/App.jsx`: en lugar de
leer/escribir en `localStorage`, lee/escribe en Supabase.

Cuando quieras, ese es el siguiente paso.
