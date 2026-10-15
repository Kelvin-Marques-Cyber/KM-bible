import { useEffect, useRef } from 'react';
import { STATIONS, WORLD_HEIGHT, WORLD_WIDTH, type JourneyState } from './campaign-engine';
import type { ChronicleEpisode } from './campaign-content';

type Props={
  episode:ChronicleEpisode; game:JourneyState; paused:boolean;
  input:{dx:number;dy:number;run:boolean};
  onMove:(dx:number,dy:number,seconds:number,run:boolean)=>void;
  onInteract:()=>void;
};
const W=480,H=270,X=W/WORLD_WIDTH,Y=H/WORLD_HEIGHT;
type Palette={sky:string;horizon:string;hills:string;hills2:string;ground:string;shade:string;stone:string;water:string;highlight:string};
const THEMES:Record<string,Palette>={
garden:{sky:'#5c9b9b',horizon:'#a3cdbc',hills:'#6d956e',hills2:'#436c5a',ground:'#829f64',shade:'#527d54',stone:'#a9a17c',water:'#4f899b',highlight:'#eed098'},
flood:{sky:'#303e59',horizon:'#65748a',hills:'#53607a',hills2:'#354d67',ground:'#6c735e',shade:'#465d60',stone:'#9a9584',water:'#477b91',highlight:'#f0c393'},
city:{sky:'#5d7b91',horizon:'#d6b5a0',hills:'#b29172',hills2:'#8b695a',ground:'#aa926e',shade:'#776451',stone:'#d4ba8b',water:'#577d85',highlight:'#f8e3b1'},
desert:{sky:'#507da6',horizon:'#edc596',hills:'#b89577',hills2:'#b37d5a',ground:'#c3a679',shade:'#9e7956',stone:'#dbbc8e',water:'#548aa0',highlight:'#f8d992'},
palace:{sky:'#43557e',horizon:'#9ca3b3',hills:'#8a8289',hills2:'#645c74',ground:'#a79a8d',shade:'#7c6e75',stone:'#d4c0a9',water:'#496f86',highlight:'#e5d3b2'},
river:{sky:'#497c96',horizon:'#b2bfae',hills:'#73968c',hills2:'#587c78',ground:'#82a181',shade:'#587b62',stone:'#c7b99a',water:'#478fa6',highlight:'#ede2a6'},
mountain:{sky:'#354c77',horizon:'#bcb6a5',hills:'#696e8a',hills2:'#444c6e',ground:'#929c85',shade:'#546d67',stone:'#c3bbb1',water:'#5489a8',highlight:'#f2d5a5'},
egypt:{sky:'#4b809d',horizon:'#d3bc91',hills:'#ac9978',hills2:'#967955',ground:'#ccb58a',shade:'#957e5e',stone:'#dec79c',water:'#488b9e',highlight:'#e9ce98'},
sea:{sky:'#54769a',horizon:'#a1b5bc',hills:'#6c8f96',hills2:'#4c7887',ground:'#879a90',shade:'#6a8384',stone:'#d3c2a5',water:'#427e9b',highlight:'#f5ddb7'},
temple:{sky:'#465b7f',horizon:'#9eafbc',hills:'#777d8e',hills2:'#666c7b',ground:'#b2a48b',shade:'#887e6b',stone:'#ddd0b6',water:'#547f91',highlight:'#ecd1a3'},
fields:{sky:'#608f9d',horizon:'#b6ccb2',hills:'#779b78',hills2:'#638061',ground:'#a9a472',shade:'#817d50',stone:'#ccba90',water:'#648e9c',highlight:'#f4dca9'},
village:{sky:'#607f9c',horizon:'#d0c2ad',hills:'#a5a089',hills2:'#7b866b',ground:'#a9a071',shade:'#857952',stone:'#dac39e',water:'#608ca1',highlight:'#f4d4a6'},
upper:{sky:'#3f4a64',horizon:'#8e8794',hills:'#77707f',hills2:'#655567',ground:'#8b786c',shade:'#675c53',stone:'#c7b3a4',water:'#69848d',highlight:'#efc99a'}
};
function hash(s:string):number {let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;}
function rect(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,c:string){
 ctx.fillStyle=c;ctx.fillRect(Math.floor(x),Math.floor(y),Math.ceil(w),Math.ceil(h));
}
function polygon(ctx:CanvasRenderingContext2D,p:number[],c:string){
 ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2)ctx.lineTo(p[i],p[i+1]);ctx.closePath();ctx.fill();
}
function backdrop(ctx:CanvasRenderingContext2D,e:ChronicleEpisode,time:number){
 const p=THEMES[e.setting]??THEMES.village;
 rect(ctx,0,0,W,120,p.sky);rect(ctx,0,120,W,150,p.horizon);
 for(let i=0;i<8;i++){
  const x=(hash(e.id+':cloud'+i)%560)-40,y=16+(hash(e.id+':cloud-y'+i)%65);
  const o=Math.round(Math.sin(time*.00012+i)*3);
  rect(ctx,x+o,y,39,6,'#ffffff15');rect(ctx,x+o+9,y-3,21,4,'#ffffff19');
 }
 // Layered highland silhouettes drawn in large pixel blocks.
 for(let layer=0;layer<2;layer++){
  const color=layer?p.hills2:p.hills;
  const base=128+layer*34;
  for(let i=0;i<16;i++){
    const x=i*34-16,y=base-(hash(e.id+layer+':hill'+i)%53);
    polygon(ctx,[x,base+54,x,y,x+18,y-8,x+44,base+54],color);
  }
 }
 rect(ctx,0,157,W,113,p.ground);
 // Tiny deterministic tiles create atmosphere without downloading any asset.
 for(let i=0;i<360;i++){
   const x=hash(e.id+'x'+i)%W, y=156+hash(e.id+'y'+i)%111;
   rect(ctx,x,y,1+(i%3),1,i%5===0?p.highlight:p.shade);
 }
 // Path from start to all three discoveries.
 ctx.strokeStyle=p.stone;ctx.lineWidth=12;ctx.lineCap='square';ctx.beginPath();
 ctx.moveTo(17*X,16*Y);ctx.lineTo(17*X,10*Y);ctx.lineTo(5*X,10*Y);
 ctx.lineTo(5*X,6*Y);ctx.moveTo(17*X,10*Y);ctx.lineTo(16.5*X,4.7*Y);
 ctx.moveTo(17*X,10*Y);ctx.lineTo(29*X,10*Y);ctx.lineTo(29*X,7*Y);ctx.stroke();
 // Topographic motifs vary with the scripture's setting.
 if(e.setting==='river'||e.setting==='sea'||e.setting==='flood'){
   for(let i=0;i<12;i++){const y=28+i*20;rect(ctx,0,y,23+(i%3)*7,10,p.water);rect(ctx,0,y+7,30+(i%4)*3,2,'#9bd2d1');}
 }
 if(e.setting==='city'||e.setting==='palace'||e.setting==='temple'||e.setting==='egypt'||e.setting==='upper'){
  for(let i=0;i<7;i++){
    const x=i*72-7,base=150+(i%2)*8;rect(ctx,x,base-54,59,54,p.stone);
    rect(ctx,x+8,base-62,44,8,p.shade);rect(ctx,x+17,base-33,15,33,p.shade);
    rect(ctx,x+33,base-33,8,13,p.sky);
    if(e.setting==='temple'||e.setting==='upper')rect(ctx,x+23,base-76,4,15,p.highlight);
  }
 } else if(e.setting==='desert'||e.setting==='mountain'){
  for(let i=0;i<5;i++){
   const x=i*120-20;polygon(ctx,[x,175,x+42,95,x+95,175],p.stone);
   polygon(ctx,[x+29,118,x+42,95,x+56,118],e.setting==='mountain'?'#e7ddcf':p.highlight);
  }
 }else{
  for(let i=0;i<17;i++){
    const x=hash(e.id+'tree'+i)%W;
    if(Math.abs(x-5*X)<25||Math.abs(x-16.5*X)<30||Math.abs(x-29*X)<23)continue;
    const y=173+hash(e.id+'treey'+i)%70;
    rect(ctx,x,y,4,16,'#66553c');rect(ctx,x-9,y-12,22,14,p.hills2);
    rect(ctx,x-6,y-21,17,12,p.hills);
  }
 }
 // Structures at sides only; central path is kept clear.
 if(e.setting==='flood'){
  rect(ctx,368,147,84,42,'#715641');for(let i=0;i<6;i++)rect(ctx,371,150+i*7,77,2,'#ad8860');
  polygon(ctx,[360,148,411,112,460,148],'#553e35');
 }else if(e.setting==='village'||e.setting==='fields'||e.setting==='garden'){
  rect(ctx,384,169,71,42,p.stone);polygon(ctx,[378,170,421,137,463,170],p.shade);
  rect(ctx,405,185,15,26,p.shade);
 }
 // Sunbeam and darker vignette separate game plane from interface.
 rect(ctx,0,0,W,5,p.shade);rect(ctx,0,H-5,W,5,p.shade);
}
function character(ctx:CanvasRenderingContext2D,e:ChronicleEpisode,g:JourneyState,time:number){
 const x=Math.round(g.x*X),y=Math.round(g.y*Y);
 const frame=Math.floor(time/240)%2,bob=g.steps%2&&frame?1:0;
 rect(ctx,x-7,y-1,15,4,'#252b2c55');
 rect(ctx,x-4,y-16+bob,9,12,e.saga===4?'#e0be98':'#6d8b8a');
 rect(ctx,x-4,y-28+bob,9,11,'#d6ac85');
 rect(ctx,x-5,y-29+bob,11,4,'#42352d');
 rect(ctx,x-4,y-4+bob,4,5,'#343b39');rect(ctx,x+2,y-4+bob,4,5,'#343b39');
 rect(ctx,x-7,y-14+bob,3,8,'#d1ac84');rect(ctx,x+6,y-14+bob,3,8,'#d1ac84');
 const eyeX=g.facing==='left'?-3:g.facing==='right'?4:0;
 rect(ctx,x+eyeX,y-22+bob,2,2,'#3f302b');
}
function stations(ctx:CanvasRenderingContext2D,e:ChronicleEpisode,g:JourneyState,time:number){
 for(let i=0;i<3;i++){
   const s=STATIONS[i],x=Math.round(s.x*X),y=Math.round(s.y*Y);
   const known=g.visited.includes(i),near=Math.hypot(g.x-s.x,g.y-s.y)<=2.6;
   const pulse=Math.round(Math.sin(time/400+i)*2);
   // discoverable golden archive pedestal + icon
   rect(ctx,x-12,y+3,25,6,'#2e3d35');rect(ctx,x-10,y-5,21,10,known?'#6f8175':'#a07852');
   rect(ctx,x-7,y-12+pulse,15,8,known?'#9dc5aa':'#e5c787');
   rect(ctx,x-3,y-15+pulse,7,3,'#f6e9ca');
   if(near&&!known){rect(ctx,x-13,y-24,27,4,'#fff0b5');rect(ctx,x-13,y+10,27,2,'#e2bd7e');}
   if(known){rect(ctx,x-3,y-9,6,2,'#315646');}
 }
}
export function drawCampaignScene(ctx:CanvasRenderingContext2D,e:ChronicleEpisode,g:JourneyState,t:number){
 ctx.imageSmoothingEnabled=false;
 backdrop(ctx,e,t);stations(ctx,e,g,t);character(ctx,e,g,t);
}
export default function CampaignCanvas({episode,game,paused,input,onMove,onInteract}:Props){
 const canvas=useRef<HTMLCanvasElement>(null);
 const frame=useRef(0),props=useRef({episode,game,paused,input,onMove,onInteract});
 props.current={episode,game,paused,input,onMove,onInteract};
 useEffect(()=>{
   const el=canvas.current;if(!el)return;
   const ctx=el.getContext('2d',{alpha:false});if(!ctx)return;
   let running=true,previous=0,drawAt=0;
   const keys=new Set<string>();
   const clear=()=>keys.clear();
   const down=(event:KeyboardEvent)=>{
     if(document.activeElement!==el)return;
     const k=event.key.toLowerCase();
     if(['arrowleft','arrowright','arrowup','arrowdown','w','a','s','d','e','enter',' ','shift'].includes(k))event.preventDefault();
     if(k==='e'||k==='enter'){if(!event.repeat)props.current.onInteract();return;}
     keys.add(k);
   };
   const up=(event:KeyboardEvent)=>keys.delete(event.key.toLowerCase());
   const hidden=()=>{if(document.hidden){clear();previous=0;}};
   const onBlur=()=>clear();
   const tick=(now:number)=>{
     if(!running)return;
     const dt=previous?Math.min((now-previous)/1000,.05):0;
     previous=now;
     const p=props.current;
     if(!p.paused){
       const dx=Number(keys.has('arrowright')||keys.has('d'))-Number(keys.has('arrowleft')||keys.has('a'))+p.input.dx;
       const dy=Number(keys.has('arrowdown')||keys.has('s'))-Number(keys.has('arrowup')||keys.has('w'))+p.input.dy;
       if((dx||dy)&&dt>0)p.onMove(dx,dy,dt,keys.has('shift')||p.input.run);
     }
     if(now-drawAt>=34){drawCampaignScene(ctx,p.episode,p.game,now);drawAt=now;}
     frame.current=requestAnimationFrame(tick);
   };
   el.addEventListener('keydown',down);el.addEventListener('keyup',up);el.addEventListener('blur',onBlur);
   document.addEventListener('visibilitychange',hidden);window.addEventListener('blur',onBlur);
   frame.current=requestAnimationFrame(tick);
   return()=>{running=false;cancelAnimationFrame(frame.current);el.removeEventListener('keydown',down);el.removeEventListener('keyup',up);
     el.removeEventListener('blur',onBlur);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('blur',onBlur);};
 },[]);
 return <canvas ref={canvas} width={W} height={H} tabIndex={0} role="application"
   aria-label={'RPG pixel art — '+episode.title+'. Mova com setas ou WASD; interaja com E perto dos três marcos.'}
   className="h-full w-full rounded-xl bg-[#253934] outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#f3d48c]"
   style={{imageRendering:'pixelated',objectFit:'contain'}}/>;
}
