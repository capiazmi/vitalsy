import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { admin } from 'better-auth/plugins'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.js'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// A seed-only auth instance with public sign-up enabled, so we can create the
// first admin without an existing admin session. Password hashing matches the
// app's runtime auth (same default hasher + secret).
const seedAuth = betterAuth({
  baseURL: process.env.APP_URL ?? 'http://localhost:3000',
  secret:
    process.env.AUTH_SECRET ??
    process.env.BETTER_AUTH_SECRET ??
    'dev-insecure-secret-change-me',
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
  plugins: [admin({ defaultRole: 'user', adminRoles: ['admin'] })],
})

async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME ?? 'Administrator'

  if (!email || !password) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed the admin user.',
    )
  }

  console.log('🌱 Seeding admin user…')

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { role: 'admin', banned: false, emailVerified: true },
    })
    console.log(`✅ Admin already exists (${email}); ensured role=admin, active.`)
  } else {
    await seedAuth.api.signUpEmail({ body: { email, password, name } })
    await prisma.user.update({
      where: { email },
      data: { role: 'admin', emailVerified: true },
    })
    console.log(`✅ Created admin user: ${email}`)
  }
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
