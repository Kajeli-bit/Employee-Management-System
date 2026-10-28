import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

const results = [];
const check = (label, condition) => {
  results.push({ label, ok: Boolean(condition) });
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
};

const user = (role) => ({ _id: "u1", name: "Test Person", role });

try {
  const { userContext } = await server.ssrLoadModule(
    "/src/context/authContext.jsx"
  );
  const { default: RoleBaseRoutes } = await server.ssrLoadModule(
    "/src/utils/RoleBaseRoutes.jsx"
  );
  const { default: AdminSidebar } = await server.ssrLoadModule(
    "/src/components/dashboard/AdminSidebar.jsx"
  );
  const { default: WorkerSidebar } = await server.ssrLoadModule(
    "/src/components/EmployeeDashboard/Sidebar.jsx"
  );

  const render = (node, role, path = "/") =>
    renderToStaticMarkup(
      React.createElement(
        userContext.Provider,
        { value: { user: user(role), loading: false, logout: () => {} } },
        React.createElement(
          MemoryRouter,
          { initialEntries: [path] },
          node
        )
      )
    );

  const guarded = (access, role) =>
    render(
      React.createElement(
        RoleBaseRoutes,
        { access },
        React.createElement("p", null, "PORTAL")
      ),
      role
    );

  // Routing: the worker portal is open to everyone, including MD and HR.
  check("worker reaches the worker portal", guarded("self", "worker").includes("PORTAL"));
  check("HR reaches the worker portal", guarded("self", "hr").includes("PORTAL"));
  check("MD reaches the worker portal", guarded("self", "managing_director").includes("PORTAL"));

  // Routing: the management console is MD + HR only.
  check("HR reaches the management console", guarded("management", "hr").includes("PORTAL"));
  check("MD reaches the management console", guarded("management", "managing_director").includes("PORTAL"));
  check("worker is redirected away from the console", !guarded("management", "worker").includes("PORTAL"));

  // Retired role keys keep their new workspace.
  check("legacy department manager lands in the console", guarded("management", "department_manager").includes("PORTAL"));
  check("legacy team lead lands in the worker portal", !guarded("management", "team_lead").includes("PORTAL") && guarded("self", "team_lead").includes("PORTAL"));

  // Sidebars
  const admin = render(React.createElement(AdminSidebar), "hr");
  check(
    "HR console exposes people, leave approvals and attendance",
    ["Staff Management", "Leave requests", "Team attendance", "Work locations", "Departments"].every((label) => admin.includes(label))
  );
  check(
    "the management sidebar does not link to Salary",
    !admin.includes("Salary") && !admin.includes("/admin-dashboard/salary")
  );
  check(
    "the console has a My workspace group with every personal page",
    [
      "My workspace",
      "My dashboard",
      "My attendance",
      "My leaves",
    ].every((label) => admin.includes(label))
  );
  check(
    "personal links stay inside the console",
    !admin.includes("/employee-dashboard") &&
      [
        "/admin-dashboard/my",
        "/admin-dashboard/my/attendance",
        "/admin-dashboard/my/leaves",
      ].every((href) => admin.includes(`href="${href}"`))
  );
  // Leave requests are started from the leaves page, so the nav no longer
  // carries its own apply link.
  check(
    "the console sidebar has no apply-for-leave link",
    !admin.includes("/admin-dashboard/my/apply-leave") &&
      !admin.includes("Apply for leave")
  );
  check(
    "the account block opens login and security",
    admin.includes('href="/admin-dashboard/settings"') &&
      admin.includes("Login and security — change your sign-in email")
  );
  check(
    "salary, profile and account pages are gone from the console",
    !admin.includes("My salary") &&
      !admin.includes("My profile") &&
      !admin.includes("Account") &&
      !admin.includes("/my/salary") &&
      !admin.includes("/my/profile") &&
      !admin.includes("/account")
  );

  const mdConsole = render(React.createElement(AdminSidebar), "managing_director");
  check(
    "the MD sees the same workspace",
    mdConsole.includes("My workspace") && mdConsole.includes("href=\"/admin-dashboard/my/attendance\"")
  );

  // Every personal page resolves its links to the shell it is opened in.
  const { useWorkspace } = await server.ssrLoadModule("/src/utils/workspace.js");
  const WorkspaceProbe = () => {
    const workspace = useWorkspace();

    return React.createElement(
      "p",
      null,
      [
        workspace.home,
        workspace.attendance,
        workspace.leaves,
        workspace.applyLeave,
        workspace.organisation,
        workspace.editLeave("abc"),
      ].join("|")
    );
  };

  const consolePaths = render(
    React.createElement(WorkspaceProbe),
    "hr",
    "/admin-dashboard/my/leaves"
  );
  const portalPaths = render(
    React.createElement(WorkspaceProbe),
    "worker",
    "/employee-dashboard/my-leaves"
  );

  check(
    "inside the console, workspace links point at console routes",
    consolePaths.includes(
      "/admin-dashboard/my|/admin-dashboard/my/attendance|/admin-dashboard/my/leaves|/admin-dashboard/my/apply-leave|/admin-dashboard/organisation|/admin-dashboard/my/leaves/abc/edit"
    )
  );
  check(
    "inside the worker portal, the same links stay there",
    portalPaths.includes(
      "/employee-dashboard|/employee-dashboard/attendance|/employee-dashboard/my-leaves|/employee-dashboard/apply-leave|/employee-dashboard/organisation|/employee-dashboard/edit-leave/abc"
    )
  );

  const { default: EmployeeSummary } = await server.ssrLoadModule(
    "/src/components/EmployeeDashboard/EmployeeSummary.jsx"
  );
  const managerHome = render(
    React.createElement(EmployeeSummary),
    "hr",
    "/admin-dashboard/my"
  );
  check(
    "the manager's dashboard links to their own console pages",
    managerHome.includes('href="/admin-dashboard/my/attendance"') &&
      managerHome.includes('href="/admin-dashboard/my/apply-leave"') &&
      managerHome.includes('href="/admin-dashboard/organisation"')
  );
  check(
    "the dashboard no longer offers salary or profile cards",
    !managerHome.includes("Payslips and history") &&
      !managerHome.includes("Contact and employment record")
  );

  const { default: MyLeaves } = await server.ssrLoadModule(
    "/src/components/EmployeeDashboard/MyLeaves.jsx"
  );
  const { default: ApplyLeave } = await server.ssrLoadModule(
    "/src/components/EmployeeDashboard/ApplyLeave.jsx"
  );

  const leavesPage = render(
    React.createElement(MyLeaves),
    "hr",
    "/admin-dashboard/my/leaves"
  );
  check(
    "the leave page has a status strip, sort controls and an apply button",
    [
      "My leave requests",
      "All requests",
      "Pending",
      "Approved",
      "Rejected",
      "All leave types",
      "Newest first",
      "Oldest first",
      "Apply for leave",
    ].every((label) => leavesPage.includes(label))
  );
  check(
    "the leave table keeps its frame while loading",
    ["Leave type", "Dates", "Days", "Reason", "Status", "Action"].every(
      (label) => leavesPage.includes(label)
    )
  );

  const leaveForm = render(
    React.createElement(ApplyLeave),
    "hr",
    "/employee-dashboard/apply-leave"
  );
  check(
    "the leave form offers the four leave types",
    ["Casual Leave", "Sick Leave", "Annual Leave", "Emergency Leave"].every(
      (type) => leaveForm.includes(type)
    )
  );
  check(
    "the leave form submits as Send request",
    leaveForm.includes("Send request")
  );

  const workerNav = render(React.createElement(WorkerSidebar), "worker");
  check(
    "worker portal shows the remaining pages",
    ["Dashboard", "My attendance", "My leaves", "Organisation", "Settings"].every((label) => workerNav.includes(label))
  );
  check(
    "worker portal sidebar has no apply-for-leave link",
    !workerNav.includes("Apply for leave")
  );
  check(
    "worker portal no longer offers salary or profile",
    !workerNav.includes("My salary") && !workerNav.includes("My profile")
  );
  check("worker portal hides the management console", !workerNav.includes("Management console"));
  check("worker portal has no admin links", !workerNav.includes(">Employees<"));

  const mdNav = render(React.createElement(WorkerSidebar), "managing_director");
  check("MD can jump back to the management console from the worker portal", mdNav.includes("Management console"));

  const failed = results.filter((entry) => !entry.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exitCode = failed.length === 0 ? 0 : 1;
} finally {
  await server.close();
}
