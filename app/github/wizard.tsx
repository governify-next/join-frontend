"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgreementTemplate, Configuration, Onboarding, Organization, Project, Repository } from "./types";

const steps = ["Agreement", "GitHub access", "Repository", "Organization", "Configure", "Review", "Provision"];
const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`/api/join${path}`, {
    ...init,
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || "Request failed");
  return body.data as T;
};
const slug = (value: string) => value.replace(/[^A-Za-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
const localDate = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const defaultInitialDate = localDate(new Date());
const defaultEndDate = localDate(new Date(new Date().getTime() + 365 * 24 * 60 * 60_000));

export function JoinWizard({ initial, governifyUrl }: { initial?: Onboarding; governifyUrl: string }) {
  const [onboarding, setOnboarding] = useState(initial);
  const [agreementTemplates, setAgreementTemplates] = useState<AgreementTemplate[]>([]);
  const [agreementTemplateId, setAgreementTemplateId] = useState("");
  const [templatesLoading, setTemplatesLoading] = useState(!initial);
  const [step, setStep] = useState(initial ? (["COMPLETED", "FAILED", "PROVISIONING"].includes(initial.status) ? 6 : initial.status === "READY" ? 5 : initial.integration?.installationId ? 2 : 1) : 0);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [repositorySearch, setRepositorySearch] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [repository, setRepository] = useState<Repository>();
  const [project, setProject] = useState<Project>();
  const [statusFieldId, setStatusFieldId] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [elementName, setElementName] = useState("");
  const [mapping, setMapping] = useState({ inProgress: [] as string[], inReview: [] as string[], done: [] as string[] });
  const [initialDate, setInitialDate] = useState(defaultInitialDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : "Unexpected error"); }
    finally { setBusy(false); }
  };

  const onboardingId = onboarding?._id;
  useEffect(() => {
    if (onboarding) return;
    let cancelled = false;
    api<AgreementTemplate[]>("/agreement-templates")
      .then((values) => {
        if (cancelled) return;
        setAgreementTemplates(values);
        setAgreementTemplateId((current) => current || values[0]?._id || "");
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load agreement templates");
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });
    return () => { cancelled = true; };
  }, [onboarding]);
  const refresh = useCallback(async () => {
    if (!onboardingId) return;
    const value = await api<Onboarding>(`/onboardings/${onboardingId}`);
    setOnboarding(value);
    if (value.status === "COMPLETED" || value.status === "FAILED") setStep(6);
  }, [onboardingId]);

  useEffect(() => {
    if (!onboarding || !["PROVISIONING"].includes(onboarding.status)) return;
    const timer = setInterval(() => void refresh(), 1800);
    return () => clearInterval(timer);
  }, [onboarding, refresh]);

  const createOnboarding = () => run(async () => {
    if (!agreementTemplateId) throw new Error("Select an agreement template.");
    const value = await api<Onboarding>("/onboardings", { method: "POST", body: JSON.stringify({ provider: "github", agreementTemplateId }) });
    setOnboarding(value); setStep(1);
    history.replaceState(null, "", `/github?onboarding=${value._id}`);
  });
  const connect = () => run(async () => {
    const value = await api<{ authorizationUrl: string }>(`/onboardings/${onboarding!._id}/integrations/github/authorize`, { method: "POST" });
    window.location.assign(value.authorizationUrl);
  });
  const installationId = onboarding?.integration?.installationId;
  useEffect(() => {
    if (!installationId || !onboardingId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [repos, orgs] = await Promise.all([
          api<Repository[]>(`/onboardings/${onboardingId}/repositories`),
          api<Organization[]>(`/onboardings/${onboardingId}/organizations`),
        ]);
        if (!cancelled) { setRepositories(repos); setOrganizations(orgs); }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load resources");
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [installationId, onboardingId]);

  const chooseRepository = (repo: Repository) => run(async () => {
    setRepository(repo); setElementName(slug(repo.name));
    const projectValues = await api<Project[]>(`/onboardings/${onboarding!._id}/projects?owner=${encodeURIComponent(repo.owner)}`);
    setProjects(projectValues); setStep(3);
  });

  const field = project?.statusFields.find((item) => item.id === statusFieldId);
  const toggleMapping = (group: keyof typeof mapping, name: string) => setMapping((current) => {
    const alreadySelected = current[group].includes(name);
    return {
      inProgress: current.inProgress.filter((value) => value !== name),
      inReview: current.inReview.filter((value) => value !== name),
      done: current.done.filter((value) => value !== name),
      ...(alreadySelected ? {} : { [group]: [...current[group].filter((value) => value !== name), name] }),
    };
  });
  const config = useMemo<Configuration | undefined>(() => {
    const initialValue = new Date(initialDate);
    const endValue = new Date(endDate);
    if (!repository || !project || !field || !organizationName || Number.isNaN(initialValue.getTime()) || Number.isNaN(endValue.getTime())) return undefined;
    return {
      repository,
      project: { id: project.id, number: project.number, title: project.title, owner: project.owner, statusFieldId: field.id, statusFieldName: field.name },
      organizationName, elementName, trackedUsers: [], statusMapping: mapping,
      validity: { initial: initialValue.toISOString(), end: endValue.toISOString(), timezone },
    };
  }, [repository, project, field, organizationName, elementName, mapping, initialDate, endDate, timezone]);
  const reviewConfig = config || onboarding?.configuration;

  const saveConfiguration = () => run(async () => {
    if (!config) throw new Error("Complete every configuration field.");
    const value = await api<Onboarding>(`/onboardings/${onboarding!._id}/configuration`, { method: "PUT", body: JSON.stringify(config) });
    setOnboarding(value); setStep(5);
  });
  const provision = (retry = false) => run(async () => {
    const value = await api<Onboarding>(`/onboardings/${onboarding!._id}/${retry ? "retry" : "provision"}`, { method: "POST" });
    setOnboarding(value); setStep(6);
  });

  const completed = onboarding?.status === "COMPLETED";
  const progress = Math.round(((onboarding?.checkpoints.length || 0) / 7) * 100);
  const filteredRepositories = repositories.filter((item) => item.fullName.toLowerCase().includes(repositorySearch.toLowerCase()));
  return (
    <div className="wizard">
      <aside className="steps" aria-label="Onboarding progress">{steps.map((label, index) => <div key={label} className={`step ${index === step ? "active" : ""} ${index < step ? "done" : ""}`}><span className="step-index">{index < step ? "✓" : index + 1}</span><span>{label}</span></div>)}</aside>
      <section className="card stack" aria-live="polite">
        {error && <div className="notice error" role="alert">{error}</div>}
        {step === 0 && <><div><div className="eyebrow">Public agreements</div><h2>Choose an agreement</h2><p>These agreement templates are provided by the Governify Registry.</p></div>{templatesLoading ? <Loading /> : agreementTemplates.length ? <div className="option-grid">{agreementTemplates.map((template) => <button className={`option ${agreementTemplateId === template._id ? "selected" : ""}`} key={template._id} onClick={() => setAgreementTemplateId(template._id)}><strong>{template.displayName || template.name}</strong><span>{template.description || `${template.guarantees.length} guarantees`}</span></button>)}</div> : <Empty text="No public agreement templates are available in Registry." />}<div className="actions"><button className="button" onClick={createOnboarding} disabled={busy || !agreementTemplateId}>Use agreement</button></div></>}
        {step === 1 && <><div><div className="eyebrow">Required integration</div><h2>Connect GitHub</h2><p>Install the Governify GitHub App and choose the repositories it may read. Governify stores the installation reference, never a long-lived GitHub token.</p></div>{onboarding?.integration?.installationId ? <div className="notice success">Connected to {onboarding.integration.accountLogin}</div> : <div className="notice">GitHub will open in a new page and return you here after authorization.</div>}<div className="actions">{onboarding?.integration?.installationId ? <button className="button" onClick={() => setStep(2)}>Continue</button> : <button className="button" onClick={connect} disabled={busy}>Install GitHub App</button>}</div></>}
        {step === 2 && <><div><div className="eyebrow">GitHub repository</div><h2>Choose a repository</h2><p>Only repositories granted to the GitHub App are shown.</p></div>{busy && !repositories.length ? <Loading /> : repositories.length ? <><div className="field"><label htmlFor="repository-search">Search repositories</label><input id="repository-search" className="input" type="search" placeholder="Owner or repository name" value={repositorySearch} onChange={(event) => setRepositorySearch(event.target.value)} /></div>{filteredRepositories.length ? <div className="option-grid">{filteredRepositories.map((repo) => <button className={`option ${repository?.id === repo.id ? "selected" : ""}`} key={repo.id} onClick={() => chooseRepository(repo)}><strong>{repo.fullName}</strong><span>{repo.private ? "Private repository" : "Public repository"}</span></button>)}</div> : <Empty text="No repositories match this search." />}</> : <Empty text="No repositories are available. Update the GitHub App installation and grant repository access." />} </>}
        {step === 3 && <><div><div className="eyebrow">Governify destination</div><h2>Choose organization and project</h2><p>The selected Governify organization must already include your ecosystem account.</p></div><div className="field"><label>Governify organization</label><select className="input" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)}><option value="">Select organization</option>{organizations.map((org) => <option key={org.name} value={org.name}>{org.displayName || org.name}</option>)}</select></div><div className="field"><label>Element name</label><input className="input" value={elementName} onChange={(e) => setElementName(slug(e.target.value))} minLength={3} maxLength={100} /></div><div><div className="label" style={{ marginBottom: 8 }}>GitHub Project</div>{projects.length ? <div className="option-grid">{projects.map((item) => <button className={`option ${project?.id === item.id ? "selected" : ""}`} key={item.id} onClick={() => { setProject(item); setStatusFieldId(""); }}><strong>{item.title}</strong><span>Project #{item.number}</span></button>)}</div> : <Empty text="No GitHub Projects V2 boards are available for this installation." />}</div><div className="actions"><button className="button secondary" onClick={() => setStep(2)}>Back</button><button className="button" disabled={!organizationName || !project || elementName.length < 3} onClick={() => setStep(4)}>Configure</button></div></>}
        {step === 4 && <><div><div className="eyebrow">Guided configuration</div><h2>Map the POC workflow</h2><p>Select the Project status field and identify the options that represent work in progress.</p></div><div className="field"><label>Status field</label><select className="input" value={statusFieldId} onChange={(e) => { setStatusFieldId(e.target.value); setMapping({ inProgress: [], inReview: [], done: [] }); }}><option value="">Select single-select field</option>{project?.statusFields.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>{field && <div><div className="label" style={{ marginBottom: 8 }}>In progress</div><div className="check-grid">{field.options.map((option) => <label className="check" key={option.id}><input type="checkbox" checked={mapping.inProgress.includes(option.name)} onChange={() => toggleMapping("inProgress", option.name)} />{option.name}</label>)}</div></div>}<div className="grid-2"><div className="field"><label>Validity starts</label><input className="input" type="datetime-local" value={initialDate} onChange={(e) => setInitialDate(e.target.value)} /></div><div className="field"><label>Validity ends</label><input className="input" type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div></div><div className="field"><label>IANA timezone</label><input className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)} /></div><div className="actions"><button className="button secondary" onClick={() => setStep(3)}>Back</button><button className="button" disabled={!field || !mapping.inProgress.length} onClick={saveConfiguration}>Review</button></div></>}
        {step === 5 && reviewConfig && <><div><div className="eyebrow">Ready to provision</div><h2>Review onboarding</h2><p>Governify will create the element, agreement collection and version, then start immediate and hourly calculations.</p></div><dl className="summary"><dt>Agreement</dt><dd>{onboarding?.agreementTemplate.displayName || onboarding?.agreementTemplate.name}</dd><dt>Repository</dt><dd>{reviewConfig.repository.fullName}</dd><dt>GitHub Project</dt><dd>{reviewConfig.project.title}</dd><dt>Organization</dt><dd>{reviewConfig.organizationName}</dd><dt>Element</dt><dd>{reviewConfig.elementName}</dd><dt>In progress</dt><dd>{reviewConfig.statusMapping.inProgress.join(", ")}</dd><dt>Validity</dt><dd>{new Date(reviewConfig.validity.initial).toLocaleString()} – {new Date(reviewConfig.validity.end).toLocaleString()}</dd></dl><div className="actions">{config && <button className="button secondary" onClick={() => setStep(4)}>Back</button>}<button className="button" onClick={() => provision()} disabled={busy}>Provision project</button></div></>}
        {step === 6 && <><div><div className="eyebrow">{completed ? "Onboarding complete" : onboarding?.status === "FAILED" ? "Needs attention" : "Provisioning"}</div><h2>{completed ? "Your project is connected" : onboarding?.status === "FAILED" ? "Provisioning stopped" : "Setting up Governify"}</h2><p>{completed ? "The agreement is active and its recurring calculation task has been created." : "This page updates automatically. You can safely leave and return using the same URL."}</p></div><div className={`notice ${completed ? "success" : onboarding?.status === "FAILED" ? "error" : ""}`}>{completed ? "All provisioning steps completed." : onboarding?.failure?.message || "Provisioning is running in the background…"}</div><div className="progress" aria-label={`${progress}% complete`}><div style={{ width: `${completed ? 100 : progress}%` }} /></div><div className="muted">{onboarding?.checkpoints.length || 0} of 7 steps completed</div>{onboarding?.status === "FAILED" && <div className="actions"><button className="button" onClick={() => provision(true)} disabled={busy}>Retry from checkpoint</button></div>}{completed && <div className="actions"><a className="button" href={`${governifyUrl}/organizations/${encodeURIComponent(String(onboarding?.result?.organizationName))}`}>Open organization</a></div>}</>}
        {busy && <div className="row muted"><span className="spinner" /> Working…</div>}
      </section>
    </div>
  );
}

function Loading() { return <div className="row muted"><span className="spinner" /> Loading available resources…</div>; }
function Empty({ text }: { text: string }) { return <div className="notice">{text}</div>; }
