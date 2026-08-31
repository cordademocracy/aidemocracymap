// Static geometry + choreography checks for the Power Peaks volcano.
// Run: bun scripts/verify-volcano.mjs (any cwd)
const L = await Bun.file(new URL("../src/data/layout.json", import.meta.url)).json();
const ORGS = await Bun.file(new URL("../src/data/organizations.json", import.meta.url)).json();
const CSS = await Bun.file(new URL("../src/styles.css", import.meta.url)).text();

function mulberry32(a){return()=>{a|=0;a=(a+0x6d2b79f5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function hashString(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
const OCT=[{freq:5,amp:0.095},{freq:11,amp:0.05},{freq:23,amp:0.026}];
function blobPts(cx,cy,rx,ry,seed,points=56){
  const layers=OCT.map((o,i)=>{const r=mulberry32(seed+i*7919);return{...o,vals:Array.from({length:o.freq},()=>r()*2-1)};});
  const noiseAt=t=>{let s=0;for(const{freq,amp,vals}of layers){const ft=t*freq,i0=Math.floor(ft)%freq,i1=(i0+1)%freq,f=ft-Math.floor(ft),sm=f*f*(3-2*f);s+=amp*(vals[i0]*(1-sm)+vals[i1]*sm);}return s;};
  const pts=[];for(let i=0;i<points;i++){const t=i/points,a=t*Math.PI*2,k=1+noiseAt(t);pts.push([cx+Math.cos(a)*rx*k,cy+Math.sin(a)*ry*k]);}return pts;
}
function inPoly(px,py,pts){let ins=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const[xi,yi]=pts[i],[xj,yj]=pts[j];if((yi>py)!==(yj>py)&&px<((xj-xi)*(py-yi))/(yj-yi)+xi)ins=!ins;}return ins;}
const REGIONS=[["research-range",1010,470,170,120],["power-peaks",1240,585,150,130],["governance-grove",860,345,160,95],["funding-forest",640,400,145,100],["deliberation-delta",560,585,165,115],["integrity-inlet",870,570,150,105],["voting-village",555,785,160,95],["cooperation-cove",855,775,155,90],["backsliding-bay",1140,780,165,95]];
const polys=REGIONS.map(([id,cx,cy,rx,ry])=>[id,blobPts(cx,cy,rx*1.08,ry*1.12,hashString(id))]);
const paint=(x,y)=>{let o="bare island";for(const[id,p]of polys)if(inPoly(x,y,p))o=id;return o;};

const NODE_R={core:17.5,adjacent:14.5,broad:12.5};
const nodeR=o=>NODE_R[o.depthRing]+(mulberry32(hashString(o.slug))()-0.5)*3;
const pp=ORGS.filter(o=>o.region==="power-peaks").map(o=>({slug:o.slug,...L.nodes[o.slug],r:nodeR(o)}));

const X=1219,Y=602,S=1.0,CY=Y-58*S;
function segDist(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay;const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy)));return Math.hypot(px-(ax+t*dx),py-(ay+t*dy));}
const CONE=[[X-11*S,CY],[X+11*S,CY],[X+64*S,Y+8*S],[X-64*S,Y+8*S]];
function coneDist(px,py){
  let d=Infinity;for(let i=0;i<4;i++){const a=CONE[i],b=CONE[(i+1)%4];d=Math.min(d,segDist(px,py,a[0],a[1],b[0],b[1]));}
  if(inPoly(px,py,CONE))return -d;
  const ex=(px-X)/(66*S),ey=(py-(Y+8*S))/(9*S),k=Math.hypot(ex,ey);
  return Math.min(d, k<=1?-1:(k-1)*36*S);
}
let fail=0;
const ok=(c,m)=>{console.log((c?"  PASS ":"  FAIL ")+m); if(!c)fail++;};

