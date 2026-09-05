import { Workflow } from "lucide-react";

import { GovernifyBrand } from "@/components/governify-brand";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <section className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center md:justify-start">
          <GovernifyBrand />
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-sm">
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-xs font-semibold tracking-widest text-primary uppercase">
                Project onboarding
              </p>
              <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
              <p className="text-sm text-balance text-muted-foreground">
                Use your Governify ecosystem account to continue.
              </p>
            </div>
            <LoginForm returnTo={next || "/"} />
          </div>
        </div>
      </section>
      <aside className="relative hidden overflow-hidden bg-muted lg:flex">
        <div className="absolute -top-32 -right-32 size-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-32 size-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative m-auto flex max-w-md flex-col gap-5 p-12">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Workflow className="size-6" aria-hidden="true" />
          </span>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              Connect your engineering workflow.
            </h2>
            <p className="leading-relaxed text-muted-foreground">
              Turn repository and project data into a live Governify agreement
              in a guided flow.
            </p>
          </div>
        </div>
      </aside>
    </main>
  );
}
