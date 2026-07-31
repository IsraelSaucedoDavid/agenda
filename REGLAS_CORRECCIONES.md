# 🛡️ Reglas de Buenas Prácticas y Qué NO Hacer al Realizar Correcciones

Este documento establece las normas obligatorias de desarrollo para mantener la estabilidad del proyecto Órbita PWA al corregir bugs o añadir funcionalidades.

---

## 🚫 Qué NO Hacer al Hacer una Corrección

1. **NO filtrar restrictivamente registros con valor de columna Nulo/Indefinido (`sp.status`)**:
   - **Error detectado**: Al intentar filtrar las invitaciones pendientes (`sp.status === "pending"`), si las invitaciones existentes o la tabla en Supabase no tenían poblada la columna `status` (dando `null` o `undefined`), la verificación de aceptación rechazaba las notas válidas. Esto causaba que la barra lateral `COMPARTIDAS CONMIGO` apareciera vacía para los usuarios invitados.
   - **Regla**: Las banderas de filtrado deben permitir fallbacks permisivos: `const isAccepted = sp.status === "accepted" || !sp.status || acceptedShares.includes(sp.id);`. Si `status` no existe o es nulo, la página debe ser visible de forma predeterminada para evitar la desaparición de contenido compartido.

2. **NO ocultar la barra de colaboradores cuando están desconectados**:
   - **Error detectado**: El banner superior dependía exclusivamente de `onlineUsers.length > 1`. Si el colaborador no estaba en vivo en ese instante, el propietario no tenía visibilidad visual de con quién estaba compartida la página.
   - **Regla**: El encabezado de colaboración debe listar siempre a todas las personas invitadas a la nota. Quienes están conectados muestran un punto verde intermitente (🟢 **en vivo**) y los que no están presentes muestran un indicador gris (⚪ **desconectado**).

3. **NO alterar el rol de Propietario (`isOwner`)**:
   - **Error detectado**: Se utilizó `!page.isShared` para evaluar si el usuario era el dueño. Esto causaba que, al compartir la página, la bandera `isShared: true` despojara al propio dueño de sus botones de administración (`Sub-página`, `Borrar`, invitaciones).
   - **Regla**: Diferenciar estrictamente entre `isOwner` (quien creó la nota) y `isSharedWithMe` (quien fue invitado por alguien más). El creador **nunca debe perder sus privilegios**.

4. **NO asumir variables o funciones globales sin pasar sus Props**:
   - **Error detectado**: Se invocó `setConfirmDialog` y `fetchSharedPages` dentro de componentes hijos o handlers sin haberlos declarado en el ámbito global ni haberlos transferido por `props`.
   - **Regla**: Toda función invocada en un componente hijo debe estar presente en sus `props` o declarada con `useCallback` en el ámbito correspondiente.

5. **NO presuponer la existencia de columnas en Supabase sin Fallbacks**:
   - **Error detectado**: Se intentó hacer `.insert({ status: "pending" })` sin verificar si la columna `status` existía en Supabase, lo que arrojaba el error de PostgREST `PGRST204`.
   - **Regla**: Toda interacción con la base de datos debe incluir manejo de excepciones (`try/catch`) y reintentos de contingencia (`fallback`) para asegurar que la app siga operando aun si la base de datos no se ha migrado.

---

## ✅ Lista de Verificación (Checklist) Antes de Cada Commit

- [ ] ¿Los invitados ven sus páginas en `COMPARTIDAS CONMIGO` incluso si la columna `status` es nula?
- [ ] ¿El banner superior de la página lista a los colaboradores tanto activos (🟢) como offline (⚪)?
- [ ] ¿El propietario sigue teniendo acceso total a `Sub-página`, `Borrar` y `Compartir`?
- [ ] ¿Todas las funciones e identificadores usados existen en el componente actual?
- [ ] ¿Se ejecutó `pnpm build` sin ningún error de minificación o compilación?
- [ ] ¿Se manejaron los errores de red/Supabase mediante fallbacks?
