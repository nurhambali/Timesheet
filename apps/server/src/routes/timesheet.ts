import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { prisma } from '../lib/prisma'
import ExcelJS from 'exceljs'
import * as fs from 'fs'
import path from 'path'

export const timesheetRoutes = new Elysia({ prefix: '/timesheet' })
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
    if (!user) {
      set.status = 401
      return { success: false, message: 'Unauthorized' }
    }

    const isAdmin = String(user.role).toUpperCase() === 'ADMIN'
    
    const entries = await prisma.timesheet.findMany({
      where: isAdmin ? {} : { userId: user.id },
      include: isAdmin ? { user: { select: { name: true, email: true } } } : undefined,
      orderBy: { date: 'desc' },
    })

    return {
      success: true,
      data: entries,
    }
  })
  .post(
    '/export-client',
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401
        return { success: false, message: 'Unauthorized' }
      }

      const { month, clientId } = body
      const [yearStr, monthStr] = month.split('-')
      const year = parseInt(yearStr)
      const monthNum = parseInt(monthStr)

      // 1. Ambil Data
      const entries = await prisma.timesheet.findMany({
        where: {
          userId: user.id,
          date: {
            gte: new Date(year, monthNum - 1, 1),
            lte: new Date(year, monthNum, 0)
          }
        },
        orderBy: { date: 'asc' }
      })

      if (entries.length === 0) {
        set.status = 404
        return { success: false, message: 'No entries found for this month' }
      }

      // 2. Tentukan Template Path
      let templatePath = ''
      let clientName = 'Client'

      if (clientId) {
        const customer = await prisma.customer.findUnique({ where: { id: clientId } })
        if (customer && customer.templateFile) {
          templatePath = path.resolve(process.cwd(), '../../uploads/templates', customer.templateFile)
          clientName = customer.name
        }
      }

      if (!templatePath || !fs.existsSync(templatePath)) {
        templatePath = path.resolve(process.cwd(), '../../master.xlsx')
      }

      console.log('Exporting with template:', templatePath)
      
      if (!fs.existsSync(templatePath)) {
        set.status = 500
        return { success: false, message: 'Template Excel not found on server' }
      }

      try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(templatePath);
        const worksheet = workbook.getWorksheet(1); 
        
        if (!worksheet) {
          throw new Error('Worksheet not found');
        }

        // 3. Isi Header
        const nameCell = worksheet.getCell('C2');
        nameCell.value = user.name;
        
        const periodCell = worksheet.getCell('I3');
        periodCell.value = month;

        // 4. Isi Data (Mulai Baris 10)
        entries.forEach((entry, index) => {
          const rowIdx = 10 + index
          
          // Helper untuk mengisi sel sambil memastikan tidak ada sisa formula yang merusak
          const fillCell = (cellId: string, value: any) => {
            const cell = worksheet.getCell(cellId);
            cell.value = value;
          };

          fillCell(`A${rowIdx}`, entry.date.toLocaleDateString('en-GB'));
          fillCell(`C${rowIdx}`, entry.startTime || '-');
          fillCell(`E${rowIdx}`, entry.endTime || '-');
          fillCell(`F${rowIdx}`, entry.duration);
          fillCell(`G${rowIdx}`, entry.activity);
          
          ['A', 'C', 'E', 'F', 'G'].forEach(col => {
            worksheet.getCell(`${col}${rowIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };
          });
        });

        // 5. Generate Output
        const buffer = await workbook.xlsx.writeBuffer();
        
        set.headers['Content-Type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        set.headers['Content-Disposition'] = `attachment; filename="Timesheet_${user.name}_${clientName}_${month}.xlsx"`
        
        return buffer
      } catch (err: any) {
        console.error('Export Error:', err)
        set.status = 500
        return { success: false, message: 'Export Error: ' + err.message }
      }
    },
    {
      body: t.Object({
        month: t.String(),
        clientId: t.Optional(t.String())
      })
    }
  )
  .post(
    '/',
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401
        return { success: false, message: 'Unauthorized' }
      }

      const { project, startTime, endTime, activity, duration, date, note, source } = body

      try {
        const entry = await prisma.timesheet.create({
          data: {
            userId: user.id,
            project,
            startTime,
            endTime,
            activity,
            duration,
            date: new Date(date),
            note,
            source: source || 'WEB',
          },
        })

        return {
          success: true,
          message: 'Timesheet entry created',
          data: entry,
        }
      } catch (error) {
        set.status = 500
        return { success: false, message: 'Failed to create entry' }
      }
    },
    {
      body: t.Object({
        project: t.Optional(t.String()),
        startTime: t.Optional(t.String()),
        endTime: t.Optional(t.String()),
        activity: t.String({ minLength: 1 }),
        duration: t.Number({ minimum: 0 }),
        date: t.String(), // ISO format
        note: t.Optional(t.String()),
        source: t.Optional(t.Enum({ WEB: 'WEB', TELEGRAM: 'TELEGRAM' })),
      }),
    }
  )
  .put(
    '/:id',
    async ({ params: { id }, body, user, set }) => {
      if (!user) {
        set.status = 401
        return { success: false, message: 'Unauthorized' }
      }

      try {
        const entry = await prisma.timesheet.update({
          where: { id, userId: user.id },
          data: {
            ...body,
            date: body.date ? new Date(body.date) : undefined,
          },
        })

        return {
          success: true,
          message: 'Timesheet entry updated',
          data: entry,
        }
      } catch (error) {
        set.status = 404
        return { success: false, message: 'Entry not found or unauthorized' }
      }
    },
    {
      body: t.Partial(
        t.Object({
          project: t.String(),
          activity: t.String(),
          duration: t.Number(),
          date: t.String(),
          note: t.String(),
        })
      ),
    }
  )
  .delete(
    '/:id',
    async ({ params: { id }, user, set }) => {
      if (!user) {
        set.status = 401
        return { success: false, message: 'Unauthorized' }
      }

      try {
        await prisma.timesheet.delete({
          where: { id, userId: user.id },
        })

        return {
          success: true,
          message: 'Timesheet entry deleted',
        }
      } catch (error) {
        set.status = 404
        return { success: false, message: 'Entry not found or unauthorized' }
      }
    }
  )
  .post(
    '/bulk-delete',
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401
        return { success: false, message: 'Unauthorized' }
      }

      const { ids } = body as { ids: string[] }

      try {
        await prisma.timesheet.deleteMany({
          where: {
            id: { in: ids },
            userId: user.id
          }
        })

        return {
          success: true,
          message: `${ids.length} entries deleted`
        }
      } catch (error) {
        set.status = 500
        return { success: false, message: 'Failed to delete entries' }
      }
    },
    {
      body: t.Object({
        ids: t.Array(t.String())
      })
    }
  )
