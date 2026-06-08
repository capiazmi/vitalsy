import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { admin } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { prisma } from '#/db'
import { ROLES } from '#/lib/roles'

const baseURL =
  process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'

const secret =
  process.env.AUTH_SECRET ??
  process.env.BETTER_AUTH_SECRET ??
  'dev-insecure-secret-change-me'

export const auth = betterAuth({
  baseURL,
  secret,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  // Trust the configured origin so the app works behind a reverse proxy (dokploy).
  trustedOrigins: [baseURL],
  emailAndPassword: {
    enabled: true,
    // Public sign-up is disabled: only admins create accounts.
    disableSignUp: true,
    minPasswordLength: 8,
  },
  user: {
    // We treat `banned` as the inverse of the spec's `isActive` flag.
    additionalFields: {},
  },
  plugins: [
    admin({
      defaultRole: ROLES.USER,
      adminRoles: [ROLES.ADMIN],
    }),
    // Must stay last so cookies are handled correctly in TanStack Start.
    tanstackStartCookies(),
  ],
})

export type Auth = typeof auth
