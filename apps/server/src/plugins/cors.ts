import fp from "fastify-plugin";
import cors from "@fastify/cors";

// Ferramenta interna (app de gerência via Electron/Chromium) — origin
// liberado sem lista de allowlist, já que não há usuário final de terceiros
// batendo nesta API.
export default fp(async (app) => {
  await app.register(cors, { origin: true });
});
