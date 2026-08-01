// Sem CORS_ALLOWED_ORIGINS configurada, mantém o comportamento histórico
// (reflete qualquer origem) — apropriado pra uma ferramenta interna em dev,
// onde a origem do Electron em dev muda de porta e o app empacotado usa
// file://. Definir a env var restringe a uma lista fixa, recomendado antes
// de expor a API fora da rede local.
export function parseAllowedOrigins(raw: string): string[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

// Usado tanto pelo plugin de CORS principal quanto pela rota /admin/stream
// (que faz reply.hijack() e por isso não passa pelo onSend do plugin,
// precisando ecoar o header de CORS manualmente — ver monitor.routes.ts).
export function resolveCorsOrigin(origin: string | undefined, allowedOrigins: string[] | null): string | null {
  if (!origin) return null;
  if (allowedOrigins === null) return origin;
  return allowedOrigins.includes(origin) ? origin : null;
}
