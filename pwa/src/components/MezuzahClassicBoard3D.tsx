/**
 * Mesa 3D WebGL2 própria — sem CDN e sem dependências externas.
 * Madeira com veios procedurais, peças torneadas, materiais metálicos e
 * iluminação de estúdio. A cena gira com mouse/toque e zoom com a roda.
 */
import { useEffect, useRef, useState } from 'react';
import { totalSteps, type ClassicGame } from '../games/mezuzah-classic/engine';

type VertexBuffer = number[];
type Point = [number, number, number];
const cl = (hex: string): Point => {
  const val = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(val.slice(i, i + 2), 16) / 255) as Point;
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

class Geometry {
  values: VertexBuffer = [];
  vertex(p: Point, n: Point, c: Point, material: number) { this.values.push(...p, ...n, ...c, material); }
  triangle(a: Point, b: Point, c: Point, n: Point, color: Point, material = 0) {
    this.vertex(a, n, color, material); this.vertex(b, n, color, material); this.vertex(c, n, color, material);
  }
  quad(a: Point, b: Point, c: Point, d: Point, n: Point, color: Point, material = 0) {
    this.triangle(a, b, c, n, color, material); this.triangle(a, c, d, n, color, material);
  }
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: string, material = 0) {
    const a = x - w / 2, b = x + w / 2, l = y - h / 2, t = y + h / 2, c = z - d / 2, e = z + d / 2;
    const q = cl(color);
    this.quad([a,t,c],[b,t,c],[b,t,e],[a,t,e],[0,1,0],q,material);
    this.quad([b,l,e],[a,l,e],[a,l,c],[b,l,c],[0,-1,0],q,material);
    this.quad([a,l,e],[b,l,e],[b,t,e],[a,t,e],[0,0,1],q,material);
    this.quad([b,l,c],[a,l,c],[a,t,c],[b,t,c],[0,0,-1],q,material);
    this.quad([b,l,e],[b,l,c],[b,t,c],[b,t,e],[1,0,0],q,material);
    this.quad([a,l,c],[a,l,e],[a,t,e],[a,t,c],[-1,0,0],q,material);
  }
  lathe(x: number, y: number, z: number, profile: [number, number][], color: string, metal = 0, sides = 16) {
    const q = cl(color);
    for (let i = 0; i < profile.length - 1; i++) {
      const [r0, y0] = profile[i], [r1, y1] = profile[i + 1];
      for (let j = 0; j < sides; j++) {
        const a = j * Math.PI * 2 / sides, b = (j + 1) * Math.PI * 2 / sides;
        // Sphere profiles descend in y; preserve the tangent's sign so their
        // upper hemisphere is lit from above rather than receiving inverted normals.
        const dy=y1-y0, tangentY=Math.abs(dy)<.001?(dy<0?-.001:.001):dy;
        const nA: Point = [Math.cos(a), -(r1-r0) / tangentY, Math.sin(a)];
        const nB: Point = [Math.cos(b), nA[1], Math.sin(b)];
        const norm = (v: Point): Point => {
          const l = Math.hypot(...v) || 1;
          return [v[0]/l,v[1]/l,v[2]/l];
        };
        const A: Point=[x+r0*Math.cos(a),y+y0,z+r0*Math.sin(a)];
        const B: Point=[x+r0*Math.cos(b),y+y0,z+r0*Math.sin(b)];
        const C: Point=[x+r1*Math.cos(b),y+y1,z+r1*Math.sin(b)];
        const D: Point=[x+r1*Math.cos(a),y+y1,z+r1*Math.sin(a)];
        const first=norm(nA), second=norm(nB);
        this.vertex(A,first,q,metal);this.vertex(B,second,q,metal);this.vertex(C,second,q,metal);
        this.vertex(A,first,q,metal);this.vertex(C,second,q,metal);this.vertex(D,first,q,metal);
      }
    }
  }
  sphere(x: number, y: number, z: number, radius: number, color: string, metal = 0) {
    const profile: [number,number][]=[];
    for(let i=0;i<=12;i++){
      const a=i*Math.PI/12;
      profile.push([Math.sin(a)*radius, (Math.cos(a)+1)*radius]);
    }
    this.lathe(x,y-radius,z,profile,color,metal,18);
  }
}

