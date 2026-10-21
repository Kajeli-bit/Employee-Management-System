import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  FaCrosshairs,
  FaExternalLinkAlt,
  FaMapMarkerAlt,
  FaPlus,
} from "react-icons/fa";

import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";
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

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
        Loading work locations…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Work locations
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Check-in is accepted inside these GPS fences. Field and remote staff
            are recorded without a fence match.
          </p>
        </div>

        {canManageLocations && !editing && (
          <button
            type="button"
            onClick={() => {
              setForm(emptyLocation);
              setEditing(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
          >
            <FaPlus className="text-xs" />
            Add location
          </button>
        )}
      </div>

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
        <form
          onSubmit={submitLocation}
          className="mt-5 rounded-2xl border border-slate-200 bg-white p-5"
        >
          <h2 className="text-sm font-semibold text-slate-800">
            {form._id ? "Edit location" : "New location"}
          </h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">
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
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">
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
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-brand-500"
              />
            </label>

            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-600">
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
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">
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
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-brand-500"
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">
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
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-brand-500"
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locating}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
            >
              <FaCrosshairs />
              {locating ? "Reading…" : "Use my current location"}
            </button>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.isPrimary}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    isPrimary: event.target.checked,
                  }))
                }
                className="h-4 w-4"
              />
              Head office
            </label>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setForm(emptyLocation);
              }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
            >
              Save location
            </button>
          </div>
        </form>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {locations.map((location) => (
          <div
            key={location._id}
            className={`rounded-2xl border bg-white p-4 ${
              location.isActive
                ? "border-slate-200"
                : "border-dashed border-slate-300 opacity-70"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-semibold text-slate-900">
                  <FaMapMarkerAlt className="text-brand-700" />
                  {location.name}
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {location.address || "No address recorded"}
                </p>
              </div>

              <div className="flex flex-col items-end gap-1">
                {location.isPrimary && (
                  <span className="rounded bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    HQ
                  </span>
                )}
                {!location.isActive && (
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Inactive
                  </span>
                )}
              </div>
            </div>

            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-slate-500">
              <div className="flex gap-1">
                <dt>Radius</dt>
                <dd className="font-semibold text-slate-700">
                  {location.radiusMeters} m
                </dd>
              </div>
              <div className="flex gap-1">
                <dt>Lat</dt>
                <dd>{Number(location.latitude).toFixed(5)}</dd>
              </div>
              <div className="flex gap-1">
                <dt>Lng</dt>
                <dd>{Number(location.longitude).toFixed(5)}</dd>
              </div>
            </dl>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-semibold">
              <a
                href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-slate-500 hover:text-brand-700"
              >
                Open in maps <FaExternalLinkAlt className="text-[9px]" />
              </a>

              {canManageLocations && location.isActive && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setForm(location);
                      setEditing(true);
                    }}
                    className="text-brand-700 hover:underline"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => deactivate(location)}
                    className="text-rose-600 hover:underline"
                  >
                    Deactivate
                  </button>
                </>
              )}

              {canManageLocations && !location.isActive && (
                <button
                  type="button"
                  onClick={() => reactivate(location)}
                  className="text-brand-700 hover:underline"
                >
                  Reactivate
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={savePolicy}
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800">
            Attendance policy
          </h2>
          <p className="text-xs text-slate-400">
            Applies to every employee in the company
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-brand-500 disabled:bg-slate-50"
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
              className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-brand-500 disabled:bg-slate-50"
            />
          </label>

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
              className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-brand-500 disabled:bg-slate-50"
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
              className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-brand-500 disabled:bg-slate-50"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={policy.requireGeofence}
              onChange={(event) =>
                setPolicy((current) => ({
                  ...current,
                  requireGeofence: event.target.checked,
                }))
              }
              disabled={!canManagePolicy}
              className="h-4 w-4"
            />
            Require a geofence match for office staff
          </label>

          {canManagePolicy && (
            <button
              type="submit"
              disabled={savingPolicy}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-300"
            >
              {savingPolicy ? "Saving…" : "Save policy"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default WorkLocations;
