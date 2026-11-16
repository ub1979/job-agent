import {fillApplication} from './fill.js';
let bundle=null;
const $=id=>document.getElementById(id);
const report=message=>{$('report').textContent=message;};
$('load').onclick=async()=>{
  bundle=null;$('fill').disabled=true;$('summary').hidden=true;report('Loading…');
  try{
    const base=new URL($('server').value);
    if(base.protocol!=='http:'||!['localhost','127.0.0.1'].includes(base.hostname)||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw new Error('Use Job Agent’s localhost address, e.g. http://127.0.0.1:9210.');
    const response=await fetch(base.origin+'/api/browser/package',{headers:{Authorization:'Bearer '+$('code').value.trim()},cache:'no-store'});
    if(!response.ok)throw new Error('Code invalid or expired. Create another code in Job Agent.');
    const data=await response.json();
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab?.url || new URL(tab.url).origin!==data.origin)throw new Error('This tab differs from the approved application site. Create a code using this form’s URL.');
    bundle=data;
    if(data.kind==='evidence_capture'){ $('summary').textContent='Import selected text from '+data.origin; $('summary').hidden=false;$('fill').textContent='Read my selected text';$('fill').disabled=false;report('Select the profile information on the page first, then choose Read my selected text. Nothing will be sent until you preview it and click Send.');return; }
    $('fill').textContent='Fill this page & attach documents';$('summary').textContent=`${data.job_title} — ${data.company}\nDestination: ${data.origin}\nDocuments: ${data.documents.map(d=>d.title).join(', ')}`;$('summary').hidden=false;$('fill').disabled=false;report('Ready. Review this destination and your selected documents, then choose Fill.');
  }catch(error){report(error.message);}
};
$('fill').onclick=async()=>{
  if(!bundle)return;$('fill').disabled=true;
  try{
    if(Date.now()/1000>bundle.expires_at)throw new Error('Code expired. Create a new package in Job Agent.');
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(bundle.kind==='evidence_capture'){
      const results=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>({text:window.getSelection()?.toString()||'',title:document.title,url:location.href})});
      const selection=results[0].result;
      if(new URL(selection.url).origin!==bundle.origin)throw new Error('This page differs from the approved profile site.');
      if(!selection.text.trim())throw new Error('Select the profile text on the page, then reopen the extension and load the code again.');
      if(selection.text.length>50000)throw new Error('Select less than 50,000 characters at a time.');
      bundle.selection=selection;$('preview').value=selection.text;$('preview').hidden=false;$('send').hidden=false;report('Review/edit the selected text below. Send copies it only to your local Job Agent as a pending finding.');return;
    }
    const results=await chrome.scripting.executeScript({target:{tabId:tab.id},func:fillApplication,args:[bundle]});
    const result=results[0].result;
    report(`Filled ${result.filled.length} fields/attachments:\n${result.filled.join('\n')}\n\nNeeds your review:\n${result.skipped.join('\n')||'Check all fields and attachments.'}\n\n${result.notice}`);
  }catch(error){report(error.message);}
};

$('send').onclick=async()=>{
  try{
    if(!bundle?.selection || Date.now()/1000>bundle.expires_at)throw new Error('Load a valid profile import code first.');
    const base=new URL($('server').value);
    if(base.protocol!=='http:'||!['127.0.0.1','localhost'].includes(base.hostname))throw new Error('Use your local Job Agent address.');
    const response=await fetch(base.origin+'/api/browser/evidence',{method:'POST',headers:{'Authorization':'Bearer '+$('code').value.trim(),'Content-Type':'application/json','X-Job-Agent':'1'},body:JSON.stringify({text:$('preview').value,title:bundle.selection.title.slice(0,200)||'Selected profile text',source_url:bundle.selection.url})});
    if(!response.ok)throw new Error('Import failed or code expired. Create a new code.');
    $('send').disabled=true;report('Sent as a pending finding. In Job Agent, refresh My profile or choose Refresh imported findings, then review and approve it. It is not approved for AI use yet.');
  }catch(error){report(error.message);}
};
