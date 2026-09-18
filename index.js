const { chromium } = require("playwright");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

/*
=========================================================
NIDHI+ SCRAPER
=========================================================

Sources:

1. Travel Agents
https://nidhi.tourism.gov.in/home/directory?categoryCode=02&subcategory=TA

2. Online Travel Aggregators
https://nidhi.tourism.gov.in/home/directory?categoryCode=04&category_name=Online%20Travel%20Aggregator

Output:
./output/NIDHI_MASTER.xlsx

Sheets:
- All Data
- Travel Agents
- Online Travel Aggregators

=========================================================
*/

const CONFIG = {
  headless: true,

  delayBetweenPages: 1200,
  delayBetweenDetails: 500,

  maxPages: 1000,

  outputDir: path.join(__dirname, "output"),

  sources: [
    {
      name: "Travel Agent",
      url:
        "https://nidhi.tourism.gov.in/home/directory?categoryCode=02&subcategory=TA",
    },

    {
      name: "Online Travel Aggregator",
      url:
        "https://nidhi.tourism.gov.in/home/directory?categoryCode=04&category_name=Online%20Travel%20Aggregator",
    },
  ],
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clean(value) {
  if (value === undefined || value === null) return "";

  return String(value)
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function normalize(value) {
  return clean(value).toLowerCase();
}

function extractEmail(text) {
  const match = text.match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
  );

  return match ? match[0].trim() : "";
}

function extractPhone(text) {
  const matches = text.match(
    /(?:\+91[\s-]?)?[6-9]\d{9}/g
  );

  if (!matches || !matches.length) return "";

  return matches[0]
    .replace(/\s+/g, "")
    .replace(/^\+91/, "");
}

function extractWebsite(text) {
  const match = text.match(
    /(?:https?:\/\/|www\.)[^\s<>"']+/i
  );

  return match ? match[0].trim() : "";
}

function makeKey(row) {
  const phone = normalize(row.phone);
  const email = normalize(row.email);
  const name = normalize(row.name);
  const address = normalize(row.address);

  if (phone) return `phone:${phone}`;
  if (email) return `email:${email}`;

  return `name:${name}|address:${address}`;
}

async function safeText(locator) {
  try {
    if (await locator.count()) {
      return clean(await locator.first().innerText());
    }
  } catch {}

  return "";
}

async function scrapeCurrentPage(page, category, pageNumber) {
  console.log(`\n----------------------------------------`);
  console.log(`Category : ${category}`);
  console.log(`Page     : ${pageNumber}`);
  console.log(`URL      : ${page.url()}`);
  console.log(`----------------------------------------`);

  await page.waitForLoadState("domcontentloaded").catch(() => {});

  await sleep(800);

  /*
   * NIDHI+ cards contain:
   *
   * Name
   * Category
   * location
   * email
   * phone
   * website
   * View Details
   */

  const records = await page.evaluate(() => {
    function txt(el) {
      return (el?.innerText || "")
        .replace(/\s+/g, " ")
        .trim();
    }

    function attr(el, name) {
      return el?.getAttribute(name) || "";
    }

    const output = [];

    /*
     * First attempt:
     * identify blocks containing email + phone.
     */

    const allElements = Array.from(
      document.querySelectorAll("body *")
    );

    const candidates = [];

    for (const el of allElements) {
      const text = txt(el);

      if (!text) continue;

      const hasEmail =
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text);

      const hasPhone =
        /(?:\+91[\s-]?)?[6-9]\d{9}/.test(text);

      if (hasEmail && hasPhone) {
        candidates.push(el);
      }
    }

    /*
     * Pick smallest useful parent containing the record.
     */
    const unique = [];

    for (const el of candidates) {
      let node = el;

      for (let i = 0; i < 5; i++) {
        if (!node.parentElement) break;

        const parent = node.parentElement;
        const text = txt(parent);

        if (
          text.length > 80 &&
          text.length < 2500
        ) {
          node = parent;
        } else {
          break;
        }
      }

      unique.push(node);
    }

    const seen = new Set();

    for (const el of unique) {
      const text = txt(el);

      if (!text) continue;

      const emailMatch = text.match(
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
      );

      const phoneMatch = text.match(
        /(?:\+91[\s-]?)?[6-9]\d{9}/
      );

      const email = emailMatch
        ? emailMatch[0]
        : "";

      const phone = phoneMatch
        ? phoneMatch[0]
        : "";

      /*
       * Try to identify heading/name.
       */
      let name = "";

      const headings = el.querySelectorAll(
        "h1,h2,h3,h4,h5,h6,strong,b"
      );

      for (const heading of headings) {
        const value = txt(heading);

        if (
          value &&
          value.length > 2 &&
          value.length < 200 &&
          !value.includes("@") &&
          !/^\d+$/.test(value)
        ) {
          name = value;
          break;
        }
      }

      /*
       * fallback:
       * first meaningful line
       */
      if (!name) {
        const lines = text
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean);

        for (const line of lines) {
          if (
            line.length > 2 &&
            line.length < 200 &&
            !line.includes("@") &&
            !/[6-9]\d{9}/.test(line) &&
            !/^image:/i.test(line)
          ) {
            name = line;
            break;
          }
        }
      }

      const links = Array.from(
        el.querySelectorAll("a")
      );

      let website = "";

      for (const link of links) {
        const href = attr(link, "href");

        if (
          href &&
          (
            href.startsWith("http://") ||
            href.startsWith("https://") ||
            href.includes("www.")
          )
        ) {
          website = href;
          break;
        }
      }

      const key =
        `${name}|${email}|${phone}`;

      if (seen.has(key)) continue;

      seen.add(key);

      output.push({
        name,
        email,
        phone,
        website,
        rawText: text,
      });
    }

    return output;
  });

  console.log(`Candidates found: ${records.length}`);

  return records.map((r) => ({
    name: clean(r.name),
    email: clean(r.email),
    phone: clean(r.phone),
    website: clean(r.website),
    rawText: clean(r.rawText),
    category,
    page: pageNumber,
    sourceUrl: page.url(),
  }));
}

