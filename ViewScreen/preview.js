const $=id=>document.getElementById(id),LY=9.4607304725808e12;
const contacts=[
 {id:'meridian',name:'Cargo Ship Meridian',kind:'ship',x:4200,y:2100,heading:'128.0°',status:'Friendly · Terran Merchant',hull:'Atlas-class freighter',detail:'Cargo transport · Civilian registry TMS-284',symbol:'◇'},
 {id:'anomaly',name:'Subspace Anomaly A-17',kind:'anomaly',x:-6400,y:4200,heading:'—',status:'Unclassified · Scan required',hull:'Spatial disturbance',detail:'Intermittent subspace emissions. Scientific scan requested.',symbol:'✧'},
 {id:'station',name:'Earth Orbital Station',kind:'station',x:35,y:-48,heading:'—',status:'Friendly · Terran Space Command',hull:'Orbital station',detail:'Dock control available · Approach clearance required.',symbol:'⊞'},
 {id:'earth',name:'Earth',kind:'planet',x:0,y:-9200,radius:6371},
 {id:'moon',name:'Luna',kind:'moon',x:290000,y:215000,radius:1737},
 {id:'sol',name:'Sol',kind:'star',x:1.48e8,y:2e7,radius:696340},
 {id:'mercury',name:'Mercury',kind:'planet',x:1.9e8,y:3.5e7,radius:2440},
 {id:'venus',name:'Venus',kind:'planet',x:7.6e7,y:6.1e7,radius:6052},
 {id:'saturn',name:'Saturn',kind:'planet',x:-7.8e8,y:4.1e8,radius:58232},
 {id:'mars',name:'Mars',kind:'planet',x:-1.4e8,y:8e7,radius:3390},
 {id:'jupiter',name:'Jupiter',kind:'planet',x:5e8,y:3e8,radius:69911}
];
const stars=[{name:'Sol',x:0,y:0},{name:'Alpha Centauri',x:-3.1,y:3},{name:'Ross',x:7.1,y:8.3},{name:'Gliese',x:9.4,y:-7.2},{name:'Sirius',x:-7.7,y:-3.8},{name:'Tau Ceti',x:-3.8,y:11.3},{name:'Velari',x:16,y:8},{name:'Epsilon Eridani',x:-9.8,y:3.5},{name:'Procyon',x:4.9,y:-10.3}];
let settings=ViewSettings.read(),selected='meridian',temp=220;
const distance=c=>{const d=Math.hypot(c.x,c.y);return d>=1e9?(d/1e9).toFixed(2)+' BKM':d>=1e6?(d/1e6).toFixed(2)+' MKM':Math.round(d).toLocaleString()+' km';};
function details(){const c=contacts.find(c=>c.id===selected);$('selectedName').textContent=c?'TACTICAL TARGET · '+c.name:'NO TACTICAL TARGET SELECTED';
 if(settings.type==='lrs'){$('details').innerHTML='<span class="eyebrow">NAVIGATION DESTINATION</span><div class="contact-mark">⊞</div><span class="tag">ACTIVE COURSE · ORBITAL STATION</span><h1>Gliese Orbital Station</h1><div class="destination-coordinates"><small>GALACTIC COORDINATES</small><p>0.021° · 26,012.4 LY</p><small>SYSTEM COORDINATES</small><p>137.420° · 148.2 MKM</p></div><dl>'+[['Location','Gliese Prime orbit'],['Population aboard','1,240 personnel'],['Operator','Terran Space Command'],['Services','Docking · Refueling<br>Shore power · Cargo transfer<br>Medical care · Repairs']].map(([k,v])=>'<div><dt>'+k+'</dt><dd>'+v+'</dd></div>').join('')+'</dl><p class="detail-note">Federation logistics and resupply station serving the Gliese system. Contact dock control for approach clearance.</p>';return;}

 $('details').innerHTML=c?'<span class="eyebrow">TACTICAL TARGET</span><div class="contact-mark">'+c.symbol+'</div><span class="tag">'+c.status+'</span><h1>'+c.name+'</h1><dl>'+[['Classification',c.hull],['Range',distance(c)],['Bearing',((Math.atan2(c.x,c.y)*180/Math.PI+360)%360).toFixed(2)+'°'],['Heading',c.heading],['Sensor lock','Confirmed']].map(([k,v])=>'<div><dt>'+k+'</dt><dd>'+v+'</dd></div>').join('')+'</dl><p class="detail-note">'+c.detail+'</p>':'<span class="eyebrow">TACTICAL TARGET</span><h1>No target selected</h1><p class="detail-note">Target information appears here when the tactical officer selects a contact.</p>';
}
function update(){settings=ViewSettings.read();$('modeBadge').textContent=settings.type.toUpperCase();$('scanners').classList.toggle('dual',settings.type==='dual');$('lrsPanel').hidden=settings.type==='srs';$('srsPanel').hidden=settings.type==='lrs';$('details').hidden=settings.type==='dual';$('lrsRange').textContent=ViewSettings.label(settings.lrsRange)+' RADIUS';$('srsRange').textContent=ViewSettings.label(settings.srsRange)+' RADIUS';details();}
function gauge(id,value,max,unit,warnings){const start=135,sweep=270,point=(angle,r=66)=>[90+r*Math.cos(angle*Math.PI/180),83+r*Math.sin(angle*Math.PI/180)];const arc=(from,to,color,width)=>{const a=point(start+sweep*from),b=point(start+sweep*to);return `<path d="M${a} A66,66 0 ${sweep*(to-from)>180?1:0} 1 ${b}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;};let out=arc(0,1,'#263b4c',7);if(warnings)out+=arc(.5,.89,'#ddba63',5)+arc(.9,1,'#dd6370',5);out+=arc(0,Math.min(value/max,1),warnings?'#91dace':'#6ee7df',3);const tip=point(start+sweep*Math.min(value/max,1),54);out+=`<line x1="90" y1="83" x2="${tip[0]}" y2="${tip[1]}" stroke="#d9eef1" stroke-width="2"/><circle cx="90" cy="83" r="4" fill="#d9eef1"/><text x="90" y="115" text-anchor="middle" fill="#e3f4f3" font-size="24" font-weight="300">${value.toFixed(warnings?0:1)}</text><text x="90" y="133" text-anchor="middle" fill="#8aabb8" font-size="9">${unit}</text>`;$(id).innerHTML=`<svg viewBox="0 0 180 145" role="img" aria-label="${value} ${unit}; maximum ${max}">${out}</svg>`;}
function lights(){const phase=$('dockState').value;const on=[phase!=='flight',phase!=='flight',phase!=='flight',['connected','synced'].includes(phase),phase==='synced'];$('lights').innerHTML=['Docked','Moorings engaged','Clamps engaged','Umbilical attached','Power sync'].map((name,i)=>`<div class="light-row ${on[i]?'on':''}"><i></i><span>${name}</span><small>${on[i]?'ON':'OFF'}</small></div>`).join('');}
function draw(id,time){const canvas=$(id);if(canvas.closest('section').hidden)return;const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1,w=rect.width,h=rect.height;if(!w||!h)return;if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);const x=w/2,y=h/2,r=Math.min(w,h)*.425,range=ViewSettings.ranges[id==='srs'?settings.srsRange:settings.lrsRange];
 ctx.save();ctx.translate(x,y);ctx.strokeStyle='#244c5266';ctx.lineWidth=1;for(let i=1;i<=4;i++){ctx.beginPath();ctx.arc(0,0,r*i/4,0,Math.PI*2);ctx.stroke();}for(let a=0;a<360;a+=30){let t=a*Math.PI/180;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(t)*r,Math.sin(t)*r);ctx.stroke();ctx.fillStyle='#537780';ctx.font='9px system-ui';ctx.textAlign='center';ctx.fillText(((a+90)%360)+'°',Math.cos(t)*(r+17),Math.sin(t)*(r+17)+3);}
 // Shared static bearing scale: one-degree ticks, longer ten-degree marks.
 ctx.strokeStyle='#59848c';ctx.lineWidth=1;
 for(let degree=0;degree<360;degree++){
  const angle=(degree-90)*Math.PI/180,length=degree%10===0?10:4;
  ctx.beginPath();ctx.moveTo(Math.cos(angle)*(r-length),Math.sin(angle)*(r-length));
  ctx.lineTo(Math.cos(angle)*r,Math.sin(angle)*r);ctx.stroke();
 }

 const objects=id==='lrs'?[...stars.filter(s=>s.name!=='Sol').map(s=>({...s,x:s.x*LY,y:s.y*LY,kind:'star'})),...contacts]:contacts;
 ctx.save();ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.clip();
 for(const c of objects){const d=Math.hypot(c.x,c.y);if(d>range)continue;if(range>5e10&&c.kind!=='star')continue;if(c.kind==='moon'&&range>=5e6)continue;if(c.kind==='station'&&range>=400)continue;const px=c.x/range*r,py=-c.y/range*r,color=c.kind==='anomaly'?'#d3a8f0':c.kind==='star'?'#e9d79b':c.kind==='planet'||c.kind==='moon'?'#7a9db5':'#6ee7df';ctx.fillStyle=(c.kind==='planet'||c.kind==='moon')?'#203b4a':color;ctx.strokeStyle=color;const size=Math.max(c.radius?c.radius/range*r:0,c.kind==='star'?3:2.5);ctx.beginPath();if(c.kind==='ship'){const heading=(parseFloat(c.heading)||0)*Math.PI/180;const point=(x,y)=>[px+x*Math.cos(heading)-y*Math.sin(heading),py+x*Math.sin(heading)+y*Math.cos(heading)];ctx.moveTo(...point(0,-6));ctx.lineTo(...point(3.75,4.5));ctx.lineTo(...point(0,2.25));ctx.lineTo(...point(-3.75,4.5));ctx.closePath();}else{ctx.arc(px,py,size,0,Math.PI*2);}ctx.fill();if(c.kind==='planet'&&size>12){ctx.strokeStyle='#adcce077';ctx.stroke();}
 if(c.id===selected){ctx.globalAlpha=.6+.4*Math.sin(time/400);ctx.strokeStyle='#88fff0';ctx.lineWidth=1.5;ctx.strokeRect(px-size-7,py-size-7,size*2+14,size*2+14);ctx.globalAlpha=1;}
 // Avoid an unreadable pile of local labels at interplanetary scale.
 if(d/range>.04||c.kind==='star'||c.kind==='planet'||c.id===selected&&range<=1e5){ctx.font='11px system-ui';const right=px>r*.35;ctx.textAlign=right?'right':'left';const lx=px+(right?-size-8:size+8);ctx.lineWidth=3;ctx.strokeStyle='#07121c';const labelY=c.id==='earth'&&d/range<.04?py+36:c.id==='sol'?py+17:c.id==='venus'?py-19:py-7;ctx.strokeText(c.name,lx,labelY);ctx.fillStyle=color;ctx.fillText(c.name,lx,labelY);}
 if(c.id==='earth'&&range<20000){const names=['Paris','Jerusalem','Moscow','Hong Kong','Tokyo','San Francisco','St. Louis','Port Canaveral'];for(let i=0;i<8;i++){const a=i*Math.PI/4,sx=px+size*Math.cos(a),sy=py+size*Math.sin(a);ctx.fillStyle='#ffdc65';ctx.fillRect(sx-1,sy-1,2,2);if(range<=10000){ctx.font='9px system-ui';ctx.textAlign=Math.cos(a)<0?'right':'left';ctx.strokeStyle='#07121c';ctx.lineWidth=3;ctx.strokeText(names[i],sx+(Math.cos(a)<0?-5:5),sy-5);ctx.fillText(names[i],sx+(Math.cos(a)<0?-5:5),sy-5);}}}
 }ctx.restore();
 ctx.fillStyle='#d7f9f2';ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(5,6);ctx.lineTo(0,3);ctx.lineTo(-5,6);ctx.closePath();ctx.fill();ctx.font='8px system-ui';ctx.textAlign='center';ctx.fillStyle='#83adaf';ctx.fillText('DISCOVERY',0,22);ctx.restore();}
$('tacticalTarget').onchange=()=>{selected=$('tacticalTarget').value;details();};$('temperature').onchange=()=>{temp=Number($('temperature').value);gauge('tempGauge',temp,530,'KELVIN',true);$('temperatureStatus').innerHTML=(temp>=477?'CRITICAL':temp>=265?'CAUTION':'NORMAL')+' <b>BREACH · 530 K</b>';};$('dockState').onchange=lights;
window.addEventListener('viewsettingschange',update);
update();lights();gauge('busGauge',112,150,'POWER UNITS',false);gauge('tempGauge',temp,530,'KELVIN',true);
let lastFrame=null,detailElapsed=0;
const starts=new Map(contacts.filter(c=>c.kind==='ship').map(c=>[c.id,{x:c.x,y:c.y}]));
$('resetMotion').onclick=()=>{for(const c of contacts.filter(c=>c.kind==='ship'))Object.assign(c,starts.get(c.id));details();};
function frame(time){const dt=lastFrame===null?0:Math.min((time-lastFrame)/1000,.25);lastFrame=time;
 const speed=Math.max(0,Math.min(1000,Number($('shipSpeed').value)||0));
 for(const c of contacts.filter(c=>c.kind==='ship')){const heading=(parseFloat(c.heading)||0)*Math.PI/180;c.x+=Math.sin(heading)*speed*dt;c.y+=Math.cos(heading)*speed*dt;}
 detailElapsed+=dt;if(detailElapsed>=.5){details();detailElapsed=0;}
 draw('srs',time);draw('lrs',time);requestAnimationFrame(frame);
}requestAnimationFrame(frame);

for(const [id,key] of Object.entries({viewScreenType:'type',viewScreenSrsRange:'srsRange',viewScreenLrsRange:'lrsRange'})){ $(id).value=settings[key];$(id).onchange=()=>ViewSettings.write({[key]:$(id).value});}

$('propulsion').onchange=()=>{for(const drive of ['warp','impulse']){const active=$('propulsion').value===drive;$(drive+'Indicator').classList.toggle('on',active);$(drive+'Indicator').querySelector('small').textContent=active?'ON':'OFF';}};
