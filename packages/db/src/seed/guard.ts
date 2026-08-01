// As credenciais padrão de seed (admin/admin123, operador1/operador123) são
// públicas — estão neste repositório e em qualquer auditoria que o leia. Uma
// vez em produção, ninguém deveria conseguir rodar o seed sem perceber que
// está introduzindo contas com senha conhecida. Bloqueia por padrão quando
// NODE_ENV=production, exigindo o opt-in explícito SEED_ALLOW_PRODUCTION=true.
export class SeedBlockedInProductionError extends Error {
  constructor() {
    super(
      "Seed bloqueado: NODE_ENV=production e as credenciais padrão (admin/admin123, " +
        "operador1/operador123) são públicas. Defina SEED_ALLOW_PRODUCTION=true apenas se " +
        "tiver certeza — e prefira sobrescrever as senhas via SEED_ADMIN_PASSWORD / " +
        "SEED_OPERATOR_PASSWORD nesse caso."
    );
    this.name = "SeedBlockedInProductionError";
  }
}

export function assertSeedAllowed(env: { NODE_ENV?: string; SEED_ALLOW_PRODUCTION?: string }): void {
  if (env.NODE_ENV === "production" && env.SEED_ALLOW_PRODUCTION !== "true") {
    throw new SeedBlockedInProductionError();
  }
}
