import { useEffect, useState } from "react";
import axios from "axios";
import { FaBuilding, FaSitemap, FaUsers } from "react-icons/fa";

import { useAuth } from "../../context/useAuth";
import { Monogram } from "../../utils/DepartmentMonogram";
import API_URL from "../../api";
import {
  NILRIC_ORG,
  ROLE_OPTIONS,
  roleLabel,
  roleLevel,
} from "../../utils/roles";

const LevelRail = ({ level }) => (
  <div className="flex w-10 shrink-0 flex-col items-center border-r border-slate-200 pr-3">
    <span className="font-mono text-xs font-semibold text-slate-400">
      L{level}
    </span>
    <span className="mt-1 h-full w-px bg-slate-200" />
  </div>
);

const LeaderRow = ({ entry, headcount }) => (
  <div className="flex gap-3 py-2">
    <LevelRail level={roleLevel(entry.role)} />

    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">
          {roleLabel(entry.role)}
        </h3>
        <span className="font-mono text-xs text-slate-500">
          {headcount} {headcount === 1 ? "person" : "people"}
        </span>
      </div>
      <p className="mt-0.5 text-sm text-slate-500">
        {entry.scope}
        {entry.reportsTo ? ` · reports to ${entry.reportsTo}` : " · board"}
      </p>
    </div>
  </div>
);

const DepartmentCard = ({ department, tree }) => {
  const stored = tree.find((entry) => entry.key === department.key);

  const teamRows = (department.teams || []).map((teamName) => {
    const team = (stored?.teams || []).find((entry) => entry.name === teamName);

    return {
      name: teamName,
      count: team?.memberCount ?? 0,
    };
  });

  return (
    <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Monogram name={department.label} size="sm" />
          <h3 className="text-sm font-semibold leading-5 text-slate-900">
            {department.label}
          </h3>
        </div>
        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-600">
          <FaUsers className="text-[9px]" />
          {stored?.memberCount ?? 0}
        </span>
      </div>

      <p className="mt-1 text-xs text-slate-500">{roleLabel(department.role)}</p>

      {teamRows.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
          {teamRows.map((team) => (
            <li
              key={team.name}
              className="flex items-center justify-between gap-2 text-xs text-slate-600"
            >
              <span className="truncate">{team.name}</span>
              <span className="font-mono text-slate-400">{team.count}</span>
            </li>
          ))}
        </ul>
      )}

      {teamRows.length === 0 && (
        <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-400">
          Single team, no sub-units
        </p>
      )}
    </article>
  );
};

const OrgChart = () => {
  const { getToken } = useAuth();

  const [structure, setStructure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getToken();

        if (!token) {
          return;
        }

        const response = await axios.get(`${API_URL}/api/org/structure`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.data.success) {
          setStructure(response.data);
        }
      } catch (error) {
        setError(
          error.response?.data?.error ||
            "Unable to load the organisation structure."
        );
      } finally {
        setLoading(false);
      }
    };

    if (getToken) {
      load();
    }
  }, [getToken]);

  const tree = structure?.departmentTree || [];
  const roleCounts = structure?.roleCounts || {};

  const totalPeople = Object.values(roleCounts).reduce(
    (sum, count) => sum + count,
    0
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
        Loading organisation…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight text-slate-900">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-700 text-xl text-white shadow-sm">
              <FaSitemap aria-hidden="true" />
            </span>
            Organisation structure
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Nilric General Traders Company Limited · {totalPeople}{" "}
            {totalPeople === 1 ? "person" : "people"} on the system
          </p>
        </div>

        <div className="flex gap-3 text-right">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              Departments
            </p>
            <p className="font-mono text-xl font-semibold tabular-nums text-slate-900">
              {tree.length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              Management
            </p>
            <p className="font-mono text-xl font-semibold tabular-nums text-slate-900">
              {structure?.managementCount ?? 0}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <section className="rounded-2xl border border-slate-200 bg-white px-5">
          <div className="border-b border-slate-100 py-2">
            <h2 className="text-sm font-semibold text-slate-800">Leadership</h2>
          </div>

          <div className="divide-y divide-slate-100">
            {NILRIC_ORG.leadership.map((entry) => (
              <LeaderRow
                key={entry.role}
                entry={entry}
                headcount={roleCounts[entry.role] ?? 0}
              />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-900 bg-slate-900 p-4 text-white">
          <h2 className="text-sm font-semibold">Oversight</h2>
          <p className="mt-2 text-base font-semibold">
            {roleLabel(NILRIC_ORG.oversight[0].role)}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-300">
            {NILRIC_ORG.oversight[0].scope}. Reports directly to the General
            Manager and keeps independent authority over safety and compliance.
          </p>
          <p className="mt-2 font-mono text-xs text-slate-400">
            {roleCounts[NILRIC_ORG.oversight[0].role] ?? 0} in this role
          </p>
        </section>
      </div>

      <section className="mt-5">
        <div className="flex items-baseline justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <FaBuilding className="text-brand-700" />
            Departments
          </h2>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[...NILRIC_ORG.functions, ...NILRIC_ORG.engineering].map(
            (department) => (
              <DepartmentCard
                key={department.key}
                department={department}
                tree={tree}
              />
            )
          )}
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Role levels</h2>
          <p className="mt-1 text-xs text-slate-500">
            Higher levels manage lower levels. Everyone can see this page; only
            leadership can change people, salaries and policies.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-brand-50/60 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Level</th>
                <th className="px-3 py-2 font-semibold">Role</th>
                <th className="px-3 py-2 font-semibold">Tier</th>
                <th className="px-3 py-2 font-semibold">Access</th>
                <th className="px-4 py-2 text-right font-semibold">People</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ROLE_OPTIONS.map((role) => (
                <tr key={role.value}>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">
                    {role.level}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-900">
                    {role.label}
                    <p className="text-xs font-normal text-slate-500">
                      {role.responsibilities}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {role.tier}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {role.scope === "company"
                      ? "Company-wide"
                      : role.scope === "department"
                        ? "Their department"
                        : "Own records"}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-slate-700">
                    {roleCounts[role.value] ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default OrgChart;
