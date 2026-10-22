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

**Transportadora Kino solo lleva dos apartados**: "Unidad de distribución"
(Tractocamiones y Semirremolques) y "Bitácoras de unidades" (`PLANTILLA_KINO`
en `lib/city-template.ts`; `plantillaDeCiudad(slug)` la elige, y
`crearApartadosEstandar` y `crear-transportadora-kino.mts` la respetan). Nada
de planta, estaciones, equipos, inventarios, órdenes ni manuales. Para limpiar
una base que ya tenía los apartados de más: `limpiar-transportadora-kino.mts`
(simula; `--apply` borra), que **solo borra apartados vacíos** y reporta los que
tienen datos sin tocarlos (el historial no se borra).

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
   **Vida de las válvulas: 5 años desde la fabricación de la más antigua, salvo
   Auto-Tanques y Semirremolques que es de 10** (`aniosVigenciaValvulas(slug)`
   en `lib/valve-alerts.ts`, un solo lugar). Todo cálculo de vencimiento de
   válvulas de unidad debe pasar los años: sin el argumento asume 5.
   Fuente (cotejada con los PDF del DOF, 21-oct-2026): **Auto-Tanques**,
   NOM-EM-009-ASEA-2026 (distribución), 6.3.2 y Tabla 4 (7.2.2.5.1); **Semirremolques**,
   NOM-EM-008-ASEA-2026 (transporte), Tabla 3 (7.4.5.1), ambas vigentes
   desde el 6-oct-2026 por 6 meses: relevo de presión, exceso de
   flujo, no retroceso y llenado, menos de 10 años desde fabricación (o menos
   si lo indica el fabricante). **La norma fija 10 años solo a esas 4 válvulas;
   el alerta lo aplica a todo el juego del tanque de carga.** Carburación: 5
   años (NOM-005-SESH-2010, 9.6.4, confirmado). **Manguera de trasiego** (la
   "manguera de surtir" de la ficha del tanque de carga): 5 años desde
   fabricación según la NOM-EM-009 (Tabla 4, inciso t, solo Auto-Tanques; la
   NOM-EM-008 no la fija para Semirremolques) y el sistema alerta en ambos (`mangueraParaAlerta`
   en `lib/hose-alerts.ts`); la de carburación sigue en 2 años.
   **En pantalla, el panel de alertas de válvulas de unidad va en cuadros
   separados** por tipo de tanque (Auto-Tanques y Semirremolques / Vehículo con
   tanque de carburación / otras; `grupoValvulasDeApartado`), cada uno con su
   plazo en el título. Se parte dentro de `ValveAlertsPanel`, no en las páginas.
   **Manómetro de presión** (menos de 10 años, EM-009 Tabla 4 h / EM-008
   Tabla 3): va como un elemento más de `VALVULAS_TANQUE_CARGA` y entra a la
   misma alerta que las válvulas (mismo plazo). **Conector flexible** (5 años,
   máx. 1 m): campo `fechaFabricacionConectorFlexible`, alerta junto con las
   mangueras (`conectorParaAlerta`, cada elemento con su propia fila y
   `elemento` para distinguirlos). **Dictámenes anuales**: ver su sección.
   **Pendiente, sin alerta todavía**: acoplamiento de desconexión seca (10 años,
   solo Auto-Tanques que cargan en zonas metropolitanas). Válvula interna: sin
   plazo fijo (se guarda, no entra a la alerta).
   **Manguera de trasiego: solo Auto-Tanques** (la EM-008 no la fija para
   Semirremolques, que ya no alertan por ella).
2. **Estaciones de carburación** (`StationTankTechnicalSheet`,
   `lib/station-valves.ts`) — 7 válvulas, solo fecha de fabricación de cada una,
   y **una sola alerta combinada**: NOM-003-SEDG-2004, transitorio Cuarto
   (cotejado con el DOF): no más de **5 años de instaladas ni más de 7 desde la
   fabricación**; vence lo que ocurra primero
   (`getStationValveVencimiento`: más antigua del juego, instalación del juego
   `fechaInstalacionValvulas`). Sin fecha de instalación se cuentan 5 años desde
   la fabricación, para no avisar tarde. Son dos plazos editables
   (`valvulasEstacion` = 5, `valvulasEstacionFabricacion` = 7).
