import { Elysia, t } from 'elysia'
import { prisma } from '../lib/prisma'
import { isAuthenticated } from '../middleware/auth'

export const holidayRoutes = (app: Elysia) => 
  app
    .use(isAuthenticated)
    .group('/holiday', (app) => app
      .get('/', async () => {
        const holidays = await prisma.holiday.findMany({ orderBy: { date: 'asc' } })
        return { success: true, data: holidays }
      })
      .post('/', async ({ body, user, set }) => {
        if (user!.role !== 'ADMIN') { set.status = 403; return { success: false, message: 'Forbidden' } }
        const { title, date, color } = body
        const holiday = await prisma.holiday.create({
          data: { title, date: new Date(date), color: color || '#ef4444' }
        })
        return { success: true, data: holiday }
      }, {
        body: t.Object({
          title: t.String(),
          date: t.String(),
          color: t.Optional(t.String())
        })
      })
      .delete('/:id', async ({ params: { id }, user, set }) => {
        if (user!.role !== 'ADMIN') { set.status = 403; return { success: false, message: 'Forbidden' } }
        await prisma.holiday.delete({ where: { id } })
        return { success: true, message: 'Holiday deleted' }
      })
    )
