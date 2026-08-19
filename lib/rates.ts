export type RateValue = number | null;

export type ProviderRates = {
  name: string;
  rates: RateValue[];
};

export const DATES = [
  "8 Aug",
  "9 Aug",
  "10 Aug",
  "11 Aug",
  "12 Aug",
  "13 Aug",
  "14 Aug",
  "15 Aug",
  "16 Aug",
  "17 Aug",
  "18 Aug",
  "19 Aug",
] as const;

export const UPDATED_ON = "19 Aug 2026";

export const PROVIDERS: ProviderRates[] = [
  {
    name: "RemitWire (BOC UK)",
    rates: [
      447.7, 447.62, 449.2, 447.85, 446.8, 446.7, 448.15, 449.5, 447.1, 447.8,
      447.35, 448.0,
    ],
  },
  {
    name: "Global Exchange (Smart)",
    rates: [
      448.12, 447.85, 449.05, 448.4, 447.1, 446.8, 448.95, 449.3, 447.6, 448.0,
      447.25, 448.7,
    ],
  },
  {
    name: "Wise",
    rates: [
      446.92, 446.95, 447.8, 447.7, 446.0, 445.2, 448.15, 448.2, 446.6, 447.4,
      null, null,
    ],
  },
  {
    name: "Taptap Send",
    rates: [
      446.02, 446.05, 446.8, 446.9, 445.1, 444.2, 447.05, 447.3, 445.3, null,
      null, null,
    ],
  },
  {
    name: "Revolut (Standard)",
    rates: [
      445.32, 445.35, 446.1, 445.8, 444.2, 443.8, 446.55, 446.8, 444.4, 445.5,
      444.55, 445.7,
    ],
  },
  {
    name: "Remitly (standard)",
    rates: [
      444.52, 444.65, 445.3, 445.0, 443.4, 442.7, 445.65, 445.7, 444.1, 444.0,
      443.75, 444.8,
    ],
  },
  {
    name: "Western Union (bank)",
    rates: [
      443.32, 442.65, 444.7, 443.4, 442.5, 441.4, 444.05, 444.4, 442.9, 442.7,
      442.35, 443.9,
    ],
  },
  {
    name: "WU (cash pickup SL)",
    rates: [
      439.72, 438.95, 441.1, 439.2, 438.5, 437.8, 440.65, 440.7, 438.5, 439.5,
      438.65, 439.4,
    ],
  },
  {
    name: "Ria Money Transfer",
    rates: [
      446.32, 445.55, 447.7, 446.4, 444.5, 445.1, 446.75, 447.6, 445.2, null,
      null, null,
    ],
  },
];

export function columnLeaders(providers: ProviderRates[]): RateValue[] {
  const columns = providers[0]?.rates.length ?? 0;
  return Array.from({ length: columns }, (_, column) => {
    const values = providers
      .map((provider) => provider.rates[column])
      .filter((rate): rate is number => rate != null);
    if (values.length === 0) {
      return null;
    }
    return Math.max(...values);
  });
}
