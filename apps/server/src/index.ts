import { Elysia } from "elysia";
import { authRoutes } from "./routes/auth";

const app = new Elysia()
  .get("/", () => "Timesheet API is running")
  .use(authRoutes)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
