import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="login">
      <section className="login-main">
        <div className="login-panel stack">
          <div className="brand"><span className="brand-mark">G</span> Governify Next</div>
          <div><div className="eyebrow">Project onboarding</div><h1 style={{ fontSize: 36 }}>Welcome back</h1><p>Use your Governify ecosystem account to continue.</p></div>
          <LoginForm returnTo={next || "/github"} />
        </div>
      </section>
      <aside className="login-art"><div><h2>Connect your engineering workflow.</h2><p>Turn repository and project data into a live Governify agreement in a guided flow.</p></div></aside>
    </main>
  );
}
