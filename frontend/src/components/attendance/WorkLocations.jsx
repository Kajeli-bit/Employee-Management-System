import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  FaCheck,
  FaChevronDown,
  FaClock,
  FaCrosshairs,
  FaExternalLinkAlt,
  FaMapMarkerAlt,
  FaPlus,
  FaSearch,
  FaTimes,
} from "react-icons/fa";

import { LocationMap, LocationSearch } from "./LocationPicker";
import useLocationPicker from "./useLocationPicker";
import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";
import Loader from "../common/Loader";
import { CAPABILITIES, hasCapability } from "../../utils/roles";

const emptyLocation = {
  _id: null,
  name: "",
  address: "",
  latitude: "",
  longitude: "",
  radiusMeters: 250,
  isPrimary: false,
  isActive: true,
};

const sortOptions = {
  name: {
    label: "Name, A to Z",
    compare: (a, b) => (a.name || "").localeCompare(b.name || ""),
  },
  "radius-desc": {
    label: "Radius, largest first",
    compare: (a, b) => Number(b.radiusMeters) - Number(a.radiusMeters),
  },
  "radius-asc": {
    label: "Radius, smallest first",
    compare: (a, b) => Number(a.radiusMeters) - Number(b.radiusMeters),
  },
  "head-office": {
    label: "Head office first",
    compare: (a, b) =>
      Number(b.isPrimary) - Number(a.isPrimary) ||
      (a.name || "").localeCompare(b.name || ""),
  },
};

const fieldClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-500";
const monoFieldClass = `${fieldClass} font-mono tabular-nums`;
const compactFieldClass =
  "w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-500";
const compactMonoFieldClass = `${compactFieldClass} font-mono tabular-nums`;

// Draws the geofence as a dashed ring around a pin. The ring is a sketch of
// the fence, not a scaled map, so larger radii grow it only up to a cap.
const FenceGlyph = ({ radius, active }) => {
  const ring = Math.min(34, Math.max(12, 8 + Number(radius) / 22));

  return (
    <div
      aria-hidden="true"
      className="grid h-20 w-20 shrink-0 place-items-center rounded-xl border border-slate-200"
      style={{
        backgroundImage: "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
        backgroundSize: "10px 10px",
      }}
    >
      <svg viewBox="0 0 80 80" className="h-20 w-20 overflow-visible">
        <circle
          cx="40"
          cy="40"
          r={ring}
          strokeWidth="1.5"
          strokeDasharray="4 3"
          className={active ? "fill-brand-100 stroke-brand-600" : "fill-slate-100 stroke-slate-400"}
        />
        <circle
          cx="40"
          cy="40"
          r="3.5"
          className={active ? "fill-brand-700" : "fill-slate-400"}
        />
      </svg>
    </div>
  );
};

const Toggle = ({ label, description, checked, onChange, disabled }) => (
  <label
    className={`flex items-start gap-3 ${
      disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
    }`}
  >
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      className="peer sr-only"
    />
    <span
      aria-hidden="true"
      className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full bg-slate-300 transition after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition after:content-[''] peer-checked:bg-brand-700 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-300 peer-focus-visible:ring-offset-2"
    />
    <span className="min-w-0">
      <span className="block text-sm font-medium text-slate-800">{label}</span>
      {description && (
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">
          {description}
        </span>
      )}
    </span>
  </label>
);

