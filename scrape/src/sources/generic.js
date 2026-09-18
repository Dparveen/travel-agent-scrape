
const {clean,firstEmail,firstPhone,websiteFromHref}=require("../core/utils");
async function scrapeGenericPage(page,source,pageNo){
 const raw=await page.evaluate(({source,pageNo})=>{
  const c=v=>String(v||"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim(), er=/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,pr=/(?:\+91[\s.-]?)?[6-9]\d{9}/,out=[];
  for(const s of ["article","[class*='card']","[class*='listing']","[class*='result']","li","tr"])
   for(const e of document.querySelectorAll(s)){const t=c(e.innerText);if(t.length>20&&t.length<4000&&(er.test(t)||pr.test(t)))out.push({text:t,name:c((e.querySelector("h1,h2,h3,h4,h5,h6,strong,b")||{}).innerText)||t.split("\n")[0],links:[...e.querySelectorAll("a")].map(a=>a.href||"")})}
  return [...new Set(out.map(x=>JSON.stringify(x)))].map(JSON.parse).map(x=>({...x,category:source.category,source:source.name,url:location.href,page:pageNo}));
 },{source,pageNo});
 return raw.map(r=>({agency_name:clean(r.name),email:firstEmail(r.text),phone:firstPhone(r.text),website:r.links.map(websiteFromHref).find(Boolean)||"",address:clean(r.text),city:"",district:"",state:"",pincode:(r.text.match(/\b\d{6}\b/)||[""])[0],category:r.category,source:r.source,source_url:r.url,page:r.page}));
}
module.exports={scrapeGenericPage};
