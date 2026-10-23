import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaBars, FaTimes, FaSignOutAlt } from "react-icons/fa";

/**
 * Wraps dashboard navigation in a mobile drawer.
 *
 * - Mobile / tablet (< 1024px): a sticky logo bar with a hamburger opens a
 *   sliding drawer over a dimmed backdrop. Navigation closes it automatically.
 * - Desktop (>= 1024px): children render in the standard fixed rail.
 */
const DrawerShell = ({ children, onLogout, user, roleFooter, accountHref }) => {
  const [open, setOpen] = useState(false);

  // Close the drawer when any link or button inside it is used (covers nav
  // clicks, sign out, and the in-drawer close button). Kept as an event
  // listener so navigation, not an effect, drives the drawer state.
  const dismissOnAction = (event) => {
    if (event.target instanceof Element && event.target.closest("a, button")) {
      setOpen(false);
    }
  };

  // Escape closes; body scroll locks while the drawer is open.
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      {/* Mobile top bar (fixed so it survives ancestor overflow rules) */}
      <div className={"fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-brand-950/10 bg-white/90 px-4 shadow-sm backdrop-blur-md lg:hidden " + (open ? "pointer-events-none" : "")}>
        <img
          src="/nilric-logo.png"
          alt="Nilric General Traders"
          className="h-7 w-auto"
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="rounded-xl p-2 text-brand-950/70 transition hover:bg-brand-100 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 lg:hidden"
        >
          <FaBars size={20} />
        </button>
      </div>

      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-brand-950/55 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Drawer */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-64 max-w-[84vw] flex-col overflow-y-auto overscroll-contain border-r border-brand-950/10 bg-brand-50 text-brand-950 shadow-2xl transition-all duration-300 ease-out lg:translate-x-0 lg:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        onClickCapture={dismissOnAction}
      >
        {children}

        {/* Mobile-only footer: account summary + sign out */}
        {onLogout && (
          <div className="mt-auto flex items-center justify-between gap-3 border-t border-brand-950/10 bg-white px-4 py-3 lg:hidden">
            {accountHref ? (
              <Link
                to={accountHref}
                className="min-w-0 flex-1 rounded-lg px-1 py-1 transition hover:bg-brand-100"
              >
                <p className="truncate text-sm font-semibold text-brand-950">
                  {user?.name || "Signed in"}
                </p>
                {roleFooter && (
                  <p className="truncate text-[11px] text-brand-950/55">{roleFooter}</p>
                )}
              </Link>
            ) : (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-brand-950">
                  {user?.name || "Signed in"}
                </p>
                {roleFooter && (
                  <p className="truncate text-[11px] text-brand-950/55">{roleFooter}</p>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              aria-label="Sign out"
              className="shrink-0 rounded-lg p-2 text-brand-950/50 transition hover:bg-brand-100 hover:text-brand-950"
            >
              <FaSignOutAlt />
            </button>
          </div>
        )}

        {/* Close affordance inside the drawer */}
        {open && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="absolute right-2.5 top-2.5 z-10 rounded-lg p-2 text-brand-950/50 transition hover:bg-brand-100 hover:text-brand-950 lg:hidden"
          >
            <FaTimes size={15} />
          </button>
        )}
      </aside>
    </>
  );
};

export default DrawerShell;
