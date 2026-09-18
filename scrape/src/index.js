
const fs=require("fs"),path=require("path");
const {createBrowser,createContext}=require("./core/browser");
const {pageUrl}=require("./core/pagination");
const {dedupe}=require("./core/utils");
const {exportExcel}=require("./core/exporter");
const {scrapeNidhiPage}=require("./sources/nidhi");
const {scrapeGenericPage}=require("./sources/generic");

const delay=+process.env.DELAY_MS||1500, timeout=+process.env.TIMEOUT_MS||60000;
const config=JSON.parse(fs.readFileSync(path.join(__dirname,"config/sources.json")));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function source(page,s){
 const rows=[],max=s.pagination?.maxPages||1,start=s.pagination?.start||1;
 for(let p=start;p<=max;p++){
  const url=pageUrl(s.startUrl,s.pagination,p); console.log(`\n[${s.name}] page ${p}: ${url}`);
  try{await page.goto(url,{waitUntil:"domcontentloaded",timeout})}catch(e){console.log("navigation:",e.message);await sleep(2500);try{await page.goto(url,{waitUntil:"domcontentloaded",timeout})}catch{break}}
  await sleep(delay);
  const got=s.type==="nidhi"?await scrapeNidhiPage(page,s,p):await scrapeGenericPage(page,s,p);
  console.log("extracted:",got.length); if(!got.length)break; rows.push(...got);
  if(s.pagination?.type==="none"||got.length<5)break;
 }
 return rows;
}

(async()=>{
 const browser=await createBrowser(),ctx=await createContext(browser),page=await ctx.newPage();page.setDefaultTimeout(timeout);
 let rows=[];
 try{for(const s of config.filter(x=>x.enabled))rows.push(...await source(page,s));}
 finally{await ctx.close();await browser.close();}
 rows=dedupe(rows); rows.sort((a,b)=>(a.category+"|"+a.agency_name).localeCompare(b.category+"|"+b.agency_name));
 const out=await exportExcel(rows,path.join(__dirname,"..","output","TRAVEL_BUSINESS_MASTER.xlsx"));
 console.log(`\nDONE: ${rows.length} unique records\n${out}`);
})().catch(e=>{console.error(e);process.exit(1)});
