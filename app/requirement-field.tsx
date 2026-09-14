import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FieldDescription,
  Field,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronDown, Info, LoaderCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { Requirement, ResourceOption } from "./types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const workflowDropdownFields = new Set([
  "github_status_field",
  "github_in_progress_columns",
  "github_in_review_columns",
  "github_done_columns",
]);

const workflowHelp: Record<string, string> = {
  github_status_field:
    "Select the Project field that stores each item's workflow status, usually named Status.",
  github_in_progress_columns:
    "Select every status option that means work is actively in progress.",
  github_in_review_columns:
    "Select every status option that means work is waiting for review.",
  github_done_columns:
    "Select every status option that means work is complete.",
};

const serialized = (value: unknown) => JSON.stringify(value);
const resourceIdentity = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return serialized(value);
  const record = value as Record<string, unknown>;
  if (record.installationId !== undefined && record.id !== undefined)
    return `${String(record.installationId)}:${String(record.id)}`;
  return String(
    record._id ??
      record.id ??
      record.username ??
      record.name ??
      serialized(value),
  );
};

const sameResource = (left: unknown, right: unknown) =>
  resourceIdentity(left) === resourceIdentity(right);

export type ResourceAction = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export function RequirementField({
  requirement,
  value,
  options,
  loading,
  dependenciesReady,
  search,
  resourceActions = [],
  locked = false,
  onSearch,
  onChange,
}: {
  requirement: Requirement;
  value: unknown;
  options: ResourceOption[];
  loading: boolean;
  dependenciesReady: boolean;
  search: string;
  resourceActions?: ResourceAction[];
  locked?: boolean;
  onSearch: (value: string) => void;
  onChange: (value: unknown) => void;
}) {
  if (requirement.type !== "resource") {
    return (
      <Field>
        <FieldLabel htmlFor={requirement.id}>{requirement.ui.label}</FieldLabel>
        <Input
          id={requirement.id}
          type={requirement.type === "datetime" ? "datetime-local" : "text"}
          value={typeof value === "string" ? value : ""}
          minLength={requirement.validation?.minLength}
          maxLength={requirement.validation?.maxLength}
          pattern={requirement.validation?.pattern}
          disabled={locked}
          onChange={(event) => onChange(event.target.value)}
        />
        {requirement.ui.help && (
          <FieldDescription>{requirement.ui.help}</FieldDescription>
        )}
        {locked && <FieldDescription>Set by the join link.</FieldDescription>}
      </Field>
    );
  }

  if (!dependenciesReady) {
    return (
      <Field>
        <WorkflowFieldTitle requirement={requirement} />
        <Alert role="status">
          <AlertDescription>
            Complete the preceding selection first.
          </AlertDescription>
        </Alert>
      </Field>
    );
  }

  const filtered = options.filter((option) =>
    `${option.label} ${option.description || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const selected =
    requirement.cardinality === "many" && Array.isArray(value) ? value : [];
  const visibleOptions = locked
    ? filtered.filter((option) =>
        requirement.cardinality === "many"
          ? selected.some((item) => sameResource(item, option.value))
          : sameResource(value, option.value),
      )
    : filtered;

  return (
    <Field>
      <WorkflowFieldTitle requirement={requirement} />
      {requirement.ui.help && (
        <FieldDescription>{requirement.ui.help}</FieldDescription>
      )}
      {requirement.ui.searchable && options.length > 5 && (
        <Input
          type="search"
          aria-label={`Search ${requirement.ui.label}`}
          placeholder="Search available values"
          value={search}
          disabled={locked}
          onChange={(event) => onSearch(event.target.value)}
        />
      )}
      {loading ? (
        <div className="row muted" role="status">
          <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />{" "}
          Loading available values…
        </div>
      ) : visibleOptions.length &&
        workflowDropdownFields.has(requirement.id) ? (
        <WorkflowResourceDropdown
          requirement={requirement}
          value={value}
          options={visibleOptions}
          allOptions={options}
          locked={locked}
          onChange={onChange}
        />
      ) : visibleOptions.length ? (
        <div className="option-grid">
          {visibleOptions.map((option) => {
            const isSelected =
              requirement.cardinality === "many"
                ? selected.some((item) => sameResource(item, option.value))
                : sameResource(value, option.value);
            return (
              <Button
                type="button"
                variant="outline"
                className={`h-auto flex-col items-start whitespace-normal p-4 text-left ${isSelected ? "border-primary bg-primary/10" : ""}`}
                aria-pressed={isSelected}
                key={option.id}
                disabled={locked}
                onClick={() => {
                  if (requirement.cardinality !== "many") {
                    onChange(option.value);
                    return;
                  }
                  onChange(
                    isSelected
                      ? selected.filter(
                          (item) => !sameResource(item, option.value),
                        )
                      : [...selected, option.value],
                  );
                }}
              >
                <strong>{option.label}</strong>
                {option.description && <span>{option.description}</span>}
              </Button>
            );
          })}
        </div>
      ) : (
        <Alert role="status">
          <AlertDescription>
            No values are available for this field.
          </AlertDescription>
        </Alert>
      )}
      {resourceActions.length > 0 && (
        <div className="actions">
          {resourceActions.map((action) =>
            action.href ? (
              <Button
                asChild
                variant="outline"
                key={`${action.label}:${action.href}`}
              >
                <a
                  href={action.href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={action.onClick}
                >
                  {action.label}
                </a>
              </Button>
            ) : (
              <Button
                variant="outline"
                key={action.label}
                type="button"
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ),
          )}
        </div>
      )}
      {locked && <FieldDescription>Set by the join link.</FieldDescription>}
    </Field>
  );
}

function WorkflowResourceDropdown({
  requirement,
  value,
  options,
  allOptions,
  locked,
  onChange,
}: {
  requirement: Requirement;
  value: unknown;
  options: ResourceOption[];
  allOptions: ResourceOption[];
  locked: boolean;
  onChange: (value: unknown) => void;
}) {
  if (requirement.cardinality !== "many") {
    const selectedOption = allOptions.find((option) =>
      sameResource(value, option.value),
    );
    return (
      <Select
        value={selectedOption?.id ?? ""}
        disabled={locked}
        onValueChange={(id) => {
          const option = allOptions.find((candidate) => candidate.id === id);
          if (option) onChange(option.value);
        }}
      >
        <SelectTrigger className="w-full" aria-label={requirement.ui.label}>
          <SelectValue placeholder="Select a status field" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  const selected = Array.isArray(value) ? value : [];
  const selectedLabels = allOptions
    .filter((option) =>
      selected.some((item) => sameResource(item, option.value)),
    )
    .map((option) => option.label);
  const summary = selectedLabels.length
    ? selectedLabels.join(", ")
    : "Select columns";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={locked}
          className="h-auto min-h-9 w-full justify-between py-2 text-left"
          aria-label={`${requirement.ui.label}: ${summary}`}
        >
          <span className="min-w-0 whitespace-normal break-words">
            {summary}
          </span>
          <ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" aria-label={requirement.ui.label}>
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.id}
            checked={selected.some((item) => sameResource(item, option.value))}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) => {
              onChange(
                checked
                  ? [
                      ...selected.filter(
                        (item) => !sameResource(item, option.value),
                      ),
                      option.value,
                    ]
                  : selected.filter(
                      (item) => !sameResource(item, option.value),
                    ),
              );
            }}
          >
            <span className="min-w-0 whitespace-normal break-words">
              {option.label}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WorkflowFieldTitle({ requirement }: { requirement: Requirement }) {
  const help = workflowHelp[requirement.id];
  if (!help) return <FieldTitle>{requirement.ui.label}</FieldTitle>;

  return (
    <FieldTitle className="m-0 flex items-center gap-1">
      {requirement.ui.label}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="m-0 size-5 rounded-full p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`About ${requirement.ui.label}`}
          >
            <Info aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" align="center" sideOffset={6}>
          {help}
        </TooltipContent>
      </Tooltip>
    </FieldTitle>
  );
}
