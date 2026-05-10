import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { prisma } from '../lib/prisma'

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