const VERT = `#version 300 es
precision highp float;
in vec3 aPosition;
in vec3 aNormal;
in vec3 aColor;
in float aMaterial;
uniform vec3 uEye;
uniform float uAspect;
uniform float uFocal;
out vec3 vColor;
out vec3 vNormal;
out vec3 vWorld;
out float vMaterial;
void main() {
  vec3 target=vec3(0.0,0.0,0.0);
  vec3 front=normalize(target-uEye);
  vec3 right=normalize(cross(front,vec3(0.0,1.0,0.0)));
  vec3 up=cross(right,front);
  vec3 delta=aPosition-uEye;
  float depth=dot(delta,front);
  float near=0.12, far=80.0;
  gl_Position=vec4(dot(delta,right)*uFocal/uAspect,dot(delta,up)*uFocal,
    depth*(far+near)/(far-near)-2.0*far*near/(far-near),depth);
  vColor=aColor;vNormal=aNormal;vWorld=aPosition;vMaterial=aMaterial;
}`;
const FRAG = `#version 300 es
precision highp float;
in vec3 vColor;
in vec3 vNormal;
in vec3 vWorld;
in float vMaterial;
uniform vec3 uEye;
out vec4 outColor;
void main(){
  vec3 n=normalize(vNormal);
  vec3 light=normalize(vec3(-0.36,0.88,0.56));
  float diffuse=max(dot(n,light),0.0);
  vec3 reflected=reflect(-light,n);
  vec3 view=normalize(uEye-vWorld);
  float spec=pow(max(dot(reflected,view),0.0),vMaterial>1.5?70.0:28.0);
  float wood=0.0;
  if(vMaterial>0.5&&vMaterial<1.5){
    float grain=sin(vWorld.x*38.0+sin(vWorld.z*13.0)*4.0)*0.036;
    wood=grain+sin(vWorld.x*115.0+vWorld.z*7.0)*0.012;
  }
  vec3 color=vColor*(0.46+diffuse*0.65)+wood;
  color+=vec3(1.0,0.89,0.7)*spec*(vMaterial>1.5?0.52:0.15);
  float dist=length(vWorld.xz);
  color*=1.0-min(0.16,dist*0.008);
  outColor=vec4(pow(max(color,vec3(0.0)),vec3(0.90)),1.0);
}`;

