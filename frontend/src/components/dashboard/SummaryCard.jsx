import { NavLink } from "react-router-dom";

// Stat card for the admin dashboard. One quiet surface; the icon tile
// carries a soft tone so a wall of cards stays calm. Colour is used only
// where it means something (late arrivals, rejections).
const TONES = {
  brand: "bg-brand-50 text-brand-700",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
  sky: "bg-sky-50 text-sky-700",
  slate: "bg-slate-100 text-slate-600",
};

const SummaryCard = ({
  icon,
  text,
  number,
  tone = "brand",
  to,
  compact = false,
}) => {
  const Wrapper = to ? NavLink : "div";
  const padding = compact ? "px-4 py-3" : "p-4";
  const wrapperProps = to
    ? {
        to,
        className: `block rounded-2xl border border-slate-200 bg-white ${padding} shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600${compact ? " flex h-full items-center gap-3" : ""}`,
      }
    : {
        className: `rounded-2xl border border-slate-200 bg-white ${padding} shadow-sm`,
      };

  if (compact) {
    return (
      <Wrapper {...wrapperProps}>
        <span
          aria-hidden="true"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base ${TONES[tone] ?? TONES.brand}`}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-500">{text}</p>
          <p className="font-mono text-xl font-semibold tabular-nums tracking-tight text-slate-900">
            {number}
          </p>
        </div>
        {to && (
          <span className="text-xs font-medium text-brand-700">View details</span>
        )}
      </Wrapper>
    );
  }

  return (
    <Wrapper {...wrapperProps}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base ${TONES[tone] ?? TONES.brand}`}
        >
          {icon}
        </span>
        <p className="min-w-0 text-sm text-slate-500">{text}</p>
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
        {number}
      </p>
      {to && (
        <p className="mt-1 text-xs font-medium text-brand-700">
          View details
        </p>
      )}
    </Wrapper>
  );
};

export default SummaryCard;
