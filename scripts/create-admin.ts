import { prisma } from '../src/db.js'
import { hashPassword, generateApiKey, hashApiKey } from '../src/auth.js'
import { logger } from '../src/logger.js'

async function createAdmin() {
  const email = process.argv[2]
  const password = process.argv[3]
  const name = process.argv[4] || 'Admin'

  if (!email || !password) {
    console.error('Usage: tsx scripts/create-admin.ts <email> <password> [name]')
    process.exit(1)
  }

  try {
    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    })

    if (existing) {
      console.error(`User with email ${email} already exists!`)
      process.exit(1)
    }

    const passwordHash = await hashPassword(password)

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        plan: 'ENTERPRISE',
        isAdmin: true,
      },
    })

    const rawApiKey = generateApiKey()
    const hashedKey = await hashApiKey(rawApiKey)

    await prisma.apiKey.create({
      data: {
        userId: user.id,
        key: hashedKey,
        name: 'Admin Key',
        keyPrefix: rawApiKey.substring(0, 12),
      },
    })

    console.log('\n✅ Admin user created successfully!\n')
    console.log('📧 Email:', email)
    console.log('👤 Name:', name)
    console.log('🔑 API Key:', rawApiKey)
    console.log('\n⚠️  IMPORTANT: Store this API key securely! You will not be able to see it again.\n')

    await prisma.$disconnect()
  } catch (error: any) {
    console.error('Error creating admin user:', error.message)
    await prisma.$disconnect()
    process.exit(1)
  }
}

createAdmin()
