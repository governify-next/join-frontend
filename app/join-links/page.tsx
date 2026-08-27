import Link from "next/link";
import { JoinLinkManager } from "./manager";

export default function JoinLinksPage() {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">G</span> Governify Join
        </div>
        <Link className="topbar-link" href="/">
          Back to onboarding
        </Link>
      </header>
      <main className="page">
        <div className="hero compact-hero">
          <div className="eyebrow">Organization administration</div>
          <h1>Generate join links.</h1>
          <p>
            Predefine the onboarding configuration and choose which values the
            participant may change.
          </p>
        </div>
        <JoinLinkManager />
      </main>
    </div>
  );
}
