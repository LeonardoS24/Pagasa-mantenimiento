// Crea los certificados para servir el sistema por HTTPS en la red local
// (ver "HTTPS" en SERVIDOR.md y scripts/servidor.mjs). Sin dependencias: arma
// los certificados X.509 a mano con el módulo crypto de Node, para no
// depender de que el servidor tenga OpenSSL.
//
//   node scripts/crear-certificado-https.mjs [IP o nombre] [IP o nombre] ...
//
// Sin argumentos usa todas las IP de red de este equipo, su nombre,
// "localhost" y 127.0.0.1.
//
// Deja en certificados/ (fuera de git: son llaves privadas):
//   pagasa-ca.crt / pagasa-ca.key    Autoridad certificadora propia de
//                                    Pagasa. Se crea UNA vez y se reutiliza:
//                                    el .crt es lo que se instala en cada
//                                    computadora y celular para que el
//                                    navegador confíe en el sistema.
//   servidor.crt / servidor.key      El certificado del servidor, firmado por
//                                    esa autoridad, con sus direcciones. Se
//                                    vuelve a crear si cambia la IP (y no hace
//                                    falta reinstalar nada en los equipos).

import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CARPETA = path.join(RAIZ, "certificados");

// ---------------------------------------------------------------------------
// DER (ASN.1) mínimo

function largo(n) {
  if (n < 0x80) return Buffer.from([n]);
  const bytes = [];
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}
const tlv = (tag, contenido) => Buffer.concat([Buffer.from([tag]), largo(contenido.length), contenido]);
const seq = (...partes) => tlv(0x30, Buffer.concat(partes));
const set = (...partes) => tlv(0x31, Buffer.concat(partes));
const ctx = (n, contenido) => tlv(0xa0 + n, contenido); // [n] explícito, construido
const entero = (buf) => tlv(0x02, buf[0] & 0x80 ? Buffer.concat([Buffer.from([0]), buf]) : buf);
const nulo = () => Buffer.from([0x05, 0x00]);
const booleano = (v) => tlv(0x01, Buffer.from([v ? 0xff : 0x00]));
const octetos = (buf) => tlv(0x04, buf);
const bits = (buf, sinUsar = 0) => tlv(0x03, Buffer.concat([Buffer.from([sinUsar]), buf]));
const utf8 = (s) => tlv(0x0c, Buffer.from(s, "utf8"));

function oid(texto) {
  const p = texto.split(".").map(Number);
  const bytes = [40 * p[0] + p[1]];
  for (const n of p.slice(2)) {
    const pila = [n & 0x7f];
    let v = n >> 7;
    while (v > 0) {
      pila.unshift((v & 0x7f) | 0x80);
      v >>= 7;
    }
    bytes.push(...pila);
  }
  return tlv(0x06, Buffer.from(bytes));
}

// UTCTime hasta 2049, GeneralizedTime después (lo que pide RFC 5280).
function tiempo(fecha) {
  const iso = fecha.toISOString().replace(/[-:T]/g, "").slice(0, 14) + "Z";
  return fecha.getUTCFullYear() < 2050 ? tlv(0x17, Buffer.from(iso.slice(2))) : tlv(0x18, Buffer.from(iso));
}

const nombre = (cn) =>
  seq(set(seq(oid("2.5.4.3"), utf8(cn))), set(seq(oid("2.5.4.10"), utf8("Grupo Pagasa"))));

const SHA256_RSA = seq(oid("1.2.840.113549.1.1.11"), nulo());

function extension(id, critica, valor) {
  return seq(oid(id), ...(critica ? [booleano(true)] : []), octetos(valor));
}

// Identificador de la llave (SKI/AKI): SHA-1 de la llave pública completa.
// RFC 5280 4.2.1.2 permite cualquier método estable; lo que importa es que
// el del certificado del servidor apunte al de la CA.
function idDeLlave(spkiDer) {
  return crypto.createHash("sha1").update(spkiDer).digest();
}

// Restricción de nombres de la CA (RFC 5280 4.2.1.10). Esta CA se instala
// como "raíz de confianza" en todos los equipos: sin restricción, quien se
// llevara su llave podría fabricar certificados válidos para cualquier sitio
// (un banco, el correo). Con esto solo vale para direcciones de red interna
// (10.x, 172.16-31.x, 192.168.x, 127.x) y para los nombres de este equipo.
function restriccionDeNombres(nombresPermitidos) {
  const red = (ip, mascara) => tlv(0x87, Buffer.from([...ip, ...mascara]));
  const subarboles = [
    red([10, 0, 0, 0], [255, 0, 0, 0]),
    red([172, 16, 0, 0], [255, 240, 0, 0]),
    red([192, 168, 0, 0], [255, 255, 0, 0]),
    red([127, 0, 0, 0], [255, 0, 0, 0]),
    ...nombresPermitidos.map((n) => tlv(0x82, Buffer.from(n.toLowerCase(), "ascii"))),
  ].map((nombre) => seq(nombre));
  return seq(ctx(0, Buffer.concat(subarboles)));
}

