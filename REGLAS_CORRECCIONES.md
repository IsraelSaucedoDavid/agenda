# 🛡️ Reglas de Buenas Prácticas y Qué NO Hacer al Realizar Correcciones

Este documento establece las normas obligatorias de desarrollo para mantener la estabilidad del proyecto Órbita PWA al corregir bugs o añadir funcionalidades.

---

## 🚫 Qué NO Hacer al Hacer una Corrección

1. **NO alterar el rol de Propietario (`isOwner`)**:
   - **Error cometido previamente**: Se utilizó `!page.isShared` para evaluar si el usuario era el dueño. Esto causaba que, al compartir la página, la bandera `isShared: true` despojara al propio dueño de sus botones de administración (`Sub-página`, `Borrar`, invitaciones).
   - **Regla**: Diferenciar estrictamente entre `isOwner` (quien creó la nota) y `isSharedWithMe` (quien fue invitado por alguien más). El creador **nunca debe perder sus privilegios**.

2. **NO asumir variables o funciones globales sin pasar sus Props**:
   - **Error cometido previamente**: Se invocó `setConfirmDialog` y `fetchSharedPages` dentro de componentes hijos o handlers sin haberlos declarado en el ámbito global ni haberlos transferido por `props`.
   - **Regla**: Toda función invocada en un componente hijo debe estar presente en sus `props` o declarada con `useCallback` en el ámbito correspondiente.

3. **NO presuponer la existencia de columnas en Supabase sin Fallbacks**:
   - **Error cometido previamente**: Se intentó hacer `.insert({ status: "pending" })` sin verificar si la columna `status` existía en Supabase, lo que arrojaba el error de PostgREST `PGRST204`.
   - **Regla**: Toda interacción con la base de datos debe incluir manejo de excepciones (`try/catch`) y reintentos de contingencia (`fallback`) para asegurar que la app siga operando aun si la base de datos no se ha migrado.

4. **NO romper el flujo de trabajo existente**:
   - Al solucionar una falla en un caso borde (ej. invitaciones pendientes), jamás se debe degradar la experiencia de las páginas personales locales ni deshabilitar funciones previas.

---

## ✅ Lista de Verificación (Checklist) Antes de Cada Commit

- [ ] ¿El propietario sigue teniendo acceso total a `Sub-página`, `Borrar` y `Compartir`?
- [ ] ¿Todas las funciones e identificadores usados existen en el componente actual?
- [ ] ¿Se ejecutó `pnpm build` sin ningún error de minificación o compilación?
- [ ] ¿Se manejaron los errores de red/Supabase mediante fallbacks?
