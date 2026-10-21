// Geography and clock helpers shared by the attendance endpoints.
// Nilric operates from Dar es Salaam, so "today" is the East Africa date, not
// the server's date.

export const DEFAULT_TIMEZONE = "Africa/Dar_es_Salaam";

const EARTH_RADIUS_METERS = 6371000;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

export const isValidCoordinate = (latitude, longitude) => {
  const lat = Number(latitude);
  const lng = Number(longitude);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

export const haversineDistanceMeters = (from, to) => {
  const lat1 = toRadians(Number(from.latitude));
  const lat2 = toRadians(Number(to.latitude));
  const deltaLat = lat2 - lat1;
  const deltaLng = toRadians(
    Number(to.longitude) - Number(from.longitude)
  );

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return Math.round(
    2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)))
  );
};

// A phone GPS reading is only accurate to a few metres, so a fix just outside
// the fence is accepted when the reported accuracy explains the gap.
const ACCURACY_TOLERANCE_METERS = 40;

export const isWithinFence = (
  distanceMeters,
  radiusMeters,
  accuracyMeters = 0
) =>
  Number(distanceMeters) <=
  Number(radiusMeters) +
    Math.min(Math.max(Number(accuracyMeters) || 0, 0), ACCURACY_TOLERANCE_METERS);

export const findNearestLocation = (position, locations = []) => {
  const candidates = locations
    .filter(
      (location) =>
        location &&
        location.isActive !== false &&
        isValidCoordinate(location.latitude, location.longitude)
    )
    .map((location) => ({
      location,
      distanceMeters: haversineDistanceMeters(position, location),
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  return candidates[0] || null;
};

export const evaluateGeofence = (
  { latitude, longitude, accuracy = 0 },
  locations = []
) => {
  const nearest = findNearestLocation({ latitude, longitude }, locations);

  if (!nearest) {
    return {
      location: null,
      distanceMeters: null,
      withinFence: false,
    };
  }

  return {
    location: nearest.location,
    distanceMeters: nearest.distanceMeters,
    withinFence: isWithinFence(
      nearest.distanceMeters,
      nearest.location.radiusMeters,
      accuracy
    ),
  };
};

const partsFormatterCache = new Map();

const getPartsFormatter = (timeZone) => {
  if (!partsFormatterCache.has(timeZone)) {
    partsFormatterCache.set(
      timeZone,
      new Intl.DateTimeFormat("en-GB", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      })
    );
  }

  return partsFormatterCache.get(timeZone);
};

export const localTimeParts = (
  date = new Date(),
  timeZone = DEFAULT_TIMEZONE
) => {
  const parts = getPartsFormatter(timeZone || DEFAULT_TIMEZONE)
    .formatToParts(new Date(date))
    .reduce((values, part) => {
      if (part.type !== "literal") {
        values[part.type] = part.value;
      }

      return values;
    }, {});

  const hour = Number(parts.hour) % 24;

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
};

export const localDateKey = (date = new Date(), timeZone = DEFAULT_TIMEZONE) => {
  const { year, month, day } = localTimeParts(date, timeZone);

  return `${year}-${month}-${day}`;
};

export const localMinutesOfDay = (
  date = new Date(),
  timeZone = DEFAULT_TIMEZONE
) => {
  const { hour, minute } = localTimeParts(date, timeZone);

  return hour * 60 + minute;
};

export const timeStringToMinutes = (value, fallback = 0) => {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(value || "").trim());

  if (!match) {
    return fallback;
  }

  return Number(match[1]) * 60 + Number(match[2]);
};

export const minutesToDuration = (minutes) => {
  const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;

  return `${hours}h ${String(remainder).padStart(2, "0")}m`;
};

export const formatDateKey = (value) => {
  if (!value) {
    return "";
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return localDateKey(value);
};

export const isDateKey = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

// Turns a company-local date and wall-clock time (e.g. 2026-10-20 08:15 in
// Africa/Dar_es_Salaam) into the matching UTC instant. Used for manual
// attendance entries.
export const zonedTimeToUtc = (
  dateKey,
  timeValue,
  timeZone = DEFAULT_TIMEZONE
) => {
  if (!isDateKey(dateKey) || !/^([01]?\d|2[0-3]):([0-5]\d)$/.test(String(timeValue || ""))) {
    return null;
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = String(timeValue).split(":").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const local = localTimeParts(new Date(utcGuess), timeZone);
  const localAsUtc = Date.UTC(
    Number(local.year),
    Number(local.month) - 1,
    Number(local.day),
    local.hour,
    local.minute,
    local.second
  );
  const offset = localAsUtc - utcGuess;

  return new Date(utcGuess - offset);
};
