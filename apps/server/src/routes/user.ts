import { Elysia, t } from 'elysia'
import { prisma } from '../lib/prisma'
import { isAuthenticated } from '../middleware/auth'

export const userRoutes = (app: Elysia) => 
  app
    .use(isAuthenticated)
    .group('/user', (app) => app
      .get('/me', ({ user }) => {
        return { success: true, data: user }
      })
      .get('/telegram-token', ({ user }) => {
        return { 
          success: true, 
          data: { 
            telegramToken: user!.telegramToken, 
            telegramId: user!.telegramId, 
            telegramUsername: user!.telegramUsername 
          } 
        }
      })
      .post('/telegram-token', async ({ user }) => {
        const token = Math.random().toString(36).substring(2, 8).toUpperCase()
        const updated = await prisma.user.update({
          where: { id: user!.id },
          data: { telegramToken: token }
        })
        return { success: true, data: { telegramToken: updated.telegramToken } }
      })
      .get('/', async ({ user, set }) => {
        if (user!.role !== 'ADMIN') { set.status = 403; return { success: false, message: 'Admin access only' } }
        const users = await prisma.user.findMany({
          select: { id: true, email: true, name: true, role: true, createdAt: true, telegramId: true, telegramUsername: true },
          orderBy: { createdAt: 'desc' }
        })
        return { success: true, data: users }
      })
      .patch('/:id', async ({ user, set, params, body }) => {
        const targetId = params.id === 'me' ? user!.id : params.id
        if (user!.role !== 'ADMIN' && user!.id !== targetId) {
          set.status = 403; return { success: false, message: 'You can only update your own profile' }
        }
        const { telegramId, role, name, email } = body as any
        const updateData: any = {}
        if (telegramId !== undefined) {
          updateData.telegramId = telegramId && telegramId.trim() !== '' ? telegramId.replace('@', '').trim() : null
        }
        if (role && user!.role === 'ADMIN') updateData.role = role
        if (name) updateData.name = name
        if (email) updateData.email = email

        const updatedUser = await prisma.user.update({ where: { id: targetId }, data: updateData })
        return { success: true, message: 'User updated', data: updatedUser }
      })
      .delete('/:id', async ({ user, set, params }) => {
        if (user!.role !== 'ADMIN') { set.status = 403; return { success: false, message: 'Forbidden' } }
        if (user!.id === params.id) { set.status = 400; return { success: false, message: 'Cannot delete yourself' } }
        await prisma.user.delete({ where: { id: params.id } })
        return { success: true, message: 'User deleted' }
      })
    )
