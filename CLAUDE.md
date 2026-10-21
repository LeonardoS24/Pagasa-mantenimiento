# Sistema Integral de Mantenimiento — Grupo Pagasa

Sistema web interno para el mantenimiento de la flota, estaciones de carburación
y plantas almacenadoras de gas LP de Grupo Pagasa.

## Lo primero que hay que saber

**Esto es el sistema real en producción, no un entorno de pruebas.** La base de
datos tiene los datos reales de la empresa. De ahí dos reglas que no se rompen:

1. **Todo lo que se cree para probar se borra y se verifica en 0.** Los scripts
   de verificación van en `scripts/_*.mts` (ese prefijo marca "temporal") y se
   eliminan al terminar.
2. **Ninguna función borra ni reinicia bitácoras de mantenimiento.** El historial
   no se toca. Dar de baja una unidad o un equipo lo marca inactivo y conserva
   todo; nunca lo elimina.

## Stack

Next.js 14.2.35 (App Router) · TypeScript · Tailwind · Prisma + SQLite ·
iron-session · zod en cada Server Action. **Toda la interfaz está en español**,
igual que los nombres de campos, comentarios y mensajes.

## Vocabulario del dominio (los nombres engañan)

Esto es lo que más tiempo cuesta re-descubrir:

- **`VehicleRecord`** no es solo "vehículo": es cualquier registro de un apartado
  de unidades, **incluidas las estaciones de carburación y las plantas**.
- En **Estaciones y Planta**, `numeroEconomico` se reutiliza como **"Nombre"** y
  `sucursal` como **"Dirección"**. En un vehículo normal, `sucursal` es la
  **"Marca"** (así lo usa el equipo desde antes del sistema). `anio`/`placas` no
  aplican a estaciones ni plantas.
- **`Equipo.vehicleRecordId`**: si viene lleno, el equipo pertenece a esa
  estación en particular; si es `null`, es un equipo de planta a nivel ciudad.

## Estructura de apartados (`Section`)

Los apartados viven en la base (el ADMIN los edita), y **el comportamiento de
cada página se decide por el `slug`**, no por una ruta fija. La ruta catch-all
`app/(protected)/ciudades/[citySlug]/[...sectionPath]` resuelve la cadena de
slugs y de ahí salen banderas como `isVehicleSection`, `isEquiposSection`,
`isPlantaFichaTecnicaSection`, `isAreasDePlantaSection`.

`Planta` (slug `planta`, nivel superior) tiene **tres hijos**:

| slug                   | nombre visible    | qué es |
|------------------------|-------------------|--------|
| `planta-ficha-tecnica` | Planta            | Ficha técnica del tanque + inspecciones + permisos |
| `equipos`              | Equipos de planta | Equipos de la planta a nivel ciudad |
| `areas-de-planta`      | Áreas de planta   | Las 15 áreas operativas con su checklist |

`ESTACION_LIKE_SECTION_SLUGS` (`lib/estacion-sections.ts`) = estaciones + planta:
comparten el modelo de ficha técnica del tanque.

**"Transportadora Kino"** (slug `transportadora-kino`) es otra "ciudad", pero su
"Unidad de distribución" no trae los 4 sub-apartados de siempre sino
**`tractocamiones`** y **`semirremolques`** (`lib/kino-sections.ts`). Un
semirremolque lleva el mismo tanque de carga que un Auto-Tanque
(`esTanqueDeCarga()`: placa, válvulas, 5 pruebas); el tractocamión lleva motor,
transmisión, ejes, etc. Los campos propios de cada uno y las válvulas con su
código grabado están listados una sola vez en `lib/ficha-campos.ts`.

Los **conjuntos** (tablas `ConjuntoTransporte` + `ConjuntoSemirremolque`) agrupan
un tractocamión con hasta 2 semirremolques **tal como vienen en los dictámenes**
("Dictamen 05"). Un tractocamión puede estar en varios; un semirremolque en uno
solo. Los apartados de Kino se ven "separados" (tabla de siempre) o
`?vista=conjuntos`. La fuente de verdad de con quién viaja cada unidad son los
conjuntos, no el campo `unidadAsignada` (dato viejo de la relación de tanques,
ya no se muestra).

