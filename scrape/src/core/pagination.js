
function pageUrl(start,p,pn){const u=new URL(start);if(p&&p.type==="query")u.searchParams.set(p.param||"page",String(pn));return u.toString()}
module.exports={pageUrl};
