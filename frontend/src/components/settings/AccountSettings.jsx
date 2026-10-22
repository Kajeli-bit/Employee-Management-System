import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { NavLink } from "react-router-dom";
import {
  FaArrowRight,
  FaShieldAlt,
  FaTimes,
  FaUser,
} from "react-icons/fa";
import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";
import { formatDate } from "../../utils/format";
import { roleLabel } from "../../utils/roles";
import Settings from "./Settings";
import Loader from "../common/Loader";

const empty = (value) =>
  value === null || value === undefined || value === "" ? "—" : value;

const Field = ({ label, value, mono }) => (
  <div className="min-w-0">
    <dt className="text-xs text-slate-500">{label}</dt>
    <dd
      title={String(value)}
      className={`mt-0.5 truncate text-sm ${
        value === "—"
          ? "text-slate-300"
          : "font-semibold text-slate-900"
      } ${mono ? "font-mono tabular-nums" : ""}`}
    >
      {value}
    </dd>
  </div>
);

const Panel = ({ icon, title, children }) => (
  <section className="flex min-h-0 flex-col rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
    <header className="mb-4 flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-200 text-brand-800">
        {icon}
      </span>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
    </header>
    {children}
  </section>
);

const AccountSettings = () => {
  const { getToken } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = await getToken();
        if (!token) return;

        const response = await axios.get(
          `${API_URL}/api/employee/profile/me`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.data.success) {
          setEmployee(response.data.employee);
        }
      } catch (error) {
        console.log(
          "FETCH ACCOUNT ERROR:",
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

  const [securityOpen, setSecurityOpen] = useState(false);
  const securityButtonRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!securityOpen) return undefined;

    const trigger = securityButtonRef.current;
    closeButtonRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") setSecurityOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [securityOpen]);

  if (loading) {
    return <Loader label="Loading your account…" compact />;
  }

  if (!employee) {
    return (
      <div className="p-6 text-center text-sm font-medium text-rose-600">
        Unable to load your account. Ask your administrator to check your
        employee record.
      </div>
    );
  }

  const subtitle =
    [employee.designation, employee.department]
      .filter(Boolean)
      .join(" · ") || "No designation set";
  const role = roleLabel(employee.role);
  const showRole = role !== employee.designation;
  const isActive = employee.employmentStatus === "Active";

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-brand-100/60 p-4 sm:p-6 lg:h-screen lg:overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:mx-auto lg:w-5/6">
        <header className="flex w-full items-center gap-4 rounded-2xl border border-brand-300 bg-gradient-to-r from-brand-200 to-brand-100 px-4 py-[6px] shadow-sm sm:px-5 sm:py-[10px] lg:mx-auto lg:w-[calc(60%-0.5rem)]">
        {employee.profileImage ? (
          <img
            src={employee.profileImage}
            alt={`Profile photo of ${employee.name}`}
            className="h-16 w-16 shrink-0 rounded-full border-2 border-white object-cover shadow-sm"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-white bg-brand-500 text-lg font-semibold text-white shadow-sm"
          >
            {employee.name
              ?.split(" ")
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toUpperCase()}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight text-brand-950">
            {employee.name}
          </h1>
          <p className="text-sm text-brand-900">{subtitle}</p>

          <div className="mt-2.5 flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-full bg-white px-3 py-1.5 font-mono tabular-nums text-brand-900 ring-1 ring-inset ring-brand-300">
            {empty(employee.employeeId)}
          </span>
          {showRole && (
            <span className="rounded-full bg-white px-3 py-1.5 text-brand-900 ring-1 ring-inset ring-brand-300">
              {role}
            </span>
          )}
          <span
            className={`rounded-full px-3 py-1.5 ring-1 ring-inset ${
              isActive
                ? "bg-emerald-100 text-emerald-800 ring-emerald-300"
                : "bg-white text-brand-900 ring-brand-300"
            }`}
          >
            {empty(employee.employmentStatus)}
          </span>
          </div>
        </div>

        <button
          ref={securityButtonRef}
          type="button"
          onClick={() => setSecurityOpen(true)}
          aria-haspopup="dialog"
          className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-brand-900 shadow-sm ring-1 ring-inset ring-brand-300 transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          <FaShieldAlt aria-hidden="true" className="text-xs" />
          Security
        </button>
        </header>

        <div className="flex min-h-0 flex-col gap-4 lg:flex-row">
          <div className="flex min-w-0 flex-col gap-4 lg:mx-auto lg:w-[calc(60%-0.5rem)]">
          <Panel icon={<FaUser aria-hidden="true" />} title="Personal and employment">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Work email" value={empty(employee.email)} />
              <Field label="Phone" value={empty(employee.phone)} mono />
              <Field label="Gender" value={empty(employee.gender)} />
              <Field
                label="Date of birth"
                value={employee.dob ? formatDate(employee.dob) : "—"}
              />
              <Field
                label="Marital status"
                value={empty(employee.maritalStatus)}
              />
              <Field
                label="Personal email"
                value={empty(employee.personalEmail)}
              />
              <Field
                label="Address"
                value={
                  [employee.address, employee.city, employee.region]
                    .filter(Boolean)
                    .join(", ") || "—"
                }
              />
              <Field
                label="Emergency contact"
                value={
                  [
                    employee.emergencyContact?.name,
                    employee.emergencyContact?.relationship,
                    employee.emergencyContact?.phone,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"
                }
              />
            </dl>
            <div className="my-5 border-t border-slate-100" aria-hidden="true" />

            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field
                label="Date joined"
                value={
                  employee.dateOfJoining
                    ? formatDate(employee.dateOfJoining)
                    : "—"
                }
              />
              <Field
                label="Employment type"
                value={empty(employee.employmentType)}
              />
              <Field
                label="Attendance mode"
                value={empty(employee.workMode)}
              />
              <Field
                label="Qualification"
                value={
                  [employee.qualification, employee.fieldOfStudy]
                    .filter(Boolean)
                    .join(", ") || "—"
                }
              />
              <Field
                label="National ID"
                value={empty(employee.nationalId)}
                mono
              />
              <Field label="TIN" value={empty(employee.tin)} mono />
              <Field
                label="NSSF number"
                value={empty(employee.nssfNumber)}
                mono
              />
            </dl>

            <div className="mt-[6px] flex justify-end border-t border-slate-100">
              <NavLink
                to="/admin-dashboard/my-attendance"
                className="inline-flex w-fit items-center gap-2 rounded-xl px-1 text-sm font-semibold text-brand-800 transition hover:text-brand-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                Review my attendance
                <FaArrowRight aria-hidden="true" className="text-xs" />
              </NavLink>
            </div>
          </Panel>
          </div>
        </div>
      </div>

      {securityOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSecurityOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Login and security"
            className="relative max-h-full w-full max-w-md overflow-y-auto"
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setSecurityOpen(false)}
              aria-label="Close login and security"
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <FaTimes aria-hidden="true" />
            </button>
            <Settings />
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountSettings;
