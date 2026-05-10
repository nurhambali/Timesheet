import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('🗑️  Deleting all timesheet entries...')
  const deleted = await prisma.timesheet.deleteMany({})
  console.log(`✅ Success! Deleted ${deleted.count} entries.`)
}

main()
  .catch(e => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
