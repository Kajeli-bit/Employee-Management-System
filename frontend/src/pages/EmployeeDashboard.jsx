import Sidebar from "../components/EmployeeDashboard/Sidebar";
import { Outlet } from "react-router-dom";

const EmployeeDashboard = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-brand-50 to-violet-50">

      

      <div className="pointer-events-none fixed inset-0 overflow-hidden">

        {/* Top left glow */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand-300/20 blur-3xl" />

        {/* Top right glow */}
        <div className="absolute -top-40 right-0 w-[500px] h-[500px] rounded-full bg-violet-300/20 blur-3xl" />

        {/* Bottom right glow */}
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-brand-300/20 blur-3xl" />

        {/* Bottom left glow */}
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-blue-300/10 blur-3xl" />

        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(#63358b 1px, transparent 1px), linear-gradient(90deg, #63358b 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

      </div>

      

      <div className="relative z-30">
        <Sidebar />
      </div>

      

      <main className="relative z-20 min-h-screen pt-14 lg:ml-64 lg:pt-0">
        <Outlet />
      </main>

    </div>
  );
};

export default EmployeeDashboard;