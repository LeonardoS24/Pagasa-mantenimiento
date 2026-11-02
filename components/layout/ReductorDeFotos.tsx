"use client";

import { useEffect } from "react";

// Reduce las fotos ANTES de subirlas, en cualquier formulario del sistema.
//
// Una foto de celular pesa de 4 a 8 MB; para evidencia de mantenimiento basta
// con 1920 px por lado (unos 300-600 KB). Es lo que más hace crecer el disco
// del servidor y la copia de seguridad.
//
// Funciona para los ~30 formularios con <input type="file"> sin tocarlos:
// escucha el cambio de archivo en todo el documento, cambia la foto por la
// reducida en el mismo campo y, si alguien manda el formulario mientras se
// reduce, espera a que termine y entonces lo manda. Los PDF y lo que no sea
// foto no se tocan; si algo falla, se sube el original.

const MAX_LADO = 1920;
const CALIDAD = 0.82;
const MIN_BYTES = 600 * 1024;
const TIPOS = ["image/jpeg", "image/png", "image/webp"];
// Si reducir tarda más que esto (celular viejo, imagen rara), se sube el
// original: el formulario nunca se queda esperando sin fin.
const LIMITE_MS = 15_000;

function debeReducir(f: File): boolean {
  return TIPOS.includes(f.type) && f.size > MIN_BYTES;
}

async function reducir(f: File): Promise<File> {
  if (!debeReducir(f)) return f;
  try {
    // imageOrientation: la foto queda derecha aunque el celular la haya
    // guardado "acostada" con la marca EXIF.
    const imagen = await createImageBitmap(f, { imageOrientation: "from-image" });
    const escala = Math.min(1, MAX_LADO / Math.max(imagen.width, imagen.height));
    const ancho = Math.round(imagen.width * escala);
    const alto = Math.round(imagen.height * escala);
    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const ctx = lienzo.getContext("2d");
    if (!ctx) return f;
    // Fondo blanco: un PNG con transparencia se vería negro en JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(imagen, 0, 0, ancho, alto);
    imagen.close();
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", CALIDAD));
    if (!blob || blob.size >= f.size) return f;
    const nombre = f.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nombre, { type: "image/jpeg", lastModified: f.lastModified });
  } catch {
    return f;
  }
}

function conLimite<T>(promesa: Promise<T>, respaldo: T): Promise<T> {
  return Promise.race([promesa, new Promise<T>((ok) => setTimeout(() => ok(respaldo), LIMITE_MS))]);
}

export function ReductorDeFotos() {
  useEffect(() => {
    const pendientes = new WeakMap<HTMLFormElement, Promise<void>>();
    // Formularios con un envío ya en espera: un segundo toque al botón no
    // debe agendar otro envío (serían dos registros iguales en la bitácora).
    const esperando = new WeakSet<HTMLFormElement>();
    // Cada selección de archivo del campo lleva un número: si la persona
    // cambia la foto mientras se reduce la anterior, la reducción vieja ya no
    // toca el campo.
    const generacion = new WeakMap<HTMLInputElement, number>();

    const alCambiar = (e: Event) => {
      const campo = e.target;
      if (!(campo instanceof HTMLInputElement) || campo.type !== "file") return;
      // El "change" que lanzamos nosotros con la foto ya reducida.
      if (campo.dataset.fotosReducidas === "1") {
        delete campo.dataset.fotosReducidas;
        return;
      }
      // Toda selección nueva (también vaciar el campo) invalida la reducción
      // que estuviera en curso.
      const mia = (generacion.get(campo) ?? 0) + 1;
      generacion.set(campo, mia);
      if (!campo.files?.length) return;
      const archivos = Array.from(campo.files);
      if (!archivos.some(debeReducir)) return;
      const tarea = (async () => {
        const nuevos = await conLimite(Promise.all(archivos.map(reducir)), archivos);
        if (generacion.get(campo) !== mia) return; // ya eligieron otra cosa
        if (nuevos.every((n, i) => n === archivos[i])) return;
        const dt = new DataTransfer();
        for (const n of nuevos) dt.items.add(n);
        campo.files = dt.files;
        campo.dataset.fotosReducidas = "1";
        // Para los formularios que guardan el archivo en su estado al cambiar.
        campo.dispatchEvent(new Event("change", { bubbles: true }));
      })().catch(() => undefined);
      if (campo.form) {
        const anterior = pendientes.get(campo.form) ?? Promise.resolve();
        pendientes.set(campo.form, anterior.then(() => tarea));
      }
    };

    const alEnviar = (e: SubmitEvent) => {
      const formulario = e.target;
      if (!(formulario instanceof HTMLFormElement)) return;
      const tarea = pendientes.get(formulario);
      if (!tarea) return;
      // Se detiene este envío y se repite cuando la foto esté lista.
      e.preventDefault();
      e.stopImmediatePropagation();
      if (esperando.has(formulario)) return;
      esperando.add(formulario);
      const boton = e.submitter as HTMLElement | null;
      void tarea.finally(() => {
        pendientes.delete(formulario);
        esperando.delete(formulario);
        formulario.requestSubmit(boton && formulario.contains(boton) ? (boton as HTMLButtonElement) : undefined);
      });
    };

    document.addEventListener("change", alCambiar, true);
    document.addEventListener("submit", alEnviar, true);
    return () => {
      document.removeEventListener("change", alCambiar, true);
      document.removeEventListener("submit", alEnviar, true);
    };
  }, []);
  return null;
}
