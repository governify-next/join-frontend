import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { JoinLinkManager } from "./manager";

export default function JoinLinksPage() {
  return (
    <AppShell
      compactHero
      eyebrow="Organization administration"
      title="Generate join links."
      description={
        <p>
          Predefine the onboarding configuration and choose which values the
          participant may change.
        </p>
      }
      action={
        <Button variant="ghost" asChild>
          <Link href="/">
            <ArrowLeft aria-hidden="true" />
            Back to onboarding
          </Link>
        </Button>
      }
    >
      <JoinLinkManager />
    </AppShell>
  );
}