3. **Planta** (mismas columnas de `StationTankTechnicalSheet`,
   `lib/planta-tank-instruments.ts`) — 5 instrumentos (máximo llenado, manómetro,
   termómetro, exceso de flujo/no retroceso, relevo de presión), cada uno con
   **3 fechas** (fabricación / cambio / instalación) y **alerta propia por
   separado**, contada desde el cambio o, si nunca se cambió, desde la
   fabricación. NOM-018-ASEA-2023: exceso de flujo/no retroceso y relevo de
   presión a **10 años** (7.2.17.1 XII; `instrumentosPlantaValvulas`); máximo
   llenado, manómetro y termómetro según la vida útil del fabricante (7.2.17.4
   VII), sin número en la norma: el sistema usa **10 años como tope**
   (`instrumentosPlanta`, editable).

Una estación puede tener 2 tanques físicos: `stationTankTechnicalSheets` es 1:N
con `etiqueta` ("Tanque 1", "Tanque 2") y único por `[vehicleRecordId, etiqueta]`.

## Plazos normativos editables y fundamento en las alertas

Los plazos en años de las alertas (válvulas de tanque de carga y de
carburación, válvulas de estación, instrumentos de planta, manguera de
trasiego y de carburación) **ya no son constantes sueltas**: el ADMIN los
cambia en `/admin/normas` ("Normas y plazos") y ahí mismo edita norma, numeral
y cita de cada requisito.

- **Catálogo**: `lib/requisitos-normativos.ts` (valor base en código, con
  `verificado`; lo que viene de la tabla del área de normatividad y no se ha
  cotejado con el DOF sale como "Pendiente de cotejar") + tabla
  `RequisitoNormativoAjuste` (solo guarda **diferencias** contra el base; si
  se vuelve igual al base, se borra la fila). Unidos por
  `lib/requisitos-runtime.ts` (`getRequisitos`). Nunca leer
  `REQUISITOS_BASE` directo para mostrar.
- **Los plazos viven en `lib/plazos.ts`**, sin Prisma, en un registro en
  `globalThis` (`plazosActivos()` / `fijarPlazos()`). Las funciones de alerta
  son síncronas y se llaman desde servidor y navegador, por eso no reciben el
  plazo por argumento. Se cargan al arrancar (`instrumentation.ts`), al guardar
  en el admin (`cargarPlazos()`) y con `asegurarPlazos()` (refresca cada 60 s)
  al inicio de todo código que calcule alertas en servidor. **Si agregas un
  cálculo de alertas nuevo en el servidor, llama `await asegurarPlazos()`.** Los
  formularios de navegador que calculan su aviso reciben `plazos` por props y
  llaman `fijarPlazos(plazos)`.
- **Cada requisito cita la norma vigente, con texto corto** (el usuario lo
  pidió así: nada de "antes decía... en la norma anterior"). `NORMAS_VIGENTES`
  (mismo archivo) lista qué norma rige cada área y se ve arriba en
  `/admin/normas`. **Cotejado el 21-oct-2026 contra los PDF del DOF** que pasó el
  usuario: transporte (Semirremolques, Kino) **NOM-EM-008-ASEA-2026**;
  distribución (Auto-Tanques) **NOM-EM-009-ASEA-2026** — OJO: la "Tabla 4" y
  los numerales 7.2.2.x que traía la tabla original son de la EM-009, no de la
  EM-008 (esta solo tiene Tablas 1 a 3); plantas **NOM-018-ASEA-2023**;
  carburación de vehículos **NOM-005-SESH-2010** (9.6.x y 13). Un requisito
  puede citar dos normas cuando cada una rige un tipo de unidad. Estaciones de
  carburación: **NOM-003-SEDG-2004** (cotejada; ver arriba), aunque la
  NOM-012-ASEA-2021 se menciona como su sustituta y solo se confirmó su
  proyecto: **falta confirmar cuál rige hoy**. **Instrumentos de planta**: la NOM-018 (7.2.17.4 VII) los manda reemplazar
  según la vida útil del fabricante y 7.2.17.1 XII fija 10 años a exceso de
  flujo/no retroceso/relevo; los 5 años del sistema son criterio interno.
  **Diferencia conocida**: la prueba hidrostática la norma la pide cada 10
  años y el sistema agenda la siguiente a 5 (`addFiveYears`).
