// Aislamiento entre ciudades y traspaso de unidades, contra una base TEMPORAL.
//
// La base se crea vacía con las migraciones reales (prisma migrate deploy) en
// la carpeta temporal del sistema, así que estas pruebas no dependen de los
// datos de nadie y NUNCA tocan prisma/dev.db: antes de cargar nada se exige
// que DATABASE_URL apunte dentro de la carpeta temporal.
//
// Qué cubren: que un USUARIO con una ciudad no pueda ver ni tocar otra
// (getAccessibleCities, assertCityAccess y las guardas de Server Actions),
// quién cuenta como editor, y que "Cambiar de ciudad" conserve todo y se
// niegue cuando debe. Que cada acción llame a su guarda lo vigila
// tests/acciones-con-guarda.test.ts.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type Modulos = {
  prisma: typeof import("../lib/prisma").prisma;
  acceso: typeof import("../lib/access");
  traspaso: typeof import("../lib/traspaso-unidades");
  auth: typeof import("../lib/auth");
  roles: typeof import("../lib/roles");
};

let carpeta = "";
let m: Modulos;

const ids = {
  ciudadA: "", ciudadB: "", administracion: "",
  admin: "", usuarioA: "", usuarioAB: "", lector: "", sinCiudad: "",
  unidadA: "", parA: "", repartoA: "", unidadB: "",
};

function usuario(id: string, username: string, role: "ADMIN" | "USUARIO" | "LECTOR") {
  return { userId: id, username, role } as const;
}

async function esNotFound(promesa: Promise<unknown>) {
  await assert.rejects(promesa, (error: unknown) => (error as { digest?: string })?.digest === "NEXT_NOT_FOUND");
}

before(async () => {
  carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "pagasa-prueba-"));
  const archivo = path.join(carpeta, "prueba.db").replace(/\\/g, "/");
  const url = `file:${archivo}`;
  // Candado: jamás correr contra otra base que no sea la temporal.
  assert.ok(path.resolve(archivo).startsWith(path.resolve(os.tmpdir())), "la base de prueba debe ser temporal");
  process.env.DATABASE_URL = url;

  const prismaCli = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  // lib/auth usa cache() de React, que solo existe dentro de Next: fuera de él
  // basta una versión que devuelve la misma función.
  const react = require("react") as { cache?: unknown };
  if (typeof react.cache !== "function") react.cache = <T,>(funcion: T) => funcion;

  // Recién ahora se cargan los módulos: crean su PrismaClient con la URL de arriba.
  m = {
    prisma: (await import("../lib/prisma")).prisma,
    acceso: await import("../lib/access"),
    traspaso: await import("../lib/traspaso-unidades"),
    auth: await import("../lib/auth"),
    roles: await import("../lib/roles"),
  };
  const { prisma } = m;

  const ciudadA = await prisma.city.create({ data: { name: "Ciudad A", slug: "ciudad-a", order: 1 } });
  const ciudadB = await prisma.city.create({ data: { name: "Ciudad B", slug: "ciudad-b", order: 2 } });
  const administracion = await prisma.city.create({ data: { name: "Administración", slug: "administracion", order: 3 } });
  ids.ciudadA = ciudadA.id;
  ids.ciudadB = ciudadB.id;
  ids.administracion = administracion.id;

  // Unidad de distribución con sus apartados en A y en B.
  const apartados: Record<string, Record<string, string>> = { A: {}, B: {} };
  for (const [clave, ciudad] of [["A", ciudadA], ["B", ciudadB]] as const) {
    const padre = await prisma.section.create({
      data: { name: "Unidad de distribución", slug: "unidad-de-distribucion", cityId: ciudad.id },
    });
    for (const [slug, name] of [
      ["auto-tanques", "Auto-Tanques"],
      ["vehiculo-con-tanque-de-carburacion", "Vehículo con tanque de carburación"],
      ["vehiculo-de-reparto", "Vehículo de reparto"],
    ]) {
      const seccion = await prisma.section.create({ data: { name, slug, cityId: ciudad.id, parentId: padre.id } });
      apartados[clave][slug] = seccion.id;
    }
  }
  // Estaciones: cuelgan del mismo padre en A pero NO se pueden traspasar.
  const padreA = await prisma.section.findFirstOrThrow({ where: { cityId: ciudadA.id, slug: "unidad-de-distribucion" } });
  const estaciones = await prisma.section.create({
    data: { name: "Estaciones de carburación", slug: "estaciones-de-carburacion", cityId: ciudadA.id, parentId: padreA.id },
  });

  const crear = (sectionId: string, numeroEconomico: string) =>
    prisma.vehicleRecord.create({ data: { sectionId, numeroEconomico, sucursal: "Prueba" } });
  ids.unidadA = (await crear(apartados.A["auto-tanques"], "KG 100")).id;
  ids.parA = (await crear(apartados.A["vehiculo-con-tanque-de-carburacion"], "KG 100")).id;
  ids.repartoA = (await crear(apartados.A["vehiculo-de-reparto"], "KG 200")).id;
  // En B ya hay un reparto con el mismo número que el de A, escrito distinto.
  ids.unidadB = (await crear(apartados.B["vehiculo-de-reparto"], "kg-200")).id;
  await crear(estaciones.id, "EST 1");

  const nuevo = (username: string, role: string, extra: Record<string, unknown> = {}) =>
    prisma.user.create({ data: { username, passwordHash: "x", role, ...extra } });
  ids.admin = (await nuevo("admin", "ADMIN")).id;
  ids.usuarioA = (await nuevo("usuario-a", "USUARIO")).id;
  ids.usuarioAB = (await nuevo("usuario-ab", "USUARIO")).id;
  ids.lector = (await nuevo("lector", "LECTOR")).id;
  ids.sinCiudad = (await nuevo("sin-ciudad", "USUARIO")).id;
  await prisma.userCityAccess.createMany({
    data: [
      { userId: ids.usuarioA, cityId: ciudadA.id },
      { userId: ids.usuarioAB, cityId: ciudadA.id },
      { userId: ids.usuarioAB, cityId: ciudadB.id },
      { userId: ids.lector, cityId: ciudadA.id },
    ],
  });
});

