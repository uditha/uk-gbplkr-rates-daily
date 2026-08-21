# UK GBP → LKR rates

Public heatmap at `/` plus a password-protected collection page at `/desk`.

Quotes live **on the server** (Vercel KV). The public page reads that stored copy. It does not scrape providers on every visit.

- If stored quotes are **older than 30 minutes**, the next visitor triggers a server refresh. The new quotes are saved, and everyone else sees them without scraping again.
- A refresh from `/desk` (or `npm run refresh`) is **immediate**. It does not wait for the 30-minute window.

```bash
npm run refresh                  # all wired providers
npm run refresh remitwire-boc-uk # one provider
```

Sign in at `/desk` with the default password in the app. Override it with `ADMIN_PASSWORD` on Vercel if you want a different one.

## Where the data lives

1. **Vercel KV** — shared server store for every visitor (`KV_REST_API_URL` + `KV_REST_API_TOKEN`, or the Upstash equivalents). Add this in the Vercel project: Storage → Create Database → KV.
2. **Desk / terminal refresh** — scrapes now, then writes that same KV copy.
3. Browser storage is only a local cache when KV is not configured.

Without KV, each serverless instance keeps its own copy and visitors will not share one live rate table.

## RemitWire (BOC UK)

1. Read the GBP/LKR **buying** rate from [bankofceylon.co.uk/rates](https://bankofceylon.co.uk/rates/)
2. Subtract the published RemitWire fee for that send amount
3. `LKR received = (amount − fee) × buying rate`
4. `Effective rate = LKR received ÷ amount`

## Global Exchange

1. Prefer the live GBP/LKR calculator at [globalexchange.co.uk](https://www.globalexchange.co.uk/) (`POST /calculate_currency`)
2. If that is blocked, read **1 GBP = … LKR** from [the Sri Lanka page](https://www.globalexchange.co.uk/Send-Money-to-SriLanka)
3. If Cloudflare blocks Vercel, read that same page through a public HTML reader, or paste the rate on `/desk`
4. Fee is **£3** up to £1,000 and **£5** above that, deducted from the send amount
5. `LKR received = (amount − fee) × send rate`
6. `Effective rate = LKR received ÷ amount`

```bash
npm run refresh global-exchange-smart
```

## Local development

```bash
npm install
npm run refresh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and [http://localhost:3000/desk](http://localhost:3000/desk).

```bash
npm test
npm run build
```

## Deploy on Vercel

Import this GitHub repository at [vercel.com/new](https://vercel.com/new) and deploy the branch `cursor/gbp-lkr-heatmap-page-6ee2` (empty `main` does not include the heatmap). Add **Vercel KV** so every visitor sees the same server copy. Use `/desk` for an immediate refresh; otherwise the heatmap updates stored quotes when they are more than 30 minutes old.

Vercel serverless functions do not share `/tmp` or memory. KV is the shared store — a SQL database is not required.

Hobby plans can only run functions in **one** region and cannot use Function Failover (passive regions). This repo pins London in `vercel.json` (`regions: ["lhr1"]`). If deploy fails with *“Deploying Serverless Function passive regions is restricted to the Enterprise plan”*:

1. Project **Settings → Functions** — Function Region **London (`lhr1`)**, **Function Failover off**.
2. Redeploy that branch (or import the repo as a new project instead of a claimed temporary deployment).
