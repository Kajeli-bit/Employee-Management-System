import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import { Show, SignIn, useClerk, useUser } from "@clerk/react";

import { useAuth } from "../context/useAuth";
import API_URL from "../api";
import { isManagementRole } from "../utils/roles";
import Loader from "../components/common/Loader";

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 read-only:bg-gray-100 read-only:text-gray-600";

const Field = ({ label, name, value, onChange, ...rest }) => (
  <div>
    <label
      htmlFor={name}
      className="mb-1 block text-xs font-medium text-gray-700 sm:text-sm"
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-950 px-4 py-8 sm:py-12">
      {!reducedMotion && (
        <video
          aria-hidden="true"
          autoPlay
          muted
          loop
          playsInline
          src="/login-bg.mp4"
          className="absolute inset-0 h-full w-full object-cover opacity-75"
        />
      )}

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-brand-800/35"
      />

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-brand-950/45 via-brand-900/10 to-brand-900/25"
      />

      <div className="relative mx-auto grid w-full max-w-3xl overflow-hidden rounded-3xl border border-white/15 bg-white shadow-2xl md:grid-cols-[1fr_1.15fr]">
        <div
          className="relative flex flex-col justify-between gap-6 bg-brand-950 px-5 py-6 text-white sm:gap-8 sm:px-8 sm:py-8"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.13) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        >
          <div className="text-center md:text-left">
            <span className="relative mx-auto inline-block rounded-2xl bg-white px-3 py-2 shadow-md md:mx-0 sm:px-4 sm:py-2.5">
              <img
                src="/nilric-logo.png"
                alt="Nilric General Traders"
                className="h-12 w-auto sm:h-14"
              />
            </span>

            <h1 className="relative mt-5 text-xl font-semibold tracking-tight sm:mt-6 sm:text-2xl">
              Nilric Employee Portal
            </h1>

            <p className="relative mx-auto mt-2 max-w-sm text-sm leading-6 text-brand-200 md:mx-0">
              People, projects and attendance for Nilric General
              Traders.
            </p>
          </div>

          <p className="relative text-center text-xs leading-5 text-brand-300 md:text-left">
            Clock in from any Nilric site — your location is checked
            automatically.
          </p>
        </div>

        <div className="flex min-w-0 flex-col justify-center bg-white p-4 sm:p-6 md:p-7">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-3 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <Show when="signed-out">
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
                    colorText: "#1e1b2e",
                    colorTextSecondary: "#64748b",
                    borderRadius: "0.75rem",
                  },
                  elements: {
                    rootBox: "w-full max-w-full min-w-0 !w-full",
                    cardBox: "w-full max-w-full min-w-0 shadow-none !w-full",
                    card: "w-full max-w-full min-w-0 gap-5 bg-transparent p-0 shadow-none !w-full",
                    headerSubtitle: { display: "none" },
                    // Accounts are created by HR/MD, so the sign-up prompt,
                    // the Clerk badge and the dev-mode badge are hidden.
                    footer: { display: "none" },
                    socialButtonsBlockButton: {
                      height: "calc(var(--clerk-social-button-height, 52px) + 15px)",
                      minHeight:
                        "calc(var(--clerk-social-button-height, 52px) + 15px)",
                      padding: "0 1.25rem",
                      border: "1px solid #e4d9ef",
                      borderRadius: "0.9rem",
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
                      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
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
                      className="w-full rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-gray-300"
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
