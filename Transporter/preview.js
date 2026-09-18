'use strict';
// Local discovery state only. This preview does not call ship or simulation APIs.
const $ = id => document.getElementById(id);
let maxPower = 12, minimumPower = 1, busPower = 12, restrictorPercent = 100, fastestSpeed = 12.5;
const availablePower = () => Math.min(busPower, maxPower * restrictorPercent / 100);
let shieldsUp = false, remoteShieldsUp = false;
const externalRoute = () => !['pad','cargo'].includes(sourceId()) || !['pad','cargo'].includes(destinationId());
const remoteShipRoute = () => sourceId() === 'ship' || destinationId() === 'ship';
const shieldBlocked = () => externalRoute() && (shieldsUp || remoteShipRoute() && remoteShieldsUp);
function transferPower() {
  const setting = phase === 'dematerializing' ? +$('dematerialize').value : phase === 'materializing' ? +$('materialize').value : 0;
  return Math.min(availablePower(), setting > 0 ? minimumPower + (maxPower - minimumPower) * setting / 100 : minimumPower);
}
function transferSpeed() {
  const setting = phase === 'dematerializing' ? +$('dematerialize').value : phase === 'materializing' ? +$('materialize').value : 0;
  if (!setting || availablePower() < minimumPower || shieldBlocked() || !routeReachable()) return 0;
  return fastestSpeed * (.1 + .9 * Math.max(0, Math.min(1, (transferPower() - minimumPower) / (maxPower - minimumPower))));
}
const locations = [
  { id: 'pad', name: 'Transporter Pad', range: 'On board · Deck 4', kelvin: 294, gases: [['Oxygen', '21%'], ['Nitrogen', '78%'], ['Trace gases', '1%']], breathable: true },
  { id: 'cargo', name: 'Cargo Bay', range: 'On board · Deck 6', kelvin: 289, gases: [['Oxygen', '21%'], ['Nitrogen', '78%'], ['Trace gases', '1%']], breathable: true },
  { id: 'station', name: 'Earth Orbital Station', range: 'Space station · 19.4 km', kelvin: 295, gases: [['Oxygen', '20.9%'], ['Nitrogen', '78.1%'], ['Trace gases', '1%']], breathable: true },
  { id: 'ship', name: 'TNS Resolute', range: 'Starship · 48.2 km', kelvin: 293, gases: [['Oxygen', '21%'], ['Nitrogen', '78%'], ['Trace gases', '1%']], breathable: true },
  { id: 'outpost', name: 'Delta Survey Outpost', range: 'Outpost · 32.6 km', kelvin: 243, gases: [['Carbon dioxide', '95%'], ['Nitrogen', '4%'], ['Trace gases', '1%']], breathable: false },
];
const settlementNames = ['Paris','Jerusalem','Moscow','Hong Kong','Tokyo','San Francisco','St. Louis','Port Canaveral'];
// Distances are illustrative nearby-ship fixtures, pending live GTO range/occlusion integration.
settlementNames.forEach((name,index) => locations.push({id:'earth-settlement-'+index,name:name+' Settlement',kind:'settlement',parent:'Earth',surfaceBearing:index*45+22.5,range:'Earth surface · '+(7200+index*250).toLocaleString()+' km',kelvin:291,gases:[['Oxygen','21%'],['Nitrogen','78%'],['Trace gases','1%']],breathable:true}));
const seed = [
  ['mara', 'Lt. Mara Venn', 'Navigation officer', 'bio', 'pad', '74 kg'],
  ['keon', 'Ens. Keon Pell', 'Engineering liaison', 'bio', 'pad', '81 kg'],
  ['ilyra', 'Dr. Ilyra Moss', 'Medical officer', 'bio', 'pad', '63 kg'],
  ['chen', 'Ari Chen', 'Cargo specialist', 'bio', 'cargo', '77 kg'],
  ['olan', 'Kira Olan', 'Station liaison', 'bio', 'station', '69 kg'],
  ['rhea', 'Rhea Tor', 'Science officer', 'bio', 'ship', '72 kg'],
  ['dalen', 'Dalen Rusk', 'Survey lead · sealed suit', 'bio', 'outpost', '106 kg'],
  ['medkit', 'Field medical kit', 'Mission supply', 'nonbio', 'pad', '18 kg'],
  ['case', 'Medical case 7B', 'Mission cargo · sealed', 'nonbio', 'cargo', '120 kg'],
  ['core', 'Navigation core', 'Mission cargo · secured', 'nonbio', 'cargo', '86 kg'],
  ['supplies', 'Colony supply case', 'Mission cargo · outbound', 'nonbio', 'station', '94 kg'],
  ['probe', 'Survey probe', 'Mission cargo · recovery', 'nonbio', 'ship', '58 kg'],
  ['sample', 'Geological samples', 'Mission cargo · recovery', 'nonbio', 'outpost', '46 kg'],
];
settlementNames.forEach((name,index) => {
  seed.push(['delegate-'+index,name+' delegate','Diplomatic mission · personnel','bio','earth-settlement-'+index,'80 kg']);
  seed.push(['settlement-cargo-'+index,name+' supply case','Mission cargo · surface pickup','nonbio','earth-settlement-'+index,'90 kg']);
});
let targets, selected, scanned, phase, progress, occupancy, lockedDestination, completedNames, delivered, batch = [];
let maxMass = 160, maxCargoMass = 320, transporterRange = 10000;
const presets = {1: [10000,160,320], 2: [12000,320,480], 3: [14000,480,960]};
const usesCargoLimit = () => $('targetType').value === 'nonbio' && (sourceId() === 'cargo' || destinationId() === 'cargo');
const massOf = target => parseFloat(target.mass);
const massLimit = () => usesCargoLimit() ? maxCargoMass : maxMass;
const lockedItems = () => selectedItems().filter(target => target.lockProgress >= 100 && target.place !== 'buffer');
const reservedMass = () => lockedItems().reduce((sum, target) => sum + massOf(target), 0);
const nextLock = () => selectedItems().find(target => target.lockProgress < 100 && massOf(target) <= massLimit() - reservedMass());
function resetLocks() { selectedItems().forEach(target => target.lockProgress = 0); }
const findLocation = id => locations.find(item => item.id === id);
const sourceId = () => $('sourceType').value === 'other' ? $('sourceOther').value : $('sourceType').value;
const destinationId = () => $('destinationType').value === 'other' ? $('destinationOther').value : $('destinationType').value;
const cycleLocked = () => ['dematerializing', 'buffered', 'materializing', 'powerdown'].includes(phase);
const selectedItems = () => [...selected].map(id => targets.find(target => target.id === id));
const allTargetsLocked = () => lockedItems().length > 0;
let lockSpeedSeconds = 3;

