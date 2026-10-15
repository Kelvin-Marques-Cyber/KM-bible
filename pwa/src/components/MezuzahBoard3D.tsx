/**
 * Mesa 3D WebGL2 própria — sem CDN e sem dependências externas.
 * Madeira com veios procedurais, peças torneadas, materiais metálicos e
 * iluminação de estúdio. A cena gira com mouse/toque e zoom com a roda.
 */
import { useEffect, useRef, useState } from 'react';
import { BOARD_SIZE, squareKind, squarePosition, type GameState } from '../lib/mezuzah-game';

type VertexBuffer = number[];
type Point = [number, number, number];
const BOARD = BOARD_SIZE;
const SPECIAL: Record<string, string> = {
  start: '#547a68', scripture: '#50758d', challenge: '#a15a4d', wisdom: '#b28c47',
  advance: '#578477', return: '#8f6575', finish: '#dbb46b', ordinary: '#f2e5d1',
};
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
        const nA: Point = [Math.cos(a), -(r1-r0) / Math.max(.001, y1-y0), Math.sin(a)];
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

function buildTable(): Float32Array {
  const g = new Geometry();
  // Oak table, carved mahogany apron, gilded brass edging.
  g.box(0,-0.62,0,22,0.26,22,'#292c2d',1);
  g.box(0,-0.34,0,8.50,.40,8.50,'#28100c',1);
  g.box(0,-0.12,0,8.22,.13,8.22,'#aa6935',1);
  g.box(0,-0.04,0,8.08,.045,8.08,'#c5a06b',2);
  g.box(0,0,0,7.87,.09,7.87,'#2b1410',1);
  for (let r = 0; r < BOARD; r++) for (let c = 0; c < BOARD; c++) {
    const x = c - 3, z = r - 3;
    const square = [...Array(BOARD*BOARD).keys()].find(i => {
      const q=squarePosition(i);
      return q.row===r&&q.col===c;
    })!;
    const kind = squareKind(square);
    const dark = (r+c)%2 === 0;
    g.box(x,.082,z,.968,.095,.968,dark?'#f6eddf':'#b34b31',dark?0:1);
    if (kind !== 'ordinary') {
      const base = SPECIAL[kind];
      // Enamel inlaid marker, visible without obscuring the checker pattern.
      g.lathe(x,.138,z,[[.21,0],[.23,.005],[.23,.018],[.20,.026],[0,.027]],base,2,22);
      if (kind === 'finish') g.sphere(x,.158,z,.10,'#f6e6aa',2);
    }
  }
  // Gold perimeter fittings and corner pins.
  for (const z of [-3.97,3.97]) g.box(0,.02,z,8.17,.09,.032,'#d3ab6c',2);
  for (const x of [-3.97,3.97]) g.box(x,.02,0,.032,.09,8.17,'#d3ab6c',2);
  for (const x of [-3.98,3.98]) for (const z of [-3.98,3.98]) g.sphere(x,.035,z,.075,'#e0bb72',2);
  return new Float32Array(g.values);
}

function buildTokens(state: GameState, clock: number, previous: readonly number[]): Float32Array {
  const g = new Geometry();
  state.players.forEach((player, i) => {
    const before = previous[i] ?? player.position;
    const blend = Math.min(1, (clock%1000)/400);
    const {col:a,row:b}=squarePosition(before);
    const {col:c,row:d}=squarePosition(player.position);
    const pos = {x: lerp(a,c,blend)-3, z:lerp(b,d,blend)-3};
    const shift: [number,number][]=[[-.23,-.23],[.23,-.23],[-.23,.23],[.23,.23]];
    const [ox,oz]=shift[i];
    const x=pos.x+ox, z=pos.z+oz;
    const y=.16+ (blend<1?Math.sin(blend*Math.PI)*.23:0);
    const active=state.turn===i && state.status==='playing';
    g.lathe(x,y,z,[[.26,0],[.29,.04],[.26,.10],[.16,.13],[.125,.28],[.19,.43],[.15,.50],[.10,.58]],player.color,2,24);
    g.lathe(x,y+.035,z,[[.22,0],[.225,.018],[.22,.032]],'#5a392a',1,24);
    g.sphere(x,y+.62,z,.13,player.color,2);
    if(active) g.lathe(x,y+.01,z,[[.34,0],[.34,.020],[.30,.030]],'#ffd990',2,24);
  });
  return new Float32Array(g.values);
}

