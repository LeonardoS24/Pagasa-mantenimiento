// A qué parte de la página de la unidad lleva cada alerta («Ver unidad →»):
// la de ultrasonido al registro de ultrasonido, la de válvulas al cambio de
// válvulas, etc. Las anclas son los `id` de la página
// (app/(protected)/ciudades/[citySlug]/vehiculo/[vehicleId]/page.tsx); los
// recuadros de la ficha técnica llevan `r-<clave>` (ver propsDeRecuadro).
// Si la sección está minimizada, la página la abre sola al llegar
// (components/city/PlegadoDeSecciones.tsx).

export type TipoDeAncla =
  | "ultrasonido"
  | "visualExterna"
  | "hermeticidad"
  | "visualInterna"
  | "hidrostatica"
  | "extintor"
  | "mantenimiento"
  | "valvulas"
  | "mangueras"
  | "dictamen"
  | "poliza"
  | "valvulasEstacion"
  | "instrumentosPlanta";

export function anclaDeAlerta(tipo: TipoDeAncla | string, sectionSlug: string): string {
  switch (tipo) {
    case "ultrasonido":
      return "#ultrasonido";
    case "visualExterna":
      return "#visual-externa";
    case "hermeticidad":
      return "#hermeticidad";
    case "visualInterna":
      return "#visual-interna";
    case "hidrostatica":
      return "#hidrostatica";
    case "extintor":
      return "#extintor";
    case "mantenimiento":
      return "#mantenimiento";
    case "valvulas":
    case "valvulasEstacion":
    case "instrumentosPlanta":
      return "#valvulas";
    case "mangueras":
      // En carburación las mangueras tienen su registro; en el tanque de
      // carga (manguera de surtir y conector) se capturan en la ficha, en el
      // recuadro de válvulas.
      if (sectionSlug === "estaciones-de-carburacion") return "#valvulas"; // ficha de cada tanque
      return sectionSlug === "vehiculo-con-tanque-de-carburacion" ? "#mangueras" : "#r-valvulas";
    case "dictamen":
      return "#r-dictamenes";
    case "poliza":
      return "#documentacion";
    default:
      // Alertas propias del ADMIN: van al recuadro donde está su campo, si se sabe.
      return tipo.startsWith("#") ? tipo : "";
  }
}

export function enlaceDeAlerta(citySlug: string, vehicleId: string, tipo: TipoDeAncla | string, sectionSlug: string): string {
  return `/ciudades/${citySlug}/vehiculo/${vehicleId}${anclaDeAlerta(tipo, sectionSlug)}`;
}
