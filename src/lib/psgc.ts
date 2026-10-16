// Philippine provinces, cities/municipalities and barangays from the PSA's PSGC list, bundled in
// public/psgc (built by scripts/psgc-generate.cjs). Each province's file loads only when picked.

export interface PsgcProvince {
  code: string;
  name: string;
}

export interface PsgcCity {
  name: string;
  barangays: string[];
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}psgc/${path}`);
  if (!res.ok) throw new Error("Couldn't load the list of places. Check your connection and try again.");
  return (await res.json()) as T;
}

export const fetchProvinces = () => getJson<PsgcProvince[]>("provinces.json");

export const fetchCities = (provinceCode: string) => getJson<PsgcCity[]>(`p/${provinceCode}.json`);
