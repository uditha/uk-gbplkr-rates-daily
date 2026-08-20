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
2. Fee is **£3** up to £1,000 and **£5** above that, added on top of the send amount
3. `LKR received = amount × send rate`
4. `Effective rate = LKR received ÷ (amount + fee)`

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

Import this GitHub repository at [vercel.com/new](https://vercel.com/new) and deploy the branch `cursor/gbp-lkr-heatmap-page-6ee2` (empty `main` does not include the heatmap). Use `/admin` to pull fresh rates after deploy.

Vercel serverless functions do not share `/tmp` or memory, so a refresh would otherwise vanish when you open the heatmap. This app keeps the latest quotes in the current session. To persist them across reloads and visitors, add **Vercel KV** (Storage → Create Database → KV). The app reads `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or the Upstash equivalents). That is the shared store — a SQL database is not required.

Hobby plans can only run functions in **one** region and cannot use Function Failover (passive regions). This repo pins London in `vercel.json` (`regions: ["lhr1"]`). If deploy fails with *“Deploying Serverless Function passive regions is restricted to the Enterprise plan”*:

1. Project **Settings → Functions** — Function Region **London (`lhr1`)**, **Function Failover off**.
2. Redeploy that branch (or import the repo as a new project instead of a claimed temporary deployment).
