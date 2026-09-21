"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-brand-700">ServiceBox</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to your company workspace</p>
        </div>
        <form action={formAction} className="card p-6 space-y-4">
          <input type="hidden" name="next" value={next ?? "/"} />
          <div>
            <label className="label" htmlFor="company">
              Company login URL
            </label>
            <div className="flex items-center gap-2">
              <input
                id="company"
                name="company"
                required
                defaultValue="demo-hvac"
                className="input"
                placeholder="your-company"
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input id="email" name="email" type="email" required className="input" placeholder="you@company.com" />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input id="password" name="password" type="password" required className="input" />
          </div>
          {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="text-xs text-slate-400 text-center mt-4">
          Demo tenant: <span className="font-mono">demo-hvac</span> · e.g. admin@demo-hvac.test / password123
        </p>
      </div>
    </div>
  );
}