function firmarCertificado({ sujeto, emisor, llavePublica, llaveFirma, idEmisor, dias, esCA, nombresAlternos, nombresPermitidos }) {
  const spki = llavePublica.export({ type: "spki", format: "der" });
  const idPropio = idDeLlave(spki);
  const serie = crypto.randomBytes(16);
  serie[0] &= 0x7f;
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const hasta = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);

  const extensiones = [
    extension("2.5.29.19", true, esCA ? seq(booleano(true), entero(Buffer.from([0]))) : seq()),
    // keyUsage. CA: digitalSignature + keyCertSign + cRLSign. Servidor:
    // digitalSignature + keyEncipherment.
    extension("2.5.29.15", true, esCA ? bits(Buffer.from([0x86]), 1) : bits(Buffer.from([0xa0]), 5)),
    extension("2.5.29.14", false, octetos(idPropio)),
    extension("2.5.29.35", false, seq(tlv(0x80, idEmisor ?? idPropio))),
  ];
  if (esCA) extensiones.push(extension("2.5.29.30", true, restriccionDeNombres(nombresPermitidos)));
  if (!esCA) {
    extensiones.push(extension("2.5.29.37", false, seq(oid("1.3.6.1.5.5.7.3.1"))));
    const generales = nombresAlternos.map((n) =>
      /^\d+\.\d+\.\d+\.\d+$/.test(n)
        ? tlv(0x87, Buffer.from(n.split(".").map(Number)))
        : tlv(0x82, Buffer.from(n, "ascii"))
    );
    extensiones.push(extension("2.5.29.17", false, seq(...generales)));
  }

  const tbs = seq(
    ctx(0, entero(Buffer.from([2]))),
    entero(serie),
    SHA256_RSA,
    nombre(emisor),
    seq(tiempo(desde), tiempo(hasta)),
    nombre(sujeto),
    spki,
    ctx(3, seq(...extensiones))
  );
  const firma = crypto.sign("sha256", tbs, llaveFirma);
  const der = seq(tbs, SHA256_RSA, bits(firma));
  const pem = `-----BEGIN CERTIFICATE-----\n${der.toString("base64").match(/.{1,64}/g).join("\n")}\n-----END CERTIFICATE-----\n`;
  return { pem, id: idPropio };
}

// ---------------------------------------------------------------------------

function direccionesDeEsteEquipo() {
  const ips = [];
  for (const lista of Object.values(os.networkInterfaces())) {
    for (const i of lista ?? []) if (i.family === "IPv4" && !i.internal) ips.push(i.address);
  }
  return [...new Set([...ips, os.hostname(), "localhost", "127.0.0.1"])];
}

const pedidas = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const nombres = pedidas.length ? [...new Set([...pedidas, "localhost", "127.0.0.1"])] : direccionesDeEsteEquipo();
const validos = nombres.filter((n) => /^\d+\.\d+\.\d+\.\d+$/.test(n) || /^[A-Za-z0-9.-]+$/.test(n));

fs.mkdirSync(CARPETA, { recursive: true });
const rutaCaCrt = path.join(CARPETA, "pagasa-ca.crt");
const rutaCaKey = path.join(CARPETA, "pagasa-ca.key");

let caLlave;
let caId;
if (fs.existsSync(rutaCaCrt) && fs.existsSync(rutaCaKey)) {
  caLlave = crypto.createPrivateKey(fs.readFileSync(rutaCaKey));
  const caCert = new crypto.X509Certificate(fs.readFileSync(rutaCaCrt));
  caId = idDeLlave(caCert.publicKey.export({ type: "spki", format: "der" }));
  console.log("Se reutiliza la autoridad certificadora existente (no hay que reinstalarla en los equipos).");
} else {
  const par = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const ca = firmarCertificado({
    sujeto: "Pagasa Sistema de Mantenimiento CA",
    emisor: "Pagasa Sistema de Mantenimiento CA",
    llavePublica: par.publicKey,
    llaveFirma: par.privateKey,
    dias: 3650,
    esCA: true,
    // Los nombres (no IP) que se usan hoy. Si el equipo cambia de nombre, hay
    // que borrar certificados\\ y crear todo de nuevo (y reinstalar la CA).
    nombresPermitidos: validos.filter((n) => !/^\d+\.\d+\.\d+\.\d+$/.test(n)),
  });
  fs.writeFileSync(rutaCaCrt, ca.pem);
  fs.writeFileSync(rutaCaKey, par.privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  caLlave = par.privateKey;
  caId = ca.id;
  console.log("Se creó la autoridad certificadora: certificados/pagasa-ca.crt (hay que instalarla en cada equipo).");
}

const par = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const servidor = firmarCertificado({
  sujeto: validos[0],
  emisor: "Pagasa Sistema de Mantenimiento CA",
  llavePublica: par.publicKey,
  llaveFirma: caLlave,
  idEmisor: caId,
  dias: 825,
  esCA: false,
  nombresAlternos: validos,
});
fs.writeFileSync(path.join(CARPETA, "servidor.crt"), servidor.pem);
fs.writeFileSync(path.join(CARPETA, "servidor.key"), par.privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });

// Comprobación: Node vuelve a leer el certificado y revisa que lo firmó la CA.
const leido = new crypto.X509Certificate(servidor.pem);
const ca = new crypto.X509Certificate(fs.readFileSync(rutaCaCrt));
if (!leido.verify(ca.publicKey)) {
  console.error("ERROR: el certificado no quedó bien firmado.");
  process.exit(1);
}
const fueraDeRed = validos.filter((n) => /^\d+\.\d+\.\d+\.\d+$/.test(n) && !/^(10\.|192\.168\.|127\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n));
if (fueraDeRed.length) {
  console.warn(`AVISO: ${fueraDeRed.join(", ")} no es una dirección de red interna; los navegadores no la aceptarán con esta autoridad.`);
}
console.log(`Certificado del servidor listo (vence ${new Date(leido.validTo).toLocaleDateString("es-MX")}) para:`);
for (const n of validos) console.log(`   ${n}`);
