import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20";

// Used two ways: inside the departments-page dialog (onClose/onCreated
// provided) and standalone on the add-department route (falls back to
// navigating back to the departments page).
const AddDepartment = ({ onClose, onCreated } = {}) => {
  const inModal = typeof onClose === "function";

  const [department, setDepartment] = useState({
    dep_name: "",
    description: "",
  });

  const [teams, setTeams] = useState([""]);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { getToken } = useAuth();

  const handleChange = (e) => {
    const { name, value } = e.target;

    setDepartment((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleTeamChange = (index, value) => {
    setTeams((prev) => prev.map((team, i) => (i === index ? value : team)));
  };

  const addTeamField = () => {
    setTeams((prev) => [...prev, ""]);
  };

  const removeTeamField = (index) => {
    setTeams((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCancel = () => {
    if (inModal) {
      onClose();
    } else {
      navigate("/admin-dashboard/departments");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!department.dep_name.trim()) {
      setError("Department name is required.");
      return;
    }

    try {
      setLoading(true);

      const token = await getToken();

      if (!token) {
        setError("Authentication token not found. Please login again.");
        return;
      }

      const response = await axios.post(
        `${API_URL}/api/department/add`,
        {
          dep_name: department.dep_name.trim(),
          description: department.description.trim(),
          teams: teams.map((team) => team.trim()).filter(Boolean),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        if (typeof onCreated === "function") {
          onCreated(response.data);
        } else {
          navigate("/admin-dashboard/departments");
        }
      }
    } catch (err) {
      console.log(
        "ADD DEPARTMENT ERROR:",
        err.response?.status,
        err.response?.data || err.message
      );

      setError(
        err.response?.data?.error ||
          "Something went wrong while adding department"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={
        inModal
          ? "p-6 sm:p-8"
          : "mx-auto mt-10 w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="add-department-title"
            className="text-xl font-semibold text-slate-900"
          >
            Add department
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Departments group related teams together.
          </p>
        </div>

        {inModal && (
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Close"
            className="rounded-md px-2 py-1 text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            &times;
          </button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-5">
        <div>
          <label
            htmlFor="dep_name"
            className="text-sm font-medium text-slate-700"
          >
            Department Name
          </label>

          <input
            type="text"
            id="dep_name"
            name="dep_name"
            value={department.dep_name}
            onChange={handleChange}
            placeholder="Enter Department Name"
            autoFocus={inModal}
            className={inputClass}
            required
          />
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">
              Teams (optional)
            </span>
            <button
              type="button"
              onClick={addTeamField}
              className="text-sm font-semibold text-brand-700 hover:text-brand-800"
            >
              + Add team
            </button>
          </div>

          {teams.map((team, index) => (
            <div key={index} className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={team}
                onChange={(e) => handleTeamChange(index, e.target.value)}
                placeholder={`Team ${index + 1} name`}
                aria-label={`Team ${index + 1} name`}
                className={inputClass}
              />
              {teams.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTeamField(index)}
                  className="shrink-0 rounded-md px-2 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  Remove
                </button>
              )}
            </div>
          ))}

          <p className="mt-1 text-xs text-slate-500">
            Teams are registered together with the department.
          </p>
        </div>

        <div className="mt-5">
          <label
            htmlFor="description"
            className="block text-sm font-medium text-slate-700"
          >
            Description
          </label>

          <textarea
            id="description"
            name="description"
            value={department.description}
            placeholder="Enter Description"
            onChange={handleChange}
            className={inputClass}
            rows="3"
          />
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Adding..." : "Add department"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddDepartment;
