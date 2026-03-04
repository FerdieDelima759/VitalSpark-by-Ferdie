"use client";

import {
  Children,
  ReactElement,
  ReactNode,
  cloneElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { SelectHTMLAttributes } from "react";

type SelectBoxVariant = "default" | "inline";

interface SelectBoxProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> {
  label?: string;
  helperText?: string;
  isRequired?: boolean;
  wrapperClassName?: string;
  className?: string;
  variant?: SelectBoxVariant;
  enableSearch?: boolean;
}

interface ParsedOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export default function SelectBox({
  label,
  helperText,
  isRequired = false,
  wrapperClassName,
  className,
  variant = "default",
  id,
  children,
  disabled,
  value,
  defaultValue,
  onChange,
  enableSearch = false,
  ...rest
}: SelectBoxProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const options = useMemo<ParsedOption[]>(() => {
    const parsed: ParsedOption[] = [];
    Children.forEach(children, (child) => {
      if (!child) {
        return;
      }
      if (
        typeof child === "object" &&
        (child as ReactElement).type === "option"
      ) {
        const optionElement = child as ReactElement<
          SelectHTMLAttributes<HTMLOptionElement>
        >;
        parsed.push({
          value:
            optionElement.props.value != null
              ? String(optionElement.props.value)
              : "",
          label: optionElement.props.children,
          disabled: optionElement.props.disabled,
        });
      }
    });
    return parsed;
  }, [children]);

  const selectedOption =
    options.find((option) => option.value === value) ??
    (defaultValue
      ? options.find((option) => option.value === defaultValue)
      : undefined);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
      return;
    }
    const handleClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const handleSelect = (option: ParsedOption) => {
    if (option.disabled || disabled) {
      return;
    }
    const syntheticEvent = {
      target: { value: option.value },
      currentTarget: { value: option.value },
    } as unknown as React.ChangeEvent<HTMLSelectElement>;
    onChange?.(syntheticEvent);
    setIsOpen(false);
  };

  const filteredOptions = useMemo(() => {
    if (!enableSearch || !searchTerm.trim()) {
      return options;
    }
    const normalized = searchTerm.toLowerCase().trim();
    return options.filter((option) => {
      const labelText =
        typeof option.label === "string"
          ? option.label
          : typeof option.label === "number"
          ? String(option.label)
          : "";
      return labelText.toLowerCase().includes(normalized);
    });
  }, [options, enableSearch, searchTerm]);

  const hiddenSelect = (
    <select
      id={selectId}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      disabled={disabled}
      {...rest}
      className="sr-only"
      tabIndex={-1}
    >
      {children}
    </select>
  );

  const baseWrapper =
    wrapperClassName ??
    (variant === "inline" ? "inline-flex items-center" : "space-y-2");

  if (variant === "inline") {
    return (
      <div className={`${baseWrapper} relative`} ref={containerRef}>
        {hiddenSelect}
        <button
          type="button"
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-slate-900 transition hover:text-teal-600 ${
            className ?? ""
          }`}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          disabled={disabled}
        >
          {selectedOption?.label ?? "Select"}
          <span className="text-slate-400">▼</span>
        </button>
        {isOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] rounded-xl border border-slate-200 bg-white p-1 text-left shadow-2xl">
            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option)}
                disabled={option.disabled}
                className={`w-full rounded-lg px-3 py-1 text-xs text-slate-700 transition hover:bg-slate-100 ${
                  option.disabled ? "cursor-not-allowed opacity-40" : ""
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`${baseWrapper} relative`} ref={containerRef}>
      {label && (
        <label
          htmlFor={selectId}
          className="text-sm font-medium text-slate-700"
        >
          {label}
          {isRequired && <span className="text-rose-500"> *</span>}
        </label>
      )}
      {hiddenSelect}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-left text-sm font-medium text-slate-700 shadow-sm transition hover:border-amber-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-60 ${
          className ?? ""
        }`}
        disabled={disabled}
      >
        <span className={selectedOption ? "text-slate-700" : "text-slate-500"}>
          {selectedOption?.label ?? "Select an option"}
        </span>
        <span className="text-slate-400">▼</span>
      </button>
      {helperText && <p className="text-xs text-slate-500">{helperText}</p>}
      {isOpen && (
        <div className="absolute z-[9999999] mt-2 max-h-60 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          {enableSearch && (
            <div className="border-b border-slate-100 p-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-300"
              />
            </div>
          )}
          <div className="max-h-52 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-400">
                {enableSearch && searchTerm.trim()
                  ? `No matches for "${searchTerm}"`
                  : "No options available"}
              </p>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option)}
                  disabled={option.disabled}
                  className={`flex w-full items-center justify-between px-4 py-2 text-sm text-slate-700 transition hover:bg-amber-50 ${
                    option.disabled ? "cursor-not-allowed opacity-40" : ""
                  }`}
                >
                  <span>{option.label}</span>
                  {option.value === value && (
                    <span className="text-amber-500">●</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
