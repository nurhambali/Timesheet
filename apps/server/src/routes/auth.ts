import { Elysia, t } from 'elysia'
import { cookie } from '@elysiajs/cookie'
import { prisma } from '../lib/prisma'
import { jwtConfig } from '../lib/jwt'

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(jwtConfig)
  .use(cookie())
  .post(
    '/register',
    async ({ body, set }) => {
      const { email, name, password, role, telegramId } = body

      const existingUser = await prisma.user.findUnique({ where: { email } })
      if (existingUser) {
        set.status = 400
        return { success: false, message: 'Email already registered' }
      }

      const hashedPassword = await Bun.password.hash(password)

      try {
        const user = await prisma.user.create({
          data: {
            email,
            name,
            password: hashedPassword,
            role: (role as "USER" | "ADMIN") || 'USER',
            telegramId: telegramId && telegramId.trim() !== '' ? telegramId.replace('@', '').trim() : null,
            telegramToken: crypto.randomUUID(),
          },
        })

        return {
          success: true,
          message: 'User registered successfully',
          data: { id: user.id, email: user.email, name: user.name },
        }
      } catch (err: any) {
        console.error('Register error:', err)
        set.status = 500
        return { success: false, message: 'Server Error: ' + err.message }
      }
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        name: t.String({ minLength: 2 }),
        password: t.String({ minLength: 6 }),
        role: t.Optional(t.String()),
        telegramId: t.Optional(t.String()),
      }),
    }
  )
  .post(
    '/login',
    async ({ body, jwt, cookie: { auth }, set }) => {
      const { email, password } = body

      const user = await prisma.user.findUnique({ where: { email } })
      if (!user) {
        set.status = 401; return { success: false, message: 'Invalid email or password' }
      }

      const isPasswordValid = await Bun.password.verify(password, user.password)
      if (!isPasswordValid) {
        set.status = 401; return { success: false, message: 'Invalid email or password' }
      }

      const token = await jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
      })

      auth.set({
        value: token,
        httpOnly: true,
        maxAge: 7 * 86400,
        path: '/',
      })

      return {
        success: true,
        message: 'Login successful',
        data: {
          token,
          user: { id: user.id, email: user.email, name: user.name, role: user.role },
        },
      }
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String(),
      }),
    }
  )