console.log("\n[1] cone silhouette sits on Power Peaks paint");
for(const [n,px,py] of [["crater C",X,CY],["crater L",X-11,CY],["crater R",X+11,CY],["base L",X-64,Y+8],["base R",X+64,Y+8],["base C",X,Y+8],["shadow L",X-66,Y+8],["shadow R",X+66,Y+8],["slope L",X-37,Y-25],["slope R",X+37,Y-25]])
  ok(paint(px,py)==="power-peaks", `${n.padEnd(9)} (${px},${py}) -> ${paint(px,py)}`);

console.log("\n[2] node clearance to the cone silhouette (need > 0)");
let worst=Infinity;
for(const p of pp){const c=coneDist(p.x,p.y)-p.r; worst=Math.min(worst,c); ok(c>0, `${p.slug.slice(0,44).padEnd(46)} ${c.toFixed(1)}px`);}
console.log(`  worst node clearance: ${worst.toFixed(1)}px`);

console.log("\n[3] 'Power Peaks' title pill (nodeDx 8, nodeDy -116)");
const LX=1240+8, LY=585-116, LW=("Power Peaks".length*8+26)/2, LH=29/2;
for(const [n,px,py] of [["left",LX-LW,LY],["right",LX+LW,LY],["top",LX,LY-LH],["bottom",LX,LY+LH],["top-l",LX-LW*0.7,LY-LH],["top-r",LX+LW*0.7,LY-LH]])
  ok(paint(px,py)==="power-peaks", `pill ${n.padEnd(6)} (${px.toFixed(0)},${py}) -> ${paint(px,py)}`);
let pw=Infinity, pworst="";
for(const p of pp){const dx=Math.max(0,Math.abs(p.x-LX)-LW),dy=Math.max(0,Math.abs(p.y-LY)-LH);const c=Math.hypot(dx,dy)-p.r;if(c<pw){pw=c;pworst=p.slug;}}
ok(pw>0, `pill clearance to nearest node (${pworst}): ${pw.toFixed(1)}px`);
ok(coneDist(LX,LY+LH)>0 && coneDist(LX,LY-LH)>0, `pill clears the cone: ${coneDist(LX,LY+LH).toFixed(1)}px`);

console.log("\n[4] foothill mountains: exact triangle + shadow ellipse vs cone and nodes");
// Terrain.tsx derives these from region.cx/rx; resolved here for power-peaks
const FOOT=[[1240-150*0.8, 585+130*0.46, 0.5],[1240+150*0.46, 585+130*0.11, 0.4]];
function mountainDist(px,py,mx,my,ms){
  const tri=[[mx,my-54*ms],[mx-40*ms,my],[mx+40*ms,my]];
  let d=Infinity;for(let i=0;i<3;i++){const a=tri[i],b=tri[(i+1)%3];d=Math.min(d,segDist(px,py,a[0],a[1],b[0],b[1]));}
  if(inPoly(px,py,tri))d=-d;
  const ex=(px-mx)/(40*ms),ey=(py-(my+2*ms))/(6*ms),k=Math.hypot(ex,ey);
  return Math.min(d, k<=1?-1:(k-1)*24*ms);
}
for(const [mx,my,ms] of FOOT){
  const tag=`mountain (${mx.toFixed(0)},${my.toFixed(0)}) s=${ms}`;
  let cd=Infinity;
  for(const [px,py] of [[mx,my-54*ms],[mx-40*ms,my],[mx+40*ms,my],[mx-40*ms,my+2*ms],[mx+40*ms,my+2*ms],[mx-20*ms,my-27*ms],[mx+20*ms,my-27*ms]]) cd=Math.min(cd,coneDist(px,py));
  ok(cd>0, `${tag} clears the cone by ${cd.toFixed(1)}px`);
  ok(paint(mx,my)==="power-peaks", `${tag} on Power Peaks paint`);
  let m=Infinity,w="";
  for(const p of pp){
    let dmin=Infinity;
    for(let a=0;a<64;a++){const th=a/64*Math.PI*2;dmin=Math.min(dmin,mountainDist(p.x+Math.cos(th)*p.r,p.y+Math.sin(th)*p.r,mx,my,ms));}
    if(dmin<m){m=dmin;w=p.slug;}
  }
  ok(m>0, `${tag} node clearance ${m.toFixed(1)}px (${w})`);
}

