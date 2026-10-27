import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import { Show, SignIn, useClerk, useUser } from "@clerk/react";

import { useAuth } from "../context/useAuth";
import API_URL from "../api";
import { isManagementRole } from "../utils/roles";
import Loader from "../components/common/Loader";

const inputClass =
  "w-full rounded-xl border border-[#e1d8e9] bg-[#fdfcff] px-4 py-3 text-sm text-brand-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100/70 read-only:bg-brand-50 read-only:text-slate-600";

const Field = ({ label, name, value, onChange, ...rest }) => (
  <div>
    <label
      htmlFor={name}
      className="mb-1.5 block text-sm font-medium text-slate-700"
    >
      {label}
    </label>
    <input
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      className={inputClass}
      required
      {...rest}
    />
  </div>
);

const Login = () => {
  // null until checked; true only while the database has no company yet.
  const [setupRequired, setSetupRequired] = useState(null);
  // Set when the probe itself fails. That is a different problem from an
  // account that was never added, and it used to be reported as one.
  const [serverUnreachable, setServerUnreachable] = useState(false);
  const [form, setForm] = useState({
    name: "",
    dob: "",
    username: "",
    email: "",
    companyName: "",
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [reducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const { user, getToken, login, loading } = useAuth();
  const { user: clerkUser } = useUser();
  const clerk = useClerk();
  const clerkLoaded = clerk.loaded;
  const navigate = useNavigate();

  // State is only written from the response handlers, never synchronously, so
  // mounting the page does not trigger a second render pass.
  const checkSetup = useCallback(() => {
    axios
      .get(`${API_URL}/api/auth/setup-status`)
      .then((res) => {
        setServerUnreachable(false);
        setSetupRequired(Boolean(res.data.setupRequired));
      })
      .catch(() => {
        setServerUnreachable(true);
      });
  }, []);

  useEffect(() => {
    checkSetup();
  }, [checkSetup]);

  // The company's first account must use the email it signed in with.
  useEffect(() => {
    const email = clerkUser?.primaryEmailAddress?.emailAddress;

    if (email) {
      setForm((prev) => ({ ...prev, email }));
    }
  }, [clerkUser]);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    navigate(
      isManagementRole(user.role)
        ? "/admin-dashboard"
        : "/employee-dashboard",
      { replace: true }
    );
  }, [user, loading, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();

    if (saving) {
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication token was not created.");
      }

      const response = await axios.post(
        `${API_URL}/api/auth/register`,
        {
          name: form.name,
          dob: form.dob,
          username: form.username,
          email: form.email,
          companyName: form.companyName,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.data.success) {
        throw new Error(
          response.data.error || "Company registration failed."
        );
      }

      login(response.data.user);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.message ||
          "Could not create the company account."
      );
    } finally {
      setSaving(false);
    }
  };

  const signOutOfClerk = async () => {
    try {
      await clerk.signOut();
    } catch {
      // Session already invalid; nothing to recover here.
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-950 px-3 py-3 sm:px-6 sm:py-10">
      {!reducedMotion && (
        <video
          aria-hidden="true"
          autoPlay
          muted
          loop
          playsInline
          src="/login-bg.mp4"
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
      )}

      <div aria-hidden="true" className="absolute inset-0 bg-[#24132f]/55" />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-brand-900/35 via-transparent to-brand-950/75" />

      <div className="relative z-10 mx-auto grid w-full max-w-[680px] overflow-hidden rounded-[1.75rem] border border-white/70 bg-white shadow-[0_32px_90px_rgba(24,9,38,0.34)] md:max-w-[680px] md:grid-cols-[0.92fr_1.08fr]">
        <section className="relative isolate flex min-h-[88px] flex-col justify-center gap-1.5 overflow-hidden bg-brand-950 px-3 py-2 text-white sm:min-h-[100px] sm:gap-3 sm:px-5 sm:py-3 md:min-h-[400px] md:justify-between md:gap-0 md:px-8 md:py-8">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-90"
            style={{
              backgroundImage:
                "radial-gradient(ellipse at 82% 18%, rgba(163,124,208,0.27), transparent 38%), radial-gradient(rgba(255,255,255,0.08) 0.8px, transparent 0.8px)",
              backgroundSize: "auto, 22px 22px",
            }}
          />

          <svg
            aria-hidden="true"
            viewBox="0 0 320 320"
            className="pointer-events-none absolute -bottom-10 -right-12 h-36 w-36 text-[#d4bd91]/40 sm:h-48 sm:w-48 md:-bottom-16 md:-right-20 md:h-64 md:w-64"
            fill="none"
          >
            <circle cx="160" cy="160" r="142" stroke="currentColor" />
            <circle cx="160" cy="160" r="108" stroke="currentColor" />
            <circle cx="160" cy="160" r="74" stroke="currentColor" />
            <path d="M28 210c44-12 70-57 117-61 48-4 77 37 147 14" stroke="currentColor" />
            <path d="M66 279c24-44 65-82 113-93 48-11 76 1 106-22" stroke="currentColor" />
            <circle cx="216" cy="145" r="6" fill="currentColor" />
          </svg>

          <div className="relative z-10 flex justify-center md:justify-start">
            <span className="inline-flex rounded-2xl bg-white px-4 py-2.5 shadow-[0_8px_25px_rgba(16,8,24,0.16)]">
              <img
                src="/nilric-logo.png"
                alt="Nilric General Traders"
                className="h-10 w-auto sm:h-12 md:h-11"
              />
            </span>
          </div>

          <div className="relative z-10 my-1 text-center sm:my-2 md:my-0 md:text-left">
            <p className="font-display text-xl font-semibold leading-tight text-white sm:text-2xl md:mb-3 md:font-medium md:text-sm md:text-brand-200">
              Nilric Staff Portal
            </p>
            <h1 className="hidden font-display text-4xl font-medium leading-[1.02] tracking-tight text-white md:block sm:text-5xl lg:text-[3.5rem]">
              Welcome
              <br />
              back.
            </h1>
          </div>

          <div className="relative z-10 mx-auto hidden max-w-xs items-center gap-3 text-center md:mx-0 md:flex md:text-left">
            <span aria-hidden="true" className="h-8 w-px shrink-0 bg-[#d4bd91]" />
            <p className="text-xs leading-5 text-white/65">
              Secure sign-in for authorised Nilric staff.
            </p>
          </div>
        </section>

        <div className="flex min-w-0 flex-col justify-center border-t border-[#eee8f2] bg-white px-4 py-3 sm:px-6 sm:py-5 md:border-l md:border-t-0 md:px-8 md:py-6">
          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800"
            >
              {error}
            </div>
          )}

          <Show when="signed-out">
            <div className="mb-1 sm:mb-2">
              <h2 className="text-center font-display text-2xl font-medium tracking-tight text-brand-950 sm:text-[1.9rem]">
                Sign in to continue
              </h2>
            </div>

            {!clerkLoaded && <Loader label="Preparing sign-in…" />}

            <div
              className={`mx-auto w-full min-w-0 max-w-[400px] ${
                clerkLoaded ? "ems-fade-in" : "hidden"
              }`}
            >
              <SignIn
                routing="virtual"
                appearance={{
                  variables: {
                    colorPrimary: "#63358b",
                    colorText: "#271136",
                    colorTextSecondary: "#64748b",
                    borderRadius: "1rem",
                  },
                  elements: {
                    rootBox: "w-full max-w-full min-w-0 !w-full",
                    cardBox: "w-full max-w-full min-w-0 shadow-none !w-full",
                    card: "w-full max-w-full min-w-0 gap-2 bg-transparent p-0 shadow-none !w-full sm:gap-3",
                    headerTitle: { display: "none" },
                    headerSubtitle: { display: "none" },
                    // Accounts are created by HR/MD, so the sign-up prompt,
                    // the Clerk badge and the dev-mode badge are hidden.
                    footer: { display: "none" },
                    formButtonPrimary: {
                      minHeight: "calc(var(--clerk-button-height, 2.5rem) + 5px)",
                      height: "calc(var(--clerk-button-height, 2.5rem) + 5px)",
                      borderRadius: "0.75rem",
                      boxShadow: "0 7px 18px rgba(74, 38, 106, 0.18)",
                    },
                    socialButtonsBlockButton: {
                      height: "calc(var(--clerk-social-button-height, 52px) - 1px)",
                      minHeight:
                        "calc(var(--clerk-social-button-height, 52px) - 1px)",
                      padding: "0 1rem",
                      border: "1px solid #e4d9ef",
                      borderRadius: "1rem",
                      backgroundColor: "#fbf9fd",
                      boxShadow: "0 3px 10px rgba(74, 38, 106, 0.06)",
                      transition:
                        "background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
                    },
                    socialButtonsBlockButtonText: {
                      fontSize: "1rem",
                      fontWeight: 600,
                      letterSpacing: "0.01em",
                    },
                    socialButtonsBlockButtonArrow: { display: "none" },
                    formFieldLabel: {
                      fontSize: "0.95rem",
                      fontWeight: 600,
                    },
                    formFieldInput: {
                      height: "calc(var(--clerk-input-height, 2.5rem) + 5px)",
                      minHeight:
                        "calc(var(--clerk-input-height, 2.5rem) + 5px)",
                      borderRadius: "0.75rem",
                      borderColor: "#e1d8e9",
                      boxShadow: "none",
                    },
                  },
                }}
              />
            </div>
          </Show>

          <Show when="signed-in">
            <div className="py-6 text-center">
              {loading || user ? (
                <Loader label="Opening your dashboard…" />
              ) : setupRequired === null && !serverUnreachable ? (
                <p className="text-sm text-gray-600">
                  Checking company setup...
                </p>
              ) : serverUnreachable ? (
                <>
                  <p className="mb-4 text-sm text-gray-600">
                    Your sign-in worked, but the Employee Management
                    server could not be reached, so your account
                    could not be checked. Try again in a moment.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
                    <button
                      type="button"
                      onClick={checkSetup}
                      className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline-brand-700"
                    >
                      Try again
                    </button>
                    <button
                      type="button"
                      onClick={signOutOfClerk}
                      className="text-sm font-semibold text-gray-500 transition hover:text-gray-700 hover:underline"
                    >
                      Use a different sign-in
                    </button>
                  </div>
                </>
              ) : setupRequired === false ? (
                <>
                  <p className="mb-4 text-sm text-gray-600">
                    Your account is not registered in Employee
                    Management. Ask your Managing Director to add
                    you.
                  </p>
                  <button
                    type="button"
                    onClick={signOutOfClerk}
                    className="text-sm font-semibold text-gray-500 transition hover:text-gray-700 hover:underline"
                  >
                    Use a different sign-in
                  </button>
                </>
              ) : (
                <>
                  <p className="mb-4 text-left text-sm text-gray-600">
                    No company is set up yet. The first person to
                    sign in becomes the Managing Director and sets
                    up the company.
                  </p>

                  <form
                    onSubmit={handleCreateCompany}
                    className="space-y-3 text-left"
                  >
                    <Field
                      label="Full Name"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      autoComplete="name"
                    />
                    <Field
                      label="Date of Birth"
                      name="dob"
                      type="date"
                      value={form.dob}
                      onChange={handleChange}
                    />
                    <Field
                      label="Username"
                      name="username"
                      value={form.username}
                      onChange={handleChange}
                      autoComplete="username"
                    />
                    <Field
                      label="Email (from your sign-in)"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      readOnly
                    />
                    <Field
                      label="Company Name"
                      name="companyName"
                      value={form.companyName}
                      onChange={handleChange}
                      autoComplete="organization"
                    />

                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(99,53,139,0.2)] transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      {saving
                        ? "Creating company…"
                        : "Create company and continue"}
                    </button>
                  </form>

                  <button
                    type="button"
                    onClick={signOutOfClerk}
                    className="mt-3 text-sm font-semibold text-gray-500 transition hover:text-gray-700 hover:underline"
                  >
                    Use a different sign-in
                  </button>
                </>
              )}
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default Login;
