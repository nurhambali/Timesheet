import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { prisma } from '../lib/prisma'
import * as fs from 'fs'
import path from 'path'

// Force IDE to ignore property errors by casting to any
const db = prisma as any

export const clientRoutes = new Elysia({ prefix: '/clients' })
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

    const user = await db.user.findUnique({
      where: { id: String(payload.id) },
      select: { id: true, email: true, name: true, role: true }
    })

    return { user }
  })
  .get('/', async ({ user, set }) => {
    if (!user) {
      set.status = 401
      return { success: false, message: 'Unauthorized' }
    }

    const isAdmin = String(user.role).toUpperCase() === 'ADMIN'
    
    const templates = await db.customer.findMany({
      where: isAdmin ? {} : { userId: user.id },
      include: { user: { select: { name: true } } },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' }
      ]
    })

    return { success: true, data: templates }
  })
  .post('/', async ({ user, set, body }) => {
    if (!user) {
      set.status = 401
      return { success: false, message: 'Unauthorized' }
    }

    const { name, userId } = body as { name: string, userId?: string }

    try {
      let targetUserId = userId;
      if (String(user.role).toUpperCase() !== 'ADMIN') {
        targetUserId = user.id;
      } else if (userId === 'all') {
        targetUserId = undefined;
      }

      const template = await db.customer.create({
        data: { name, userId: targetUserId }
      })
      return { success: true, data: template }
    } catch (error: any) {
      set.status = 400
      return { success: false, message: 'Template already exists or invalid data' }
    }
  }, {
    body: t.Object({
      name: t.String(),
      userId: t.Optional(t.Nullable(t.String()))
    })
  })
  .post('/:id/set-default', async ({ user, set, params: { id } }) => {
    if (!user) {
      set.status = 401
      return { success: false, message: 'Unauthorized' }
    }

    try {
      const template = await db.customer.findUnique({ where: { id } })
      if (!template) {
        set.status = 404
        return { success: false, message: 'Template not found' }
      }

      // Reset semua default untuk user ini
      await db.customer.updateMany({
        where: { userId: template.userId },
        data: { isDefault: false }
      })

      // Set template ini jadi default
      await db.customer.update({
        where: { id },
        data: { isDefault: true }
      })

      return { success: true, message: 'Default template updated' }
    } catch (error) {
      set.status = 500
      return { success: false, message: 'Failed to update default template' }
    }
  })
  .delete('/:id', async ({ user, set, params: { id } }) => {
    if (!user) {
      set.status = 401
      return { success: false, message: 'Unauthorized' }
    }

    try {
      const template = await db.customer.findUnique({ where: { id } })
      if (template?.templateFile) {
        const filePath = path.resolve(process.cwd(), '../../uploads/templates', template.templateFile)
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      }

      await db.customer.delete({ where: { id } })
      return { success: true, message: 'Template deleted' }
    } catch (error) {
      set.status = 404
      return { success: false, message: 'Template not found' }
    }
  })
  .post('/:id/template', async ({ user, set, params: { id }, body }) => {
    if (!user) {
      set.status = 401
      return { success: false, message: 'Unauthorized' }
    }

    const { file } = body as { file: File }
    if (!file) {
      set.status = 400
      return { success: false, message: 'No file uploaded' }
    }

    try {
      const template = await db.customer.findUnique({ where: { id } })
      if (!template) {
        set.status = 404
        return { success: false, message: 'Template not found' }
      }

      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      
      const uploadDir = path.resolve(process.cwd(), '../../uploads/templates')
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true })
      }

      const fileName = `template_${template.id}_${Date.now()}.xlsx`
      const filePath = path.join(uploadDir, fileName)
      
      if (template.templateFile) {
        const oldPath = path.join(uploadDir, template.templateFile)
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
      }

      fs.writeFileSync(filePath, buffer)

      await db.customer.update({
        where: { id },
        data: { templateFile: fileName }
      })

      return { success: true, message: 'Template file uploaded successfully' }
    } catch (error: any) {
      set.status = 500
      return { success: false, message: 'Failed to upload: ' + error.message }
    }
  }, {
    body: t.Object({
      file: t.File()
    })
  })
  .put('/:id/mapping', async ({ user, set, params: { id }, body }) => {
    if (!user) {
      set.status = 401
      return { success: false, message: 'Unauthorized' }
    }

    try {
      const { mapping, userId, name } = body as { mapping?: any, userId?: string, name?: string }
      
      await db.customer.update({
        where: { id },
        data: { 
          mapping: mapping ? JSON.stringify(mapping) : undefined,
          userId,
          name
        }
      })
      return { success: true, message: 'Template updated' }
    } catch (error) {
      set.status = 500
      return { success: false, message: 'Failed to update template' }
    }
  }, {
    body: t.Object({
      mapping: t.Optional(t.Any()),
      userId: t.Optional(t.Nullable(t.String())),
      name: t.Optional(t.String())
    })
  })
  .get('/:id/preview', async ({ user, set, params: { id } }) => {
    if (!user) {
      set.status = 401
      return { success: false, message: 'Unauthorized' }
    }

    try {
      const template = await db.customer.findUnique({ where: { id } })
      if (!template || !template.templateFile) {
        set.status = 404
        return { success: false, message: 'Template file not found' }
      }

      const filePath = path.resolve(process.cwd(), '../../uploads/templates', template.templateFile)
      if (!fs.existsSync(filePath)) {
        set.status = 404
        return { success: false, message: 'File not found on disk' }
      }

      const ExcelJS = require('exceljs')
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.readFile(filePath)
      const worksheet = workbook.getWorksheet(1)
      
      const previewData: any[] = []
      // Ambil 25 baris pertama untuk preview
      worksheet.eachRow({ includeEmpty: true }, (row: any, rowNumber: number) => {
        if (rowNumber <= 25) {
          const rowData: any = { _row: rowNumber }
          row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
            if (colNumber <= 15) { // Batasi 15 kolom saja (A-O)
              const colLetter = worksheet.getColumn(colNumber).letter
              rowData[colLetter] = cell.value?.toString() || ''
            }
          })
          previewData.push(rowData)
        }
      })

      return { success: true, data: previewData }
    } catch (error: any) {
      set.status = 500
      return { success: false, message: 'Gagal memproses preview: ' + error.message }
    }
  })
  .get('/users', async ({ user, set }) => {
    if (!user || String(user.role).toUpperCase() !== 'ADMIN') {
      set.status = 403
      return { success: false, message: 'Forbidden' }
    }
    const users = await db.user.findMany({
      select: { id: true, name: true, email: true, telegramUsername: true },
      orderBy: { name: 'asc' }
    })
    return { success: true, data: users }
  })
