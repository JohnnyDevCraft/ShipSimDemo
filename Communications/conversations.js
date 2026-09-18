// Independent local demo conversations. No network transmission is performed.
let communications=[],activeCommunication=null,communicationSequence=0;
function currentCommunication(){return communications.find(c=>c.id===activeCommunication);}
function saveCommunicationDraft(){
 const c=currentCommunication();if(!c)return;
 Object.assign(c,{recipient:$('recipient').value,channel:$('sendChannel').value,medium:$('sendMedium').value,type:$('sendType').value,draft:$('sendMessage').value,encrypted:$('encryptCommunication').checked});
}
function renderCommunicationList(){
 $('activeCommunications').replaceChildren();
 for(const c of communications.filter(c=>!c.terminated)){
  const button=document.createElement('button');button.className='communication-item'+(c.id===activeCommunication?' active':'');
  button.setAttribute('aria-pressed',String(c.id===activeCommunication));
  const name=document.createElement('strong');name.textContent=c.recipient||'New communication';
  const detail=document.createElement('small');detail.textContent=c.medium+' · '+(c.channel||'Channel unset');
  button.append(name,detail);button.onclick=()=>{saveCommunicationDraft();activeCommunication=c.id;renderCommunication();};
  $('activeCommunications').append(button);
 }
 if(!communications.some(c=>!c.terminated)){const empty=document.createElement('p');empty.className='muted';empty.textContent='No active communications.';$('activeCommunications').append(empty);}
 $('terminateCommunication').disabled=!currentCommunication();
}
function renderCommunication(){
 const c=currentCommunication();
 $('recipient').value=c?.recipient||'';$('sendChannel').value=c?.channel||'';$('sendMedium').value=c?.medium||'Subspace';$('sendType').value=c?.type||'Unicast';$('sendMessage').value=c?.draft||'';
 $('contactSummary').textContent=c?(c.recipient?'Contact: '+c.recipient:'New communication'):'Start a new communication with +, or select a detected transmission.';
 applyCommunicationRules();
 $('sendStatus').textContent='';$('conversation').replaceChildren();
 $('encryptCommunication').checked=!!c?.encrypted;
 for(const message of c?.messages||[]){const line=document.createElement('p');line.textContent=message;$('conversation').append(line);}
 renderCommunicationList();
}
function openCommunication(seed={},forceNew=false){
 saveCommunicationDraft();
 let c=!forceNew&&communications.find(c=>!c.terminated&&c.channel===seed.channel&&c.medium===seed.medium&&(seed.channel!=='0'||c.recipient===seed.recipient));
 if(!c){c={id:++communicationSequence,recipient:'',channel:'',medium:'Subspace',type:'Unicast',draft:'',encrypted:false,messages:[],...seed};communications.push(c);}
 activeCommunication=c.id;renderCommunication();
}
populateContact=function(){
 const r=rows.find(r=>r.id===selected);if(!r)return;
 openCommunication({recipient:r.origin==='TNS Discovery'?(r.destination||'Unknown origin'):(r.origin||'Unknown origin'),channel:r.returnChannel||r.frequency||'0',type:r.returnChannel||r.type==='Point to point'?'Point to point':'Unicast',medium:r.medium,messages:[r.origin+' — '+(r.encrypted?'Encrypted content unavailable.':r.content||'Contact beacon')]});
};
$('commsTab').onclick=()=>{showComms();if(!currentCommunication()&&selected!==null)populateContact();else renderCommunication();};
$('newCommunication').onclick=()=>openCommunication({},true);
$('terminateCommunication').onclick=()=>{
 const c=currentCommunication();if(!c)return;
 saveCommunicationDraft();c.terminated=true;
 activeCommunication=communications.find(c=>!c.terminated)?.id??null;renderCommunication();
};
for(const id of ['recipient','sendChannel','sendMedium','sendType','sendMessage','encryptCommunication']){
 $(id).addEventListener('input',()=>{saveCommunicationDraft();renderCommunicationList();});
 $(id).addEventListener('change',()=>{saveCommunicationDraft();renderCommunicationList();});
}
$('sendTransmission').onclick=()=>{
 if(!currentCommunication()){$('sendStatus').textContent='Start a communication with + first.';return;}
 saveCommunicationDraft();const c=currentCommunication();
 applyCommunicationRules();saveCommunicationDraft();
 const message=c.draft.trim(),channel=c.channel.trim();
 if(!message||!channel||(c.type!=='Unicast'&&Number(channel)===0)||(c.type==='Point to point'&&!c.recipient.trim())){$('sendStatus').textContent='Enter a message and a nonzero channel for Multicast or Point-to-point; Point-to-point also needs a recipient.';return;}
 const display=Number(channel)===0?(c.medium==='RF'?'All RF frequencies':'All subspace channels'):channel;
 c.messages.push('TNS Discovery → '+(c.recipient||'All listeners')+' · '+c.type+' · '+display+(c.encrypted?' · ENCRYPTED':' · OPEN')+' — '+message+(c.medium==='Subspace'&&c.type==='Unicast'?' · Return channel: '+$('ownChannel').value+' SSC':''));
 const source=rows.find(r=>r.origin===c.recipient);
 rows.unshift({id:nextId++,name:'Outgoing communication',origin:'TNS Discovery',destination:c.recipient,type:c.type,medium:c.medium,frequency:channel,returnChannel:$('ownChannel').value+' SSC',encrypted:c.encrypted,content:message,sentAt:Date.now(),distance:0,system:'Ross',position:{...demoShipPosition},targetPosition:c.type==='Point to point'&&source?endpoints(source).a:null});render();
 c.draft='';renderCommunication();$('sendStatus').textContent='Transmission sent in demo.';
};
const resetCommunications=$('reset').onclick;
$('reset').onclick=()=>{resetCommunications();communications=[];activeCommunication=null;renderCommunication();};
renderCommunication();

function applyCommunicationRules(){
 const unicast=$('sendType').value==='Unicast',pointToPoint=$('sendType').value==='Point to point';
 $('sendChannel').disabled=unicast;
 if(unicast)$('sendChannel').value='0';
 $('encryptCommunication').disabled=!pointToPoint;
 if(!pointToPoint){$('encryptCommunication').checked=false;const c=currentCommunication();if(c)c.encrypted=false;}
}
$('sendType').onchange=()=>{applyCommunicationRules();saveCommunicationDraft();renderCommunicationList();};
applyCommunicationRules();
