import { ArrowLeft, CircleAlert, Settings2 } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OnboardingList } from "./onboarding-list";
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
  const showOnboardings = !id && !joinLink;

  return (
    <AppShell
      eyebrow="Governify ecosystem"
      title={
        showOnboardings
          ? "Your projects in Governify."
          : "Bring your project into Governify."
      }
      description={
        <p>
          {showOnboardings
            ? "Keep track of your onboardings, continue setting up a project, and access your completed results."
            : "Choose a Governify destination and agreement template, connect only the services it needs, and complete the guided setup."}
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
      {!showOnboardings && (
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/">
            <ArrowLeft aria-hidden="true" />
            Your onboardings
          </Link>
        </Button>
      )}
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
                Back to your onboardings
                <ArrowLeft aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : showOnboardings ? (
        <OnboardingList />
      ) : (
        <JoinWizard
          key={id || joinLink}
          initialId={id}
          initialJoinLinkId={joinLink}
        />
      )}
    </AppShell>
  );
}
