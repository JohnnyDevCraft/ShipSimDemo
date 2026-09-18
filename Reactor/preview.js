const $=id=>document.getElementById(id);
const scenario={load:Math.round(70+Math.random()*40), confinementBase:3+Math.random()*2, confinementSlope:26+Math.random()*8};
$('loadValue').textContent=scenario.load+' PU';
$('beam').value=(scenario.confinementBase+scenario.confinementSlope*.6).toFixed(1);
let reaction=108,online=true,ejected=false,battery=8600,startup=0,shutdown=0,temperature=40;
let shutdownSequence=null,startupDuration=100,containmentRiskElapsed=0;
let fuelAvailable=10800,fuelGaugeCapacity=10800,refilling=false;
let exploded=false,repairing=false,repairElapsed=0,lastDamage=0;
const faults=[];
const faultLabels={coolant:'Coolant flow reduced to one third',beam:'Confinement effectiveness −15%',collector:'Collector angle limited to 50°',leak:'Fuel leak: double consumption',injector:'Injector restriction: half chamber flow'};
const hasFault=id=>faults.includes(id);
function setDamage(value){
 const next=Math.max(0,Math.min(100,value));
 for(let threshold=30;threshold<=80;threshold+=10){
  if(lastDamage<threshold&&next>=threshold){
   const choices=['coolant','beam','collector','fuel'].filter(k=>k==='fuel'?!hasFault('leak')&&!hasFault('injector'):!hasFault(k));
   if(choices.length){let selected=choices[Math.floor(Math.random()*choices.length)];if(selected==='fuel')selected=Math.random()<.5?'leak':'injector';faults.push(selected);}

  }
 }
 lastDamage=next;$('damage').value=next.toFixed(2);
 if(next>=100&&!ejected){exploded=true;shutdownSequence=null;online=false;reaction=0;startup=0;shutdown=0;repairing=false;}
}
$('takeDamage').onclick=()=>{if(!ejected&&!exploded)setDamage(lastDamage+10);};
$('repair').onclick=()=>{if(!exploded&&!ejected){repairing=!repairing;repairElapsed=0;}};
$('damage').onchange=()=>setDamage(Number($('damage').value)||0);
const ns='http://www.w3.org/2000/svg';
for(let i=0;i<12;i++){const pivot=document.createElementNS(ns,'g');pivot.setAttribute('transform',`translate(400 130) rotate(${i*30}) translate(0 -76)`);const blade=document.createElementNS(ns,'rect');for(const [k,v] of Object.entries({x:-4,y:-15,width:8,height:30,rx:3,fill:'#6ee7df',stroke:'#bffff1'}))blade.setAttribute(k,v);blade.classList.add('collector-blade');pivot.appendChild(blade);$('collectors').appendChild(pivot)}
$('start').onclick=()=>{if(!jobs.size&&!exploded&&!ejected&&!online&&lastDamage<70&&(battery>2000||stationPower())){online=true;startupDuration=100;startup=startupDuration;shutdown=0}};
$('stop').onclick=()=>{if(!online||shutdownSequence)return;shutdownSequence={elapsed:0,duration:Math.max(.1,+$('flow').value/.2),flow:+$('flow').value,angle:+$('angle').value,beam:+$('beam').value,coolant:+$('coolant').value};shutdown=shutdownSequence.duration;};
let docked=false,attached=false,syncState='off',syncRemaining=0,attachRemaining=0;
$('demoDock').onclick=()=>{docked=true;attachRemaining=10;};
$('demoUndock').onclick=()=>{if(attached&&syncState!=='off')setDamage(lastDamage+10);docked=false;attached=false;attachRemaining=0;syncState='off';syncRemaining=0;};
const stationPower=()=>attached&&['on','disconnecting'].includes(syncState);
const chargeThresholds=[0,8000,9000,9500,9700,10000];
function chargeEnergy(energy,seconds){
 for(let i=1;i<chargeThresholds.length&&seconds>0;i++){
  if(energy>=chargeThresholds[i])continue;
  const rate=(chargeThresholds[i]-chargeThresholds[i-1])/300;
  const duration=Math.min(seconds,(chargeThresholds[i]-energy)/rate);
  energy+=duration*rate;seconds-=duration;
 }
 return Math.min(10000,energy);
}
$('coldStart').onclick=()=>{
 docked=true;attached=true;attachRemaining=0;syncState='on';syncRemaining=0;
 containmentRiskElapsed=0;shutdownSequence=null;exploded=false;repairing=false;repairElapsed=0;lastDamage=0;faults.length=0;jobs.clear();online=false;ejected=false;reaction=0;startup=0;shutdown=0;temperature=0;
 refilling=false; battery=10000;scenario.load=0;$('loadValue').textContent='0 PU';
 for(const id of ['flow','angle','beam','coolant','damage'])$(id).value=0;
 $('confirm').close();
};
$('umbilical').onclick=()=>{if(docked&&syncState==='off')attached=!attached;};
$('sync').onclick=()=>{if(!attached)return;if(syncState==='off'){syncState='on';syncRemaining=0;}else if(syncState==='on'){syncState='disconnecting';syncRemaining=10;}};
$('eject').onclick=()=>$('confirm').showModal();$('cancel').onclick=()=>$('confirm').close();$('confirmEject').onclick=()=>{ejected=true;shutdownSequence=null;online=false;reaction=0;shutdown=0;$('confirm').close()};$('reset').onclick=()=>{sessionStorage.setItem('reactorColdReset','1');location.reload();};
setInterval(()=>{
 const damage=Math.max(0,Math.min(100,Number($('damage').value)||0))/100;
 const dt=.1;
 if(!attached)refilling=false;
 if(refilling){fuelAvailable=Math.min(fuelGaugeCapacity,fuelAvailable+fuelGaugeCapacity/600*dt);if(fuelAvailable>=fuelGaugeCapacity)refilling=false;}
 $('refillFuel').hidden=!attached;
 $('refillFuel').disabled=refilling||fuelAvailable>=fuelGaugeCapacity;
 $('refillFuel').textContent=refilling?'Refilling Fuel…':'Refill Fuel';
 if(startup>0&&!ejected&&!exploded){
  const progress=Math.min(1,(startupDuration-startup+dt)/startupDuration);
  $('flow').value=10*progress;
  $('angle').value=15+60*reaction/180;
  const factor=hasFault('beam')?.85:1;
  $('beam').value=(scenario.confinementBase+scenario.confinementSlope*Math.max(+$('flow').value/100,reaction/180))/factor;

 }

 if(shutdownSequence){
  const q=shutdownSequence;q.elapsed=Math.min(q.duration,q.elapsed+dt);
  const progress=q.elapsed/q.duration,remaining=1-progress;
  $('flow').value=q.flow*remaining;
  $('angle').value=(15+60*(q.flow/100)*remaining)*Math.min(1,remaining*10);
  $('beam').value=(scenario.confinementBase+scenario.confinementSlope*(q.flow/100)*remaining)/(hasFault('beam')?.85:1)*Math.min(1,remaining*10);

  if(progress>=1){online=false;reaction=0;shutdown=0;startup=0;shutdownSequence=null;for(const id of ['flow','angle','beam'])$(id).value=0;}
 }
 for(const id of ['flow','angle','beam'])$(id).disabled=!!shutdownSequence||startup>0||ejected||exploded;

 if(docked&&attachRemaining>0){attachRemaining=Math.max(0,attachRemaining-dt);if(attachRemaining<.001){attachRemaining=0;attached=true;}}
 if(repairing){repairElapsed+=dt;if(repairElapsed>=10){repairElapsed=0;const floor=online&&faults.length?40:faults.length*10;setDamage(Math.max(floor,lastDamage-10));if(lastDamage<=floor)repairing=false;}}
 $('repair').textContent=repairing?'Pause Repairs':'Begin Repairs';
 $('repair').disabled=exploded||ejected||lastDamage<=(online&&faults.length?40:faults.length*10)||jobs.size>0;
 $('takeDamage').disabled=exploded||ejected;
 for(const [id,bad] of [['fuelTitle',hasFault('leak')||hasFault('injector')],['coolantTitle',hasFault('coolant')],['beamTitle',hasFault('beam')],['collectorTitle',hasFault('collector')]])$(id).style.color=bad?'#ff5368':'#6edd91';
 $('faultStatus').textContent=exploded?'REACTOR EXPLODED':ejected?'Core ejected':([...new Set(faults)].map(k=>faultLabels[k]).join(' · ')||'No subsystem faults');
 $('angle').max=hasFault('collector')?50:90;if(+$('angle').value>50&&hasFault('collector'))$('angle').value=50;

 if(syncRemaining>0){syncRemaining=Math.max(0,syncRemaining-dt);if(syncRemaining<.001){syncRemaining=0;syncState=syncState==='connecting'?'on':'off';}}
 if(stationPower())battery=chargeEnergy(battery,dt);
 $('umbilicalLight').style.background=attached?'#6edd91':'#ed6371';
 $('umbilicalStatus').textContent=attached?'ATTACHED':'DETACHED';
 $('umbilicalLight').setAttribute('aria-label',attached?'Umbilical attached':'Umbilical detached');
 $('demoDock').disabled=docked;
 $('demoUndock').disabled=!docked;
 $('demoUndock').title=attached||syncState!=='off'?'Undocking while power sync is active causes 10% reactor damage':'';
 $('dockStatus').textContent=docked?'DOCKED':'UNDOCKED';
 $('umbilical').disabled=!docked||syncState!=='off';$('umbilical').textContent=attached?'Detach umbilical · demo':'Attach umbilical · demo';
 $('sync').disabled=!attached||syncRemaining>0;$('sync').textContent=syncState==='on'?'Stop power sync':'Power sync';
 const color=!attached?'#667080':syncState==='off'?'#ed6371':syncState==='on'?'#6edd91':'#efc574';$('syncLight').style.background=color;$('sync').style.borderColor=color;
 const status=syncState==='on'?(battery>=10000?'Station power active · battery full':'Station power active · charging'):syncState==='off'?'Station power disconnected':(syncState==='connecting'?'Synchronizing':'Disconnecting')+' · '+Math.ceil(syncRemaining)+'s';
 $('syncStatus').textContent=status;$('syncLight').setAttribute('aria-label',status);
 const requestedFlow=online&&!ejected&&!exploded?+$('flow').value/100:0;
 const requestedChamberFlow=requestedFlow*(hasFault('injector')?.5:1);
 const burnMultiplier=hasFault('leak')?2:1;
 const flow=Math.min(requestedChamberFlow,fuelAvailable/(dt*burnMultiplier)),fuelBurn=flow*burnMultiplier,angle=+$('angle').value;
 fuelAvailable=Math.max(0,fuelAvailable-fuelBurn*dt);
 $('fuelRemaining').textContent=fuelAvailable.toFixed(2)+' units';
 const enduranceSeconds=fuelBurn>0?Math.floor(fuelAvailable/fuelBurn):null;
 const endurance=enduranceSeconds===null?'—':String(Math.floor(enduranceSeconds/3600)).padStart(2,'0')+':'+String(Math.floor(enduranceSeconds/60)%60).padStart(2,'0')+':'+String(enduranceSeconds%60).padStart(2,'0');
 $('fuelTimeRemaining').textContent=endurance;
 $('fuelTimeRemaining').title=enduranceSeconds===null?'No current fuel consumption':'Time remaining at current fuel consumption';
 fuelGaugeCapacity=Math.max(fuelGaugeCapacity,fuelAvailable);
 $('fuelGauge').style.setProperty('--value',fuelAvailable/fuelGaugeCapacity*100);
 $('fuelGauge').setAttribute('aria-valuemax',fuelGaugeCapacity);
 $('fuelGauge').setAttribute('aria-valuenow',fuelAvailable);
 $('fuelGaugeUnits').textContent=fuelAvailable.toFixed(1).padStart(7,'0');

 startup=Math.max(0,startup-dt);shutdown=Math.max(0,shutdown-dt);
 const target=flow*180;reaction+=(target-reaction)*.06;if(flow===0)reaction=0;if(Math.abs(target-reaction)<.02)reaction=target;
 const active=online||reaction>0||shutdown>0;
 const required=active?scenario.confinementBase+scenario.confinementSlope*Math.max(flow,reaction/180):0,command=!ejected&&!exploded?+$('beam').value:0;
 const best=15+60*reaction/180,angleEfficiency=(55+40*Math.cos((angle-best)*Math.PI/180)**4);
 // Reserve commanded confinement power before exporting electricity to the ship.
 // External supply carries startup, shutdown and an unsustainable main reaction.
 const confinementFactor=(hasFault('beam')?.85:1)*(damage>.7?Math.max(.1,1-(damage-.7)*2*(.75+.25*Math.sin(Date.now()/1700))):1);
 let delivered=command;
 let stability=required>0?Math.max(0,100-100*Math.abs(delivered*confinementFactor-required)/required):0;
 let gross=reaction*angleEfficiency/100*stability/100*(1-damage);
 const external=startup>0||!online||gross<command;
 let source='MAIN REACTOR';
 if(command>0&&external){source=stationPower()?'STATION POWER':'SUPPORT BATTERY';delivered=Math.min(command,stationPower()?command:battery/dt);if(!stationPower())battery=Math.max(0,battery-delivered*dt);}
 if(!active&&command===0)source='OFFLINE';
 stability=required>0?Math.max(0,100-100*Math.abs(delivered*confinementFactor-required)/required):0;
 // Hidden containment failure check, only while a reaction actually exists.
 if(reaction>0&&stability<30&&!ejected&&!exploded){
  containmentRiskElapsed+=dt;
  if(containmentRiskElapsed>=5-1e-9){containmentRiskElapsed=0;if(Math.floor(Math.random()*6)+1===6)setDamage(100);}
 }else containmentRiskElapsed=0;
 const efficiency=angleEfficiency*stability/100;gross=reaction*efficiency/100*(1-damage);
 const coolant=+$('coolant').value, pumpDemand=coolant>0?1+9*(coolant/100)**2:0;
 // Main bus supplies pumps after confinement; emergency sources cover any deficit.
 const busBeforePumps=Math.max(0,gross-(external?0:delivered));
 const pumpDeficit=Math.max(0,pumpDemand-busBeforePumps);
 const emergencyPumpPower=stationPower()?pumpDeficit:Math.min(pumpDeficit,battery/dt);
 if(!stationPower())battery=Math.max(0,battery-emergencyPumpPower*dt);
 const pumpDelivered=Math.min(pumpDemand,busBeforePumps+emergencyPumpPower);
 const effectiveFlow=pumpDemand>0?coolant*pumpDelivered/pumpDemand*(hasFault('coolant')?1/3:1):0;
 // Below 50% stability demand exceeds even a fully powered, healthy pump.
 const instabilityDemand=active?(100-stability)*.6:0;
 const requiredFlow=reaction>0?Math.max(10+70*reaction/180+instabilityDemand,stability<50?110+(50-stability):0):0;
 temperature=Math.max(0,Math.min(150,temperature+(reaction>0?Math.max((requiredFlow-effectiveFlow)*.012+(damage>.7?(damage-.7)*20*(1-stability/100):0),damage>.8?10/300: -Infinity):(-20/600-effectiveFlow*.012))*dt));
 const net=Math.max(0,busBeforePumps-pumpDelivered);
 // Battery energy is PU-seconds; reserve reactor support loads first.
 const reactorCharge=Math.min(Math.max(0,net-scenario.load),Math.max(0,10000-battery)/dt);
 battery=Math.min(10000,battery+reactorCharge*dt);
 $('reactorCharge').textContent=reactorCharge.toFixed(1)+' PU';
 const loadDeficit=Math.max(0,scenario.load-net);
 const batteryAssist=Math.min(loadDeficit,battery/dt);
 battery=Math.max(0,battery-batteryAssist*dt);
 const unmetLoad=Math.max(0,loadDeficit-batteryAssist);
 $('batteryAssist').textContent=batteryAssist.toFixed(1)+' PU';
 $('unmetLoad').textContent=unmetLoad.toFixed(1)+' PU';
 $('unmetLoad').style.color=unmetLoad>0?'#ff5368':'';
 $('coolantValue').textContent=coolant+'% · actual '+effectiveFlow.toFixed(1)+'%';$('coolantRequired').textContent=requiredFlow.toFixed(1)+'%';
 $('pumpPower').textContent=pumpDelivered.toFixed(1)+' PU';$('temperature').textContent=temperature.toFixed(1)+' Cochrane';
 const thermalColor=temperature>=100?'#ed6371':temperature>=80?'#efc574':'#6ee7df';
 $('chamberTemperature').textContent=temperature.toFixed(1)+' Cochrane';$('chamberTemperature').style.color=thermalColor;
 $('temperatureGauge').setAttribute('aria-valuenow',temperature.toFixed(1));
 $('temperatureFill').style.width=(temperature/150*100)+'%';$('temperatureFill').style.background=thermalColor;
 if(temperature>=100&&!ejected&&!exploded)setDamage(lastDamage+(0.1+(temperature-100)*.02)*dt);

 $('coolantNotice').textContent=pumpDelivered<pumpDemand?'Insufficient pump power.':effectiveFlow<requiredFlow?'Cooling deficit — temperature rising.':'Cooling meets thermal demand.';
 $('temperature').style.color=thermalColor;
 if(active&&stability<50)$('coolantNotice').textContent='RUNAWAY: stability below 50%. Maximum coolant cannot prevent heating. Restore confinement or eject core.';
 else if(temperature>=100)$('coolantNotice').textContent='Collectors overheating — active core damage.';
 else if(temperature>=80)$('coolantNotice').textContent='Danger: chamber temperature approaching damage zone.';
 $('flowValue').textContent=flow.toFixed(3);$('fuel').textContent=fuelBurn.toFixed(2)+' /s';$('reaction').textContent=reaction.toFixed(1)+' PU';$('actual').textContent=net.toFixed(1)+' PU';$('gross').textContent=gross.toFixed(1)+' PU';$('balance').textContent=(net>=scenario.load?'+':'')+(net-scenario.load).toFixed(1)+' PU';$('balance').style.color=net<scenario.load?'#ff9eaa':'#6ee7df';
 $('beamValue').textContent=(+$('beam').value).toFixed(1)+' PU';$('requiredBeam').textContent=required.toFixed(1)+' PU';$('source').textContent=source;$('delivered').textContent=delivered.toFixed(1)+' PU';
 $('stability').textContent=stability.toFixed(1)+'%';$('stability').style.color=active&&stability<80?'#ff9eaa':'#6ee7df';$('stabilityMeter').value=stability;
 $('collectorEfficiency').textContent=efficiency.toFixed(1)+'%';$('collectorMeter').value=efficiency;$('effValue').textContent=efficiency.toFixed(1).padStart(5,'0')+'%';
 const saving=efficiency>55?(1-55/efficiency)*100:0;$('savingValue').textContent=saving.toFixed(1).padStart(5,'0')+'%';
 for(const [id,v] of [['effGauge',efficiency],['savingGauge',saving]]){$(id).style.setProperty('--value',v);$(id).setAttribute('aria-valuenow',v.toFixed(1))}
 $('angleValue').textContent=angle+'°';$('bestAngle').textContent=reaction>0?best.toFixed(1)+'°':'—';$('yield').textContent=flow>0?(net/flow).toFixed(1)+' PU·s / unit':'—';
 document.querySelectorAll('.collector-blade').forEach(el=>el.style.transform=`rotate(${angle}deg)`);$('core').style.opacity=reaction/180;
 $('batteryPercent').textContent=(battery/100).toFixed(1);$('batteryMeter').value=battery/100;$('batteryEnergy').textContent=Math.round(battery).toLocaleString()+' PU·s';
 $('notice').textContent=active&&stability<80?'WARNING: plasma stability below 80%. '+(delivered<required?'Increase confinement power.':'Reduce confinement power.'):'Confinement stable. Tune collectors for best energy capture.';
 $('state').textContent=shutdownSequence?'CONTROLLED SHUTDOWN':exploded?'REACTOR EXPLODED':ejected?'CORE EJECTED':startup>0?'INITIALIZING':online?(stability<80?'UNSTABLE':'ONLINE'):active?'SHUTTING DOWN':'OFFLINE';
 $('start').disabled=lastDamage>=70||jobs.size>0||exploded||ejected||online||(!stationPower()&&battery<=2000);$('stop').disabled=!online||!!shutdownSequence||startup>0;$('flow').disabled=ejected||exploded||!!shutdownSequence||startup>0;$('eject').disabled=ejected||exploded;
},100);

