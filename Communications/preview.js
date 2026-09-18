const $=id=>document.getElementById(id);
const channels=[{"name": "General distress", "medium": "Subspace", "value": "24.3 SSC", "description": ""}, {"name": "Terran Space Command \u00b7 Earth", "medium": "Subspace", "value": "10.0 SSC", "description": ""}, {"name": "Earth Orbital Station", "medium": "Subspace", "value": "12.1 SSC", "description": ""}, {"name": "Ross Orbital Station", "medium": "Subspace", "value": "12.2 SSC", "description": ""}, {"name": "Sol system general traffic", "medium": "Subspace", "value": "16.0 SSC", "description": ""}, {"name": "Earth orbital traffic", "medium": "Subspace", "value": "16.1 SSC", "description": ""}, {"name": "Ross Prime orbital traffic", "medium": "Subspace", "value": "16.2 SSC", "description": ""}, {"name": "Fleet operations", "medium": "Subspace", "value": "18.0 SSC", "description": ""}, {"name": "Earth Orbit PI", "medium": "Subspace", "value": "20.1 SSC", "description": "Planetary contact and entry permission information."}, {"name": "Ross Prime Orbit PI", "medium": "Subspace", "value": "20.2 SSC", "description": "Planetary contact and entry permission information."}, {"name": "General distress", "medium": "RF", "value": "224.5 MHz", "description": ""}, {"name": "Terran Space Command \u00b7 Earth", "medium": "RF", "value": "227.0 MHz", "description": ""}, {"name": "Earth Orbital Station", "medium": "RF", "value": "229.5 MHz", "description": ""}, {"name": "Ross Orbital Station", "medium": "RF", "value": "232.0 MHz", "description": ""}, {"name": "Sol system general traffic", "medium": "RF", "value": "234.5 MHz", "description": ""}, {"name": "Earth orbital traffic", "medium": "RF", "value": "237.0 MHz", "description": ""}, {"name": "Ross Prime orbital traffic", "medium": "RF", "value": "239.5 MHz", "description": ""}, {"name": "Fleet operations", "medium": "RF", "value": "242.0 MHz", "description": ""}, {"name": "Earth Orbit PI", "medium": "RF", "value": "244.5 MHz", "description": "Planetary contact and entry permission information."}, {"name": "Ross Prime Orbit PI", "medium": "RF", "value": "247.0 MHz", "description": "Planetary contact and entry permission information."}];
const samples=[
 {name:'Civil distress call',origin:'Cargo ship Meridian',system:'Alpha Centauri',type:'Multicast',medium:'Subspace',frequency:'24.3 SSC',encrypted:false,distance:25000000,content:'Civil distress. Propulsion offline. Requesting assistance from nearby vessels.'},
 {name:'Orbital traffic control',origin:'Ross Orbital Station',system:'Ross',destination:'TNS Discovery',type:'Point to point',medium:'Subspace',frequency:'18.0 SSC',encrypted:false,distance:85000,content:'Discovery, orbital traffic control is standing by for your approach request.'},
 {name:'Encrypted fleet traffic',origin:'Space Command',system:'Sol',destination:'Patrol ship Resolute',type:'Point to point',medium:'Subspace',frequency:'18.0 SSC',encrypted:true,distance:4e13},
 {name:'Local distress signal',origin:'Survey shuttle Kepler',system:'Ross',type:'Unicast',medium:'RF',frequency:'224.5 MHz',encrypted:false,distance:45000,content:'Survey shuttle Kepler requesting recovery. Beacon transmitting on civil distress frequency.'},
 {name:'RF navigation signal',origin:'Ross surface relay',system:'Ross',type:'Multicast',medium:'RF',frequency:'224.5 MHz',encrypted:false,distance:125000,content:'Surface relay transmission. Local approach information available.'},
 {name:'Private carrier',origin:'Unidentified vessel',system:'Unknown',destination:'Unresolved',type:'Point to point',medium:'RF',frequency:'224.5 MHz',encrypted:true,distance:90000},
 {name:'Survey report',origin:'Science vessel Horizon',system:'Alpha Centauri',type:'Unicast',medium:'Subspace',frequency:'18.0 SSC',encrypted:false,distance:1e12,content:'Survey observations recorded. Preparing to transmit the next data packet.'}
];
samples.forEach((r,i)=>{r.returnChannel=(51+i*.1).toFixed(1)+' SSC';});
let rows=[],selected=0,filter='all',systemFilter='all',rfRange=100000000,nextId=0;
function visible(){return rows.filter(r=>Date.now()-(r.sentAt||0)<=300000&&(filter==='all'||r.medium===filter)&&signalVisible(r)&&(r.medium!=='RF'||rfRange===null||r.distance<=rfRange)).sort((a,b)=>b.sentAt-a.sentAt);}
function render(){const list=visible();if(selected!==null&&!rows.some(r=>r.id===selected))selected=null;$('count').textContent=list.length;$('transmissions').replaceChildren();for(const r of list){const b=document.createElement('button');b.className='transmission'+(r.id===selected?' selected':'');b.setAttribute('aria-pressed',String(r.id===selected));const top=document.createElement('span');top.className='topline';top.textContent=r.medium.toUpperCase()+' · '+r.type.toUpperCase();const title=document.createElement('b');title.textContent=r.origin;const sub=document.createElement('small');sub.textContent=r.system+' · '+r.frequency+' · '+(r.encrypted?'ENCRYPTED':'OPEN');const coordinates=document.createElement('small');coordinates.className='origin-coordinates';coordinates.textContent=originCoordinates(r);const badge=document.createElement('span');badge.className='detection-security';badge.textContent=r.encrypted?'ENCRYPTED':'OPEN';top.append(badge);b.append(top,title,sub,coordinates);if(r.type==='Point to point'){const target=document.createElement('small');target.textContent='Target · '+(r.destination||'Unknown');b.append(target);}const time=document.createElement('small');time.textContent=new Date(r.sentAt).toLocaleString();b.append(time);b.onclick=()=>{if(selected===r.id){selected=null;selectedMapPoint=null;}else{selected=r.id;selectedMapPoint={...endpoints(r).a,name:r.origin||'Unknown origin',transmissionId:r.id};}render();if(!$('commsView').hidden)populateContact();};$('transmissions').append(b);}const r=rows.find(r=>r.id===selected);$('title').textContent=r?.name??'No transmission selected';$('medium').textContent=r?r.medium.toUpperCase()+' TRANSMISSION':'';$('channel').textContent=r?.frequency??'';$('security').textContent=r?(r.encrypted?'ENCRYPTED':'OPEN'):'';$('security').className='badge'+(r?.encrypted?' encrypted':'');$('type').textContent=r?.type??'—';$('origin').textContent=r?.origin??'—';$('frequency').textContent=r?.frequency??'—';$('destinationRow').hidden=r?.type!=='Point to point';$('destination').textContent=r?.destination??'';$('content').textContent=r?(r.encrypted?'Encrypted transmission. Message content unavailable.':r.content):'Select a transmission to view its content.';$('rangeNote').textContent=rfRange===null?'RF range pending confirmation · sample detections are not range-filtered':'RF range · '+(rfRange/1e9)+' BKM · '+rfRange.toLocaleString()+' km | Subspace · unlimited';drawSignalMap();}
function reset(){rows=samples.map((r,i)=>({...r,id:nextId++,sentAt:Date.now()-i*25000}));selected=rows[0].id;filter='all';systemFilter='all';document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));render();}
for(const b of document.querySelectorAll('[data-filter]'))b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));render();};
$('reset').onclick=reset;$('add').onclick=()=>{rows.unshift({...samples[nextId%samples.length],id:nextId++,sentAt:Date.now()});render();renderFrequencies();};$('configure').onclick=()=>{$('range').value=rfRange??'';$('settings').showModal();};$('range').oninput=()=>{$('conversion').textContent=Number($('range').value)/1e9+' BKM';};$('cancel').onclick=()=>$('settings').close();$('save').onclick=()=>{const value=Number($('range').value);if($('range').value!==''&&Number.isFinite(value)&&value>=0){rfRange=value;$('settings').close();render();}};
let frequencyMedium='Subspace';
function renderFrequencies(){
 const query=$('frequencySearch').value.trim().toLowerCase();
 const advertised=rows.filter(r=>r.medium==='Subspace'&&r.type!=='Point to point'&&r.returnChannel&&inMap(endpoints(r).a)).map(r=>({name:r.origin,medium:'Subspace',value:r.returnChannel,advertised:true,description:'Advertised ship contact channel'}));
 const matches=[...channels,...advertised].filter(c=>c.medium===frequencyMedium&&frequencyInView(c)&&c.name.toLowerCase().includes(query));
 $('frequencyCount').textContent=matches.length+' frequencies';
 $('frequencies').replaceChildren(...matches.map(c=>{const div=document.createElement('div');div.className='frequency';div.tabIndex=0;div.setAttribute('role','button');const tune=()=>{openCommunication({recipient:c.name,medium:c.medium,channel:c.value});showComms();};div.onclick=tune;div.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tune();}};const title=document.createElement('b');title.textContent=c.name;const value=document.createElement('strong');value.textContent=c.value;const medium=document.createElement('small');medium.textContent=c.medium.toUpperCase()+' · DEMO CHANNEL';div.append(title,value,medium);if(c.description){const description=document.createElement("p");description.className="muted";description.textContent=c.description;div.append(description);}return div;}));
 if(!matches.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='No matching frequencies.';$('frequencies').append(empty);}
 document.querySelectorAll('[data-frequency-medium]').forEach(b=>{const active=b.dataset.frequencyMedium===frequencyMedium;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
}
$('frequencySearch').oninput=renderFrequencies;
document.querySelectorAll('[data-frequency-medium]').forEach(b=>b.onclick=()=>{frequencyMedium=b.dataset.frequencyMedium;renderFrequencies();});
renderFrequencies();

let frame=0;function animate(){frame++;const points=[];for(let x=0;x<=800;x+=4){const envelope=Math.exp(-Math.pow((x-400)/230,2));points.push((x===0?'M':'L')+x+' '+(50+Math.sin(x*.11+frame*.06)*Math.cos(x*.024)*30*envelope));}$('waveform').setAttribute('d',points.join(' '));requestAnimationFrame(animate);}reset();animate();

function setAnalysisView(map){
 $('mapView').hidden=!map;$('transmissionView').hidden=map;
 $('mapTab').setAttribute('aria-selected',String(map));$('transmissionTab').setAttribute('aria-selected',String(!map));
 if(map)drawSignalMap();
}
$('mapTab').onclick=()=>setAnalysisView(true);
$('transmissionTab').onclick=()=>setAnalysisView(false);

function frequencyInView(c){
 if(c.advertised)return true;
 if(c.name==='General distress'||c.name==='Fleet operations')return true;
 const system=c.name.includes('Ross')?'Ross':'Sol';
 return inMap(anchor(system));
}
function showComms(){
 $('mapView').hidden=true;$('transmissionView').hidden=true;$('commsView').hidden=false;
 ['mapTab','transmissionTab','commsTab'].forEach(id=>$(id).setAttribute('aria-selected',String(id==='commsTab')));
}
$('commsTab').onclick=()=>{
 const r=rows.find(r=>r.id===selected);
 if(r){$('contactSummary').textContent='Contact: '+r.origin;$('recipient').value=r.origin;$('sendMedium').value=r.medium;
 $('sendChannel').value=r.type==='Point to point'?'':(r.returnChannel||r.frequency);
 }
 showComms();
};
for(const id of ['mapTab','transmissionTab']){const handler=$(id).onclick;$(id).onclick=()=>{$('commsView').hidden=true;$('commsTab').setAttribute('aria-selected','false');handler();};}
$('sendType').onchange=()=>{if($('sendType').value==='Unicast'&&$('sendMedium').value==='Subspace')$('sendChannel').value='0';};
$('sendTransmission').onclick=()=>{
 const message=$('sendMessage').value.trim(),recipient=$('recipient').value.trim(),channel=$('sendChannel').value.trim(),type=$('sendType').value;
 if(!message||!channel||(type==='Point to point'&&!recipient)){$('sendStatus').textContent='Enter a message, channel, and a recipient for point-to-point contact.';return;}
 const displayedChannel=Number(channel)===0?($('sendMedium').value==='RF'?'All RF frequencies':'All subspace channels'):channel;
 const line=document.createElement('p');line.textContent='TNS Discovery → '+(recipient||'All listeners')+' · '+type+' · '+displayedChannel+' — '+message+($('sendMedium').value==='Subspace'&&type==='Unicast'?' · Return channel: '+$('ownChannel').value+' SSC':'');
 $('conversation').append(line);$('sendMessage').value='';$('sendStatus').textContent='Transmission sent in demo.';
};

const originalCommsClick=$('commsTab').onclick;
$('commsTab').onclick=()=>{originalCommsClick();const r=rows.find(r=>r.id===selected);$('conversation').replaceChildren();if(r){const line=document.createElement('p');line.textContent=r.origin+' — '+(r.encrypted?'Encrypted content unavailable.':r.content||'Contact beacon');$('conversation').append(line);}};

let broadcastEnabled=true;
function renderBroadcast(){ $('broadcastToggle').setAttribute('aria-pressed',String(broadcastEnabled));$('broadcastStatus').textContent=broadcastEnabled?'Contact channel broadcast enabled.':'Contact channel broadcast disabled.';}
$('broadcastToggle').onclick=()=>{if(!$('ownChannel').checkValidity()||!$('ownChannel').value){$('ownChannel').reportValidity();return;}broadcastEnabled=!broadcastEnabled;renderBroadcast();};
$('ownChannel').onchange=()=>{if(!$('ownChannel').value||!$('ownChannel').checkValidity()){$('ownChannel').value='42.7';}$('broadcastStatus').textContent='Return channel set to '+$('ownChannel').value+' SSC.';};
$('settingsTab').onclick=()=>{for(const id of ['mapView','transmissionView','commsView'])$(id).hidden=true;$('broadcastSettingsView').hidden=false;for(const id of ['mapTab','transmissionTab','commsTab','settingsTab'])$(id).setAttribute('aria-selected',String(id==='settingsTab'));};
for(const id of ['mapTab','transmissionTab','commsTab']){const previous=$(id).onclick;$(id).onclick=()=>{$('broadcastSettingsView').hidden=true;$('settingsTab').setAttribute('aria-selected','false');previous();};}
const previousShowComms=showComms;showComms=function(){$('broadcastSettingsView').hidden=true;$('settingsTab').setAttribute('aria-selected','false');previousShowComms();};
renderBroadcast();

function populateContact(){
 const r=rows.find(r=>r.id===selected);
 $('recipient').value=r?.origin||'';
 $('sendChannel').value=r?(r.returnChannel||''):'';
 $('contactSummary').textContent=r?'Contact: '+r.origin:'Select a transmission or standard frequency.';
 if(r)$('sendMedium').value=r.medium;
}

setInterval(()=>{render();renderFrequencies();},1000);

// Discovery-only settings; no connection to another demo.
for(const id of ['viewScreenSrsRange','viewScreenLrsRange']){
 $(id).onchange=()=>{$('viewScreenStatus').textContent='View screen settings updated for this preview.';};
}

document.querySelectorAll('[data-view-mode]').forEach(button=>button.onclick=()=>{document.querySelectorAll('[data-view-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));});
document.querySelectorAll('[data-view-filter]').forEach(button=>button.onclick=()=>button.setAttribute('aria-pressed',String(button.getAttribute('aria-pressed')!=='true')));
