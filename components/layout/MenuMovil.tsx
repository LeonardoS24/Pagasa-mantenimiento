"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// En celular el menú lateral no cabe junto al contenido: se esconde y se abre
// con el botón ☰ de la barra superior. El estado se comparte entre Header y
// Sidebar (son hermanos en el layout), por eso este contexto.
const Contexto = createContext<{ abierto: boolean; alternar: () => void; cerrar: () => void }>({
  abierto: false,
  alternar: () => undefined,
  cerrar: () => undefined,
});

export function MenuMovilProvider({ children }: { children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();
  // Al navegar se cierra solo.
  useEffect(() => setAbierto(false), [pathname]);
  return (
    <Contexto.Provider value={{ abierto, alternar: () => setAbierto((a) => !a), cerrar: () => setAbierto(false) }}>
      {children}
    </Contexto.Provider>
  );
}

export function useMenuMovil() {
  return useContext(Contexto);
}

export function BotonMenuMovil() {
  const { abierto, alternar } = useMenuMovil();
  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
      aria-expanded={abierto}
      className="rounded-md p-1.5 text-white hover:bg-white/10 md:hidden"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        {abierto ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
      </svg>
    </button>
  );
}
