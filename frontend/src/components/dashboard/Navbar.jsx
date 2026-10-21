
import { useAuth } from "../../context/useAuth";
import { roleLabel } from "../../utils/roles";

const Navbar = () => {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-16 items-center justify-between gap-4 bg-brand-700 px-6 text-white">
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
        className="shrink-0 rounded bg-brand-900/40 px-4 py-1.5 text-sm font-medium transition hover:bg-brand-900/70"
        onClick={logout}
      >
        Sign out
      </button>
    </div>
  );
};

export default Navbar;
