import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { seedDefaultUsers } from "./domain/userStore";

async function start() {
  await seedDefaultUsers();
  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, "server_started");
  });
}

start().catch((err) => {
  logger.fatal({ err }, "server_start_failed");
  process.exit(1);
});
