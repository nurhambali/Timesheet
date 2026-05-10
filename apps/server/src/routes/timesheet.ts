import { Elysia, t } from 'elysia'
import { prisma } from '../lib/prisma'
import { isAuthenticated } from '../middleware/auth'
import ExcelJS from 'exceljs'
import * as fs from 'fs'
import path from 'path'
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'

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

function smartReplace(cell: ExcelJS.Cell, newValue: string) {
  const currentVal = cell.value?.toString() || ''
  if (currentVal.includes('...')) {
    cell.value = currentVal.replace(/\.{3,}/g, newValue)
  } else {
    cell.value = newValue
  }
}

export const timesheetRoutes = (app: Elysia) => 
  app
    .use(isAuthenticated)
    .group('/timesheet', (app) => app
      .get('/', async ({ user }) => {
        const isAdmin = user!.role === 'ADMIN'
        const entries = await db.timesheet.findMany({ 
          where: isAdmin ? {} : { userId: user!.id }, 
          orderBy: { date: 'desc' } 
        })
        return { success: true, data: entries }
      })
      .post('/export-client', async ({ body, user, set }) => {
        try {
          const { month, clientId } = body
          const [yearStr, monthStr] = month.split('-')
          const year = parseInt(yearStr); const monthNum = parseInt(monthStr)
          
          const startDate = new Date(Date.UTC(year, monthNum - 1, 1))
          const endDate = new Date(Date.UTC(year, monthNum, 0))

          const [entries, holidays] = await Promise.all([
            db.timesheet.findMany({ where: { userId: user!.id, date: { gte: startDate, lte: endDate } }, orderBy: { date: 'asc' } }),
            db.holiday.findMany({ where: { date: { gte: startDate, lte: endDate } } })
          ])

          const holidayMap: Record<string, string> = {}
          holidays.forEach((h: any) => {
            const d = new Date(h.date)
            const yStr = d.getUTCFullYear(); const mStr = String(d.getUTCMonth() + 1).padStart(2, '0'); const dStr = String(d.getUTCDate()).padStart(2, '0')
            holidayMap[`${yStr}-${mStr}-${dStr}`] = h.title
          })

          let templatePath = ''; 
          let mapping = { name: 'C2', period: 'I3', startDateCell: '', endDateCell: '', startRow: 10, dateCol: 'A', startCol: 'C', endCol: 'E', durationCol: 'F', activityCol: 'G' }
          
          if (clientId) {
            const customer = await db.customer.findUnique({ where: { id: clientId } })
            if (customer && customer.mapping) {
              try { 
                mapping = { ...mapping, ...JSON.parse(customer.mapping) }
                if (customer.templateFile) templatePath = path.resolve(process.cwd(), '../../uploads/templates', customer.templateFile)
              } catch (e) {}
            }
          }

          if (!templatePath || !fs.existsSync(templatePath)) templatePath = path.resolve(process.cwd(), '../../master.xlsx')

          const workbook = new ExcelJS.Workbook()
          await workbook.xlsx.readFile(templatePath)
          const worksheet = workbook.getWorksheet(1)
          if (!worksheet) throw new Error('Template bermasalah')

          if (mapping.name) {
            smartReplace(worksheet.getCell(mapping.name), user!.name)
          }

          const fmtDate = (d: Date) => {
            const dd = String(d.getUTCDate()).padStart(2, '0')
            const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
            const yyyy = d.getUTCFullYear()
            return `${mm}/${dd}/${yyyy}`
          }

          if (mapping.startDateCell && mapping.endDateCell) {
            smartReplace(worksheet.getCell(mapping.startDateCell), fmtDate(startDate))
            smartReplace(worksheet.getCell(mapping.endDateCell), fmtDate(endDate))
          } else if (mapping.period) {
            smartReplace(worksheet.getCell(mapping.period), `${fmtDate(startDate)} s/d ${fmtDate(endDate)}`)
          }

          const mappedCols = [mapping.dateCol, mapping.startCol, mapping.endCol, mapping.durationCol, mapping.activityCol].filter(Boolean)
          const colNums = mappedCols.map(c => colToNumber(c))
          const startColNum = Math.min(...colNums, colToNumber('A'))
          const endColNum = Math.max(...colNums)

          // --- LOGIKA BARU: LOOP SEMUA HARI DALAM BULAN ---
          const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate })
          let currentRowIdx = Number(mapping.startRow) || 10

          daysInMonth.forEach((dayDate) => {
            const y = dayDate.getUTCFullYear(); const m = dayDate.getUTCMonth(); const d = dayDate.getUTCDate()
            const dayOfWeek = dayDate.getUTCDay()
            const dateKey = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            const holidayName = holidayMap[dateKey]
            const isSatSun = dayOfWeek === 0 || dayOfWeek === 6
            const isOffDay = isSatSun || !!holidayName

            // Cari semua aktivitas user di tanggal ini
            const dayEntries = entries.filter((e: any) => {
              const ed = new Date(e.date)
              return ed.getUTCFullYear() === y && ed.getUTCMonth() === m && ed.getUTCDate() === d
            })

            // 1. TAMBAHKAN BARIS DASAR (WEEKEND/LIBUR/DATA KOSONG)
            const addBaseRow = () => {
              const row = worksheet.getRow(currentRowIdx)
              
              // Styling Merah jika Libur
              for (let c = startColNum; c <= endColNum; c++) {
                const cell = row.getCell(c)
                if (cell.type !== ExcelJS.ValueType.Formula) {
                  cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }
                  cell.alignment = { horizontal: 'center', vertical: 'middle' }
                }
                if (isOffDay) {
                  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } }
                  cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
                }
              }

              if (mapping.dateCol) {
                const c = row.getCell(colToNumber(mapping.dateCol))
                c.value = new Date(Date.UTC(y, m, d)); c.numFmt = 'mm/dd/yyyy'
              }

              if (isOffDay) {
                if (mapping.startCol) row.getCell(colToNumber(mapping.startCol)).value = '-'
                if (mapping.endCol) row.getCell(colToNumber(mapping.endCol)).value = '-'
                if (mapping.durationCol) {
                  const cell = row.getCell(colToNumber(mapping.durationCol))
                  if (cell.type !== ExcelJS.ValueType.Formula) cell.value = 0
                }
                if (mapping.activityCol) row.getCell(colToNumber(mapping.activityCol)).value = holidayName ? holidayName.toUpperCase() : 'WEEKEND'
              }
              
              currentRowIdx++
            }

            // Jika hari ini libur, tambahkan baris keterangan liburnya dulu
            if (isOffDay) {
              addBaseRow()
            } else if (dayEntries.length === 0) {
              // Jika hari kerja tapi tidak ada data, tambahkan baris kosong (opsional, tapi biasanya timesheet butuh semua tanggal)
              addBaseRow()
            }

            // 2. TAMBAHKAN BARIS AKTIVITAS USER (LEMBUR ATAU KERJA BIASA)
            dayEntries.forEach((entry: any) => {
              const row = worksheet.getRow(currentRowIdx)
              
              for (let c = startColNum; c <= endColNum; c++) {
                const cell = row.getCell(c)
                if (cell.type !== ExcelJS.ValueType.Formula) {
                  cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }
                  cell.alignment = { horizontal: 'center', vertical: 'middle' }
                }
                // Tetap Merah jika hari ini Libur/Weekend
                if (isOffDay) {
                  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } }
                  cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
                }
              }

              if (mapping.dateCol) {
                const c = row.getCell(colToNumber(mapping.dateCol))
                c.value = new Date(Date.UTC(y, m, d)); c.numFmt = 'mm/dd/yyyy'
              }

              if (mapping.startCol) row.getCell(colToNumber(mapping.startCol)).value = entry.startTime
              if (mapping.endCol) row.getCell(colToNumber(mapping.endCol)).value = entry.endTime
              if (mapping.durationCol) {
                const cell = row.getCell(colToNumber(mapping.durationCol))
                if (cell.type !== ExcelJS.ValueType.Formula) cell.value = entry.duration
              }
              if (mapping.activityCol) row.getCell(colToNumber(mapping.activityCol)).value = entry.activity

              currentRowIdx++
            })
          })

          const buffer = await workbook.xlsx.writeBuffer()
          set.headers['Content-Type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          set.headers['Content-Disposition'] = `attachment; filename="Timesheet_${month}.xlsx"`
          return buffer
        } catch (err: any) {
          console.error('EXPORT ERROR:', err)
          set.status = 500; return { success: false, message: 'Gagal Export' }
        }
      }, { body: t.Object({ month: t.String(), clientId: t.Optional(t.String()) }) })
      .post('/bulk-delete', async ({ body, user }) => {
        const { ids } = body as { ids: string[] }
        await db.timesheet.deleteMany({ where: { id: { in: ids }, userId: user!.id } })
        return { success: true, message: 'Deleted' }
      }, { body: t.Object({ ids: t.Array(t.String()) }) })
      .post('/', async ({ body, user }) => {
        const { project, startTime, endTime, activity, duration, date, note, source } = body
        const entry = await db.timesheet.create({ 
          data: { userId: user!.id, project, startTime, endTime, activity, duration, date: new Date(date), note, source: source || 'WEB' } 
        })
        return { success: true, data: entry }
      }, { body: t.Object({ project: t.Optional(t.String()), startTime: t.Optional(t.String()), endTime: t.Optional(t.String()), activity: t.String(), duration: t.Number(), date: t.String(), note: t.Optional(t.String()), source: t.Optional(t.String()) }) })
      .put('/:id', async ({ params: { id }, body, user }) => {
        const entry = await db.timesheet.update({ 
          where: { id, userId: user!.id }, 
          data: { ...body, date: body.date ? new Date(body.date) : undefined } 
        })
        return { success: true, data: entry }
      }, { body: t.Partial(t.Object({ project: t.String(), activity: t.String(), duration: t.Number(), date: t.String(), note: t.String(), startTime: t.String(), endTime: t.String() })) })
      .delete('/:id', async ({ params: { id }, user }) => {
        await db.timesheet.delete({ where: { id, userId: user!.id } })
        return { success: true, message: 'Deleted' }
      })
    )
