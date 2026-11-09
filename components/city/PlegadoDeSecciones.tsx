"use client";

import { useEffect, useRef } from "react";

// Secciones que se minimizan en la página de la unidad: los registros
// (mantenimiento, extintor, válvulas, pruebas...) y los recuadros de la ficha
// técnica. Cualquier elemento con `data-plegable` dentro de este contenedor se
// minimiza al tocar su título (el h2/h3 de su primer hijo): con
// `data-plegado` solo queda visible el título (la regla está en globals.css).
//
// Se hace con un atributo y no con <details> para no tocar la estructura de
// la ficha (cuadrícula y formularios con `display: contents`) ni sus campos:
// lo minimizado sigue en el formulario y se envía igual.
//
// - Los registros llegan minimizados del servidor (`data-plegado`); los
//   recuadros de la ficha, abiertos. Lo que cada quien abre o cierra se
//   recuerda en este navegador.
// - Al llegar con un ancla (#ultrasonido, #r-valvulas...) desde «Ver unidad»
//   se abre esa sección y se baja hasta ella.
// - Si al guardar el formulario hay un campo obligatorio dentro de un recuadro
//   minimizado, se abre para que el navegador pueda señalarlo.

type Enlace = { ancla: string; texto: string };

const CLAVE_GUARDADO = "pagasa.plegado.v1";

function leerGuardado(): Record<string, boolean> {
  try {
    const crudo = window.localStorage.getItem(CLAVE_GUARDADO);
    const v = crudo ? JSON.parse(crudo) : {};
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function guardar(clave: string, plegado: boolean) {
  try {
    const actual = leerGuardado();
    actual[clave] = plegado;
    window.localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(actual));
  } catch {
    // Sin almacenamiento (modo privado): solo no se recuerda.
  }
}

function claveDe(el: HTMLElement): string | null {
  return el.dataset.recuadro ? `r-${el.dataset.recuadro}` : el.id || null;
}

function plegar(el: HTMLElement, plegado: boolean, recordar: boolean) {
  if (plegado) el.setAttribute("data-plegado", "");
  else el.removeAttribute("data-plegado");
  const clave = claveDe(el);
  if (recordar && clave) guardar(clave, plegado);
}

// Abre el elemento y todas las secciones minimizadas que lo contienen.
function abrirHasta(el: Element | null) {
  let actual: Element | null = el;
  while (actual) {
    if (actual instanceof HTMLElement && actual.hasAttribute("data-plegable")) plegar(actual, false, false);
    actual = actual.parentElement;
  }
}

function tituloDe(seccion: HTMLElement): HTMLElement | null {
  const primero = seccion.firstElementChild as HTMLElement | null;
  if (!primero) return null;
  if (/^H[23]$/.test(primero.tagName)) return primero;
  const dentro = primero.firstElementChild as HTMLElement | null;
  return dentro && /^H[23]$/.test(dentro.tagName) ? dentro : null;
}

export function PlegadoDeSecciones({ enlaces, children }: { enlaces: Enlace[]; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raiz = ref.current;
    if (!raiz) return;

    // Lo que esta persona dejó abierto o cerrado la última vez.
    const guardado = leerGuardado();
    raiz.querySelectorAll<HTMLElement>("[data-plegable]").forEach((s) => {
      const clave = claveDe(s);
      if (clave && clave in guardado) plegar(s, guardado[clave], false);
    });

    function irAlAncla() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) {
        // ?mantenimiento=<id> (desde las gráficas y la actividad): abre la
        // bitácora de mantenimiento y baja al registro resaltado.
        if (new URLSearchParams(window.location.search).get("mantenimiento")) {
          const seccion = document.getElementById("mantenimiento");
          abrirHasta(seccion);
          const fila = seccion?.querySelector("[data-objetivo]") ?? seccion;
          requestAnimationFrame(() => fila?.scrollIntoView({ behavior: "smooth", block: "center" }));
        }
        return;
      }
      const destino = document.getElementById(id);
      if (!destino || !raiz?.contains(destino)) return;
      abrirHasta(destino);
      // Después de pintar lo recién abierto.
      requestAnimationFrame(() => destino.scrollIntoView({ behavior: "smooth", block: "start" }));
    }

    function alTocar(e: MouseEvent) {
      const titulo = (e.target as HTMLElement).closest("h2, h3") as HTMLElement | null;
      if (!titulo) return;
      const seccion = titulo.closest("[data-plegable]") as HTMLElement | null;
      if (!seccion || !raiz?.contains(seccion) || tituloDe(seccion) !== titulo) return;
      // En el editor de la ficha (vista previa) no se pliega nada.
      if (seccion.closest("[inert]")) return;
      plegar(seccion, !seccion.hasAttribute("data-plegado"), true);
    }

    function alFaltarCampo(e: Event) {
      abrirHasta(e.target as Element);
    }

    irAlAncla();
    raiz.addEventListener("click", alTocar);
    raiz.addEventListener("invalid", alFaltarCampo, true);
    window.addEventListener("hashchange", irAlAncla);
    return () => {
      raiz.removeEventListener("click", alTocar);
      raiz.removeEventListener("invalid", alFaltarCampo, true);
      window.removeEventListener("hashchange", irAlAncla);
    };
  }, []);

  function todas(plegado: boolean) {
    ref.current?.querySelectorAll<HTMLElement>("[data-plegable]").forEach((s) => {
      if (!s.closest("[inert]")) plegar(s, plegado, true);
    });
  }

  function ir(ancla: string) {
    const destino = document.getElementById(ancla);
    if (!destino) return;
    abrirHasta(destino);
    history.replaceState(null, "", `#${ancla}`);
    requestAnimationFrame(() => destino.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <div ref={ref} className="plegables">
      <nav
        aria-label="Ir a un apartado de la unidad"
        className="sticky top-0 z-20 -mx-1 mb-6 flex flex-wrap items-center gap-1.5 rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-xs shadow-sm backdrop-blur print:hidden"
      >
        <span className="mr-1 font-semibold uppercase text-gray-500">Ir a:</span>
        {enlaces.map((e) => (
          <button
            key={e.ancla}
            type="button"
            onClick={() => ir(e.ancla)}
            className="rounded-full border border-gray-300 px-2.5 py-1 text-ink transition hover:border-primary hover:text-primary"
          >
            {e.texto}
          </button>
        ))}
        <span className="ml-auto flex gap-1.5">
          <button
            type="button"
            onClick={() => todas(true)}
            className="rounded-md border border-gray-300 px-2.5 py-1 font-medium text-ink hover:bg-gray-50"
          >
            Minimizar todo
          </button>
          <button
            type="button"
            onClick={() => todas(false)}
            className="rounded-md border border-gray-300 px-2.5 py-1 font-medium text-ink hover:bg-gray-50"
          >
            Abrir todo
          </button>
        </span>
      </nav>
      {children}
    </div>
  );
}