**"Administración"** es una ciudad agregada (`lib/aggregate-city.ts`): no tiene
flota propia, combina los datos de todas las ciudades reales.

## Los TRES sistemas de válvulas (no se mezclan a propósito)

Son sistemas físicos distintos y cada uno tiene su propio cálculo y su panel:

1. **Unidades** (`VehicleTechnicalSheet`, `lib/valve-alerts.ts`) — 11 válvulas
   en la alerta (se agregaron exceso de flujo y check lock); la **válvula
   interna** se guarda pero NO entra a la alerta. Cada válvula tiene además su
   `codigoValvula*` (texto grabado, de referencia). Para armar las fechas usa
   siempre `valveDatesFromSheet(sheet)`, no un objeto a mano. **Los nombres son
   los del Excel de flotilla** (`lib/ficha-campos.ts`); el otro nombre va entre
   paréntesis solo cuando es seguro que es la misma válvula. Pendiente de
   confirmar con el usuario: servicio de vapor = retorno de vapores?, descarga
   de emergencia = interna?, máximo llenado = purgador?, servicio = reguladora?
2. **Estaciones de carburación** (`StationTankTechnicalSheet`,
   `lib/station-valves.ts`) — 7 válvulas, solo fecha de fabricación de cada una,
   y **una sola alerta combinada**: vence 5 años después de la más antigua.
3. **Planta** (mismas columnas de `StationTankTechnicalSheet`,
   `lib/planta-tank-instruments.ts`) — 5 instrumentos (máximo llenado, manómetro,
   termómetro, exceso de flujo/no retroceso, relevo de presión), cada uno con
   **3 fechas** (fabricación / cambio / instalación) y **alerta propia por
   separado**, a 5 años del cambio o, si nunca se cambió, de la fabricación.

Una estación puede tener 2 tanques físicos: `stationTankTechnicalSheets` es 1:N
con `etiqueta` ("Tanque 1", "Tanque 2") y único por `[vehicleRecordId, etiqueta]`.

## Sistema de alertas

**`lib/vehicle-alerts-summary.ts` → `getAllVehicleAlerts(cityIds)` es la única
fuente.** Alimenta las tres pantallas: Inicio (`/dashboard`), la portada de cada
ciudad y `/admin/alertas`. Devuelve 11 arreglos (ultrasonido, visual externa,
hermeticidad, visual interna, hidrostática, extintor, mantenimiento, válvulas de
unidad, mangueras, válvulas de estación, instrumentos de planta).

Al agregar un tipo de alerta hay que tocar **cuatro** lugares o queda a medias:
`getAllVehicleAlerts`, su panel en `components/dashboard/`, las tres páginas que
lo pintan, y `countValveRedAlerts` (`lib/login-alerts.ts`) si cuenta para el
aviso rojo al iniciar sesión.

Umbrales: **rojo** ≤ 7 días, **amarillo** ≤ 30 días.

**Ciclo de revisión de tanques:** la primera vence a los **10 años** de la fecha
de fabricación (se calcula al dar de alta el tanque); de ahí en adelante, cada
revisión registrada agenda la siguiente **5 años** después (`addFiveYears` en
`internal-visual-inspection-actions.ts` e `hydrostatic-test-actions.ts`). Aplica
a Planta y a Estaciones.

## Seguridad — dos capas, ambas obligatorias

**1. Rol** (`lib/auth.ts`): `requireUser` / `requireEditor` / `requireAdmin` /
`requireElevatedEditor`. Roles: `ADMIN`, `USUARIO` (edita, no administra),
`LECTOR` (solo ve). `requireUser` **relee el rol de la base en cada request**, no
de la cookie. `requireElevatedEditor` deja pasar a un USUARIO solo dentro de su
horario de acceso ampliado (`lib/elevated-access.ts`).

