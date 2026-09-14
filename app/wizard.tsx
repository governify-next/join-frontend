"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FieldDescription,
  Field,
  FieldLabel,
  FieldSet,
  FieldLegend,
  FieldTitle,
} from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoaderCircle } from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { joinApi as api } from "@/lib/join-api";
import { RequirementField, type ResourceAction } from "./requirement-field";
import { OnboardingResultLinks } from "./onboarding-result-links";
import type {
  IntegrationProvider,
  JoinLink,
  JoinLinkConfiguration,
  Onboarding,
  OnboardingDefinition,
  OnboardingModule,
  Requirement,
  ResourceOption,
  TemplateOption,
} from "./types";

type Answers = Record<string, unknown>;
type MemberDetail = {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
};
type RequirementGroup = {
  id: string;
  title: string;
  description: string;
  requirements: Requirement[];
};
type WizardStep =
  | { id: "agreement"; label: string; kind: "agreement" }
  | {
      id: string;
      label: string;
      kind: "integration";
      module: OnboardingModule;
      groups: RequirementGroup[];
    }
  | {
      id: string;
      label: string;
      kind: "requirements";
      title: string;
      description: string;
      requirements: Requirement[];
    }
  | { id: "review"; label: string; kind: "review" }
  | { id: "provision"; label: string; kind: "provision" };

const localDate = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