- **Requisitos "solo referencia"** (conectores flexibles, acoplamiento seco,
  calibración, dictamen de instalación...) están en el catálogo sin plazo
  editable porque todavía no tienen campo ni alerta.
- **Fundamento en pantalla**: `components/normas/FundamentoNormativo.tsx`
  (server component) pinta la cita con letra serif cursiva y borde lateral, a
  propósito distinta del texto del sistema para que no se revuelva. Está en los
  paneles de alertas de válvulas, mangueras, estación y planta, y en la ficha
  de la unidad (el ADMIN ve el formulario, por eso se le pasa como slot).
- Guardar y restablecer son **dos formularios hermanos**: HTML no permite
  `<form>` anidados y el botón de restablecer no hacía nada.

## Calendario de vencimientos

`/ciudades/[citySlug]/calendario` (botón en la portada de cada ciudad; en
Administración junta todas las ciudades, con filtro por ciudad): resumen
(vencidos / 7 / 30 / 90 días), lista de vencidos, cuadrícula del mes y lista
del mes, filtro por tipo, y descarga `.ics` (`/api/ciudades/[citySlug]/calendario`,
eventos de día completo con aviso 7 días antes, solo los de hace menos de 90
días en adelante).

- **`lib/vencimientos.ts` → `getVencimientos(cityIds)`** devuelve TODOS los
  vencimientos con fecha en una lista plana, sin el recorte de 30 días de las
  alertas. Es la base del calendario y de los reportes por correo. Usa las
  mismas fechas, plazos del catálogo y `isAlertVisibleForSection` que
  `getAllVehicleAlerts`; se comprobó que el conteo rojo/amarillo de cada tipo
  cuadra con los paneles de Inicio. **Si agregas un tipo de alerta con fecha,
  agrégalo también aquí** (es el quinto lugar de la lista de arriba).
- El extintor no entra: su alerta es por estado (calidad mala), no por fecha.
- Navegación: botones de mes, selector de mes y año (`SelectorMes`, cambia de
  página al elegir y conserva los filtros) y panorama del año con los
  vencimientos de cada mes (clic para saltar a él).
- Las fechas se guardan a medianoche UTC: el día de calendario se lee con
  `getUTC*` (`diaISO`).

## Reporte semanal de vencimientos por correo

`/admin/reportes` (pestaña "Reportes por correo", solo ADMIN): destinatarios,
día y hora, cuántos días hacia adelante incluir (los vencidos siempre), cuenta
SMTP y "Dirección del sistema". Tablas `ConfiguracionReportes` (una fila, id
`unico`) y `AjusteSistema` (clave/valor; hoy solo `urlBase`, que también usarán
los códigos QR).

- **Contenido**: `getVencimientos` (lib/vencimientos.ts) de todas las ciudades
  reales → `armarReporte` (lib/reporte-vencimientos.ts, función pura; HTML con
  estilos en línea + texto plano) agrupado por ciudad; cada unidad es enlace si
  hay `urlBase`.
- **Envío**: `nodemailer`, en `lib/reportes-programados.ts`. `scheduleReportes()`
  se arranca en `instrumentation.ts` y revisa cada 5 min (la primera a los 60 s)
  con `debeEnviarse`: ya pasó el día/hora de esta semana, no se mandó, y
  **solo dentro de las 24 h siguientes** (si el servidor estuvo apagado no manda
  un reporte viejo); si falla, reintenta a la hora. Solo el envío *automático*
  anota `ultimoIntento`/`ultimoEnvio`; "Enviar ahora" es prueba y no mueve el de
  la semana. Hora = la del servidor.
- **Contraseña SMTP**: se guarda cifrada (AES-256-GCM, llave derivada de
  `SESSION_SECRET`, `lib/secretos.ts`); nunca vuelve al navegador (vacío al
  guardar = conservar) y no sale en la bitácora. **Si cambia `SESSION_SECRET`,
  hay que volver a capturarla** (el panel lo avisa). Sin servidor en el panel se
  usan `SMTP_HOST/PORT/SECURE/USER/PASS/FROM` del `.env`.
