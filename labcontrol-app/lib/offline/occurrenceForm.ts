// Regras do formulário de ocorrência, sem dependência de tela (testáveis).
import type { SyncStatus } from "./schema";

export const EVENT_TYPES = [
  { value: "failure", label: "Falha" },
  { value: "warning", label: "Alerta" },
  { value: "maintenance", label: "Manutenção" },
  { value: "note", label: "Observação" },
] as const;

export type EventTypeValue = (typeof EVENT_TYPES)[number]["value"];

export const DESCRIPTION_MIN = 5;
export const DESCRIPTION_MAX = 1000;

export type OccurrenceFormValues = {
  machineId: string;
  machineName: string;
  sectorId: string;
  sectorName: string | null;
  eventType: string;
  description: string;
  /** Data e hora digitadas no formato DD/MM/AAAA HH:mm, no fuso do aparelho. */
  occurredAtText: string;
};

export type ValidatedOccurrence = Omit<OccurrenceFormValues, "occurredAtText"> & {
  occurredAt: string;
};

export type FormErrors = Partial<Record<keyof OccurrenceFormValues, string>>;

const pad = (n: number) => String(n).padStart(2, "0");

/** Formata uma data para o campo do formulário (DD/MM/AAAA HH:mm, hora local). */
export function formatLocalDateTime(date: Date): string {
  return (
    `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Lê DD/MM/AAAA HH:mm na hora local. Retorna null se a data não existir. */
export function parseLocalDateTime(text: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;

  const [, dd, mm, yyyy, hh, min] = match.map(Number);
  const date = new Date(yyyy, mm - 1, dd, hh, min);

  // Rejeita datas que o JS "corrige" sozinho, como 31/02.
  const valid =
    date.getFullYear() === yyyy &&
    date.getMonth() === mm - 1 &&
    date.getDate() === dd &&
    date.getHours() === hh &&
    date.getMinutes() === min;

  return valid ? date : null;
}

/** Margem para relógios levemente adiantados entre aparelho e formulário. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

// Os dois ramos declaram os mesmos campos: o projeto compila sem "strict",
// e sem isso o TypeScript não estreita a união pelo campo "ok".
export type ValidationResult =
  | { ok: true; value: ValidatedOccurrence; errors?: undefined }
  | { ok: false; value?: undefined; errors: FormErrors };

export function validateOccurrence(
  values: OccurrenceFormValues,
  now: Date = new Date()
): ValidationResult {
  const errors: FormErrors = {};
  const description = values.description.trim();

  if (!values.machineId) errors.machineId = "Escolha a máquina.";
  if (!values.sectorId) errors.sectorId = "A máquina escolhida não tem setor.";
  if (!EVENT_TYPES.some((t) => t.value === values.eventType)) {
    errors.eventType = "Escolha o tipo da ocorrência.";
  }

  if (description.length < DESCRIPTION_MIN) {
    errors.description = `Descreva a ocorrência (mínimo de ${DESCRIPTION_MIN} caracteres).`;
  } else if (description.length > DESCRIPTION_MAX) {
    errors.description = `Use no máximo ${DESCRIPTION_MAX} caracteres.`;
  }

  const occurredAt = parseLocalDateTime(values.occurredAtText);
  if (!occurredAt) {
    errors.occurredAtText = "Use o formato DD/MM/AAAA HH:mm.";
  } else if (occurredAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    errors.occurredAtText = "A data não pode estar no futuro.";
  }

  if (Object.keys(errors).length > 0 || !occurredAt) return { ok: false, errors };

  return {
    ok: true,
    value: {
      machineId: values.machineId,
      machineName: values.machineName,
      sectorId: values.sectorId,
      sectorName: values.sectorName,
      eventType: values.eventType,
      description,
      occurredAt: occurredAt.toISOString(),
    },
  };
}

export function eventTypeLabel(value: string): string {
  return EVENT_TYPES.find((t) => t.value === value)?.label ?? value;
}

/**
 * Rótulo exibido para cada estado de envio. Só "synced" diz que foi enviado,
 * e só é gravado depois de o servidor confirmar.
 */
export const SYNC_STATUS_UI: Record<SyncStatus, { label: string; color: string; icon: string }> = {
  pending: { label: "Pendente: ainda não enviada", color: "#B45309", icon: "time-outline" },
  syncing: { label: "Enviando...", color: "#2563EB", icon: "cloud-upload-outline" },
  synced: { label: "Enviada ao servidor", color: "#15803D", icon: "checkmark-circle" },
  failed: { label: "Recusada pelo servidor", color: "#B91C1C", icon: "alert-circle" },
  conflict: { label: "Conflito: revisão necessária", color: "#C2410C", icon: "warning-outline" },
};