**2. Pertenencia a la ciudad** (`lib/access.ts`): `assertSectionAccess`,
`assertVehicleAccess`, `assertEquipoAccess`, `assertCityAccessById`.

> **Al escribir cualquier Server Action nueva, hay que poner las dos.** El rol
> contesta *"¿puede editar?"*, no *"¿puede editar **esto**?"*. Todo lo exportado
> desde un archivo `"use server"` es un endpoint que el navegador puede llamar
> directo con el id que sea: sin la segunda capa, un USUARIO de una ciudad puede
> escribir en otra. Las páginas usan `assertCityAccess(user, citySlug)` porque
> conocen el slug por la URL; las acciones no, por eso son helpers aparte.

Ojo con `requireEditor()` en código que corre **al renderizar una página**:
**lanza** para un LECTOR y rompe la página entera. Para barridos automáticos por
tiempo va `requireUser()` + acceso a la ciudad, sin exigir rol de editor.

Otros puntos: borrar registros pide la contraseña del admin
(`lib/reauth.ts`) y queda en la bitácora de auditoría (`lib/activity-log.ts`,
solo acepta `"ELIMINAR"` o `"EDITAR"`). Las subidas se validan por lista blanca
de MIME y se sirven con `nosniff`. La cookie va **sin `secure`** a propósito
porque el sistema se sirve por HTTP en la red local; se activa con
`COOKIE_SECURE=true` el día que haya HTTPS.

## Convenciones de trabajo

- **Migraciones en Windows:** `npx prisma migrate dev --name <nombre>` funciona
  para agregar columnas. Para cambios destructivos o de llaves foráneas hay que
  parar el servidor (`preview_stop`), escribir el `migration.sql` a mano con el
  patrón de SQLite (`PRAGMA defer_foreign_keys` + crear tabla nueva + copiar +
  renombrar), correr `migrate deploy` y `generate`.
- **Verificar contra datos reales**: el navegador integrado se cae con
  frecuencia; lo confiable es un script `scripts/_test-*.mts` que importe de
  `../lib/*` y llame las mismas consultas, correrlo con `npx tsx`, y borrarlo.
- **Antes de dar algo por terminado**: `npx tsc --noEmit` y `npm run build`.
- **Listas extensibles** (checklists, catálogo de piezas, campos de ficha): el
  patrón es lista fija en el código + tabla de "extras" que el ADMIN agrega,
  unidas por una función `*-runtime.ts`. Nunca leer la constante directo.
- **Commits**: mensaje en español, en presente, explicando el *porqué*.

## Excel que descarga el sistema

`lib/excel-formato.ts` (con `xlsx-js-style`, porque `xlsx` no escribe colores)
copia el formato del Excel del equipo: encabezado con un color por grupo de
columnas, filas alternadas, bordes gris claro y **el nombre de una unidad dada
de baja en naranja (FAC090)**. Toda hoja nueva debe pasar por `hojaConFormato`.

## Documentos de pruebas

`/ciudades/[citySlug]/documentos-de-pruebas` junta todos los documentos subidos
en los registros de las unidades (`lib/test-documents.ts`) y los baja en un ZIP
(`app/api/ciudades/[citySlug]/documentos-zip`, ZIP propio sin dependencias en
`lib/zip.ts`). El endpoint vuelve a filtrar los ids por ciudad: llegan del
navegador.

## Mantenimiento: ingeniería de gas, no mecánica

A petición del usuario, el mantenimiento de **todas** las unidades es del
sistema de gas: se quitaron por completo las categorías mecánicas (motor,
frenos, transmisión... ver `CATEGORIAS_MECANICAS_RETIRADAS` en
`lib/piece-catalog.ts`) y el checklist preventivo de auto. Los registros viejos
se siguen viendo igual (la categoría es texto en cada registro).

