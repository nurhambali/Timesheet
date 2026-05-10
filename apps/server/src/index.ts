import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { jwt } from "@elysiajs/jwt";
import { authRoutes } from "./routes/auth";
import { userRoutes } from "./routes/user";
import { timesheetRoutes } from "./routes/timesheet";

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
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