- Con puerto 587 (sin "conexión cifrada") se exige STARTTLS cuando hay
  usuario: no manda la contraseña en claro. Gmail: contraseña de aplicación
  (requiere verificación en 2 pasos). El servidor del sistema necesita salida a
  internet.
- Para probar sin correo real: servidor SMTP falso con `smtp-server` en la
  carpeta temporal y `NODE_TLS_REJECT_UNAUTHORIZED=0` solo en el proceso de
  prueba.

## Códigos QR por unidad

`/ciudades/[citySlug]/etiquetas-qr` (botón "Etiquetas QR" en la portada de la
ciudad y "Etiqueta QR" en la ficha de cada unidad, `?unidad=<id>`; filtro
`?apartado=<slug>`): etiquetas de 6.2 cm para imprimir (el resto de la página
se oculta al imprimir) con el QR, el número económico/nombre y el apartado.
Cubre todo `VehicleRecord` activo: unidades, estaciones y planta. Los QR son
SVG generados en el servidor con `qrcode`.

- El QR apunta a `{urlBase}/ciudades/{citySlug}/vehiculo/{id}`. **`urlBase` es
  la "Dirección del sistema"** que el ADMIN captura en `/admin/reportes`
  (tabla `AjusteSistema`); sin ella se usa la del navegador y, si es
  `localhost`, la página avisa que un celular no la puede abrir. Como el
  sistema corre en la red local por HTTP, **si cambia la IP del servidor hay que
  reimprimir las etiquetas** (conviene fijarla o usar un nombre de equipo).
- Escanear sin sesión: el middleware manda a `/login?from=<ruta>` y ahora el
  login **sí regresa ahí** (`lib/ruta-segura.ts`: solo rutas internas; se
  ignoran `//dominio`, `https://`, `/api` y `/login`). Antes `from` se ignoraba
  y siempre caía en Inicio.

## Espacio en disco y visor de PDF

- **`/admin/respaldos` muestra cuánto pesa el sistema en vivo**
  (`lib/almacenamiento.ts`): base (la de `DATABASE_URL`), `uploads/`, `backups/`
  y espacio libre del disco (`fs.statfs`), con aviso si queda poco. Recuerda
  que los respaldos viven **en el mismo equipo**: la tarjeta recomienda copiar
  `uploads/` y `prisma\dev.db` a un disco externo (los respaldos locales no
  hace falta copiarlos).
- **pdfjs-dist 6 necesita `Map.prototype.getOrInsertComputed`**, que los
  navegadores traen desde Chrome/Edge 145. En uno más viejo el visor de PDF, la
  impresión de adjuntos de la hoja de la unidad y la carga de escaneos
  fallaban ("No se pudieron preparar estos archivos"). `lib/pdfjs-compat.js`
  lo polifillea: lo importan los tres componentes que usan pdfjs
  (`import "@/lib/pdfjs-compat"`) y `scripts/copy-pdf-worker.mjs` lo antepone a
  `public/pdf.worker.min.mjs` (el worker es otro contexto). Si agregas otro
  componente con pdfjs, importa también el compat. Se probó con Chromium 141
  (sin ese método): la hoja de la unidad impresa a PDF trae todas las páginas
  de cada adjunto.

## Tablero de cumplimiento

`/ciudades/[citySlug]/tablero` (botón en la portada de la ciudad; en
Administración agrega "por ciudad"): porcentaje de unidades al corriente,
estado por ciudad y por apartado (barras apiladas), vencidos y próximos por
tipo, lo que vence en 6 meses y las unidades que requieren atención.

- Sale de `getVencimientos` (`lib/tablero.ts`, `armarTablero` es pura y se
  prueba con datos inventados). **Estado de una unidad = el peor de sus
  vencimientos**: vencido / ≤7 días / 8–30 días / al corriente / sin fechas.
  **% al corriente = al corriente ÷ unidades con alguna fecha**: las que no
  tienen ninguna fecha capturada se cuentan aparte (no se puede saber), para
  que un dato faltante no se disfrace de cumplimiento.
