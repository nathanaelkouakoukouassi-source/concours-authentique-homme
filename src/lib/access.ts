import type { Access, PayloadRequest } from 'payload'

type MaybeUser = { collection?: string; role?: string | null; id?: string | number } | null | undefined

/** Un utilisateur sans rôle (créé avant l’ajout des rôles) est considéré comme administrateur. */
export function isAdminUser(user: MaybeUser) {
  return Boolean(user && user.collection === 'users' && (user.role ?? 'admin') === 'admin')
}

export function isJuryUser(user: MaybeUser) {
  return Boolean(user && user.collection === 'users' && user.role === 'jury')
}

export const adminOnly: Access = ({ req }) => isAdminUser(req.user as MaybeUser)

export const adminOrJury: Access = ({ req }) =>
  isAdminUser(req.user as MaybeUser) || isJuryUser(req.user as MaybeUser)

export function requestUser(req: PayloadRequest) {
  return req.user as MaybeUser
}
