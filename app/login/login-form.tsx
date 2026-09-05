"use client";

import { useActionState } from "react";
import { CircleAlert, Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { loginAction } from "./actions";

export function LoginForm({ returnTo }: { returnTo: string }) {
  const [state, action, pending] = useActionState(loginAction, {});

  return (
    <form action={action} className="mt-8 flex flex-col gap-6">
      <input type="hidden" name="returnTo" value={returnTo} />
      {state.error && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <FieldGroup className="gap-5">
        <Field>
          <FieldLabel htmlFor="login">Login</FieldLabel>
          <Input
            id="login"
            name="login"
            autoComplete="username"
            required
            autoFocus
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={6}
            required
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </FieldGroup>
    </form>
  );
}
