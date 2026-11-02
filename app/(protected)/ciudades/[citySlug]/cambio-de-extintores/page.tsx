import { redirect } from "next/navigation";

// Antes era una pantalla solo de extintores; ahora es el registro en lote con
// el tipo «Cambio de extintor» ya elegido.
export default function CambioDeExtintoresPage({ params }: { params: { citySlug: string } }) {
  redirect(`/ciudades/${params.citySlug}/registro-en-lote?tipo=EXTINTOR`);
}
