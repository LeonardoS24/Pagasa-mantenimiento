import { getSession } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { resolveSectionPath } from "@/lib/section-path";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/roles";
import { hasActiveElevatedAccess } from "@/lib/elevated-access";
import { Breadcrumb, type BreadcrumbItem } from "@/components/layout/Breadcrumb";
import { SectionCard } from "@/components/city/SectionCard";
import { SectionIcon } from "@/components/layout/SectionIcon";
import { VehicleTable } from "@/components/city/VehicleTable";
import { DocumentList } from "@/components/city/DocumentList";
import { UploadDocumentForm } from "@/components/admin/UploadDocumentForm";
import { CreateVehicleForm } from "@/components/admin/CreateVehicleForm";
import { CityMaintenanceFeed } from "@/components/city/CityMaintenanceFeed";
import { getCityUnitLogFeed } from "@/lib/city-unit-log-feed";
import { CityOrderFeed } from "@/components/city/CityOrderFeed";
import { getCityOrderLogFeed } from "@/lib/city-order-log-feed";
import { CreatePieceOrderForm } from "@/components/admin/CreatePieceOrderForm";
import { PieceOrderTable } from "@/components/city/PieceOrderTable";
import { InventoryItemTable } from "@/components/city/InventoryItemTable";
import { sweepExpiredPorUtilizar } from "@/actions/inventory-actions";
import { CreateEquipoForm } from "@/components/admin/CreateEquipoForm";
import { EquipoTable } from "@/components/city/EquipoTable";
import { getCityEquipmentLogFeed } from "@/lib/city-equipment-log-feed";
import { CityEquipmentLogFeed } from "@/components/city/CityEquipmentLogFeed";
import { getPieceMaintenanceStats } from "@/lib/piece-maintenance-stats";
import { PieceMaintenanceChart } from "@/components/city/PieceMaintenanceChart";
import { getPieceMaintenanceStatsByMarca } from "@/lib/piece-maintenance-by-marca";
import { MarcaMaintenanceCharts } from "@/components/city/MarcaMaintenanceCharts";
import { isAggregateCitySlug, getAllRealCityIds } from "@/lib/aggregate-city";
import { InventoryAggregateTable } from "@/components/city/InventoryAggregateTable";
import { getCityInventoryFeed } from "@/lib/city-inventory-feed";
import { getAllRecordTypeStats } from "@/lib/record-count-stats";
import { RecordCountByCityChart } from "@/components/city/RecordCountByCityChart";
import { RecordTypeComparisonSection } from "@/components/city/RecordTypeComparisonSection";
import {
  getAggregateVehicleRecords,
  getAggregateEquipos,
  getHighCriticidadEquipos,
  getVehiclesInMaintenance,
} from "@/lib/aggregate-listings";
import { VehiclesInMaintenancePanel } from "@/components/city/VehiclesInMaintenancePanel";
import { AggregateVehicleTable } from "@/components/city/AggregateVehicleTable";
import { PlantaCardGrid, type PlantaCardData } from "@/components/city/PlantaCardGrid";
import { getVehicleSemaforoLevel } from "@/lib/vehicle-semaforo";
import { ESTACION_LIKE_SECTION_SLUGS } from "@/lib/estacion-sections";
import { AggregateEquipoTable } from "@/components/city/AggregateEquipoTable";
import { HighCriticidadEquiposPanel } from "@/components/city/HighCriticidadEquiposPanel";
import { getPieceOrderStatsByCity, getPieceOrderStatusStatsByCity } from "@/lib/piece-order-stats";
import { PieceOrderStatsChart } from "@/components/city/PieceOrderStatsChart";
import { PieceOrderStatusChart } from "@/components/city/PieceOrderStatusChart";
import { sweepExpiredAcceptedOrders } from "@/actions/piece-order-actions";
import { getMaintenanceTypeStats } from "@/lib/maintenance-type-stats";
import { MaintenanceTypePieChart } from "@/components/city/MaintenanceTypePieChart";
import { getEquipmentMaintenanceTypeStats } from "@/lib/equipment-maintenance-type-stats";
import { EquipmentMaintenanceTypePieChart } from "@/components/city/EquipmentMaintenanceTypePieChart";
import {
  getCurrentMonthRange,
  currentMonthLabel,
  parseMesParam,
  mesSelectionRange,
  mesSelectionLabel,
  mesSelectionParamValue,
  listRecentMonthsWithYearOption,
} from "@/lib/dates";
import { MonthPicker } from "@/components/city/MonthPicker";
import { ResumenPanel } from "@/components/admin/ResumenPanel";
import { getPieceCatalog, getCategoriasPorGrupo } from "@/lib/piece-catalog-runtime";

