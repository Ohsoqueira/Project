"use server";

import { redirect } from "next/navigation";
import { login } from "@/lib/auth";

export async function loginAction(_prevState: { error?: string } | undefined, formData: FormData) {
  const tenantSlug = String(formData.get("company") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  const result = await login(tenantSlug, email, password);
  if (!result.ok) {
    return { error: result.error };
  }

  redirect(next || "/");
}
