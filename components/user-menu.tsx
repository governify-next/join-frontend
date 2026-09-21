"use client";

import { LogOut, RefreshCw, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { logoutAction } from "@/app/logout/actions";
import { Button } from "@/components/ui/button";
import { authenticatedApi, endBrowserSession } from "@/lib/join-api";

export function UserMenu() {
  const [username, setUsername] = useState<string>();
  const [accountError, setAccountError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    let cancelled = false;
    authenticatedApi<{ username: string }>("/api/auth/me")
      .then((user) => {
        if (!cancelled) setUsername(user.username);
      })
      .catch(() => {
        if (!cancelled) setAccountError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const logout = async () => {
    setLoggingOut(true);
    setLogoutError("");
    try {
      await endBrowserSession(logoutAction);
    } catch {
      setLogoutError("Unable to log out. Please try again.");
      setLoggingOut(false);
    }
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label="Your account"
    >
      <span
        className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"
        aria-live="polite"
      >
        <UserRound className="size-4 shrink-0" aria-hidden="true" />
        {username ? (
          <span className="max-w-48 truncate" title={username}>
            <span className="sr-only">Logged in as </span>
            {username}
          </span>
        ) : accountError ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAccountError(false);
              setAttempt((value) => value + 1);
            }}
          >
            Retry account
            <RefreshCw aria-hidden="true" />
          </Button>
        ) : (
          "Loading account…"
        )}
      </span>
      <Button
        variant="outline"
        onClick={() => void logout()}
        disabled={loggingOut}
      >
        <LogOut aria-hidden="true" />
        {loggingOut ? "Logging out…" : "Log out"}
      </Button>
      {logoutError && (
        <p role="alert" className="w-full text-sm text-destructive">
          {logoutError}
        </p>
      )}
    </div>
  );
}
