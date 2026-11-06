// Formato da "message" enviada a POST /machine-events.
//
// A API atual só guarda machineId, eventType e message. O UUID gerado no
// aparelho vai no fim da mensagem ("Ref. app: <uuid>"). É por ele que o app
// confere se uma ocorrência já chegou ao servidor antes de reenviá-la.
import { eventTypeLabel } from "./occurrenceForm";

export type EventContent = {
  id: string;
  eventType: string;
  description: string;
  sectorId: string;
  sectorName: string | null;
  occurredAt: string;
};

const DETAILS_SEPARATOR = "\n\nTipo: ";
const REF_PATTERN = /Ref\. app: ([0-9a-fA-F-]{36})\s*$/;

export function buildEventMessage(o: EventContent): string {
  const sector = o.sectorName ? `${o.sectorName} (${o.sectorId})` : o.sectorId;
  return (
    `${o.description}${DETAILS_SEPARATOR}${eventTypeLabel(o.eventType)} | Setor: ${sector} | ` +
    `Ocorrido em: ${o.occurredAt} | Ref. app: ${o.id}`
  );
}

/** UUID do aparelho contido na mensagem, ou null se a mensagem não veio do app. */
export function extractClientRef(message: unknown): string | null {
  if (typeof message !== "string") return null;
  const match = REF_PATTERN.exec(message);
  return match ? match[1].toLowerCase() : null;
}

/** Descrição digitada pelo usuário, sem a linha de detalhes. */
export function extractDescription(message: string): string {
  const index = message.lastIndexOf(DETAILS_SEPARATOR);
  return index >= 0 ? message.slice(0, index) : message;
}

/** Compara textos ignorando diferença de quebra de linha e espaços nas pontas. */
export function sameText(a: unknown, b: unknown): boolean {
  const normalize = (v: unknown) =>
    typeof v === "string" ? v.replace(/\r\n/g, "\n").trim() : v;
  return normalize(a) === normalize(b);
}
