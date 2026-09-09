"use client";

import {
  ArrowRight,
  CircleAlert,
  LoaderCircle,
  RefreshCw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { joinApi } from "@/lib/join-api";
import { OnboardingResultLinks } from "./onboarding-result-links";
import type { OnboardingSummary } from "./types";

const statusLabels: Record<OnboardingSummary["status"], string> = {
  DRAFT: "Draft",
  AUTHORIZING: "Connecting services",
  CONFIGURING: "In progress",
  READY: "Ready to publish",
  PROVISIONING: "Publishing",
  COMPLETED: "Completed",
  FAILED: "Needs attention",
};

const onboardingName = (onboarding: OnboardingSummary) =>
  onboarding.scopeName ||
  onboarding.agreementTemplate.displayName ||
  onboarding.agreementTemplate.name ||
  "Untitled onboarding";

export function OnboardingList() {
  const [onboardings, setOnboardings] = useState<OnboardingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<string>();
  const [deleting, setDeleting] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const values = await joinApi<OnboardingSummary[]>("/onboardings");
        if (cancelled) return;
        setOnboardings(values);
        if (values.some(({ status }) => status === "PROVISIONING")) {
          timer = setTimeout(() => void load(), 5000);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load onboardings.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [refreshKey]);

  const refresh = () => {
    setError("");
    setLoading(true);
    setRefreshKey((value) => value + 1);
  };

  const remove = async (onboarding: OnboardingSummary) => {
    setDeleting(onboarding._id);
    setError("");
    setNotice("");
    try {
      await joinApi(`/onboardings/${encodeURIComponent(onboarding._id)}`, {
        method: "DELETE",
      });
      setOnboardings((values) =>
        values.filter(({ _id }) => _id !== onboarding._id),
      );
      setPendingDelete(undefined);
      setNotice(`${onboardingName(onboarding)} was deleted.`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to delete onboarding.",
      );
    } finally {
      setDeleting(undefined);
      setRefreshKey((value) => value + 1);
    }
  };

  return (
    <section aria-labelledby="onboardings-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="onboardings-title" className="text-xl font-semibold">
            Your onboardings
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Resume a saved setup or revisit a completed onboarding.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={refresh}
          disabled={loading || Boolean(deleting)}
        >
          <RefreshCw
            aria-hidden="true"
            className={loading ? "animate-spin" : undefined}
          />
          Refresh
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        To start a new onboarding, use a join link provided by an organization
        administrator.
      </p>

      {error && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Unable to update onboardings</AlertTitle>
          <AlertDescription>{error} Use Refresh to try again.</AlertDescription>
        </Alert>
      )}

      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      {loading && onboardings.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-2" role="status">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            Loading your onboardings…
          </CardContent>
        </Card>
      ) : !error && onboardings.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No onboardings yet</CardTitle>
            <CardDescription>
              Your saved and completed onboardings will appear here once you
              start from a join link.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="space-y-4" aria-label="Your onboardings">
          {onboardings.map((onboarding) => {
            const completed = onboarding.status === "COMPLETED";
            const name = onboardingName(onboarding);
            return (
              <li key={onboarding._id}>
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="min-w-0 text-base font-semibold break-words">
                        {name}
                      </h3>
                      <Badge
                        variant={
                          onboarding.status === "FAILED"
                            ? "destructive"
                            : "muted"
                        }
                        className={
                          completed
                            ? "bg-green-600/10 text-green-700 dark:text-green-400"
                            : undefined
                        }
                      >
                        {statusLabels[onboarding.status]}
                      </Badge>
                    </div>
                    <CardDescription className="break-words">
                      {[
                        onboarding.organizationName,
                        onboarding.agreementTemplate.displayName ||
                          onboarding.agreementTemplate.name,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </CardDescription>
                    <p className="text-xs text-muted-foreground">
                      Updated{" "}
                      {new Date(onboarding.updatedAt).toLocaleString(
                        undefined,
                        {
                          dateStyle: "medium",
                          timeStyle: "short",
                        },
                      )}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button asChild>
                        <Link
                          href={`/?onboarding=${encodeURIComponent(onboarding._id)}`}
                        >
                          {completed ? "View summary" : "Resume onboarding"}
                          <ArrowRight aria-hidden="true" />
                        </Link>
                      </Button>
                      <OnboardingResultLinks onboarding={onboarding} />
                      {!completed && (
                        <AlertDialog
                          open={pendingDelete === onboarding._id}
                          onOpenChange={(open) => {
                            if (!deleting)
                              setPendingDelete(
                                open ? onboarding._id : undefined,
                              );
                          }}
                        >
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              disabled={Boolean(deleting)}
                            >
                              <Trash2 aria-hidden="true" /> Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete {name}?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Saved progress will be removed. Any resources
                                already published will remain.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            {error && (
                              <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                              </Alert>
                            )}
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={Boolean(deleting)}>
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                variant="destructive"
                                disabled={Boolean(deleting)}
                                onClick={(event) => {
                                  event.preventDefault();
                                  void remove(onboarding);
                                }}
                              >
                                {deleting === onboarding._id
                                  ? "Deleting…"
                                  : "Delete onboarding"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