after(async () => {
  await m?.prisma.$disconnect();
  if (carpeta) fs.rmSync(carpeta, { recursive: true, force: true });
});

describe("acceso por ciudad", () => {
  test("getAccessibleCities: ADMIN ve todas; cada quien solo las suyas", async () => {
    const nombres = async (u: ReturnType<typeof usuario>) => (await m.acceso.getAccessibleCities(u)).map((c) => c.slug);
    assert.deepEqual(await nombres(usuario(ids.admin, "admin", "ADMIN")), ["ciudad-a", "ciudad-b", "administracion"]);
    assert.deepEqual(await nombres(usuario(ids.usuarioA, "usuario-a", "USUARIO")), ["ciudad-a"]);
    assert.deepEqual(await nombres(usuario(ids.usuarioAB, "usuario-ab", "USUARIO")), ["ciudad-a", "ciudad-b"]);
    assert.deepEqual(await nombres(usuario(ids.sinCiudad, "sin-ciudad", "USUARIO")), []);
  });

  test("assertCityAccess (páginas): una ciudad ajena o inexistente sale como 'no encontrada'", async () => {
    const usuarioA = usuario(ids.usuarioA, "usuario-a", "USUARIO");
    assert.equal((await m.acceso.assertCityAccess(usuarioA, "ciudad-a")).slug, "ciudad-a");
    await esNotFound(m.acceso.assertCityAccess(usuarioA, "ciudad-b"));
    await esNotFound(m.acceso.assertCityAccess(usuarioA, "no-existe"));
    await esNotFound(m.acceso.assertCityAccess(usuario(ids.sinCiudad, "sin-ciudad", "USUARIO"), "ciudad-a"));
    // El ADMIN entra a todas, pero una que no existe sigue sin existir.
    assert.equal((await m.acceso.assertCityAccess(usuario(ids.admin, "admin", "ADMIN"), "ciudad-b")).slug, "ciudad-b");
    await esNotFound(m.acceso.assertCityAccess(usuario(ids.admin, "admin", "ADMIN"), "no-existe"));
  });

  test("guardas de Server Actions: un id de otra ciudad se rechaza", async () => {
    const usuarioA = usuario(ids.usuarioA, "usuario-a", "USUARIO");
    const seccionB = await m.prisma.vehicleRecord.findUniqueOrThrow({ where: { id: ids.unidadB }, select: { sectionId: true } });

    await m.acceso.assertVehicleAccess(usuarioA, ids.unidadA);
    await assert.rejects(m.acceso.assertVehicleAccess(usuarioA, ids.unidadB), /No tienes acceso/);
    await assert.rejects(m.acceso.assertSectionAccess(usuarioA, seccionB.sectionId), /No tienes acceso/);
    await assert.rejects(m.acceso.assertCityAccessById(usuarioA, ids.ciudadB), /No tienes acceso/);

    // Quien tiene las dos ciudades, entra a las dos; el ADMIN, a cualquiera.
    const usuarioAB = usuario(ids.usuarioAB, "usuario-ab", "USUARIO");
    await m.acceso.assertVehicleAccess(usuarioAB, ids.unidadB);
    await m.acceso.assertVehicleAccess(usuario(ids.admin, "admin", "ADMIN"), ids.unidadB);
  });

  test("guardas de Server Actions: un id que no existe se rechaza, no pasa de largo", async () => {
    const usuarioA = usuario(ids.usuarioA, "usuario-a", "USUARIO");
    await assert.rejects(m.acceso.assertVehicleAccess(usuarioA, "inventado"), /no existe/);
    await assert.rejects(m.acceso.assertSectionAccess(usuarioA, "inventado"), /no existe/);
    await assert.rejects(m.acceso.assertEquipoAccess(usuarioA, "inventado"), /no existe/);
  });
});

