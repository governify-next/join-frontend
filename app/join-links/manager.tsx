"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FieldDescription,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoaderCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [resultOptions, setResultOptions] =
    useState<JoinLinkResultOptions>(initialResultOptions);
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
      <Card className="min-w-0 gap-4 p-6">
        <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />{" "}
        Loading administration options…
      </Card>
    );
  }

  if (!organizations.length) {
    return (
      <Card className="min-w-0 gap-4 p-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div>
          <h2>No administrable organizations</h2>
          <p>
            You need the organization administrator role before you can generate
            join links.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="admin-grid">
      <Card className="p-6">
        <form className="flex flex-col gap-4" onSubmit={generate}>
          <div>
            <h2>Link configuration</h2>
            <p>These values are stored with the generated link in Join.</p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {notice && (
            <Alert role="status" className="text-green-700 dark:text-green-400">
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          <ConfiguredField
            label="Organization"
            editable={editable.organization}
            onEditableChange={(value) =>
              setEditable((current) => ({ ...current, organization: value }))
            }
          >
            <Select
              value={organizationName}
              onValueChange={(value) => {
                setLinks([]);
                setLinksLoading(true);
                setError("");
                setOrganizationName(value);
              }}
            >
              <SelectTrigger aria-label="Organization" className="w-full">
                <SelectValue placeholder="Select an organization" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((organization) => (
                  <SelectItem key={organization._id} value={organization.name}>
                    {organization.displayName || organization.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Select
              required
              value={agreementTemplateId}
              onValueChange={(nextTemplateId) => {
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
              <SelectTrigger aria-label="Agreement template" className="w-full">
                <SelectValue placeholder="Select an agreement template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map(({ agreementTemplate }) => (
                  <SelectItem
                    key={agreementTemplate._id}
                    value={agreementTemplate._id}
                  >
                    {agreementTemplate.displayName || agreementTemplate.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <FieldLabel className="flex-col items-start gap-2">
                <span>Starts</span>
                <Input
                  type="datetime-local"
                  required
                  value={validityInitial}
                  onChange={(event) => setValidityInitial(event.target.value)}
                />
              </FieldLabel>
              <FieldLabel className="flex-col items-start gap-2">
                <span>Ends</span>
                <Input
                  type="datetime-local"
                  required
                  value={validityEnd}
                  onChange={(event) => setValidityEnd(event.target.value)}
                />
              </FieldLabel>
            </div>
            <FieldLabel className="flex-col items-start gap-2">
              <span>Timezone</span>
              <Input
                required
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                placeholder="Europe/Madrid"
              />
            </FieldLabel>
          </ConfiguredField>

          <ConfiguredField
            label="Scope and agreement name"
            editable={editable.scopeName}
            onEditableChange={(value) =>
              setEditable((current) => ({ ...current, scopeName: value }))
            }
          >
            <InputGroup>
              <InputGroupInput
                aria-label="Scope and agreement name"
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
                <FieldLabel
                  className="flex h-full cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
                  title="Use the enrolled repository name automatically"
                >
                  <Checkbox
                    aria-label="Use the enrolled repository name automatically"
                    checked={scopeNameFromRepository}
                    disabled={!supportsRepositoryScopeName}
                    onCheckedChange={(checked) => {
                      const automatic = checked === true;
                      setScopeNameFromRepository(automatic);
                      setError("");
                      if (automatic) {
                        setScopeName("");
                      }
                    }}
                  />
                  <span className="whitespace-nowrap peer-data-[state=checked]:text-primary">
                    Auto
                  </span>
                </FieldLabel>
              </InputGroupAddon>
            </InputGroup>
            {scopeNameFromRepository && (
              <FieldDescription>
                Scope will match the repository selected during enrollment.
              </FieldDescription>
            )}
          </ConfiguredField>

          <FieldSet className="configured-field">
            <FieldLegend>Result options</FieldLegend>
            <div className="configured-field-content">
              <FieldDescription>
                Only selected result data will be sent to participants after
                onboarding.
              </FieldDescription>
              {(
                Object.keys(
                  resultOptionLabels,
                ) as (keyof JoinLinkResultOptions)[]
              ).map((option) => (
                <FieldLabel className="toggle" key={option}>
                  <Checkbox
                    checked={resultOptions[option]}
                    onCheckedChange={(checked) =>
                      setResultOptions((current) => ({
                        ...current,
                        [option]: checked === true,
                      }))
                    }
                  />
                  {resultOptionLabels[option]}
                </FieldLabel>
              ))}
            </div>
          </FieldSet>

          <div className="actions">
            <Button type="submit" disabled={saving}>
              {saving ? "Generating…" : "Generate join link"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="min-w-0 gap-4 p-6 link-history">
        <div>
          <h2>Generated links</h2>
          <p>Links for the selected organization, newest first.</p>
        </div>
        {linksLoading ? (
          <div className="row muted" role="status">
            <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />{" "}
            Loading links…
          </div>
        ) : links.length ? (
          <div className="link-list">
            {links.map((link) => (
              <Card className="min-w-0 gap-3 p-4" key={link._id}>
                <div className="link-card-header">
                  <div>
                    <strong>{displayedScopeName(link)}</strong>
                    <FieldDescription>
                      {new Date(link.createdAt).toLocaleString()}
                    </FieldDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => void copyLink(link)}
                  >
                    Copy
                  </Button>
                </div>
                <Input
                  className="font-mono text-xs"
                  aria-label={`Join link for ${displayedScopeName(link)}`}
                  readOnly
                  value={joinUrl(link._id)}
                  onFocus={(event) => event.currentTarget.select()}
                />
                <div className="badge-list">
                  {(Object.keys(linkFieldLabels) as EditableField[]).map(
                    (field) => (
                      <Badge
                        variant={
                          link.configuration[field].editable
                            ? "secondary"
                            : "muted"
                        }
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
                      </Badge>
                    ),
                  )}
                  {(
                    Object.keys(
                      resultOptionLabels,
                    ) as (keyof JoinLinkResultOptions)[]
                  ).map((option) => {
                    const enabled =
                      link.configuration.resultOptions?.[option] ?? true;
                    return (
                      <Badge variant="muted" key={option}>
                        {resultOptionLabels[option]}:{" "}
                        {enabled ? "shown" : "hidden"}
                      </Badge>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Alert role="status">
            <AlertDescription>
              No join links have been generated yet.
            </AlertDescription>
          </Alert>
        )}
      </Card>
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
    <FieldSet className="configured-field">
      <FieldLegend>{label}</FieldLegend>
      <FieldLabel className="toggle">
        <Checkbox
          checked={editable}
          onCheckedChange={(checked) => onEditableChange(checked === true)}
        />
        Participant can change this value
      </FieldLabel>
      <div className="configured-field-content">{children}</div>
    </FieldSet>
  );
}
