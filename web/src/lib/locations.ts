export type LocationCountry = {
  code: string;
  name: string;
  states: { code: string; name: string; cities: string[] }[];
};

export const FULFILLMENT_COUNTRIES: LocationCountry[] = [
  {
    code: "NG",
    name: "Nigeria",
    states: [
      { code: "LA", name: "Lagos", cities: ["Lagos", "Ikeja", "Lekki", "Surulere", "Yaba", "Ajah"] },
      { code: "FC", name: "FCT", cities: ["Abuja", "Gwarinpa", "Wuse", "Maitama"] },
      { code: "RI", name: "Rivers", cities: ["Port Harcourt", "Obio-Akpor"] },
      { code: "KD", name: "Kaduna", cities: ["Kaduna", "Zaria"] },
      { code: "OY", name: "Oyo", cities: ["Ibadan", "Ogbomosho"] },
      { code: "AN", name: "Anambra", cities: ["Awka", "Onitsha", "Nnewi"] },
      { code: "EN", name: "Enugu", cities: ["Enugu"] },
      { code: "KN", name: "Kano", cities: ["Kano"] },
    ],
  },
  {
    code: "GB",
    name: "United Kingdom",
    states: [
      { code: "ENG", name: "England", cities: ["London", "Manchester", "Birmingham", "Leeds", "Bristol"] },
      { code: "SCT", name: "Scotland", cities: ["Edinburgh", "Glasgow"] },
      { code: "WLS", name: "Wales", cities: ["Cardiff"] },
    ],
  },
  {
    code: "GH",
    name: "Ghana",
    states: [
      { code: "GA", name: "Greater Accra", cities: ["Accra", "Tema"] },
      { code: "AS", name: "Ashanti", cities: ["Kumasi"] },
    ],
  },
  {
    code: "US",
    name: "United States",
    states: [
      { code: "NY", name: "New York", cities: ["New York", "Brooklyn", "Buffalo"] },
      { code: "CA", name: "California", cities: ["Los Angeles", "San Francisco", "San Diego"] },
      { code: "TX", name: "Texas", cities: ["Houston", "Austin", "Dallas"] },
    ],
  },
  {
    code: "KE",
    name: "Kenya",
    states: [
      { code: "NAI", name: "Nairobi", cities: ["Nairobi"] },
      { code: "MSA", name: "Mombasa", cities: ["Mombasa"] },
    ],
  },
  {
    code: "ZA",
    name: "South Africa",
    states: [
      { code: "GP", name: "Gauteng", cities: ["Johannesburg", "Pretoria"] },
      { code: "WC", name: "Western Cape", cities: ["Cape Town"] },
    ],
  },
  {
    code: "CA",
    name: "Canada",
    states: [
      { code: "ON", name: "Ontario", cities: ["Toronto", "Ottawa"] },
      { code: "BC", name: "British Columbia", cities: ["Vancouver"] },
    ],
  },
];

export function buildFulfillmentDisplayLabel(city: string, country: string) {
  const c = (city || "").trim();
  const co = (country || "").trim();
  if (c && co) return `${c}, ${co}`;
  return c || co || "";
}

export function buildFulfillmentLocation(input: {
  countryCode: string;
  country: string;
  stateCode?: string;
  state?: string;
  city: string;
}) {
  return {
    ...input,
    stateCode: input.stateCode || "",
    state: input.state || "",
    displayLabel: buildFulfillmentDisplayLabel(input.city, input.country),
  };
}

export function getCountryByCode(code: string) {
  return FULFILLMENT_COUNTRIES.find((c) => c.code === code);
}

export function getStatesForCountry(countryCode: string) {
  return getCountryByCode(countryCode)?.states || [];
}

export function getCitiesForState(countryCode: string, stateCode: string) {
  return getStatesForCountry(countryCode).find((s) => s.code === stateCode)?.cities || [];
}