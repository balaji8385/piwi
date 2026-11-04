/**
 * The username the set-password page hands to the sign-in form. It travels in the history entry's state
 * (`router.push({ path: '/login', state: { username } })`), never in the URL, and is read only when it is a
 * username the form could accept.
 */
export function handedUsername(state: unknown, maxLength: number): string | null {
  if (!state || typeof state !== 'object' || !('username' in state)) return null;
  const { username } = state as { username: unknown };
  return typeof username === 'string' && username.trim() !== '' && username.length <= maxLength ? username : null;
}
