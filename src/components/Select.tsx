import { useState, useRef, useEffect } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
}

export default function Select({ value, onChange, options, placeholder }: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? placeholder ?? "Select...";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border border-edge bg-surface px-3 py-2.5 text-left text-sm font-mono transition-colors hover:border-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      >
        <span className={selected ? "text-fg" : "text-fg-4"}>
          {displayLabel}
        </span>
        <span
          className="material-symbols-outlined text-base text-fg-4 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        >
          expand_more
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-edge bg-surface-alt shadow-lg shadow-black/40 backdrop-blur-xl">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-mono transition-colors first:rounded-t-lg last:rounded-b-lg ${
                opt.value === value
                  ? "bg-accent/10 text-accent"
                  : "text-fg hover:bg-accent/5"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
