
const {chromium}=require("playwright");
async function createBrowser(){return chromium.launch({headless:process.env.HEADLESS!=="false",args:["--no-sandbox","--disable-dev-shm-usage"]})}
async function createContext(browser){return browser.newContext({viewport:{width:1440,height:900},locale:"en-IN",timezoneId:"Asia/Kolkata",userAgent:process.env.USER_AGENT||"Mozilla/5.0 Chrome/140 Safari/537.36"})}
module.exports={createBrowser,createContext};
