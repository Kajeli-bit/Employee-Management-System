
import { useAuth } from "../../context/useAuth";
import { roleLabel } from "../../utils/roles";

const Navbar = () => {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-14 items-center justify-between gap-3 bg-brand-700 px-4 text-white sm:h-16 sm:px-6">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">
          Welcome, {user?.name}
        </p>
        <p className="truncate text-[11px] text-brand-100">
          {roleLabel(user?.role)}
          {user?.designation ? ` · ${user.designation}` : ""}
        </p>
      </div>

      <button
        type="button"
        className="shrink-0 rounded bg-brand-900/40 px-3 py-1.5 text-xs font-medium transition hover:bg-brand-900/70 sm:px-4 sm:text-sm"
        onClick={logout}
      >
        Sign out
      </button>
    </div>
  );
};

export default Navbar;
