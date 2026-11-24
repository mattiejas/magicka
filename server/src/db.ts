import Database from 'better-sqlite3';
import type { SavedChar } from './types';
const MIGRATIONS = [
  `CREATE TABLE accounts(id INTEGER PRIMARY KEY, name TEXT NOT NULL, key TEXT NOT NULL UNIQUE, salt BLOB NOT NULL, hash BLOB NOT NULL, created INTEGER NOT NULL);
   CREATE TABLE sessions(token_hash TEXT PRIMARY KEY, account INTEGER NOT NULL REFERENCES accounts(id), expires INTEGER NOT NULL);
   CREATE TABLE characters(account INTEGER PRIMARY KEY REFERENCES accounts(id), data TEXT NOT NULL, saved INTEGER NOT NULL);`,
];
export interface Account { id: number; name: string; salt: Buffer; hash: Buffer }
export class Db {
  private d: Database.Database;
  constructor(path: string) {
    this.d = new Database(path); this.d.pragma('journal_mode = WAL'); this.d.pragma('foreign_keys = ON');
    const v = this.d.pragma('user_version', { simple: true }) as number;
    for (let i = v; i < MIGRATIONS.length; i++) this.d.transaction(() => { this.d.exec(MIGRATIONS[i]); this.d.pragma(`user_version = ${i + 1}`); })();
    this.d.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
  }
  findAccount(name: string) { return this.d.prepare('SELECT * FROM accounts WHERE key = ?').get(name.toLowerCase()) as Account | undefined; }
  account(id: number) { return this.d.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Account | undefined; }
  createAccount(name: string, salt: Buffer, hash: Buffer): number | null {
    const r = this.d.prepare('INSERT OR IGNORE INTO accounts(name,key,salt,hash,created) VALUES(?,?,?,?,?)').run(name, name.toLowerCase(), salt, hash, Date.now());
    return r.changes ? Number(r.lastInsertRowid) : null;
  }
  addSession(h: string, account: number, expires: number) { this.d.prepare('INSERT INTO sessions VALUES(?,?,?)').run(h, account, expires); }
  session(h: string) { return (this.d.prepare('SELECT account FROM sessions WHERE token_hash=? AND expires>?').get(h, Date.now()) as { account: number } | undefined)?.account; }
  dropSession(h: string) { this.d.prepare('DELETE FROM sessions WHERE token_hash=?').run(h); }
  load(account: number): SavedChar | null { const r = this.d.prepare('SELECT data FROM characters WHERE account=?').get(account) as { data: string } | undefined; return r ? JSON.parse(r.data) : null; }
  saveMany(list: [number, SavedChar][]) {
    const s = this.d.prepare('INSERT INTO characters VALUES(?,?,?) ON CONFLICT(account) DO UPDATE SET data=excluded.data, saved=excluded.saved');
    this.d.transaction(() => { for (const [a, c] of list) s.run(a, JSON.stringify(c), Date.now()); })();
  }
  close() { this.d.close(); }
}