- Categorías de pieza por tipo de unidad (`getPieceCategories`): tanque de
  carga en Auto-Tanques y Semirremolques, plataforma de cilindros en Reparto,
  kit de carburación, y "Seguridad e identificación" en todas.
- Un checklist preventivo de gas por tipo (`CHECKLIST_LISTAS`,
  `checklistListaDeApartado` en `lib/preventive-checklist.ts`). Estados: los
  ítems "solo fugas" (Buen estado / Con fugas) y el resto (Buen estado /
  Reparación / Sustitución). "Relleno/Lubricación/Cambio" siguen en el schema
  solo para leer mantenimientos viejos.
- "Válvulas del tanque de carga" NO se llama "Válvulas" a propósito: ese
  nombre es el de carburación y dispara `lib/valve-piece-sync.ts`.

## Carga de documentos escaneados

`/ciudades/[citySlug]/carga-de-documentos`: se sube un PDF con varios
documentos escaneados juntos (pruebas, inspecciones, mantenimientos, pólizas)
y cada uno termina en la bitácora de su unidad con **solo sus páginas**
(`pdf-lib`). El escaneo original se conserva en
`uploads/lotes-documentos/{loteId}/` (tabla `LoteDocumentos`; la lista de
documentos del lote es un JSON validado con `itemLoteSchema`).

- **Guardar reutiliza las acciones de siempre** (`createUltrasoundLog`,
  `createMaintenanceLog`, `uploadVehicleDocument`...) armándoles el mismo
  FormData que su formulario: validación, acceso a la ciudad, fechas próximas
  y ficha técnica salen de ahí. No duplicar esa lógica en
  `actions/lote-documentos-actions.ts`. Válvulas no entra (flujo propio).
- **Nada se guarda sin revisión humana**: lo detectado es una propuesta.
- Formas de armar la lista: varios rangos de un jalón ("1 a 3 → PH10, 4 a 6 →
  PH9", `agregarDocumentosALote`), o **varios PDF a la vez**: se unen en un
  solo escaneo y queda un documento por archivo, con la unidad adivinada por
  el nombre del archivo (`adivinarUnidadPorNombre`: compara palabras, nunca
  subcadenas, y si hay duda no elige).
- **Borrar**: un documento pendiente se quita de la lista; uno ya guardado se
  borra desde la página de la unidad (con contraseña, como siempre). El lote
  completo solo se elimina, con contraseña y auditoría, si nada de él se
  guardó: si no, el escaneo es la evidencia.
- **La lectura con IA es opcional y de paga** (`lib/lector-documentos-ia.ts`,
  API de Claude). Solo se activa con `ANTHROPIC_API_KEY` en el `.env` del
  servidor; **sin clave el lote se divide a mano** (sin costo), que es como
  se usa hoy: el usuario no quiere pagar la API.

## Importaciones que se corren en el SERVIDOR

Esta laptop es desarrollo (ver `DESPLIEGUE.md`). Las importaciones son scripts
repetibles en `scripts/` (sin `_`), con simulación por defecto y `--apply` para
guardar; solo llenan campos vacíos, y lo que no existe en la base lo **dan de
alta** en vez de ignorarlo:

- `importar-valvulas-flotilla.mts "<Flotilla Pagasa - Unidades_1.xlsx>"`
- `crear-transportadora-kino.mts "<carpeta TRANSPORTADORA KINO>"`

## Estado y pendientes

- **Bloqueado:** importar los **4 tanques y 2 compresores de la Planta de
  Hermosillo** desde un documento de Word. Falta la ruta del archivo; se buscó
  en las carpetas de Pagasa accesibles y no aparece.
- **Por llegar:** el desglose del checklist de mantenimiento **por área** de
  planta. La base hoy es "Limpieza" e "Inspección de equipos" para las 15 áreas;
  ya está hecho para recibir ítems por área sin tocar código
  (`lib/plant-area-checklist-runtime.ts` + tabla `PlantAreaChecklistItem`).
- **En la lista, sin empezar:** chat entre usuarios con avisos, y notificaciones
  del navegador para las alertas.
