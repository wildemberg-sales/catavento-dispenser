import type { ColumnMapping } from "@catavento/contracts/imports";
import type { SourceType } from "@catavento/contracts/queue";

export type ValidatedRow = {
  rowNumber: number;
  externalRef: string | null;
  source: SourceType | null;
  priorityOverride: number | null;
  payload: Record<string, unknown>;
  isValid: boolean;
  rejectionReason: string | null;
};

const SOURCE_VALUE_ALIASES: Record<string, SourceType> = {
  "mercado livre": "mercado_livre",
  mercadolivre: "mercado_livre",
  ml: "mercado_livre",
  mercado_livre: "mercado_livre",
  shopee: "shopee",
  ebay: "ebay",
  "e-bay": "ebay",
};

function normalizeSourceValue(raw: string): SourceType | null {
  const key = raw.trim().toLowerCase();
  return SOURCE_VALUE_ALIASES[key] ?? null;
}

export function validateRow(
  row: Record<string, string>,
  rowNumber: number,
  mapping: ColumnMapping,
  seenRefs: Set<string>
): ValidatedRow {
  const rawExternalRef = mapping.externalRef ? (row[mapping.externalRef] ?? "").trim() : "";
  const rawSource = mapping.source ? (row[mapping.source] ?? "").trim() : "";
  const rawPriority = mapping.priority ? (row[mapping.priority] ?? "").trim() : "";

  const payload: Record<string, unknown> = {};
  for (const field of mapping.payloadFields) {
    payload[field] = row[field] ?? "";
  }

  if (!rawExternalRef) {
    return {
      rowNumber,
      externalRef: null,
      source: null,
      priorityOverride: null,
      payload,
      isValid: false,
      rejectionReason: "Código do produto (external_ref) ausente ou vazio.",
    };
  }

  if (!rawSource) {
    return {
      rowNumber,
      externalRef: rawExternalRef,
      source: null,
      priorityOverride: null,
      payload,
      isValid: false,
      rejectionReason: "Fonte (source) ausente.",
    };
  }

  const source = normalizeSourceValue(rawSource);
  if (!source) {
    return {
      rowNumber,
      externalRef: rawExternalRef,
      source: null,
      priorityOverride: null,
      payload,
      isValid: false,
      rejectionReason: `Fonte desconhecida: '${rawSource}'. Use Mercado Livre, Shopee ou eBay.`,
    };
  }

  let priorityOverride: number | null = null;
  if (rawPriority) {
    const parsed = Number(rawPriority);
    if (!Number.isInteger(parsed)) {
      return {
        rowNumber,
        externalRef: rawExternalRef,
        source,
        priorityOverride: null,
        payload,
        isValid: false,
        rejectionReason: `Prioridade inválida: '${rawPriority}' não é um número inteiro.`,
      };
    }
    priorityOverride = parsed;
  }

  const dedupeKey = `${source}::${rawExternalRef}`;
  if (seenRefs.has(dedupeKey)) {
    return {
      rowNumber,
      externalRef: rawExternalRef,
      source,
      priorityOverride,
      payload,
      isValid: false,
      rejectionReason: "external_ref duplicado no arquivo (mesma fonte já aparece em outra linha).",
    };
  }
  seenRefs.add(dedupeKey);

  return {
    rowNumber,
    externalRef: rawExternalRef,
    source,
    priorityOverride,
    payload,
    isValid: true,
    rejectionReason: null,
  };
}
