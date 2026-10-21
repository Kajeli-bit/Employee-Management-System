import { useNavigate } from "react-router-dom";

export const DepartmentViewButton = ({ DepId }) => {
  const navigate = useNavigate();

  return (
    <div className="flex space-x-3">
      <button
        className="
          px-4 py-2
          bg-brand-600
          text-white
          rounded-md
          cursor-pointer
          hover:bg-brand-700
          hover:scale-105
          hover:shadow-lg
          transition-all
          duration-300
        "
        onClick={() =>
          navigate(
            `/admin-dashboard/departments/view/${DepId}`
          )
        }
      >
        View
      </button>
    </div>
  );
};
