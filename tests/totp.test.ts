// Doble verificación (lib/totp.ts), con los vectores de prueba de la RFC 6238.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  base32Codificar,
  base32Decodificar,
  codigoTotp,
  consumirCodigoRespaldo,
  huellaDeCodigoRespaldo,
  leerHuellas,
  nuevoSecretoTotp,
  nuevosCodigosRespaldo,
  pareceCodigoRespaldo,
  pasoDe,
  uriOtpauth,
  verificarTotp,
} from "../lib/totp";

// RFC 6238, apéndice B: secreto ASCII «12345678901234567890» con SHA-1.
const SECRETO_RFC = base32Codificar(Buffer.from("12345678901234567890"));
// La RFC da 8 dígitos; con 6 dígitos son los últimos seis.
const VECTORES: [number, string][] = [
  [59, "287082"],
  [1111111109, "081804"],
  [1111111111, "050471"],
  [1234567890, "005924"],
  [2000000000, "279037"],
];

test("totp: coincide con los vectores de la RFC 6238", () => {
  assert.equal(SECRETO_RFC, "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  for (const [segundos, esperado] of VECTORES) {
    assert.equal(codigoTotp(SECRETO_RFC, pasoDe(segundos * 1000)), esperado, `t=${segundos}`);
  }
});

test("base32: ida y vuelta y rechazo de caracteres inválidos", () => {
  const datos = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255, 7, 8, 9]);
  assert.deepEqual(base32Decodificar(base32Codificar(datos)), datos);
  assert.deepEqual(base32Decodificar("gezd gnbv-gy3t"), base32Decodificar("GEZDGNBVGY3T"));
  assert.throws(() => base32Decodificar("AB1CD"));
  const secreto = nuevoSecretoTotp();
  assert.match(secreto, /^[A-Z2-7]{32}$/);
  assert.notEqual(secreto, nuevoSecretoTotp());
});

test("verificar: acepta el código de ahora y el del paso vecino, no los lejanos", () => {
  const ahora = 1111111111 * 1000;
  const paso = pasoDe(ahora);
  assert.deepEqual(verificarTotp(SECRETO_RFC, codigoTotp(SECRETO_RFC, paso), { ahora }), { ok: true, paso });
  assert.equal(verificarTotp(SECRETO_RFC, codigoTotp(SECRETO_RFC, paso - 1), { ahora }).ok, true);
  assert.equal(verificarTotp(SECRETO_RFC, codigoTotp(SECRETO_RFC, paso + 1), { ahora }).ok, true);
  assert.equal(verificarTotp(SECRETO_RFC, codigoTotp(SECRETO_RFC, paso - 2), { ahora }).ok, false);
  assert.equal(verificarTotp(SECRETO_RFC, codigoTotp(SECRETO_RFC, paso + 2), { ahora }).ok, false);
});

test("verificar: un código no se puede usar dos veces", () => {
  const ahora = 1111111111 * 1000;
  const paso = pasoDe(ahora);
  const codigo = codigoTotp(SECRETO_RFC, paso);
  const primera = verificarTotp(SECRETO_RFC, codigo, { ahora });
  assert.equal(primera.ok, true);
  assert.equal(verificarTotp(SECRETO_RFC, codigo, { ahora, ultimoPaso: paso }).ok, false);
  // El del paso siguiente sí sirve después de haber usado el actual.
  assert.equal(verificarTotp(SECRETO_RFC, codigoTotp(SECRETO_RFC, paso + 1), { ahora, ultimoPaso: paso }).ok, true);
});

test("verificar: tolera espacios y rechaza lo que no son seis dígitos", () => {
  const ahora = 59 * 1000;
  assert.equal(verificarTotp(SECRETO_RFC, "287 082", { ahora }).ok, true);
  for (const mal of ["", "28708", "2870822", "abcdef", "28708a", "287-082"]) {
    assert.equal(verificarTotp(SECRETO_RFC, mal, { ahora }).ok, false, mal);
  }
});

test("uri otpauth: lleva el usuario, el secreto y los parámetros", () => {
  const uri = uriOtpauth({ usuario: "ana lopez", secreto: "ABC234" });
  assert.ok(uri.startsWith("otpauth://totp/Pagasa%20Mantenimiento%3Aana%20lopez?"));
  assert.ok(uri.includes("secret=ABC234") && uri.includes("digits=6") && uri.includes("period=30") && uri.includes("issuer=Pagasa%20Mantenimiento"));
});

test("códigos de recuperación: formato, unicidad y un solo uso", () => {
  const codigos = nuevosCodigosRespaldo(8);
  assert.equal(codigos.length, 8);
  assert.equal(new Set(codigos).size, 8);
  for (const c of codigos) {
    assert.match(c, /^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
    assert.equal(pareceCodigoRespaldo(c), true);
  }
  assert.equal(pareceCodigoRespaldo("123456"), false);
  const huellas = codigos.map(huellaDeCodigoRespaldo);
  const uso = consumirCodigoRespaldo(huellas, codigos[3].toLowerCase().replace("-", " "));
  assert.equal(uso.ok, true);
  assert.equal(uso.restantes.length, 7);
  assert.equal(consumirCodigoRespaldo(uso.restantes, codigos[3]).ok, false);
  assert.equal(consumirCodigoRespaldo(huellas, "AAAAA-AAAAA").ok, false);
});

test("leerHuellas: tolera nulos y JSON dañado", () => {
  assert.deepEqual(leerHuellas(null), []);
  assert.deepEqual(leerHuellas("no es json"), []);
  assert.deepEqual(leerHuellas('{"a":1}'), []);
  assert.deepEqual(leerHuellas('["x", 3, "y"]'), ["x", "y"]);
});
