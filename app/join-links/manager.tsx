"use client";

import { CheckIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { joinApi } from "@/lib/join-api";
import type {
  JoinLink,
  JoinLinkOrganization,
  JoinLinkResultOptions,
  TemplateOption,
} from "../types";

type EditableField =
  | "organization"
  | "agreementTemplate"
  | "agreementValidity"
  | "scopeName";
type EditableConfiguration = Record<EditableField, boolean>;

const initialEditable: EditableConfiguration = {
  organization: false,
  agreementTemplate: false,
  agreementValidity: false,
  scopeName: false,
};

const initialResultOptions: JoinLinkResultOptions = {
  dashboardURL: true,
  organizationURL: true,
  scopeAndAgreement: true,
};

const localDateTime = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const linkFieldLabels: Record<EditableField, string> = {
  organization: "Organization",
  agreementTemplate: "Agreement template",
  agreementValidity: "Agreement validity",
  scopeName: "Scope and agreement name",
};

const resultOptionLabels: Record<keyof JoinLinkResultOptions, string> = {
  dashboardURL: "Dashboard button",
  organizationURL: "Organization button",
  scopeAndAgreement: "Scope and Agreement data",
};

const errorMessage = (cause: unknown, fallback: string) =>
  cause instanceof Error ? cause.message : fallback;

const displayedScopeName = (link: JoinLink) =>
  link.configuration.scopeName.fromRepository
    ? "Repository name (automatic)"
    : link.configuration.scopeName.value;

export function JoinLinkManager() {
  const [organizations, setOrganizations] = useState<JoinLinkOrganization[]>(
    [],
  );
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [links, setLinks] = useState<JoinLink[]>([]);
  const [organizationName, setOrganizationName] = useState("");
  const [agreementTemplateId, setAgreementTemplateId] = useState("");
  const [scopeName, setScopeName] = useState("");
  const [scopeNameFromRepository, setScopeNameFromRepository] = useState(false);
  const [validityInitial, setValidityInitial] = useState("");
  const [validityEnd, setValidityEnd] = useState("");
  const [timezone, setTimezone] = useState("");
  const [editable, setEditable] =
    useState<EditableConfiguration>(initialEditable);
  const [resultOptions, setResultOptions] = useState<JoinLinkResultOptions>(
    initialResultOptions,
  );
  const [loading, setLoading] = useState(true);
  const [linksLoading, setLinksLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [origin, setOrigin] = useState("");
  const selectedTemplate = templates.find(
    ({ agreementTemplate }) => agreementTemplate._id === agreementTemplateId,
  );
  const supportsRepositoryScopeName = Boolean(
    selectedTemplate?.onboardingDefinition.requirements.some(
      ({ id }) => id === "github_repository",
    ),
  );

  useEffect(() => {
    const defaultsTimer = window.setTimeout(() => {
      const now = new Date();
      const nextYear = new Date(now);
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      setValidityInitial(localDateTime(now));
      setValidityEnd(localDateTime(nextYear));
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
      setOrigin(window.location.origin);
    }, 0);

    let cancelled = false;
    Promise.all([
      joinApi<JoinLinkOrganization[]>("/join-link-organizations"),
      joinApi<TemplateOption[]>("/agreement-templates"),
    ])
      .then(([organizationValues, templateValues]) => {
        if (cancelled) return;
        setOrganizations(organizationValues);
        setTemplates(templateValues);
        setLinksLoading(Boolean(organizationValues[0]?.name));
        setOrganizationName(organizationValues[0]?.name || "");
        setAgreementTemplateId(templateValues[0]?.agreementTemplate._id || "");
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(errorMessage(cause, "Unable to load join-link settings."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(defaultsTimer);
    };
  }, []);

  useEffect(() => {
    if (!organizationName) return;
    let cancelled = false;
    joinApi<JoinLink[]>(
      `/organizations/${encodeURIComponent(organizationName)}/join-links`,
    )
      .then((values) => {
        if (!cancelled) setLinks(values);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(errorMessage(cause, "Unable to load generated links."));
        }
      })
      .finally(() => {
        if (!cancelled) setLinksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationName]);

  const joinUrl = (id: string) =>
    `${origin}/?joinLink=${encodeURIComponent(id)}`;

  const copyLink = async (link: JoinLink) => {
    try {
      await navigator.clipboard.writeText(joinUrl(link._id));
      setNotice("Join link copied to the clipboard.");
      setError("");
    } catch {
      setError(
        "The join link could not be copied. Copy it from the field instead.",
      );
    }
  };

  const generate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!organizationName || !agreementTemplateId) {
      setError("Select an organization and an agreement template.");
      return;
    }

    setSaving(true);
    try {
      const link = await joinApi<JoinLink>(
        `/organizations/${encodeURIComponent(organizationName)}/join-links`,
        {
          method: "POST",
          body: JSON.stringify({
            agreementTemplateId,
            agreementValidity: {
              initial: validityInitial,
              end: validityEnd,
              timezone,
            },
            scopeName: scopeNameFromRepository ? undefined : scopeName,
            scopeNameFromRepository,
            editable,
            resultOptions,
          }),
        },
      );
      setLinks((current) => [link, ...current]);
      setNotice(
        "Join link generated. Only members of the organization can use it.",
      );
    } catch (cause) {
      setError(errorMessage(cause, "Unable to generate the join link."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card row muted">
        <span className="spinner" /> Loading administration options…
      </div>
    );
  }

  if (!organizations.length) {
    return (
      <div className="card stack">
        {error && <div className="notice error">{error}</div>}
        <div>
          <h2>No administrable organizations</h2>
          <p>
            You need the organization administrator role before you can generate
            join links.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-grid">
      <form className="card stack" onSubmit={generate}>
        <div>
          <h2>Link configuration</h2>
          <p>These values are stored with the generated link in Join.</p>
        </div>

        {error && <div className="notice error">{error}</div>}
        {notice && <div className="notice success">{notice}</div>}

        <ConfiguredField
          label="Organization"
          editable={editable.organization}
          onEditableChange={(value) =>
            setEditable((current) => ({ ...current, organization: value }))
          }
        >
          <select
            className="input"
            value={organizationName}
            onChange={(event) => {
              setLinks([]);
              setLinksLoading(true);
              setError("");
              setOrganizationName(event.target.value);
            }}
          >
            {organizations.map((organization) => (
              <option key={organization._id} value={organization.name}>
                {organization.displayName || organization.name}
              </option>
            ))}
          </select>
        </ConfiguredField>

        <ConfiguredField
          label="Agreement template"
          editable={editable.agreementTemplate}
          onEditableChange={(value) =>
            setEditable((current) => ({
              ...current,
              agreementTemplate: value,
            }))
          }
        >
          <select
            className="input"
            required
            value={agreementTemplateId}
            onChange={(event) => {
              const nextTemplateId = event.target.value;
              const nextTemplate = templates.find(
                ({ agreementTemplate }) =>
                  agreementTemplate._id === nextTemplateId,
              );
              setAgreementTemplateId(nextTemplateId);
              if (
                !nextTemplate?.onboardingDefinition.requirements.some(
                  ({ id }) => id === "github_repository",
                )
              ) {
                setScopeNameFromRepository(false);
              }
            }}
          >
            {templates.map(({ agreementTemplate }) => (
              <option key={agreementTemplate._id} value={agreementTemplate._id}>
                {agreementTemplate.displayName || agreementTemplate.name}
              </option>
            ))}
          </select>
        </ConfiguredField>

        <ConfiguredField
          label="Agreement validity"
          editable={editable.agreementValidity}
          onEditableChange={(value) =>
            setEditable((current) => ({
              ...current,
              agreementValidity: value,
            }))
          }
        >
          <div className="grid-2">
            <label className="field">
              <span>Starts</span>
              <input
                className="input"
                type="datetime-local"
                required
                value={validityInitial}
                onChange={(event) => setValidityInitial(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Ends</span>
              <input
                className="input"
                type="datetime-local"
                required
                value={validityEnd}
                onChange={(event) => setValidityEnd(event.target.value)}
              />
            </label>
          </div>
          <label className="field">
            <span>Timezone</span>
            <input
              className="input"
              required
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              placeholder="Europe/Madrid"
            />
          </label>
        </ConfiguredField>

        <ConfiguredField
          label="Scope and agreement name"
          editable={editable.scopeName}
          onEditableChange={(value) =>
            setEditable((current) => ({ ...current, scopeName: value }))
          }
        >
          <InputGroup className="h-11 rounded-[10px]">
            <InputGroupInput
              className="h-11"
              required={!scopeNameFromRepository}
              disabled={scopeNameFromRepository}
              minLength={3}
              maxLength={96}
              pattern="[A-Za-z0-9_-]+"
              value={scopeName}
              onChange={(event) => setScopeName(event.target.value)}
              placeholder={
                scopeNameFromRepository
                  ? "Set from enrolled repository"
                  : "my-project-scope"
              }
            />
            <InputGroupAddon
              align="inline-end"
              className="h-full shrink-0 border-l px-3"
            >
              <label
                className="flex h-full cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
                title="Use the enrolled repository name automatically"
              >
                <input
                  className="peer sr-only"
                  type="checkbox"
                  aria-label="Use the enrolled repository name automatically"
                  checked={scopeNameFromRepository}
                  disabled={!supportsRepositoryScopeName}
                  onChange={(event) => {
                    const automatic = event.target.checked;
                    setScopeNameFromRepository(automatic);
                    setError("");
                    if (automatic) {
                      setScopeName("");
                    }
                  }}
                />
                <span
                  aria-hidden="true"
                  className="grid size-4 shrink-0 place-items-center rounded-[4px] border border-input bg-background transition-colors peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50 [&_svg]:opacity-0 peer-checked:[&_svg]:opacity-100"
                >
                  <CheckIcon className="size-3 text-primary-foreground" />
                </span>
                <span className="whitespace-nowrap peer-checked:text-primary">
                  Auto
                </span>
              </label>
            </InputGroupAddon>
          </InputGroup>
          {scopeNameFromRepository && (
            <span className="muted text-sm">
              Scope will match the repository selected during enrollment.
            </span>
          )}
        </ConfiguredField>

        <fieldset className="configured-field">
          <legend>Result options</legend>
          <div className="configured-field-content">
            <span className="muted text-sm">
              Only selected result data will be sent to participants after
              onboarding.
            </span>
            {(Object.keys(resultOptionLabels) as (keyof JoinLinkResultOptions)[]).map(
              (option) => (
                <label className="toggle" key={option}>
                  <input
                    type="checkbox"
                    checked={resultOptions[option]}
                    onChange={(event) =>
                      setResultOptions((current) => ({
                        ...current,
                        [option]: event.target.checked,
                      }))
                    }
                  />
                  {resultOptionLabels[option]}
                </label>
              ),
            )}
          </div>
        </fieldset>

        <div className="actions">
          <button className="button" type="submit" disabled={saving}>
            {saving ? "Generating…" : "Generate join link"}
          </button>
        </div>
      </form>

      <section className="card stack link-history">
        <div>
          <h2>Generated links</h2>
          <p>Links for the selected organization, newest first.</p>
        </div>
        {linksLoading ? (
          <div className="row muted">
            <span className="spinner" /> Loading links…
          </div>
        ) : links.length ? (
          <div className="link-list">
            {links.map((link) => (
              <article className="link-card" key={link._id}>
                <div className="link-card-header">
                  <div>
                    <strong>{displayedScopeName(link)}</strong>
                    <span className="muted">
                      {new Date(link.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <button
                    className="button secondary compact-button"
                    type="button"
                    onClick={() => void copyLink(link)}
                  >
                    Copy
                  </button>
                </div>
                <input
                  className="input link-url"
                  aria-label={`Join link for ${displayedScopeName(link)}`}
                  readOnly
                  value={joinUrl(link._id)}
                  onFocus={(event) => event.currentTarget.select()}
                />
                <div className="badge-list">
                  {(
                    Object.keys(
                      linkFieldLabels,
                    ) as EditableField[]
                  ).map((field) => (
                    <span
                      className={`badge ${link.configuration[field].editable ? "editable" : ""}`}
                      key={field}
                    >
                      {linkFieldLabels[field]}:{" "}
                      {field === "scopeName" &&
                      link.configuration.scopeName.fromRepository
                        ? link.configuration.scopeName.editable
                          ? "automatic, editable"
                          : "automatic"
                        : link.configuration[field].editable
                          ? "editable"
                          : "locked"}
                    </span>
                  ))}
                  {(
                    Object.keys(resultOptionLabels) as (keyof JoinLinkResultOptions)[]
                  ).map((option) => {
                    const enabled =
                      link.configuration.resultOptions?.[option] ?? true;
                    return (
                      <span className="badge" key={option}>
                        {resultOptionLabels[option]}: {enabled ? "shown" : "hidden"}
                      </span>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="notice">No join links have been generated yet.</div>
        )}
      </section>
    </div>
  );
}

function ConfiguredField({
  label,
  editable,
  onEditableChange,
  children,
}: {
  label: string;
  editable: boolean;
  onEditableChange: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="configured-field">
      <legend>{label}</legend>
      <label className="toggle">
        <input
          type="checkbox"
          checked={editable}
          onChange={(event) => onEditableChange(event.target.checked)}
        />
        Participant can change this value
      </label>
      <div className="configured-field-content">{children}</div>
    </fieldset>
  );
}