const surfacePoint = (radius, bearing) => ({x:radius*Math.sin(bearing*Math.PI/180),y:radius*Math.cos(bearing*Math.PI/180)});
const demoEarth = {x:0,y:0,radius:6371};
let shipBearing = 202.5, shipAltitude = 1000;
const demoShipPosition = () => surfacePoint(demoEarth.radius+shipAltitude,316+shipBearing);
const initialShipPosition = demoShipPosition();
const demoMoon = {x:initialShipPosition.x+5000,y:initialShipPosition.y,radius:500};
const occludingBodies = [demoEarth,demoMoon];
locations.filter(place=>place.kind==='settlement').forEach(place=>Object.assign(place,surfacePoint(demoEarth.radius,316+place.surfaceBearing)));
Object.assign(findLocation('station'),{x:initialShipPosition.x+19.4,y:initialShipPosition.y});
Object.assign(findLocation('ship'),{x:initialShipPosition.x,y:initialShipPosition.y+48.2});
Object.assign(findLocation('outpost'),{x:demoMoon.x+demoMoon.radius,y:demoMoon.y});
function segmentBlocked(start,end,body) {
  const dx=end.x-start.x,dy=end.y-start.y,lengthSquared=dx*dx+dy*dy;
  if(!lengthSquared)return false;
  const t=Math.max(0,Math.min(1,((body.x-start.x)*dx+(body.y-start.y)*dy)/lengthSquared));
  return Math.hypot(start.x+t*dx-body.x,start.y+t*dy-body.y)<body.radius-1e-6;
}
function reachable(place) {
  if(!place)return false;
  if(['pad','cargo'].includes(place.id))return true;
  const ship=demoShipPosition();
  return Math.hypot(place.x-ship.x,place.y-ship.y)<=transporterRange+1e-6&&!occludingBodies.some(body=>segmentBlocked(ship,place,body));
}
const routeReachable = () => reachable(findLocation(sourceId()))&&reachable(findLocation(destinationId()));
function refreshLocations() {
  const valid=locations.slice(2).filter(reachable),ship=demoShipPosition();
  for(const id of ['sourceOther','destinationOther']) {
    const previous=$(id).value; $(id).replaceChildren();
    for(const place of valid){const option=document.createElement('option');option.value=place.id;option.textContent=place.name+' · '+Math.hypot(place.x-ship.x,place.y-ship.y).toFixed(0)+' km';$(id).append(option);}
    if(!valid.length){const option=document.createElement('option');option.value='';option.textContent='No locations in range and line of sight';$(id).append(option);}
    else if(valid.some(place=>place.id===previous))$(id).value=previous;
    if(selected&&previous!==$(id).value){resetLocks();if(id==='sourceOther'&&$('sourceType').value==='other'){selected.clear();scanned=false;}}
  }
}

