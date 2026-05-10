import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { jwt } from "@elysiajs/jwt";
import { authRoutes } from "./routes/auth";
import { userRoutes } from "./routes/user";
import { timesheetRoutes } from "./routes/timesheet";
import { settingsRoutes } from "./routes/settings";
import { holidayRoutes } from "./routes/holiday";
import { clientRoutes } from "./routes/client";

import { startBot } from "./lib/bot";

const port = process.env.PORT || 4000;

const app = new Elysia()
  .use(cors())
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'super-secret-key-change-me',
    })
  )
  .get("/", () => "Timesheet API is running")
  .use(authRoutes)
  .use(userRoutes)
  .use(timesheetRoutes)
  .use(settingsRoutes)
  .use(holidayRoutes)
  .use(clientRoutes)
  .listen(port);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

// Start Telegram Bot with safety wrapper
try {
  startBot();
} catch (error) {
  console.error('❌ Failed to start Telegram Bot (likely 409 Conflict):', error);
  console.log('💡 Server will continue running without bot features.');
}

// Graceful shutdown
const handleExit = async () => {
  console.log('\n🛑 Shutting down server...');
  try {
    const { stopBot } = await import("./lib/bot");
    await stopBot();
  } catch (err) {}
  process.exit(0);
};

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
