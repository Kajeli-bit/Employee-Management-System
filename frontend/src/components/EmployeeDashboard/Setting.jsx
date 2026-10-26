import { useState } from "react";
import axios from "axios";
import {
  useUser,
  useReverification,
} from "@clerk/react";
import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";
import { useWorkspace } from "../../utils/workspace";

const Setting = () => {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { inAdmin } = useWorkspace();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("email");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [pendingEmailAddress, setPendingEmailAddress] =
    useState(null);
  const [personalOtp, setPersonalOtp] = useState("");
  const [personalVerificationStep, setPersonalVerificationStep] = useState("ready");
  const [personalMessage, setPersonalMessage] = useState("");
  const [personalError, setPersonalError] = useState("");
  const [personalLoading, setPersonalLoading] = useState(false);

  const { user: emsUser } = useAuth();
  const personalEmail = emsUser?.personalEmail || "";
  const linkedPersonalEmail = user?.emailAddresses?.find(
    (address) =>
      address.emailAddress?.trim().toLowerCase() ===
      personalEmail.trim().toLowerCase()
  );
  const pendingPersonalEmailAddress = linkedPersonalEmail?.verification?.status === "verified"
    ? null
    : linkedPersonalEmail;
  const personalEmailVerified =
    linkedPersonalEmail?.verification?.status === "verified";

  const currentEmail =
    user?.primaryEmailAddress?.emailAddress || "";

  const createEmailAddress = useReverification(
    async (newEmail) => {
      return await user.createEmailAddress({
        email: newEmail,
      });
    }
  );

  const sendOtp = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    const newEmail = email.trim().toLowerCase();

    if (!newEmail) {
      setError("Please enter a new email address.");
      return;
    }

    if (
      newEmail ===
      currentEmail.trim().toLowerCase()
    ) {
      setError("Please enter a different email address.");
      return;
    }

    if (!user) {
      setError("User information is not available.");
      return;
    }

    try {
      setLoading(true);

      const emailAddress =
        await createEmailAddress(newEmail);

      if (!emailAddress) {
        setError(
          "Unable to create the new email address."
        );
        return;
      }

      setPendingEmailAddress(emailAddress);

      await emailAddress.prepareVerification({
        strategy: "email_code",
      });

      setStep("otp");
      setMessage(
        "Verification OTP has been sent to your new email address."
      );
    } catch (err) {
      console.log("SEND EMAIL OTP ERROR:", err);

      setError(
        err?.errors?.[0]?.message ||
          "Unable to send verification OTP."
      );
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    if (!otp.trim()) {
      setError("Please enter the OTP.");
      return;
    }

    if (!pendingEmailAddress) {
      setError(
        "Email verification session expired. Please request a new OTP."
      );
      return;
    }

    try {
      setLoading(true);

      const verification =
        await pendingEmailAddress.attemptVerification({
          code: otp.trim(),
        });

      if (
        verification?.verification?.status !==
        "verified"
      ) {
        setError(
          "OTP verification was not completed."
        );
        return;
      }

      await user.update({
        primaryEmailAddressId:
          pendingEmailAddress.id,
      });

      const token = await getToken();

      if (!token) {
        setError(
          "Authentication token not available."
        );
        return;
      }

      const newEmail =
        pendingEmailAddress.emailAddress
          .trim()
          .toLowerCase();

      const response = await axios.put(
        `${API_URL}/api/auth/update-email`,
        { email: newEmail },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.data.success) {
        setError(
          response.data.error ||
            "Failed to update email in database."
        );
        return;
      }

      setMessage("Login email updated successfully.");

      setEmail("");
      setOtp("");
      setPendingEmailAddress(null);
      setStep("email");
    } catch (err) {
      console.log("VERIFY EMAIL OTP ERROR:", err);

      setError(
        err?.response?.data?.error ||
          err?.errors?.[0]?.message ||
          "Invalid or expired OTP."
      );
    } finally {
      setLoading(false);
    }
  };

  const cancelOtp = () => {
    setStep("email");
    setEmail("");
    setOtp("");
    setPendingEmailAddress(null);
    setMessage("");
    setError("");
  };

  const sendPersonalEmailCode = async () => {
    setPersonalMessage("");
    setPersonalError("");

    if (!linkedPersonalEmail || !pendingPersonalEmailAddress) {
      setPersonalError(
        "This email is not attached to your sign-in account yet. Ask HR to update your employee record."
      );
      return;
    }

    try {
      setPersonalLoading(true);
      await pendingPersonalEmailAddress.prepareVerification({ strategy: "email_code" });
      setPersonalVerificationStep("code");
      setPersonalMessage(`A verification code was sent to ${personalEmail}.`);
    } catch (err) {
      setPersonalError(
        err?.errors?.[0]?.message ||
          "Unable to send a verification code. Try again shortly."
      );
    } finally {
      setPersonalLoading(false);
    }
  };

  const verifyPersonalEmail = async (event) => {
    event.preventDefault();
    setPersonalMessage("");
    setPersonalError("");

    if (!linkedPersonalEmail || !personalOtp.trim()) {
      setPersonalError("Enter the verification code sent to your personal email.");
      return;
    }

    try {
      setPersonalLoading(true);
      const result = await pendingPersonalEmailAddress.attemptVerification({
        strategy: "email_code",
        code: personalOtp.trim(),
      });

      if (result?.verification?.status !== "verified") {
        setPersonalError("That code did not verify the email. Check it and try again.");
        return;
      }

      await user.reload();
      setPersonalOtp("");
      setPersonalVerificationStep("ready");
      setPersonalMessage("Personal email verified. It can now be used to sign in.");
    } catch (err) {
      setPersonalError(
        err?.errors?.[0]?.message || "That code is invalid or has expired."
      );
    } finally {
      setPersonalLoading(false);
    }
  };

  const returnToPersonalEmail = () => {
    setPersonalVerificationStep("ready");
    setPersonalOtp("");
    setPersonalMessage("");
    setPersonalError("");
  };

  return (
    <div
      className={
        inAdmin
          ? "min-h-full bg-gray-50 p-5"
          : "min-h-full w-full bg-gray-50 p-4 sm:p-6 lg:p-8"
      }
    >
      <div className={inAdmin ? "mx-auto max-w-md" : "w-full max-w-2xl"}>
        <div className="mb-5">
          <h1 className="font-display text-4xl font-medium tracking-tight text-brand-950">
            Login Settings
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            Manage your login email address
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6">
          {message && (
            <div className="mb-4 p-3 rounded-lg bg-green-100 text-green-700 text-sm font-medium text-center">
              {message}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-700 text-sm font-medium text-center">
              {error}
            </div>
          )}

          <div className="mb-5 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs font-semibold text-gray-500 uppercase">
              Current Login Email
            </p>

            <p className="text-sm font-medium text-gray-800 mt-1 break-all">
              {currentEmail || "Not available"}
            </p>
          </div>

          <section className="mb-5 rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-800">Personal sign-in email</h2>
            <p className="mt-1 break-all text-sm text-gray-600">
              {personalEmail || "No personal email has been added to your employee record."}
            </p>
            {personalEmail && (
              <>
                <p className="mt-1 text-xs font-medium text-gray-500">
                  {personalEmailVerified
                    ? "Verified · available as a sign-in email"
                    : "Not verified · work email remains available for sign-in"}
                </p>
                {personalMessage && (
                  <p role="status" className="mt-3 rounded-md bg-emerald-50 p-2 text-xs text-emerald-800">
                    {personalMessage}
                  </p>
                )}
                {personalError && (
                  <p role="alert" className="mt-3 rounded-md bg-rose-50 p-2 text-xs text-rose-700">
                    {personalError}
                  </p>
                )}
                {!personalEmailVerified && personalVerificationStep === "ready" && (
                  <button
                    type="button"
                    onClick={sendPersonalEmailCode}
                    disabled={personalLoading}
                    className="mt-3 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                  >
                    {personalLoading ? "Sending code…" : "Verify personal email"}
                  </button>
                )}
                {!personalEmailVerified && personalVerificationStep === "code" && (
                  <form onSubmit={verifyPersonalEmail} className="mt-3 space-y-3">
                    <label htmlFor="personal-email-code" className="block text-sm font-medium text-gray-700">
                      Code sent to {personalEmail}
                      <input
                        id="personal-email-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={personalOtp}
                        onChange={(event) => setPersonalOtp(event.target.value.replace(/[^0-9]/g, ""))}
                        required
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button type="submit" disabled={personalLoading} className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-gray-400">
                        {personalLoading ? "Checking…" : "Confirm email"}
                      </button>
                      <button type="button" onClick={returnToPersonalEmail} disabled={personalLoading} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </section>

          {step === "email" && (
            <form onSubmit={sendOtp} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-gray-700 mb-1.5"
                >
                  New Login Email
                </label>

                <input
                  id="email"
                  type="email"
                  placeholder="Enter new email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  required
                  className="
                    w-full
                    border
                    border-gray-300
                    rounded-lg
                    px-3
                    py-2.5
                    text-sm
                    outline-none
                    focus:ring-2
                    focus:ring-brand-500
                  "
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="
                  w-full
                  bg-brand-600
                  hover:bg-brand-700
                  disabled:bg-gray-400
                  disabled:cursor-not-allowed
                  text-white
                  py-2.5
                  rounded-lg
                  text-sm
                  font-semibold
                  transition
                "
              >
                {loading ? "Sending OTP..." : "Send OTP"}
              </button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={verifyOtp} className="space-y-4">
              <div className="p-3 bg-brand-50 rounded-lg">
                <p className="text-xs text-gray-500">
                  Verification OTP sent to
                </p>

                <p className="text-sm font-semibold text-gray-800 mt-1 break-all">
                  {email}
                </p>
              </div>

              <div>
                <label
                  htmlFor="otp"
                  className="block text-sm font-semibold text-gray-700 mb-1.5"
                >
                  Verification OTP
                </label>

                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) =>
                    setOtp(
                      e.target.value.replace(/\D/g, "")
                    )
                  }
                  required
                  className="
                    w-full
                    border
                    border-gray-300
                    rounded-lg
                    px-3
                    py-2.5
                    text-sm
                    text-center
                    tracking-[0.3em]
                    outline-none
                    focus:ring-2
                    focus:ring-brand-500
                  "
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="
                  w-full
                  bg-brand-600
                  hover:bg-brand-700
                  disabled:bg-gray-400
                  disabled:cursor-not-allowed
                  text-white
                  py-2.5
                  rounded-lg
                  text-sm
                  font-semibold
                  transition
                "
              >
                {loading
                  ? "Updating..."
                  : "Verify OTP & Update Email"}
              </button>

              <button
                type="button"
                onClick={cancelOtp}
                disabled={loading}
                className="
                  w-full
                  py-2.5
                  rounded-lg
                  border
                  border-gray-300
                  text-gray-700
                  hover:bg-gray-50
                  disabled:opacity-50
                  text-sm
                  font-semibold
                  transition
                "
              >
                Change Email
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Setting;