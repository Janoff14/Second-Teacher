import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { seedDefaultUsers } from "./domain/userStore";

const LISTEN_HOST = process.env.HOST ?? "0.0.0.0";

async function start() {
  await seedDefaultUsers();
  const app = createApp();
  app.listen(env.PORT, LISTEN_HOST, () => {
    logger.info(
      {
        port: env.PORT,
        host: LISTEN_HOST,
        env: env.NODE_ENV,
        envPort: process.env.PORT ?? null,
      },
      "server_started",
    );
  });
}

start().catch((err) => {
  logger.fatal({ err }, "server_start_failed");
  process.exit(1);
});