type Route = ClassicGame['route'];
function routePosition(step: number, route: Route): {x:number;z:number} {
  if(step>=route.outerSteps+route.starSteps+1)return {x:0,z:-1.35};
  if(step<route.outerSteps){
    const angle=Math.PI*.5+step/route.outerSteps*Math.PI*2;
    return {x:Math.cos(angle)*3.25,z:Math.sin(angle)*5.1};
  }
  const t=(step-route.outerSteps)/route.starSteps*12;
  const i=Math.floor(t)%12,f=t-Math.floor(t);
  const point=(j:number)=>{const a=Math.PI*.5+j*Math.PI/6,r=j%2?1.18:2.25;return {x:Math.cos(a)*r,z:Math.sin(a)*r-1.35};};
  const a=point(i),b=point((i+1)%12);
  return {x:lerp(a.x,b.x,f),z:lerp(a.z,b.z,f)};
}
function buildTable(route: Route): Float32Array {
  const g=new Geometry();
  g.box(0,-.62,0,24,.26,24,'#292c2d',1);
  g.box(0,-.34,0,8.6,.40,12.5,'#28100c',1);
  g.box(0,-.12,0,8.36,.13,12.26,'#aa6935',1);
  g.box(0,-.04,0,8.17,.045,12.07,'#c5a06b',2);
  g.box(0,0,0,7.95,.09,11.85,'#bd9f68',1);
  // Original geographic relief, deliberately not a reproduction of licensed board artwork.
  g.box(-2.55,.075,-1.2,1.75,.04,7.1,'#416d75');
  g.box(-1.5,.10,3.1,2.6,.05,2.6,'#d1b47a');
  for(let i=0;i<14;i++){
    const z=-4.5+i*.69,x=-.8+Math.sin(i*1.7)*.55;
    g.lathe(x,.05,z,[[.58,0],[.45,.13],[.26,.32],[0,.42]],i%2?'#7b8053':'#94915a',0,7);
  }
  g.box(.65,.12,1.7,.27,.05,1.2,'#446f78');
  g.box(.7,.12,-3,.42,.05,.75,'#446f78');
  for(let i=0;i<7;i++){
    const x=-.1+Math.sin(i*2.2)*1.2,z=-3.8+i*1.15;
    g.box(x,.18,z,.25,.25,.31,'#c5b086');
    g.box(x,.33,z,.29,.045,.35,'#e2d0a4');
  }
  const path=(a:{x:number;z:number},b:{x:number;z:number},width:number,color:string)=>{
    const length=Math.hypot(b.x-a.x,b.z-a.z)||1,dx=(b.z-a.z)/length*width,dz=-(b.x-a.x)/length*width;
    g.quad([a.x-dx,.14,a.z-dz],[b.x-dx,.14,b.z-dz],[b.x+dx,.14,b.z+dz],[a.x+dx,.14,a.z+dz],[0,1,0],cl(color),2);
  };
  const end=route.outerSteps+route.starSteps+1;
  for(let i=0;i<=end;i++){
    const p=routePosition(i,route),next=routePosition(Math.min(end,i+1),route);
    path(p,next,.023,'#d6ad64');
    g.lathe(p.x,.15,p.z,[[.105,0],[.115,.018],[.09,.035]],i===end?'#fff0b5':i<route.outerSteps?'#725d39':'#cab16f',2,12);
  }
  // Hexagram inlay is geometric and newly drawn for this scene.
  for(let j=0;j<6;j++){
    const a=Math.PI*.5+j*Math.PI/3,b=a+Math.PI*2/3;
    path({x:Math.cos(a)*2.25,z:Math.sin(a)*2.25-1.35},{x:Math.cos(b)*2.25,z:Math.sin(b)*2.25-1.35},.018,'#b18c42');
  }
  for(const z of [-6.05,6.05])g.box(0,.02,z,8.33,.09,.045,'#d3ab6c',2);
  for(const x of [-4.12,4.12])g.box(x,.02,0,.045,.09,12.15,'#d3ab6c',2);
  for(const x of [-4.12,4.12])for(const z of [-6.05,6.05])g.sphere(x,.035,z,.075,'#e0bb72',2);
  return new Float32Array(g.values);
}

function buildTokens(state: ClassicGame, clock: number, previous: readonly number[]): Float32Array {
  const g = new Geometry();
  state.players.forEach((player, i) => {
    const before = previous[i] ?? player.steps;
    const moved=before!==player.steps;
    const blend=moved?Math.min(1,Math.max(0,clock)/400):1;
    const a=routePosition(before,state.route),b=routePosition(player.steps,state.route);
    const pos={x:lerp(a.x,b.x,blend),z:lerp(a.z,b.z,blend)};
    const shift: [number,number][]=[[-.23,-.23],[.23,-.23],[-.23,.23],[.23,.23]];
    const [ox,oz]=shift[i];
    const x=pos.x+ox, z=pos.z+oz;
    const y=.16+ (blend<1?Math.sin(blend*Math.PI)*.23:0);
    const active=state.turn===i && state.phase!=='finished';
    g.lathe(x,y,z,[[.26,0],[.29,.04],[.26,.10],[.16,.13],[.125,.28],[.19,.43],[.15,.50],[.10,.58]],player.color,2,24);
    g.lathe(x,y+.035,z,[[.22,0],[.225,.018],[.22,.032]],'#5a392a',1,24);
    g.sphere(x,y+.62,z,.13,player.color,2);
    if(active) g.lathe(x,y+.01,z,[[.34,0],[.34,.020],[.30,.030]],'#ffd990',2,24);
  });
  return new Float32Array(g.values);
}

