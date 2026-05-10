import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { prisma } from '../lib/prisma'
import * as fs from 'fs'
import path from 'path'

export const clientRoutes = new Elysia({ prefix: '/clients' })
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

    const customers = await prisma.customer.findMany({
      orderBy: { name: 'asc' }
    })

    return { success: true, data: customers }
  })
  .post('/', async ({ user, set, body }) => {
    if (!user) {
      set.status = 401
      return { success: false, message: 'Unauthorized' }
    }

    const { name } = body as { name: string }

    try {
      const customer = await prisma.customer.create({
        data: { name }
      })
      return { success: true, data: customer }
    } catch (error: any) {
      set.status = 400
      return { success: false, message: 'Customer already exists or invalid data' }
    }
  }, {
    body: t.Object({
      name: t.String()
    })
  })
  .delete('/:id', async ({ user, set, params: { id } }) => {
    if (!user) {
      set.status = 401
      return { success: false, message: 'Unauthorized' }
    }

    try {
      const customer = await prisma.customer.findUnique({ where: { id } })
      if (customer?.templateFile) {
        const filePath = path.resolve(process.cwd(), '../../uploads/templates', customer.templateFile)
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      }

      await prisma.customer.delete({ where: { id } })
      return { success: true, message: 'Customer deleted' }
    } catch (error) {
      set.status = 404
      return { success: false, message: 'Customer not found' }
    }
  })
  .post('/:id/template', async ({ user, set, params: { id }, body }) => {
    if (!user) {
      set.status = 401
      return { success: false, message: 'Unauthorized' }
    }

    const { file } = body as { file: File }
    if (!file) {
      set.status = 400
      return { success: false, message: 'No file uploaded' }
    }

    try {
      const customer = await prisma.customer.findUnique({ where: { id } })
      if (!customer) {
        set.status = 404
        return { success: false, message: 'Customer not found' }
      }

      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      
      const uploadDir = path.resolve(process.cwd(), '../../uploads/templates')
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true })
      }

      const fileName = `template_${customer.id}_${Date.now()}.xlsx`
      const filePath = path.join(uploadDir, fileName)
      
      if (customer.templateFile) {
        const oldPath = path.join(uploadDir, customer.templateFile)
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
      }

      fs.writeFileSync(filePath, buffer)

      await prisma.customer.update({
        where: { id },
        data: { templateFile: fileName }
      })

      return { success: true, message: 'Customer template uploaded successfully' }
    } catch (error: any) {
      set.status = 500
      return { success: false, message: 'Failed to upload template: ' + error.message }
    }
  }, {
    body: t.Object({
      file: t.File()
    })
  })