async function extractDetails(page, rows) {
  /*
   * The directory itself already exposes most fields.
   *
   * We keep this function separate so detail-page extraction
   * can be enabled later if NIDHI changes its UI.
   */

  return rows;
}

function parseAddress(rawText, name, email, phone, website) {
  let value = rawText;

  if (name) value = value.replace(name, "");
  if (email) value = value.replace(email, "");
  if (phone) value = value.replace(phone, "");
  if (website) value = value.replace(website, "");

  value = value
    .replace(/Image:\s*(location|mail|call|website)/gi, "")
    .replace(/View Details/gi, "")
    .replace(/Search/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return value;
}

function deriveLocation(address) {
  const result = {
    city: "",
    state: "",
    pincode: "",
  };

  if (!address) return result;

  const pin = address.match(/\b\d{6}\b/);

  if (pin) {
    result.pincode = pin[0];
  }

  /*
   * State list for common NIDHI+ addresses.
   */
  const states = [
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
    "Delhi",
    "Jammu And Kashmir",
    "Jammu & Kashmir",
    "Ladakh",
    "Puducherry",
    "Chandigarh",
    "Lakshadweep",
    "Andaman And Nicobar Islands",
    "Dadra And Nagar Haveli And Daman And Diu",
  ];

  for (const state of states) {
    if (
      address
        .toLowerCase()
        .includes(state.toLowerCase())
    ) {
      result.state = state;
      break;
    }
  }

  return result;
}

function transformRows(rows) {
  return rows.map((row) => {
    const email =
      row.email ||
      extractEmail(row.rawText);

    const phone =
      row.phone ||
      extractPhone(row.rawText);

    const website =
      row.website ||
      extractWebsite(row.rawText);

    const address = parseAddress(
      row.rawText,
      row.name,
      email,
      phone,
      website
    );

    const location =
      deriveLocation(address);

    return {
      name: clean(row.name),
      email: clean(email),
      phone: clean(phone),
      website: clean(website),
      address: clean(address),
      city: location.city,
      state: location.state,
      pincode: location.pincode,
      category: row.category,
      sourceUrl: row.sourceUrl,
      page: row.page,
    };
  });
}

function deduplicate(rows) {
  const map = new Map();

  for (const row of rows) {
    const key = makeKey(row);

    if (!key) continue;

    const existing = map.get(key);

    if (!existing) {
      map.set(key, row);
      continue;
    }

    /*
     * Merge missing fields.
     */
    for (const field of [
      "email",
      "phone",
      "website",
      "address",
      "city",
      "state",
      "pincode",
    ]) {
      if (
        !existing[field] &&
        row[field]
      ) {
        existing[field] = row[field];
      }
    }
  }

  return Array.from(map.values());
}

async function detectNextPage(page) {
  /*
   * First check standard pagination links.
   */

  const next = await page.evaluate(() => {
    const links = Array.from(
      document.querySelectorAll("a")
    );

    const candidates = links.filter((a) => {
      const text =
        (a.innerText || "")
          .trim()
          .toLowerCase();

      const aria =
        (a.getAttribute("aria-label") || "")
          .trim()
          .toLowerCase();

      return (
        text === "next" ||
        text === ">" ||
        text === "›" ||
        text.includes("next") ||
        aria.includes("next")
      );
    });

    if (!candidates.length) {
      return null;
    }

    return (
      candidates[0].href ||
      null
    );
  });

  return next;
}

function buildPageUrl(baseUrl, pageNumber) {
  const url = new URL(baseUrl);

  /*
   * NIDHI commonly uses pageno.
   */
  url.searchParams.set(
    "pageno",
    String(pageNumber)
  );

  return url.toString();
}

async function scrapeSource(browser, source) {
  const page = await browser.newPage();

  page.setDefaultTimeout(30000);

  const allRows = [];

  try {
    for (
      let pageNumber = 1;
      pageNumber <= CONFIG.maxPages;
      pageNumber++
    ) {
      const url =
        buildPageUrl(
          source.url,
          pageNumber
        );

      console.log(
        `\nOpening page ${pageNumber}:`
      );

      console.log(url);

      try {
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
      } catch (error) {
        console.log(
          `Navigation error on page ${pageNumber}:`,
          error.message
        );

        /*
         * Retry once.
         */
        await sleep(3000);

        try {
          await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 60000,
          });
        } catch {
          console.log(
            "Retry failed. Stopping source."
          );
          break;
        }
      }

      await sleep(
        CONFIG.delayBetweenPages
      );

      const text =
        await page.locator("body").innerText();

      /*
       * If page doesn't contain registered records,
       * pagination has ended.
       */
      if (
        !text ||
        !text.includes("registered found")
      ) {
        console.log(
          "No registered-record page detected."
        );

        break;
      }

      const rows =
        await scrapeCurrentPage(
          page,
          source.name,
          pageNumber
        );

      if (!rows.length) {
        console.log(
          "No records detected."
        );

        /*
         * Don't immediately stop because a page
         * can temporarily fail.
         */
        await sleep(2000);

        const retryRows =
          await scrapeCurrentPage(
            page,
            source.name,
            pageNumber
          );

        if (!retryRows.length) {
          break;
        }

        allRows.push(...retryRows);
      } else {
        allRows.push(...rows);
      }

      console.log(
        `Records collected so far: ${allRows.length}`
      );

      /*
       * Stop when a page has substantially fewer
       * records than the normal 50-record page.
       *
       * NIDHI generally uses 50/page.
       */
      if (rows.length > 0 && rows.length < 10) {
        console.log(
          "Likely final page."
        );

        break;
      }

      await sleep(
        CONFIG.delayBetweenPages
      );
    }
  } finally {
    await page.close();
  }

  return transformRows(allRows);
}

