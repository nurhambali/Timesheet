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
    console.log('[AUTH] Derive execution started');
    let token = auth.value as string | undefined

    if (!token && headers.authorization?.startsWith('Bearer ')) {
      token = headers.authorization.split(' ')[1]
    }

    if (!token) {
      set.status = 401
      return { user: null }
    }

    const payload = await jwt.verify(token)
    console.log('[AUTH] Token verified. Full Payload:', JSON.stringify(payload));
    
    if (!payload) {
      set.status = 401
      return { user: null }
    }

    console.log(`[AUTH] Checking token. Payload ID: ${payload.id}`);

    const user = await prisma.user.findUnique({
      where: { id: String(payload.id) },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        telegramId: true,
      },
    })

    if (!user) {
      console.error('[AUTH] User not found in database for ID:', payload.id);
      set.status = 401
      return { user: null }
    }

    // Paksa pastikan role adalah string
    return { 
      user: {
        ...user,
        role: String(user.role)
      }
    }
  })
  .onBeforeHandle(({ user, set, request }) => {
    // Abaikan preflight
    if (request.method === 'OPTIONS') return;

    if (!user) {
      set.status = 401
      return { success: false, message: 'Unauthorized: Please login again' }
    }
  })
