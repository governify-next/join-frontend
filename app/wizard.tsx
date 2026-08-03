"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { RequirementField, type ResourceAction } from "./requirement-field";
import type {
  IntegrationProvider,
  Onboarding,
  OnboardingDefinition,
  OnboardingModule,
  Requirement,
  ResourceOption,
  TemplateOption,
} from "./types";

type Answers = Record<string, unknown>;
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

const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`/api/join${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || "Request failed");
  return body.data as T;
};

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
    if (requirement.default === "now") answers[requirement.id] = localDate(new Date());
    if (requirement.default === "oneYearFromNow") {
      answers[requirement.id] = localDate(
        new Date(Date.now() + 365 * 24 * 60 * 60_000),
      );
    }
    if (requirement.default === "browserTimezone") {
      answers[requirement.id] = Intl.DateTimeFormat().resolvedOptions().timeZone;
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
  if (!definition) return [{ id: "agreement", label: "Agreement", kind: "agreement" }];
  const externalModules = definition.modules.filter(
    (module) => module.kind === "external",
  );
  const externalModuleIds = new Set(externalModules.map(({ id }) => id));
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
  const requirementSteps: WizardStep[] = groupRequirements(
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
  return [
    { id: "agreement", label: "Agreement", kind: "agreement" },
    ...integrations,
    ...requirementSteps,
    { id: "review", label: "Review", kind: "review" },
    { id: "provision", label: "Publish", kind: "provision" },
  ];
};

const complete = (requirement: Requirement, value: unknown) => {
  if (!requirement.required && (value === undefined || value === "")) return true;
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

const initialStep = (
  onboarding: Onboarding | undefined,
  answers: Answers,
  steps: WizardStep[],
) => {
  if (!onboarding) return 0;
  if (["PROVISIONING", "COMPLETED", "FAILED"].includes(onboarding.status)) {
    return steps.findIndex(({ kind }) => kind === "provision");
  }
  if (onboarding.status === "READY") {
    return steps.findIndex(({ kind }) => kind === "review");
  }
  const missingIntegration = steps.findIndex(
    (candidate) =>
      candidate.kind === "integration" &&
      (!integrationConnected(
        onboarding,
        candidate.module.id as IntegrationProvider,
      ) ||
        candidate.groups.some((group) =>
          group.requirements.some(
            (requirement) => !complete(requirement, answers[requirement.id]),
          ),
        )),
  );
  if (missingIntegration >= 0) return missingIntegration;
  const incomplete = steps.findIndex(
    (candidate) =>
      candidate.kind === "requirements" &&
      candidate.requirements.some(
        (requirement) => !complete(requirement, answers[requirement.id]),
      ),
  );
  return incomplete >= 0
    ? incomplete
    : steps.findIndex(({ kind }) => kind === "review");
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

const slug = (value: string) =>
  value
    .replace(/[^A-Za-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);

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
  github_done_columns: new Set([
    "done",
    "complete",
    "completed",
    "finished",
  ]),
};

const suggestedResourceValues = (
  requirement: Requirement,
  options: ResourceOption[],
) => {
    if (requirement.id === "github_users") {
    return options.map(({ value }) => value);
  }
  const names = statusColumnNames[requirement.id];
  if (!names || requirement.cardinality !== "many") return [];
  return options
    .filter((option) => {
      const value = option.value as Record<string, unknown> | undefined;
      return names.has(
        normalizedStatus(String(value?.name || option.label)),
      );
    })
    .map(({ value }) => value);
};

export function JoinWizard({
  initial,
  governifyUrl,
}: {
  initial?: Onboarding;
  governifyUrl: string;
}) {
  const initialAnswers = defaultAnswers(
    initial?.onboardingDefinition,
    initial?.answers,
  );
  const initialSteps = buildSteps(initial?.onboardingDefinition);
  const [onboarding, setOnboarding] = useState(initial);
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [templatesLoading, setTemplatesLoading] = useState(!initial);
  const [step, setStep] = useState(() =>
    initialStep(initial, initialAnswers, initialSteps),
  );
  const [integrationSubsteps, setIntegrationSubsteps] = useState<
    Record<string, number>
  >(() => initialIntegrationSubsteps(initial, initialAnswers, initialSteps));
  const [options, setOptions] = useState<Record<string, ResourceOption[]>>({});
  const [optionLoading, setOptionLoading] = useState<Record<string, boolean>>({});
  const [optionRefresh, setOptionRefresh] = useState(0);
  const [repositoryPollingUntil, setRepositoryPollingUntil] = useState(0);
  const [searches, setSearches] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const definition = onboarding?.onboardingDefinition;
  const steps = useMemo(() => buildSteps(definition), [definition]);
  const activeStep = steps[step];
  const activeIntegrationSubstep =
    activeStep?.kind === "integration" && onboarding
      ? (integrationSubsteps[activeStep.id] ??
        initialIntegrationSubstep(onboarding, activeStep, answers))
      : 0;
  const selectedTemplate = templates.find(
    ({ agreementTemplate }) => agreementTemplate._id === templateId,
  );
  const onboardingId = onboarding?._id;

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
    if (onboarding) return;
    let cancelled = false;
    api<TemplateOption[]>("/agreement-templates")
      .then((values) => {
        if (cancelled) return;
        setTemplates(values);
        setTemplateId((current) => current || values[0]?.agreementTemplate._id || "");
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
  }, [onboarding]);

  const refresh = useCallback(async () => {
    if (!onboardingId) return;
    const value = await api<Onboarding>(`/onboardings/${onboardingId}`);
    setOnboarding(value);
    if (["COMPLETED", "FAILED"].includes(value.status)) {
      setStep(buildSteps(value.onboardingDefinition).findIndex(({ kind }) => kind === "provision"));
    }
  }, [onboardingId]);

  useEffect(() => {
    if (onboarding?.status !== "PROVISIONING") return;
    const timer = setInterval(() => void refresh(), 1800);
    return () => clearInterval(timer);
  }, [onboarding?.status, refresh]);

  const activeRequirements = useMemo(
    () => {
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
    },
    [activeIntegrationSubstep, activeStep, onboarding],
  );
  const optionDependencyKey = JSON.stringify(
    activeRequirements.flatMap((requirement) =>
      (requirement.dependsOn || []).map((dependency) => [
        dependency,
        answers[dependency],
      ]),
    ),
  );

  useEffect(() => {
    if (!onboarding?._id || !activeRequirements.length) return;
    let cancelled = false;
    const load = async (requirement: Requirement) => {
      if (requirement.type !== "resource") return;
      const dependenciesReady = (requirement.dependsOn || []).every(
        (dependency) => answers[dependency] !== undefined,
      );
      if (!dependenciesReady) return;
      setOptionLoading((current) => ({ ...current, [requirement.id]: true }));
      try {
        const values = await api<ResourceOption[]>(
          `/onboardings/${onboarding._id}/requirements/${requirement.id}/options`,
          { method: "POST", body: JSON.stringify({ answers }) },
        );
        if (!cancelled) {
          setOptions((current) => ({ ...current, [requirement.id]: values }));
          const suggested = suggestedResourceValues(requirement, values);
          if (suggested.length) {
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
            cause instanceof Error ? cause.message : "Unable to load available values",
          );
        }
      } finally {
        if (!cancelled) {
          setOptionLoading((current) => ({ ...current, [requirement.id]: false }));
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
        body: JSON.stringify({ agreementTemplateId: templateId }),
      });
      const nextAnswers = defaultAnswers(value.onboardingDefinition, value.answers);
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
      if (!value.onboarding) throw new Error("Integration did not return a connection");
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
    const cleared = new Set<string>();
    const collectDependents = (id: string) => {
      for (const requirement of definition.requirements) {
        if ((requirement.dependsOn || []).includes(id) && !cleared.has(requirement.id)) {
          cleared.add(requirement.id);
          collectDependents(requirement.id);
        }
      }
    };
    collectDependents(requirementId);
    setAnswers((current) => {
      const next = { ...current, [requirementId]: value };
      for (const id of cleared) delete next[id];
      if (
        requirementId === "github_repository" &&
        !next.scope_element_name &&
        value &&
        typeof value === "object"
      ) {
        next.scope_element_name = slug(
          String((value as Record<string, unknown>).name || ""),
        );
      }
      return next;
    });
    setError("");
  };

  const continueRequirements = () => {
    if (activeStep?.kind !== "requirements") return;
    const missing = activeStep.requirements.find(
      (requirement) => !complete(requirement, answers[requirement.id]),
    );
    if (missing) {
      setError(`Complete '${missing.ui.label}' before continuing.`);
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
      setError(`Complete '${missing.ui.label}' before continuing.`);
      return;
    }
    void run(async () => {
      const value = await api<Onboarding>(
        `/onboardings/${onboarding._id}/answers`,
        {
          method: "PATCH",
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
    if (activeIntegrationSubstep > 0) {
      setIntegrationSubsteps((current) => ({
        ...current,
        [activeStep.id]: activeIntegrationSubstep - 1,
      }));
      return;
    }
    setStep((current) => current - 1);
  };

  const provision = (retry = false) =>
    run(async () => {
      const value = await api<Onboarding>(
        `/onboardings/${onboarding!._id}/${retry ? "retry" : "provision"}`,
        { method: "POST" },
      );
      setOnboarding(value);
      setStep(steps.findIndex(({ kind }) => kind === "provision"));
    });

  const completed = onboarding?.status === "COMPLETED";
  const totalCheckpoints = Number(onboarding?.result?.totalCheckpoints || 9);
  const progress = Math.round(
    ((onboarding?.checkpoints.length || 0) / totalCheckpoints) * 100,
  );
  const renderRequirementFields = (requirements: Requirement[]) =>
    requirements.map((requirement) => (
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
        onSearch={(value) =>
          setSearches((current) => ({ ...current, [requirement.id]: value }))
        }
        onChange={(value) => updateAnswer(requirement.id, value)}
      />
    ));

  return (
    <div className="wizard">
      <aside className="steps" aria-label="Onboarding progress">
        {steps.map((candidate, index) => (
          <div
            key={candidate.id}
            className={`step ${index === step ? "active" : ""} ${index < step ? "done" : ""}`}
          >
            <span className="step-index">{index < step ? "✓" : index + 1}</span>
            <span>{candidate.label}</span>
          </div>
        ))}
      </aside>

      <section className="card stack" aria-live="polite">
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}

        {activeStep?.kind === "agreement" && (
          <>
            <div>
              <div className="eyebrow">Mock Registry catalog</div>
              <h2>Choose an agreement</h2>
              <p>
                Each agreement brings its own onboarding definition, required integrations and
                data mappings.
              </p>
            </div>
            {onboarding ? (
              <div className="option selected">
                <strong>{onboarding.agreementTemplate.displayName}</strong>
                <span>{onboarding.agreementTemplate.description}</span>
              </div>
            ) : templatesLoading ? (
              <Loading text="Loading mocked agreements…" />
            ) : templates.length ? (
              <div className="option-grid">
                {templates.map((option) => {
                  const integrations = option.onboardingDefinition.modules
                    .filter((module) => module.kind === "external")
                    .map((module) => module.label)
                    .join(" + ");
                  return (
                    <button
                      type="button"
                      className={`option ${templateId === option.agreementTemplate._id ? "selected" : ""}`}
                      key={option.agreementTemplate._id}
                      onClick={() => setTemplateId(option.agreementTemplate._id)}
                    >
                      <strong>{option.agreementTemplate.displayName}</strong>
                      <span>{option.agreementTemplate.description}</span>
                      <span>
                        {option.agreementTemplate.guarantees.length} guarantees · {integrations}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <Empty text="No mocked agreement templates are configured." />
            )}
            {selectedTemplate && (
              <div className="notice">
                The wizard will request {selectedTemplate.onboardingDefinition.requirements.length}
                {" "}data fields across this onboarding.
              </div>
            )}
            <div className="actions">
              {onboarding ? (
                <button className="button" onClick={() => setStep(1)}>
                  Continue
                </button>
              ) : (
                <button
                  className="button"
                  onClick={createOnboarding}
                  disabled={busy || !templateId}
                >
                  Use agreement
                </button>
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
            {renderRequirementFields(activeStep.requirements)}
            <div className="actions">
              <button
                className="button secondary"
                onClick={() => setStep((current) => current - 1)}
              >
                Back
              </button>
              <button className="button" onClick={continueRequirements} disabled={busy}>
                Continue
              </button>
            </div>
          </>
        )}

        {activeStep?.kind === "review" && onboarding && (
          <>
            <div>
              <div className="eyebrow">Ready to publish</div>
              <h2>Review the completed onboarding</h2>
              <p>
                Join will materialize signatures and Scope audit data using the selected agreement&apos;s
                mappings, publish the Scope and versioned Agreement, then start its calculations.
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
            <div className="actions">
              <button
                className="button secondary"
                onClick={() => setStep((current) => current - 1)}
              >
                Back
              </button>
              <button className="button" onClick={() => provision()} disabled={busy}>
                Provision project
              </button>
            </div>
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
                  ? "The versioned Agreement, Scope copy and recurring calculation task are ready."
                  : "This page updates automatically and the worker resumes from its last checkpoint."}
              </p>
            </div>
            <div
              className={`notice ${completed ? "success" : onboarding?.status === "FAILED" ? "error" : ""}`}
            >
              {completed
                ? "All ecosystem provisioning steps completed."
                : onboarding?.failure?.message || "Publishing is running in the background…"}
            </div>
            <div className="progress" aria-label={`${progress}% complete`}>
              <div style={{ width: `${completed ? 100 : progress}%` }} />
            </div>
            <div className="muted">
              {onboarding?.checkpoints.length || 0} of {totalCheckpoints} steps completed
            </div>
            {onboarding?.status === "FAILED" && (
              <div className="actions">
                <button className="button" onClick={() => provision(true)} disabled={busy}>
                  Retry from checkpoint
                </button>
              </div>
            )}
            {completed && onboarding?.result?.materialized && (
              <details className="notice">
                <summary>Inspect materialized Agreement and Scope</summary>
                <pre style={{ overflow: "auto", whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(onboarding.result.materialized, null, 2)}
                </pre>
              </details>
            )}
            {completed && (
              <div className="actions">
                <a
                  className="button"
                  href={`${governifyUrl}/organizations/${encodeURIComponent(String(onboarding?.result?.organizationName || ""))}`}
                >
                  Open organization
                </a>
              </div>
            )}
          </>
        )}

        {busy && <Loading text="Working…" />}
      </section>
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
      <div className="integration-substeps" aria-label={`${module.label} setup progress`}>
        {["Connect", ...groups.map((candidate) =>
          integrationSubstepLabel(module, candidate),
        )].map((label, index) => (
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
            <div className="notice success">
              Connected to {account || module.label}
            </div>
          ) : (
            <div className="notice">
              {module.authorization === "mock"
                ? "A simulated workspace and users will become available."
                : "GitHub will return you to this same setup step after authorization."}
            </div>
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
        <button className="button secondary" onClick={onBack}>
          Back
        </button>
        <button className="button" onClick={onContinue} disabled={busy}>
          {substep === 0 && !connected
            ? module.authorization === "mock"
              ? "Connect demo"
              : "Connect GitHub"
            : "Continue"}
        </button>
      </div>
    </>
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
    <div className="row muted">
      <span className="spinner" /> {text}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="notice">{text}</div>;
}
