import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { authRoutes } from "./routes/auth";
import { userRoutes } from "./routes/user";

const app = new Elysia()
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'super-secret-key-change-me',
    })
  )
  .get("/", () => "Timesheet API is running")
  .use(authRoutes)
  .use(userRoutes)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
