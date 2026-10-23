import { useEffect, useRef, useState } from "react";
import Loader from "../common/Loader";
import { FaBuilding, FaChevronRight } from "react-icons/fa";
import AddDepartment from "./AddDepartment";
import { Monogram } from "../../utils/DepartmentMonogram";
import axios from "axios";
import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";
import { CAPABILITIES, hasCapability } from "../../utils/roles";

const onlyDepartments = (records) =>
  records.filter((dep) => !dep.isTeam);

const DepartmentList = () => {
  const { user, getToken } = useAuth();

  const [departments, setDepartments] = useState([]);
  const [depLoading, setDepLoading] = useState(false);
  const [filteredDepartment, setFilteredDepartments] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const quietNextLoad = useRef(false);
  const [viewingId, setViewingId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [teamEdits, setTeamEdits] = useState([]);
  const [removedTeamIds, setRemovedTeamIds] = useState([]);
  const [detailKey, setDetailKey] = useState(0);

  const canManage = hasCapability(
    user?.role,
    CAPABILITIES.DEPARTMENTS_MANAGE
  );

  const teamTotal = departments.filter((dep) => dep.isTeam).length;

  useEffect(() => {
    if (!getToken) return;

    const quiet = quietNextLoad.current;
    quietNextLoad.current = false;

    const load = async () => {
      if (!quiet) {
        setDepLoading(true);
      }

      try {
        const token = await getToken();

        if (!token) {
          console.log("CLERK TOKEN NOT FOUND");
          return;
        }

        const response = await axios.get(
          `${API_URL}/api/department`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data.success) {
          const fetched = response.data.departments;

          const mapped = fetched.map((dep) => ({
            _id: dep._id,
            dep_name: dep.dep_name,
            description: dep.description || "",
            isTeam: dep.kind === "team",
            parentId:
              typeof dep.parent === "object"
                ? dep.parent?._id || null
                : dep.parent || null,
          }));

          const withCounts = mapped.map((row) => ({
            ...row,
            teamCount: row.isTeam
              ? 0
              : mapped.filter((entry) => entry.parentId === row._id)
                  .length,
          }));

          setDepartments(withCounts);
          setFilteredDepartments(onlyDepartments(withCounts));
        }
      } catch (error) {
        console.log(
          "FETCH DEPARTMENTS ERROR:",
          error.response?.status,
          error.response?.data || error.message
        );

        alert(
          error.response?.data?.error ||
            "Something went wrong while fetching departments"
        );
      } finally {
        setDepLoading(false);
      }
    };

    load();
  }, [getToken, refreshKey]);

  useEffect(() => {
    if (!showAdd && !viewingId) return;

    const closeOnEscape = (e) => {
      if (e.key === "Escape") {
        setShowAdd(false);
        setViewingId(null);
      }
    };

    document.addEventListener("keydown", closeOnEscape);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [showAdd, viewingId]);

  const handleDepartmentCreated = () => {
    setShowAdd(false);
    quietNextLoad.current = true;
    setRefreshKey((key) => key + 1);
  };

  useEffect(() => {
    if (!viewingId || !getToken) return;

    let cancelled = false;

    const loadDetail = async () => {
      setDetailLoading(true);
      setDetailError("");
      setDetail(null);
      setEditing(false);
      setSaveError("");

      try {
        const token = await getToken();

        if (!token) {
          if (!cancelled) {
            setDetailError(
              "Authentication token not found. Please login again."
            );
          }
          return;
        }

        const response = await axios.get(
          `${API_URL}/api/department/${viewingId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!cancelled && response.data.success) {
          setDetail({
            department: response.data.department,
            teams: response.data.teams || [],
          });
        }
      } catch (err) {
        if (!cancelled) {
          setDetailError(
            err.response?.data?.error || "Unable to load department."
          );
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    };

    loadDetail();

    return () => {
      cancelled = true;
    };
  }, [viewingId, getToken, detailKey]);

  const startEditing = () => {
    if (!detail) return;

    setEditName(detail.department.dep_name);
    setEditDesc(detail.department.description || "");
    setTeamEdits(
      detail.teams.map((team) => ({
        _id: String(team._id),
        name: team.dep_name,
        employeeCount: team.employeeCount ?? 0,
      }))
    );
    setRemovedTeamIds([]);
    setSaveError("");
    setEditing(true);
  };

  const updateTeamName = (index, value) => {
    setTeamEdits((prev) =>
      prev.map((row, i) => (i === index ? { ...row, name: value } : row))
    );
  };

  const addTeamRow = () => {
    setTeamEdits((prev) => [
      ...prev,
      { _id: null, name: "", employeeCount: 0 },
    ]);
  };

  const dropTeamRow = (index) => {
    const row = teamEdits[index];

    if (row?._id) {
      setRemovedTeamIds((ids) =>
        ids.includes(row._id) ? ids : [...ids, row._id]
      );
    }

    setTeamEdits((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveDetail = async (e) => {
    e.preventDefault();
    setSaveError("");

    if (!editName.trim()) {
      setSaveError("Department name is required.");
      return;
    }

    if (teamEdits.some((row) => row._id && !row.name.trim())) {
      setSaveError("Team names cannot be blank.");
      return;
    }

    try {
      setSaving(true);

      const token = await getToken();

      if (!token) {
        setSaveError("Authentication token not found. Please login again.");
        return;
      }

      const response = await axios.put(
        `${API_URL}/api/department/${viewingId}`,
        {
          dep_name: editName.trim(),
          description: editDesc.trim(),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        const headers = {
          Authorization: `Bearer ${token}`,
        };

        // Removals first so a rename can reuse a freed name.
        for (const teamId of removedTeamIds) {
          await axios.delete(`${API_URL}/api/department/${teamId}`, {
            headers,
          });
        }

        for (const row of teamEdits) {
          if (!row._id) continue;

          const original = detail.teams.find(
            (team) => String(team._id) === row._id
          );

          if (original && original.dep_name !== row.name.trim()) {
            await axios.put(
              `${API_URL}/api/department/${row._id}`,
              {
                dep_name: row.name.trim(),
                description: original.description || "",
                kind: "team",
                parent: viewingId,
              },
              { headers }
            );
          }
        }

        for (const row of teamEdits) {
          if (!row._id && row.name.trim()) {
            await axios.post(
              `${API_URL}/api/department/add`,
              {
                dep_name: row.name.trim(),
                kind: "team",
                parent: viewingId,
              },
              { headers }
            );
          }
        }

        setEditing(false);
        quietNextLoad.current = true;
        setRefreshKey((key) => key + 1);
        setDetailKey((key) => key + 1);
      }
    } catch (err) {
      setSaveError(
        err.response?.data?.error ||
          "Something went wrong while saving changes."
      );
    } finally {
      setSaving(false);
    }
  };

  const filterDepartments = (e) => {
    const query = e.target.value.toLowerCase();

    setFilteredDepartments(
      onlyDepartments(departments).filter((dep) =>
        dep.dep_name.toLowerCase().includes(query)
      )
    );
  };

  return (
    <>
      {depLoading ? (
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Loader label="Loading departments…" />
        </div>
      ) : (
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-3 font-display text-4xl font-medium tracking-tight text-brand-950">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-700 text-xl text-white shadow-sm">
                  <FaBuilding aria-hidden="true" />
                </span>
                Departments
              </h1>
            </div>

          </div>

          <div className="mt-5 grid shrink-0 grid-cols-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div className="col-span-2 min-w-0 px-5 py-3 sm:col-span-1">
              <label
                htmlFor="department-search"
                className="block text-[11px] font-medium uppercase tracking-wide text-slate-400"
              >
                Search
              </label>
              <input
                id="department-search"
                type="text"
                placeholder="Search departments"
                style={{ outline: "none" }}
                className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400"
                onChange={filterDepartments}
              />
            </div>

            <div className="px-5 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Departments
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold leading-none tabular-nums text-slate-900">
                {onlyDepartments(departments).length}
              </p>
            </div>

            <div className="px-5 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Teams
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold leading-none tabular-nums text-slate-900">
                {teamTotal}
              </p>
            </div>

            {canManage && (
              <div className="col-span-2 flex min-w-0 items-center px-3 py-3 sm:col-span-3 lg:col-span-1">
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  +
                </span>
                Add New Department
              </button>
              </div>
            )}
          </div>

          {filteredDepartment.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
              <p className="text-sm font-semibold text-slate-800">
                No departments found
              </p>
              <p className="mx-auto mt-1 max-w-[320px] text-xs leading-relaxed text-slate-500">
                Try a different search — or add a new department to grow
                the structure.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDepartment.map((dep) => (
                <button
                  key={dep._id}
                  type="button"
                  onClick={() => setViewingId(dep._id)}
                  aria-label={`View ${dep.dep_name} details`}
                  className="group flex w-full flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Monogram name={dep.dep_name} size="sm" />
                      <h2 className="truncate text-sm font-semibold leading-5 text-slate-900">
                        {dep.dep_name}
                      </h2>
                    </div>
                    <span className="inline-flex shrink-0 items-center rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-slate-600">
                      {dep.teamCount ?? 0}{" "}
                      {(dep.teamCount ?? 0) === 1 ? "team" : "teams"}
                    </span>
                  </div>

                  <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-5 text-slate-500">
                    {dep.description || "Select this card for teams and details."}
                  </p>

                  <span className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-xs font-semibold text-brand-700">
                    Open department
                    <FaChevronRight
                      aria-hidden="true"
                      className="text-[10px] text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-700"
                    />
                  </span>
                </button>
              ))}
            </div>
          )}

          {showAdd && (
            <div               className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm lg:left-64"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                  setShowAdd(false);
                }
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-department-title"
                className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl"
              >
                <AddDepartment
                  onClose={() => setShowAdd(false)}
                  onCreated={handleDepartmentCreated}
                />
              </div>
            </div>
          )}

          {viewingId && (
            <div               className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm lg:left-64"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                  setViewingId(null);
                }
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="department-detail-title"
                className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl"
              >
                {detailLoading ? (
                  <Loader label="Loading…" compact />
                ) : detailError || !detail ? (
                  <div className="p-6 sm:p-8">
                    <div className="flex items-start justify-between gap-4">
                      <h2
                        id="department-detail-title"
                        className="text-xl font-semibold text-slate-900"
                      >
                        Department
                      </h2>
                      <button
                        type="button"
                        onClick={() => setViewingId(null)}
                        aria-label="Close"
                        className="rounded-md px-2 py-1 text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        &times;
                      </button>
                    </div>
                    <p
                      role="alert"
                      className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                    >
                      {detailError || "Department not found."}
                    </p>
                    <div className="mt-6 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setViewingId(null)}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ) : editing ? (
                  <div className="p-6 sm:p-8">
                    <div className="flex items-start justify-between gap-4">
                      <h2
                        id="department-detail-title"
                        className="text-xl font-semibold text-slate-900"
                      >
                        Edit department
                      </h2>
                      <button
                        type="button"
                        onClick={() => setViewingId(null)}
                        aria-label="Close"
                        className="rounded-md px-2 py-1 text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        &times;
                      </button>
                    </div>

                    {saveError && (
                      <p
                        role="alert"
                        className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                      >
                        {saveError}
                      </p>
                    )}

                    <form onSubmit={handleSaveDetail} className="mt-5">
                      <div>
                        <label
                          htmlFor="edit-dep-name"
                          className="text-sm font-medium text-slate-700"
                        >
                          Department Name
                        </label>
                        <input
                          type="text"
                          id="edit-dep-name"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          autoFocus
                          className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
                          required
                        />
                      </div>

                      <div className="mt-5">
                        <label
                          htmlFor="edit-dep-description"
                          className="block text-sm font-medium text-slate-700"
                        >
                          Description
                        </label>
                        <textarea
                          id="edit-dep-description"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          rows="3"
                          className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
                        />
                      </div>

                      <div className="mt-5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-700">
                            Teams
                          </span>
                          <button
                            type="button"
                            onClick={addTeamRow}
                            className="text-sm font-semibold text-brand-700 hover:text-brand-800"
                          >
                            + Add team
                          </button>
                        </div>

                        {teamEdits.map((row, index) => (
                          <div
                            key={row._id ?? `new-${index}`}
                            className="mt-2 flex items-center gap-2"
                          >
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) =>
                                updateTeamName(index, e.target.value)
                              }
                              placeholder={`Team ${index + 1} name`}
                              aria-label={
                                row._id ? "Rename team" : "New team name"
                              }
                              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
                            />
                            <button
                              type="button"
                              onClick={() => dropTeamRow(index)}
                              disabled={row.employeeCount > 0}
                              title={
                                row.employeeCount > 0
                                  ? "Teams with employees cannot be removed"
                                  : "Remove team"
                              }
                              className="shrink-0 rounded-md px-2 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                            >
                              Remove
                            </button>
                          </div>
                        ))}

                        <p className="mt-1 text-xs text-slate-500">
                          Renames, additions and removals apply when you save.
                        </p>
                      </div>

                      <div className="mt-6 flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setEditing(false)}
                          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={saving}
                          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {saving ? "Saving..." : "Save changes"}
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="p-6 sm:p-8">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <Monogram
                          name={detail.department.dep_name}
                          size="lg"
                        />
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                            Department
                          </p>
                          <h2
                            id="department-detail-title"
                            className="mt-1 text-xl font-semibold text-slate-900"
                          >
                            {detail.department.dep_name}
                          </h2>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setViewingId(null)}
                        aria-label="Close"
                        className="rounded-md px-2 py-1 text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        &times;
                      </button>
                    </div>

                    {detail.department.description && (
                      <p className="mt-3 text-sm leading-relaxed text-slate-600">
                        {detail.department.description}
                      </p>
                    )}

                    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
                      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                        <h3 className="text-sm font-semibold text-slate-900">
                          Teams
                        </h3>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                          {detail.teams.length}{" "}
                          {detail.teams.length === 1 ? "team" : "teams"}
                        </span>
                      </div>

                      {detail.teams.length === 0 ? (
                        <p className="px-5 py-6 text-sm text-slate-500">
                          No teams yet.
                        </p>
                      ) : (
                        <ul className="divide-y divide-slate-100">
                          {detail.teams.map((team) => (
                            <li
                              key={team._id}
                              className="flex items-center gap-4 px-5 py-4"
                            >
                              <Monogram name={team.dep_name} size="md" />
                              <div>
                                <p className="text-sm font-medium text-slate-900">
                                  {team.dep_name}
                                </p>
                                {team.description && (
                                  <p className="mt-0.5 text-sm text-slate-500">
                                    {team.description}
                                  </p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="mt-6 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setViewingId(null)}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Close
                      </button>
                      {canManage && (
                        <button
                          type="button"
                          onClick={startEditing}
                          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default DepartmentList;
