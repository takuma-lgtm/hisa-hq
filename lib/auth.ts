/** Active roles in the simplified system */
export type ActiveRole = 'owner' | 'admin' | 'member'

export function isOwner(role: string | null | undefined): boolean {
  return role === 'owner'
}

export function isAdmin(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin'
}

export function canManageTeam(role: string | null | undefined): boolean {
  return role === 'owner'
}
