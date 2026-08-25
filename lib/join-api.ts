"use client";

let sessionGeneration = 0;
let refreshInFlight: Promise<boolean> | undefined;

const refreshBrowserSession = () => {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refresh = async () => {
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

export const joinApi = async <T,>(
  path: string,
  init?: RequestInit,
): Promise<T> => {
  const generation = sessionGeneration;
  const request = () =>
    fetch(`/api/join${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });

  let response = await request();
  if (response.status === 401) {
    if (
      generation === sessionGeneration &&
      !(await refreshBrowserSession())
    ) {
      redirectToLogin();
    }
    response = await request();
    if (response.status === 401) redirectToLogin();
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || "Request failed");
  return body.data as T;
};
