import { useEffect, useState } from "react";
import Loader from "../common/Loader";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/useAuth";
import { Monogram } from "../../utils/DepartmentMonogram";
import API_URL from "../../api";

const ViewDepartment = () => {
  const { id } = useParams();
  const { getToken } = useAuth();

  const [department, setDepartment] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken) return;

    const load = async () => {
      try {
        const token = await getToken();

        if (!token) {
          return;
        }

        const response = await axios.get(
          `${API_URL}/api/department/${id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data.success) {
          setDepartment(response.data.department);
          setTeams(response.data.teams || []);
        }
      } catch (err) {
        setError(
          err.response?.data?.error || "Unable to load department."
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [getToken, id]);

  if (loading) {
    return <Loader label="Loading department…" />;
  }

  if (error || !department) {
    return (
      <div className="px-4 pb-10 pt-10 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <Link
            to="/admin-dashboard/departments"
            className="text-sm font-semibold text-brand-700 hover:text-brand-800"
          >
            &larr; Back to departments
          </Link>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">
              {error || "Department not found."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-10 pt-10 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/admin-dashboard/departments"
          className="text-sm font-semibold text-brand-700 hover:text-brand-800"
        >
          &larr; Back to departments
        </Link>

        <div className="mt-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <Monogram name={department.dep_name} size="lg" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                Department
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">
                {department.dep_name}
              </h2>
            </div>
          </div>

          {department.description && (
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {department.description}
            </p>
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Teams
            </h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {teams.length}{" "}
              {teams.length === 1 ? "team" : "teams"}
            </span>
          </div>

          {teams.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">
              No teams yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {teams.map((team) => (
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
        </div>
      </div>
    </div>
  );
};

export default ViewDepartment;
