import { requireUser } from "@/lib/auth";
import { CANAL_GENERAL, getConversaciones, puedeVerCanal } from "@/lib/mensajes";
import { ChatPanel } from "@/components/mensajes/ChatPanel";

// Mensajes entre usuarios: un canal General para todos y conversaciones
// directas entre dos personas (ver lib/mensajes.ts).
export default async function MensajesPage({ searchParams }: { searchParams?: { con?: string } }) {
  const user = await requireUser();
  const conversaciones = await getConversaciones(user.userId);
  const pedido = searchParams?.con ?? CANAL_GENERAL;
  const canal = puedeVerCanal(user.userId, pedido) ? pedido : CANAL_GENERAL;
  return <ChatPanel userId={user.userId} conversaciones={conversaciones} canalInicial={canal} />;
}
