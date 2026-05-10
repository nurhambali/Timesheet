import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { prisma } from '../lib/prisma'
import ExcelJS from 'exceljs'
import * as fs from 'fs'
import path from 'path'
import { format, startOfMonth, endOfMonth, isWeekend, parseISO } from 'date-fns'

// Force IDE to ignore property errors by casting to any
const db = prisma as any

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
    
    const entries = await db.timesheet.findMany({
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
      console.log('--- START EXPORT (REFINED) ---')
      if (!user) {
        set.status = 401
        return { success: false, message: 'Unauthorized' }
      }

      try {
        const { month, clientId } = body
        const [yearStr, monthStr] = month.split('-')
        const year = parseInt(yearStr)
        const monthNum = parseInt(monthStr)

        const startDate = startOfMonth(new Date(year, monthNum - 1))
        const endDate = endOfMonth(new Date(year, monthNum - 1))

        // 1. Ambil Data
        const [entries, holidays] = await Promise.all([
          db.timesheet.findMany({
            where: {
              userId: user.id,
              date: { gte: startDate, lte: endDate }
            },
            orderBy: { date: 'asc' }
          }),
          db.holiday.findMany({
            where: {
              date: { gte: startDate, lte: endDate }
            }
          })
        ])

        if (entries.length === 0) {
          set.status = 404
          return { success: false, message: 'No entries found for this month' }
        }

        // Simpan daftar tanggal libur dalam format YYYY-MM-DD
        const holidayDates = holidays.map((h: any) => {
          const d = h.date instanceof Date ? h.date : new Date(h.date)
          return format(d, 'yyyy-MM-dd')
        })

        // 2. Tentukan Template Path
        let templatePath = ''
        let clientName = 'Client'
        let mapping = {
          name: 'C2',
          period: 'I3',
          startRow: 10,
          dateCol: 'A',
          startCol: 'C',
          endCol: 'E',
          durationCol: 'F',
          activityCol: 'G'
        }

        if (clientId) {
          const customer = await db.customer.findUnique({ where: { id: clientId } })
          if (customer) {
            clientName = customer.name
            if (customer.templateFile) {
              templatePath = path.resolve(process.cwd(), '../../uploads/templates', customer.templateFile)
            }
            if (customer.mapping) {
              try {
                mapping = { ...mapping, ...JSON.parse(customer.mapping) }
              } catch (e) {}
            }
          }
        }

        if (!templatePath || !fs.existsSync(templatePath)) {
          templatePath = path.resolve(process.cwd(), '../../master.xlsx')
        }

        if (!fs.existsSync(templatePath)) {
          set.status = 500
          return { success: false, message: 'Template Excel tidak ditemukan di server.' }
        }

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(templatePath);
        const worksheet = workbook.getWorksheet(1); 
        
        if (!worksheet) throw new Error('Worksheet (Sheet 1) tidak ditemukan');

        // 3. Isi Header
        if (mapping.name) worksheet.getCell(mapping.name).value = user.name;
        if (mapping.period) {
          const periodText = `${format(startDate, 'dd MMMM yyyy')} s/d ${format(endDate, 'dd MMMM yyyy')}`
          worksheet.getCell(mapping.period).value = periodText;
        }

        // 4. Isi Data & Styling
        entries.forEach((entry: any, index: number) => {
          const rowIdx = (Number(mapping.startRow) || 10) + index
          
          // Konversi tanggal entry ke string YYYY-MM-DD untuk perbandingan
          const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date)
          const dateStr = format(entryDate, 'yyyy-MM-dd')
          
          const isHoliday = holidayDates.includes(dateStr)
          const isOffDay = isWeekend(entryDate) || isHoliday

          const styleCell = (col: string, val: any, isRed: boolean) => {
            if (!col) return
            const cell = worksheet.getCell(`${col}${rowIdx}`);
            cell.value = val;
            
            // Border Tipis (Selalu ada agar rapi)
            cell.border = {
              top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}
            };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };

            if (isRed) {
              // Background Merah Muda
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFE1E1' }
              };
              // Font Merah Terang (#FF0000)
              cell.font = { color: { argb: 'FFFF0000' }, bold: true };
            } else {
              // Reset ke default jika bukan hari libur (mencegah carry-over style)
              cell.fill = { type: 'pattern', pattern: 'none' };
              cell.font = { color: { argb: 'FF000000' }, bold: false };
            }
          };

          // Isi Kolom Tanggal
          if (mapping.dateCol) {
            const cell = worksheet.getCell(`${mapping.dateCol}${rowIdx}`);
            cell.value = entryDate;
            cell.numFmt = 'dd/mm/yyyy';
            styleCell(mapping.dateCol, entryDate, isOffDay);
          }

          styleCell(mapping.startCol, entry.startTime || '-', isOffDay);
          styleCell(mapping.endCol, entry.endTime || '-', isOffDay);
          styleCell(mapping.durationCol, entry.duration, isOffDay);
          styleCell(mapping.activityCol, entry.activity, isOffDay);
        });

        // 5. PENANGANAN FORMULA (Cara Paling Aman Anti-Corrupt)
        // Kita hanya akan "mengamankan" rumus yang ada di seluruh sheet tanpa menyentuh internal model (_model)
        worksheet.eachRow((row) => {
          row.eachCell((cell) => {
            if (cell.type === ExcelJS.ValueType.Formula) {
              try {
                // Ambil nilai formula dan result-nya
                const f = cell.formula;
                const r = cell.result;
                
                // Jika formula valid, set ulang dengan cara yang bersih
                if (f) {
                  cell.value = { formula: f, result: r };
                } else {
                  // Jika f kosong (shared formula yang rusak), ambil hasil terakhirnya saja agar tidak corrupt
                  cell.value = r;
                }
              } catch (e) {
                // Fallback terakhir: simpan hasilnya saja jika akses formula gagal
                cell.value = cell.result;
              }
            }
          });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        
        console.log('Export Success: ' + clientName)
        set.headers['Content-Type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        set.headers['Content-Disposition'] = `attachment; filename="Timesheet_${user.name}_${month}.xlsx"`
        
        return buffer
      } catch (err: any) {
        console.error('EXPORT FAILED:', err)
        set.status = 500
        return { 
          success: false, 
          message: 'Export gagal: ' + err.message 
        }
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
        const entry = await db.timesheet.create({
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
        const entry = await db.timesheet.update({
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
        await db.timesheet.delete({
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
        await db.timesheet.deleteMany({
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
