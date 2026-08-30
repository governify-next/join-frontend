export type IntegrationProvider = "github" | "zenhub";
export type ModuleId = IntegrationProvider | "agreement" | "scope";

export type AgreementTemplate = {
  _id: string;
  name: string;
  displayName: string;
  description: string;
  guarantees: { guaranteeTemplateName: string }[];
};

export type OnboardingModule = {
  id: ModuleId;
  label: string;
  kind: "core" | "external" | "destination";
  adapter: string;
  authorization: "none" | "github-app" | "mock" | "governify-session";
};

export type Requirement = {
  id: string;
  module: ModuleId;
  type: "text" | "datetime" | "timezone" | "resource" | "member-details";
  cardinality?: "one" | "many";
  required: boolean;
  dependsOn?: string[];
  default?: "now" | "oneYearFromNow" | "browserTimezone";
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    minItems?: number;
  };
  ui: {
    order: number;
    step: string;
    stepTitle: string;
    stepDescription: string;
    label: string;
    help?: string;
    searchable?: boolean;
  };
};

export type OnboardingDefinition = {
  schemaVersion: "1.0";
  id: string;
  agreementTemplateName: string;
  modules: OnboardingModule[];
  requirements: Requirement[];
};

export type TemplateOption = {
  agreementTemplate: AgreementTemplate;
  onboardingDefinition: OnboardingDefinition;
};

export type JoinLinkField<T> = {
  value: T;
  editable: boolean;
};

export type JoinLinkOrganization = {
  _id: string;
  name: string;
  displayName?: string;
};

export type JoinLinkConfiguration = {
  organization: JoinLinkField<JoinLinkOrganization>;
  agreementTemplate: JoinLinkField<AgreementTemplate>;
  agreementValidity: JoinLinkField<{
    initial: string;
    end: string;
    timezone: string;
  }>;
  scopeName: JoinLinkField<string>;
};

export type JoinLink = {
  _id: string;
  configuration: JoinLinkConfiguration;
  createdByUsername: string;
  createdAt: string;
};

export type ResourceOption = {
  id: string;
  label: string;
  description?: string;
  value: unknown;
};

export type GitHubInstallation = {
  id: number;
  accountLogin: string;
  accountType: string;
  htmlUrl: string;
};

export type DashboardResult = {
  grafanaUrl: string;
};

export type Onboarding = {
  _id: string;
  joinLinkId?: string;
  joinLinkConfiguration?: JoinLinkConfiguration;
  status:
    | "DRAFT"
    | "AUTHORIZING"
    | "CONFIGURING"
    | "READY"
    | "PROVISIONING"
    | "COMPLETED"
    | "FAILED";
  agreementTemplate: AgreementTemplate;
  onboardingDefinition: OnboardingDefinition;
  requiredIntegrations: IntegrationProvider[];
  integrations?: {
    github?: {
      installationId?: number;
      accountLogin?: string;
      accountType?: string;
      installations?: GitHubInstallation[];
    };
    zenhub?: { connectionId?: string; accountName?: string; mocked?: boolean };
  };
  answers?: Record<string, unknown>;
  checkpoints: string[];
  result?: Record<string, unknown> & {
    dashboard?: DashboardResult;
  };
  failure?: { step: string; message: string; retryable: boolean };
};
