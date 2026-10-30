import type { Payload } from 'payload'
import { isAdminUser } from '../access'

/** Vérifie que la requête vient d’un administrateur connecté au back-office. */
export async function requireAdmin(payload: Payload, headers: Headers) {
  const { user } = await payload.auth({ headers })
  return isAdminUser(user as never) ? user : null
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status })
}
