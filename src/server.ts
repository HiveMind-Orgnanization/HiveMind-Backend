import { loadConfig } from "./config/env";
import { buildApp } from "./app";
import { initStore, closeStore } from "./services/store";

async function main() {
  const cfg = loadConfig();
  await initStore(cfg);
  const { app } = await buildApp(cfg);

  const shutdown = async () => {
    try {
      await app.close();
    } catch {
      /* ignore */
    }
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());

  await app.listen({ port: cfg.PORT, host: cfg.HOST });
}

main().catch(async (err) => {
  console.error(err);
  await closeStore();
  process.exit(1);
});
