// Texto de una alerta con el número económico de la unidad resaltado. Los
// mensajes de lib/*-alerts.ts traen el nombre entre comillas ("KG 133", y en
// los de tanque a veces con su etiqueta: "KG 133 — Tanque 2"); aquí se saca el
// número de ahí y se pinta como etiqueta para que se lea de un vistazo de qué
// unidad es cada renglón. Lo que sigue al número dentro de las comillas se
// conserva como texto normal. Si el mensaje no lo trae, se muestra tal cual.
function escapar(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function MensajeDeAlerta({
  texto,
  numeroEconomico,
  level,
}: {
  texto: string | null;
  numeroEconomico: string;
  level: string;
}) {
  if (!texto) return null;

  const coincidencia = new RegExp(`"${escapar(numeroEconomico)}([^"]*)"`).exec(texto);
  if (!coincidencia) return <>{texto}</>;

  const estilo =
    level === "red"
      ? "bg-red-600 text-white"
      : level === "yellow"
        ? "bg-yellow-400 text-yellow-950"
        : "bg-primary text-white";

  return (
    <>
      {texto.slice(0, coincidencia.index)}
      <strong className={`mx-0.5 inline-block rounded px-2 py-0.5 text-sm font-bold tracking-wide ${estilo}`}>
        {numeroEconomico}
      </strong>
      {coincidencia[1]}
      {texto.slice(coincidencia.index + coincidencia[0].length)}
    </>
  );
}
