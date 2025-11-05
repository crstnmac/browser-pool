import { prisma } from '../src/db.js'
import { hashPassword, generateApiKey, hashApiKey } from '../src/auth.js'
import { logger } from '../src/logger.js'

async function seed() {
  try {
    logger.info('Starting database seed...')

    // Create admin user
    const adminPasswordHash = await hashPassword('admin123')
    const admin = await prisma.user.upsert({
      where: { email: 'admin@browserpool.com' },
      update: {},
      create: {
        email: 'admin@browserpool.com',
        passwordHash: adminPasswordHash,
        name: 'Admin User',
        plan: 'ENTERPRISE',
        status: 'ACTIVE',
        isAdmin: true,
      },
    })

    // Create admin API key
    const adminRawKey = generateApiKey()
    const adminHashedKey = await hashApiKey(adminRawKey)
    await prisma.apiKey.upsert({
      where: { key: adminHashedKey },
      update: {},
      create: {
        userId: admin.id,
        key: adminHashedKey,
        name: 'Admin API Key',
      },
    })

    logger.info('✅ Admin user created', {
      email: 'admin@browserpool.com',
      apiKey: adminRawKey,
    })

    // Create test users for each plan
    const testUsers = [
      {
        email: 'free@test.com',
        password: 'test123',
        name: 'Free User',
        plan: 'FREE' as const,
      },
      {
        email: 'pro@test.com',
        password: 'test123',
        name: 'Pro User',
        plan: 'PRO' as const,
      },
      {
        email: 'enterprise@test.com',
        password: 'test123',
        name: 'Enterprise User',
        plan: 'ENTERPRISE' as const,
      },
    ]

    const createdUsers = []

    for (const userData of testUsers) {
      const passwordHash = await hashPassword(userData.password)
      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: {},
        create: {
          email: userData.email,
          passwordHash,
          name: userData.name,
          plan: userData.plan,
          status: 'ACTIVE',
        },
      })

      // Create API key for each user
      const rawKey = generateApiKey()
      const hashedKey = await hashApiKey(rawKey)
      await prisma.apiKey.upsert({
        where: { key: hashedKey },
        update: {},
        create: {
          userId: user.id,
          key: hashedKey,
          name: 'Test API Key',
        },
      })

      createdUsers.push({
        email: user.email,
        plan: user.plan,
        apiKey: rawKey,
      })

      // Create quota for each user
      const now = new Date()
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const periodEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59
      )

      const quotaLimits = {
        FREE: 100,
        PRO: 5000,
        ENTERPRISE: 100000,
      }

      await prisma.quota.create({
        data: {
          userId: user.id,
          periodStart,
          periodEnd,
          requestsMade: Math.floor(Math.random() * 10), // Random usage
          requestsLimit: quotaLimits[userData.plan],
        },
      })

      logger.info(`✅ Test user created: ${user.email}`)
    }

    // Create some sample usage logs
    logger.info('Creating sample usage logs...')
    for (const userData of createdUsers) {
      const user = await prisma.user.findUnique({
        where: { email: userData.email },
        include: { apiKeys: true },
      })

      if (user && user.apiKeys.length > 0) {
        const apiKey = user.apiKeys[0]

        // Create 5 sample logs
        for (let i = 0; i < 5; i++) {
          await prisma.usageLog.create({
            data: {
              userId: user.id,
              apiKeyId: apiKey.id,
              endpoint: '/screenshot',
              urlRequested: `https://example${i}.com`,
              statusCode: i % 5 === 0 ? 500 : 200,
              responseTimeMs: Math.floor(Math.random() * 5000) + 1000,
              errorMessage: i % 5 === 0 ? 'Timeout error' : null,
              createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
            },
          })
        }
      }
    }

    logger.info('✅ Sample usage logs created')

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('🎉 DATABASE SEEDED SUCCESSFULLY!')
    console.log('='.repeat(60))
    console.log('\n📋 Test Credentials:\n')

    console.log('👤 Admin User:')
    console.log(`   Email: admin@browserpool.com`)
    console.log(`   Password: admin123`)
    console.log(`   API Key: ${adminRawKey}\n`)

    for (const user of createdUsers) {
      console.log(`👤 ${user.plan} User:`)
      console.log(`   Email: ${user.email}`)
      console.log(`   Password: test123`)
      console.log(`   API Key: ${user.apiKey}\n`)
    }

    console.log('='.repeat(60))
    console.log('⚠️  IMPORTANT: Save these credentials! API keys cannot be retrieved again.')
    console.log('='.repeat(60) + '\n')
  } catch (error) {
    logger.error('Error seeding database:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seed()
  .then(() => {
    logger.info('Seed completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    logger.error('Seed failed:', error)
    process.exit(1)
  })
