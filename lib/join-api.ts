"use client";

let sessionGeneration = 0;
let refreshInFlight: Promise<boolean> | undefined;
let signingOut = false;

const refreshBrowserSession = () => {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refresh = async () => {
        if (signingOut) return false;
        const response = await fetch("/api/auth/refresh", { method: "POST" });
        return response.ok;
      };
      const refreshed = navigator.locks
        ? await navigator.locks.request(
            "governify-join-session-refresh",
            refresh,
          )
        : await refresh();
      if (refreshed) sessionGeneration += 1;
      return refreshed;
    })().finally(() => {
      refreshInFlight = undefined;
    });
  }
  return refreshInFlight;
};

const redirectToLogin = (): never => {
  const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const login = new URL("/login", window.location.origin);
  login.searchParams.set("next", next);
  window.location.replace(`${login.pathname}${login.search}`);
  throw new Error("Session expired. Redirecting to login…");
};

export const authenticatedApi = async <T>(
  path: string,
  init?: RequestInit,
): Promise<T> => {
  const generation = sessionGeneration;
  const request = () =>
    fetch(path, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });

  let response = await request();
  if (signingOut) throw new Error("Signing out…");
  if (response.status === 401) {
    if (generation === sessionGeneration && !(await refreshBrowserSession())) {
      redirectToLogin();
    }
    response = await request();
    if (response.status === 401) redirectToLogin();
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || "Request failed");
  return body.data as T;
};

export const joinApi = <T>(path: string, init?: RequestInit): Promise<T> =>
  authenticatedApi<T>(`/api/join${path}`, init);

export const endBrowserSession = async (logout: () => Promise<void>) => {
  signingOut = true;
  try {
    // Finish any refresh before clearing cookies so it cannot restore the session.
    await refreshInFlight?.catch(() => false);
    if (navigator.locks) {
      await navigator.locks.request("governify-join-session-refresh", logout);
    } else {
      await logout();
    }
    window.location.replace("/login");
  } catch (error) {
    signingOut = false;
    throw error;
  }
};
