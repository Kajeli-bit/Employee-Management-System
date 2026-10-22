import { useState } from "react";
import axios from "axios";
import { useUser, useReverification } from "@clerk/react";
import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";

// Shared by the admin Settings page and the account page.
const useLoginEmailChange = () => {
  const { user } = useUser();
  const { getToken } = useAuth();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("email");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pendingEmailAddress, setPendingEmailAddress] =
    useState(null);

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

    setError("");
    setSuccess("");

    const newEmail = email.trim().toLowerCase();

    if (!newEmail) {
      setError("Please enter your new email address.");
      return;
    }

    if (
      newEmail === currentEmail.trim().toLowerCase()
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
        setError("Unable to create the new email address.");
        return;
      }

      setPendingEmailAddress(emailAddress);

      await emailAddress.prepareVerification({
        strategy: "email_code",
      });

      setStep("otp");

      setSuccess(
        "OTP has been sent to your new email address."
      );
    } catch (err) {
      console.log("SEND EMAIL OTP ERROR:", err);

      setError(
        err?.errors?.[0]?.message ||
          "Unable to send OTP."
      );
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

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
        {
          email: newEmail,
        },
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

      setSuccess(
        "Login email updated successfully."
      );

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
    setError("");
    setSuccess("");
  };

  return {
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
  };
};

export default useLoginEmailChange;
