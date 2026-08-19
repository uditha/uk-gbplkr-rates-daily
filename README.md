# UK GBP → LKR rates

Public heatmap at `/` plus an admin collection page at `/admin`.

The public page only **reads stored quotes**. It does not scrape provider websites. Refresh rates from `/admin`, or from the terminal:

```bash
npm run refresh                  # all wired providers
npm run refresh remitwire-boc-uk # one provider
```

## RemitWire (BOC UK)

1. Read the GBP/LKR **buying** rate from [bankofceylon.co.uk/rates](https://bankofceylon.co.uk/rates/)
2. Subtract the published RemitWire fee for that send amount
3. `LKR received = (amount − fee) × buying rate`
4. `Effective rate = LKR received ÷ amount`

## Global Exchange

1. Read **1 GBP = … LKR** from [globalexchange.co.uk/Send-Money-to-SriLanka](https://www.globalexchange.co.uk/Send-Money-to-SriLanka)
2. Fees are not applied yet (waiting on charge bands)
3. For now `LKR received = amount × send rate`

```bash
npm run refresh global-exchange-smart
```

## Local development

```bash
npm install
npm run refresh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and [http://localhost:3000/admin](http://localhost:3000/admin).

```bash
npm test
npm run build
```

## Deploy on Vercel

Import this GitHub repository at [vercel.com/new](https://vercel.com/new) and deploy. Use `/admin` to pull fresh rates after deploy.
