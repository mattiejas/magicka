import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { Db } from './db';
const kdf = (pw: string, salt: Buffer) => new Promise<Buffer>((res, rej) => scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? rej(e) : res(k))));
const sha = (t: string) => createHash('sha256').update(t).digest('hex');
const DUMMY = randomBytes(16);
export interface AuthOk { account: number; name: string; token: string }
export class Auth {
  constructor(private db: Db) {}
  private issue(account: number, name: string): AuthOk { const token = randomBytes(32).toString('hex'); this.db.addSession(sha(token), account, Date.now() + 14 * 864e5); return { account, name, token }; }
  async register(name: string, pw: string): Promise<AuthOk | string> {
    if (this.db.findAccount(name)) return 'That name is taken.';
    const salt = randomBytes(16), id = this.db.createAccount(name, salt, await kdf(pw, salt));
    return id ? this.issue(id, name) : 'That name is taken.';
  }
  async login(name: string, pw: string): Promise<AuthOk | string> {
    const a = this.db.findAccount(name), h = await kdf(pw, a?.salt ?? DUMMY);
    return a && timingSafeEqual(h, a.hash) ? this.issue(a.id, a.name) : 'Wrong name or password.';
  }
  resume(token: string): AuthOk | string { const id = this.db.session(sha(token)), a = id && this.db.account(id); return a ? { account: a.id, name: a.name, token } : 'Session expired.'; }
  revoke(token: string) { this.db.dropSession(sha(token)); }
}
