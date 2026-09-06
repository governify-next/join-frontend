import { ArrowRight, CircleAlert, Settings2 } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { JoinWizard } from "./wizard";

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
  const missingJoinLink = !id && !joinLink;

  return (
    <AppShell
      eyebrow="Governify ecosystem"
      title="Bring your project into Governify."
      description={
        <p>
          Choose a Governify destination and agreement template, connect only
          the services it needs, and complete the guided setup.
        </p>
      }
      action={
        <Button variant="ghost" asChild>
          <Link href="/join-links">
            <Settings2 aria-hidden="true" />
            Manage join links
          </Link>
        </Button>
      }
    >
      {loadError ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-4">
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>Unable to continue onboarding</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
            <Button asChild>
              <Link href="/">
                Start a new onboarding
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : missingJoinLink ? (
        <Card>
          <CardHeader>
            <CardTitle>Join link required</CardTitle>
            <CardDescription>
              New onboardings can only be started from a join link provided by
              an organization administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <JoinWizard initialId={id} initialJoinLinkId={joinLink} />
      )}
    </AppShell>
  );
}
