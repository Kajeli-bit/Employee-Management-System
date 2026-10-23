import { useEffect, useRef, useState } from "react";
import { FaTimes } from "react-icons/fa";

import { validateWorker } from "../../utils/employeeForm";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

const FIELDS = [
  {
    name: "name",
    label: "Full name",
    type: "text",
    autoComplete: "name",
    placeholder: "Amina Juma",
  },
  {
    name: "email",
    label: "Work email",
    type: "email",
    autoComplete: "email",
    placeholder: "amina@nilric.co.tz",
    hint: "Their sign-in address. They get a one-time code here.",
  },
  {
    name: "phone",
    label: "Phone number",
    type: "tel",
    autoComplete: "tel",
    placeholder: "+255 712 345 678",
    hint: "How the office reaches them on site.",
    mono: true,
  },
];

// What the save button does behind the form, in the order it happens.
const FACTS = [
  {
    term: "Sign-in",
    detail: "Their work email, plus a one-time code.",
  },
  {
    term: "Generated",
    detail: "Staff ID and username, created on save.",
  },
  {
    term: "Later",
    detail: "Department, supervisor, pay and documents.",
  },
];

const OnboardForm = ({
  onSubmit,
  onCancel,
  submitting,
  successMessage,
  bare = false,
}) => {
  const [values, setValues] = useState({ name: "", email: "", phone: "" });
  const [errors, setErrors] = useState({});
  const nameRef = useRef(null);

  // Ready to type in the dialog, without scrolling the panel past its title.
  useEffect(() => {
    if (bare) {
      nameRef.current?.focus({ preventScroll: true });
    }
  }, [bare]);

  const change = (event) => {
    const { name, value } = event.target;

    setValues((current) => ({ ...current, [name]: value }));

    if (errors[name]) {
      setErrors((current) => ({ ...current, [name]: undefined }));
    }
  };

  const submit = (event) => {
    event.preventDefault();

    const found = validateWorker(values);

    setErrors(found);

    const first = FIELDS.find((field) => found[field.name]);

    if (first) {
      document.getElementById(`worker-${first.name}`)?.focus();
      return;
    }

    onSubmit({
      name: values.name.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
    });
  };

  return (
    <div
      className={
        bare
          ? "bg-white"
          : "mx-auto mt-8 w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
      }
    >
      <div className="grid md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <aside className="relative overflow-hidden bg-brand-950 px-6 py-6 sm:px-8 sm:py-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-brand-600/35 blur-3xl"
          />

          {bare && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 rounded-lg p-2 text-brand-100/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
            >
              <FaTimes aria-hidden="true" />
            </button>
          )}

          <div className="relative">
            <h1 className="max-w-[14ch] font-display text-[27px] leading-[1.1] font-medium tracking-tight text-white sm:max-w-none sm:text-[34px]">
              Add a worker
            </h1>

            <p className="mt-3 max-w-[28ch] text-sm leading-6 text-brand-100/80">
              Three details create the account. Everything else waits until
              they have started.
            </p>

            {/* On a phone the dialog has to stay short enough to reach the
                button, so the detail list only appears once there is room. */}
            <dl className="mt-8 hidden divide-y divide-white/10 border-t border-white/10 sm:block">
              {FACTS.map((fact) => (
                <div key={fact.term} className="py-3">
                  <dt className="text-xs font-semibold text-white/90">
                    {fact.term}
                  </dt>
                  <dd className="mt-0.5 text-xs leading-5 text-brand-100/70">
                    {fact.detail}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>

        <div className="px-6 py-6 sm:px-8 sm:py-9">
          {successMessage && (
            <p
              role="status"
              className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
            >
              {successMessage}
            </p>
          )}

          <form onSubmit={submit} noValidate className="space-y-4">
            {FIELDS.map((field, index) => {
              const error = errors[field.name];
              const message = error || field.hint;
              const messageId = `${field.name}-message`;

              return (
                <div key={field.name}>
                  <label
                    htmlFor={`worker-${field.name}`}
                    className="block text-sm font-medium text-slate-700"
                  >
                    {field.label}
                  </label>

                  <input
                    id={`worker-${field.name}`}
                    name={field.name}
                    type={field.type}
                    value={values[field.name]}
                    onChange={change}
                    required
                    ref={index === 0 ? nameRef : undefined}
                    autoComplete={field.autoComplete}
                    placeholder={field.placeholder}
                    aria-invalid={error ? "true" : undefined}
                    aria-describedby={message ? messageId : undefined}
                    className={`${inputClass} ${
                      field.mono ? "font-mono tracking-tight" : ""
                    } ${
                      error
                        ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/10"
                        : ""
                    }`}
                  />

                  {message && (
                    <p
                      id={messageId}
                      className={`mt-1.5 text-xs leading-5 ${
                        error ? "font-medium text-rose-600" : "text-slate-500"
                      }`}
                    >
                      {message}
                    </p>
                  )}
                </div>
              );
            })}

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
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
                disabled={submitting}
                className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                {submitting ? "Adding…" : "Add worker"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default OnboardForm;
