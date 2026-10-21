// Nilric trades in Tanzanian shillings and operates on East Africa Time.
export const CURRENCY = "TSh";
export const TIME_ZONE = "Africa/Dar_es_Salaam";

export const formatCurrency = (value) =>
  `${CURRENCY} ${Number(value || 0).toLocaleString("en-TZ", {
    maximumFractionDigits: 0,
  })}`;

export const formatDate = (value) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TIME_ZONE,
  });
};

export const formatClock = (value) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
    hour12: false,
  });
};

export const formatWeekdayDate = (value) => {
  const date = value ? new Date(value) : new Date();

  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TIME_ZONE,
  });
};

export const formatDuration = (minutes) => {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const remainder = total % 60;

  if (hours === 0) {
    return `${remainder} min`;
  }

  return `${hours}h ${String(remainder).padStart(2, "0")}m`;
};

export const formatDistance = (metres) => {
  if (metres === null || metres === undefined) {
    return "—";
  }

  if (metres < 1000) {
    return `${Math.round(metres)} m`;
  }

  return `${(metres / 1000).toFixed(1)} km`;
};

export const todayKey = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return parts;
};

export const attendanceTone = (status) => {
  switch (status) {
    case "Present":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Late":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "Half Day":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "On Leave":
      return "bg-violet-50 text-violet-700 border-violet-200";
    case "Absent":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
};