function reset() {
  targets = seed.map(([id, name, detail, kind, place, mass]) => ({ id, name, detail, kind, place, mass, lockProgress: 0 }));
  selected = new Set(); delivered = []; batch = []; scanned = false; phase = 'ready'; progress = 0; occupancy = 0; lockedDestination = null; completedNames = '';
  $('targetType').value = 'bio'; $('sourceType').value = 'pad'; $('destinationType').value = 'cargo';
  $('sourceOther').value = 'station'; $('destinationOther').value = 'station';
  $('dematerialize').value = '0'; $('materialize').value = '0'; render();
}

function renderTargets() {
  const candidates = scanned ? targets.filter(target => target.kind === $('targetType').value && target.place === sourceId()) : [];
  $('scanCount').textContent = scanned ? String(candidates.length) : '—';
  $('scanNote').textContent = !scanned ? 'Scan the selected location to acquire targets.' : candidates.length ? 'Select targets to add them to the transport manifest.' : 'No matching targets at this location.';
  $('availableTargets').replaceChildren();
  for (const target of candidates) {
    const button = document.createElement('button'); button.type = 'button'; button.disabled = cycleLocked();
    button.setAttribute('aria-pressed', String(selected.has(target.id)));
    const name = document.createElement('strong'); name.textContent = target.name;
    const detail = document.createElement('small'); detail.textContent = target.detail + ' · ' + target.mass;
    button.append(name, detail); button.onclick = () => { target.lockProgress = 0; selected.has(target.id) ? selected.delete(target.id) : selected.add(target.id); phase = 'ready'; progress = 0; render(); };
    $('availableTargets').append(button);
  }
  const inBuffer = ['buffered', 'materializing'].includes(phase);
  const leftTargets = selectedItems().filter(target => !inBuffer || !batch.includes(target));
  $('selectedCount').textContent = String(leftTargets.length);
  $('deliveredCount').textContent = String(delivered.length);
  for (const id of ['selectedTargets', 'bufferTargets', 'deliveredTargets']) $(id).replaceChildren();
  $('bufferTargets').hidden = true;
  $('bufferChamber').classList.remove('has-targets');
  const groups = [ ['selectedTargets', leftTargets], ['deliveredTargets', delivered] ];
  for (const [container, members] of groups) {
  if (!members.length && container !== 'bufferTargets') {
    const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = container === 'selectedTargets' ? 'Selected targets await transport here.' : 'Materialized targets appear here.'; $(container).append(empty);
  }
  for (const target of members) {
    const card = document.createElement('article'); card.className = 'target-card' + (occupancy ? ' buffered' : '');
    const icon = document.createElement('span'); icon.className = 'target-icon'; icon.textContent = target.kind === 'bio' ? '◉' : '◇';
    const name = document.createElement('strong'); name.textContent = target.name;
    const detail = document.createElement('small'); detail.textContent = target.detail;
    const mass = document.createElement('small'); mass.textContent = target.mass;
    const status = document.createElement('small'); status.className = 'target-state'; status.textContent = container === 'deliveredTargets' ? 'DELIVERED · ' + findLocation(target.place).name : phase === 'buffered' ? 'PATTERN BUFFERED' : phase === 'dematerializing' ? 'DEMATERIALIZING' : phase === 'materializing' ? 'MATERIALIZING' : 'TARGET LOCKED';
    if (container === 'selectedTargets' && target.lockProgress < 100) {
      status.textContent = massOf(target) > massLimit() ? 'EXCEEDS MASS LIMIT' : cycleLocked() || massOf(target) > massLimit() - reservedMass() ? 'WAITING FOR BUFFER SPACE' : target === nextLock() ? 'ACQUIRING TARGET' : 'WAITING FOR LOCK';
      const bar = document.createElement('progress'); bar.className = 'lock-progress'; bar.max = 100; bar.value = target.lockProgress; bar.dataset.target = target.id; bar.setAttribute('aria-label', target.name + ' target lock progress');
      status.append(bar);
    }
    card.append(icon, name, detail, mass, status); $(container).append(card);
  }
  }
}

