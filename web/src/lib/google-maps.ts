/**
 * Google Maps JS API loader.
 *
 * Loads the API once, on demand, when a key is configured. Everything is
 * feature-detected: with no NEXT_PUBLIC_GOOGLE_MAPS_API_KEY the app never
 * touches Google and uses the keyless MapLibre + Esri map instead.
 */

export const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
export const hasGoogleMaps = () => GOOGLE_MAPS_KEY.length > 0;

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
    __fkGmapsPromise?: Promise<any>;
  }
}

export function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.maps) return Promise.resolve(window.google);
  if (window.__fkGmapsPromise) return window.__fkGmapsPromise;

  window.__fkGmapsPromise = new Promise((resolve, reject) => {
    const cbName = "__fkGmapsInit";
    (window as any)[cbName] = () => resolve(window.google);
    const s = document.createElement("script");
    const params = new URLSearchParams({
      key: GOOGLE_MAPS_KEY,
      libraries: "geometry",
      callback: cbName,
      v: "weekly",
    });
    s.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(s);
  });
  return window.__fkGmapsPromise;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
