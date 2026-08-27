import { JoinWizard } from "./wizard";
import Link from "next/link";

type HomeSearchParams = {
  onboarding?: string;
  joinLink?: string;
  integration?: string;
  status?: string;
  message?: string;
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams>;
}) {
  const { onboarding: id, joinLink, status, message } = await searchParams;
  let loadError = "";

  if (status === "error") {
    loadError = message || "Integration authorization was not completed.";
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">G</span> Governify Join
        </div>
        <Link className="topbar-link" href="/join-links">
          Manage join links
        </Link>
      </header>
      <main className="page">
        <div className="hero">
          <div className="eyebrow">Governify ecosystem</div>
          <h1>Bring your project into Governify.</h1>
          <p>
            Choose an agreement template, connect only the services it needs,
            and complete the guided setup.
          </p>
        </div>
        {loadError ? (
          <div className="card stack">
            <div className="notice error">{loadError}</div>
            <Link className="button" href="/">
              Start a new onboarding
            </Link>
          </div>
        ) : (
          <JoinWizard
            initialId={id}
            initialJoinLinkId={joinLink}
            governifyUrl={
              process.env.GOVERNIFY_FRONTEND_URL || "https://next.governify.io"
            }
          />
        )}
      </main>
    </div>
  );
}
