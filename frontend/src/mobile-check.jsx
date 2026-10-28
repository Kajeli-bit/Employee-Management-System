import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import AdminSidebar from "./components/dashboard/AdminSidebar";
import Navbar from "./components/dashboard/Navbar";
import { userContext } from "./context/userContext";

const mockAuth = {
  user: {
    name: "Hmtani",
    role: "admin",
    designation: "HR Officer",
  },
  getToken: async () => "mock-token",
  logout: () => console.log("sign out clicked"),
};

// TEMPORARY mobile-responsiveness harness (delete after verification):
// mounts the real admin sidebar + shell at small viewports without auth.
if (import.meta.env.DEV) {
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <BrowserRouter>
        <userContext.Provider value={mockAuth}>
          <div className="min-h-screen bg-brand-50/60">
            <AdminSidebar />
            <div className="min-h-screen pt-14 lg:ml-64 lg:pt-0">
              <div className="p-3 pt-3 sm:p-4 sm:pt-4">
                <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-xl backdrop-blur-xl">
                  <Navbar />
                  <div className="p-5">
                    <h1 className="text-xl font-semibold text-slate-900">
                      Employee Management
                    </h1>
                    <p className="text-sm text-slate-500">
                      Mobile shell check — use the hamburger to open the drawer.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </userContext.Provider>
      </BrowserRouter>
    </StrictMode>
  );
}
