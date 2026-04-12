import cors from "cors";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { requestContext } from "./middleware/requestContext";
import { authRouter } from "./routes/auth";
import { academicRouter } from "./routes/academic";
import { agentRouter } from "./routes/agent";
import { analyticsRouter } from "./routes/analytics";
import { auditRouter } from "./routes/audit";
import { assessmentsRouter } from "./routes/assessments";
import { insightsRouter } from "./routes/insights";
import { messagesRouter } from "./routes/messages";
import { enrollmentRouter } from "./routes/enrollment";
import { healthRouter } from "./routes/health";
import { protectedRouter } from "./routes/protected";
import { ragRouter } from "./routes/rag";
import { studentRouter } from "./routes/student";
import { usersRouter } from "./routes/users";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(requestContext);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.headers["x-request-id"]?.toString() || req.id,
      customSuccessMessage: () => "request_completed",
    }),
  );
  app.use(
    helmet({
      // Default is `same-origin`, which blocks cross-origin `fetch` from the Next.js app.
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "5mb" }));

  app.use(healthRouter);
  app.use(authRouter);
  app.use(usersRouter);
  app.use(enrollmentRouter);
  app.use(academicRouter);
  app.use(analyticsRouter);
  app.use(assessmentsRouter);
  app.use(insightsRouter);
  app.use(messagesRouter);
  app.use(ragRouter);
  app.use(studentRouter);
  app.use(agentRouter);
  app.use(auditRouter);
  app.use(protectedRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