function renderEnvironment() {
  const place = findLocation(destinationId());
  if(!place){$('destinationName').textContent='No reachable destination';$('destinationDistance').textContent='';$('temperature').textContent='—';$('atmosphere').replaceChildren();$('breathability').querySelector('strong').textContent='UNKNOWN';$('environmentNote').textContent='Move within range with a clear path.';return;}
  $('destinationName').textContent = place.name; $('destinationDistance').textContent = ['pad','cargo'].includes(place.id)?place.range.toUpperCase():Math.hypot(place.x-demoShipPosition().x,place.y-demoShipPosition().y).toFixed(0)+' KM · CLEAR LINE OF SIGHT';
  $('temperature').textContent = place.kelvin + ' K / ' + (place.kelvin - 273.15).toFixed(0) + ' °C';
  $('breathability').classList.toggle('unsafe', !place.breathable);
  $('breathability').querySelector('strong').textContent = place.breathable ? 'BREATHABLE' : 'NOT BREATHABLE';
  $('environmentNote').textContent = place.breathable ? 'Atmosphere suitable for unprotected Terran personnel.' : 'Terran personnel require sealed environmental protection.';
  $('atmosphere').replaceChildren();
  for (const [name, amount] of place.gases) { const row = document.createElement('div'); row.className = 'gas'; const label = document.createElement('span'); label.textContent = name; const value = document.createElement('b'); value.textContent = amount; row.append(label, value); $('atmosphere').append(row); }
}

