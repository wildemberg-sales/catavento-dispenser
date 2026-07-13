import type { ColumnMapping } from "@catavento/contracts/imports";

type MappableField = "externalRef" | "source" | "priority";

const HEADER_ALIASES: Record<string, MappableField> = {
  sku: "externalRef",
  codigo: "externalRef",
  codigoproduto: "externalRef",
  referencia: "externalRef",
  ref: "externalRef",
  externalref: "externalRef",
  fonte: "source",
  origem: "source",
  marketplace: "source",
  canal: "source",
  source: "source",
  prioridade: "priority",
  priority: "priority",
  urgencia: "priority",
};

const DIACRITICS_REGEX = /[̀-ͯ]/g;

function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "")
    .toLowerCase()
    .replace(/[\s_]+/g, "");
}

export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { externalRef: "", source: "", payloadFields: [] };

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    const field = HEADER_ALIASES[normalized];
    if (field === "externalRef" && !mapping.externalRef) {
      mapping.externalRef = header;
      continue;
    }
    if (field === "source" && !mapping.source) {
      mapping.source = header;
      continue;
    }
    if (field === "priority" && !mapping.priority) {
      mapping.priority = header;
      continue;
    }
    mapping.payloadFields.push(header);
  }

  return mapping;
}
