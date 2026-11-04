// Dónde busca pdfjs sus recursos (los copia scripts/copy-pdf-worker.mjs a
// public/pdfjs en postinstall). Sin estas rutas pdfjs no avisa de nada: dibuja
// la página SIN el texto de las fuentes que el PDF no trae incrustadas (la
// mayoría de los manuales usan Helvetica/Arial/Times sin incrustar), no lee
// fuentes con codificación CJK, deja en blanco las imágenes JPEG 2000 / JBIG2
// (escaneos) y pinta mal los colores con perfil ICC. Se pasan siempre juntas
// a getDocument.
export const RECURSOS_PDFJS = {
  standardFontDataUrl: "/pdfjs/standard_fonts/",
  cMapUrl: "/pdfjs/cmaps/",
  cMapPacked: true,
  iccUrl: "/pdfjs/iccs/",
  wasmUrl: "/pdfjs/wasm/",
};
