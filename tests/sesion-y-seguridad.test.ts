// Reglas de seguridad que no deben romperse sin que alguien se entere: vigencia
// de la sesión, a dónde se puede regresar después del login, política de
// contraseñas, quién ve qué conversación y qué ruta acepta la copia externa.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DURACION_MAXIMA_MS, INACTIVIDAD_MS, estadoDeVigencia } from "../lib/sesion-vigencia";
import { rutaInternaSegura } from "../lib/ruta-segura";
import { problemaDeContrasena } from "../lib/politica-contrasena";
import { canalDirecto, puedeVerCanal } from "../lib/mensajes";
import { resumirNavegador } from "../lib/registro-acceso";
import { validarRutaExterna } from "../lib/respaldo-externo";

const AHORA = Date.UTC(2026, 9, 27, 18, 0, 0);

test("sesión: vigente, por inactividad y por tope de 12 h", () => {
  assert.equal(estadoDeVigencia({ iniciadaEl: AHORA - 60_000, ultimaActividad: AHORA - 60_000 }, AHORA), "vigente");
  assert.equal(estadoDeVigencia({ iniciadaEl: AHORA - 60_000, ultimaActividad: AHORA - INACTIVIDAD_MS + 1000 }, AHORA), "vigente");
  assert.equal(estadoDeVigencia({ iniciadaEl: AHORA - INACTIVIDAD_MS * 2, ultimaActividad: AHORA - INACTIVIDAD_MS - 1000 }, AHORA), "inactividad");
  assert.equal(estadoDeVigencia({ iniciadaEl: AHORA - DURACION_MAXIMA_MS - 1000, ultimaActividad: AHORA }, AHORA), "expirada");
  // Cookie del formato viejo, sin marcas: no se da por buena.
  assert.equal(estadoDeVigencia({}, AHORA), "expirada");
  assert.equal(INACTIVIDAD_MS, 20 * 60 * 1000);
});

test("login: solo regresa a rutas internas", () => {
  assert.equal(rutaInternaSegura("/ciudades/hermosillo/vehiculo/abc"), "/ciudades/hermosillo/vehiculo/abc");
  for (const malo of ["https://otro.com", "//otro.com", "/\\otro.com", "/login", "/login?x=1", "/api/logout", "ciudades", "", null, 5]) {
    assert.equal(rutaInternaSegura(malo), null, String(malo));
  }
});

test("contraseñas: largo, letras y números, sin usuario ni comunes", () => {
  assert.equal(problemaDeContrasena("Gas Seguro 2026 ok", "admin"), null);
  assert.match(problemaDeContrasena("corta1", "x") ?? "", /10 caracteres/);
  assert.match(problemaDeContrasena("soloLetrasLargas", "x") ?? "", /letra y un número/);
  assert.match(problemaDeContrasena("juanperez2026", "juanperez") ?? "", /usuario/);
  assert.match(problemaDeContrasena("Pagasa20262026", "x") ?? "", /Pagasa/);
  assert.match(problemaDeContrasena("CambiarAhora123!", "admin") ?? "", /comunes/);
  assert.match(problemaDeContrasena("Password2026!", "x") ?? "", /comunes/);
  assert.match(problemaDeContrasena("1234567890", "x") ?? "", /letra/);
});

test("mensajes: cada quien ve el general y solo sus conversaciones", () => {
  const ab = canalDirecto("b", "a");
  assert.equal(ab, canalDirecto("a", "b"));
  assert.ok(puedeVerCanal("a", "general"));
  assert.ok(puedeVerCanal("a", ab) && puedeVerCanal("b", ab));
  assert.ok(!puedeVerCanal("c", ab));
  assert.ok(!puedeVerCanal("a", "dm:a:a"));
  // Los ids en desorden serían una segunda conversación con la misma persona.
  assert.ok(!puedeVerCanal("a", "dm:b:a"));
  assert.ok(!puedeVerCanal("a", "dm:a"));
  assert.ok(!puedeVerCanal("a", "otro"));
});

test("bitácora: resumen del navegador", () => {
  assert.equal(resumirNavegador("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0"), "Edge 141 · Windows");
  assert.equal(resumirNavegador("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36"), "Chrome 141 · Android");
  assert.equal(resumirNavegador(null), null);
});

test("copia externa: no acepta la carpeta del sistema ni rutas relativas", () => {
  assert.equal(validarRutaExterna("/media/usb"), null);
  assert.ok(validarRutaExterna(process.cwd()));
  assert.ok(validarRutaExterna(process.cwd() + "/backups"));
  assert.ok(validarRutaExterna("usb"));
  assert.ok(validarRutaExterna("   "));
});
