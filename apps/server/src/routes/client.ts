import { Elysia, t } from 'elysia'
import { prisma } from '../lib/prisma'
import { isAuthenticated } from '../middleware/auth'
import * as fs from 'fs'
import path from 'path'
import ExcelJS from 'exceljs'

const db = prisma as any

function colToNumber(col: string) {
  if (!col) return 1
  let num = 0;
  const s = col.toString().toUpperCase()
  for (let i = 0; i < s.length; i++) {
    num = num * 26 + s.charCodeAt(i) - 64;
  }
  return num;
}

function numberToCol(num: number) {
  let col = ''
  while (num > 0) {
    let rem = (num - 1) % 26
    col = String.fromCharCode(65 + rem) + col
    num = Math.floor((num - rem) / 26)
  }
  return col
}

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
      .get('/users', async ({ user, set }) => {
        if (user!.role !== 'ADMIN') { set.status = 403; return { success: false, message: 'Forbidden' } }
        const users = await db.user.findMany({ select: { id: true, name: true } })
        return { success: true, data: users }
      })
      .get('/:id/template', async ({ params: { id }, user, set }) => {
        const client = await db.customer.findUnique({ where: { id, userId: user!.id } })
        if (!client || !client.templateFile) {
          const masterPath = path.resolve(process.cwd(), '../../master.xlsx')
          if (fs.existsSync(masterPath)) return Bun.file(masterPath)
          set.status = 404; return 'NOT_FOUND'
        }
        const filePath = path.resolve(process.cwd(), '../../uploads/templates', client.templateFile)
        if (!fs.existsSync(filePath)) {
          set.status = 404; return 'NOT_FOUND'
        }
        return Bun.file(filePath)
      })
      .post('/:id/template', async ({ params: { id }, body, user, set }) => {
        const file = (body as any).file as File
        if (!file) { set.status = 400; return { success: false, message: 'No file uploaded' } }
        const client = await db.customer.findUnique({ where: { id, userId: user!.id } })
        if (!client) { set.status = 404; return { success: false, message: 'Client not found' } }
        const fileName = `${Date.now()}-${file.name}`
        const uploadDir = path.join(process.cwd(), '../../uploads/templates')
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
        const filePath = path.join(uploadDir, fileName)
        await Bun.write(filePath, await file.arrayBuffer())
        await db.customer.update({ where: { id }, data: { templateFile: fileName } })
        return { success: true, data: { fileName } }
      })
      .put('/:id/mapping', async ({ params: { id }, body, user }) => {
        const { mapping } = body as any
        const client = await db.customer.update({
          where: { id, userId: user!.id },
          data: { mapping: JSON.stringify(mapping) }
        })
        return { success: true, data: client }
      })
      // FIX: Kirim JSON Array untuk Preview, bukan file binary
      .get('/:id/preview', async ({ params: { id }, user, set }) => {
        const client = await db.customer.findUnique({ where: { id, userId: user!.id } })
        if (!client) { set.status = 404; return { success: false, message: 'Not Found' } }

        let templatePath = client.templateFile 
          ? path.resolve(process.cwd(), '../../uploads/templates', client.templateFile)
          : path.resolve(process.cwd(), '../../master.xlsx')

        if (!fs.existsSync(templatePath)) {
          templatePath = path.resolve(process.cwd(), '../../master.xlsx')
        }

        if (!fs.existsSync(templatePath)) {
          set.status = 404; return { success: false, message: 'Master template missing' }
        }

        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.readFile(templatePath)
        const worksheet = workbook.getWorksheet(1)
        if (!worksheet) return { success: true, data: [] }

        const rows: any[] = []
        const rowCount = Math.min(worksheet.rowCount, 30) // Ambil 30 baris saja untuk preview
        const colCount = Math.min(worksheet.columnCount, 15) // Ambil 15 kolom saja

        for (let i = 1; i <= rowCount; i++) {
          const rowData: any = { _row: i }
          for (let j = 1; j <= colCount; j++) {
            const colName = numberToCol(j)
            const cellValue = worksheet.getCell(i, j).value
            rowData[colName] = cellValue ? (cellValue as any).toString() : ''
          }
          rows.push(rowData)
        }

        return { success: true, data: rows }
      })
      .post('/:id/set-default', async ({ params: { id }, user }) => {
        await db.customer.updateMany({ where: { userId: user!.id }, data: { isDefault: false } })
        await db.customer.update({ where: { id, userId: user!.id }, data: { isDefault: true } })
        return { success: true }
      })
      .post('/', async ({ body, user }) => {
        const { name, userId } = body as any
        const client = await db.customer.create({
          data: { name, userId: userId || user!.id, mapping: '{}' }
        })
        return { success: true, data: client }
      })
      .put('/:id', async ({ params: { id }, body, user }) => {
        const client = await db.customer.update({
          where: { id, userId: user!.id },
          data: body
        })
        return { success: true, data: client }
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
    )
