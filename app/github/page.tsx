import { JoinWizard } from "./wizard";
import type { Onboarding } from "./types";
import { joinApi } from "@/lib/join-api";

export default async function GitHubJoinPage({ searchParams }: { searchParams: Promise<{ onboarding?: string; github?: string; message?: string }> }) {
  const { onboarding: id, github, message } = await searchParams;
  let initial: Onboarding | undefined;
  let loadError = "";
  if (id) {
    try { initial = await joinApi<Onboarding>(`/onboardings/${encodeURIComponent(id)}`); }
    catch (error) { loadError = error instanceof Error ? error.message : "Unable to restore onboarding"; }
  }
  if (github === "error") loadError = message || "GitHub authorization was not completed.";
  return (
    <div className="shell">
      <header className="topbar"><div className="brand"><span className="brand-mark">G</span> Governify Join</div><span className="muted">GitHub</span></header>
      <main className="page">
        <div className="hero"><div className="eyebrow">Governify ecosystem</div><h1>Bring your GitHub project into Governify.</h1><p>A guided setup for agreements, project metrics, and recurring calculations.</p></div>
        {loadError ? <div className="card stack"><div className="notice error">{loadError}</div><a className="button" href="/github">Start a new onboarding</a></div> : <JoinWizard initial={initial} governifyUrl={process.env.GOVERNIFY_FRONTEND_URL || "https://next.governify.io"} />}
      </main>
    </div>
  );
}