describe("quién puede editar", () => {
  test("canEdit: ADMIN y USUARIO sí; LECTOR no", () => {
    assert.equal(m.roles.canEdit("ADMIN"), true);
    assert.equal(m.roles.canEdit("USUARIO"), true);
    assert.equal(m.roles.canEdit("LECTOR"), false);
  });

  test("edición ampliada: solo ADMIN siempre; USUARIO solo dentro de su horario; LECTOR nunca", async () => {
    const hoy = new Date().getDay();
    const todos = [0, 1, 2, 3, 4, 5, 6];
    assert.equal(await m.auth.tieneEdicionAmpliada(usuario(ids.admin, "admin", "ADMIN")), true);
    assert.equal(await m.auth.tieneEdicionAmpliada(usuario(ids.lector, "lector", "LECTOR")), false);
    // USUARIO sin horario configurado.
    assert.equal(await m.auth.tieneEdicionAmpliada(usuario(ids.usuarioA, "usuario-a", "USUARIO")), false);

    const conHorario = (dias: number[]) =>
      m.prisma.user.update({
        where: { id: ids.usuarioA },
        data: { accesoAmpliadoDias: JSON.stringify(dias), accesoAmpliadoHoraInicio: "00:00", accesoAmpliadoHoraFin: "23:59" },
      });

    await conHorario(todos);
    assert.equal(await m.auth.tieneEdicionAmpliada(usuario(ids.usuarioA, "usuario-a", "USUARIO")), true);
    // El mismo horario pero sin el día de hoy: fuera de ventana.
    await conHorario(todos.filter((d) => d !== hoy));
    assert.equal(await m.auth.tieneEdicionAmpliada(usuario(ids.usuarioA, "usuario-a", "USUARIO")), false);
    // Un LECTOR con horario escrito a mano en la base tampoco lo recibe.
    await m.prisma.user.update({
      where: { id: ids.lector },
      data: { accesoAmpliadoDias: JSON.stringify(todos), accesoAmpliadoHoraInicio: "00:00", accesoAmpliadoHoraFin: "23:59" },
    });
    assert.equal(await m.auth.tieneEdicionAmpliada(usuario(ids.lector, "lector", "LECTOR")), false);
  });
});

