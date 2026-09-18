
const {clean,firstEmail,firstPhone,websiteFromHref}=require("../core/utils");

async function scrapeNidhiPage(page,source,pageNo){
 await page.waitForLoadState("domcontentloaded").catch(()=>{}); await page.waitForTimeout(900);
 const raw=await page.evaluate(({source,pageNo})=>{
  const c=v=>String(v||"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim();
  const er=/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, pr=/(?:\+91[\s.-]?)?[6-9]\d{9}/;
  const els=[]; for(const s of ["article",".card","[class*='card']","[class*='listing']","[class*='result']","li","tr"])
   for(const e of document.querySelectorAll(s)){const t=c(e.innerText);if(t.length>=30&&t.length<5000&&(er.test(t)||pr.test(t)))els.push(e)}
  return [...new Set(els)].map(e=>{
   const t=c(e.innerText);
   const ns=[...e.querySelectorAll("h1,h2,h3,h4,h5,h6,strong,b,[class*='title'],[class*='name']")].map(x=>c(x.innerText)).filter(x=>x&&x.length<250&&!er.test(x)&&!pr.test(x));
   const links=[...e.querySelectorAll("a")].map(a=>a.href||"");
   return {name:ns[0]||t.split("\n")[0]||"",text:t,links,category:source.category,source:source.name,url:location.href,page:pageNo};
  });
 },{source,pageNo});
 return raw.map(r=>{
  const website=r.links.map(websiteFromHref).find(Boolean)||"";
  const email=firstEmail(r.text), phone=firstPhone(r.text);
  const address=clean(r.text.replace(r.name,"").replace(email,"").replace(phone,"").replace(/View Details/gi,""));
  return {agency_name:clean(r.name),email,phone,website,address,city:"",district:"",state:"",pincode:(r.text.match(/\b\d{6}\b/)||[""])[0],category:r.category,source:r.source,source_url:r.url,page:r.page};
 });
}
module.exports={scrapeNidhiPage};
