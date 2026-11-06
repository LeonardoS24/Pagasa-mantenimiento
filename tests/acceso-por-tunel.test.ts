// IP real y esquema detrás del túnel de Cloudflare (scripts/ip-cliente.mjs) y
// la cookie segura por petición (lib/session.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { confiaEnElTunel, datosDeConexion } from "../scripts/ip-cliente.mjs";

const peticion = (ip: string, encabezados: Record<string, string> = {}) => ({ socket: { remoteAddress: ip }, headers: encabezados });

test("sin túnel: la IP es la del socket y los encabezados del navegador se ignoran", () => {
  const r = datosDeConexion(peticion("::ffff:192.168.10.50", { "cf-connecting-ip": "8.8.8.8", "x-forwarded-for": "1.2.3.4", "x-forwarded-proto": "https" }), { confiarTunel: false });
  assert.deepEqual(r, { ip: "192.168.10.50", https: false, porTunel: false });
});

test("con túnel: desde el propio equipo se cree en CF-Connecting-IP y en el esquema https", () => {
  for (const origen of ["127.0.0.1", "::1", "::ffff:127.0.0.1"]) {
    const r = datosDeConexion(peticion(origen, { "cf-connecting-ip": "201.141.7.9", "cf-visitor": '{"scheme":"https"}' }), { confiarTunel: true });
    assert.equal(r.ip, "201.141.7.9", origen);
    assert.equal(r.https, true);
    assert.equal(r.porTunel, true);
  }
});

test("con túnel: una computadora de la red local NO puede hacerse pasar por el túnel", () => {
  const r = datosDeConexion(peticion("192.168.10.77", { "cf-connecting-ip": "8.8.8.8", "cf-visitor": '{"scheme":"https"}' }), { confiarTunel: true });
  assert.equal(r.ip, "192.168.10.77");
  assert.equal(r.https, false);
  assert.equal(r.porTunel, false);
});

test("con túnel: una IP inválida en CF-Connecting-IP se descarta y se queda la del socket", () => {
  assert.equal(datosDeConexion(peticion("127.0.0.1", { "cf-connecting-ip": "no-es-una-ip" }), { confiarTunel: true }).ip, "127.0.0.1");
  assert.equal(datosDeConexion(peticion("127.0.0.1", { "cf-connecting-ip": "1.2.3.4, 5.6.7.8" }), { confiarTunel: true }).ip, "127.0.0.1");
  assert.equal(datosDeConexion(peticion("127.0.0.1", {}), { confiarTunel: true }).ip, "127.0.0.1");
});

test("con túnel: el esquema sale de CF-Visitor y, si falta o está dañado, de X-Forwarded-Proto", () => {
  assert.equal(datosDeConexion(peticion("127.0.0.1", { "cf-visitor": '{"scheme":"http"}', "x-forwarded-proto": "https" }), { confiarTunel: true }).https, false);
  assert.equal(datosDeConexion(peticion("127.0.0.1", { "cf-visitor": "basura", "x-forwarded-proto": "https" }), { confiarTunel: true }).https, true);
  assert.equal(datosDeConexion(peticion("127.0.0.1", {}), { confiarTunel: true }).https, false);
});

test("CONFIAR_TUNEL solo se activa con el valor «cloudflare»", () => {
  assert.equal(confiaEnElTunel("cloudflare"), true);
  assert.equal(confiaEnElTunel(" Cloudflare "), true);
  for (const v of [undefined, "", "true", "1", "otro"]) assert.equal(confiaEnElTunel(v), false, String(v));
});

test("cookie de sesión: «secure» solo si la petición llegó por https (o COOKIE_SECURE=true)", async () => {
  process.env.SESSION_SECRET = "una-llave-de-prueba-de-al-menos-32-caracteres";
  delete process.env.COOKIE_SECURE;
  const { opcionesDeSesion } = await import("../lib/session");
  assert.equal(opcionesDeSesion("http").cookieOptions?.secure, false);
  assert.equal(opcionesDeSesion(null).cookieOptions?.secure, false);
  assert.equal(opcionesDeSesion("https").cookieOptions?.secure, true);
  assert.equal(opcionesDeSesion("https").cookieOptions?.httpOnly, true);
});
