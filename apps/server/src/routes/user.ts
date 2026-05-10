import { Elysia } from 'elysia'
import { prisma } from '../lib/prisma'
import { isAuthenticated } from '../middleware/auth'

export const userRoutes = new Elysia({ prefix: '/user' })
  .use(isAuthenticated)
  .get('/me', (ctx: any) => {
    return { success: true, data: ctx.user }
  })
  .patch('/me', async (ctx: any) => {
    const { user, set, body } = ctx
    if (!user) {
      set.status = 401
      return { success: false, message: 'Unauthorized' }
    }

    const { name, email, telegramId, password } = body
    
    const updateData: any = {}
    if (name) updateData.name = name
    if (email) updateData.email = email
    if (telegramId !== undefined) updateData.telegramId = telegramId || null
    if (password && password.trim() !== '') {
      // Kita asumsikan hashing dilakukan oleh Prisma middleware atau bisa di-hash disini
      const salt = await Bun.password.hash(password)
      updateData.password = salt
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, telegramId: true }
    })

    return { success: true, message: 'Profile updated', data: updatedUser }
  })
  .get('/', async (ctx: any) => {
    const { user, set } = ctx
    
    // Log sangat detail untuk melacak ketidaksinkronan
    console.log('[API-SYNC] User Object in Context:', JSON.stringify(user));

    if (!user) {
      console.error('[API-SYNC] No user found in context! Auth middleware failed?');
      set.status = 401
      return { success: false, message: 'Unauthorized: Session missing' }
    }

    const currentRole = String(user.role || '').toUpperCase();
    console.log(`[API-SYNC] Checking Role. User: ${user.email}, Role in DB/Ctx: ${currentRole}`);

    if (currentRole !== 'ADMIN') {
      console.warn(`[API-SYNC] ACCESS DENIED. Role ${currentRole} is not ADMIN`);
      set.status = 403
      return { 
        success: false, 
        message: 'Forbidden: Admin access only',
        debug_info: { your_role: currentRole } 
      }
    }

    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          telegramId: true,
          telegramToken: true,
        },
        orderBy: { createdAt: 'desc' }
      })

      console.log(`[API-SYNC] Successfully fetched ${users.length} users for admin ${user.email}`);
      return { success: true, data: users }
    } catch (err: any) {
      console.error('[API-SYNC] Database Error:', err.message);
      set.status = 500
      return { success: false, message: 'Database Error: ' + err.message }
    }
  })
  .patch('/:id', async (ctx: any) => {
    const { user, set, params, body } = ctx
    
    if (!user || String(user.role).toUpperCase() !== 'ADMIN') {
      set.status = 403
      return { success: false, message: 'Forbidden' }
    }

    const { telegramId, role, name, email } = body

    // Buat object data dinamis (hanya update field yang dikirim)
    const updateData: any = {}
    if (telegramId !== undefined) {
      updateData.telegramId = telegramId && telegramId.trim() !== '' ? telegramId.replace('@', '').trim() : null
    }
    if (role) updateData.role = role
    if (name) updateData.name = name
    if (email) updateData.email = email

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
    })

    return { success: true, message: 'User updated', data: updatedUser }
  })
  .delete('/:id', async (ctx: any) => {
    const { user, set, params } = ctx

    if (!user || String(user.role).toUpperCase() !== 'ADMIN') {
      set.status = 403
      return { success: false, message: 'Forbidden' }
    }

    if (user.id === params.id) {
      set.status = 400
      return { success: false, message: 'Admin tidak bisa menghapus dirinya sendiri' }
    }

    await prisma.user.delete({
      where: { id: params.id },
    })

    return { success: true, message: 'User deleted' }
  })
