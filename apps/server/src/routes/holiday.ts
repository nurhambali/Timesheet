import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { prisma } from '../lib/prisma'

export const holidayRoutes = new Elysia({ prefix: '/holiday' })
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
  .get('/', async () => {
    const holidays = await prisma.holiday.findMany({
      orderBy: { date: 'asc' }
    })
    return { success: true, data: holidays }
  })
  .post('/', async ({ body, user, set }) => {
    if (!user || String(user.role).toUpperCase() !== 'ADMIN') {
      set.status = 403
      return { success: false, message: 'Forbidden' }
    }

    const { title, date, color } = body as any
    const holiday = await prisma.holiday.create({
      data: {
        title,
        date: new Date(date),
        color: color || '#ef4444'
      }
    })

    return { success: true, data: holiday }
  }, {
    body: t.Object({
      title: t.String(),
      date: t.String(),
      color: t.Optional(t.String())
    })
  })
  .delete('/:id', async ({ params: { id }, user, set }) => {
    if (!user || String(user.role).toUpperCase() !== 'ADMIN') {
      set.status = 403
      return { success: false, message: 'Forbidden' }
    }

    await prisma.holiday.delete({ where: { id } })
    return { success: true, message: 'Holiday deleted' }
  })
