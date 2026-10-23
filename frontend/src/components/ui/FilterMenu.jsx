import { useEffect, useRef, useState } from "react";
import { FaCheck, FaChevronDown } from "react-icons/fa";

// Typographic listbox used inside the dashboard filter strips. It renders no
// box of its own, so a strip cell can pair it with a label and keep the flat
// one-line rhythm of the other admin pages.
const FilterMenu = ({
  id,
  label,
  value,
  options,
  onChange,
  align = "left",
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find((item) => item.id === value) || options[0];

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const choose = (nextId) => {
    onChange(nextId);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative mt-1">
      <button
        type="button"
        id={id}
        aria-label={`${label}: ${selected.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 bg-transparent text-left text-sm font-semibold text-slate-900 outline-none transition hover:text-brand-700"
      >
        <span className="truncate">{selected.label}</span>
        <FaChevronDown
          aria-hidden="true"
          className={`shrink-0 text-[10px] text-slate-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <ul
        role="listbox"
        aria-label={label}
        className={
          open
            ? `absolute ${
                align === "right" ? "right-0" : "left-0"
              } top-full z-30 mt-2 w-max min-w-full max-w-xs rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10`
            : "hidden"
        }
      >
        {options.map((item) => {
          const isSelected = item.id === selected.id;

          return (
            <li key={item.id || "all"} role="none">
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => choose(item.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm outline-none transition ${
                  isSelected
                    ? "bg-brand-50 font-semibold text-brand-800"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="whitespace-nowrap">{item.label}</span>
                {isSelected && (
                  <FaCheck
                    aria-hidden="true"
                    className="shrink-0 text-[10px] text-brand-700"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default FilterMenu;
