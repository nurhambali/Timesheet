import { Elysia, t } from 'elysia'
import { prisma } from '../lib/prisma'
import { isAuthenticated } from '../middleware/auth'
import { restartBot } from '../lib/bot'

export const settingsRoutes = new Elysia({ prefix: '/settings' })
  .use(isAuthenticated)
  .get('/', async (ctx: any) => {
    const { user, set } = ctx
    if (!user || String(user.role).toUpperCase() !== 'ADMIN') {
      set.status = 403
      return { success: false, message: 'Forbidden' }
    }

    const settings = await prisma.setting.findMany()
    const data = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value
      return acc
    }, {})

    return { success: true, data }
  })
  .post('/', async (ctx: any) => {
    const { user, set, body } = ctx
    if (!user || String(user.role).toUpperCase() !== 'ADMIN') {
      set.status = 403
      return { success: false, message: 'Forbidden' }
    }

    try {
      console.log('Incoming settings save:', body)
      const updates = Object.entries(body).map(async ([key, value]) => {
        return prisma.setting.upsert({
          where: { key },
          update: { value: value as string },
          create: { key, value: value as string },
        })
      })

      await Promise.all(updates)

      // Jika yang diupdate adalah bot token, restart bot
      if (body.TELEGRAM_BOT_TOKEN) {
        await restartBot()
      }

      return { success: true, message: 'Settings saved' }
    } catch (err: any) {
      console.error('Settings save error:', err)
      set.status = 500
      return { success: false, message: 'Failed: ' + err.message }
    }
  }, {
    body: t.Object({
      TELEGRAM_BOT_TOKEN: t.Optional(t.String())
    })
  })
