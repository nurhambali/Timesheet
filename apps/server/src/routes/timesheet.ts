import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { prisma } from '../lib/prisma'
import ExcelJS from 'exceljs'
import * as fs from 'fs'
import path from 'path'
import { format, startOfMonth, endOfMonth, isWeekend } from 'date-fns'

// Force IDE to ignore property errors by casting to any
const db = prisma as any

function colToNumber(col: string) {
  let num = 0;
  for (let i = 0; i < col.length; i++) {
    num = num * 26 + col.charCodeAt(i) - 64;
  }
  return num;
}

export const timesheetRoutes = new Elysia({ prefix: '/timesheet' })
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'super-secret-key-change-me',
    })
  )
  .derive(async ({ jwt, headers }) => {
    const authHeader = headers.authorization
    if (!authHeader?.startsWith('Bearer ')) return { user: null }
    const token = authHeader.split(' ')[1]
    const payload = await jwt.verify(token)
    if (!payload || !payload.id) return { user: null }
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
      orderBy: { date: 'desc' },
    })
    return { success: true, data: entries }
  })
  .post('/export-client', async ({ body, user, set }) => {
    if (!user) {
      set.status = 401
      return { success: false, message: 'Unauthorized' }
    }
    try {
      const { month, clientId } = body
      const [yearStr, monthStr] = month.split('-')
      const year = parseInt(yearStr); const monthNum = parseInt(monthStr)
      const startDate = startOfMonth(new Date(year, monthNum - 1))
      const endDate = endOfMonth(new Date(year, monthNum - 1))
      const [entries, holidays] = await Promise.all([
        db.timesheet.findMany({ where: { userId: user.id, date: { gte: startDate, lte: endDate } }, orderBy: { date: 'asc' } }),
        db.holiday.findMany({ where: { date: { gte: startDate, lte: endDate } } })
      ])
      if (entries.length === 0) { set.status = 404; return { success: false, message: 'No entries found' } }
      const holidayMap: Record<string, string> = {}
      holidays.forEach((h: any) => {
        const d = h.date instanceof Date ? h.date : new Date(h.date)
        const y = d.getUTCFullYear(); const m = String(d.getUTCMonth() + 1).padStart(2, '0'); const day = String(d.getUTCDate()).padStart(2, '0')
        holidayMap[`${y}-${m}-${day}`] = h.name
      })
      let templatePath = ''; let mapping = { name: 'C2', period: 'I3', startDateCell: '', endDateCell: '', startRow: 10, dateCol: 'A', startCol: 'C', endCol: 'E', durationCol: 'F', activityCol: 'G' }
      if (clientId) {
        const customer = await db.customer.findUnique({ where: { id: clientId } })
        if (customer && customer.mapping) {
          try { mapping = { ...mapping, ...JSON.parse(customer.mapping) }; if (customer.templateFile) templatePath = path.resolve(process.cwd(), '../../uploads/templates', customer.templateFile) } catch (e) {}
        }
      }
      if (!templatePath || !fs.existsSync(templatePath)) templatePath = path.resolve(process.cwd(), '../../master.xlsx')
      const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile(templatePath); const worksheet = workbook.getWorksheet(1); 
      if (!worksheet) throw new Error('Worksheet not found')
      if (mapping.name) { const nameCell = worksheet.getCell(mapping.name); const currentVal = nameCell.value ? String(nameCell.value) : ''; nameCell.value = currentVal.includes('...') ? currentVal.replace(/\.{3,}/g, user.name) : user.name }
      if (mapping.startDateCell && mapping.endDateCell) { worksheet.getCell(mapping.startDateCell).value = format(startDate, 'dd MMMM yyyy'); worksheet.getCell(mapping.endDateCell).value = format(endDate, 'dd MMMM yyyy') }
      else if (mapping.period) worksheet.getCell(mapping.period).value = `${format(startDate, 'dd MMMM yyyy')} s/d ${format(endDate, 'dd MMMM yyyy')}`
      const mappedCols = [mapping.dateCol, mapping.startCol, mapping.endCol, mapping.durationCol, mapping.activityCol].filter(Boolean)
      const colNums = mappedCols.map(c => colToNumber(c)); const minCol = Math.min(...colNums); const maxCol = Math.max(...colNums)
      entries.forEach((entry: any, index: number) => {
        const rowIdx = (Number(mapping.startRow) || 10) + index
        const rawDate = entry.date instanceof Date ? entry.date : new Date(entry.date)
        const y = rawDate.getUTCFullYear(); const m = rawDate.getUTCMonth(); const d = rawDate.getUTCDate(); const entryDate = new Date(y, m, d, 0, 0, 0)
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const holidayName = holidayMap[dateStr]; const isSatSun = isWeekend(entryDate); const isOffDay = isSatSun || !!holidayName
        let autoText = ''; if (holidayName) autoText = holidayName.toUpperCase(); else if (isSatSun) autoText = 'WEEKEND'
        const row = worksheet.getRow(rowIdx)
        for (let c = minCol; c <= maxCol; c++) {
          const cell = row.getCell(c); cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }; cell.alignment = { horizontal: 'center', vertical: 'middle' }
          if (isOffDay) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } }; cell.font = { color: { argb: 'FFFFFFFF' }, bold: true } }
          else { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; cell.font = { color: { argb: 'FF000000' }, bold: false } }
        }
        if (mapping.dateCol) { const c = worksheet.getCell(`${mapping.dateCol}${rowIdx}`); c.value = entryDate; c.numFmt = 'mm/dd/yyyy' }
        if (mapping.startCol) worksheet.getCell(`${mapping.startCol}${rowIdx}`).value = isOffDay ? '-' : (entry.startTime || '-');
        if (mapping.endCol) worksheet.getCell(`${mapping.endCol}${rowIdx}`).value = isOffDay ? '-' : (entry.endTime || '-');
        if (mapping.durationCol) worksheet.getCell(`${mapping.durationCol}${rowIdx}`).value = isOffDay ? 0 : entry.duration;
        if (mapping.activityCol) { const c = worksheet.getCell(`${mapping.activityCol}${rowIdx}`); c.value = (isOffDay && (!entry.activity || entry.activity === '-')) ? autoText : entry.activity }
      });
      worksheet.eachRow((row) => { row.eachCell((cell) => { if (cell.type === ExcelJS.ValueType.Formula) { try { const f = cell.formula; const r = cell.result; if (f) cell.value = { formula: f, result: r }; else cell.value = r } catch (e) { cell.value = cell.result } } }) });
      const buffer = await workbook.xlsx.writeBuffer(); set.headers['Content-Type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; set.headers['Content-Disposition'] = `attachment; filename="Timesheet_${user.name}_${month}.xlsx"`; return buffer
    } catch (err: any) { console.error('EXPORT FAILED:', err); set.status = 500; return { success: false, message: 'Export gagal: ' + err.message } }
  }, { body: t.Object({ month: t.String(), clientId: t.Optional(t.String()) }) })
  .post('/bulk-delete', async ({ body, user, set }) => {
    if (!user) { set.status = 401; return { success: false, message: 'Unauthorized' } }
    const { ids } = body as { ids: string[] }
    try { await db.timesheet.deleteMany({ where: { id: { in: ids }, userId: user.id } }); return { success: true, message: `${ids.length} entries deleted` } } catch (error) { set.status = 500; return { success: false, message: 'Failed to delete entries' } }
  }, { body: t.Object({ ids: t.Array(t.String()) }) })
  .post('/', async ({ body, user, set }) => {
    if (!user) { set.status = 401; return { success: false, message: 'Unauthorized' } }
    const { project, startTime, endTime, activity, duration, date, note, source } = body
    try { const entry = await db.timesheet.create({ data: { userId: user.id, project, startTime, endTime, activity, duration, date: new Date(date), note, source: source || 'WEB', }, }); return { success: true, message: 'Timesheet entry created', data: entry } } catch (error) { set.status = 500; return { success: false, message: 'Failed to create entry' } }
  }, { body: t.Object({ project: t.Optional(t.String()), startTime: t.Optional(t.String()), endTime: t.Optional(t.String()), activity: t.String({ minLength: 1 }), duration: t.Number({ minimum: 0 }), date: t.String(), note: t.Optional(t.String()), source: t.Optional(t.Enum({ WEB: 'WEB', TELEGRAM: 'TELEGRAM' })), }) })
  .put('/:id', async ({ params: { id }, body, user, set }) => {
    if (!user) { set.status = 401; return { success: false, message: 'Unauthorized' } }
    try { 
      const entry = await db.timesheet.update({ where: { id, userId: user.id }, data: { ...body, date: body.date ? new Date(body.date) : undefined }, }); 
      return { success: true, message: 'Updated', data: entry } 
    } catch (error) { 
      set.status = 404; 
      return { success: false, message: 'Data tidak ditemukan atau bukan milik Anda' } 
    }
  }, { body: t.Partial(t.Object({ project: t.String(), activity: t.String(), duration: t.Number(), date: t.String(), note: t.String(), startTime: t.String(), endTime: t.String() })) })
  .delete('/:id', async ({ params: { id }, user, set }) => {
    if (!user) { set.status = 401; return { success: false, message: 'Unauthorized' } }
    try { 
      await db.timesheet.delete({ where: { id, userId: user.id } }); 
      return { success: true, message: 'Deleted' } 
    } catch (error) { 
      set.status = 404; 
      return { success: false, message: 'Data tidak ditemukan' } 
    }
  })
