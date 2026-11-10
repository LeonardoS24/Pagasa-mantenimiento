import { MonthPicker } from "./MonthPicker";
import { listRecentMonthsWithYearOption, mesSelectionLabel, mesSelectionParamValue, type MesSelection } from "@/lib/dates";

// Valor de ?mes= para ver los últimos registros sin importar el mes (como se
// veía la bitácora de cada ciudad antes del selector).
export const MES_RECIENTES = "recientes";

// Selector de mes de las bitácoras (de unidades, de estaciones y de equipos,
// en cada ciudad y en Administración): el usuario pidió poder ver lo que pasó
// en cualquier mes, no solo en el actual (9-nov-2026). Tres años hacia atrás,
// con "Todo <año>" y "Últimos registros".
export function BarraDeMes({ seleccion, recientes }: { seleccion: MesSelection; recientes: boolean }) {
  const meses = [{ value: MES_RECIENTES, label: "Últimos registros" }, ...listRecentMonthsWithYearOption(36)];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-gray-300 bg-white px-4 py-3">
      <p className="text-sm text-ink">
        {recientes ? (
          <>
            Viendo los <span className="font-medium">últimos registros</span> de la bitácora; las gráficas son de{" "}
            {mesSelectionLabel(seleccion)}.
          </>
        ) : (
          <>
            Viendo <span className="font-medium">{mesSelectionLabel(seleccion)}</span>: la bitácora y las gráficas de
            abajo son solo de {seleccion.type === "year" ? "ese año" : "ese mes"}.
          </>
        )}
      </p>
      <MonthPicker months={meses} selected={recientes ? MES_RECIENTES : mesSelectionParamValue(seleccion)} />
    </div>
  );
}
