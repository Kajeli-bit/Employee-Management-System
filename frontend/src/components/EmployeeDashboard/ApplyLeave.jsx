import { useState } from "react";
import Loader from "../common/Loader";
import axios from "axios";
import { FaCheck } from "react-icons/fa";

import { useAuth } from "../../context/useAuth";
import { useWorkspace } from "../../utils/workspace";
import API_URL from "../../api";
import { CAPABILITIES, hasCapability } from "../../utils/roles";

const LEAVE_TYPES = [
  "Casual Leave",
  "Sick Leave",
  "Annual Leave",
  "Emergency Leave",
];

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

const emptyForm = {
  leaveType: "",
  fromDate: "",
  toDate: "",
  reason: "",
};

const daysBetween = (from, to) => {
  if (!from || !to) {
    return 0;
  }

  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  return Math.floor((end - start) / 86400000) + 1;
};

// Used two ways: the full page at /apply-leave and inside the dialog opened
// from the leave list. The dialog passes `bare`, `onCancel` and `onSuccess`.
const ApplyLeave = ({ bare = false, onCancel, onSuccess }) => {
  const { user, getToken } = useAuth();
  const { inAdmin } = useWorkspace();

  const [leave, setLeave] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);

  const allowed = hasCapability(user?.role, CAPABILITIES.LEAVES_APPLY);
  const days = daysBetween(leave.fromDate, leave.toDate);

  const change = (event) => {
    const { name, value } = event.target;

    setLeave((current) => ({ ...current, [name]: value }));
    setFeedback(null);

    if (errors[name]) {
      setErrors((current) => ({ ...current, [name]: undefined }));
    }
  };

  const chooseType = (type) => {
    setLeave((current) => ({ ...current, leaveType: type }));
    setErrors((current) => ({ ...current, leaveType: undefined }));
  };

  const validate = () => {
    const found = {};

    if (!leave.leaveType) {
      found.leaveType = "Choose the kind of leave you need.";
    }

    if (!leave.fromDate) {
      found.fromDate = "Pick the first day you are away.";
    }

    if (!leave.toDate) {
      found.toDate = "Pick the last day you are away.";
    }

    if (leave.fromDate && leave.toDate && leave.fromDate > leave.toDate) {
      found.toDate = "The last day cannot be before the first.";
    }

    if (!leave.reason.trim()) {
      found.reason = "Tell your manager why you need the time off.";
    }

    return found;
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!allowed) {
      return;
    }

    const found = validate();

    setErrors(found);

    if (Object.keys(found).length > 0) {
      return;
    }

    try {
      setLoading(true);
      setFeedback(null);

      const token = await getToken();

      const response = await axios.post(
        `${API_URL}/api/leave/apply`,
        {
          ...leave,
          reason: leave.reason.trim(),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setLeave(emptyForm);
        setFeedback({
          tone: "success",
          message: "Leave request sent for approval.",
        });

        if (onSuccess) {
          setTimeout(onSuccess, 1100);
        } else {
          setTimeout(() => setFeedback(null), 4000);
        }
      }
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error.response?.data?.error ||
          "Unable to submit the request. Try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="py-10 text-center">
        <Loader label="Loading…" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-6 text-center">
        <p className="text-sm font-semibold text-rose-700">
          You cannot apply for leave
        </p>
        <p className="mt-1 text-xs text-rose-600">
          Your role does not include leave requests. Ask HR to review your
          access.
        </p>
      </div>
    );
  }

  const form = (
    <form onSubmit={submit} noValidate className="space-y-5">
      {feedback && (
        <p
          role={feedback.tone === "error" ? "alert" : "status"}
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            feedback.tone === "error"
              ? "border border-rose-200 bg-rose-50 text-rose-700"
              : "border border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {feedback.message}
        </p>
      )}

      <fieldset>
        <legend className="text-sm font-medium text-slate-700">
          Leave type
        </legend>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {LEAVE_TYPES.map((type) => {
            const selected = leave.leaveType === type;

            return (
              <button
                key={type}
                type="button"
                aria-pressed={selected}
                onClick={() => chooseType(type)}
                className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                  selected
                    ? "border-brand-600 bg-brand-50 font-semibold text-brand-900 ring-1 ring-brand-600"
                    : "border-slate-200 text-slate-700 hover:border-brand-300 hover:bg-brand-50/40"
                }`}
              >
                {type}
                {selected && (
                  <FaCheck aria-hidden="true" className="text-xs text-brand-700" />
                )}
              </button>
            );
          })}
        </div>

        {errors.leaveType && (
          <p role="alert" className="mt-1.5 text-xs font-medium text-rose-600">
            {errors.leaveType}
          </p>
        )}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="fromDate"
            className="block text-sm font-medium text-slate-700"
          >
            First day
          </label>
          <input
            id="fromDate"
            type="date"
            name="fromDate"
            value={leave.fromDate}
            onChange={change}
            max={leave.toDate || undefined}
            className={`${inputClass} mt-1.5 ${
              errors.fromDate ? "border-rose-300" : ""
            }`}
          />
          {errors.fromDate && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-rose-600">
              {errors.fromDate}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="toDate"
            className="block text-sm font-medium text-slate-700"
          >
            Last day
          </label>
          <input
            id="toDate"
            type="date"
            name="toDate"
            value={leave.toDate}
            onChange={change}
            min={leave.fromDate || undefined}
            className={`${inputClass} mt-1.5 ${
              errors.toDate ? "border-rose-300" : ""
            }`}
          />
          {errors.toDate && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-rose-600">
              {errors.toDate}
            </p>
          )}
        </div>
      </div>

      {days > 0 && (
        <p className="-mt-2 text-xs text-slate-500">
          <span className="font-mono font-semibold text-slate-700">{days}</span>{" "}
          {days === 1 ? "day" : "days"} away from work.
        </p>
      )}

      <div>
        <label
          htmlFor="reason"
          className="block text-sm font-medium text-slate-700"
        >
          Reason
        </label>
        <textarea
          id="reason"
          name="reason"
          rows={3}
          value={leave.reason}
          onChange={change}
          placeholder="What is the time off for?"
          className={`${inputClass} mt-1.5 resize-none ${
            errors.reason ? "border-rose-300" : ""
          }`}
        />
        {errors.reason && (
          <p role="alert" className="mt-1.5 text-xs font-medium text-rose-600">
            {errors.reason}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            Cancel
          </button>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          {loading ? "Sending…" : "Send request"}
        </button>
      </div>
    </form>
  );

  if (bare) {
    return form;
  }

  return (
    <div
      className={
        inAdmin
          ? "mx-auto max-w-2xl px-4 pb-12 pt-10 sm:px-6"
          : "w-full px-4 pb-12 pt-8 sm:px-6 lg:px-8"
      }
    >
      <h1 className="font-display text-4xl font-medium tracking-tight text-brand-950">
        Apply for leave
      </h1>

      <p className="mt-1.5 text-sm text-slate-500">
        Your manager receives the request and approves it.
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        {form}
      </div>
    </div>
  );
};

export default ApplyLeave;
