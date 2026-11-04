import { beforeAll, describe, expect, test, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from '../../server/database/schema.sqlite';
import { migrateToLatest } from './temp-db';

// The schema barrel picks the PostgreSQL schema when PIWI_DATABASE_URL is set,
// so clear it before the modules under test load.
delete process.env.PIWI_DATABASE_URL;
const db = drizzle(createClient({ url: ':memory:' }), { schema });
vi.mock('../../server/database', () => ({ getDatabase: async () => db }));
const { signInName } = await import('../../server/utils/auth');

beforeAll(async () => {
  await migrateToLatest(db);
  await db.insert(schema.users).values([
    { username: 'jsmith', email: 'John.Smith@corp.example', password: 'x', role: 'member' },
    // A provider sign-up: its address is its username.
    { username: 'ada@corp.example', email: 'ada@corp.example', password: '', role: 'member' },
    // A username that is another account's address.
    { username: 'grace@corp.example', email: 'g.hopper@corp.example', password: 'x', role: 'member' },
    { username: 'ghopper', email: 'grace@other.example', password: 'x', role: 'member' },
  ]);
});

describe('signInName', () => {
  test('a username is returned as typed', async () => {
    expect(await signInName('jsmith')).toBe('jsmith');
  });

  test("an email names its account's username, ignoring letter case", async () => {
    expect(await signInName('john.smith@corp.example')).toBe('jsmith');
    expect(await signInName('JOHN.SMITH@CORP.EXAMPLE')).toBe('jsmith');
  });

  test('an account whose username is an address signs in with it', async () => {
    expect(await signInName('ada@corp.example')).toBe('ada@corp.example');
  });

  test("a username wins over another account's email", async () => {
    expect(await signInName('grace@corp.example')).toBe('grace@corp.example');
    expect(await signInName('grace@other.example')).toBe('ghopper');
  });

  test('a username is matched exactly: another letter case is no username', async () => {
    expect(await signInName('Grace@corp.example')).toBe('Grace@corp.example');
  });

  test('an identifier no account holds is returned as typed', async () => {
    expect(await signInName('nobody@corp.example')).toBe('nobody@corp.example');
    expect(await signInName('nobody')).toBe('nobody');
  });
});
