// Compatibilidad para pdfjs-dist 6: usa Map/WeakMap.prototype.getOrInsert y
// getOrInsertComputed, métodos nuevos del lenguaje que los navegadores
// trajeron hasta Chrome/Edge 145 (2026). En uno más viejo, el visor de PDF y
// la impresión de los adjuntos fallaban con "getOrInsertComputed is not a
// function" y solo mostraban "No se pudieron preparar estos archivos".
//
// Es un archivo JS plano (sin imports ni TypeScript) a propósito: lo cargan
// los componentes de navegador con `import "@/lib/pdfjs-compat"` y, además,
// scripts/copy-pdf-worker.mjs lo antepone al worker de pdfjs (el worker es
// otro contexto de JavaScript y no hereda esto). Una sola fuente para los dos.
(function () {
  function instalar(Constructor) {
    if (!Constructor || !Constructor.prototype) return;
    var proto = Constructor.prototype;
    if (typeof proto.getOrInsert !== "function") {
      Object.defineProperty(proto, "getOrInsert", {
        configurable: true,
        writable: true,
        value: function (key, value) {
          if (this.has(key)) return this.get(key);
          this.set(key, value);
          return value;
        },
      });
    }
    if (typeof proto.getOrInsertComputed !== "function") {
      Object.defineProperty(proto, "getOrInsertComputed", {
        configurable: true,
        writable: true,
        value: function (key, callback) {
          if (this.has(key)) return this.get(key);
          var value = callback(key);
          this.set(key, value);
          return value;
        },
      });
    }
  }
  instalar(typeof Map !== "undefined" ? Map : undefined);
  instalar(typeof WeakMap !== "undefined" ? WeakMap : undefined);
})();
