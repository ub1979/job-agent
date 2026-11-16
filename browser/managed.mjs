import {chromium} from '../web/node_modules/playwright-core/index.mjs';
import {fillApplication} from '../browser-extension/fill.js';
import readline from 'node:readline';
let context;
const pages=new Map();
async function browser(){
 if(context)return context;
 const headless=process.env.JOB_AGENT_BROWSER_HEADLESS==='1';
 for(const channel of headless?[undefined]:['chrome','msedge',undefined]){
  try{context=await chromium.launchPersistentContext(process.argv[2],{headless,channel,viewport:null});break;}catch{}
 }
 if(context)context.on('close',()=>{context=null;pages.clear();});
 if(!context)throw new Error('No supported browser could start. Install Chrome or Edge on this computer, then retry.');
 return context;
}
async function run(request){
 const key=request.key;
 if(request.command==='close'){if(context)await context.close();context=null;return {closed:true};}
 if(request.command==='open'){
  const ctx=await browser();
  let page=pages.get(key);
  if(!page||page.isClosed()){page=await ctx.newPage();pages.set(key,page);}
  page.on('popup',popup=>pages.set(key,popup));
  await page.goto(request.url,{waitUntil:'domcontentloaded',timeout:45000});
  await page.bringToFront();
  const result={url:page.url(),title:await page.title(),filled:[],skipped:[]};
  if(request.bundle){
   if(new URL(page.url()).origin!==request.bundle.origin){result.skipped.push('The site redirected. Review the destination, log in or open its application form, then choose Fill current application page.');return result;}
   Object.assign(result,await page.evaluate(fillApplication,request.bundle));
  }
  return result;
 }
 const page=pages.get(key);
 if(!page||page.isClosed())throw new Error('Open the application browser first.');
 await page.bringToFront();
 if(request.command==='status')return {url:page.url(),title:await page.title()};
 if(request.approved_url!==page.url())throw new Error('The browser page changed. Refresh the browser status and check its destination first.');
 if(!/^https?:$/.test(new URL(page.url()).protocol))throw new Error('Only http(s) application pages are supported.');
 if(request.command==='fill')return {url:page.url(),title:await page.title(),...await page.evaluate(fillApplication,{...request.bundle,origin:new URL(page.url()).origin})};
 if(request.command==='selection')return {url:page.url(),title:await page.title(),text:await page.evaluate(()=>window.getSelection()?.toString()||'')};
 throw new Error('Unknown browser operation.');
}
for await(const line of readline.createInterface({input:process.stdin,crlfDelay:Infinity})){
 try{const request=JSON.parse(line);console.log(JSON.stringify({result:await run(request)}));if(request.command==='close')break;}
 catch(error){const safe=/No supported browser|Open the application|page changed|Only http|Unknown browser/.test(error.message)?error.message:'The browser could not complete this step. Check the browser window and try again.';console.log(JSON.stringify({error:safe}));}
}
if(context)await context.close();
