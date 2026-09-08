import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { OnboardingSummary } from "./types";

export function OnboardingResultLinks({
  onboarding,
}: {
  onboarding: Pick<OnboardingSummary, "status" | "result">;
}) {
  if (onboarding.status !== "COMPLETED") return null;
  const { organizationURL, dashboardURL } = onboarding.result || {};

  return (
    <>
      {organizationURL && (
        <Button variant="outline" asChild>
          <a href={organizationURL}>
            Open organization
            <ExternalLink aria-hidden="true" />
          </a>
        </Button>
      )}
      {dashboardURL && (
        <Button variant="outline" asChild>
          <a href={dashboardURL}>
            Open dashboard
            <ExternalLink aria-hidden="true" />
          </a>
        </Button>
      )}
    </>
  );
}
