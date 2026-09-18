
const clean=v=>v==null?"":String(v).replace(/\u00a0/g," ").replace(/\s+/g," ").trim();
const normalize=v=>clean(v).toLowerCase();
const firstEmail=t=>(clean(t).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)||[""])[0].toLowerCase();
const firstPhone=t=>(clean(t).match(/(?:\+91[\s.-]?)?[6-9]\d{9}/)||[""])[0].replace(/\D/g,"").replace(/^91(?=\d{10}$)/,"");
const websiteFromHref=h=>{try{const u=new URL(h);return ["http:","https:"].includes(u.protocol)?u.href:""}catch{return""}};
function key(r){if(r.phone)return"phone:"+normalize(r.phone);if(r.email)return"email:"+normalize(r.email);if(r.website)return"web:"+normalize(r.website);return"name:"+normalize(r.agency_name)+"|"+normalize(r.address)}
function dedupe(rows){const m=new Map();for(const r of rows){const k=key(r);if(!k)continue;if(!m.has(k))m.set(k,r);else for(const f of Object.keys(r))if(!m.get(k)[f]&&r[f])m.get(k)[f]=r[f]}return [...m.values()]}
module.exports={clean,normalize,firstEmail,firstPhone,websiteFromHref,dedupe};
