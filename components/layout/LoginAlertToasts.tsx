import { InProgressAlertToast } from "./InProgressAlertToast";
import { HighPriorityOrderAlertToast } from "./HighPriorityOrderAlertToast";
import { ValveRedAlertToast } from "./ValveRedAlertToast";

// Apila arriba a la derecha los avisos que loginAction pudo haber dejado en
// la sesión (ver actions/auth-actions.ts): mantenimientos "En proceso",
// órdenes de prioridad ALTA y válvulas en rojo. Cada uno se posiciona a sí
// mismo dentro de este contenedor en vez de fijarse por separado, así nunca
// se superponen sin importar cuáles de los tres aparezcan.
export function LoginAlertToasts() {
  return (
    <div className="fixed right-4 top-20 z-50 flex flex-col gap-3 print:hidden">
      <ValveRedAlertToast />
      <HighPriorityOrderAlertToast />
      <InProgressAlertToast />
    </div>
  );
}