function renderCycle() {
  const unavailable = availablePower() < minimumPower;
  document.querySelectorAll('.unavailable-screen').forEach(element => element.hidden = !unavailable);
  document.querySelectorAll('.powered-content').forEach(element => { element.hidden = unavailable; element.inert = unavailable; });
  document.querySelector('main').classList.toggle('system-unavailable', unavailable);
  const left = +$('dematerialize').value, right = +$('materialize').value;
  const used = transferPower();
  $('powerUsed').textContent = used.toFixed(1) + ' PU'; $('powerAvailable').textContent = availablePower().toFixed(1) + ' PU';
  $('minimumReading').textContent = minimumPower.toFixed(1) + ' PU'; $('maxPowerReading').textContent = maxPower.toFixed(1) + ' PU';
  $('speedReading').textContent = 'TRANSFER SPEED ' + (transferSpeed() / fastestSpeed * 100).toFixed(0) + '%';
  $('shieldState').textContent = shieldsUp ? 'SHIELDS UP' : 'SHIELDS DOWN';
  $('shieldState').classList.toggle('raised', shieldsUp);
  $('shieldState').classList.toggle('blocked', shieldBlocked());
  $('remoteShieldState').hidden = !remoteShipRoute();
  $('remoteShieldState').textContent = remoteShieldsUp ? 'OTHER SHIP: SHIELDS UP' : 'OTHER SHIP: SHIELDS DOWN';
  $('dematValue').textContent = left + '%'; $('matValue').textContent = right + '%';
  // Completed dematerialization automatically hands control to materialization.
  $('dematerialize').disabled = phase === 'buffered' || phase === 'materializing' || phase === 'powerdown' || (phase === 'ready' && !allTargetsLocked()) || phase === 'complete';
  $('materialize').disabled = !['buffered', 'materializing', 'powerdown'].includes(phase) || left > 0;
  if (shieldBlocked() || !routeReachable()) { $('dematerialize').disabled = true; $('materialize').disabled = true; }
  $('cycleProgress').value = progress; $('progressValue').textContent = Math.floor(progress) + '%';
  $('bufferFill').style.height = occupancy + '%'; $('bufferPercent').textContent = Math.floor(occupancy) + '%';
  $('bufferChamber').classList.toggle('occupied', occupancy > 0);
  $('bufferChamber').classList.toggle('busy', transferSpeed() > 0);
  $('bufferCount').textContent = occupancy > 0 ? batch.length + (batch.length === 1 ? ' PATTERN' : ' PATTERNS') : 'EMPTY';
  $('massReading').textContent = (batch.reduce((sum, target) => sum + massOf(target), 0) * occupancy / 100).toFixed(1) + ' / ' + massLimit() + ' kg · ' + (usesCargoLimit() ? 'CARGO LIMIT' : 'PAD LIMIT');
  $('rangeReading').textContent = 'RANGE ' + transporterRange.toLocaleString() + ' km';
  $('bufferState').textContent = phase === 'buffered' ? 'PATTERNS HELD' : phase === 'dematerializing' ? 'ACQUIRING PATTERNS' : phase === 'materializing' ? 'DELIVERING PATTERNS' : 'AWAITING PATTERNS';
  $('cycleBadge').textContent = ({ready: 'STANDBY', dematerializing: left ? 'DEMATERIALIZING' : 'PAUSED', buffered: 'BUFFER HOLD', materializing: right ? 'MATERIALIZING' : 'PAUSED', powerdown: 'POWER DOWN', complete: 'COMPLETE'})[phase];
  $('actionLabel').textContent = phase === 'dematerializing' ? 'DEMATERIALIZATION PROGRESS' : phase === 'materializing' || phase === 'complete' ? 'MATERIALIZATION PROGRESS' : 'TRANSPORT PROGRESS';
  const notes = {
    ready: selected.size ? (sourceId() === destinationId() ? 'Choose a destination different from the source.' : allTargetsLocked() ? 'Raise the left lever to transport locked targets. Remaining targets wait for buffer space.' : nextLock() ? 'Acquiring targets sequentially · ' + lockSpeedSeconds + ' seconds per target.' : 'Selected targets exceed the available buffer mass limit.') : 'Select targets and a destination to begin.',
    powerdown: 'Batch delivered. Lower the right lever to zero to begin locking the next targets.',
    dematerializing: left ? 'Loading patterns into the buffer. More power increases transfer speed.' : 'Dematerialization paused. Raise the left lever to continue.',
    buffered: left ? 'Patterns secured. Lower the left lever to zero, then raise the right lever.' : 'Patterns secured. Raise the right lever to materialize at the destination.',
    materializing: right ? 'Materializing at the destination. More power increases transfer speed.' : 'Materialization paused. Raise the right lever to continue.',
    complete: completedNames + ' delivered to ' + (findLocation(lockedDestination || destinationId())?.name || 'destination') + '.',
  };
  $('cycleStatus').textContent = notes[phase];
  if (!routeReachable()) $('cycleStatus').textContent = 'Select reachable locations within range and clear of planetary obstruction.';
  if (shieldBlocked()) $('cycleStatus').textContent = 'TRANSPORT BLOCKED · ' + (shieldsUp ? 'Lower our shields for external transport.' : 'The other ship must lower its shields.') + (batch.length ? ' Current patterns are held.' : '');
  if (availablePower() < minimumPower) $('cycleStatus').textContent = 'INSUFFICIENT POWER · Transfer paused. At least ' + minimumPower.toFixed(1) + ' PU required; buffered patterns are held.';
  $('routeSummary').textContent = selected.size ? (findLocation(sourceId())?.name||'No source') + ' → ' + (findLocation(lockedDestination || destinationId())?.name||'No destination') : 'No targets selected';
}