describe("cambiar una unidad de ciudad", () => {
  const pedido = (vehicleId: string, destinoCityId: string) => ({
    vehicleId,
    destinoCityId,
    motivo: "prueba",
    userId: ids.admin,
    username: "admin",
  });

  test("solo las unidades de distribución se pueden traspasar", async () => {
    assert.equal(m.traspaso.esApartadoTraspasable("auto-tanques"), true);
    assert.equal(m.traspaso.esApartadoTraspasable("estaciones-de-carburacion"), false);
    assert.equal(m.traspaso.esApartadoTraspasable("planta-ficha-tecnica"), false);

    const estacion = await m.prisma.vehicleRecord.findFirstOrThrow({ where: { numeroEconomico: "EST 1" } });
    const opciones = await m.traspaso.getOpcionesDeTraspaso(estacion.id);
    assert.match(opciones.bloqueo ?? "", /unidades de distribución/);
    const resultado = await m.traspaso.trasladarUnidad(pedido(estacion.id, ids.ciudadB));
    assert.ok("error" in resultado);
  });

  test("las opciones no incluyen la ciudad actual ni Administración, y avisan de la pareja", async () => {
    const opciones = await m.traspaso.getOpcionesDeTraspaso(ids.unidadA);
    assert.equal(opciones.bloqueo, null);
    assert.deepEqual(opciones.ciudades.map((c) => c.name), ["Ciudad B"]);
    assert.equal(opciones.par?.numeroEconomico, "KG 100");
  });

  test("se niega si ya está en esa ciudad, si el destino es Administración o si no existe", async () => {
    const igual = await m.traspaso.trasladarUnidad(pedido(ids.unidadA, ids.ciudadA));
    assert.ok("error" in igual && /ya está en esa ciudad/.test(igual.error));
    const agregada = await m.traspaso.trasladarUnidad(pedido(ids.unidadA, ids.administracion));
    assert.ok("error" in agregada && /Administración/.test(agregada.error));
    const fantasma = await m.traspaso.trasladarUnidad(pedido(ids.unidadA, "inventada"));
    assert.ok("error" in fantasma);
  });

  test("se niega si el destino ya tiene ese número económico (aunque se escriba distinto)", async () => {
    // "KG 200" (A) contra "kg-200" (B).
    const resultado = await m.traspaso.trasladarUnidad(pedido(ids.repartoA, ids.ciudadB));
    assert.ok("error" in resultado && /ya tiene/.test(resultado.error));
    const sigue = await m.prisma.vehicleRecord.findUniqueOrThrow({ where: { id: ids.repartoA }, include: { section: true } });
    assert.equal(sigue.section.cityId, ids.ciudadA);
  });

  test("un traspaso que falla a la mitad no deja nada a medias", async () => {
    // Un usuario inexistente rompe la llave foránea del historial: la
    // transacción entera se deshace y la unidad se queda donde estaba.
    await assert.rejects(
      m.traspaso.trasladarUnidad({ ...pedido(ids.unidadA, ids.ciudadB), userId: "no-existe" })
    );
    const sigue = await m.prisma.vehicleRecord.findUniqueOrThrow({ where: { id: ids.unidadA }, include: { section: true } });
    assert.equal(sigue.section.cityId, ids.ciudadA);
    assert.equal(await m.prisma.traspasoUnidad.count(), 0);
  });

  test("al confirmar, la unidad y su pareja pasan juntas con su ficha, documentos e historial", async () => {
    const bitacora = await m.prisma.maintenanceLog.create({
      data: { vehicleRecordId: ids.unidadA, tipoMantenimiento: "PREVENTIVO", tipoServicio: "INTERNO", fecha: new Date() },
    });
    const seccionOrigen = (await m.prisma.vehicleRecord.findUniqueOrThrow({ where: { id: ids.unidadA } })).sectionId;
    const documento = (extra: Record<string, string>) =>
      m.prisma.document.create({
        data: { sectionId: seccionOrigen, fileName: "a.pdf", storedName: "a.pdf", mimeType: "application/pdf", size: 1, ...extra },
      });
    const deUnidad = await documento({ vehicleRecordId: ids.unidadA });
    const deBitacora = await documento({ maintenanceLogId: bitacora.id });
    const deOtra = await documento({ vehicleRecordId: ids.repartoA });

    const resultado = await m.traspaso.trasladarUnidad(pedido(ids.unidadA, ids.ciudadB));
    assert.ok("ok" in resultado, JSON.stringify(resultado));
    assert.equal(resultado.movidas.length, 2);

    const cityDe = async (id: string) =>
      (await m.prisma.vehicleRecord.findUniqueOrThrow({ where: { id }, include: { section: true } })).section;
    // Cada una en el apartado de su mismo tipo de la ciudad nueva; el id no cambia.
    assert.equal((await cityDe(ids.unidadA)).cityId, ids.ciudadB);
    assert.equal((await cityDe(ids.unidadA)).slug, "auto-tanques");
    assert.equal((await cityDe(ids.parA)).cityId, ids.ciudadB);
    assert.equal((await cityDe(ids.parA)).slug, "vehiculo-con-tanque-de-carburacion");
    // Una que no es de la pareja no se mueve.
    assert.equal((await cityDe(ids.repartoA)).cityId, ids.ciudadA);

    // Los documentos de la unidad y de sus bitácoras cambian de apartado; los de otra unidad no.
    const apartadoDe = async (id: string) => (await m.prisma.document.findUniqueOrThrow({ where: { id } })).sectionId;
    const apartadoNuevo = (await cityDe(ids.unidadA)).id;
    assert.equal(await apartadoDe(deUnidad.id), apartadoNuevo);
    assert.equal(await apartadoDe(deBitacora.id), apartadoNuevo);
    assert.equal(await apartadoDe(deOtra.id), seccionOrigen);
    // La bitácora sigue colgada de la misma unidad.
    assert.equal((await m.prisma.maintenanceLog.findUniqueOrThrow({ where: { id: bitacora.id } })).vehicleRecordId, ids.unidadA);

    // Historial: una fila por unidad movida, a nombre de quien lo hizo.
    const historial = await m.prisma.traspasoUnidad.findMany({ orderBy: { apartadoSlug: "asc" } });
    assert.equal(historial.length, 2);
    assert.ok(historial.every((h) => h.origenCiudadSlug === "ciudad-a" && h.destinoCiudadSlug === "ciudad-b" && h.username === "admin"));
  });
});
