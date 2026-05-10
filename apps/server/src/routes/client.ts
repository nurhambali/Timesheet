import { Elysia, t } from 'elysia'
import { prisma } from '../lib/prisma'
import { isAuthenticated } from '../middleware/auth'
import * as fs from 'fs'
import path from 'path'

const db = prisma as any

export const clientRoutes = (app: Elysia) => 
  app
    .use(isAuthenticated)
    .group('/clients', (app) => app
      .get('/', async ({ user }) => {
        const isAdmin = user!.role === 'ADMIN'
        const templates = await db.customer.findMany({
          where: isAdmin ? {} : { userId: user!.id },
          include: { user: { select: { name: true } } },
          orderBy: [{ isDefault: 'desc' }, { name: 'asc' }]
        })
        return { success: true, data: templates }
      })
      .post('/', async ({ body, user }) => {
        const { name, templateFile, mapping, isDefault } = body
        if (isDefault) await db.customer.updateMany({ where: { userId: user!.id }, data: { isDefault: false } })
        const client = await db.customer.create({
          data: { name, templateFile, mapping, isDefault, userId: user!.id }
        })
        return { success: true, data: client }
      }, {
        body: t.Object({
          name: t.String(),
          templateFile: t.Optional(t.String()),
          mapping: t.Optional(t.String()),
          isDefault: t.Optional(t.Boolean())
        })
      })
      .put('/:id', async ({ params: { id }, body, user }) => {
        if (body.isDefault) await db.customer.updateMany({ where: { userId: user!.id }, data: { isDefault: false } })
        const client = await db.customer.update({
          where: { id, userId: user!.id },
          data: body
        })
        return { success: true, data: client }
      }, {
        body: t.Partial(t.Object({
          name: t.String(),
          templateFile: t.String(),
          mapping: t.String(),
          isDefault: t.Boolean()
        }))
      })
      .delete('/:id', async ({ params: { id }, user }) => {
        const client = await db.customer.findUnique({ where: { id, userId: user!.id } })
        if (client?.templateFile) {
          const filePath = path.join(process.cwd(), '../../uploads/templates', client.templateFile)
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
        }
        await db.customer.delete({ where: { id, userId: user!.id } })
        return { success: true, message: 'Client deleted' }
      })
      .post('/upload-template', async ({ body, set }) => {
        const file = (body as any).file as File
        if (!file) { set.status = 400; return { success: false, message: 'No file uploaded' } }
        const fileName = `${Date.now()}-${file.name}`
        const uploadDir = path.join(process.cwd(), '../../uploads/templates')
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
        const filePath = path.join(uploadDir, fileName)
        await Bun.write(filePath, await file.arrayBuffer())
        return { success: true, data: { fileName } }
      })
    )