async function createExcel(rows) {
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(
      CONFIG.outputDir,
      { recursive: true }
    );
  }

  const workbook =
    new ExcelJS.Workbook();

  workbook.creator =
    "NIDHI+ Scraper";

  workbook.created =
    new Date();

  /*
   * =========================
   * ALL DATA
   * =========================
   */

  const allSheet =
    workbook.addWorksheet(
      "All Data"
    );

  const columns = [
    {
      header: "Sr No",
      key: "srNo",
      width: 10,
    },
    {
      header: "Name",
      key: "name",
      width: 40,
    },
    {
      header: "Email",
      key: "email",
      width: 38,
    },
    {
      header: "Phone",
      key: "phone",
      width: 18,
    },
    {
      header: "Website",
      key: "website",
      width: 40,
    },
    {
      header: "Address",
      key: "address",
      width: 65,
    },
    {
      header: "City",
      key: "city",
      width: 25,
    },
    {
      header: "State",
      key: "state",
      width: 25,
    },
    {
      header: "Pincode",
      key: "pincode",
      width: 12,
    },
    {
      header: "Category",
      key: "category",
      width: 32,
    },
    {
      header: "Source URL",
      key: "sourceUrl",
      width: 70,
    },
    {
      header: "Page",
      key: "page",
      width: 10,
    },
  ];

  allSheet.columns = columns;

  rows.forEach((row, index) => {
    allSheet.addRow({
      srNo: index + 1,
      ...row,
    });
  });

  formatSheet(allSheet);

  /*
   * =========================
   * CATEGORY SHEETS
   * =========================
   */

  const categories = [
    "Travel Agent",
    "Online Travel Aggregator",
  ];

  for (const category of categories) {
    const sheetName =
      category === "Travel Agent"
        ? "Travel Agents"
        : "Online Travel Aggregators";

    const sheet =
      workbook.addWorksheet(
        sheetName
      );

    sheet.columns = columns;

    const filtered =
      rows.filter(
        (r) =>
          r.category === category
      );

    filtered.forEach(
      (row, index) => {
        sheet.addRow({
          srNo: index + 1,
          ...row,
        });
      }
    );

    formatSheet(sheet);
  }

  /*
   * =========================
   * SUMMARY
   * =========================
   */

  const summary =
    workbook.addWorksheet(
      "Summary"
    );

  summary.columns = [
    {
      header: "Category",
      key: "category",
      width: 35,
    },
    {
      header: "Records",
      key: "records",
      width: 15,
    },
  ];

  for (const category of categories) {
    summary.addRow({
      category,
      records: rows.filter(
        (r) =>
          r.category === category
      ).length,
    });
  }

  summary.addRow({
    category: "TOTAL",
    records: rows.length,
  });

  formatSheet(summary);

  const output =
    path.join(
      CONFIG.outputDir,
      "NIDHI_MASTER.xlsx"
    );

  await workbook.xlsx.writeFile(
    output
  );

  return output;
}