const LocationCard = ({ location, canManage, onEdit, onDeactivate, onReactivate }) => (
  <article
    className={`flex gap-4 rounded-2xl border p-4 transition ${
      location.isActive
        ? "border-slate-200 bg-white hover:border-brand-200 hover:shadow-sm"
        : "border-dashed border-slate-300 bg-slate-50"
    }`}
  >
    <FenceGlyph radius={location.radiusMeters} active={location.isActive} />

    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <h3
          className={`min-w-0 truncate text-base font-semibold ${
            location.isActive ? "text-slate-900" : "text-slate-500"
          }`}
        >
          {location.name}
        </h3>
        {location.isPrimary && (
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800 ring-1 ring-inset ring-brand-200">
            Head office
          </span>
        )}
        {!location.isActive && (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
            Inactive
          </span>
        )}
      </div>

      <p className="mt-1 text-sm leading-5 text-slate-500">
        {location.address || "No address recorded"}
      </p>

      <dl className="mt-3 grid grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-xl bg-slate-50 text-xs">
        <div className="px-3 py-2">
          <dt className="text-slate-500">Radius</dt>
          <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900">
            {location.radiusMeters} m
          </dd>
        </div>
        <div className="px-3 py-2">
          <dt className="text-slate-500">Latitude</dt>
          <dd className="mt-0.5 font-mono text-sm tabular-nums text-slate-700">
            {Number(location.latitude).toFixed(5)}
          </dd>
        </div>
        <div className="px-3 py-2">
          <dt className="text-slate-500">Longitude</dt>
          <dd className="mt-0.5 font-mono text-sm tabular-nums text-slate-700">
            {Number(location.longitude).toFixed(5)}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-sm font-medium">
        <a
          href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-slate-600 transition hover:text-brand-700"
        >
          Open in maps
          <FaExternalLinkAlt className="text-[10px]" />
        </a>

        {canManage && location.isActive && (
          <>
            <button
              type="button"
              onClick={() => onEdit(location)}
              className="text-brand-700 transition hover:text-brand-900"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDeactivate(location)}
              className="text-rose-600 transition hover:text-rose-800"
            >
              Deactivate
            </button>
          </>
        )}

        {canManage && !location.isActive && (
          <button
            type="button"
            onClick={() => onReactivate(location)}
            className="text-brand-700 transition hover:text-brand-900"
          >
            Reactivate
          </button>
        )}
      </div>
    </div>
  </article>
);

