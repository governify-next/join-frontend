import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FieldDescription,
  Field,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoaderCircle } from "lucide-react";
import type { Requirement, ResourceOption } from "./types";

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
        <FieldTitle>{requirement.ui.label}</FieldTitle>
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
      <FieldTitle>{requirement.ui.label}</FieldTitle>
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
