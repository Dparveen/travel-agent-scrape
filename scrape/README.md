
# Universal Travel Business Scraper

Ready-to-run Node.js + Playwright + ExcelJS framework.

## Enabled by default
- NIDHI+ Travel Agents
- NIDHI+ Online Travel Aggregators

## Excel
`output/TRAVEL_BUSINESS_MASTER.xlsx`

Columns:
Agency Name, Email, Phone, Website, Address, City, District, State, Pincode, Category, Source, Source URL, Page.

## Install
```bash
npm install
npx playwright install chromium
```

## Run
```bash
npm start
```

Optional:
```bash
HEADLESS=false DELAY_MS=2500 npm start
```

## Add sources
Edit `src/config/sources.json`. For substantially different HTML, add a dedicated adapter in `src/sources/`.

## Important
The generic adapter is intentionally conservative. Different directories have different HTML, so source-specific adapters may be needed for high-quality extraction. Do not bypass CAPTCHA, login, paywalls, IP blocks, or other access controls. Use public pages/APIs/exports where permitted and respect site terms, robots directives and rate limits.