const defaultAnswers = (
  definition?: OnboardingDefinition,
  current: Answers = {},
) => {
  const answers = { ...current };
  for (const requirement of definition?.requirements || []) {
    if (answers[requirement.id] !== undefined) continue;
    if (requirement.default === "now")
      answers[requirement.id] = localDate(new Date());
    if (requirement.default === "oneYearFromNow") {
      answers[requirement.id] = localDate(
        new Date(Date.now() + 365 * 24 * 60 * 60_000),
      );
    }
    if (requirement.default === "browserTimezone") {
      answers[requirement.id] =
        Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
  }
  return answers;
};

const integrationConnected = (
  onboarding: Onboarding,
  provider: IntegrationProvider,
) =>
  provider === "github"
    ? Boolean(
        onboarding.integrations?.github?.installationId ||
        onboarding.integrations?.github?.installations?.length,
      )
    : Boolean(onboarding.integrations?.zenhub?.connectionId);

const groupRequirements = (requirements: Requirement[]): RequirementGroup[] => {
  const groups = new Map<string, Requirement[]>();
  for (const requirement of requirements) {
    groups.set(requirement.ui.step, [
      ...(groups.get(requirement.ui.step) || []),
      requirement,
    ]);
  }
  return [...groups.entries()].map(([id, grouped]) => ({
    id,
    title: grouped[0].ui.stepTitle,
    description: grouped[0].ui.stepDescription,
    requirements: grouped,
  }));
};

const buildSteps = (definition?: OnboardingDefinition): WizardStep[] => {
  if (!definition)
    return [{ id: "agreement", label: "Agreement", kind: "agreement" }];
  const externalModules = definition.modules.filter(
    (module) => module.kind === "external",
  );
  const externalModuleIds = new Set(externalModules.map(({ id }) => id));
  const destinationModuleIds = new Set(
    definition.modules
      .filter((module) => module.kind === "destination")
      .map(({ id }) => id),
  );
  const integrations: WizardStep[] = externalModules.map((module) => ({
    id: `integration-${module.id}`,
    label: module.label,
    kind: "integration" as const,
    module,
    groups: groupRequirements(
      definition.requirements.filter(
        (requirement) => requirement.module === module.id,
      ),
    ),
  }));
  const requirementSteps: Extract<WizardStep, { kind: "requirements" }>[] =
    groupRequirements(
      definition.requirements.filter(
        (requirement) => !externalModuleIds.has(requirement.module),
      ),
    ).map((group) => ({
      id: `requirements-${group.id}`,
      label: group.title,
      kind: "requirements",
      title: group.title,
      description: group.description,
      requirements: group.requirements,
    }));
  const destinationSteps = requirementSteps.filter((candidate) =>
    candidate.requirements.some((requirement) =>
      destinationModuleIds.has(requirement.module),
    ),
  );
  const remainingRequirementSteps = requirementSteps.filter(
    (candidate) => !destinationSteps.includes(candidate),
  );
  return [
    ...destinationSteps,
    { id: "agreement", label: "Agreement", kind: "agreement" },
    ...integrations,
    ...remainingRequirementSteps,
    { id: "review", label: "Review", kind: "review" },
    { id: "provision", label: "Publish", kind: "provision" },
  ];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const memberUsername = (value: unknown) =>
  isRecord(value) && typeof value.username === "string" ? value.username : "";

const memberDetails = (value: unknown): MemberDetail[] =>
  Array.isArray(value)
    ? value.filter(isRecord).map((item) => ({
        username: typeof item.username === "string" ? item.username : "",
        firstName: typeof item.firstName === "string" ? item.firstName : "",
        lastName: typeof item.lastName === "string" ? item.lastName : "",
        email: typeof item.email === "string" ? item.email : "",
      }))
    : [];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const completeMemberDetail = (value: MemberDetail) =>
  Boolean(
    value.username &&
    value.firstName.trim() &&
    value.lastName.trim() &&
    emailPattern.test(value.email.trim()),
  );

const complete = (requirement: Requirement, value: unknown) => {
  if (!requirement.required && (value === undefined || value === ""))
    return true;
  if (requirement.type === "member-details") {
    const details = memberDetails(value);
    return (
      details.length >= (requirement.validation?.minItems || 1) &&
      details.every(completeMemberDetail)
    );
  }
  if (requirement.cardinality === "many") {
    return (
      Array.isArray(value) &&
      value.length >= (requirement.validation?.minItems || 1)
    );
  }
  if (value === undefined || value === null || value === "") return false;
  if (typeof value === "string") {
    if (
      requirement.validation?.minLength &&
      value.length < requirement.validation.minLength
    )
      return false;
    if (
      requirement.validation?.pattern &&
      !new RegExp(requirement.validation.pattern).test(value)
    )
      return false;
  }
  return true;
};

const completeWithConfiguration = (
  requirement: Requirement,
  answers: Answers,
  configuration?: JoinLinkConfiguration,
) => {
  const value = answers[requirement.id];
  if (
    requirement.id === "scope_name" &&
    configuration?.scopeName.fromRepository &&
    (value === undefined || value === "")
  ) {
    if (answers.github_repository === undefined) return true;
    return (
      isRecord(answers.github_repository) &&
      complete(requirement, slug(String(answers.github_repository.name || "")))
    );
  }
  return complete(requirement, value);
};

const initialStep = (
  onboarding: Onboarding | undefined,
  answers: Answers,
  steps: WizardStep[],
) => {
  if (!onboarding) return 0;
  if (["PROVISIONING", "FAILED"].includes(onboarding.status)) {
    return steps.findIndex(({ kind }) => kind === "provision");
  }
  if (["READY", "COMPLETED"].includes(onboarding.status)) {
    return steps.findIndex(({ kind }) => kind === "review");
  }
  const incomplete = steps.findIndex((candidate) => {
    if (candidate.kind === "integration") {
      return (
        !integrationConnected(
          onboarding,
          candidate.module.id as IntegrationProvider,
        ) ||
        candidate.groups.some((group) =>
          group.requirements.some(
            (requirement) =>
              !completeWithConfiguration(
                requirement,
                answers,
                onboarding.joinLinkConfiguration,
              ),
          ),
        )
      );
    }
    return (
      candidate.kind === "requirements" &&
      candidate.requirements.some(
        (requirement) =>
          !completeWithConfiguration(
            requirement,
            answers,
            onboarding.joinLinkConfiguration,
          ),
      )
    );
  });
  if (incomplete >= 0) return incomplete;
  // Filled answers can still be an unvalidated draft. Revisit the last
  // configuration step so its Continue action submits final validation.
  const reviewIndex = steps.findIndex(({ kind }) => kind === "review");
  for (let index = reviewIndex - 1; index >= 0; index -= 1) {
    if (["integration", "requirements"].includes(steps[index].kind))
      return index;
  }
  return reviewIndex >= 0 ? reviewIndex : 0;
};

const initialIntegrationSubstep = (
  onboarding: Onboarding,
  integration: Extract<WizardStep, { kind: "integration" }>,
  answers: Answers,
) => {
  if (
    !integrationConnected(
      onboarding,
      integration.module.id as IntegrationProvider,
    )
  )
    return 0;
  const incomplete = integration.groups.findIndex((group) =>
    group.requirements.some(
      (requirement) => !complete(requirement, answers[requirement.id]),
    ),
  );
  return incomplete >= 0
    ? incomplete + 1
    : Math.max(integration.groups.length, 0);
};

const initialIntegrationSubsteps = (
  onboarding: Onboarding | undefined,
  answers: Answers,
  steps: WizardStep[],
) =>
  onboarding
    ? Object.fromEntries(
        steps
          .filter(
            (
              candidate,
            ): candidate is Extract<WizardStep, { kind: "integration" }> =>
              candidate.kind === "integration",
          )
          .map((integration) => [
            integration.id,
            initialIntegrationSubstep(onboarding, integration, answers),
          ]),
      )
    : {};

const integrationSubstepLabel = (
  module: OnboardingModule,
  group: RequirementGroup,
) => {
  const prefix = `${module.label} `;
  const label = group.title.startsWith(prefix)
    ? group.title.slice(prefix.length)
    : group.title;
  return label ? `${label[0].toUpperCase()}${label.slice(1)}` : group.title;
};

const displayValue = (value: unknown): string => {
  if (Array.isArray(value)) return value.map(displayValue).join(", ");
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.firstName || record.lastName || record.email) {
      const name =
        `${String(record.firstName || "")} ${String(record.lastName || "")}`.trim();
      const email = String(record.email || "");
      const username = String(record.username || "");
      return [name, email, username ? `@${username}` : ""]
        .filter(Boolean)
        .join(" · ");
    }
    return String(
      record.fullName ||
        record.title ||
        record.name ||
        record.username ||
        record.label ||
        record.number ||
        "Selected value",
    );
  }
  return String(value ?? "");
};

