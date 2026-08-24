import {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { PopoverAnchor, PopoverContent, PopoverRoot } from "./Popover";

export type ComboboxOption = {
  description?: string;
  icon?: ReactNode;
  label: string;
  value: string;
};

export const filterComboboxOptions = (
  options: readonly ComboboxOption[],
  query: string,
) => {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return options;
  return options.filter((option) =>
    `${option.label} ${option.value} ${option.description ?? ""}`
      .toLocaleLowerCase()
      .includes(normalized)
  );
};

type ComboboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value"
> & {
  emptyLabel?: string;
  groupLabel?: string;
  inputClassName?: string;
  onCommit?: (value: string) => void;
  onValueChange: (value: string) => void;
  options: readonly ComboboxOption[];
  value: string;
};

export const Combobox = forwardRef<HTMLInputElement, ComboboxProps>(
  function Combobox({
    className = "",
    emptyLabel = "No suggestions",
    groupLabel,
    inputClassName = "",
    onCommit,
    onClick,
    onFocus,
    onKeyDown,
    onValueChange,
    options,
    value,
    ...inputProps
  }, ref) {
    const listboxId = useId();
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const filteredOptions = useMemo(
      () => filterComboboxOptions(options, value),
      [options, value],
    );

    useEffect(() => {
      setActiveIndex(0);
    }, [value]);

    const selectOption = (option: ComboboxOption) => {
      onValueChange(option.value);
      setOpen(false);
      onCommit?.(option.value);
    };

    return (
      <PopoverRoot open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className={`ui-combobox ${className}`.trim()}>
            <input
              {...inputProps}
              ref={ref}
              className={inputClassName}
              role="combobox"
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-expanded={open}
              aria-activedescendant={
                open && filteredOptions[activeIndex]
                  ? `${listboxId}-${activeIndex}`
                  : undefined
              }
              value={value}
              onChange={(event) => {
                onValueChange(event.target.value);
                setOpen(true);
              }}
              onClick={(event) => {
                setOpen(true);
                onClick?.(event);
              }}
              onFocus={(event) => {
                setOpen(true);
                onFocus?.(event);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setOpen(true);
                  setActiveIndex((current) => filteredOptions.length
                    ? (current + (event.key === "ArrowDown" ? 1 : -1) + filteredOptions.length) %
                      filteredOptions.length
                    : 0);
                  return;
                }
                if (event.key === "Enter" && open && filteredOptions[activeIndex]) {
                  event.preventDefault();
                  selectOption(filteredOptions[activeIndex]);
                  return;
                }
                if (event.key === "Enter" && onCommit) {
                  event.preventDefault();
                  setOpen(false);
                  onCommit(value);
                  return;
                }
                if (event.key === "Escape" && open) {
                  event.preventDefault();
                  event.stopPropagation();
                  setOpen(false);
                  return;
                }
                onKeyDown?.(event);
              }}
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="ui-combobox-popover"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {groupLabel && <div className="ui-combobox-group-label">{groupLabel}</div>}
          <div className="ui-combobox-options" id={listboxId} role="listbox">
            {!filteredOptions.length && (
              <div className="ui-combobox-empty">{emptyLabel}</div>
            )}
            {filteredOptions.map((option, index) => (
              <button
                className="ui-combobox-option"
                id={`${listboxId}-${index}`}
                key={option.value}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseMove={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(option)}
              >
                <span className="ui-combobox-option-icon" aria-hidden="true">
                  {option.icon}
                </span>
                <span className="ui-combobox-option-copy">
                  <span>{option.label}</span>
                  {option.description && <small>{option.description}</small>}
                </span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </PopoverRoot>
    );
  },
);
