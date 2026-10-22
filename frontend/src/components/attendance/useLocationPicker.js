import { useEffect, useRef, useState } from "react";
import axios from "axios";

const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;
const GEOAPIFY_URL = "https://api.geoapify.com/v1/geocode";
const SEARCH_DELAY_MS = 350;
const MIN_QUERY_LENGTH = 3;

// Shared by the search box and the map. onPoint sets the coordinates and
// onAddress sets the address; overwrite=false only fills an empty address.
const useLocationPicker = ({ onPoint, onAddress }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [flyTarget, setFlyTarget] = useState(null);
  const wrapRef = useRef(null);

  const searchEnabled = Boolean(GEOAPIFY_KEY);
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!searchEnabled || trimmedQuery.length < MIN_QUERY_LENGTH) {
      return undefined;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchFailed(false);

      try {
        const { data } = await axios.get(`${GEOAPIFY_URL}/autocomplete`, {
          params: {
            text: trimmedQuery,
            filter: "countrycode:tz",
            lang: "en",
            limit: 5,
            format: "json",
            apiKey: GEOAPIFY_KEY,
          },
          signal: controller.signal,
        });

        setResults(data.results || []);
        setOpen(true);
      } catch (error) {
        if (!axios.isCancel(error)) {
          setResults([]);
          setSearchFailed(true);
          setOpen(false);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    }, SEARCH_DELAY_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchEnabled, trimmedQuery]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const handleQueryChange = (value) => {
    setQuery(value);

    if (value.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setSearching(false);
      setSearchFailed(false);
      setOpen(false);
    }
  };

  const pickPoint = async (lat, lng) => {
    onPoint(lat.toFixed(6), lng.toFixed(6));

    if (!searchEnabled) {
      return;
    }

    try {
      const { data } = await axios.get(`${GEOAPIFY_URL}/reverse`, {
        params: { lat, lon: lng, format: "json", apiKey: GEOAPIFY_KEY },
      });
      const address = data.results?.[0]?.formatted;

      if (address) {
        onAddress(address, false);
      }
    } catch {
      // The pin is already set. The admin can type the address instead.
    }
  };

  const choosePlace = (place) => {
    setOpen(false);
    setResults([]);
    setQuery("");
    onPoint(place.lat.toFixed(6), place.lon.toFixed(6));
    onAddress(place.formatted, true);
    // A new object each time, so the map pans even when the same place is picked twice.
    setFlyTarget({ lat: place.lat, lng: place.lon });
  };

  return {
    query,
    results,
    searching,
    searchFailed,
    open,
    setOpen,
    flyTarget,
    wrapRef,
    searchEnabled,
    trimmedQuery,
    handleQueryChange,
    pickPoint,
    choosePlace,
  };
};

export default useLocationPicker;