const WorkLocations = () => {
  const { user, getToken } = useAuth();

  const [locations, setLocations] = useState([]);
  const [policy, setPolicy] = useState({
    workStart: "08:00",
    workEnd: "17:00",
    graceMinutes: 15,
    halfDayMinutes: 240,
    requireGeofence: true,
  });
  const [form, setForm] = useState(emptyLocation);
  const [editing, setEditing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [policyOpen, setPolicyOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef(null);

  const locationPicker = useLocationPicker({
    onPoint: (latitude, longitude) =>
      setForm((current) => ({ ...current, latitude, longitude })),
    onAddress: (address, overwrite) =>
      setForm((current) =>
        overwrite || !(current.address || "").trim()
          ? { ...current, address }
          : current
      ),
  });

  const canManageLocations = hasCapability(
    user?.role,
    CAPABILITIES.LOCATIONS_MANAGE
  );
  const canManagePolicy = hasCapability(
    user?.role,
    CAPABILITIES.SETTINGS_MANAGE
  );

  const load = useCallback(async () => {
    try {
      const token = await getToken();

      if (!token) {
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      const [locationResponse, policyResponse] = await Promise.all([
        axios.get(`${API_URL}/api/locations`, {
          headers,
          params: { includeInactive: "true" },
        }),
        axios.get(`${API_URL}/api/locations/policy`, { headers }),
      ]);

      if (locationResponse.data.success) {
        setLocations(locationResponse.data.locations || []);
      }

      if (policyResponse.data.success) {
        setPolicy((current) => ({
          ...current,
          ...policyResponse.data.policy,
        }));
      }
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error.response?.data?.error ||
          "Unable to load work locations.",
      });
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (getToken) {
      load();
    }
  }, [getToken, load]);

  useEffect(() => {
    if (!sortOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (sortRef.current && !sortRef.current.contains(event.target)) {
        setSortOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSortOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [sortOpen]);

  const closeLocationForm = useCallback(() => {
    setEditing(false);
    setForm(emptyLocation);
  }, []);

  const openLocationForm = (location = emptyLocation) => {
    setMessage(null);
    setForm(location);
    setEditing(true);
  };

  useEffect(() => {
    if (!policyOpen && !editing) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setPolicyOpen(false);
        closeLocationForm();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [policyOpen, editing, closeLocationForm]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage({
        type: "error",
        text: "This browser cannot read your location.",
      });
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setLocating(false);
      },
      () => {
        setLocating(false);
        setMessage({
          type: "error",
          text: "Could not read your location. Allow location access and retry.",
        });
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const submitLocation = async (event) => {
    event.preventDefault();

    try {
      const token = await getToken();

      const payload = {
        ...form,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        radiusMeters: Number(form.radiusMeters),
      };

      const response = form._id
        ? await axios.put(`${API_URL}/api/locations/${form._id}`, payload, {
            headers: { Authorization: `Bearer ${token}` },
          })
        : await axios.post(`${API_URL}/api/locations`, payload, {
            headers: { Authorization: `Bearer ${token}` },
          });

      if (response.data.success) {
        setMessage({ type: "success", text: response.data.message });
        setForm(emptyLocation);
        setEditing(false);
        await load();
      }
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error.response?.data?.error || "Unable to save the work location.",
      });
    }
  };

  const deactivate = async (location) => {
    if (
      !window.confirm(
        `Deactivate ${location.name}? Employees will no longer be able to clock in there.`
      )
    ) {
      return;
    }

    try {
      const token = await getToken();

      await axios.delete(`${API_URL}/api/locations/${location._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      await load();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error.response?.data?.error ||
          "Unable to deactivate the work location.",
      });
    }
  };

  const reactivate = async (location) => {
    try {
      const token = await getToken();

      await axios.put(
        `${API_URL}/api/locations/${location._id}`,
        {
          ...location,
          isActive: true,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      await load();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Unable to reactivate.",
      });
    }
  };

  const savePolicy = async (event) => {
    event.preventDefault();

    try {
      setSavingPolicy(true);

      const token = await getToken();

      const response = await axios.put(
        `${API_URL}/api/locations/policy`,
        policy,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setPolicy((current) => ({ ...current, ...response.data.policy }));
        setMessage({ type: "success", text: response.data.message });
        setPolicyOpen(false);
      }
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error.response?.data?.error || "Unable to update the policy.",
      });
    } finally {
      setSavingPolicy(false);
    }
  };

  const visibleLocations = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return locations
      .filter(
        (location) =>
          !needle ||
          [location.name, location.address].some((value) =>
            (value || "").toLowerCase().includes(needle)
          )
      )
      .sort(sortOptions[sortKey].compare);
  }, [locations, query, sortKey]);

  if (loading) {
    return (
      <Loader label="Loading work locations…" />
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-10 sm:px-6">
      <header className="flex items-center gap-4 border-b border-slate-200 pb-6">
        <span
          aria-hidden="true"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-700 text-lg text-white shadow-sm"
        >
          <FaMapMarkerAlt />
        </span>
        <h1 className="font-display text-4xl font-medium tracking-tight text-brand-950">
          Work locations
        </h1>
      </header>

      {message && (
        <p
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {message.text}
        </p>
      )}

      {editing && canManageLocations && (
        <div className="fixed inset-0 top-14 z-50 flex items-center justify-center bg-slate-900/40 p-4 lg:top-0 lg:left-64">
        <form
          role="dialog"
          aria-modal="true"
          aria-labelledby="location-form-title"
          onSubmit={submitLocation}
          className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl lg:h-[min(46.5rem,calc(100vh-2rem))] lg:max-h-none lg:overflow-hidden"
        >
          <div className="flex items-start justify-between gap-4">
            <h2
              id="location-form-title"
              className="text-lg font-semibold text-slate-900"
            >
              {form._id ? "Edit location" : "New location"}
            </h2>
            <button
              type="button"
              onClick={closeLocationForm}
              aria-label="Close location form"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              <FaTimes className="text-sm" />
            </button>
          </div>

          {message?.type === "error" && (
            <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {message.text}
            </p>
          )}

          <div>
            <LocationSearch picker={locationPicker} />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3">
          <LocationMap
            picker={locationPicker}
            latitude={form.latitude}
            longitude={form.longitude}
            radiusMeters={form.radiusMeters}
          />

          <div className="grid shrink-0 gap-3 sm:grid-cols-2">
            <label className="text-xs">
              <span className="mb-0.5 block font-medium text-slate-600">
                Location name
              </span>
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                required
                placeholder="Nilric Head Office"
                className={compactFieldClass}
              />
            </label>

            <label className="text-xs">
              <span className="mb-0.5 block font-medium text-slate-600">
                Radius (metres)
              </span>
              <input
                type="number"
                min="25"
                max="10000"
                value={form.radiusMeters}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    radiusMeters: event.target.value,
                  }))
                }
                required
                className={compactMonoFieldClass}
              />
            </label>

            <label className="text-xs sm:col-span-2">
              <span className="mb-0.5 block font-medium text-slate-600">
                Address
              </span>
              <input
                value={form.address}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    address: event.target.value,
                  }))
                }
                placeholder="Plot 163/129, Samora Avenue, Dar es Salaam"
                className={compactFieldClass}
              />
            </label>

            <label className="text-xs">
              <span className="mb-0.5 block font-medium text-slate-600">
                Latitude
              </span>
              <input
                value={form.latitude}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    latitude: event.target.value,
                  }))
                }
                required
                inputMode="decimal"
                className={compactMonoFieldClass}
              />
            </label>

            <label className="text-xs">
              <span className="mb-0.5 block font-medium text-slate-600">
                Longitude
              </span>
              <input
                value={form.longitude}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    longitude: event.target.value,
                  }))
                }
                required
                inputMode="decimal"
                className={compactMonoFieldClass}
              />
            </label>
          </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={useCurrentLocation}
                disabled={locating}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FaCrosshairs />
                {locating ? "Reading…" : "Use my current location"}
              </button>

              <Toggle
                label="Head office"
                checked={form.isPrimary}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    isPrimary: event.target.checked,
                  }))
                }
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeLocationForm}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800"
              >
                Save location
              </button>
            </div>
          </div>
        </form>
        </div>
      )}

      <div className={`mt-6 grid grid-cols-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white ${canManageLocations ? "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.6fr)_auto_auto]" : "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.6fr)_auto]"} lg:divide-x lg:divide-y-0`}>
        <label className="col-span-2 flex min-w-0 flex-col px-5 py-2.5 transition focus-within:bg-brand-50/60 lg:col-span-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            Search
          </span>
          <span className="relative mt-1 block">
            <FaSearch
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-0 -translate-y-1/2 text-xs text-slate-400"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name or address"
              className="no-focus-outline block h-6 w-full bg-transparent pl-5 text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
            />
          </span>
        </label>

        <div ref={sortRef} className="relative flex min-w-0 flex-col px-5 py-2.5 transition focus-within:bg-brand-50/60">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            Sort by
          </span>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={sortOpen}
            onClick={() => setSortOpen((open) => !open)}
            className="no-focus-outline mt-1 flex h-6 w-full min-w-0 items-center justify-between gap-2 bg-transparent text-left text-sm font-semibold text-slate-900 outline-none transition hover:text-brand-700"
          >
            <span className="truncate">{sortOptions[sortKey].label}</span>
            <FaChevronDown
              aria-hidden="true"
              className={`shrink-0 text-[10px] text-slate-400 transition duration-200 ${
                sortOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {sortOpen && (
            <ul
              role="menu"
              aria-label="Sort sites"
              className="absolute top-full left-0 z-30 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_40px_-12px_rgba(55,25,85,0.28)] ring-1 ring-brand-100/70"
            >
              {Object.entries(sortOptions).map(([key, option]) => {
                const selected = key === sortKey;

                return (
                  <li key={key}>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      onClick={() => {
                        setSortKey(key);
                        setSortOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                        selected
                          ? "bg-brand-50 font-semibold text-brand-800"
                          : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      {option.label}
                      {selected && (
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-700 text-[9px] text-white">
                          <FaCheck />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-5 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            Sites
          </p>
          <p className="mt-1 font-mono text-2xl leading-none font-semibold tabular-nums text-slate-900">
            {visibleLocations.length}
            {visibleLocations.length !== locations.length && (
              <span className="ml-1.5 text-sm font-medium text-slate-400">
                of {locations.length}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center px-4 py-2.5">
          <button
            type="button"
            onClick={() => setPolicyOpen(true)}
            className="inline-flex h-12 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
          >
            <FaClock className="text-xs" />
            Attendance policy
          </button>
        </div>

        {canManageLocations && (
          <div className="flex items-center px-4 py-2.5">
            <button
              type="button"
              onClick={() => openLocationForm()}
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800"
            >
              <FaPlus className="text-xs" />
              Add location
            </button>
          </div>
        )}
      </div>

      {locations.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="font-medium text-slate-800">No work locations yet</p>
          <p className="mt-1 text-sm text-slate-500">
            {canManageLocations
              ? "Add the head office first so office staff can clock in."
              : "Ask an administrator to add a work location."}
          </p>
        </div>
      ) : visibleLocations.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="font-medium text-slate-800">
            No sites match “{query.trim()}”
          </p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 transition hover:text-brand-900"
          >
            <FaTimes className="text-[10px]" />
            Clear search
          </button>
        </div>
      ) : (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {visibleLocations.map((location) => (
            <LocationCard
              key={location._id}
              location={location}
              canManage={canManageLocations}
              onEdit={openLocationForm}
              onDeactivate={deactivate}
              onReactivate={reactivate}
            />
          ))}
        </div>
      )}

      {policyOpen && (
        <div
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPolicyOpen(false);
            }
          }}
          className="fixed inset-0 top-14 z-50 flex items-center justify-center bg-slate-900/40 p-4 lg:top-0 lg:left-64"
        >
        <form
          role="dialog"
          aria-modal="true"
          aria-labelledby="attendance-policy-title"
          onSubmit={savePolicy}
          className="max-h-[90vh] w-full max-w-[702px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id="attendance-policy-title"
                className="text-lg font-semibold text-slate-900"
              >
                Attendance policy
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Applies to every employee in the company
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPolicyOpen(false)}
              aria-label="Close attendance policy"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              <FaTimes className="text-sm" />
            </button>
          </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-800">Working hours</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-600">
                  Work starts
                </span>
                <input
                  type="time"
                  value={policy.workStart}
                  onChange={(event) =>
                    setPolicy((current) => ({
                      ...current,
                      workStart: event.target.value,
                    }))
                  }
                  disabled={!canManagePolicy}
                  className={monoFieldClass}
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-600">
                  Work ends
                </span>
                <input
                  type="time"
                  value={policy.workEnd}
                  onChange={(event) =>
                    setPolicy((current) => ({
                      ...current,
                      workEnd: event.target.value,
                    }))
                  }
                  disabled={!canManagePolicy}
                  className={monoFieldClass}
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-800">Allowances</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-600">
                  Grace period (min)
                </span>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={policy.graceMinutes}
                  onChange={(event) =>
                    setPolicy((current) => ({
                      ...current,
                      graceMinutes: event.target.value,
                    }))
                  }
                  disabled={!canManagePolicy}
                  className={monoFieldClass}
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-600">
                  Half day under (min)
                </span>
                <input
                  type="number"
                  min="0"
                  max="720"
                  value={policy.halfDayMinutes}
                  onChange={(event) =>
                    setPolicy((current) => ({
                      ...current,
                      halfDayMinutes: event.target.value,
                    }))
                  }
                  disabled={!canManagePolicy}
                  className={monoFieldClass}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
          <Toggle
            label="Require a geofence match for office staff"
            description="Office staff must be inside a fence to clock in. Field and remote staff are always recorded without a match."
            checked={policy.requireGeofence}
            onChange={(event) =>
              setPolicy((current) => ({
                ...current,
                requireGeofence: event.target.checked,
              }))
            }
            disabled={!canManagePolicy}
          />

          {canManagePolicy && (
            <button
              type="submit"
              disabled={savingPolicy}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {savingPolicy ? "Saving…" : "Save policy"}
            </button>
          )}
        </div>
        </form>
        </div>
      )}
    </div>
  );
};

export default WorkLocations;
