// Pure geometry shared by the discovery demo and its boundary checks.
function approachCap(clearance){return clearance<=3?0:clearance<=20?1:clearance<=55?2:clearance<=100?10:clearance<=1000?25:100;}
function segmentEntry(start,end,center,radius){
 const x=start.x-center.x,y=start.y-center.y,dx=end.x-start.x,dy=end.y-start.y;
 const a=dx*dx+dy*dy,c=x*x+y*y-radius*radius;
 if(c<0)return 0;
 if(a===0)return null;
 const b=2*(x*dx+y*dy),disc=b*b-4*a*c;
 if(disc<0)return null;
 const t=(-b-Math.sqrt(disc))/(2*a);
 return t>=0&&t<=1?t:null;
}