type Scene = {
  render: (game: ClassicGame, previous: readonly number[], step: number) => void;
  dispose: () => void;
};
function createScene(canvas: HTMLCanvasElement, route: Route, onFailure: () => void): Scene | null {
  const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'default'});
  if (!gl) {onFailure();return null;}
  const shader=(kind: number, source: string) => {
    const s=gl.createShader(kind)!;
    gl.shaderSource(s,source);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'Shader');
    return s;
  };
  let program: WebGLProgram;
  try {
    program=gl.createProgram()!;
    const vert=shader(gl.VERTEX_SHADER,VERT),frag=shader(gl.FRAGMENT_SHADER,FRAG);
    gl.attachShader(program,vert);gl.attachShader(program,frag);gl.linkProgram(program);
    gl.deleteShader(vert);gl.deleteShader(frag);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'Link');
  } catch (err) {console.warn('Mezuzá WebGL:',err);onFailure();return null;}
  const buffer=gl.createBuffer()!,attributes=['aPosition','aNormal','aColor','aMaterial'];
  const locations=attributes.map(s=>gl.getAttribLocation(program,s));
  const eye=gl.getUniformLocation(program,'uEye'),aspect=gl.getUniformLocation(program,'uAspect'),focal=gl.getUniformLocation(program,'uFocal');
  const staticGeometry=buildTable(route);
  let theta=.65,elevation=.97,distance=18.8;
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  locations.forEach((at,i)=>{
    if(at<0)return;
    const size=i===3?1:3,offset=(i===3?9:i*3)*4;
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at,size,gl.FLOAT,false,40,offset);
  });
  const draw=(array: Float32Array,usage: number)=>{
    gl.bufferData(gl.ARRAY_BUFFER,array,usage);
    gl.drawArrays(gl.TRIANGLES,0,array.length/10);
  };
  // Orbit camera pointer gestures; touch-action prevents scroll stealing the gesture.
  let dragging=false,lastX=0,lastY=0;
  const down=(e:PointerEvent)=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);};
  const move=(e:PointerEvent)=>{
    if(!dragging)return;
    theta-=(e.clientX-lastX)*.006;
    elevation=Math.min(1.40,Math.max(.30,elevation+(e.clientY-lastY)*.005));
    lastX=e.clientX;lastY=e.clientY;
  };
  const up=()=>{dragging=false;};
  const wheel=(e:WheelEvent)=>{e.preventDefault();distance=Math.min(24,Math.max(12.7,distance+Math.sign(e.deltaY)*.85));};
  canvas.addEventListener('pointerdown',down);
  canvas.addEventListener('pointermove',move);
  canvas.addEventListener('pointerup',up);
  canvas.addEventListener('pointercancel',up);
  canvas.addEventListener('wheel',wheel,{passive:false});
  let stopped=false;
  const lost=(e:Event)=>{e.preventDefault();stopped=true;onFailure();};
  canvas.addEventListener('webglcontextlost',lost);
  return {
    render(game,previous,step) {
      if(stopped)return;
      const w=canvas.clientWidth,h=canvas.clientHeight;
      if(!w||!h)return;
      const pixel=Math.min(window.devicePixelRatio||1,1.7);
      const cw=Math.floor(w*pixel),ch=Math.floor(h*pixel);
      if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;gl.viewport(0,0,cw,ch);}
      gl.clearColor(.075,.09,.105,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      const cam:[number,number,number]=[Math.sin(theta)*Math.cos(elevation)*distance, Math.sin(elevation)*distance, Math.cos(theta)*Math.cos(elevation)*distance];
      gl.uniform3fv(eye,cam);gl.uniform1f(aspect,w/h);gl.uniform1f(focal,1.55);
      draw(staticGeometry,gl.STATIC_DRAW);
      draw(buildTokens(game,step,previous),gl.DYNAMIC_DRAW);
    },
    dispose() {
      stopped=true;
      canvas.removeEventListener('pointerdown',down);
      canvas.removeEventListener('pointermove',move);
      canvas.removeEventListener('pointerup',up);
      canvas.removeEventListener('pointercancel',up);
      canvas.removeEventListener('wheel',wheel);
      canvas.removeEventListener('webglcontextlost',lost);
      gl.deleteBuffer(buffer);gl.deleteProgram(program);
    },
  };
}

