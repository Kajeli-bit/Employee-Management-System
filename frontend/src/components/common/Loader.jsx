const Loader = ({
  label = "Loading…",
  fullScreen = false,
  compact = false,
  size = 96,
}) => {
  const spinner = (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3"
    >
      <img
        src="/favicon.png"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className="ems-pulse"
      />
      {label && <p className="text-sm text-slate-500">{label}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-950/90">
        {spinner}
      </div>
    );
  }

  return (
    <div
      className={`flex w-full items-center justify-center ${
        compact ? "py-12" : "min-h-[60vh]"
      }`}
    >
      {spinner}
    </div>
  );
};

export default Loader;
