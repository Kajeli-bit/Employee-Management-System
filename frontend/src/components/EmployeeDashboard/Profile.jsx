import { useEffect, useState } from "react";
import axios from "axios";
import {
  FaUser,
  FaPhone,
  FaMapMarkerAlt,
  FaGraduationCap,
  FaClipboardCheck,
} from "react-icons/fa";
import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";
import { formatCurrency, formatDate } from "../../utils/format";
import { roleLabel } from "../../utils/roles";

const empty = (value) =>
  value === null || value === undefined || value === "" ? "—" : value;

const Row = ({ label, value, mono }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-2.5 text-sm last:border-0">
    <span className="shrink-0 text-slate-500">{label}</span>
    <span
      className={`min-w-0 break-words text-right font-medium ${
        value === "—" ? "text-slate-300" : "text-slate-800"
      } ${mono ? "font-mono text-[13px]" : ""}`}
    >
      {value}
    </span>
  </div>
);

const Card = ({ icon, title, children }) => (
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        {icon}
      </span>
      <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
    </div>
    <div className="px-5 py-2">{children}</div>
  </section>
);

const statusTone = (status) =>
  status === "Active"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : "bg-white text-slate-600 ring-slate-200";

const Profile = () => {
  const { getToken } = useAuth();

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = await getToken();

        if (!token) {
          setLoading(false);
          return;
        }

        const response = await axios.get(
          `${API_URL}/api/employee/profile/me`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data.success) {
          setEmployee(response.data.employee);
        }
      } catch (error) {
        console.log(
          "FETCH PROFILE ERROR:",
          error.response?.data || error.message
        );
      } finally {
        setLoading(false);
      }
    };

    if (getToken) {
      fetchProfile();
    }
  }, [getToken]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <p className="text-sm text-slate-500">Loading your profile…</p>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-white p-10 text-center shadow-sm">
        <p className="text-sm font-medium text-rose-600">
          Unable to load profile. Ask your administrator to check your
          employee record.
        </p>
      </div>
    );
  }

  return (
    <div>
      <section className="overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-brand-100/60 text-slate-900 shadow-sm">
        <div
          className="px-5 pb-5 pt-6 sm:px-7"
          style={{
            backgroundImage:
              "radial-gradient(rgba(99,53,139,0.10) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <img
              src={
                employee.profileImage ||
                "https://via.placeholder.com/140"
              }
              alt={`Profile photo of ${employee.name}`}
              className="h-20 w-20 rounded-2xl border border-white bg-white object-cover shadow-sm"
            />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
                {employee.name}
              </h2>
              <p className="mt-0.5 text-sm text-brand-600">
                {empty(employee.designation)} ·{" "}
                {empty(employee.department)}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-white px-2.5 py-1 font-mono text-[11px] font-medium tabular-nums text-brand-800 ring-1 ring-inset ring-brand-200">
                  {empty(employee.employeeId)}
                </span>
                <span className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-medium text-brand-800 ring-1 ring-inset ring-brand-200">
                  {roleLabel(employee.role)}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${statusTone(
                    employee.employmentStatus
                  )}`}
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-current"
                  />
                  {empty(employee.employmentStatus)}
                </span>
              </div>
            </div>
            <div className="shrink-0 sm:text-right">
              <p className="text-[11px] uppercase tracking-wide text-brand-500">
                Monthly salary
              </p>
              <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-brand-900">
                {formatCurrency(employee.salary)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          icon={<FaUser aria-hidden="true" />}
          title="Personal information"
        >
          <Row label="Full name" value={empty(employee.name)} />
          <Row label="Work email" value={empty(employee.email)} />
          <Row label="Gender" value={empty(employee.gender)} />
          <Row
            label="Date of birth"
            value={
              employee.dob ? formatDate(employee.dob) : "—"
            }
          />
          <Row
            label="Marital status"
            value={empty(employee.maritalStatus)}
          />
        </Card>

        <Card
          icon={<FaClipboardCheck aria-hidden="true" />}
          title="Employment"
        >
          <Row
            label="Employee ID"
            value={empty(employee.employeeId)}
            mono
          />
          <Row
            label="Department"
            value={empty(employee.department)}
          />
          <Row
            label="Designation"
            value={empty(employee.designation)}
          />
          <Row
            label="Employment type"
            value={empty(employee.employmentType)}
          />
          <Row
            label="Date joined"
            value={
              employee.dateOfJoining
                ? formatDate(employee.dateOfJoining)
                : "—"
            }
          />
          <Row
            label="Attendance mode"
            value={empty(employee.workMode)}
          />
          <Row
            label="National ID"
            value={empty(employee.nationalId)}
            mono
          />
          <Row label="TIN" value={empty(employee.tin)} mono />
          <Row
            label="NSSF number"
            value={empty(employee.nssfNumber)}
            mono
          />
        </Card>

        <Card
          icon={<FaPhone aria-hidden="true" />}
          title="Contact and emergency"
        >
          <Row label="Phone" value={empty(employee.phone)} mono />
          <Row
            label="Personal email"
            value={empty(employee.personalEmail)}
          />
          <Row
            label="Address"
            value={empty(employee.address)}
          />
          <Row
            label="City"
            value={
              [employee.city, employee.region]
                .filter(Boolean)
                .join(", ") || "—"
            }
          />
          <Row
            label="Emergency contact"
            value={
              [employee.emergencyContact?.name, employee.emergencyContact?.relationship]
                .filter(Boolean)
                .join(" · ") || "—"
            }
          />
          <Row
            label="Emergency phone"
            value={empty(employee.emergencyContact?.phone)}
            mono
          />
        </Card>

        <Card
          icon={<FaGraduationCap aria-hidden="true" />}
          title="Qualifications and skills"
        >
          <Row
            label="Highest qualification"
            value={empty(employee.qualification)}
          />
          <Row
            label="Field of study"
            value={empty(employee.fieldOfStudy)}
          />
          <Row
            label="Skills"
            value={
              (employee.skills || []).join(", ") || "—"
            }
          />
        </Card>
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500">
        <FaMapMarkerAlt
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-slate-400"
        />
        <span>
          Your role, department and salary are kept by your manager. If
          anything here looks wrong, ask them to update your employee
          record.
        </span>
      </p>

    </div>
  );
};

export default Profile;