$('changeLoad').onclick=()=>{$('requestedLoad').value=scenario.load;$('loadDialog').showModal();$('requestedLoad').focus();};
$('cancelLoad').onclick=()=>$('loadDialog').close();
$('loadForm').onsubmit=e=>{e.preventDefault();if(!$('loadForm').reportValidity())return;scenario.load=Number($('requestedLoad').value);$('loadValue').textContent=scenario.load+' PU';$('loadDialog').close();};


$('umbilical').hidden=true;

// Discovery stand-in for the ship's DOT roster: one assigned DOT per job.
const jobs=new Map();
const components=[['fuelTitle','Fuel injector',['leak','injector'],300],['coolantTitle','Coolant pressure valve',['coolant'],300],['collectorTitle','Collector panels and control arms',['collector'],600],['beamTitle','Magnetic confinement producers',['beam'],600]];
const cold=()=>!online&&!ejected&&!exploded&&!shutdownSequence&&reaction===0&&startup===0&&shutdown===0&&temperature===0&&['flow','beam','coolant','angle'].every(id=>+$(id).value===0);
for(const [id,label,keys,seconds] of components){
 const box=document.createElement('div');box.id=id+'Replacement';box.className='component-repair';
 box.innerHTML=`<button type="button" aria-label="Fabricate and replace ${label}" title="Fabricate and replace ${label}">⚒</button>`;
 const panel=$(id).closest(id==='coolantTitle'?'.coolant-controls':'.panel');panel.style.position='relative';panel.append(box);
 box.querySelector('button').onclick=()=>{
  if(!cold()||!keys.some(hasFault)||jobs.has(id))return;
  const occupied=[...jobs.values()].map(j=>j.dot);if(repairing)occupied.push(1);
  const dot=[1,2,3,4].find(n=>!occupied.includes(n));
  if(!dot){$('noDot').showModal();return;}
  jobs.set(id,{dot,remaining:seconds,keys});
 };

}
const schematic=$('core').closest('svg');const coreStatus=document.createElement('div');coreStatus.style.cssText='padding:70px;text-align:center;font-size:48px;color:#ff6378;border:2px solid;box-shadow:inset 0 0 30px #ed637155;text-shadow:0 0 18px';schematic.after(coreStatus);
const install=document.createElement('button');install.textContent='Install new core · starbase demo';$('reset').before(install);
install.onclick=()=>{if(docked&&attached&&(ejected||exploded)){$('coldStart').click();temperature=0;}};
setInterval(()=>{
 for(const [id,label,keys] of components){const box=$(id+'Replacement'),job=jobs.get(id);box.querySelector('button').disabled=!cold()||!!job||!keys.some(hasFault);box.querySelector('button').title=job?'DOT '+job.dot+' · '+Math.ceil(job.remaining)+'s':!cold()?'Requires cold, offline reactor':'Fabricate and replace '+label;
 if(job){if(cold()){job.remaining=Math.max(0,job.remaining-.1);if(job.remaining<.001){for(let i=faults.length-1;i>=0;i--)if(keys.includes(faults[i]))faults.splice(i,1);setDamage(lastDamage-10);jobs.delete(id);}}} }

 schematic.style.display=ejected||exploded?'none':'';coreStatus.hidden=!ejected&&!exploded;coreStatus.textContent=ejected?'EJECTED':'REACTOR EXPLODED';install.hidden=!ejected&&!exploded;install.disabled=!docked||!attached;
},100);

if(sessionStorage.getItem('reactorColdReset')==='1'){sessionStorage.removeItem('reactorColdReset');$('coldStart').click();}

for(const id of ['flow','angle','beam','coolant'])$(id).step='any';

$('setFuel').onclick=()=>{$('availableFuelInput').value=fuelAvailable.toFixed(2);$('fuelDialog').showModal();$('availableFuelInput').focus();};
$('cancelFuel').onclick=()=>$('fuelDialog').close();
$('fuelForm').onsubmit=e=>{e.preventDefault();if(!$('fuelForm').reportValidity())return;fuelAvailable=Number($('availableFuelInput').value);refilling=false;$('fuelDialog').close();};

$('powerOff').onclick=()=>{if(!online&&reaction===0&&temperature===0&&!startup&&!shutdownSequence){for(const id of ['flow','beam','coolant','angle'])$(id).value=0;}};
setInterval(()=>{$('powerOff').disabled=online||reaction>0||temperature>0||startup>0||!!shutdownSequence;},100);

$('refillFuel').onclick=()=>{if(attached&&fuelAvailable<fuelGaugeCapacity)refilling=true;};
