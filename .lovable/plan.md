## Cambios pedidos

### 1. Pantalla principal (`/main`)
- Eliminar la sección "Historial de intervenciones" completa.
- En "Servicios activos": añadir botón "Cerrar" en cada tarjeta (sin entrar al servicio). Pide confirmación y marca el servicio como finalizado.
- En "Servicios finalizados": añadir botón "PDF" junto a "Reabrir" para descargar el PDF de la intervención.

### 2. PDF de intervención (nuevo)
Actualmente no existe generación de PDF. Lo generaré con `jspdf` en el cliente, incluyendo:
- Cabecera: número de servicio, fechas inicio/fin, mando.
- Lista de intervinientes (indicativo, función, tipo).
- Registro completo de claves (`claves_log`) con timestamps.
- Lista de focos y zonas con su info.
- (Sin capturar mapa/pizarra para mantener viable la generación en cliente.)

Se descarga directamente; no se sube a storage.

### 3. Autenticación con email (cambio mayor)
El sistema actual es localStorage + contraseña fija. Lo migro a **Supabase Auth (email + contraseña)** manteniendo el indicativo como identidad de operación:

- **Primer acceso de un indicativo**: el usuario introduce indicativo + email + contraseña. Se crea cuenta en Supabase Auth y un registro en tabla `usuarios` (indicativo único ↔ user_id ↔ email ↔ rol).
- **Accesos posteriores**: solo indicativo + contraseña (se busca el email asociado al indicativo y se hace login).
- La contraseña fija `Abdusk4n+` desaparece — cada usuario tiene la suya.

### 4. Roles y permisos
Tabla `user_roles` con enum `app_role`: `admin`, `mando`, `voluntario`. Se eliminan los roles anteriores (deducidos del prefijo del indicativo).

- **Admin** (`guille.merino.tes@gmail.com`, asignado por migración): pantalla "Gestión de usuarios" para asignar roles y **revocar acceso** (flag `revoked` en `usuarios`; al iniciar sesión se rechaza). Tiene también todas las capacidades de Mando.
- **Mando**: crear/editar/cerrar/exportar servicios. Uso normal.
- **Voluntario**: solo ver y unirse a servicios activos. No ve finalizados ni puede crear/cerrar/exportar.

Función `has_role()` security-definer + RLS adecuadas.

### 5. Registro de accesos
Tabla `accesos_log` (user_id, indicativo, email, created_at, user_agent). Se inserta en cada login correcto. Visible para admin en la pantalla de gestión.

## Archivos afectados

- **Migración SQL**: enum `app_role`, tablas `usuarios`, `user_roles`, `accesos_log`, función `has_role`, policies/grants, asignación inicial de admin.
- `src/lib/auth-context.tsx`: reescrito sobre Supabase Auth + lookup por indicativo.
- `src/routes/index.tsx`: login con detección de "primer acceso" (pide email) vs "acceso recurrente".
- `src/routes/main.tsx`: quitar historial, añadir botones Cerrar/PDF, ocultar acciones según rol.
- `src/lib/pdf.ts` (nuevo): generación de PDF con `jspdf`.
- `src/routes/admin.tsx` (nuevo): solo admin — lista usuarios, asignar rol, revocar, ver log de accesos.
- `src/lib/domain.ts`: ampliar `Role` a `admin | mando | voluntario`, quitar `FIXED_PASSWORD` y `roleFor`.
- Dependencia nueva: `jspdf`.

## Preguntas antes de ejecutar

1. **Indicativos**: ¿se mantiene la lista fija actual (A00, B0x, C0x, D0x, V*) o cualquier persona puede registrar el indicativo que quiera la primera vez?
2. **Voluntarios y servicios finalizados**: actualmente los voluntarios tampoco los ven (correcto según tu mensaje). ¿Los mandos pueden ver el PDF de servicios creados por otros mandos? (asumo que sí).
3. **PDF**: ¿te vale un PDF "de texto" con la lista de claves/intervinientes/focos/zonas, o necesitas también imágenes del mapa y la pizarra? (Lo segundo es bastante más complejo.)
