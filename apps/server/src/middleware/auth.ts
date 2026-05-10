import { Elysia } from 'elysia'
import { cookie } from '@elysiajs/cookie'
import { prisma } from '../lib/prisma'
import { jwtConfig } from '../lib/jwt'

export const isAuthenticated = (app: Elysia) => 
  app
    .use(jwtConfig)
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

      const user = await prisma.user.findUnique({
        where: { id: String(payload.id) },
        select: {
          id: true, email: true, name: true, role: true,
          telegramId: true, telegramUsername: true, telegramToken: true,
        },
      })

      if (!user) {
        set.status = 401
        return { user: null }
      }

      return { user }
    })
    .onBeforeHandle(({ user, set, request }) => {
      if (request.method === 'OPTIONS') return;
      if (!user) {
        set.status = 401
        return { success: false, message: 'Unauthorized' }
      }
    })
