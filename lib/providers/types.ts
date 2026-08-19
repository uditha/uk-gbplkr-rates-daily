export type AmountColumn = {
  amountGbp: number;
  label: string;
};

export type Quote = {
  amountGbp: number;
  feeGbp: number;
  netGbp: number;
  lkrReceived: number;
  effectiveRate: number;
  behindBoardRate: number;
};

export type ProviderSnapshot = {
  id: string;
  name: string;
  sourceUrl: string;
  pair: "GBPLKR";
  boardRate: number;
  rateKind: "buying" | "send";
  asOf: string | null;
  quotes: Quote[];
};

export type ComparisonRates = {
  fetchedAt: string;
  amounts: AmountColumn[];
  providers: ProviderSnapshot[];
};