console.log("\n[4b] no other district's title pill sits in the plume column");
const PLUME={x0:X-60,x1:X+60,y0:CY-220,y1:CY};
for(const [id,cx,cy,rx,ry] of REGIONS){
  if(id==="power-peaks")continue;
  const nm=REGIONS.find(r=>r[0]===id);
  const name={"research-range":"Research Range","governance-grove":"Governance Grove","funding-forest":"Funding Forest","deliberation-delta":"Deliberation Delta","integrity-inlet":"Integrity Inlet","voting-village":"Voting Village","cooperation-cove":"Cooperation Cove","backsliding-bay":"Backsliding Bay"}[id];
  const dx0=id==="integrity-inlet"?0:0, dy0=id==="integrity-inlet"?-42:0;
  const w=(name.length*8+26)/2, lx=cx+dx0, ly=cy+dy0;
  const hit = lx+w>PLUME.x0 && lx-w<PLUME.x1 && ly+14.5>PLUME.y0 && ly-14.5<PLUME.y1;
  ok(!hit, `${name} pill (${lx},${ly}) outside the plume column x[${PLUME.x0}-${PLUME.x1}] y[${PLUME.y0}-${PLUME.y1}]`);
}

/* ── choreography ─────────────────────────────────────────────────────── */
function keyframes(name){
  const i=CSS.indexOf(`@keyframes ${name} {`); if(i<0) throw new Error("no @keyframes "+name);
  let depth=0,j=CSS.indexOf("{",i),k=j;
  for(;k<CSS.length;k++){if(CSS[k]==="{")depth++;else if(CSS[k]==="}"){depth--;if(!depth)break;}}
  const body=CSS.slice(j+1,k);
  const out=[];
  for(const m of body.matchAll(/([\d.%,\s]+?)\{([^}]*)\}/g)){
    const stops=m[1].split(",").map(s=>parseFloat(s)).filter(n=>!isNaN(n));
    const decl=Object.fromEntries([...m[2].matchAll(/([a-z-]+)\s*:\s*([^;]+)/g)].map(d=>[d[1],d[2].trim()]));
    for(const s of stops) out.push({at:s,decl});
  }
  return out.sort((a,b)=>a.at-b.at);
}
const opacityAt=(kf,pct)=>{
  const pts=kf.filter(k=>k.decl.opacity!==undefined).map(k=>({at:k.at,v:parseFloat(k.decl.opacity)}));
  if(!pts.length)return null;
  if(pct<=pts[0].at)return pts[0].v;
  for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];if(pct>=a.at&&pct<=b.at)return a.v+(b.v-a.v)*(pct-a.at)/(b.at-a.at||1);}
  return pts.at(-1).v;
};

