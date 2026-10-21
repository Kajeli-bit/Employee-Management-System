import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  FaArrowRight,
  FaCheckCircle,
  FaExclamationTriangle,
  FaMapMarkerAlt,
  FaSyncAlt,
} from "react-icons/fa";

import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";
import {
  attendanceTone,
  formatClock,
  formatDistance,
  formatDuration,
  formatWeekdayDate,
  todayKey,
} from "../../utils/format";

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

const DayStrip = ({ records }) => {
  const days = useMemo(() => {
    const byDate = new Map(records.map((record) => [record.date, record]));
    const list = [];

    for (let offset = 13; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - offset);

      const key = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Dar_es_Salaam",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);

      const record = byDate.get(key);

      list.push({
        key,
        label: new Date(`${key}T12:00:00`).toLocaleDateString("en-GB", {
          weekday: "narrow",
        }),
        record,
      });
    }

    return list;
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
            className={`h-8 w-5 rounded-sm ${toneFor(day.record)}`}
          />
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
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

  const policy = today?.policy || history.policy;

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

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
        Loading attendance…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Attendance
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatWeekdayDate(now)} · Nilric General Traders
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
        >
          <FaSyncAlt className="text-xs" />
          Refresh
        </button>
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

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              East Africa Time
            </p>
            <p className="mt-1 font-mono text-5xl font-semibold tabular-nums tracking-tight text-slate-900">
              {clock}
            </p>
          </div>

          <div className="space-y-4 px-5 py-5">
            {!today?.employee ? (
              <p className="text-sm leading-6 text-slate-600">
                This account has no employee record, so attendance cannot be
                recorded. Ask an administrator to add your employee profile.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-600">
                  <span>
                    Shift{" "}
                    <span className="font-mono font-medium text-slate-900">
                      {policy?.workStart || "08:00"}–
                      {policy?.workEnd || "17:00"}
                    </span>
                  </span>
                  <span>
                    Grace{" "}
                    <span className="font-mono font-medium text-slate-900">
                      {policy?.graceMinutes ?? 15} min
                    </span>
                  </span>
                  <span>
                    Mode{" "}
                    <span className="font-medium text-slate-900">
                      {today.employee.workMode}
                    </span>
                  </span>
                </div>

                {record?.checkIn ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                      <FaCheckCircle />
                      Clocked in at {formatClock(record.checkIn.at)}
                      {record.status === "Late" && (
                        <span className="rounded bg-amber-200/70 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                          Late
                        </span>
                      )}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-emerald-800">
                      <span className="inline-flex items-center gap-1">
                        <FaMapMarkerAlt />
                        {record.checkIn.locationName || "Field check-in"}
                      </span>
                      {record.checkIn.distanceMeters !== null && (
                        <span>
                          {formatDistance(record.checkIn.distanceMeters)} from
                          the fence centre
                        </span>
                      )}
                      {!checkedOut && <span>{elapsed} on the clock</span>}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-slate-600">
                    You have not clocked in today. Your location is checked
                    against the Nilric work locations before the record is
                    accepted.
                  </p>
                )}

                {record?.checkOut && (
                  <p className="text-sm text-slate-600">
                    Clocked out at{" "}
                    <span className="font-mono font-medium text-slate-900">
                      {formatClock(record.checkOut.at)}
                    </span>{" "}
                    · worked {formatDuration(record.workedMinutes)}
                  </p>
                )}

                <div className="flex flex-wrap gap-3 pt-1">
                  {!checkedIn && (
                    <button
                      type="button"
                      onClick={() => punch("in")}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300"
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
                      className="inline-flex items-center gap-2 rounded-lg border border-brand-700 px-5 py-3 text-sm font-semibold text-brand-800 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
                    >
                      {busy ? "Reading location…" : "Clock out"}
                    </button>
                  )}

                  {checkedIn && checkedOut && (
                    <p className="text-sm font-medium text-slate-500">
                      Today is complete.
                    </p>
                  )}
                </div>

                <p className="text-xs leading-5 text-slate-500">
                  {today.locations?.length
                    ? `Accepted locations: ${today.locations
                        .map((location) => location.name)
                        .join(", ")}.`
                    : "No work locations are configured yet."}{" "}
                  Field and remote staff are recorded without a geofence match.
                </p>
              </>
            )}
          </div>
        </section>

        <section className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Last 14 days
            </p>
            <div className="mt-3">
              <DayStrip records={history.records} />
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">Days recorded</dt>
                <dd className="font-mono text-lg font-semibold text-slate-900">
                  {history.summary?.days ?? 0}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Hours logged</dt>
                <dd className="font-mono text-lg font-semibold text-slate-900">
                  {formatDuration(history.summary?.totalMinutes ?? 0)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Late arrivals</dt>
                <dd className="font-mono text-lg font-semibold text-amber-700">
                  {history.summary?.late ?? 0}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Half days</dt>
                <dd className="font-mono text-lg font-semibold text-sky-700">
                  {history.summary?.halfDay ?? 0}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              How check-in works
            </p>
            <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
              <li>1. Allow location access when the browser asks.</li>
              <li>2. Stand within the work location radius (HQ: 250 m).</li>
              <li>
                3. Clock in before {policy?.workStart || "08:00"} to avoid the
                late flag.
              </li>
              <li>4. Clock out when you leave; short days become half days.</li>
            </ol>
          </div>
        </section>
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">
            Recent attendance
          </h2>
          <span className="text-xs text-slate-400">
            {history.records.length} records
          </span>
        </div>

        {history.records.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No attendance has been recorded yet. Your first clock-in will appear
            here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
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
                {history.records.map((entry) => (
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
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${attendanceTone(
                          entry.status
                        )}`}
                      >
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
