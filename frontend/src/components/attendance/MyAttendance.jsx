import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  FaArrowRight,
  FaCalendarDay,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaChevronLeft,
  FaChevronRight,
  FaMapMarkerAlt,
  FaSignOutAlt,
} from "react-icons/fa";

import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";
import {
  attendanceTone,
  formatClock,
  formatDuration,
  formatWeekdayDate,
  todayKey,
} from "../../utils/format";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

// Date keys are YYYY-MM-DD in East Africa Time; date maths runs in UTC so
// the calendar day never shifts with the browser's own timezone.
const toUtcMs = (key) => {
  const [year, month, day] = key.split("-").map(Number);

  return Date.UTC(year, month - 1, day);
};

const shiftKey = (key, days) =>
  new Date(toUtcMs(key) + days * DAY_MS).toISOString().slice(0, 10);

// Weeks run Monday to Sunday.
const weekStartKey = (key) => {
  const dayOfWeek = new Date(toUtcMs(key)).getUTCDay();

  return shiftKey(key, -((dayOfWeek + 6) % 7));
};

const formatWeekRange = (startKey, endKey) => {
  const from = new Date(toUtcMs(startKey)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const to = new Date(toUtcMs(endKey)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  return `${from} – ${to}`;
};

const getPosition = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(
        new Error(
          "This browser cannot read your location. Use a phone or a laptop with location services."
        )
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      (error) => {
        const messages = {
          1: "Location permission was denied. Allow location access for this site, then try again.",
          2: "Your location is unavailable right now. Move to an open area and retry.",
          3: "Reading your location took too long. Try again near a window or outdoors.",
        };

        reject(new Error(messages[error.code] || "Unable to read your location."));
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  });

const WEEKDAY_LABELS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const DayStrip = ({ records }) => {
  const days = useMemo(() => {
    const byDate = new Map(records.map((record) => [record.date, record]));
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

    return WEEKDAY_LABELS.map((label, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);

      const key = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Dar_es_Salaam",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);

      return { key, label, record: byDate.get(key) };
    });
  }, [records]);

  const toneFor = (record) => {
    if (!record) return "bg-slate-100 text-slate-400";
    if (record.status === "Present") return "bg-emerald-500 text-white";
    if (record.status === "Late") return "bg-amber-500 text-white";
    if (record.status === "Half Day") return "bg-sky-500 text-white";
    if (record.status === "On Leave") return "bg-violet-500 text-white";
    return "bg-rose-500 text-white";
  };

  return (
    <div className="flex items-end gap-1.5">
      {days.map((day) => (
        <div key={day.key} className="flex flex-col items-center gap-1.5">
          <div
            title={`${day.key}: ${day.record?.status || "No record"}`}
            className={`h-9 w-6 rounded-md ring-1 ring-inset ring-black/5 transition hover:ring-2 hover:ring-brand-400 ${toneFor(day.record)}`}
          />
          <span className="text-[10px] font-medium tracking-wide text-slate-400">
            {day.label}
          </span>
        </div>
      ))}
    </div>
  );
};

const MyAttendance = () => {
  const { getToken } = useAuth();

  const [today, setToday] = useState(null);
  const [history, setHistory] = useState({
    records: [],
    summary: null,
    policy: null,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [now, setNow] = useState(new Date());
  // 0 is the current week; negative numbers step back through earlier weeks.
  const [weekIndex, setWeekIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);

    return () => clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    try {
      const token = await getToken();

      if (!token) {
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      const [todayResponse, historyResponse] = await Promise.all([
        axios.get(`${API_URL}/api/attendance/today`, { headers }),
        axios.get(`${API_URL}/api/attendance/me`, { headers }),
      ]);

      if (todayResponse.data.success) {
        setToday(todayResponse.data);
      }

      if (historyResponse.data.success) {
        setHistory({
          records: historyResponse.data.records || [],
          summary: historyResponse.data.summary,
          policy: historyResponse.data.policy,
        });
      }
    } catch (error) {
      console.log(
        "ATTENDANCE LOAD ERROR:",
        error.response?.status,
        error.response?.data || error.message
      );

      setFeedback({
        type: "error",
        message:
          error.response?.data?.error ||
          "Unable to load your attendance right now.",
      });
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (getToken) {
      load();
    }
  }, [getToken, load]);

  const punch = async (direction) => {
    setBusy(true);
    setFeedback(null);

    try {
      const position = await getPosition();
      const token = await getToken();

      const response = await axios.post(
        `${API_URL}/api/attendance/${direction === "in" ? "check-in" : "check-out"}`,
        position,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setFeedback({ type: "success", message: response.data.message });
        await load();
      }
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error.response?.data?.error ||
          error.message ||
          "Unable to record attendance.",
      });
    } finally {
      setBusy(false);
    }
  };

  const record = today?.record;
  const checkedIn = Boolean(record?.checkIn);
  const checkedOut = Boolean(record?.checkOut);

  const clock = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Africa/Dar_es_Salaam",
  }).format(now);

  const elapsed = record?.checkIn?.at
    ? formatDuration(
        Math.max(
          0,
          Math.floor(
            ((checkedOut ? new Date(record.checkOut.at) : now).getTime() -
              new Date(record.checkIn.at).getTime()) /
              60000
          )
        )
      )
    : null;

  const currentWeekStart = weekStartKey(todayKey());
  const earliestDate = history.records.reduce(
    (earliest, entry) =>
      !earliest || entry.date < earliest ? entry.date : earliest,
    null
  );
  const earliestWeekStart = earliestDate
    ? weekStartKey(earliestDate)
    : currentWeekStart;
  const weeksBack = Math.max(
    0,
    Math.round((toUtcMs(currentWeekStart) - toUtcMs(earliestWeekStart)) / WEEK_MS)
  );
  const visibleWeek = Math.max(-weeksBack, Math.min(0, weekIndex));
  const weekStart = shiftKey(currentWeekStart, visibleWeek * 7);
  const weekEnd = shiftKey(weekStart, 6);
  const weekRecords = history.records.filter(
    (entry) => entry.date >= weekStart && entry.date <= weekEnd
  );
  const canGoBack = visibleWeek > -weeksBack;
  const canGoForward = visibleWeek < 0;
  const weekRange = formatWeekRange(weekStart, weekEnd);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
        Loading attendance…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight text-slate-900">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-700 text-xl text-white shadow-sm">
              <FaClock aria-hidden="true" />
            </span>
            Attendance
          </h1>
        </div>

        <p className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm">
          <FaCalendarDay aria-hidden="true" className="text-brand-600" />
          {formatWeekdayDate(now).replace(",", "")}
        </p>
      </div>

      {feedback && (
        <div
          role="status"
          className={`mt-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {feedback.type === "success" ? (
            <FaCheckCircle className="mt-0.5 shrink-0" />
          ) : (
            <FaExclamationTriangle className="mt-0.5 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="mt-5">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-brand-50/60 px-5 py-4">
            <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 lg:grid-cols-[auto_15rem_minmax(0,1fr)_auto]">
              {/* 1 · Live time */}
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse"
                  />
                  East Africa Time · live
                </p>
                <p className="mt-1 font-mono text-5xl font-semibold tabular-nums tracking-tight text-slate-900">
                  {clock}
                </p>
              </div>

              {/* 2 · Days of the week */}
              <div className="min-w-0 border-t border-brand-200/70 pt-4 md:h-[82px] md:border-l md:border-t-0 md:pl-5 md:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    This week
                  </p>
                </div>
                <div className="mt-2 flex items-center">
                  <DayStrip records={history.records} />
                </div>
              </div>

              {/* 3 · Clock-in fields */}
              <div className="min-w-0 border-t border-brand-200/70 pt-4 md:h-[82px] md:border-t-0 md:pt-0 lg:border-l lg:pl-5">
                <div className="flex h-full min-w-0 flex-row gap-2">
                  {record?.checkIn && (
                    <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-1.5">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold leading-snug text-emerald-900">
                        <FaCheckCircle className="shrink-0" />
                        <span>
                          Clocked in at {formatClock(record.checkIn.at)}
                        </span>
                        {record.status === "Late" && (
                          <span className="rounded bg-amber-200/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                            Late
                          </span>
                        )}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] leading-snug text-emerald-800">
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <FaMapMarkerAlt className="shrink-0" />
                          <span className="truncate">
                            {record.checkIn.locationName || "Field check-in"}
                          </span>
                        </span>
                      </p>
                    </div>
                  )}
                  {record?.checkOut && (
                    <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] font-semibold leading-snug text-slate-900">
                        <FaSignOutAlt aria-hidden="true" className="shrink-0 text-slate-500" />
                        <span>
                          Clocked out at{" "}
                          <span className="font-mono">{formatClock(record.checkOut.at)}</span>
                        </span>
                        <span className="text-[13px] font-normal text-slate-600">
                          · worked{" "}
                          <span className="font-mono font-medium text-slate-900">
                            {formatDuration(record.workedMinutes)}
                          </span>
                        </span>
                      </p>
                    </div>
                  )}
                  {checkedIn && !checkedOut && elapsed && (
                    <span className="relative inline-flex min-w-0 flex-1 flex-col items-center justify-center gap-0 self-stretch rounded bg-transparent px-2 py-1 text-[11px] font-semibold text-slate-900">
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 rounded border-2 border-emerald-600 motion-safe:animate-pulse"
                      />
                      <span className="relative leading-tight">
                        In For
                      </span>
                      <span className="relative font-mono text-lg font-bold tabular-nums leading-tight">
                        {elapsed}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              {/* 4 · Clock in button */}
              <div className="flex min-w-0 items-stretch border-t border-brand-200/70 pt-4 md:h-[82px] md:border-l md:border-t-0 md:pt-0 lg:pl-5">
                {today?.employee && (
                  <div className="flex h-full min-w-0 items-stretch">
                    {!checkedIn && (
                      <button
                        type="button"
                        onClick={() => punch("in")}
                        disabled={busy}
                        className="inline-flex items-center gap-2 self-stretch rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {busy ? "Reading location…" : "Clock in"}
                        {!busy && <FaArrowRight className="text-xs" />}
                      </button>
                    )}
                    {checkedIn && !checkedOut && (
                      <button
                        type="button"
                        onClick={() => punch("out")}
                        disabled={busy}
                        className="inline-flex items-center gap-2 self-stretch rounded-xl border border-brand-700 bg-white px-4 text-sm font-semibold text-brand-800 shadow-sm transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
                      >
                        {busy ? "Reading location…" : "Clock out"}
                      </button>
                    )}
                    {checkedIn && checkedOut && (
                      <p className="self-center text-sm font-medium text-slate-500">
                        Today is complete.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {(!today?.employee || !record?.checkIn) && (
            <div className="space-y-4 px-5 py-5">
              {!today?.employee ? (
                <p className="text-sm leading-6 text-slate-600">
                  This account has no employee record, so attendance cannot be
                  recorded. Ask an administrator to add your employee profile.
                </p>
              ) : (
                <p className="text-sm leading-6 text-slate-600">
                  You have not clocked in today. Your location is checked
                  against the Nilric work locations before the record is
                  accepted.
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">
              Recent attendance
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-xs text-slate-500">
                {weekRecords.length} records
              </span>
              <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setWeekIndex(visibleWeek - 1)}
                  disabled={!canGoBack}
                  aria-label="Previous week"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
                >
                  <FaChevronLeft aria-hidden="true" className="text-[10px]" />
                </button>
                <span className="whitespace-nowrap px-2 text-center text-xs font-semibold tabular-nums text-slate-700">
                  {visibleWeek === 0 ? `This week · ${weekRange}` : weekRange}
                </span>
                <button
                  type="button"
                  onClick={() => setWeekIndex(visibleWeek + 1)}
                  disabled={!canGoForward}
                  aria-label="Next week"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
                >
                  <FaChevronRight aria-hidden="true" className="text-[10px]" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {history.records.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No attendance has been recorded yet. Your first clock-in will appear
            here.
          </p>
        ) : weekRecords.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No attendance recorded for this week.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-brand-50/60 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">In</th>
                  <th className="px-3 py-2 font-semibold">Out</th>
                  <th className="px-3 py-2 font-semibold">Worked</th>
                  <th className="px-3 py-2 font-semibold">Location</th>
                  <th className="px-5 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {weekRecords.map((entry) => (
                  <tr key={entry._id} className="text-slate-700">
                    <td className="px-5 py-3 font-medium">
                      {entry.date === todayKey() ? "Today" : entry.date}
                    </td>
                    <td className="px-3 py-3 font-mono">
                      {formatClock(entry.checkIn?.at)}
                    </td>
                    <td className="px-3 py-3 font-mono">
                      {formatClock(entry.checkOut?.at)}
                    </td>
                    <td className="px-3 py-3 font-mono">
                      {entry.workedMinutes
                        ? formatDuration(entry.workedMinutes)
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {entry.checkIn?.locationName || "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${attendanceTone(
                          entry.status
                        )}`}
                      >
                        <span
                          aria-hidden="true"
                          className="h-1 w-1 rounded-full bg-current"
                        />
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default MyAttendance;
