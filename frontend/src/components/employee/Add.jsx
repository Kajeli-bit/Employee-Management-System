import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import OnboardForm from "./OnboardForm";
import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";
import { CAPABILITIES, hasCapability, roleLabel } from "../../utils/roles";

// Onboarding asks for a name, work email and phone number only. The server
// derives the username and staff ID, defaults the role to Worker, and leaves
// placement and pay to be filled in from the profile afterwards.
const Add = ({ onSuccess, onCancel, bare = false } = {}) => {
  const navigate = useNavigate();
  const { user, getToken } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const allowed = hasCapability(user?.role, CAPABILITIES.PEOPLE_MANAGE);

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);
      setSuccessMessage("");

      const token = await getToken();
      const formData = new FormData();

      Object.entries(values).forEach(([key, value]) => {
        if (value) {
          formData.append(key, value);
        }
      });

      const response = await axios.post(
        `${API_URL}/api/employee/add`,
        formData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setSuccessMessage(
          `${roleLabel(response.data.role)} added${
            response.data.employeeId
              ? ` as ${response.data.employeeId}`
              : ""
          }. They can sign in with ${response.data.employeeEmail} and an email code.`
        );

        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          } else {
            navigate("/admin-dashboard/employees");
          }
        }, 1800);
      }
    } catch (error) {
      alert(error.response?.data?.error || "Unable to add the employee.");
    } finally {
      setSubmitting(false);
    }
  };

  if (user && !allowed) {
    return (
      <div className="mx-auto mt-16 max-w-lg rounded-2xl border border-rose-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-rose-700">Access denied</h1>
        <p className="mt-2 text-sm text-slate-600">
          Only the Managing Director and HR can add employees.
        </p>
      </div>
    );
  }

  // The page route needs breathing room below the card; inside the dialog the
  // panel must meet its rounded frame exactly, with no strip of white.
  return (
    <div className={bare ? "" : "pb-8"}>
      <OnboardForm
        submitting={submitting}
        successMessage={successMessage}
        onSubmit={handleSubmit}
        onCancel={onCancel ?? (() => navigate("/admin-dashboard/employees"))}
        bare={bare}
      />
    </div>
  );
};

export default Add;