console.log("\n[5] single climax: all lava-bomb onsets inside one window");
const onsets=["vp0","vp1","vp2","vp3","vp4"].map(n=>{
  const kf=keyframes(n);
  // launch = last opacity:0 stop before the first opacity:1 stop
  const lit=Math.min(...kf.filter(k=>k.decl.opacity==="1").map(k=>k.at));
  return Math.max(...kf.filter(k=>k.decl.opacity==="0"&&k.at<lit).map(k=>k.at));
});
console.log("  onsets %:", onsets.join(", "));
ok(Math.max(...onsets)-Math.min(...onsets)<=4, `onset spread ${(Math.max(...onsets)-Math.min(...onsets)).toFixed(1)}% <= 4%`);
const glow=keyframes("v-glow");
const glowPeak=glow.reduce((a,b)=>parseFloat(b.decl.opacity??-1)>parseFloat(a.decl.opacity??-1)?b:a).at;
ok(glowPeak>=12&&glowPeak<=16, `glow peak at ${glowPeak}% (inside the 12–16% burst window)`);
const shake=keyframes("v-shake");
const amp=k=>{const m=k.decl.transform?.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);return m?Math.hypot(+m[1],+m[2]):0;};
const shakePeak=shake.reduce((a,b)=>amp(b)>amp(a)?b:a);
ok(shakePeak.at>=12&&shakePeak.at<=16, `shake peak at ${shakePeak.at}% amp ${amp(shakePeak).toFixed(1)} (burst window)`);
const rising=shake.filter(k=>k.at<=12).map(amp);
ok(rising.every((v,i,a)=>i===0||v>=a[i-1]), `rumble amplitude is monotonically increasing into the burst: ${rising.map(v=>v.toFixed(1)).join(" < ")}`);

console.log("\n[6] no dead frames: an opacity-bearing track is visible at every 1% sample");
const tracks={ "v-glow":7, "v-pool":7, vp0:7, vp1:7, vp2:7, vp3:7, vp4:7, vs0:7, vs1:7, vs2:7, vst0:7, vst1:7, vst2:7, "v-idle":3.5, "v-ember":2.3333, "v-ember-r":2.3333 };
let dead=[];
for(let i=0;i<100;i++){
  const t=(i/100)*7;
  let live=0, lines=[];
  for(const [n,dur] of Object.entries(tracks)){
    const local=((t%dur)/dur)*100;
    const o=opacityAt(keyframes(n),local);
    if(o!==null&&o>0.02){live++;lines.push(n);}
  }
  if(!live)dead.push(i);
}
ok(dead.length===0, `dead frames: ${dead.length===0?"none":dead.join(",")}`);
const glowFloor=Math.min(...keyframes("v-glow").filter(k=>k.decl.opacity!==undefined).map(k=>parseFloat(k.decl.opacity)));
ok(glowFloor>=0.25, `crater glow never goes dark: opacity floor ${glowFloor}`);

console.log("\n[7] off-cycle tracks are 7s harmonics (no drift across the burst)");
for(const [n,d] of [["v-idle",3.5],["v-ember",2.3333]]) {
  const reps = 7/d;
  ok(Math.abs(reps-Math.round(reps))<0.001, `${n}: ${d}s -> ${reps.toFixed(4)} repeats per 7s master cycle`);
}

console.log("\n[8] reduced-motion covers every volcano class");
const used=[...(await Bun.file(new URL("../src/components/MapDecor.tsx", import.meta.url)).text()).matchAll(/v-[a-z]+/g)].map(m=>m[0]);
const rm=CSS.slice(CSS.indexOf("prefers-reduced-motion"));
for(const c of [...new Set(used)]) ok(rm.includes("."+c), `.${c} listed in the reduced-motion block`);
console.log("\n[9] the water jets are gone in one piece: art, plumbing and CSS");
const DECOR = await Bun.file(new URL("../src/components/MapDecor.tsx", import.meta.url)).text();
const MAP = await Bun.file(new URL("../src/components/IslandMap.tsx", import.meta.url)).text();
const ISLE = await Bun.file(new URL("../scripts/render-island.tsx", import.meta.url)).text();
ok(!/\.v-water|@keyframes vw2?\b/.test(CSS), "no .v-water rule and no vw/vw2 keyframes in styles.css");
ok(!/v-water/.test(DECOR), "no water-jet art in MapDecor.tsx");
ok(!/waterSources|<Volcano[^>]*sources/.test(MAP), "no waterSources memo or sources prop in IslandMap.tsx");
ok(!/waterSources|<Volcano[^>]*sources/.test(ISLE), "no waterSources copy in the render harness");

console.log(fail===0?"\nALL CHECKS PASSED":`\n${fail} CHECK(S) FAILED`);
process.exit(fail?1:0);
