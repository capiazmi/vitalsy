// Role constants shared by client and server.
// better-auth's admin plugin stores `role` as a lowercase string.
export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

export function isAdmin(role: string | null | undefined): boolean {
  return role === ROLES.ADMIN
}

export function roleLabel(role: string | null | undefined): string {
  return role === ROLES.ADMIN ? 'Admin' : 'User'
}
