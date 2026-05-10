import { Elysia } from 'elysia'
import { prisma } from '../lib/prisma'
import { isAuthenticated } from '../middleware/auth'

export const userRoutes = new Elysia({ prefix: '/user' })
  .use(isAuthenticated)
  .get('/me', (ctx: any) => {
    return { success: true, data: ctx.user }
  })
  .get('/', async (ctx: any) => {
    const { user, set } = ctx
    
    if (!user || user.role !== 'ADMIN') {
      set.status = 403
      return { success: false, message: 'Forbidden: Admin access only' }
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        telegramId: true,
      },
      orderBy: { createdAt: 'desc' }
    })

    return { success: true, data: users }
  })
