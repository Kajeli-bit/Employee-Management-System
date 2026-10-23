import { useEffect, useState } from "react";
import Loader from "../common/Loader";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";

import EmployeeForm from "./EmployeeForm";
import { fetchDepartments } from "../../utils/EmployeeHelper";
import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";
import { resolveRole } from "../../utils/roles";

const dateOnly = (value) => (value ? String(value).slice(0, 10) : "");
const listToText = (value) => (Array.isArray(value) ? value.join(", ") : "");

const toFormValues = (employee) => ({
  employeeId: employee.employeeId || "",
  dob: dateOnly(employee.dob),
  gender: employee.gender || "",
  maritalStatus: employee.maritalStatus || "",
  designation: employee.designation || "",
  department: employee.department?._id || "",
  salary: employee.salary ?? "",
  // Legacy keys (admin, hr, tl) are shown as the role they map to.
  role: resolveRole(employee.userId?.role) || "employee",
  reportsTo:
    employee.userId?.reportsTo?._id || employee.userId?.reportsTo || "",
  employmentType: employee.employmentType || "Full-time",
  employmentStatus: employee.employmentStatus || "Active",
  workMode: employee.workMode || "Office",
  workLocation: employee.workLocation?._id || "",
  dateOfJoining: dateOnly(employee.dateOfJoining),
  contractEndDate: dateOnly(employee.contractEndDate),
  probationEndDate: dateOnly(employee.probationEndDate),
  phone: employee.phone || "",
  personalEmail: employee.personalEmail || "",
  address: employee.address || "",
  city: employee.city || "",
  region: employee.region || "",
  nationalId: employee.nationalId || "",
  tin: employee.tin || "",
  nssfNumber: employee.nssfNumber || "",
  nhifNumber: employee.nhifNumber || "",
  bankName: employee.bankName || "",
  bankBranch: employee.bankBranch || "",
  bankAccountName: employee.bankAccountName || "",
  bankAccountNumber: employee.bankAccountNumber || "",
  drivingLicenceNumber: employee.drivingLicenceNumber || "",
  passportNumber: employee.passportNumber || "",
  workPermitExpiry: dateOnly(employee.workPermitExpiry),
  qualification: employee.qualification || "",
  fieldOfStudy: employee.fieldOfStudy || "",
  certifications: listToText(employee.certifications),
  skills: listToText(employee.skills),
  notes: employee.notes || "",
  "emergencyContact.name": employee.emergencyContact?.name || "",
  "emergencyContact.relationship":
    employee.emergencyContact?.relationship || "",
  "emergencyContact.phone": employee.emergencyContact?.phone || "",
});

const Edit = ({ employeeId, onSuccess, onCancel, bare = false } = {}) => {
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const id = employeeId ?? routeId;
  const { getToken } = useAuth();

  const [initial, setInitial] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [jobTitles, setJobTitles] = useState([]);
  const [locations, setLocations] = useState([]);
  const [roleCatalog, setRoleCatalog] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!getToken || !id) {
        return;
      }

      try {
        const token = await getToken();

        const [
          employeeResponse,
          departmentData,
          supervisorResponse,
          structure,
          locationResponse,
        ] = await Promise.all([
          axios.get(`${API_URL}/api/employee/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetchDepartments(getToken),
          axios.get(`${API_URL}/api/org/supervisors`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_URL}/api/org/structure`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_URL}/api/locations`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (employeeResponse.data.success) {
          setInitial(toFormValues(employeeResponse.data.employee));
        }

        setDepartments(departmentData);
        setSupervisors(supervisorResponse.data.supervisors || []);
        setJobTitles(structure.data.jobTitles || []);
        setRoleCatalog(structure.data.roles || []);
        setLocations(locationResponse.data.locations || []);
      } catch (error) {
        alert(
          error.response?.data?.error ||
            "Unable to load this employee profile."
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, getToken]);

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

      // Sent even when empty so a home site can be cleared, unlike the other
      // optional text fields.
      formData.set("workLocation", values.workLocation || "");

      const response = await axios.put(
        `${API_URL}/api/employee/${id}`,
        formData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setSuccessMessage("Employee profile updated.");

        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          } else {
            navigate("/admin-dashboard/employees");
          }
        }, 1500);
      }
    } catch (error) {
      alert(
        error.response?.data?.error || "Unable to update the employee."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !initial) {
    return (
      <div className="py-16 text-center text-sm text-slate-500">
        <Loader label="Loading employee profile…" />
      </div>
    );
  }

  return (
    <div className="pb-8">
      <EmployeeForm
        initial={initial}
        departments={departments}
        supervisors={supervisors}
        jobTitles={jobTitles}
        locations={locations}
        roleCatalog={roleCatalog}
        submitting={submitting}
        successMessage={successMessage}
        onSubmit={handleSubmit}
        onCancel={onCancel ?? (() => navigate("/admin-dashboard/employees"))}
        submitLabel="Save changes"
        bare={bare}
      />
    </div>
  );
};

export default Edit;
