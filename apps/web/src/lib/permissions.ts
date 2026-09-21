import "server-only";
import { can, type Capability } from "@servicebox/shared";
import { requireSession } from "./auth";

// Every server action / mutation should call this instead of trusting the
// client. Throws if the session's role lacks the capability so callers can
// let the error surface (caught by Next's error boundary) or handle it.
export async function requireCapability(capability: Capability) {
  const session = await requireSession();
  if (!can(session.role, capability)) {
    throw new Error(`FORBIDDEN: role ${session.role} lacks ${capability}`);
  }
  return session;
}
