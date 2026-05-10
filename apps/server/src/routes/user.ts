import { Elysia } from 'elysia'
import { isAuthenticated } from '../middleware/auth'

export const userRoutes = new Elysia({ prefix: '/user' })
  .use(isAuthenticated)
  .get('/me', ({ user }) => {
    return {
      success: true,
      data: user,
    }
  })