function render() {
  refreshLocations();
  $('sourceOtherLabel').hidden = $('sourceType').value !== 'other'; $('destinationOtherLabel').hidden = $('destinationType').value !== 'other';
  $('sourceControls').disabled = cycleLocked(); $('destinationControls').disabled = cycleLocked();
  $('maxMass').disabled = cycleLocked(); $('maxCargoMass').disabled = cycleLocked();
  $('transporterMark').disabled = cycleLocked(); $('transporterRange').disabled = cycleLocked();
  $('shipBearing').disabled=cycleLocked();$('shipAltitude').disabled=cycleLocked();
  $('clearTransport').disabled = cycleLocked();
  renderTargets(); renderEnvironment(); renderCycle();
}

for (const id of ['targetType', 'sourceType', 'sourceOther']) $(id).onchange = () => { if (cycleLocked()) return; selected.clear(); scanned = false; phase = 'ready'; progress = 0; render(); };
for (const id of ['destinationType', 'destinationOther']) $(id).onchange = () => { if (!cycleLocked()) { resetLocks(); render(); } };
$('scan').onclick = () => { scanned = true; render(); };
$('dematerialize').oninput = () => {
  if (+$('dematerialize').value > 0 && phase === 'ready') {
    if (!allTargetsLocked() || sourceId() === destinationId() || availablePower() < minimumPower || shieldBlocked() || !routeReachable()) { $('dematerialize').value = '0'; renderCycle(); return; }
    batch = [...lockedItems()]; selectedItems().filter(target => !batch.includes(target)).forEach(target => target.lockProgress = 0); phase = 'dematerializing'; progress = 0; lockedDestination = destinationId(); render();
  } else renderCycle();
};
$('materialize').oninput = () => {
  if (+$('materialize').value > 0 && phase === 'buffered' && +$('dematerialize').value === 0 && !shieldBlocked()) { phase = 'materializing'; progress = 0; render(); }
  else if (phase === 'powerdown' && +$('materialize').value === 0 && +$('dematerialize').value === 0) { batch = []; phase = selected.size ? 'ready' : 'complete'; render(); }
  else renderCycle();
};
$('reset').onclick = reset;
for(const id of ['shipBearing','shipAltitude'])$(id).onchange=()=>{const value=Number($(id).value);if(Number.isFinite(value)){if(id==='shipBearing'&&value>=0&&value<360)shipBearing=value;if(id==='shipAltitude'&&value>=1)shipAltitude=value;}$(id).value=id==='shipBearing'?shipBearing:shipAltitude;resetLocks();render();};
function changeShields() {
  shieldsUp = $('ourShields').checked; remoteShieldsUp = $('remoteShields').checked;
  if (shieldBlocked()) { $('dematerialize').value = '0'; $('materialize').value = '0'; }
  render();
}
$('ourShields').onchange = changeShields;
$('remoteShields').onchange = changeShields;
$('clearTransport').onclick = () => {
  if (cycleLocked()) return;
  resetLocks(); selected.clear(); delivered = []; batch = []; progress = 0; occupancy = 0; phase = 'ready'; lockedDestination = null; completedNames = ''; scanned = false;
  $('dematerialize').value = '0'; $('materialize').value = '0'; render();
};
$('transporterMark').onchange = () => {
  [transporterRange, maxMass, maxCargoMass] = presets[$('transporterMark').value];
  $('transporterRange').value = transporterRange; $('maxMass').value = maxMass; $('maxCargoMass').value = maxCargoMass;
  $('moduleName').textContent = 'TRANSPORTER · MARK ' + ({1:'I',2:'II',3:'III'})[$('transporterMark').value];
  resetLocks(); render();
};
$('transporterRange').onchange = () => { const value = Number($('transporterRange').value); if (Number.isFinite(value) && value >= 10000 && value <= 15000) transporterRange = value; $('transporterRange').value = transporterRange; render(); };
$('lockSpeed').onchange = () => { const value = Number($('lockSpeed').value); if (Number.isFinite(value) && value >= .1) lockSpeedSeconds = value; $('lockSpeed').value = lockSpeedSeconds; renderCycle(); };
for (const id of ['minimumPower', 'maximumPower', 'busPower', 'restrictor', 'fastestSpeed', 'slowestSpeed']) $(id).onchange = () => {
  const value = Number($(id).value);
  if (Number.isFinite(value)) {
    if (id === 'minimumPower' && value > 0 && value < maxPower) minimumPower = value;
    if (id === 'maximumPower' && value > minimumPower) maxPower = value;
    if (id === 'busPower' && value >= 0) busPower = value;
    if (id === 'restrictor' && value >= 0 && value <= 100) restrictorPercent = value;
    if (id === 'fastestSpeed' && value > 0) fastestSpeed = value;
    if (id === 'slowestSpeed' && value > 0) fastestSpeed = value * 10;
  }
  $('minimumPower').value = minimumPower; $('maximumPower').value = maxPower; $('busPower').value = busPower; $('restrictor').value = restrictorPercent; $('fastestSpeed').value = fastestSpeed; $('slowestSpeed').value = fastestSpeed / 10;
  renderCycle();
};
for (const id of ['maxMass', 'maxCargoMass']) $(id).onchange = () => { const value = Number($(id).value); if (Number.isFinite(value) && value > 0) { if (id === 'maxMass') maxMass = value; else maxCargoMass = value; resetLocks(); } $(id).value = id === 'maxMass' ? maxMass : maxCargoMass; render(); };
let last = performance.now();
setInterval(() => {
  const now = performance.now(), dt = Math.min((now - last) / 1000, .25); last = now;
  if (phase === 'ready' && availablePower() >= minimumPower) {
    const acquiring = nextLock();
    if (acquiring) {
      acquiring.lockProgress = Math.min(100, acquiring.lockProgress + dt / lockSpeedSeconds * 100);
      const bar = document.querySelector('.lock-progress[data-target="' + acquiring.id + '"]');
      if (bar) bar.value = acquiring.lockProgress;
      if (acquiring.lockProgress >= 100) renderTargets();
      renderCycle();
    }
  }
  const setting = phase === 'dematerializing' ? +$('dematerialize').value : phase === 'materializing' ? +$('materialize').value : 0;
  if (!setting || transferSpeed() === 0) return;
  progress = Math.min(100, progress + dt * transferSpeed());
  occupancy = phase === 'dematerializing' ? progress : 100 - progress;
  if (progress >= 100) {
    if (phase === 'dematerializing') { phase = 'buffered'; $('dematerialize').value = '0'; batch.forEach(target => target.place = 'buffer'); }
    else { completedNames = batch.map(target => target.name).join(', '); batch.forEach(target => { target.place = lockedDestination; selected.delete(target.id); }); delivered = [...new Set([...delivered, ...batch])]; batch = []; $('materialize').value = '0'; $('dematerialize').value = '0'; phase = selected.size ? 'ready' : 'complete'; occupancy = 0; progress = 0; }
    render();
  } else renderCycle();
}, 100);
reset();