function FallbackBoard({game}:{game:ClassicGame}){
  return <div className="flex h-full flex-col justify-center rounded-2xl border border-[#c7ab72]/30 bg-[#1c2b29] p-5" aria-label="Resumo acessível da partida sem WebGL"><p className="font-semibold text-[#e7cb8c]">Visualização 3D indisponível neste dispositivo</p><p className="mt-2 text-sm">A partida continua com controles acessíveis. Percurso configurado: {totalSteps(game)} passos.</p><ol className="mt-4 space-y-3">{game.players.map(p=><li key={p.id}><span style={{color:p.color}}>{p.name}</span> · {p.steps} / {totalSteps(game)}<progress className="mt-1 block w-full" max={totalSteps(game)} value={p.steps}/></li>)}</ol></div>;
}

export default function MezuzahClassicBoard3D({ game }: {game: ClassicGame}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const scene=useRef<Scene|null>(null);
  const state=useRef(game),previous=useRef(game.players.map(p=>p.steps));
  const since=useRef(performance.now());
  const [fallback,setFallback]=useState(false);
  useEffect(()=>{
    const old=state.current;
    if(game.players.some((p,i)=>p.steps!==old.players[i]?.steps)){
      previous.current=game.players.map((p,i)=>old.players[i]?.steps ?? p.steps);
      since.current=performance.now();
    }
    state.current=game;
  },[game]);
  useEffect(()=>{
    if(!canvas.current)return;
    scene.current=createScene(canvas.current,game.route,()=>setFallback(true));
    if(!scene.current)return;
    let id=0,last=0,alive=true;
    const frame=(now:number)=>{
      if(!alive)return;
      if(now-last>32&&document.visibilityState!=='hidden'){
        scene.current?.render(state.current,previous.current,Math.min(400,now-since.current));
        last=now;
      }
      id=requestAnimationFrame(frame);
    };
    id=requestAnimationFrame(frame);
    return()=>{alive=false;cancelAnimationFrame(id);scene.current?.dispose();scene.current=null;};
  },[game.route.outerSteps,game.route.starSteps]);
  if(fallback)return <FallbackBoard game={game}/>;
  return (
    <div className="relative h-full min-h-[310px] w-full overflow-hidden rounded-[22px] border border-amber-300/20 bg-[#171c20] shadow-2xl">
      <canvas ref={canvas} className="h-full w-full touch-none" aria-label="Mesa tridimensional com relevo geográfico original, estrela e quatro marcadores. Arraste para girar e use a roda para aproximar."/>
      <div className="pointer-events-none absolute left-3 top-3 rounded-xl border border-white/10 bg-[#101617]/75 px-3 py-2 text-left text-xs tracking-wide text-amber-100/90 backdrop-blur">
        <strong className="block font-serif text-base tracking-[.18em]">MEZUZÁ 3D</strong>
        <span>Clássico · percurso configurável</span>
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1.5 text-[11px] text-white/85 backdrop-blur">
        Arraste para girar · role para zoom
      </div>
    </div>
  );
}
