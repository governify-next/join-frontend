import type { ReactNode } from "react";

import { GovernifyBrand } from "@/components/governify-brand";
import { cn } from "@/lib/utils/cn";

export function AppShell({
  action,
  children,
  description,
  eyebrow,
  title,
  compactHero = false,
}: {
  action?: ReactNode;
  children: ReactNode;
  description: ReactNode;
  eyebrow: string;
  title: string;
  compactHero?: boolean;
}) {
  return (
    <div className="min-h-svh bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <GovernifyBrand />
          {action && <nav aria-label="Primary">{action}</nav>}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div
          className={cn(
            "mb-8 flex flex-col gap-2",
            compactHero && "max-w-3xl",
          )}
        >
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">
            {eyebrow}
          </p>
          <h1 className="max-w-4xl text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
            {title}
          </h1>
          <div className="max-w-3xl text-base leading-relaxed text-muted-foreground">
            {description}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
