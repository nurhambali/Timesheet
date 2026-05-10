import { Elysia, t } from 'elysia'
import { prisma } from '../lib/prisma'
import { restartBot } from '../lib/bot'
import { isAuthenticated } from '../middleware/auth'
import * as fs from 'fs'
import path from 'path'

export const settingsRoutes = (app: Elysia) => 
  app
    .use(isAuthenticated)
    .group('/settings', (app) => app
      .get('/', async () => {
        const settings = await prisma.setting.findMany()
        const data = settings.reduce((acc, curr) => {
          acc[curr.key] = curr.value
          return acc
        }, {} as Record<string, string>)
        return { success: true, data }
      })
      .post('/', async ({ user, set, body }) => {
        if (user!.role !== 'ADMIN') { set.status = 403; return { success: false, message: 'Forbidden' } }
        try {
          const updates = Object.entries(body as Record<string, string>).map(async ([key, value]) => {
            return prisma.setting.upsert({
              where: { key },
              update: { value: String(value) },
              create: { key, value: String(value) },
            })
          })
          await Promise.all(updates)
          if ((body as any).TELEGRAM_BOT_TOKEN) restartBot()
          return { success: true, message: 'Settings saved' }
        } catch (error: any) {
          set.status = 500; return { success: false, message: 'Failed to save settings: ' + error.message }
        }
      }, {
        body: t.Record(t.String(), t.Any())
      })
      .post('/upload-template', async ({ body, set }) => {
        const { file } = body as { file: File }
        if (!file) { set.status = 400; return { success: false, message: 'No file uploaded' } }
        try {
          const arrayBuffer = await file.arrayBuffer()
          const templatePath = path.resolve(process.cwd(), '../../master.xlsx')
          fs.writeFileSync(templatePath, Buffer.from(arrayBuffer))
          return { success: true, message: 'Template uploaded successfully' }
        } catch (error: any) {
          set.status = 500; return { success: false, message: 'Failed to upload template: ' + error.message }
        }
      }, {
        body: t.Object({ file: t.File() })
      })
    )
