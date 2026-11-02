"use client";

import { useEffect } from "react";

// Registra public/sw.js. Los navegadores solo lo permiten en HTTPS (o en
// localhost); por HTTP simplemente no hace nada y el sistema funciona igual.
export function RegistrarApp() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
