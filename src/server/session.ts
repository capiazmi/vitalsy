import { createServerFn } from '@tanstack/react-start'
import { readSessionUser, type SessionUser } from '#/server/guards'

export type { SessionUser } from '#/server/guards'

/**
 * Server-fn used by route guards to hydrate the session on SSR + navigation.
 * Safe to import from client code — the handler body runs only on the server.
 */
export const fetchSession = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionUser | null> => {
    return readSessionUser()
  },
)