- Es distinto del panel de checklist de normatividad
  (`ComplianceOverviewPanel`, promedio por ámbito): ese mide el checklist, este
  mide vencimientos.

## Dictámenes anuales

Cuatro fechas de **emisión** en `VehicleTechnicalSheet`; el vencimiento es
emisión + 1 año (`lib/dictamen-alerts.ts`, que también dice a qué apartado
aplica cada una): `fechaDictamenOperacion` (Auto-Tanques EM-009 7.4.1;
Semirremolques y Tractocamiones EM-008 7.7.5), `fechaDictamenNom068`
(Semirremolques y Tractocamiones, EM-008 7.5.3), `fechaDictamenInstalacion`
(Vehículo con tanque de carburación, NOM-005-SESH-2010 numeral 13),
`fechaDictamenEstacion` (estaciones, NOM-003-SEDG-2004 art. 5). Se capturan en la
sección "Dictámenes" de la ficha (solo salen los que le tocan al apartado), el PDF
va como documento de la unidad. Alerta propia (`dictamenAlertVehicles`,
`DictamenAlertsPanel`), también en calendario (tipo `dictamen`), tablero,
reporte por correo, semáforo y Excel. No hay historial de dictámenes: es la
fecha del último (los anteriores quedan como documentos).

## Sistema de alertas

**`lib/vehicle-alerts-summary.ts` → `getAllVehicleAlerts(cityIds)` es la única
fuente.** Alimenta las tres pantallas: Inicio (`/dashboard`), la portada de cada
ciudad y `/admin/alertas`. Devuelve un arreglo por tipo (ultrasonido, visual
externa, hermeticidad, visual interna, hidrostática, extintor, mantenimiento,
válvulas de unidad, mangueras y conectores, dictámenes, válvulas de estación,
instrumentos de planta, póliza).

Al agregar un tipo de alerta hay que tocar **cuatro** lugares (cinco si tiene fecha, ver `getVencimientos`) o queda a medias:
`getAllVehicleAlerts`, su panel en `components/dashboard/`, las tres páginas que
lo pintan, y `countValveRedAlerts` (`lib/login-alerts.ts`) si cuenta para el
aviso rojo al iniciar sesión.

`getAllVehicleAlerts` devuelve cada lista **junta por ciudad** (orden de las
ciudades del menú lateral = `City.order`, y dentro de cada una por fecha de
vencimiento), sin separadores: así se lee igual en Inicio, en la portada de la
ciudad y en `/admin/alertas`. El usuario pidió explícitamente NO separarlas con
encabezados. Una lista de alertas nueva debe pasar por `porCiudad` al final de
esa función.

Umbrales: **rojo** ≤ 7 días, **amarillo** ≤ 30 días.

**Ciclo de revisión de tanques:** la primera vence a los **10 años** de la fecha
de fabricación (se calcula al dar de alta el tanque); de ahí en adelante, cada
revisión registrada agenda la siguiente **5 años** después (`addFiveYears` en
`internal-visual-inspection-actions.ts`). Aplica a Planta y a Estaciones. **La
prueba hidrostática del tanque de carga (Auto-Tanques y Semirremolques) se
repite cada 10 años** (EM-009 Tabla 3 / EM-008 Tabla 2): `aniosCicloHidrostatica`
en `hydrostatic-test-actions.ts`; Planta, Estaciones y carburación siguen en 5.

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

**Sesión (lo que el usuario pidió: "al cerrar debe pedir login desde cero" y
"cerrar a los 20 min de inactividad")**:

- La cookie `pagasa_session` es **de sesión** (sin `maxAge`): el navegador la
  tira al cerrarse. Dentro lleva `sesionId`, `iniciadaEl` y `ultimaActividad`
  (firmadas). Reglas en `lib/sesion-vigencia.ts`: **20 min sin actividad** y
  **tope de 12 h** desde que inició.
- **Dos capas de vigencia**: el middleware (edge, solo cookie) corta por
  inactividad/tope y renueva `ultimaActividad` cada ≥30 s; `getSession()`
  (`lib/auth.ts`, `leerSesion`) repite la revisión y además confirma que la
  fila **`SesionActiva`** siga existiendo. Si no es vigente le quita el
  `userId` en memoria, así que todo código que revisa `session.userId` la trata
  como sin sesión. **No leas la cookie con `getIronSession` directo en código
  nuevo; usa `getSession()`/`requireUser()`.**