type Scene = {
  render: (game: GameState, previous: readonly number[], step: number) => void;
  dispose: () => void;
};
function createScene(canvas: HTMLCanvasElement, onFailure: () => void): Scene | null {
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
  const staticGeometry=buildTable();
  let theta=.65,elevation=.97,distance=15.5;
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
  const wheel=(e:WheelEvent)=>{e.preventDefault();distance=Math.min(24,Math.max(10.7,distance+Math.sign(e.deltaY)*.85));};
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

function FallbackBoard({ game }: {game: GameState}) {
  return (
    <div className="grid aspect-square w-full max-w-[580px] grid-cols-7 overflow-hidden rounded-xl border-[10px] border-[#6f3525]" aria-label="Tabuleiro acessível em duas dimensões">
      {Array.from({length:49},(_,i)=>{
        const row=Math.floor(i/7),col=i%7;
        const square=Array.from({length:49},(_,n)=>n).find(n=>{const p=squarePosition(n);return p.row===row&&p.col===col;})!;
        const kinds=squareKind(square);
        return <div key={square} className={'relative flex items-center justify-center border border-[#81543c]/40 text-[10px] sm:text-xs '+((row+col)%2?'bg-[#aa4f37] text-white':'bg-[#efdfbe] text-[#39251b]')} title={'Casa '+square+' · '+kinds}>
          <span className="absolute left-1 top-0 opacity-60">{square}</span>
          <div className="mt-2 flex flex-wrap justify-center gap-0.5">{game.players.filter(p=>p.position===square).map(p=><span key={p.id} className="h-3 w-3 rounded-full border border-[#222] shadow-md sm:h-4 sm:w-4" style={{background:p.color}} title={p.name}/>)}</div>
        </div>;
      })}
    </div>
  );
}

export default function MezuzahBoard3D({ game }: {game: GameState}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const scene=useRef<Scene|null>(null);
  const state=useRef(game),previous=useRef(game.players.map(p=>p.position));
  const since=useRef(performance.now());
  const [fallback,setFallback]=useState(false);
  state.current=game;
  useEffect(()=>{
    const now=performance.now();
    previous.current=game.players.map((p,i)=>state.current.players[i]?.position===p.position?p.position:previous.current[i]??p.position);
    since.current=now;
  },[game]);
  useEffect(()=>{
    if(!canvas.current)return;
    scene.current=createScene(canvas.current,()=>setFallback(true));
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
  },[]);
  if(fallback)return <FallbackBoard game={game}/>;
  return (
    <div className="relative h-full min-h-[310px] w-full overflow-hidden rounded-[22px] border border-amber-300/20 bg-[#171c20] shadow-2xl">
      <canvas ref={canvas} className="h-full w-full touch-none" aria-label="Tabuleiro tridimensional de madeira com peças coloridas. Arraste para girar e use a roda para aproximar."/>
      <div className="pointer-events-none absolute left-3 top-3 rounded-xl border border-white/10 bg-[#101617]/75 px-3 py-2 text-left text-xs tracking-wide text-amber-100/90 backdrop-blur">
        <strong className="block font-serif text-base tracking-[.18em]">MEZUZÁ 3D</strong>
        <span>49 casas · madeira e metal</span>
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1.5 text-[11px] text-white/85 backdrop-blur">
        Arraste para girar · role para zoom
      </div>
    </div>
  );
}
