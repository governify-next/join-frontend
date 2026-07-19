export type Onboarding = {
  _id: string;
  status: "DRAFT" | "AUTHORIZING" | "CONFIGURING" | "READY" | "PROVISIONING" | "COMPLETED" | "FAILED";
  agreementTemplate: AgreementTemplate;
  integration?: { installationId?: number; accountLogin?: string };
  checkpoints: string[];
  configuration?: Configuration;
  result?: Record<string, string>;
  failure?: { step: string; message: string; retryable: boolean };
};
export type AgreementTemplate = {
  _id: string;
  name: string;
  displayName: string;
  description: string;
  guarantees: { guaranteeTemplateName: string }[];
};
export type Repository = { id: number; name: string; fullName: string; owner: string; private: boolean };
export type Project = { id: string; number: number; title: string; owner: string; statusFields: { id: string; name: string; options: { id: string; name: string }[] }[] };
export type Organization = { name: string; displayName?: string; description?: string };
export type Collaborator = { username: string; avatarUrl?: string };
export type Configuration = {
  repository: Repository;
  project: { id: string; number: number; title: string; owner: string; statusFieldId: string; statusFieldName: string };
  organizationName: string;
  elementName: string;
  trackedUsers: string[];
  statusMapping: { inProgress: string[]; inReview: string[]; done: string[] };
  validity: { initial: string; end: string; timezone: string };
};
