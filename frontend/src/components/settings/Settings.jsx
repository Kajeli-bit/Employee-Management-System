import { FaShieldAlt } from "react-icons/fa";
import useLoginEmailChange from "./useLoginEmailChange";

const Settings = () => {
  const {
    email,
    setEmail,
    otp,
    setOtp,
    step,
    loading,
    error,
    success,
    currentEmail,
    sendOtp,
    verifyOtp,
    cancelOtp,
  } = useLoginEmailChange();

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <FaShieldAlt aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900">
            Login and security
          </h2>
          <p className="text-xs text-slate-500">
            Change the email address you sign in with
          </p>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5">
        {error && (
          <div
            role="alert"
            className="rounded-xl bg-rose-50 px-4 py-3 text-center text-sm font-medium text-rose-700 ring-1 ring-inset ring-rose-100"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-700 ring-1 ring-inset ring-emerald-100"
          >
            {success}
          </div>
        )}

        <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-inset ring-slate-100">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Current login email
          </p>
          <p className="mt-1 break-all text-sm font-semibold text-slate-800">
            {currentEmail || "Not available"}
          </p>
        </div>

        {step === "email" && (
          <form onSubmit={sendOtp} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                New login email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="Enter new email"
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? "Sending OTP…" : "Send OTP"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div className="rounded-xl bg-brand-50 px-4 py-3 ring-1 ring-inset ring-brand-100">
              <p className="text-xs text-slate-500">
                Verification code sent to
              </p>
              <p className="mt-1 break-all text-sm font-semibold text-slate-800">
                {email}
              </p>
            </div>

            <div>
              <label
                htmlFor="otp"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Enter code
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) =>
                  setOtp(
                    e.target.value.replace(/\D/g, "")
                  )
                }
                placeholder="6-digit code"
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-center text-sm tracking-[0.3em] outline-none transition placeholder:tracking-normal placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? "Verifying…" : "Verify code"}
            </button>

            <button
              type="button"
              onClick={cancelOtp}
              disabled={loading}
              className="w-full rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </section>
  );
};

export default Settings;