function formatSheet(sheet) {
  /*
   * Header formatting.
   */
  const header =
    sheet.getRow(1);

  header.font = {
    bold: true,
  };

  header.alignment = {
    vertical: "middle",
    horizontal: "center",
  };

  header.height = 25;

  /*
   * Freeze first row.
   */
  sheet.views = [
    {
      state: "frozen",
      ySplit: 1,
    },
  ];

  /*
   * Autofilter.
   */
  sheet.autoFilter = {
    from: "A1",
    to: `${String.fromCharCode(
      64 + sheet.columnCount
    )}1`,
  };

  /*
   * Wrap long text.
   */
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = {
        vertical: "top",
        wrapText: true,
      };
    });
  });
}

async function main() {
  console.log(
    "\n========================================"
  );

  console.log(
    "        NIDHI+ SCRAPER STARTING"
  );

  console.log(
    "========================================\n"
  );

  console.log(
    "Sources:"
  );

  CONFIG.sources.forEach(
    (source) => {
      console.log(
        `${source.name}: ${source.url}`
      );
    }
  );

  console.log("");

  const browser =
    await chromium.launch({
      headless:
        CONFIG.headless,

      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

  const allRows = [];

  try {
    for (const source of CONFIG.sources) {
      console.log(
        `\n\n========================================`
      );

      console.log(
        `SCRAPING: ${source.name}`
      );

      console.log(
        `========================================\n`
      );

      const rows =
        await scrapeSource(
          browser,
          source
        );

      console.log(
        `\n${source.name}: ${rows.length} raw records`
      );

      allRows.push(...rows);
    }
  } finally {
    await browser.close();
  }

  console.log(
    `\nTotal raw records: ${allRows.length}`
  );

  /*
   * Deduplicate.
   */
  const uniqueRows =
    deduplicate(allRows);

  console.log(
    `Unique records: ${uniqueRows.length}`
  );

  /*
   * Sort.
   */
  uniqueRows.sort(
    (a, b) =>
      a.category.localeCompare(
        b.category
      ) ||
      a.name.localeCompare(
        b.name
      )
  );

  /*
   * Export.
   */
  const output =
    await createExcel(
      uniqueRows
    );

  console.log(
    "\n========================================"
  );

  console.log(
    "              COMPLETED"
  );

  console.log(
    "========================================"
  );

  console.log(
    `Excel: ${output}`
  );

  console.log(
    `Total unique records: ${uniqueRows.length}`
  );

  console.log(
    "\nDone."
  );
}

main().catch((error) => {
  console.error(
    "\nSCRAPER FAILED:\n",
    error
  );

  process.exit(1);
});