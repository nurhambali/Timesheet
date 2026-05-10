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
      select: { id: true, email: true, name: true, role: true, telegramId: true, telegramUsername: true }
    })

    return { user }
  })
  .get('/me', ({ user }) => {
    return { success: true, data: user }
  })
  .get('/telegram-token', async ({ user, set }) => {
    if (!user) {
      set.status = 401
      return { success: false, message: 'Unauthorized' }
    }

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { telegramToken: true, telegramId: true, telegramUsername: true }
    })

    return { success: true, data: userData }
  })
  .post('/telegram-token', async ({ user, set }) => {
    if (!user) {
      set.status = 401
      return { success: false, message: 'Unauthorized' }
    }

    const token = Math.random().toString(36).substring(2, 8).toUpperCase()

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { telegramToken: token }
    })

    return { success: true, data: { telegramToken: updated.telegramToken } }
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
        telegramUsername: true,
      },
      orderBy: { createdAt: 'desc' }
    })

    return { success: true, data: users }
  })
  .patch('/:id', async ({ user, set, params, body }) => {
    if (!user) {
      set.status = 401
      return { success: false, message: 'Unauthorized' }
    }

    const targetId = params.id === 'me' ? user.id : params.id

    // Hanya Admin yang bisa edit orang lain, user biasa hanya bisa edit diri sendiri
    if (String(user.role).toUpperCase() !== 'ADMIN' && user.id !== targetId) {
      set.status = 403
      return { success: false, message: 'Forbidden: You can only update your own profile' }
    }

    const { telegramId, role, name, email } = body as any

    const updateData: any = {}
    if (telegramId !== undefined) {
      updateData.telegramId = telegramId && telegramId.trim() !== '' ? telegramId.replace('@', '').trim() : null
    }
    if (role && String(user.role).toUpperCase() === 'ADMIN') {
      updateData.role = role
    }
    if (name) updateData.name = name
    if (email) updateData.email = email

    const updatedUser = await prisma.user.update({
      where: { id: targetId },
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
