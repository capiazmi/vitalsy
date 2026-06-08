import { getRequest } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'
import { ROLES } from '#/lib/roles'

// Server-only authentication helpers. This module imports server-only APIs and
// must never be imported by client code outside of a server-fn handler.

export interface SessionUser {
  id: string
  name: string
  email: string
  role: string
  image: string | null
}

/** Reads the current authenticated user from the request, or null. */
export async function readSessionUser(): Promise<SessionUser | null> {
  const { headers } = getRequest()
  const session = await auth.api.getSession({ headers })
  if (!session?.user) return null
  const u = session.user
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: (u as { role?: string }).role ?? ROLES.USER,
    image: u.image ?? null,
  }
}

export class AuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await readSessionUser()
  if (!user) throw new AuthError('You must be signed in.', 401)
  return user
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (user.role !== ROLES.ADMIN) {
    throw new AuthError('Admin access required.', 403)
  }
  return user
}
