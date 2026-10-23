import { useLocation } from "react-router-dom";

export const ADMIN_WORKSPACE = "/admin-dashboard";
export const SELF_WORKSPACE = "/employee-dashboard";

// The personal pages (my dashboard, attendance and leaves) are mounted twice:
// under /admin-dashboard/my for managers using the management console, and
// under /employee-dashboard for workers. Links inside those pages follow
// whichever shell is open, so a manager is never thrown into the worker portal
// halfway through a task.
export const useWorkspace = () => {
  const { pathname } = useLocation();
  const inAdmin = pathname.startsWith(ADMIN_WORKSPACE);

  if (inAdmin) {
    const base = `${ADMIN_WORKSPACE}/my`;

    return {
      inAdmin,
      home: base,
      attendance: `${base}/attendance`,
      leaves: `${base}/leaves`,
      applyLeave: `${base}/apply-leave`,
      editLeave: (id) => `${base}/leaves/${id}/edit`,
      organisation: `${ADMIN_WORKSPACE}/organisation`,
    };
  }

  return {
    inAdmin,
    home: SELF_WORKSPACE,
    attendance: `${SELF_WORKSPACE}/attendance`,
    leaves: `${SELF_WORKSPACE}/my-leaves`,
    applyLeave: `${SELF_WORKSPACE}/apply-leave`,
    editLeave: (id) => `${SELF_WORKSPACE}/edit-leave/${id}`,
    organisation: `${SELF_WORKSPACE}/organisation`,
  };
};
