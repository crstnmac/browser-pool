#!/usr/bin/env tsx
/**
 * Security Migration Script
 *
 * This script migrates existing data to support new security features:
 * 1. Adds keyPrefix to existing API keys
 * 2. Initializes security fields for existing users
 *
 * IMPORTANT: This will require users to regenerate their API keys if
 * keyPrefix cannot be recovered. Consider notifying users before running.
 */

import { prisma } from '../src/db.js'
import { generateApiKey, hashApiKey, extractKeyPrefix } from '../src/auth.js'
import { logger } from '../src/logger.js'

async function migrateSecurityFields() {
  console.log('🔒 Starting security fields migration...\n')

  try {
    // 1. Migrate Users - Add default values for new security fields
    console.log('1️⃣  Migrating user security fields...')
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { failedLoginAttempts: { gt: 0 } },
          { lockedUntil: { not: undefined } },
        ]
      }
    } as any)

    for (const user of users) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          passwordResetUsedAt: null,
        }
      })
    }
    console.log(`   ✅ Updated ${users.length} users\n`)

    // 2. Migrate API Keys - This is the critical part
    console.log('2️⃣  Migrating API keys...')
    console.log('   ⚠️  WARNING: Existing API keys cannot have keyPrefix added retroactively')
    console.log('   📝 Option 1: Users must regenerate keys (RECOMMENDED)')
    console.log('   📝 Option 2: Generate new keys automatically (notify users)\n')

    const apiKeys = await prisma.apiKey.findMany({
      where: { keyPrefix: '' },
      include: { user: true }
    })

    console.log(`   Found ${apiKeys.length} API keys without keyPrefix`)

    const AUTO_GENERATE = process.env.AUTO_GENERATE_NEW_KEYS === 'true'

    if (AUTO_GENERATE) {
      console.log('   🔄 Auto-generating new API keys...\n')

      for (const apiKey of apiKeys) {
        const newRawKey = generateApiKey()
        const newHashedKey = await hashApiKey(newRawKey)
        const keyPrefix = extractKeyPrefix(newRawKey)

        await prisma.apiKey.update({
          where: { id: apiKey.id },
          data: {
            key: newHashedKey,
            keyPrefix,
          }
        })

        console.log(`   👤 User: ${apiKey.user.email}`)
        console.log(`   🔑 New API Key: ${newRawKey}`)
        console.log(`   ⚠️  IMPORTANT: Save this key! It cannot be retrieved later.\n`)
      }

      console.log('   ✅ Generated new API keys for all users')
      console.log('   📧 NEXT STEP: Email users their new API keys\n')
    } else {
      console.log('   ℹ️  Skipping auto-generation (set AUTO_GENERATE_NEW_KEYS=true to enable)')
      console.log('   💡 Users will need to generate new API keys via the dashboard\n')

      // Option: Mark old keys as revoked
      const REVOKE_OLD_KEYS = process.env.REVOKE_OLD_KEYS === 'true'

      if (REVOKE_OLD_KEYS) {
        console.log('   🚫 Revoking old API keys without keyPrefix...')

        await prisma.apiKey.updateMany({
          where: { keyPrefix: null },
          data: { revokedAt: new Date() }
        })

        console.log('   ✅ Old keys revoked\n')
      }
    }

    // 3. Summary
    console.log('📊 Migration Summary:')
    console.log(`   - Users updated: ${users.length}`)
    console.log(`   - API keys processed: ${apiKeys.length}`)
    console.log('\n✅ Migration completed successfully!')

    // 4. Next steps
    console.log('\n📋 Next Steps:')
    console.log('   1. Review generated API keys above')
    console.log('   2. Notify users about new keys (if auto-generated)')
    console.log('   3. Test authentication with new keys')
    console.log('   4. Monitor logs for any authentication errors')
    console.log('   5. Consider setting up Redis for rate limiting')

  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run migration
migrateSecurityFields()
  .then(() => {
    console.log('\n🎉 Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error)
    process.exit(1)
  })