- **`SesionActiva`** (una fila por inicio de sesión) es lo que hace que cerrar
  sesión de verdad invalide copias de la cookie: `/api/logout` y
  `/sesion-invalida` borran la fila; cambiar la contraseña de una cuenta cierra
  sus otras sesiones; eliminar la cuenta las borra en cascada; el login limpia
  las de más de 12 h. Cookies del formato anterior (sin `sesionId`) ya no
  valen: tras actualizar todos vuelven a entrar una vez.
- `/sesion-invalida?motivo=inactividad|expirada|cuenta-eliminada` borra la
  cookie y manda a `/login?motivo=...` (el login muestra el aviso).
- **`InactividadGuard`** (en el layout protegido): avisa 3 min antes, cierra a
  los 20, comparte la última actividad entre pestañas (localStorage) y manda un
  latido a `/api/sesion/ping` cada ≥60 s mientras la persona usa la pantalla,
  para que escribir un formulario largo no deje vencer la sesión.
- Las páginas protegidas salen con `Cache-Control: no-store` (el botón "atrás"
  tras cerrar sesión no muestra pantallas) y `next.config.mjs` agrega
  `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` y quita
  `X-Powered-By`; HSTS solo con `COOKIE_SECURE=true`.
- **Límites que conviene decir**: el sistema va por HTTP en la red local, así
  que usuario y contraseña viajan sin cifrar hasta que haya HTTPS (entonces
  `COOKIE_SECURE=true`). Y la opción "continuar donde lo dejé" de algunos
  navegadores restaura las cookies de sesión; el tope de 20 min / 12 h sigue
  aplicando, pero antes de eso la sesión puede reaparecer.

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

## Dar de baja = fuera de servicio

Dar de baja una unidad (`setVehicleActive`) la deja **sola en estatus
`FUERA_DE_SERVICIO`** (el estatus operativo, distinto de `activo`); también a
su pareja Auto-Tanque/carburación. Reactivarla recalcula: En taller si tiene
mantenimientos sin terminar, si no Operativa. Una unidad de baja no sale de
fuera de servicio a mano (`setVehicleEstatus` lo rechaza, el selector del
listado se vuelve una etiqueta), el recálculo por mantenimientos no la toca, no
cuenta en alertas, calendario, tablero ni avisos de mantenimientos en proceso, y
`estatusEfectivo(activo, estatus)` (lib/vehicle-enums.ts) cubre cualquier
registro viejo. La migración `20261022000000_baja_deja_fuera_de_servicio`
alinea las bajas ya existentes. Los mantenimientos abiertos de una unidad dada
de baja NO se cierran: son historial.

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

## Actual vs. historial (documentos y hoja de la unidad)

Nada se reemplaza ni se borra: una prueba, extintor, manguera, cambio de
válvulas o póliza nuevos son un registro nuevo y el anterior queda como
historial. **"Actual" se calcula, no se guarda** (`lib/vigencia.ts`): el
registro más reciente de cada tipo, por unidad y por tanque. Mantenimientos,
correctivos de válvulas y documentos sueltos de la unidad son eventos y
siempre cuentan como actuales (`TIPOS_QUE_SE_REEMPLAZAN`).
Se usa en tres lugares: el listado de "Documentos de pruebas" (filtro
Actuales / Antiguos / Todos; en el ZIP los antiguos van en `Anteriores/`) y la
hoja `/imprimir` de la unidad (`?historial=todo|actual`).

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
- `importar-mangueras-surtir.mts` — fecha de fabricación de la manguera de
  surtir de 15 unidades "Kg" (lista del área de normatividad, oct-2026, en
  mes/día/año; el usuario confirmó que son fechas de **fabricación**). No da de
  alta unidades: reporta las que no encuentra, las ambiguas y las que ya tienen
  otra fecha; con `--sobrescribir` reemplaza esas (el Excel de flotilla solo
  traía el año, guardado como 1 de enero). `importar-valvulas-flotilla.mts`
  ahora también lee fecha completa ("5 jul 2023") en la columna de manguera
  de surtir, además del año suelto.

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
