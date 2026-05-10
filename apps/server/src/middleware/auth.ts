import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { cookie } from '@elysiajs/cookie'
import { prisma } from '../lib/prisma'

export const isAuthenticated = new Elysia()
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'super-secret-key-change-me',
    })
  )
  .use(cookie())
  .derive(async ({ jwt, cookie: { auth }, headers, set }) => {
    let token = auth.value as string | undefined

    if (!token && headers.authorization?.startsWith('Bearer ')) {
      token = headers.authorization.split(' ')[1]
    }

    if (!token) {
      set.status = 401
      return { user: null }
    }

    const payload = await jwt.verify(token)
    if (!payload) {
      set.status = 401
      return { user: null }
    }

    console.log(`[AUTH] Checking token. Payload ID: ${payload.id}`);

    const user = await prisma.user.findUnique({
      where: { id: payload.id as string },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        telegramId: true,
      },
    })

    if (!user) {
      console.log('[AUTH] User not found in DB for this token');
      set.status = 401
      return { user: null }
    }

    console.log(`[AUTH] User found: ${user.email}, Role: ${user.role}`);
    return { user }
  })
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401
      return { success: false, message: 'Unauthorized' }
    }
  })
