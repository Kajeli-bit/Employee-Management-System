import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import EmployeeForm from "./EmployeeForm";
import { fetchDepartments } from "../../utils/EmployeeHelper";
import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";
import { CAPABILITIES, hasCapability } from "../../utils/roles";

const Add = () => {
  const navigate = useNavigate();
  const { user, getToken } = useAuth();

  const [departments, setDepartments] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [jobTitles, setJobTitles] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const allowed = hasCapability(user?.role, CAPABILITIES.PEOPLE_MANAGE);

  useEffect(() => {
    const load = async () => {
      if (!getToken) {
        return;
      }

      try {
        const token = await getToken();

        const [departmentData, supervisorResponse, structureResponse] =
          await Promise.all([
            fetchDepartments(getToken),
            axios.get(`${API_URL}/api/org/supervisors`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get(`${API_URL}/api/org/structure`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);

        setDepartments(departmentData);
        setSupervisors(supervisorResponse.data.supervisors || []);
        setJobTitles(structureResponse.data.jobTitles || []);
      } catch (error) {
        console.log("ADD EMPLOYEE SETUP ERROR:", error.message);
      }
    };

    load();
  }, [getToken]);

  const handleSubmit = async (values, image) => {
    try {
      setSubmitting(true);
      setSuccessMessage("");

      const token = await getToken();
      const formData = new FormData();

      Object.entries(values).forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
          formData.append(key, value);
        }
      });

      if (image) {
        formData.append("image", image);
      }

      const response = await axios.post(
        `${API_URL}/api/employee/add`,
        formData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setSuccessMessage(
          `${response.data.role || "Employee"} added. They can sign in with ${response.data.employeeEmail} and an email code.`
        );

        setTimeout(() => navigate("/admin-dashboard/employees"), 1800);
      }
    } catch (error) {
      alert(
        error.response?.data?.error || "Unable to add the employee."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (user && !allowed) {
    return (
      <div className="mx-auto mt-16 max-w-lg rounded-2xl border border-rose-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-rose-700">Access denied</h1>
        <p className="mt-2 text-sm text-slate-600">
          Only company leadership and department managers can add employees.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <EmployeeForm
        mode="create"
        currentUserRole={user?.role}
        departments={departments}
        supervisors={supervisors}
        jobTitles={jobTitles}
        submitting={submitting}
        successMessage={successMessage}
        onSubmit={handleSubmit}
        onCancel={() => navigate("/admin-dashboard/employees")}
        submitLabel="Add employee"
      />
    </div>
  );
};

export default Add;
