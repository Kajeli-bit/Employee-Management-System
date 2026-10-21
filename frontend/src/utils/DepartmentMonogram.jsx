// One visual idea carried across the departments UI: every department and
// team gets a deterministic monogram tile, so units are scannable without
// any decoration that means nothing.
const MONOGRAM_STYLES = [
  "bg-brand-50 text-brand-700",
  "bg-violet-50 text-violet-700",
  "bg-fuchsia-50 text-fuchsia-700",
  "bg-purple-50 text-purple-800",
  "bg-amber-50 text-amber-700",
  "bg-slate-100 text-slate-600",
];

const initialsOf = (name = "") => {
  const words = name
    .split(/\s+/)
    .filter((word) => word.length > 1 && /[A-Za-z0-9]/.test(word[0]));

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return (
    words
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "?"
  );
};

const monogramStyleFor = (name = "") => {
  let hash = 0;

  for (const char of name) {
    hash = (hash + char.charCodeAt(0)) % 997;
  }

  return MONOGRAM_STYLES[hash % MONOGRAM_STYLES.length];
};

export const Monogram = ({ name = "", size = "md" }) => {
  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-9 w-9 text-sm",
    lg: "h-12 w-12 text-base",
  };

  return (
    <span
      aria-hidden="true"
      className={`flex ${sizes[size] ?? sizes.md} shrink-0 items-center justify-center rounded-full font-semibold ${monogramStyleFor(name)}`}
    >
      {initialsOf(name)}
    </span>
  );
};
