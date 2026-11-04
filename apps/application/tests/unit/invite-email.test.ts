import { describe, expect, test } from 'vitest';
import { renderInviteEmail } from '../../server/utils/email';

describe('renderInviteEmail', () => {
  test('names the username to sign in with, in the HTML and the text part', () => {
    const { html, text } = renderInviteEmail('token', { username: 'jsmith', invitedBy: 'Dana' });
    expect(html).toContain('Your username is <strong>jsmith</strong>');
    expect(text).toContain('Your username is jsmith');
  });

  test('keeps the link to set the password', () => {
    const { html, text } = renderInviteEmail('a b', { username: 'jsmith' });
    expect(html).toContain('/reset-password?token=a%20b&mode=invite');
    expect(text).toContain('/reset-password?token=a%20b&mode=invite');
  });
});