const slug = (value: string) => {
  const normalized = value
    .replace(/[^A-Za-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
  return normalized.length >= 3
    ? normalized
    : `${normalized || "repository"}-scope`;
};

const normalizedStatus = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const statusColumnNames: Record<string, Set<string>> = {
  github_in_progress_columns: new Set([
    "in progress",
    "work in progress",
    "doing",
    "wip",
  ]),
  github_in_review_columns: new Set([
    "in review",
    "review",
    "code review",
    "ready for review",
  ]),
  github_done_columns: new Set(["done", "complete", "completed", "finished"]),
};

const suggestedResourceValues = (
  requirement: Requirement,
  options: ResourceOption[],
): unknown => {
  if (requirement.id === "github_users") {
    return options.map(({ value }) => value);
  }
  if (requirement.id === "github_status_field") {
    return options.find(
      (option) =>
        normalizedStatus(option.label) === "status" ||
        normalizedStatus(
          String((option.value as Record<string, unknown>)?.name || ""),
        ) === "status",
    )?.value;
  }
  const names = statusColumnNames[requirement.id];
  if (!names || requirement.cardinality !== "many") return [];
  return options
    .filter((option) => {
      const value = option.value as Record<string, unknown> | undefined;
      return names.has(normalizedStatus(String(value?.name || option.label)));
    })
    .map(({ value }) => value);
};

export function JoinWizard({
  initialId,
  initialJoinLinkId,
}: {
  initialId?: string;
  initialJoinLinkId?: string;
}) {
  const [onboarding, setOnboarding] = useState<Onboarding>();
  const [joinLink, setJoinLink] = useState<JoinLink>();
  const [joinLinkLoading, setJoinLinkLoading] = useState(
    Boolean(initialJoinLinkId && !initialId),
  );
  const [joinLinkUnavailable, setJoinLinkUnavailable] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [restoring, setRestoring] = useState(Boolean(initialId));
  const [step, setStep] = useState(0);
  const [integrationSubsteps, setIntegrationSubsteps] = useState<
    Record<string, number>
  >({});
  const [options, setOptions] = useState<Record<string, ResourceOption[]>>({});
  const [optionLoading, setOptionLoading] = useState<Record<string, boolean>>(
    {},
  );
  const [optionRefresh, setOptionRefresh] = useState(0);
  const [repositoryPollingUntil, setRepositoryPollingUntil] = useState(0);
  const [searches, setSearches] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selectedTemplate = templates.find(
    ({ agreementTemplate }) => agreementTemplate._id === templateId,
  );
  const definition =
    onboarding?.onboardingDefinition || selectedTemplate?.onboardingDefinition;
  const joinLinkConfiguration =
    onboarding?.joinLinkConfiguration || joinLink?.configuration;
  const steps = useMemo(() => buildSteps(definition), [definition]);
  const activeStep = steps[step];
  const activeIntegrationSubstep =
    activeStep?.kind === "integration" && onboarding
      ? (integrationSubsteps[activeStep.id] ??
        initialIntegrationSubstep(onboarding, activeStep, answers))
      : 0;
  const agreementTemplateLocked = Boolean(
    joinLinkConfiguration && !joinLinkConfiguration.agreementTemplate.editable,
  );
  const scopeNameFromRepository = Boolean(
    joinLinkConfiguration?.scopeName.fromRepository,
  );
  const scopeNameParticipantEditable = Boolean(
    joinLinkConfiguration?.scopeName.editable,
  );
  const onboardingId = onboarding?._id;

  const requirementLocked = (requirementId: string) => {
    if (!joinLinkConfiguration) return false;
    if (requirementId === "scope_organization")
      return !joinLinkConfiguration.organization.editable;
    if (requirementId === "scope_name")
      return !joinLinkConfiguration.scopeName.editable;
    if (
      [
        "agreement_validity_start",
        "agreement_validity_end",
        "agreement_timezone",
      ].includes(requirementId)
    )
      return !joinLinkConfiguration.agreementValidity.editable;
    return false;
  };

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unexpected error");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!initialJoinLinkId || initialId) return;
    let cancelled = false;
    api<JoinLink>(`/join-links/${encodeURIComponent(initialJoinLinkId)}`)
      .then((value) => {
        if (cancelled) return;
        setJoinLink(value);
        setTemplateId(value.configuration.agreementTemplate.value._id);
        setAnswers((current) => {
          const next: Answers = {
            ...current,
            scope_organization: value.configuration.organization.value,
          };
          if (value.configuration.scopeName.fromRepository) {
            delete next.scope_name;
          } else {
            next.scope_name = value.configuration.scopeName.value;
          }
          return next;
        });
      })
      .catch((cause) => {
        if (cancelled) return;
        setJoinLinkUnavailable(true);
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load the join link",
        );
      })
      .finally(() => {
        if (!cancelled) setJoinLinkLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialId, initialJoinLinkId]);

  useEffect(() => {
    if (!initialId) return;
    let cancelled = false;
    api<Onboarding>(`/onboardings/${encodeURIComponent(initialId)}`)
      .then((value) => {
        if (cancelled) return;
        const nextAnswers = defaultAnswers(
          value.onboardingDefinition,
          value.answers,
        );
        const nextSteps = buildSteps(value.onboardingDefinition);
        setOnboarding(value);
        setAnswers(nextAnswers);
        setStep(initialStep(value, nextAnswers, nextSteps));
        setIntegrationSubsteps(
          initialIntegrationSubsteps(value, nextAnswers, nextSteps),
        );
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to restore onboarding",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialId]);

  useEffect(() => {
    if (onboarding || restoring) return;
    let cancelled = false;
    api<TemplateOption[]>("/agreement-templates")
      .then((values) => {
        if (cancelled) return;
        setTemplates(values);
        setTemplateId(
          (current) => current || values[0]?.agreementTemplate._id || "",
        );
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load agreement templates",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onboarding, restoring]);

  const refresh = useCallback(async () => {
    if (!onboardingId) return;
    const value = await api<Onboarding>(`/onboardings/${onboardingId}`);
    setOnboarding(value);
    if (["COMPLETED", "FAILED"].includes(value.status)) {
      setStep(
        buildSteps(value.onboardingDefinition).findIndex(
          ({ kind }) => kind === "provision",
        ),
      );
    }
  }, [onboardingId]);

  useEffect(() => {
    if (onboarding?.status !== "PROVISIONING") return;
    const timer = setInterval(() => void refresh(), 1800);
    return () => clearInterval(timer);
  }, [onboarding?.status, refresh]);

  const activeRequirements = useMemo(() => {
    if (activeStep?.kind === "requirements") return activeStep.requirements;
    if (
      activeStep?.kind === "integration" &&
      onboarding &&
      integrationConnected(
        onboarding,
        activeStep.module.id as IntegrationProvider,
      ) &&
      activeIntegrationSubstep > 0
    )
      return (
        activeStep.groups[activeIntegrationSubstep - 1]?.requirements || []
      );
    return [];
  }, [activeIntegrationSubstep, activeStep, onboarding]);
  const optionDependencyKey = JSON.stringify(
    activeRequirements.flatMap((requirement) =>
      (requirement.dependsOn || []).map((dependency) => [
        dependency,
        answers[dependency],
      ]),
    ),
  );

  useEffect(() => {
    if (!activeRequirements.length) return;
    let cancelled = false;
    const load = async (requirement: Requirement) => {
      if (requirement.type !== "resource") return;
      const dependenciesReady = (requirement.dependsOn || []).every(
        (dependency) => answers[dependency] !== undefined,
      );
      if (!dependenciesReady) return;
      setOptionLoading((current) => ({ ...current, [requirement.id]: true }));
      try {
        const path = onboarding?._id
          ? `/onboardings/${onboarding._id}/requirements/${requirement.id}/options`
          : requirement.id === "scope_organization"
            ? "/organization-options"
            : undefined;
        if (!path) return;
        const values = await api<ResourceOption[]>(
          path,
          onboarding?._id
            ? { method: "POST", body: JSON.stringify({ answers }) }
            : undefined,
        );
        if (!cancelled) {
          setOptions((current) => ({ ...current, [requirement.id]: values }));
          const suggested = suggestedResourceValues(requirement, values);
          if (
            suggested !== undefined &&
            (!Array.isArray(suggested) || suggested.length > 0)
          ) {
            setAnswers((current) =>
              current[requirement.id] === undefined
                ? { ...current, [requirement.id]: suggested }
                : current,
            );
          }
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load available values",
          );
        }
      } finally {
        if (!cancelled) {
          setOptionLoading((current) => ({
            ...current,
            [requirement.id]: false,
          }));
        }
      }
    };
    void Promise.all(activeRequirements.map(load));
    return () => {
      cancelled = true;
    };
    // answers are represented by the dependency key to avoid reloading options for unrelated text fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeIntegrationSubstep,
    activeStep?.id,
    onboarding?._id,
    optionDependencyKey,
    optionRefresh,
  ]);

  useEffect(() => {
    if (
      !repositoryPollingUntil ||
      !activeRequirements.some(({ id }) => id === "github_repository")
    )
      return;
    const refreshRepositories = () => {
      if (Date.now() >= repositoryPollingUntil) {
        setRepositoryPollingUntil(0);
        return;
      }
      setOptionRefresh((current) => current + 1);
    };
    refreshRepositories();
    const timer = setInterval(refreshRepositories, 3_000);
    return () => clearInterval(timer);
  }, [activeRequirements, repositoryPollingUntil]);

  const githubRepositoryActions = useMemo<ResourceAction[]>(() => {
    const installations = onboarding?.integrations?.github?.installations || [];
    const configurationActions = installations
      .filter(({ htmlUrl }) => Boolean(htmlUrl))
      .map(({ accountLogin, htmlUrl }) => ({
        label: `Manage access for ${accountLogin}`,
        href: htmlUrl,
        onClick: () => setRepositoryPollingUntil(Date.now() + 2 * 60_000),
      }));
    return [
      ...configurationActions,
      {
        label: "Refresh repositories",
        onClick: () => setOptionRefresh((current) => current + 1),
      },
    ];
  }, [onboarding?.integrations?.github?.installations]);

  const createOnboarding = () =>
    run(async () => {
      if (!templateId) throw new Error("Select an agreement template.");
      const value = await api<Onboarding>("/onboardings", {
        method: "POST",
        body: JSON.stringify({
          agreementTemplateId: templateId,
          joinLinkId: initialJoinLinkId,
          answers: {
            scope_organization: answers.scope_organization,
            ...(typeof answers.scope_name === "string" && answers.scope_name
              ? { scope_name: answers.scope_name }
              : {}),
          },
        }),
      });
      const nextAnswers = defaultAnswers(
        value.onboardingDefinition,
        value.answers,
      );
      const nextSteps = buildSteps(value.onboardingDefinition);
      setOnboarding(value);
      setAnswers(nextAnswers);
      setStep(initialStep(value, nextAnswers, nextSteps));
      setIntegrationSubsteps(
        initialIntegrationSubsteps(value, nextAnswers, nextSteps),
      );
      history.replaceState(null, "", `/?onboarding=${value._id}`);
    });

  const connect = (provider: IntegrationProvider) =>
    run(async () => {
      const value = await api<{
        authorizationUrl?: string;
        onboarding?: Onboarding;
      }>(`/onboardings/${onboarding!._id}/integrations/${provider}/connect`, {
        method: "POST",
      });
      if (value.authorizationUrl) {
        window.location.assign(value.authorizationUrl);
        return;
      }
      if (!value.onboarding)
        throw new Error("Integration did not return a connection");
      setOnboarding(value.onboarding);
      if (
        activeStep?.kind === "integration" &&
        activeStep.module.id === provider &&
        activeStep.groups.length
      ) {
        setIntegrationSubsteps((current) => ({
          ...current,
          [activeStep.id]: 1,
        }));
      } else {
        setStep((current) => current + 1);
      }
    });

  const updateAnswer = (requirementId: string, value: unknown) => {
    if (!definition) return;
    if (requirementLocked(requirementId)) return;
    const cleared = new Set<string>();
    const collectDependents = (id: string) => {
      for (const requirement of definition.requirements) {
        if (
          (requirement.dependsOn || []).includes(id) &&
          !cleared.has(requirement.id)
        ) {
          cleared.add(requirement.id);
          collectDependents(requirement.id);
        }
      }
    };
    collectDependents(requirementId);
    setAnswers((current) => {
      const next = { ...current, [requirementId]: value };
      for (const id of cleared) delete next[id];
      if (requirementId === "github_repository") {
        if (scopeNameFromRepository) {
          const previousRepositoryName =
            current.github_repository &&
            typeof current.github_repository === "object"
              ? slug(
                  String(
                    (current.github_repository as Record<string, unknown>)
                      .name || "",
                  ),
                )
              : "";
          const participantOverride =
            scopeNameParticipantEditable &&
            typeof current.scope_name === "string" &&
            current.scope_name.length > 0 &&
            current.scope_name !== previousRepositoryName;
          if (participantOverride) {
            next.scope_name = current.scope_name;
          } else if (value && typeof value === "object") {
            next.scope_name = slug(
              String((value as Record<string, unknown>).name || ""),
            );
          } else {
            delete next.scope_name;
          }
        } else if (!next.scope_name && value && typeof value === "object") {
          next.scope_name = slug(
            String((value as Record<string, unknown>).name || ""),
          );
        }
      }
      return next;
    });
    setError("");
  };

  const continueRequirements = () => {
    if (activeStep?.kind !== "requirements") return;
    const missing = activeStep.requirements.find(
      (requirement) =>
        !completeWithConfiguration(requirement, answers, joinLinkConfiguration),
    );
    if (missing) {
      setError(`Complete '${missing.ui.label}' before continuing.`);
      return;
    }
    if (!onboarding) {
      setError("");
      setStep((current) => current + 1);
      return;
    }
    const finalConfiguration = steps[step + 1]?.kind === "review";
    void run(async () => {
      const value = await api<Onboarding>(
        `/onboardings/${onboarding!._id}/${finalConfiguration ? "configuration" : "answers"}`,
        {
          method: finalConfiguration ? "PUT" : "PATCH",
          body: JSON.stringify({ answers }),
        },
      );
      setOnboarding(value);
      setAnswers(value.answers || answers);
      setStep((current) => current + 1);
    });
  };

  const continueIntegration = () => {
    if (activeStep?.kind !== "integration" || !onboarding) return;
    const integration = activeStep;
    const provider = integration.module.id as IntegrationProvider;
    if (activeIntegrationSubstep === 0) {
      if (!integrationConnected(onboarding, provider)) {
        void connect(provider);
        return;
      }
      if (!integration.groups.length) {
        setStep((current) => current + 1);
        return;
      }
      setIntegrationSubsteps((current) => ({
        ...current,
        [integration.id]: 1,
      }));
      return;
    }

    const group = integration.groups[activeIntegrationSubstep - 1];
    if (!group) return;
    const missing = group.requirements.find(
      (requirement) => !complete(requirement, answers[requirement.id]),
    );
    if (missing) {
      if (missing.type === "member-details") {
        const incomplete = memberDetails(answers[missing.id]).find(
          (detail) => !completeMemberDetail(detail),
        );
        setError(
          incomplete?.username
            ? `Complete First Name, Last Name and E-mail address for @${incomplete.username} before continuing.`
            : "Complete First Name, Last Name and E-mail address for every selected member before continuing.",
        );
        return;
      }
      setError(`Complete '${missing.ui.label}' before continuing.`);
      return;
    }
    void run(async () => {
      const finalConfiguration =
        activeIntegrationSubstep === integration.groups.length &&
        steps[step + 1]?.kind === "review";
      const value = await api<Onboarding>(
        `/onboardings/${onboarding._id}/${finalConfiguration ? "configuration" : "answers"}`,
        {
          method: finalConfiguration ? "PUT" : "PATCH",
          body: JSON.stringify({ answers }),
        },
      );
      setOnboarding(value);
      setAnswers(value.answers || answers);
      if (activeIntegrationSubstep < integration.groups.length) {
        setIntegrationSubsteps((current) => ({
          ...current,
          [integration.id]: activeIntegrationSubstep + 1,
        }));
      } else {
        setStep((current) => current + 1);
      }
    });
  };

  const backIntegration = () => {
    if (activeStep?.kind !== "integration") return;
    setError("");
    if (activeIntegrationSubstep > 0) {
      setIntegrationSubsteps((current) => ({
        ...current,
        [activeStep.id]: activeIntegrationSubstep - 1,
      }));
      return;
    }
    setStep((current) => current - 1);
  };

  const back = () => {
    setError("");
    setStep((current) => Math.max(0, current - 1));
  };

  const provision = (retry = false) =>
    run(async () => {
      if (!retry && onboarding?.status !== "READY")
        throw new Error("Complete configuration before publishing.");
      const value = await api<Onboarding>(
        `/onboardings/${onboarding!._id}/${retry ? "retry" : "provision"}`,
        { method: "POST" },
      );
      setOnboarding(value);
      setStep(steps.findIndex(({ kind }) => kind === "provision"));
    });

  const completed = onboarding?.status === "COMPLETED";
  const scopeAndAgreement = onboarding?.result?.scopeAndAgreement;
  const totalCheckpoints = Number(onboarding?.result?.totalCheckpoints || 9);
  const progress = Math.round(
    ((onboarding?.checkpoints.length || 0) / totalCheckpoints) * 100,
  );
  const renderRequirementField = (requirement: Requirement) =>
    requirement.type === "member-details" ? (
      <MemberDetailsField
        key={requirement.id}
        requirement={requirement}
        members={answers[requirement.dependsOn?.[0] || ""]}
        value={answers[requirement.id]}
        onChange={(value) => updateAnswer(requirement.id, value)}
      />
    ) : (
      <RequirementField
        key={requirement.id}
        requirement={requirement}
        value={answers[requirement.id]}
        options={options[requirement.id] || []}
        loading={Boolean(optionLoading[requirement.id])}
        dependenciesReady={(requirement.dependsOn || []).every(
          (dependency) => answers[dependency] !== undefined,
        )}
        search={searches[requirement.id] || ""}
        resourceActions={
          requirement.id === "github_repository"
            ? githubRepositoryActions
            : undefined
        }
        locked={requirementLocked(requirement.id)}
        onSearch={(value) =>
          setSearches((current) => ({
            ...current,
            [requirement.id]: value,
          }))
        }
        onChange={(value) => updateAnswer(requirement.id, value)}
      />
    );
  const renderRequirementFields = (requirements: Requirement[]) => {
    const columnIds = [
      "github_in_progress_columns",
      "github_in_review_columns",
      "github_done_columns",
    ];
    const columns = columnIds.flatMap((id) =>
      requirements.filter((requirement) => requirement.id === id),
    );
    const firstColumn = requirements.find((requirement) =>
      columnIds.includes(requirement.id),
    );

    return requirements.map((requirement) => {
      if (!columnIds.includes(requirement.id))
        return renderRequirementField(requirement);
      if (requirement.id !== firstColumn?.id) return null;
      return (
        <div
          className="workflow-columns grid grid-cols-1 items-start gap-4 sm:grid-cols-3"
          key="github-workflow-columns"
          role="group"
          aria-label="Workflow column mappings"
        >
          {columns.map(renderRequirementField)}
        </div>
      );
    });
  };

  if (joinLinkLoading) {
    return (
      <Card className="min-w-0 gap-4 p-6">
        <Loading text="Loading join link configuration…" />
      </Card>
    );
  }

  if (joinLinkUnavailable) {
    return (
      <Card className="min-w-0 gap-4 p-6">
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {error || "This join link is unavailable."}
          </AlertDescription>
        </Alert>
      </Card>
    );
  }

  if (templatesLoading && !onboarding) {
    return (
      <Card className="min-w-0 gap-4 p-6">
        <Loading text="Loading onboarding steps…" />
      </Card>
    );
  }

  return (
    <div className="wizard">
      <aside className="steps" aria-label="Onboarding progress">
        {steps.map((candidate, index) => (
          <div
            key={candidate.id}
            className={`step ${index === step ? "active" : ""} ${completed || index < step ? "done" : ""}`}
            aria-current={index === step ? "step" : undefined}
          >
            <span className="step-index">
              {completed || index < step ? "✓" : index + 1}
            </span>
            <span>{candidate.label}</span>
          </div>
        ))}
      </aside>

      <Card className="min-w-0 gap-4 p-6" aria-live="polite">
        {error && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {activeStep?.kind === "agreement" && (
          <>
            <div>
              <div className="eyebrow">Registry catalog</div>
              <h2>
                {agreementTemplateLocked ? "Agreement" : "Choose an agreement"}
              </h2>
              <p>
                {agreementTemplateLocked
                  ? "This agreement template was predefined by the organization administrator."
                  : "Each agreement brings its own onboarding definition, required integrations and data mappings."}
              </p>
            </div>
            {onboarding ? (
              <Card className="gap-2 border border-primary bg-primary/10 p-4">
                <strong>{onboarding.agreementTemplate.displayName}</strong>
                <span>{onboarding.agreementTemplate.description}</span>
              </Card>
            ) : agreementTemplateLocked && joinLinkConfiguration ? (
              <Card className="gap-2 border border-primary bg-primary/10 p-4">
                <strong>
                  {joinLinkConfiguration.agreementTemplate.value.displayName}
                </strong>
                <span>
                  {joinLinkConfiguration.agreementTemplate.value.description}
                </span>
                <span>Set by the join link</span>
              </Card>
            ) : templatesLoading ? (
              <Loading text="Loading public agreements…" />
            ) : templates.length ? (
              <div className="option-grid">
                {templates.map((option) => {
                  const integrations = option.onboardingDefinition.modules
                    .filter((module) => module.kind === "external")
                    .map((module) => module.label)
                    .join(" + ");
                  return (
                    <Button
                      type="button"
                      variant="outline"
                      className={`h-auto flex-col items-start whitespace-normal p-4 text-left ${templateId === option.agreementTemplate._id ? "border-primary bg-primary/10" : ""}`}
                      aria-pressed={templateId === option.agreementTemplate._id}
                      key={option.agreementTemplate._id}
                      onClick={() =>
                        setTemplateId(option.agreementTemplate._id)
                      }
                    >
                      <strong>{option.agreementTemplate.displayName}</strong>
                      <span>{option.agreementTemplate.description}</span>
                      <span>
                        {option.agreementTemplate.guarantees.length} guarantees
                        · {integrations}
                      </span>
                    </Button>
                  );
                })}
              </div>
            ) : (
              <Empty text="No supported public Agreement Templates are available in Registry." />
            )}
            {selectedTemplate && (
              <Alert role="status">
                <AlertDescription>
                  The wizard will request{" "}
                  {selectedTemplate.onboardingDefinition.requirements.length}{" "}
                  data fields across this onboarding.
                </AlertDescription>
              </Alert>
            )}
            {joinLinkConfiguration && (
              <Alert role="status">
                <AlertDescription>
                  Predefined onboarding values have been supplied by the
                  organization. Fields marked as set by the join link cannot be
                  changed.
                </AlertDescription>
              </Alert>
            )}
            <div className="actions">
              <Button
                variant="outline"
                onClick={back}
                disabled={busy || step === 0}
              >
                Back
              </Button>
              {onboarding ? (
                <Button
                  disabled={busy}
                  onClick={() => {
                    setError("");
                    setStep((current) => current + 1);
                  }}
                >
                  Continue
                </Button>
              ) : (
                <Button
                  onClick={createOnboarding}
                  disabled={busy || !templateId}
                >
                  Use agreement
                </Button>
              )}
            </div>
          </>
        )}

        {activeStep?.kind === "integration" && (
          <IntegrationStep
            module={activeStep.module}
            groups={activeStep.groups}
            substep={activeIntegrationSubstep}
            onboarding={onboarding!}
            busy={busy}
            onBack={backIntegration}
            onContinue={continueIntegration}
          >
            {activeIntegrationSubstep > 0
              ? renderRequirementFields(
                  activeStep.groups[activeIntegrationSubstep - 1]
                    ?.requirements || [],
                )
              : null}
          </IntegrationStep>
        )}

        {activeStep?.kind === "requirements" && (
          <>
            <div>
              <div className="eyebrow">Required information</div>
              <h2>{activeStep.title}</h2>
              <p>{activeStep.description}</p>
            </div>
            {scopeNameFromRepository &&
              activeStep.requirements.some(({ id }) => id === "scope_name") && (
                <Alert role="status">
                  <AlertDescription>
                    {scopeNameParticipantEditable
                      ? "Leave the Scope and agreement name blank to use the enrolled repository name automatically, or enter a different name."
                      : "The Scope and agreement name will be set automatically from the enrolled repository."}
                  </AlertDescription>
                </Alert>
              )}
            {renderRequirementFields(
              activeStep.requirements.filter(
                ({ id }) =>
                  !(
                    scopeNameFromRepository &&
                    !scopeNameParticipantEditable &&
                    id === "scope_name"
                  ),
              ),
            )}
            <div className="actions">
              {step > 0 && (
                <Button
                  variant="outline"
                  onClick={back}
                  disabled={busy}
                >
                  Back
                </Button>
              )}
              <Button onClick={continueRequirements} disabled={busy}>
                Continue
              </Button>
            </div>
          </>
        )}

        {activeStep?.kind === "review" && onboarding && (
          <>
            <div>
              <div className="eyebrow">
                {completed ? "Onboarding complete" : "Ready to publish"}
              </div>
              <h2>Review the completed onboarding</h2>
              <p>
                {completed
                  ? "These are the saved agreement and configuration details for your completed onboarding."
                  : "Join will materialize signatures and the Scope tree using the selected agreement's mappings, publish the Scope and versioned Agreement, then start its calculations."}
              </p>
            </div>
            <dl className="summary">
              <dt>Agreement</dt>
              <dd>{onboarding.agreementTemplate.displayName}</dd>
              <dt>Guarantees</dt>
              <dd>{onboarding.agreementTemplate.guarantees.length}</dd>
              {definition?.requirements.map((requirement) => (
                <ReviewAnswer
                  key={requirement.id}
                  label={requirement.ui.label}
                  value={displayValue(answers[requirement.id])}
                />
              ))}
            </dl>
            {!completed && (
              <div className="actions">
                <Button
                  variant="outline"
                  onClick={back}
                  disabled={busy}
                >
                  Back
                </Button>
                <Button
                  onClick={() => provision()}
                  disabled={busy || onboarding.status !== "READY"}
                >
                  Provision project
                </Button>
              </div>
            )}
          </>
        )}

        {activeStep?.kind === "provision" && (
          <>
            <div>
              <div className="eyebrow">
                {completed
                  ? "Onboarding complete"
                  : onboarding?.status === "FAILED"
                    ? "Needs attention"
                    : "Publishing"}
              </div>
              <h2>
                {completed
                  ? "Your project is connected"
                  : onboarding?.status === "FAILED"
                    ? "Publishing stopped"
                    : "Setting up Governify"}
              </h2>
              <p>
                {completed
                  ? "The versioned Agreement, Scope tree and recurring calculation task are ready."
                  : "This page updates automatically and the worker resumes from its last checkpoint."}
              </p>
            </div>
            <Alert
              variant={
                onboarding?.status === "FAILED" ? "destructive" : "default"
              }
              role="status"
            >
              <AlertDescription>
                {completed
                  ? "All ecosystem provisioning steps completed."
                  : onboarding?.failure?.message ||
                    "Publishing is running in the background…"}
              </AlertDescription>
            </Alert>
            <Progress
              value={completed ? 100 : progress}
              aria-label="Onboarding completion"
            />
            <div className="muted">
              {onboarding?.checkpoints.length || 0} of {totalCheckpoints} steps
              completed
            </div>
            {onboarding?.status === "FAILED" && (
              <div className="actions">
                <Button onClick={() => provision(true)} disabled={busy}>
                  Retry from checkpoint
                </Button>
              </div>
            )}
          </>
        )}

        {completed && scopeAndAgreement && (
          <Accordion type="single" collapsible>
            <AccordionItem value="result-data">
              <AccordionTrigger>
                Inspect Scope and Agreement data
              </AccordionTrigger>
              <AccordionContent>
                <pre style={{ overflow: "auto", whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(scopeAndAgreement, null, 2)}
                </pre>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
        {completed &&
          (onboarding.result?.organizationURL ||
            onboarding.result?.dashboardURL) && (
            <div className="actions">
              <OnboardingResultLinks onboarding={onboarding} />
            </div>
          )}

        {busy && <Loading text="Working…" />}
      </Card>
    </div>
  );
}

function IntegrationStep({
  module,
  groups,
  substep,
  onboarding,
  busy,
  onBack,
  onContinue,
  children,
}: {
  module: OnboardingModule;
  groups: RequirementGroup[];
  substep: number;
  onboarding: Onboarding;
  busy: boolean;
  onBack: () => void;
  onContinue: () => void;
  children?: ReactNode;
}) {
  const provider = module.id as IntegrationProvider;
  const connected = integrationConnected(onboarding, provider);
  const group = substep > 0 ? groups[substep - 1] : undefined;
  const account =
    provider === "github"
      ? onboarding.integrations?.github?.accountLogin ||
        (onboarding.integrations?.github?.installations?.length === 1
          ? onboarding.integrations.github.installations[0].accountLogin
          : onboarding.integrations?.github?.installations?.length
            ? `${onboarding.integrations.github.installations.length} GitHub accounts`
            : undefined)
      : onboarding.integrations?.zenhub?.accountName;
  return (
    <>
      <div>
        <div className="eyebrow">Required integration</div>
        <h2>{module.label}</h2>
        <p>
          {module.authorization === "mock"
            ? "Connect the demo and complete its required configuration in one guided step."
            : "Connect GitHub and complete the repository, Project and member configuration required by this agreement."}
        </p>
      </div>
      <div
        className="integration-substeps"
        aria-label={`${module.label} setup progress`}
      >
        {[
          "Connect",
          ...groups.map((candidate) =>
            integrationSubstepLabel(module, candidate),
          ),
        ].map((label, index) => (
          <div
            className={`integration-substep ${index === substep ? "active" : ""} ${index < substep ? "done" : ""}`}
            key={`${index}:${label}`}
          >
            <span>{index < substep ? "✓" : index + 1}</span>
            <strong>{label}</strong>
          </div>
        ))}
      </div>
      {substep === 0 ? (
        <>
          <div>
            <h3>Connect {module.label}</h3>
            <p>
              {module.authorization === "mock"
                ? "This demo uses deterministic data and does not contact ZenHub."
                : "Join discovers existing GitHub App installations first and only requests installation when needed."}
            </p>
          </div>
          {connected ? (
            <Alert role="status" className="text-green-700 dark:text-green-400">
              <AlertDescription>
                Connected to {account || module.label}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert role="status">
              <AlertDescription>
                {module.authorization === "mock"
                  ? "A simulated workspace and users will become available."
                  : "GitHub will return you to this same setup step after authorization."}
              </AlertDescription>
            </Alert>
          )}
        </>
      ) : group ? (
        <>
          <div>
            <h3>{group.title}</h3>
            <p>{group.description}</p>
          </div>
          {children}
        </>
      ) : null}
      <div className="actions">
        <Button variant="outline" onClick={onBack} disabled={busy}>
          Back
        </Button>
        <Button onClick={onContinue} disabled={busy}>
          {substep === 0 && !connected
            ? module.authorization === "mock"
              ? "Connect demo"
              : "Connect GitHub"
            : "Continue"}
        </Button>
      </div>
    </>
  );
}

function MemberDetailsField({
  requirement,
  members,
  value,
  onChange,
}: {
  requirement: Requirement;
  members: unknown;
  value: unknown;
  onChange: (value: MemberDetail[]) => void;
}) {
  const selectedMembers = Array.isArray(members)
    ? members.map(memberUsername).filter(Boolean)
    : [];
  const detailsByUsername = new Map(
    memberDetails(value).map((detail) => [detail.username, detail]),
  );
  const update = (
    username: string,
    field: "firstName" | "lastName" | "email",
    nextValue: string,
  ) => {
    onChange(
      selectedMembers.map((selectedUsername) => ({
        username: selectedUsername,
        firstName: detailsByUsername.get(selectedUsername)?.firstName || "",
        lastName: detailsByUsername.get(selectedUsername)?.lastName || "",
        email: detailsByUsername.get(selectedUsername)?.email || "",
        ...(selectedUsername === username ? { [field]: nextValue } : {}),
      })),
    );
  };

  return (
    <Field>
      <FieldTitle>{requirement.ui.label}</FieldTitle>
      {requirement.ui.help && (
        <FieldDescription>{requirement.ui.help}</FieldDescription>
      )}
      <div className="member-details-list">
        {selectedMembers.map((username, index) => {
          const detail = detailsByUsername.get(username);
          const idPrefix = `${requirement.id}-${index}`;
          return (
            <FieldSet className="member-details-card gap-2" key={username}>
              <FieldLegend className="mb-0">@{username}</FieldLegend>
              <div className="member-details-grid">
                <Field>
                  <FieldLabel htmlFor={`${idPrefix}-first-name`}>
                    First Name
                  </FieldLabel>
                  <Input
                    id={`${idPrefix}-first-name`}
                    type="text"
                    value={detail?.firstName || ""}
                    onChange={(event) =>
                      update(username, "firstName", event.target.value)
                    }
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${idPrefix}-last-name`}>
                    Last Name
                  </FieldLabel>
                  <Input
                    id={`${idPrefix}-last-name`}
                    type="text"
                    value={detail?.lastName || ""}
                    onChange={(event) =>
                      update(username, "lastName", event.target.value)
                    }
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${idPrefix}-email`}>
                    E-mail address
                  </FieldLabel>
                  <Input
                    id={`${idPrefix}-email`}
                    type="email"
                    value={detail?.email || ""}
                    onChange={(event) =>
                      update(username, "email", event.target.value)
                    }
                    required
                  />
                </Field>
              </div>
            </FieldSet>
          );
        })}
      </div>
    </Field>
  );
}

function ReviewAnswer({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <div className="row muted" role="status">
      <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> {text}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Alert role="status">
      <AlertDescription>{text}</AlertDescription>
    </Alert>
  );
}
