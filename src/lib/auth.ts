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
    // Self-service password reset — emails a reset link (gated by the admin
    // notifications toggle + SMTP config). Lazily import the mailer to keep
    // nodemailer out of the auth module's load path.
    sendResetPassword: async ({ user, url }) => {
      const { notify } = await import('#/lib/mailer')
      const { passwordResetRequest } = await import('#/lib/email-templates')
      await notify({
        to: user.email,
        ...passwordResetRequest({ name: user.name, url }),
      })
    },
  },
  user: {
    // We treat `banned` as the inverse of the spec's `isActive` flag.
    additionalFields: {},
  },
  databaseHooks: {
    session: {
      create: {
        // Record a login event each time a session is created (sign-in).
        after: async (session) => {
          try {
            const { audit } = await import('#/lib/audit')
            await audit({
              userId: session.userId,
              action: 'login',
              entity: 'Session',
              entityId: session.id,
              metadata: { ipAddress: session.ipAddress ?? null },
            })
          } catch {
            /* never block sign-in on audit write */
          }
        },
      },
    },
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