export default async function SectionPage({
  params,
  searchParams,
}: {
  params: { citySlug: string; sectionPath: string[] };
  searchParams: { mes?: string; tab?: string; ambito?: string };
}) {
  const session = await getSession();
  const user = { userId: session.userId!, username: session.username!, role: session.role! };
  // isAdmin también es true para un USUARIO con acceso ampliado activo en
  // este momento (ver lib/elevated-access.ts).
  const isAdmin =
    user.role === "ADMIN" || (user.role === "USUARIO" && (await hasActiveElevatedAccess(user.userId)));
  const isEditor = canEdit(user.role);

  await assertCityAccess(user, params.citySlug);
  const { city, chain, children } = await resolveSectionPath(params.citySlug, params.sectionPath);

  const current = chain[chain.length - 1];
  const isBitacoraFeed = chain.length === 1 && current.slug === "bitacoras-de-unidades";
  // Igual que Bitácora de unidades, pero acotada a Estaciones de
  // carburación y Planta (ver ESTACION_LIKE_SECTION_SLUGS abajo).
  const isBitacoraEstacionesFeed = chain.length === 1 && current.slug === "bitacora-de-estaciones";
  const isOrdenDePieza = chain.length === 1 && current.slug === "orden-de-pieza";
  const isInventarios = chain.length === 1 && current.slug === "inventarios";
  // "Equipos de planta" (ver scripts/restructure-planta-section.mjs) vive
  // anidado dentro de "Planta" (chain.length 2), a diferencia de como
  // vivía antes a nivel superior — el slug "equipos" no se usa en ningún
  // otro lado, así que basta con el slug sin fijarse en la profundidad.
  const isEquiposSection = current.slug === "equipos";
  const isBitacoraEquiposFeed = chain.length === 1 && current.slug === "bitacora-de-equipos";
  const isResumenSection = chain.length === 1 && current.slug === "resumen";
  // "Administración" (ver lib/aggregate-city.ts): su Bitácora de
  // unidades combina el feed y los gráficos de todas las ciudades reales.
  const isAggregateCity = isAggregateCitySlug(city.slug);
  // Los únicos apartados documentales donde, además de PDF/imagen, se
  // permite subir documentos de oficina (Word, Excel, etc.).
  const allowsOfficeDocs =
    chain.length === 1 &&
    (current.slug === "programa-de-mantenimiento" || current.slug === "manuales");

  // Cualquier apartado hoja directamente dentro de "Unidad de distribución"
  // (en cualquier ciudad) es un apartado de tipo unidades: muestra la tabla
  // de números económicos y el alta de nuevos, aunque todavía esté vacío.
  const isUnderUnidadDistribucion = chain.length >= 2 && chain[0].slug === "unidad-de-distribucion";
  // "Estaciones de carburación" es su propio apartado de nivel superior
  // (igual que "Unidad de distribución"), no un sub-apartado — pero se
  // comporta exactamente igual: tabla + alta de registros, ficha técnica del
  // tanque, etc. (ver scripts/move-estaciones-de-carburacion-top-level.mjs y
  // components/admin/VehicleForm.tsx: isEstacion).
  const isEstacionTopLevelSection = chain.length === 1 && current.slug === "estaciones-de-carburacion";
  // "Planta" (ver scripts/restructure-planta-section.mjs): su hijo
  // "planta-ficha-tecnica" se comporta igual que Estaciones de carburación
  // (ficha técnica de tanque + 5 registros + permisos), pero anidado un
  // nivel (dentro de "Planta") en vez de a nivel superior, y sin su propio
  // sub-listado de equipos — esos viven en el apartado hermano "Equipos de
  // planta" (ver isEquiposSection arriba).
  const isPlantaFichaTecnicaSection =
    chain.length === 2 && chain[0].slug === "planta" && current.slug === "planta-ficha-tecnica";
  const isVehicleSection =
    (children.length === 0 && !isBitacoraFeed && isUnderUnidadDistribucion) ||
    isEstacionTopLevelSection ||
    isPlantaFichaTecnicaSection;

  // Administración no tiene flota propia: en vez de la tabla de su propio
  // apartado (siempre vacío), "Unidad de distribución" ahí muestra todas las
  // unidades de todas las ciudades reales con ese mismo tipo de apartado
  // (p.ej. todas las Auto-Tanques), cada una diciendo de qué ciudad es (ver
  // lib/aggregate-listings.ts).
  const aggregateVehicleRecords =
    isVehicleSection && isAggregateCity ? await getAggregateVehicleRecords(current.slug) : [];

  // Las unidades dadas de baja se listan aparte, siempre al final: entre
  // ellas se ordenan por fecha de baja (más reciente primero) en vez del
  // orden manual usado para las unidades activas.
  const vehicleRecords = isVehicleSection && !isAggregateCity
    ? await (async () => {
        const [activeRecords, inactiveRecords] = await Promise.all([
          prisma.vehicleRecord.findMany({
            where: { sectionId: current.id, activo: true },
            orderBy: { order: "asc" },
            include: { technicalSheet: true, stationTankTechnicalSheet: true },
          }),
          prisma.vehicleRecord.findMany({
            where: { sectionId: current.id, activo: false },
            orderBy: { fechaBaja: "desc" },
            include: { technicalSheet: true, stationTankTechnicalSheet: true },
          }),
        ]);
        return [...activeRecords, ...inactiveRecords];
      })()
    : [];

  // Planta (ver isPlantaFichaTecnicaSection abajo): en vez de tabla, cada
  // planta se ve como su propio recuadro con nombre + listado (ver
  // components/city/PlantaCardGrid.tsx). Reusa vehicleRecords/
  // aggregateVehicleRecords ya cargados arriba, solo reempaca la forma.
  const plantaCards: PlantaCardData[] = !isPlantaFichaTecnicaSection
    ? []
    : isAggregateCity
    ? aggregateVehicleRecords.map((r) => ({
        id: r.id,
        numeroEconomico: r.numeroEconomico,
        permisionaria: r.permisionaria,
        permiso: r.permiso,
        sucursal: r.sucursal,
        activo: r.activo,
        motivoBaja: r.motivoBaja,
        semaforoLevel: r.semaforoLevel,
        citySlug: r.citySlug,
        cityName: r.cityName,
      }))
    : vehicleRecords.map((r) => ({
        id: r.id,
        numeroEconomico: r.numeroEconomico,
        permisionaria: r.permisionaria,
        permiso: r.permiso,
        sucursal: r.sucursal,
        activo: r.activo,
        motivoBaja: r.motivoBaja,
        semaforoLevel: r.activo
          ? getVehicleSemaforoLevel(r.technicalSheet, "planta-ficha-tecnica", r.stationTankTechnicalSheet)
          : "none",
        citySlug: city.slug,
      }));

  // Selector de mes (o de todo el año, ver lib/dates.ts: MesSelection): en
  // la Bitácora de unidades y en Orden de pieza de Administración (ver
  // lib/aggregate-city.ts). Las ciudades reales siguen mostrando "actividad
  // reciente" sin acotar por mes, como siempre.
  const selectedMes = parseMesParam(searchParams.mes);
  const selectedMonthRange = mesSelectionRange(selectedMes);
  const showMonthPicker = isBitacoraFeed && isAggregateCity;
  const showOrderMonthPicker = isOrdenDePieza && isAggregateCity;
  const showEstacionesMonthPicker = isBitacoraEstacionesFeed && isAggregateCity;

  const cityMaintenanceLogs = isBitacoraFeed
    ? await getCityUnitLogFeed(isAggregateCity ? null : city.id, showMonthPicker ? selectedMonthRange : undefined)
    : [];
  // Mismo rango que se le pasa a PieceMaintenanceChart (para el desglose al
  // hacer clic en una pieza, ver actions/piece-maintenance-actions.ts): sin
  // esto el desglose podría no coincidir con lo que muestra la barra.
  const pieceMaintenanceRange = showMonthPicker ? selectedMonthRange : getCurrentMonthRange();
  const pieceMaintenanceStats = isBitacoraFeed
    ? await getPieceMaintenanceStats(isAggregateCity ? null : city.id, 10, pieceMaintenanceRange)
    : [];
  const marcaMaintenanceStats = isBitacoraFeed
    ? await getPieceMaintenanceStatsByMarca(isAggregateCity ? null : city.id, pieceMaintenanceRange)
    : [];
  const recordTypeStats =
    isBitacoraFeed && isAggregateCity ? await getAllRecordTypeStats(selectedMonthRange) : [];
  const vehiclesInMaintenance =
    isBitacoraFeed && isAggregateCity ? await getVehiclesInMaintenance() : [];
  // Pastel Preventivo/Correctivo/Predictivo, mismo alcance y rango que
  // pieceMaintenanceStats (ver lib/maintenance-type-stats.ts).
  const maintenanceTypeStats = isBitacoraFeed
    ? await getMaintenanceTypeStats(isAggregateCity ? null : city.id, pieceMaintenanceRange)
    : [];
  const estacionesRange = showEstacionesMonthPicker ? selectedMonthRange : getCurrentMonthRange();
  const estacionesMaintenanceLogs = isBitacoraEstacionesFeed
    ? await getCityUnitLogFeed(
        isAggregateCity ? null : city.id,
        showEstacionesMonthPicker ? selectedMonthRange : undefined,
        ESTACION_LIKE_SECTION_SLUGS
      )
    : [];
  const estacionesPieceMaintenanceStats = isBitacoraEstacionesFeed
    ? await getPieceMaintenanceStats(
        isAggregateCity ? null : city.id,
        10,
        estacionesRange,
        undefined,
        ESTACION_LIKE_SECTION_SLUGS
      )
    : [];
  const estacionesMaintenanceTypeStats = isBitacoraEstacionesFeed
    ? await getMaintenanceTypeStats(
        isAggregateCity ? null : city.id,
        estacionesRange,
        undefined,
        ESTACION_LIKE_SECTION_SLUGS
      )
    : [];
  const cityEquipmentLogs = isBitacoraEquiposFeed
    ? await getCityEquipmentLogFeed(isAggregateCity ? null : city.id)
    : [];
  const highCriticidadEquipos =
    isBitacoraEquiposFeed && isAggregateCity ? await getHighCriticidadEquipos() : [];
  // Mismo rango que pieceMaintenanceRange (mes en curso, sin selector de mes
  // propio en Bitácora de equipos).
  const equipmentMaintenanceTypeStats = isBitacoraEquiposFeed
    ? await getEquipmentMaintenanceTypeStats(isAggregateCity ? null : city.id)
    : [];

  // Mismo combinado que aggregateVehicleRecords, para equipos.
  const aggregateEquipos = isEquiposSection && isAggregateCity ? await getAggregateEquipos() : [];

  // Los equipos dados de baja (reemplazados con un mantenimiento tipo
  // "Cambio", ver actions/equipment-log-actions.ts) se listan aparte, igual
  // que las unidades: siempre al final, ordenados por fecha de baja.
  // vehicleRecordId: null excluye los equipos propios de una Estación de
  // carburación en particular (ver Equipo.vehicleRecordId): esos se ven en
  // la propia unidad, no repetidos aquí en "Equipos de planta".
  const equipos = isEquiposSection && !isAggregateCity
    ? await (async () => {
        const [activos, inactivos] = await Promise.all([
          prisma.equipo.findMany({
            where: { sectionId: current.id, vehicleRecordId: null, activo: true },
            orderBy: { order: "asc" },
          }),
          prisma.equipo.findMany({
            where: { sectionId: current.id, vehicleRecordId: null, activo: false },
            orderBy: { fechaBaja: "desc" },
          }),
        ]);
        return [...activos, ...inactivos];
      })()
    : [];

  // Administración no levanta órdenes propias (no tiene flota ni inventario
  // propios): antes esta consulta corría sin importar la ciudad, así que un
  // admin parado en la vista combinada podía levantar una orden pegada a la
  // sección propia de Administración, invisible para siempre en la gráfica
  // de abajo (que solo suma ciudades reales). Ahora la tabla y el alta solo
  // aplican a una ciudad real (ver el JSX: CreatePieceOrderForm/PieceOrderTable
  // también quedaron condicionados a !isAggregateCity).
  if (isOrdenDePieza && !isAggregateCity) {
    await sweepExpiredAcceptedOrders(current.id);
  }
  // Catálogo con las piezas agregadas desde /admin/piezas, para el selector
  // del formulario de órdenes (ver lib/piece-catalog-runtime.ts).
  const pieceCatalog = isOrdenDePieza ? await getPieceCatalog() : undefined;
  const categoriasPorGrupo = isOrdenDePieza ? await getCategoriasPorGrupo() : undefined;
  const pieceOrders =
    isOrdenDePieza && !isAggregateCity
      ? await prisma.pieceOrder.findMany({
          where: { sectionId: current.id },
          orderBy: { fechaOrden: "desc" },
          include: {
            vehicleRecord: { select: { id: true, numeroEconomico: true } },
            sustituyeEquipo: { select: { id: true, nombre: true, codigo: true } },
          },
        })
      : [];
  // Equipos activos de la ciudad, para el checklist de "sustituye a un
  // equipo que ya existe" al levantar una orden tipo "Equipo" (ver
  // CreatePieceOrderForm). Incluye tanto los de "Equipos" a nivel ciudad
  // como los propios de cada estación (ver Equipo.vehicleRecordId).
  const cityEquipos = isOrdenDePieza && !isAggregateCity
    ? await prisma.equipo.findMany({
        where: { activo: true, section: { cityId: city.id } },
        orderBy: { nombre: "asc" },
        select: {
          id: true,
          nombre: true,
          codigo: true,
          vehicleRecord: { select: { numeroEconomico: true } },
        },
      })
    : [];
  // Rango seleccionado con el MonthPicker (o el mes en curso por defecto),
  // mismo patrón que pieceMaintenanceRange arriba: antes esto siempre era el
  // mes en curso y sin selector, así que una orden de un mes anterior
  // desaparecía de la gráfica en cuanto cambiaba el mes sin forma de volver a
  // verla — eso es lo que se reportó como "no toma todas las órdenes".
  const pieceOrderRange = showOrderMonthPicker ? selectedMonthRange : getCurrentMonthRange();
  const pieceOrderMonthLabel = showOrderMonthPicker ? mesSelectionLabel(selectedMes) : currentMonthLabel();
  // Gráficas de Administración sobre las órdenes que se realizan, por ciudad
  // (ver lib/piece-order-stats.ts); solo tienen sentido combinando ciudades.
  const pieceOrderStats =
    isOrdenDePieza && isAggregateCity ? await getPieceOrderStatsByCity(pieceOrderRange) : [];
  const pieceOrderStatusStats =
    isOrdenDePieza && isAggregateCity ? await getPieceOrderStatusStatsByCity(pieceOrderRange) : [];
  const orderLogFeed =
    isOrdenDePieza && isAggregateCity ? await getCityOrderLogFeed(null, pieceOrderRange) : [];

  if (isInventarios && !isAggregateCity) {
    await sweepExpiredPorUtilizar(current.id);
  }
  const inventoryItems = isInventarios && !isAggregateCity
    ? await prisma.inventoryItem.findMany({
        where: { sectionId: current.id },
        orderBy: { fechaIngreso: "desc" },
        include: {
          usedOnVehicle: { select: { id: true, numeroEconomico: true } },
          usedOnMaintenanceLog: { select: { fecha: true, tipoMantenimiento: true } },
          usedOnValveChangeLog: { select: { fechaInstalacion: true } },
          usedOnValveCorrectiveMaintenanceLog: { select: { fecha: true, descripcion: true } },
        },
      })
    : [];
  // En Administración, "Inventarios" combina el de todas las ciudades reales
  // en vez de mostrar el suyo propio (vacío: es una ciudad virtual sin
  // unidades). Mismo criterio que Orden (ver isOrdenDePieza && isAggregateCity
  // arriba): de solo lectura, editar sigue siendo desde la ciudad real.
  const inventoryFeed =
    isInventarios && isAggregateCity ? await getCityInventoryFeed(await getAllRealCityIds()) : [];

  // Unidades activas de la ciudad: para elegir dónde se colocó una pieza al
  // marcarla "Utilizada" (ver InventoryItemStatusForm) y para elegir la
  // unidad destino al levantar una orden, si ya se sabe (ver
  // CreatePieceOrderForm).
  const cityVehicles = isInventarios || isOrdenDePieza
    ? await prisma.vehicleRecord.findMany({
        where: { activo: true, section: { cityId: city.id } },
        orderBy: [{ section: { order: "asc" } }, { numeroEconomico: "asc" }],
        select: { id: true, numeroEconomico: true, section: { select: { name: true, slug: true } } },
      })
    : [];
  // Para el selector "¿Para qué es la orden?" (Unidades/Estaciones) de
  // CreatePieceOrderForm: mismo criterio que el resto del sistema para
  // distinguir una estación/planta de una unidad normal.
  const orderVehicles = cityVehicles.map((v) => ({
    ...v,
    esEstacion: ESTACION_LIKE_SECTION_SLUGS.includes(v.section.slug),
  }));

  const documents = isVehicleSection || isEquiposSection || isResumenSection
    ? []
    : await prisma.document.findMany({
        where: { sectionId: current.id },
        orderBy: { createdAt: "desc" },
      });

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Inicio", href: "/dashboard" },
    { label: city.name, href: `/ciudades/${city.slug}` },
    ...chain.map((section, index) => {
      const isLast = index === chain.length - 1;
      const href = `/ciudades/${city.slug}/${chain
        .slice(0, index + 1)
        .map((s) => s.slug)
        .join("/")}`;
      return { label: section.name, href: isLast ? undefined : href };
    }),
  ];

  return (
    <div>
      <Breadcrumb items={breadcrumbItems} />

      <div className="mb-6 flex items-center gap-3">
        <SectionIcon slug={current.slug} className="h-11 w-11" />
        <h1 className="text-2xl font-semibold text-primary">{current.name}</h1>
      </div>

      {children.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {children.map((section) => (
            <SectionCard
              key={section.id}
              name={section.name}
              slug={section.slug}
              href={`/ciudades/${city.slug}/${[...params.sectionPath, section.slug].join("/")}`}
            />
          ))}
        </div>
      ) : isBitacoraFeed ? (
        <div className="space-y-6">
          {showMonthPicker && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-gray-300 bg-white px-4 py-3">
              <p className="text-sm text-ink">
                Viendo <span className="font-medium">{mesSelectionLabel(selectedMes)}</span>: la
                bitácora y las gráficas de abajo son solo de {selectedMes.type === "year" ? "ese año" : "ese mes"}.
              </p>
              <MonthPicker
                months={listRecentMonthsWithYearOption(12)}
                selected={mesSelectionParamValue(selectedMes)}
              />
            </div>
          )}
          {isAggregateCity && (
            <>
              <VehiclesInMaintenancePanel vehicles={vehiclesInMaintenance} />
              <RecordTypeComparisonSection
                stats={recordTypeStats}
                range={selectedMonthRange}
                monthLabel={mesSelectionLabel(selectedMes)}
              />
              {recordTypeStats.map((stat) => (
                <RecordCountByCityChart
                  key={stat.type}
                  title={stat.label}
                  type={stat.type}
                  stats={stat.byCity}
                  range={selectedMonthRange}
                  monthLabel={mesSelectionLabel(selectedMes)}
                  color={stat.color}
                />
              ))}
            </>
          )}
          <MaintenanceTypePieChart
            stats={maintenanceTypeStats}
            scope={{ type: "city", cityId: isAggregateCity ? null : city.id }}
            range={pieceMaintenanceRange}
            monthLabel={showMonthPicker ? mesSelectionLabel(selectedMes) : currentMonthLabel()}
          />
          <PieceMaintenanceChart
            stats={pieceMaintenanceStats}
            scope={{ type: "city", cityId: isAggregateCity ? null : city.id }}
            range={pieceMaintenanceRange}
            monthLabel={showMonthPicker ? mesSelectionLabel(selectedMes) : undefined}
          />
          <MarcaMaintenanceCharts
            groups={marcaMaintenanceStats}
            monthLabel={showMonthPicker ? mesSelectionLabel(selectedMes) : currentMonthLabel()}
          />
          <CityMaintenanceFeed logs={cityMaintenanceLogs} showCity={isAggregateCity} />
        </div>
      ) : isBitacoraEstacionesFeed ? (
        <div className="space-y-6">
          {showEstacionesMonthPicker && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-gray-300 bg-white px-4 py-3">
              <p className="text-sm text-ink">
                Viendo <span className="font-medium">{mesSelectionLabel(selectedMes)}</span>: la
                bitácora y las gráficas de abajo son solo de {selectedMes.type === "year" ? "ese año" : "ese mes"}.
              </p>
              <MonthPicker
                months={listRecentMonthsWithYearOption(12)}
                selected={mesSelectionParamValue(selectedMes)}
              />
            </div>
          )}
          <MaintenanceTypePieChart
            stats={estacionesMaintenanceTypeStats}
            scope={{ type: "city", cityId: isAggregateCity ? null : city.id, sectionSlugs: ESTACION_LIKE_SECTION_SLUGS }}
            range={estacionesRange}
            monthLabel={showEstacionesMonthPicker ? mesSelectionLabel(selectedMes) : currentMonthLabel()}
          />
          <PieceMaintenanceChart
            stats={estacionesPieceMaintenanceStats}
            scope={{ type: "city", cityId: isAggregateCity ? null : city.id, sectionSlugs: ESTACION_LIKE_SECTION_SLUGS }}
            range={estacionesRange}
            monthLabel={showEstacionesMonthPicker ? mesSelectionLabel(selectedMes) : undefined}
          />
          <CityMaintenanceFeed logs={estacionesMaintenanceLogs} showCity={isAggregateCity} />
        </div>
      ) : isBitacoraEquiposFeed ? (
        <div className="space-y-6">
          {isAggregateCity && <HighCriticidadEquiposPanel equipos={highCriticidadEquipos} />}
          <EquipmentMaintenanceTypePieChart
            stats={equipmentMaintenanceTypeStats}
            cityId={isAggregateCity ? null : city.id}
            range={getCurrentMonthRange()}
            monthLabel={currentMonthLabel()}
            showCity={isAggregateCity}
          />
          <CityEquipmentLogFeed logs={cityEquipmentLogs} showCity={isAggregateCity} />
        </div>
      ) : isEquiposSection ? (
        <div>
          {isAggregateCity ? (
            <AggregateEquipoTable equipos={aggregateEquipos} />
          ) : (
            <>
              <EquipoTable equipos={equipos} citySlug={city.slug} />
              {isEditor && <CreateEquipoForm sectionId={current.id} />}
            </>
          )}
        </div>
      ) : isOrdenDePieza ? (
        <div className="space-y-6">
          {showOrderMonthPicker && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-gray-300 bg-white px-4 py-3">
              <p className="text-sm text-ink">
                Viendo <span className="font-medium">{mesSelectionLabel(selectedMes)}</span>: las
                gráficas de abajo son solo de {selectedMes.type === "year" ? "ese año" : "ese mes"}.
              </p>
              <MonthPicker
                months={listRecentMonthsWithYearOption(12)}
                selected={mesSelectionParamValue(selectedMes)}
              />
            </div>
          )}
          {isAggregateCity ? (
            <>
              <PieceOrderStatsChart stats={pieceOrderStats} range={pieceOrderRange} monthLabel={pieceOrderMonthLabel} />
              <PieceOrderStatusChart stats={pieceOrderStatusStats} range={pieceOrderRange} monthLabel={pieceOrderMonthLabel} />
              <CityOrderFeed orders={orderLogFeed} showCity />
            </>
          ) : (
            <>
              {isEditor && (
                <CreatePieceOrderForm
                  sectionId={current.id}
                  vehicles={orderVehicles}
                  equipos={cityEquipos}
                  pieceCatalog={pieceCatalog}
                  categoriasPorGrupo={categoriasPorGrupo}
                />
              )}
              <PieceOrderTable orders={pieceOrders} canEdit={isEditor} isAdmin={isAdmin} citySlug={city.slug} />
            </>
          )}
        </div>
      ) : isResumenSection ? (
        <ResumenPanel
          citySlug={city.slug}
          tab={searchParams.tab ?? "general"}
          ambito={searchParams.ambito === "estaciones" ? "ESTACIONES" : "UNIDADES"}
        />
      ) : isInventarios ? (
        isAggregateCity ? (
          <InventoryAggregateTable items={inventoryFeed} />
        ) : (
          <InventoryItemTable
            items={inventoryItems}
            vehicles={cityVehicles}
            citySlug={city.slug}
            canEdit={isEditor}
            isAdmin={isAdmin}
          />
        )
      ) : isPlantaFichaTecnicaSection ? (
        <div>
          <PlantaCardGrid records={plantaCards} />
          {isEditor && !isAggregateCity && (
            <div className="mt-4">
              <CreateVehicleForm sectionId={current.id} sectionSlug={current.slug} />
            </div>
          )}
        </div>
      ) : isVehicleSection ? (
        <div>
          {isAggregateCity ? (
            <AggregateVehicleTable records={aggregateVehicleRecords} sectionSlug={current.slug} />
          ) : (
            <>
              <VehicleTable records={vehicleRecords} citySlug={city.slug} sectionSlug={current.slug} />
              {isEditor && <CreateVehicleForm sectionId={current.id} sectionSlug={current.slug} />}
            </>
          )}
        </div>
      ) : null}

      {/* Apartados como Manuales o Programa de mantenimiento no tienen otro
          contenido que sus documentos: antes se veían con una caja
          "Próximamente" arriba (aunque sí hubiera archivos) seguida de esta
          misma lista, lo cual se veía como si el apartado no funcionara. Sin
          esa caja, esta tarjeta ya es el contenido principal de la página. */}
      {!isVehicleSection && !isEquiposSection && !isResumenSection && (
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase text-primary-bright">
            {allowsOfficeDocs ? "Documentos (PDF, imagen, Word, Excel, PowerPoint, CSV o TXT)" : "Documentos (PDF o imagen)"}
          </h2>
          <div className="space-y-3">
            {isEditor && <UploadDocumentForm sectionId={current.id} allowOfficeDocs={allowsOfficeDocs} />}
            <DocumentList documents={documents} isAdmin={isAdmin} />
          </div>
        </div>
      )}
    </div>
  );
}
