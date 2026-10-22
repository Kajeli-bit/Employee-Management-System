import { useEffect, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { FaMapMarkerAlt, FaSearch } from "react-icons/fa";

const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const DAR_ES_SALAAM = [-6.7924, 39.2083];
const FENCE_COLOR = "#63358b";

const pinIcon = L.divIcon({
  className: "",
  iconSize: [32, 40],
  iconAnchor: [16, 40],
  html: `<svg width="32" height="40" viewBox="0 0 32 40" aria-hidden="true"><path d="M16 0C7.2 0 0 7.1 0 15.9 0 27.4 16 40 16 40s16-12.6 16-24.1C32 7.1 24.8 0 16 0z" fill="${FENCE_COLOR}" stroke="#ffffff" stroke-width="2"/><circle cx="16" cy="16" r="5.5" fill="#ffffff"/></svg>`,
});

const fieldClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-500";

const isCoordinate = (value) =>
  value !== "" &&
  value !== null &&
  value !== undefined &&
  Number.isFinite(Number(value));

const hasPoint = (latitude, longitude) =>
  isCoordinate(latitude) && isCoordinate(longitude);

// Keeps the map centred on a place chosen from search.
const FlyTo = ({ target }) => {
  const map = useMap();

  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], 17, { duration: 0.6 });
    }
  }, [map, target]);

  return null;
};

const ClickToPick = ({ onPick }) => {
  useMapEvents({
    click: (event) => onPick(event.latlng.lat, event.latlng.lng),
  });

  return null;
};

export const LocationSearch = ({ picker }) => {
  const {
    query,
    results,
    searching,
    searchFailed,
    open,
    setOpen,
    wrapRef,
    searchEnabled,
    trimmedQuery,
    handleQueryChange,
    choosePlace,
  } = picker;

  let statusText = "";

  if (!searchEnabled) {
    statusText =
      "Address search is off. Add VITE_GEOAPIFY_API_KEY to frontend/.env, or click the map.";
  } else if (searchFailed) {
    statusText = "Search is unavailable right now. Click the map to set the spot.";
  } else if (searching) {
    statusText = "Searching…";
  }

  return (
    <div>
      <div ref={wrapRef} className="relative">
        <FaSearch
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-slate-400"
        />
        <input
          id="location-search"
          aria-label="Find on map"
          type="search"
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          onFocus={() => {
            if (results.length > 0) {
              setOpen(true);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && open) {
              event.stopPropagation();
              setOpen(false);
            }
          }}
          disabled={!searchEnabled}
          autoComplete="off"
          placeholder="Search a street, area or landmark in Tanzania"
          className={`${fieldClass} pl-9`}
        />

        {open && (
          <ul className="absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-[0_18px_40px_-12px_rgba(55,25,85,0.28)] ring-1 ring-brand-100/70">
            {results.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-slate-500">
                No places in Tanzania match “{trimmedQuery}”. Try a street, area or landmark.
              </li>
            ) : (
              results.map((place) => (
                <li key={place.place_id || place.formatted}>
                  <button
                    type="button"
                    onClick={() => choosePlace(place)}
                    className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-brand-50 hover:text-brand-800"
                  >
                    <FaMapMarkerAlt
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-xs text-brand-700"
                    />
                    <span>{place.formatted}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <p aria-live="polite" className="mt-1.5 min-h-4 text-xs text-slate-500">
        {statusText}
      </p>
    </div>
  );
};

export const LocationMap = ({ picker, latitude, longitude, radiusMeters }) => {
  const [initialView] = useState(() =>
    hasPoint(latitude, longitude)
      ? { center: [Number(latitude), Number(longitude)], zoom: 16 }
      : { center: DAR_ES_SALAAM, zoom: 12 }
  );

  const hasPin = hasPoint(latitude, longitude);
  const radius = Number(radiusMeters);
  const showFence = hasPin && Number.isFinite(radius) && radius > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="isolate relative h-[328px] overflow-hidden rounded-xl border border-slate-200 lg:h-auto lg:min-h-[232px] lg:flex-1">
        <MapContainer
          center={initialView.center}
          zoom={initialView.zoom}
          scrollWheelZoom
          className="absolute inset-0"
        >
          <TileLayer url={OSM_TILES} attribution={OSM_ATTRIBUTION} maxZoom={19} />
          <ClickToPick onPick={picker.pickPoint} />
          <FlyTo target={picker.flyTarget} />

          {hasPin && (
            <>
              {showFence && (
                <Circle
                  center={[Number(latitude), Number(longitude)]}
                  radius={radius}
                  pathOptions={{
                    color: FENCE_COLOR,
                    fillColor: FENCE_COLOR,
                    fillOpacity: 0.12,
                    weight: 2,
                    dashArray: "6 6",
                  }}
                />
              )}
              <Marker
                position={[Number(latitude), Number(longitude)]}
                icon={pinIcon}
                draggable
                eventHandlers={{
                  dragend: (event) => {
                    const { lat, lng } = event.target.getLatLng();
                    picker.pickPoint(lat, lng);
                  },
                }}
              />
            </>
          )}
        </MapContainer>
      </div>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        Click the map or drag the pin to set the exact spot. The dashed circle shows the fence radius.
      </p>
    </div>
  );
};
