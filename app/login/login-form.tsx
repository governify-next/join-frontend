"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export function LoginForm({ returnTo }: { returnTo: string }) {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="returnTo" value={returnTo} />
      {state.error && <div className="notice error" role="alert">{state.error}</div>}
      <div className="field">
        <label htmlFor="login">Login</label>
        <input className="input" id="login" name="login" autoComplete="username" required autoFocus />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" minLength={6} required />
      </div>
      <button className="button" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
