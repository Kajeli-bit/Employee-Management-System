
import axios from "axios";
import {
  createContext,
  useEffect,
  useState,
} from "react";

import {
  useAuth as useClerkAuth,
  useClerk,
} from "@clerk/react";

import API_URL from "../api";

export const userContext = createContext();

const INACTIVITY_TIMEOUT = 5 * 60 * 1000;

const TAB_SESSION_KEY = "ems_tab_session";

const AuthContext = ({ children }) => {
  const {
    isLoaded,
    isSignedIn,
    getToken,
  } = useClerkAuth();

  const { signOut } = useClerk();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const verifyUser = async () => {
      if (!isLoaded) {
        return;
      }

      const registrationInProgress =
        sessionStorage.getItem(
          "ems_registration_in_progress"
        ) === "true";

      if (registrationInProgress) {
        if (!cancelled) {
          setLoading(false);
        }

        return;
      }

      if (!isSignedIn) {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }

        return;
      }

      try {
        sessionStorage.setItem(
          TAB_SESSION_KEY,
          "active"
        );

        const token = await getToken();

        if (!token) {
          if (!cancelled) {
            setUser(null);
            setLoading(false);
          }

          return;
        }

        const response = await axios.get(
          `${API_URL}/api/auth/verify`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (
          !cancelled &&
          response.data.success
        ) {
          setUser(response.data.user);
        }
      } catch (error) {
        console.log(
          "VERIFY USER ERROR:",
          error.response?.status,
          error.response?.data ||
            error.message
        );

        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    verifyUser();

    return () => {
      cancelled = true;
    };
  }, [
    isLoaded,
    isSignedIn,
    getToken,
  ]);

  const login = (userData) => {
    sessionStorage.setItem(
      TAB_SESSION_KEY,
      "active"
    );

    setUser(userData);
    setLoading(false);
  };

  const logout = async () => {
    try {
      sessionStorage.removeItem(
        "ems_registration_in_progress"
      );

      sessionStorage.removeItem(
        TAB_SESSION_KEY
      );

      await signOut();

      setUser(null);
      setLoading(false);
    } catch (error) {
      console.log(
        "LOGOUT ERROR:",
        error
      );
    }
  };

  useEffect(() => {
    if (
      !isLoaded ||
      !isSignedIn ||
      !user
    ) {
      return;
    }

    let inactivityTimer;

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);

      inactivityTimer = setTimeout(() => {
        logout();
      }, INACTIVITY_TIMEOUT);
    };

    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "click",
    ];

    activityEvents.forEach((event) => {
      window.addEventListener(
        event,
        resetInactivityTimer
      );
    });

    resetInactivityTimer();

    return () => {
      clearTimeout(inactivityTimer);

      activityEvents.forEach((event) => {
        window.removeEventListener(
          event,
          resetInactivityTimer
        );
      });
    };
  }, [
    isLoaded,
    isSignedIn,
    user,
  ]);

  return (
    <userContext.Provider
      value={{
        user,
        login,
        logout,
        loading,
        getToken,
      }}
    >
      {children}
    </userContext.Provider>
  );
};

export default AuthContext;

