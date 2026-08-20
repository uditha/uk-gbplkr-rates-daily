export type ProviderLogoFit = "cover" | "contain";

export type ProviderLogoSpec = {
  src: string;
  fit: ProviderLogoFit;
};

export const PROVIDER_LOGOS: Record<string, ProviderLogoSpec> = {
  "remitwire-boc-uk": { src: "/providers/remitwire.png", fit: "cover" },
  "global-exchange-smart": {
    src: "/providers/global-exchange.png",
    fit: "cover",
  },
  wise: { src: "/providers/wise.svg", fit: "cover" },
  "taptap-send": { src: "/providers/taptap-send.png", fit: "cover" },
  "revolut-standard": { src: "/providers/revolut.svg", fit: "cover" },
  "remitly-standard": { src: "/providers/remitly.png", fit: "cover" },
  "western-union-bank": { src: "/providers/western-union.svg", fit: "cover" },
  "wu-cash-pickup-sl": { src: "/providers/western-union.svg", fit: "cover" },
  "ria-money-transfer": { src: "/providers/ria.svg", fit: "cover" },
};

export function getProviderLogo(id: string): ProviderLogoSpec | null {
  return PROVIDER_LOGOS[id] ?? null;
}
