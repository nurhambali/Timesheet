import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = 'admin@local.com'
  const password = 'admin123!'
  
  console.log('🌱 Seeding admin user...')

  const hashedPassword = await Bun.password.hash(password)

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'Administrator',
      password: hashedPassword,
      role: 'ADMIN',
      telegramToken: 'admin-token-v6',
    },
  })

  console.log(`✅ Admin created with email: ${admin.email}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:')
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
