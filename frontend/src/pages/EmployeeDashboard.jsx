import Sidebar from "../components/EmployeeDashboard/Sidebar";
import { Outlet } from "react-router-dom";
import Navbar from "../components/dashboard/Navbar";
import AttendanceHeartbeat from "../components/attendance/AttendanceHeartbeat";

const EmployeeDashboard = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-brand-50 to-violet-50">

      {/* Reports the device position while a day is open, so a forgotten
          clock-out can be closed automatically. Renders nothing. */}
      <AttendanceHeartbeat />

      

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

      

      <div className="relative z-20 min-h-screen pt-14 lg:ml-64 lg:pt-0">

        {/* Navbar */}

        <div className="sticky top-14 z-30 px-3 pt-3 sm:px-4 sm:pt-4 lg:top-0">

          <div className="rounded-2xl shadow-lg border border-white/60 bg-white/80 backdrop-blur-xl overflow-hidden">

            <Navbar />

          </div>

        </div>

        

        <main className="p-4 md:p-6">

          <div className="relative min-h-[calc(100vh-120px)] rounded-3xl border border-white/70 bg-white/75 backdrop-blur-xl shadow-2xl overflow-hidden">

            {/* Decorative top gradient */}

            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand-500 via-violet-500 to-brand-400" />

            {/* Decorative glow inside content */}

            <div className="absolute -top-32 -right-32 w-72 h-72 rounded-full bg-brand-200/20 blur-3xl pointer-events-none" />

            <div className="absolute -bottom-32 -left-32 w-72 h-72 rounded-full bg-violet-200/20 blur-3xl pointer-events-none" />

            {/* Actual Page */}

            <div className="relative z-10 p-5 md:p-7 lg:p-8">

              <Outlet />

            </div>

          </div>

        </main>

      </div>

    </div>
  );
};

export default EmployeeDashboard;