// Stat card used across the dashboards. The colour coding comes from the
// caller's `color` prop (a solid bg-* class); it is softened here into a
// tinted icon tile so a wall of cards stays calm while each keeps its hue.
const TINTS = {
  "bg-blue-600": "bg-blue-50 text-blue-600",
  "bg-green-600": "bg-green-50 text-green-700",
  "bg-purple-600": "bg-purple-50 text-purple-700",
  "bg-red-600": "bg-red-50 text-red-600",
  "bg-brand-600": "bg-brand-50 text-brand-700",
  "bg-amber-500": "bg-amber-50 text-amber-600",
  "bg-sky-600": "bg-sky-50 text-sky-700",
  "bg-gray-700": "bg-slate-100 text-slate-600",
  "bg-indigo-600": "bg-indigo-50 text-indigo-600",
  "bg-yellow-500": "bg-yellow-50 text-yellow-600",
};

const SummaryCard = ({ icon, text, number, color }) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">
          {text}
        </p>
        <span
          aria-hidden="true"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base ${TINTS[color] ?? "bg-slate-100 text-slate-600"}`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900">
        {number}
      </p>
    </div>
  );
};

export default SummaryCard;
