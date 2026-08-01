import { describe, expect, it } from "vitest";
import { assertSeedAllowed, SeedBlockedInProductionError } from "../src/seed/guard.js";

describe("assertSeedAllowed", () => {
  it("permite seed fora de produção sem precisar de nenhum override", () => {
    expect(() => assertSeedAllowed({ NODE_ENV: "development" })).not.toThrow();
    expect(() => assertSeedAllowed({})).not.toThrow();
  });

  it("bloqueia seed quando NODE_ENV=production sem o opt-in explícito", () => {
    expect(() => assertSeedAllowed({ NODE_ENV: "production" })).toThrow(SeedBlockedInProductionError);
  });

  it("bloqueia mesmo com SEED_ALLOW_PRODUCTION definido como qualquer coisa que não seja a string 'true'", () => {
    expect(() => assertSeedAllowed({ NODE_ENV: "production", SEED_ALLOW_PRODUCTION: "yes" })).toThrow(
      SeedBlockedInProductionError
    );
  });

  it("permite seed em produção quando SEED_ALLOW_PRODUCTION=true é definido explicitamente", () => {
    expect(() =>
      assertSeedAllowed({ NODE_ENV: "production", SEED_ALLOW_PRODUCTION: "true" })
    ).not.toThrow();
  });
});
