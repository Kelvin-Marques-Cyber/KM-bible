import { CAMPAIGN_EPISODES, type ChronicleEpisode } from './campaign-content';
export { CAMPAIGN_EPISODES, CAMPAIGN_SAGAS } from './campaign-content';
export type { ChronicleEpisode } from './campaign-content';

/**
 * 36 aventuras 2D: explorar três lugares, reunir testemunhos e resolver
 * um desafio contextual. Decisões jamais alteram fatos da Escritura.
 * Estado puro para teste e persistência offline.
 */
export const CAMPAIGN_VERSION = 1 as const;
export const WORLD_WIDTH = 34;
export const WORLD_HEIGHT = 19;
export const STATIONS = [
  { x: 5, y: 6 }, { x: 16.5, y: 4.7 }, { x: 29, y: 7 },
] as const;
export type Direction = 'up' | 'down' | 'left' | 'right';
export type JourneyState = {
  version: 1;
  episodeId: string;
  x: number; y: number; facing: Direction;
  visited: number[];
  phase: 'explore' | 'trial' | 'complete';
  dialogue: number | null;
  attempts: number;
  feedback: string;
  steps: number;
  introduced?: boolean;
};
export type CampaignProgress = { version: 1; episodes: Record<string, JourneyState>; completed: string[]; activeEpisodeId?: string | null; selectedSaga?: number };
const byId = new Map(CAMPAIGN_EPISODES.map(e => [e.id, e]));
export const episodeById = (id: string): ChronicleEpisode | undefined => byId.get(id);
export const emptyProgress = (): CampaignProgress => ({ version: 1, episodes: {}, completed: [] });
export function newJourney(episodeId: string): JourneyState {
  if (!byId.has(episodeId)) throw new Error('Capítulo bíblico não encontrado.');
  return {version:1,episodeId,x:17,y:15,facing:'up',visited:[],phase:'explore',
    dialogue:null,introduced:false,attempts:0,feedback:'Explore o cenário e investigue os três lugares marcados.',steps:0};
}
function blocked(x: number,y: number): boolean {
  if (!Number.isFinite(x)||!Number.isFinite(y)||x<1.3||x>WORLD_WIDTH-1.3||y<2.6||y>WORLD_HEIGHT-1.3) return true;
  // Barracas e construções decorativas ocupam somente as bordas,
  // deixando um corredor seguro entre os três pontos de exploração.
  if (x<3.5&&y>10&&y<14) return true;
  if (x>30.5&&y>10&&y<14) return true;
  return false;
}
export function moveJourney(state: JourneyState,dx: number,dy: number,seconds: number,run=false): JourneyState {
  if (state.phase!=='explore'||state.dialogue!==null||!Number.isFinite(dx)||!Number.isFinite(dy)||!Number.isFinite(seconds)||seconds<=0) return state;
  const magnitude=Math.hypot(dx,dy);
  if(magnitude<.001) return state;
  const distance=Math.min(seconds,.05)*(run?9.0:5.9);
  const xStep=dx/magnitude*distance,yStep=dy/magnitude*distance;
  let x=state.x,y=state.y;
  if(!blocked(x+xStep,y))x+=xStep;
  if(!blocked(x,y+yStep))y+=yStep;
  if(x===state.x&&y===state.y)return state;
  const facing:Direction=Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';
  return {...state,x,y,facing,steps:state.steps+1};
}
export function nearestStation(state:JourneyState):number|null {
  const near=STATIONS.map((p,i)=>({i,d:Math.hypot(p.x-state.x,p.y-state.y)})).sort((a,b)=>a.d-b.d)[0];
  return near&&near.d<=2.6?near.i:null;
}
export function interactJourney(state:JourneyState,station?:number):JourneyState {
  if(state.phase!=='explore'||state.dialogue!==null)return state;
  const index=station??nearestStation(state);
  if(index===null||!Number.isInteger(index)||index<0||index>=3)
    return {...state,feedback:'Caminhe até um dos três símbolos iluminados para investigar.'};
  const near=STATIONS[index];
  if(Math.hypot(near.x-state.x,near.y-state.y)>2.6)
    return {...state,feedback:'Aproxime-se do lugar marcado antes de investigar.'};
  const episode=byId.get(state.episodeId)!;
  if(state.visited.includes(index))
    return {...state,dialogue:index,feedback:'Este testemunho já foi registrado no códice.'};
  const visited=[...state.visited,index].sort((a,b)=>a-b);
  return {...state,visited,dialogue:index,
    feedback:visited.length===3?'Os três lugares foram descobertos. O desafio final aguarda!':episode.stations[index].name+' registrada no códice.'};
}
export function closeJourneyDialogue(state:JourneyState):JourneyState {
  if(state.dialogue===null)return state;
  const done=state.visited.length===3;
  return {...state,dialogue:null,phase:done?'trial':'explore'};
}
export function answerJourney(state:JourneyState,choice:number):JourneyState {
  if(state.phase!=='trial'||!Number.isInteger(choice)||choice<0||choice>2)return state;
  const story=byId.get(state.episodeId)!;
  const success=choice===story.trial.correct;
  return {...state,attempts:state.attempts+1,phase:success?'complete':'trial',
    feedback:success?'Correto! '+story.trial.explanation: 'Ainda não. Revise os três testemunhos e consulte a passagem bíblica; tente outra vez.'};
}
export function validJourney(value:unknown):value is JourneyState {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const s=value as JourneyState;
  if(s.version!==1||typeof s.episodeId!=='string'||!byId.has(s.episodeId))return false;
  if(!Number.isFinite(s.x)||!Number.isFinite(s.y)||blocked(s.x,s.y))return false;
  if(!['up','down','left','right'].includes(s.facing)||!['explore','trial','complete'].includes(s.phase))return false;
  if(!Array.isArray(s.visited)||s.visited.length>3||new Set(s.visited).size!==s.visited.length||
     s.visited.some(n=>!Number.isInteger(n)||n<0||n>2))return false;
  if(s.dialogue!==null&&(!Number.isInteger(s.dialogue)||!s.visited.includes(s.dialogue)))return false;
  if(s.phase!=='explore'&&s.visited.length!==3)return false;
  if(s.phase!=='explore'&&s.dialogue!==null)return false;
  if(!Number.isSafeInteger(s.attempts)||s.attempts<0||s.attempts>100000||
     !Number.isSafeInteger(s.steps)||s.steps<0||s.steps>100000000)return false;
  if(s.introduced!==undefined&&typeof s.introduced!=='boolean')return false;
  if(typeof s.feedback!=='string'||s.feedback.length>450)return false;
  return true;
}
export function validCampaignProgress(value: unknown):value is CampaignProgress {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const x=value as CampaignProgress;
  if(x.version!==1||!x.episodes||typeof x.episodes!=='object'||Array.isArray(x.episodes)||
     !Array.isArray(x.completed)||x.completed.length>36||
     new Set(x.completed).size!==x.completed.length||
     x.completed.some(id=>typeof id!=='string'||!byId.has(id)))return false;
  if(x.activeEpisodeId!=null&&(!byId.has(x.activeEpisodeId)||!Object.hasOwn(x.episodes,x.activeEpisodeId)))return false;
  if(x.selectedSaga!==undefined&&(!Number.isInteger(x.selectedSaga)||x.selectedSaga<0||x.selectedSaga>5))return false;
  const entries=Object.entries(x.episodes);
  if(entries.length>36)return false;
  if(entries.some(([id,v])=>!byId.has(id)||!validJourney(v)||v.episodeId!==id))return false;
  const done=new Set(entries.filter(([,v])=>v.phase==='complete').map(([id])=>id));
  return done.size===x.completed.length&&x.completed.every(id=>done.has(id));
}
export function progressWithJourney(progress:CampaignProgress,state:JourneyState):CampaignProgress {
  if(!validJourney(state))throw new Error('Não é possível salvar capítulo inválido.');
  const episodes={...progress.episodes,[state.episodeId]:state};
  const completed=Object.keys(episodes).filter(id=>episodes[id].phase==='complete');
  return {...progress,version:1,episodes,completed};
}
export function beginOrResume(progress:CampaignProgress,id:string):JourneyState {
  if(!byId.has(id))throw new Error('Capítulo desconhecido.');
  return progress.episodes[id]??newJourney(id);
}
