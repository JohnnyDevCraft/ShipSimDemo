// Local View Screen preview controls; independent of Communications.
window.ViewSettings = (() => {
  const key = 'ship-sim-view-screen-preview-v1';
  const defaults = {type:'srs',srsRange:'1-bkm',lrsRange:'30-ly'};
  const ranges = {'1-bkm':1e9,'0.1-bkm':1e8,'0.01-bkm':1e7,'1-mkm':1e6,'0.1-mkm':1e5,'0.01-mkm':1e4,'10000-km':1e4,'1000-km':1e3,'100-km':100,'30-ly':30*9.4607304725808e12,'20-ly':20*9.4607304725808e12,'10-ly':10*9.4607304725808e12,'5-ly':5*9.4607304725808e12,'1-ly':9.4607304725808e12};
  function read(){let v={};try{v=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch{}return {type:['srs','lrs','dual'].includes(v.type)?v.type:defaults.type,srsRange:v.srsRange in ranges?v.srsRange:defaults.srsRange,lrsRange:v.lrsRange in ranges?v.lrsRange:defaults.lrsRange};}
  function write(v){const next={...read(),...v};try{localStorage.setItem(key,JSON.stringify(next));}catch{}window.dispatchEvent(new Event('viewsettingschange'));}
  function label(v){return v==='10000-km'?'10,000 km':v==='1000-km'?'1,000 km':v.replace('-', ' ').replace('bkm','BKM').replace('mkm','MKM').replace('ly','LY');}
  return {read,write,ranges,label,key};
})();
