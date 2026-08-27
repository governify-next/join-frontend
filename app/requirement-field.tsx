import type { Requirement, ResourceOption } from "./types";

const serialized = (value: unknown) => JSON.stringify(value);
const resourceIdentity = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return serialized(value);
  const record = value as Record<string, unknown>;
  if (record.installationId !== undefined && record.id !== undefined)
    return `${String(record.installationId)}:${String(record.id)}`;
  return String(
    record._id ?? record.id ?? record.username ?? record.name ?? serialized(value),
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
      <div className="field">
        <label htmlFor={requirement.id}>{requirement.ui.label}</label>
        <input
          id={requirement.id}
          className="input"
          type={requirement.type === "datetime" ? "datetime-local" : "text"}
          value={typeof value === "string" ? value : ""}
          minLength={requirement.validation?.minLength}
          maxLength={requirement.validation?.maxLength}
          pattern={requirement.validation?.pattern}
          disabled={locked}
          onChange={(event) => onChange(event.target.value)}
        />
        {requirement.ui.help && (
          <span className="muted">{requirement.ui.help}</span>
        )}
        {locked && <span className="muted">Set by the join link.</span>}
      </div>
    );
  }

  if (!dependenciesReady) {
    return (
      <div className="field">
        <span className="label">{requirement.ui.label}</span>
        <div className="notice">Complete the preceding selection first.</div>
      </div>
    );
  }

  const filtered = options.filter((option) =>
    `${option.label} ${option.description || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const selected = requirement.cardinality === "many" && Array.isArray(value)
    ? value
    : [];
  const visibleOptions = locked
    ? filtered.filter((option) =>
        requirement.cardinality === "many"
          ? selected.some((item) => sameResource(item, option.value))
          : sameResource(value, option.value),
      )
    : filtered;

  return (
    <div className="field">
      <span className="label">{requirement.ui.label}</span>
      {requirement.ui.help && (
        <span className="muted">{requirement.ui.help}</span>
      )}
      {requirement.ui.searchable && options.length > 5 && (
        <input
          className="input"
          type="search"
          aria-label={`Search ${requirement.ui.label}`}
          placeholder="Search available values"
          value={search}
          disabled={locked}
          onChange={(event) => onSearch(event.target.value)}
        />
      )}
      {loading ? (
        <div className="row muted">
          <span className="spinner" /> Loading available values…
        </div>
      ) : visibleOptions.length ? (
        <div className="option-grid">
          {visibleOptions.map((option) => {
            const isSelected = requirement.cardinality === "many"
              ? selected.some((item) => sameResource(item, option.value))
              : sameResource(value, option.value);
            return (
              <button
                type="button"
                className={`option ${isSelected ? "selected" : ""}`}
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
              </button>
            );
          })}
        </div>
      ) : (
        <div className="notice">No values are available for this field.</div>
      )}
      {resourceActions.length > 0 && (
        <div className="actions">
          {resourceActions.map((action) =>
            action.href ? (
              <a
                className="button secondary"
                href={action.href}
                key={`${action.label}:${action.href}`}
                target="_blank"
                rel="noreferrer"
                onClick={action.onClick}
              >
                {action.label}
              </a>
            ) : (
              <button
                className="button secondary"
                key={action.label}
                type="button"
                onClick={action.onClick}
              >
                {action.label}
              </button>
            ),
          )}
        </div>
      )}
      {locked && <span className="muted">Set by the join link.</span>}
    </div>
  );
}
