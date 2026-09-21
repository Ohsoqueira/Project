import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { db, schema, type RoleName } from "@servicebox/db";
import { eq, and } from "drizzle-orm";

const SESSION_COOKIE = "servicebox_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h; PRD notes short idle timeouts for admin surfaces

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET env var is required");
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  userId: string;
  tenantId: string;
  tenantSlug: string;
  role: RoleName;
  email: string;
  firstName: string;
  lastName: string;
};

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }
  return session;
}

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function login(tenantSlug: string, email: string, password: string): Promise<LoginResult> {
  const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.slug, tenantSlug.trim().toLowerCase()));
  if (!tenant) return { ok: false, error: "Company not found." };

  const [user] = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.tenantId, tenant.id), eq(schema.users.email, email.trim().toLowerCase())));
  if (!user || !user.active) return { ok: false, error: "Invalid credentials." };

  if (!verifyPassword(password, user.passwordHash)) {
    return { ok: false, error: "Invalid credentials." };
  }

  await createSession({
    userId: user.id,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    role: user.role,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  });

  return { ok: true };
}
