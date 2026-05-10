import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { prisma } from '../lib/prisma'

export const userRoutes = new Elysia({ prefix: '/user' })
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'super-secret-key-change-me',
    })
  )
  .derive(async ({ jwt, headers }) => {
    const authHeader = headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return { user: null }
    }

    const token = authHeader.split(' ')[1]
    const payload = await jwt.verify(token)
    
    if (!payload || !payload.id) {
      return { user: null }
    }

    const user = await prisma.user.findUnique({
      where: { id: String(payload.id) },
      select: { id: true, email: true, name: true, role: true }
    })

    return { user }
  })
  .get('/me', ({ user }) => {
    return { success: true, data: user }
  })
  .get('/', async ({ user, set }) => {
    if (!user) {
      set.status = 401
      return { success: false, message: 'Unauthorized' }
    }

    if (String(user.role).toUpperCase() !== 'ADMIN') {
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
  .patch('/:id', async ({ user, set, params, body }) => {
    if (!user || String(user.role).toUpperCase() !== 'ADMIN') {
      set.status = 403
      return { success: false, message: 'Forbidden' }
    }

    const { telegramId, role, name, email } = body as any

    const updateData: any = {}
    if (telegramId !== undefined) {
      updateData.telegramId = telegramId && telegramId.trim() !== '' ? telegramId.replace('@', '').trim() : null
    }
    if (role) updateData.role = role
    if (name) updateData.name = name
    if (email) updateData.email = email

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
    })

    return { success: true, message: 'User updated', data: updatedUser }
  })
  .delete('/:id', async ({ user, set, params }) => {
    if (!user || String(user.role).toUpperCase() !== 'ADMIN') {
      set.status = 403
      return { success: false, message: 'Forbidden' }
    }

    if (user.id === params.id) {
      set.status = 400
      return { success: false, message: 'Admin tidak bisa menghapus dirinya sendiri' }
    }

    await prisma.user.delete({
      where: { id: params.id }
    })

    return { success: true, message: 'User deleted' }
  })
