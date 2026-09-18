const LY=9460730472580.8;
let mapCenter={x:0,y:0},mapRange=30*LY;
let selectedMapPoint=null;
function position(o){return {x:Number(o.origin_x_ly)*LY+Number(o.x_km),y:(Number(o.origin_y_ly)-26012)*LY+Number(o.y_km)};}
const chartObjects=gtoObjects.filter(o=>['star','planet','moon','station'].includes(o.kind)).map(o=>({...o,...position(o)}));
function anchor(system){
 const token=system==='Alpha Centauri'?'alpha':system.toLowerCase();
 const station=chartObjects.find(o=>o.kind==='station'&&(o.name.toLowerCase().includes(token)||o.system_key?.toLowerCase().includes(token)));
 if(station)return station;
 const star=chartObjects.find(o=>o.kind==='star'&&o.system_key?.toLowerCase().includes(token))||chartObjects[0];
 return {x:star.x+Math.max(50000000,(star.radius_km||0)*20),y:star.y+25000000};
}
function clearOfStars(point){
 let result={...point};
 for(let pass=0;pass<chartObjects.length;pass++){
 const star=chartObjects.find(o=>o.kind==='star'&&Math.hypot(result.x-o.x,result.y-o.y)<Math.max(10000000,(o.radius_km||0)*12));
 if(!star)break;
 result={x:star.x+Math.max(10000000,(star.radius_km||0)*12)+1000000,y:result.y};
 }
 return result;
}
function endpoints(r){if(r.position)return {a:r.position,b:r.targetPosition||null};
 const base=anchor(r.system);
 const offset=r.origin.includes('Station')?0:5000000+samples.indexOf(samples.find(s=>s.origin===r.origin))*2000000;
 const a=clearOfStars({x:base.x+offset,y:base.y+offset*.6});
 const b=r.type==='Point to point'?clearOfStars(anchor(r.system==='Sol'?'Alpha Centauri':'Sol')):null;
 return {a,b};
}
function chartVisible(o){if(o.kind==='moon')return mapRange<5e6;return o.kind==='star'||mapRange<50e9;}
let viewportWidth=800,viewportHeight=500;
function mapScale(){return Math.min(viewportWidth,viewportHeight)/(2*mapRange);}
// Local preview position, independent of the live simulation.
const demoShipPosition=(()=>{const station=anchor('Ross');return {x:station.x+20000,y:station.y+20000};})();
function inMap(p){const scale=mapScale();return Math.abs(p.x-mapCenter.x)*scale<=viewportWidth/2&&Math.abs(p.y-mapCenter.y)*scale<=viewportHeight/2;}
function signalVisible(r){const {a,b}=endpoints(r);return inMap(a)||(b&&inMap(b));}
const canvas=document.getElementById('signalMap'),ctx=canvas.getContext('2d');
function project(p){return {x:canvas.width/2+(p.x-mapCenter.x)*mapScale(),y:canvas.height/2-(p.y-mapCenter.y)*mapScale()};}
function formatDistance(km){
 const magnitude=Math.abs(km),scale=magnitude>=LY?LY:magnitude>=1e9?1e9:magnitude>=1e6?1e6:1;
 return (km/scale).toLocaleString('en-US',{maximumFractionDigits:3})+' '+(scale===LY?'LY':scale===1e9?'BKM':scale===1e6?'MKM':'KM');
}
function formatMapRadius(km){
 const [scale,unit]=km>=LY?[LY,'LY']:km>=1e9?[1e9,'BKM']:km>=1e6?[1e6,'MKM']:[1,'KM'];
 return (km/scale).toLocaleString('en-US',{maximumFractionDigits:2})+' '+unit;
}
// Clip before passing astronomical coordinates to the canvas rasterizer.
function clipSignalSegment(a,b){
 let t0=0,t1=1;const dx=b.x-a.x,dy=b.y-a.y;
 for(const [p,q] of [[-dx,a.x],[dx,canvas.width-a.x],[-dy,a.y],[dy,canvas.height-a.y]]){
  if(p===0){if(q<0)return null;continue;}
  const t=q/p;if(p<0)t0=Math.max(t0,t);else t1=Math.min(t1,t);
  if(t0>t1)return null;
 }
 return [{x:a.x+t0*dx,y:a.y+t0*dy},{x:a.x+t1*dx,y:a.y+t1*dy}];
}
function drawSignalMap(){
 if(canvas.clientWidth&&canvas.clientHeight){viewportWidth=canvas.clientWidth;viewportHeight=canvas.clientHeight;}
 canvas.width=viewportWidth;canvas.height=viewportHeight;
 ctx.clearRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#203744';
 for(let i=1;i<10;i++){ctx.beginPath();ctx.moveTo(i*canvas.width/10,0);ctx.lineTo(i*canvas.width/10,canvas.height);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*canvas.height/10);ctx.lineTo(canvas.width,i*canvas.height/10);ctx.stroke();}
 ctx.save();ctx.strokeStyle='#345969';ctx.fillStyle='#83a6b6';ctx.lineWidth=1;ctx.font='10px sans-serif';
 for(const fraction of [.25,.5,.75,1]){
  const ringRadius=mapRange*fraction*mapScale();
  ctx.beginPath();ctx.arc(canvas.width/2,canvas.height/2,ringRadius,0,Math.PI*2);ctx.stroke();
 }
 ctx.restore();
 for(const o of chartObjects){
  if(!chartVisible(o))continue;
  const radius=Math.max(0,Number(o.radius_km)||0);
  if(Math.abs(o.x-mapCenter.x)*mapScale()>canvas.width/2+radius*mapScale()||Math.abs(o.y-mapCenter.y)*mapScale()>canvas.height/2+radius*mapScale())continue;
  const p=project(o),rx=Math.max(2,radius*mapScale()),ry=rx;
  ctx.fillStyle=o.kind==='star'?'#d5c28b':o.kind==='station'?'#ad92d4':'#84acbd';
  ctx.beginPath();ctx.ellipse(p.x,p.y,rx,ry,0,0,Math.PI*2);ctx.fill();
  if(mapRange<LY||o.key==='sol'){ctx.font='10px sans-serif';ctx.fillText(o.name,p.x+rx+5,p.y-5);}
 }

 const candidates=rows.filter(r=>Date.now()-(r.sentAt||0)<=300000&&(filter==='all'||r.medium===filter)&&(r.medium!=='RF'||r.distance<=rfRange));
 const chosen=candidates.find(r=>r.id===selected);
 if(chosen){const {a,b}=endpoints(chosen);if(b){const clipped=clipSignalSegment(project(a),project(b));if(clipped){const [p,q]=clipped;ctx.strokeStyle='#ff8181';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}}}
 for(const r of candidates){const {a,b}=endpoints(r);for(const end of [a,b].filter(Boolean)){if(!inMap(end))continue;const p=project(end);ctx.save();ctx.fillStyle='#ff5c68';if(r.id===selected)ctx.globalAlpha=.25+.75*(.5+.5*Math.sin(performance.now()/240));ctx.beginPath();ctx.arc(p.x,p.y,1.5,0,Math.PI*2);ctx.fill();if(r.id===selected){ctx.strokeStyle='#ff5c68';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,4.5,0,Math.PI*2);ctx.stroke();}ctx.restore();}}

 if(inMap(demoShipPosition)){
  const p=project(demoShipPosition),pulse=.3+.7*(.5+.5*Math.sin(performance.now()/260));
  ctx.save();ctx.globalAlpha=pulse;ctx.fillStyle='#65ff9a';ctx.shadowBlur=0;
  ctx.beginPath();ctx.arc(p.x,p.y,1.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#65ff9a';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,4.5,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;ctx.font='11px sans-serif';ctx.restore();
 }
 if(typeof renderFrequencies==='function'&&typeof frequencyMedium!=='undefined'){const key=[mapCenter.x,mapCenter.y,mapRange].join(':');if(key!==window.lastFrequencyView){window.lastFrequencyView=key;renderFrequencies();}}
 updateMapSelection();
 document.getElementById('mapRadius').textContent='Radius · '+formatMapRadius(mapRange);
}
canvas.addEventListener('wheel',e=>{e.preventDefault();mapRange=Math.min(30*LY,Math.max(100,mapRange*Math.exp(Math.sign(e.deltaY)*.35)));render();},{passive:false});
let drag,press,moved=false;
canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY};press={...drag};moved=false;canvas.setPointerCapture(e.pointerId);};
canvas.onpointermove=e=>{if(!drag)return;if(Math.hypot(e.clientX-press.x,e.clientY-press.y)>4)moved=true;mapCenter.x-=(e.clientX-drag.x)/mapScale();mapCenter.y+=(e.clientY-drag.y)/mapScale();drag={x:e.clientX,y:e.clientY};render();};
canvas.onpointerup=canvas.onpointercancel=()=>drag=null;
function pointAt(e){
 const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
 let choice=null,best=16;
 for(const r of visible()){
  const points=endpoints(r);
  for(const [side,endpoint] of Object.entries(points).filter(([,p])=>p)){
   const p=project(endpoint),distance=Math.hypot(p.x-x,p.y-y);
   if(distance<best){best=distance;choice={...endpoint,name:side==='a'?(r.origin||'Unknown origin'):(r.destination||'Unknown origin'),transmissionId:r.id};}
  }
 }
 if(choice)return choice;
 best=Infinity;
 for(const o of chartObjects){
  if(!chartVisible(o))continue;
  const p=project(o),distance=Math.hypot(p.x-x,p.y-y),radius=Math.max(2,(Number(o.radius_km)||0)*mapScale());
  if(distance<=Math.max(20,radius)&&distance<best){best=distance;choice=o;}
 }
 return choice;
}
function selectPoint(point){
 selectedMapPoint=point;
 if(point.transmissionId!==undefined)selected=point.transmissionId;
 render();
 if(point.transmissionId!==undefined)document.querySelector('.transmission.selected')?.scrollIntoView({block:'nearest'});
}
canvas.onclick=e=>{if(moved)return;const point=pointAt(e);if(point)selectPoint(point);};
canvas.ondblclick=e=>{const point=pointAt(e);if(point){mapCenter={x:point.x,y:point.y};selectPoint(point);}};
function originCoordinates(r){
 const point=endpoints(r).a;
 const gx=point.x/LY,gy=point.y/LY+26012;
 const bearing=(Math.atan2(gx,gy)*180/Math.PI+360)%360;
 return 'Origin · '+bearing.toFixed(3)+'° / '+Math.hypot(gx,gy).toLocaleString('en-US',{maximumFractionDigits:3})+' LY';
}
function updateMapSelection(){
 const point=selectedMapPoint;
 const label=document.getElementById('mapSelection');
 if(!point){label.textContent='No map object selected';return;}
 const base=point.origin_x_ly!==undefined?point:chartObjects.reduce((best,o)=>Math.hypot(o.x-point.x,o.y-point.y)<Math.hypot(best.x-point.x,best.y-point.y)?o:best,chartObjects[0]);
 const fmt=n=>n.toLocaleString('en-US',{maximumFractionDigits:3});
 const gx=point.x/LY,gy=point.y/LY+26012;
 const normalize=angle=>(angle%360+360)%360;
 const galacticBearing=normalize(Math.atan2(gx,gy)*180/Math.PI);
 const cx=Number(base.origin_x_ly),cy=Number(base.origin_y_ly);
 const localX=point.x-cx*LY,localY=point.y-(cy-26012)*LY;
 const systemBearing=normalize((Math.atan2(localX,localY)-Math.atan2(-cx,-cy))*180/Math.PI);
 label.textContent=(point.name||'Unknown origin')+' | Galactic '+fmt(galacticBearing)+'° / '+fmt(Math.hypot(gx,gy))+' LY'+(base.system_key?' · System '+base.system_key+' '+fmt(systemBearing)+'° / '+formatDistance(Math.hypot(localX,localY)):'')+' · Distance '+formatDistance(Math.hypot(point.x-demoShipPosition.x,point.y-demoShipPosition.y));

}

document.getElementById('mapHome').onclick=()=>{mapRange=30*LY;mapCenter={x:0,y:0};render();};
window.addEventListener('resize',()=>drawSignalMap());

function animateSelection(){if(!document.getElementById('mapView').hidden)drawSignalMap();requestAnimationFrame(animateSelection);}requestAnimationFrame(animateSelection);
