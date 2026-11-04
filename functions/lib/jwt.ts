import { jwtVerify, SignJWT } from 'jose';

const enc = new TextEncoder();

/** HS256 session token carrying only the session id. The passport number never travels in the token. */
export async function signSession(claims: { sid: string }, secret: string, ttlSeconds: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sid: claims.sid }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt(now).setExpirationTime(now + ttlSeconds).sign(enc.encode(secret));
}

export async function verifySession(token: string, secret: string): Promise<{ sid: string } | null> {
  try {
    const { payload } = await jwtVerify(token, enc.encode(secret), { algorithms: ['HS256'] });
    return typeof payload.sid === 'string' ? { sid: payload.sid } : null;
  } catch {
    return null;
  }
}
