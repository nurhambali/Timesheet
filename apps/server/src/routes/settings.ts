import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { prisma } from '../lib/prisma'
import { restartBot } from '../lib/bot'

export const settingsRoutes = new Elysia({ prefix: '/settings' })
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
  .get('/', async ({ user, set }) => {
    if (!user || String(user.role).toUpperCase() !== 'ADMIN') {
      set.status = 403
      return { success: false, message: 'Forbidden' }
    }

    const settings = await prisma.setting.findMany()
    const data = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value
      return acc
    }, {} as Record<string, string>)

    return { success: true, data }
  })
  .post('/', async ({ user, set, body }) => {
    if (!user || String(user.role).toUpperCase() !== 'ADMIN') {
      set.status = 403
      return { success: false, message: 'Forbidden' }
    }

    try {
      const updates = Object.entries(body as Record<string, string>).map(async ([key, value]) => {
        return prisma.setting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      })

      await Promise.all(updates)

      // Restart bot if token changed
      if ((body as any).TELEGRAM_BOT_TOKEN) {
        restartBot()
      }

      return { success: true, message: 'Settings saved' }
    } catch (error: any) {
      set.status = 500
      return { success: false, message: 'Failed to save settings: ' + error.message }
    }
  }, {
    body: t.Record(t.String(), t.Any())
  })
