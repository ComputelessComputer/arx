import { Check, ChevronDown, } from "lucide-react";
import { useEffect, useId, useRef, useState, } from "react";

interface SharpSelectOption<T extends string> {
  hint?: string;
  label: string;
  value: T;
}

interface SharpSelectFieldProps<T extends string> {
  label: string;
  options: Array<SharpSelectOption<T>>;
  value: T;
  onChange: (value: T,) => void;
}

export function SharpSelectField<T extends string,>(
  {
    label,
    options,
    value,
    onChange,
  }: SharpSelectFieldProps<T>,
) {
  const [open, setOpen,] = useState(false,);
  const rootRef = useRef<HTMLDivElement>(null,);
  const labelId = useId();
  const valueId = useId();
  const menuId = useId();
  const selected = options.find((option,) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent,) => {
      if (!rootRef.current?.contains(event.target as Node,)) {
        setOpen(false,);
      }
    };

    const handleEscape = (event: KeyboardEvent,) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false,);
      }
    };

    window.addEventListener("mousedown", handlePointerDown,);
    window.addEventListener("keydown", handleEscape,);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown,);
      window.removeEventListener("keydown", handleEscape,);
    };
  }, [open,],);

  return (
    <div ref={rootRef} className="arx-sharp-select">
      <label id={labelId} className="arx-sharp-select-label">{label}</label>
      <button
        type="button"
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={`${labelId} ${valueId}`}
        onClick={() => setOpen((current,) => !current)}
        className={`arx-sharp-select-trigger ${open ? "arx-sharp-select-trigger-open" : ""}`}
      >
        <span className="arx-sharp-select-copy">
          {selected.hint ? <span className="arx-sharp-select-hint">{selected.hint}</span> : null}
          <span id={valueId} className="arx-sharp-select-value">{selected.label}</span>
        </span>
        <ChevronDown className={`arx-sharp-select-icon ${open ? "arx-sharp-select-icon-open" : ""}`} size={16} />
      </button>
      {open ? (
        <div id={menuId} role="listbox" aria-labelledby={labelId} className="arx-sharp-select-menu">
          {options.map((option,) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value,);
                  setOpen(false,);
                }}
                className={`arx-sharp-select-option ${isSelected ? "arx-sharp-select-option-selected" : ""}`}
              >
                <span className="arx-sharp-select-copy">
                  {option.hint ? (
                    <span className={`arx-sharp-select-hint ${isSelected ? "arx-sharp-select-hint-selected" : ""}`}>
                      {option.hint}
                    </span>
                  ) : null}
                  <span className="arx-sharp-select-value">{option.label}</span>
                </span>
                <Check size={16} className={isSelected ? "arx-sharp-select-check" : "arx-sharp-select-check-hidden"} />
              </button>
            );
          },)}
        </div>
      ) : null}
    </div>
  );
}
