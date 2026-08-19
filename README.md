# UK GBP → LKR rates

Public Next.js page that compares GBP to LKR remittance quotes as a heatmap.

Columns are send amounts. Each cell shows the **effective rate** (LKR per £1 after fees) and the **LKR the recipient gets**.

## Live rates

`GET /api/rates` fetches current quotes provider by provider. RemitWire (BOC UK) is first:

1. Read the GBP/LKR **buying** rate from [bankofceylon.co.uk/rates](https://bankofceylon.co.uk/rates/)
2. Subtract the published RemitWire fee for that send amount
3. `LKR received = (amount − fee) × buying rate`
4. `Effective rate = LKR received ÷ amount`

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm test
npm run build
```

## Deploy on Vercel

Import this GitHub repository at [vercel.com/new](https://vercel.com/new) and deploy. Vercel detects Next.js automatically.
