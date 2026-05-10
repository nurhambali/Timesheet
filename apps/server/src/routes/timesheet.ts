import { Elysia, t } from 'elysia'
import { isAuthenticated } from '../middleware/auth'
import { prisma } from '../lib/prisma'

export const timesheetRoutes = new Elysia({ prefix: '/timesheet' })
  .use(isAuthenticated)
  .post(
    '/',
    async ({ body, user, set }) => {
      const { project, startTime, endTime, activity, duration, date, note, source } = body

      try {
        const entry = await prisma.timesheet.create({
          data: {
            userId: user!.id,
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
  .get(
    '/',
    async ({ user }) => {
      const entries = await prisma.timesheet.findMany({
        where: { userId: user!.id },
        orderBy: { date: 'desc' },
      })

      return {
        success: true,
        data: entries,
      }
    }
  )
  .put(
    '/:id',
    async ({ params: { id }, body, user, set }) => {
      try {
        const entry = await prisma.timesheet.update({
          where: { id, userId: user!.id },
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
      try {
        await prisma.timesheet.delete({
          where: { id, userId: user!.id },
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
