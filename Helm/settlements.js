'use strict';
// Surface bearings are illustrative placements around the 2D planetary rim.
const earthSettlements = ['Paris','Jerusalem','Moscow','Hong Kong','Tokyo','San Francisco','St. Louis','Port Canaveral'].map((name,index)=>({name,bearing:index*45+22.5}));
$('zoom').step = 'any';
const drawWithoutSettlements = draw;
draw = function () {
  drawWithoutSettlements();
  if (mode === 'LRS' || (mode === 'SRS' && atWarp) || (mode === 'SYSTEM' && !navigationOnline)) return;
  const canvas=$('map'), w=canvas.clientWidth,h=canvas.clientHeight,s=Math.min(w,h)*.39;
  const radius=s/mapProjection.scale;
  if(radius>=20000-1e-6) return;
  const origin=mode==='SYSTEM'?{x:systemOrigin(selectedSystem).x+systemPan.x,y:systemOrigin(selectedSystem).y+systemPan.y}:ship;
  if(mode==='SYSTEM'&&selectedSystem!=='Sol')return;
  const g=canvas.getContext('2d'), rotation=(mode==='SYSTEM'?0:heading)*Math.PI/180;
  g.save();g.setTransform(devicePixelRatio||1,0,0,devicePixelRatio||1,0,0);g.font='11px system-ui';
  for(const settlement of earthSettlements){
    const towardSystemCenter=Math.atan2(-earthStart.x,-earthStart.y)*180/Math.PI;
    const offset=polar(planetRadii.Earth,towardSystemCenter+settlement.bearing),world={name:settlement.name,kind:'settlement',system:'Sol',parent:'Earth',surfaceBearing:settlement.bearing,x:earthStart.x+offset.x,y:earthStart.y+offset.y};
    const dx=world.x-origin.x,dy=world.y-origin.y,px=w/2+(dx*Math.cos(rotation)-dy*Math.sin(rotation))*mapProjection.scale,py=h/2-(dx*Math.sin(rotation)+dy*Math.cos(rotation))*mapProjection.scale;
    if(px<0||px>w||py<0||py>h)continue;
    g.fillStyle='#ffe45c';g.beginPath();g.arc(px,py,1,0,Math.PI*2);g.fill();
    const showLabel=radius<=10000.001, outwardX=offset.x*Math.cos(rotation)-offset.y*Math.sin(rotation),labelX=outwardX>=0?px+7:px-7-g.measureText(settlement.name).width;
    if(showLabel)g.fillText(settlement.name,labelX,py-6);
    const shipDx=ship.x-world.x,shipDy=ship.y-world.y,distance=Math.hypot(shipDx,shipDy),visible=offset.x*shipDx+offset.y*shipDy>=0;
    const hit={world,name:settlement.name,course:(Math.atan2(-shipDx,-shipDy)*180/Math.PI+360)%360,distance,centerDistance:distance,safeKm:0,unit:'KM',x:px,y:py,labelY:py-6,width:0,settlement:true};
    mapContacts.push(hit);
    if(mapFocus?.world.name===settlement.name){g.strokeStyle='#ffe45c';g.strokeRect(px-5,py-5,10,10);$('notice').textContent=settlement.name+' · Earth · '+distance.toFixed(0)+' km from ship · '+(!visible?'Planet blocks transporter line of sight':distance>10000?'Beyond Mark I transporter range':'Within Mark I transporter range');}
  }
  g.restore();
};
$('zoom').oninput = draw;
window.onresize = draw;
// Convenience camera preset for discovery review; does not move the ship.
$('previewSettlements').onclick=()=>{document.querySelector('[data-mode="SYSTEM"]').click();selectedSystem='Sol';systemPan={x:earthStart.x,y:earthStart.y};$('zoom').value=100*Math.log(10000/systemMaps.Sol.radius)/Math.log(10/systemMaps.Sol.radius);draw();};
draw();
