import { describe, expect, test } from 'vitest';
import { handedUsername } from '../../app/utils/sign-in-handoff';

describe('handedUsername', () => {
  test('reads the username the set-password page put in the history state', () => {
    expect(handedUsername({ username: 'jsmith', back: '/reset-password' }, 200)).toBe('jsmith');
  });

  test('reads nothing from a history entry that holds none', () => {
    expect(handedUsername(null, 200)).toBeNull();
    expect(handedUsername({ back: '/' }, 200)).toBeNull();
    expect(handedUsername({ username: 42 }, 200)).toBeNull();
    expect(handedUsername({ username: '   ' }, 200)).toBeNull();
  });

  test('reads nothing longer than the form accepts', () => {
    expect(handedUsername({ username: 'a'.repeat(201) }, 200)).toBeNull();
  });

  test('keeps a username exactly as the account holds it, spaces included', () => {
    expect(handedUsername({ username: ' bob' }, 200)).toBe(' bob');
  });
});
