import { beforeEach, describe, expect, it } from 'vitest';
import { catalog } from '../../src/lib/catalog';
import { booksPt } from '../../src/lib/domain';
import { del, get, getAll, put } from '../../src/lib/db';
import { createGame } from '../../src/games/chronicles/engine';
import { loadGame, saveGame, SAVE_KEY } from '../../src/games/chronicles/persistence';
import { CAMPAIGN_EPISODES, CAMPAIGN_SAGAS, STATIONS, answerJourney, beginOrResume, closeJourneyDialogue, emptyProgress, interactJourney, moveJourney, nearestStation, newJourney, nextJourneyEpisode, progressWithJourney, validCampaignProgress, validJourney, type JourneyState, type CampaignProgress } from '../../src/games/chronicles/campaign-engine';
import { CAMPAIGN_BACKUP_KEY, CAMPAIGN_DAMAGED_KEY, CAMPAIGN_SAVE_KEY, CampaignSaveError, exportCampaignArchive, loadCampaign, preserveAndRestartCampaign, recoverCampaign, saveCampaign } from '../../src/games/chronicles/campaign-persistence';

function walkTo(g:JourneyState,x:number,y:number):JourneyState {
  for(let i=0;i<1000 && Math.hypot(x-g.x,y-g.y)>.25;i++) {
    const next=moveJourney(g,x-g.x,y-g.y,.035,true);
    if(next===g) throw new Error('Trajeto bloqueado antes de chegar ao marco');
    g=next;
  }
  expect(Math.hypot(x-g.x,y-g.y)).toBeLessThan(.3);return g;
}
function discovered(id:string):JourneyState {
  let state:JourneyState={...newJourney(id),introduced:true};
  for(let i=0;i<3;i++){
    state=walkTo(state,STATIONS[i].x,STATIONS[i].y);
    expect(nearestStation(state)).toBe(i);
    state=interactJourney(state);expect(state.dialogue).toBe(i);expect(state.visited).toContain(i);
    expect(moveJourney(state,1,0,.05)).toBe(state);
    state=closeJourneyDialogue(state);expect(validJourney(state)).toBe(true);
  }return state;
}

describe('36 aventuras compactas: conteúdo e fluxo completo',()=>{
  it('distribui 36 histórias e números únicos em seis sagas com seis capítulos',()=>{
    expect(CAMPAIGN_SAGAS).toHaveLength(6);expect(CAMPAIGN_EPISODES).toHaveLength(36);
    expect(new Set(CAMPAIGN_EPISODES.map(e=>e.id)).size).toBe(36);
    expect(CAMPAIGN_EPISODES.map(e=>e.number)).toEqual(Array.from({length:36},(_,i)=>i+1));
    for(let i=0;i<6;i++)expect(CAMPAIGN_EPISODES.filter(e=>e.saga===i)).toHaveLength(6);
    expect(new Set(CAMPAIGN_EPISODES.map(e=>e.trial.correct)).size).toBe(3);
  });
  it('valida todas as referências e intervalos no catálogo bíblico real',()=>{
    const bible=Object.values(catalog.bibles)[0];
    for(const episode of CAMPAIGN_EPISODES){
      const r=episode.reference,chapters=bible.chapters[String(r.b)];
      expect(r.b).toBeGreaterThanOrEqual(1);expect(r.b).toBeLessThanOrEqual(66);
      expect(r.c).toBeLessThanOrEqual(chapters.length);expect(r.v).toBeGreaterThan(0);expect(r.v).toBeLessThanOrEqual(chapters[r.c-1]);
      expect(r.label.startsWith(booksPt[r.b-1]+' '+r.c+':')).toBe(true);
      const range=r.label.match(/:(\d+)[–-](\d+)$/)!;expect(range).not.toBeNull();expect(+range[1]).toBeLessThanOrEqual(r.v);expect(+range[2]).toBeLessThanOrEqual(chapters[r.c-1]);
      expect(episode.stations).toHaveLength(3);expect(episode.trial.choices).toHaveLength(3);expect(episode.trial.choices[episode.trial.correct]).toBeTruthy();
      expect(episode.intro.length).toBeGreaterThan(70);expect(new Set(episode.stations.map(s=>s.name)).size).toBe(3);
    }
  });
  it.each(CAMPAIGN_EPISODES)('$number: $title — caminha, investiga, erra, aprende, conclui e avança',episode=>{
    const fresh=newJourney(episode.id);expect(validJourney(fresh)).toBe(true);
    expect(interactJourney(fresh,0).visited).toEqual([]);expect(answerJourney(fresh,episode.trial.correct)).toBe(fresh);
    let state=discovered(episode.id);expect(state.phase).toBe('trial');expect(state.visited).toEqual([0,1,2]);
    for(const wrong of [0,1,2].filter(i=>i!==episode.trial.correct)){
      state=answerJourney(state,wrong);expect(state.phase).toBe('trial');expect(state.feedback).toMatch(/Ainda não/);
    }
    state=answerJourney(state,episode.trial.correct);expect(state.phase).toBe('complete');expect(state.attempts).toBe(3);expect(validJourney(state)).toBe(true);
    const progress=progressWithJourney(emptyProgress(),state);expect(validCampaignProgress(progress)).toBe(true);expect(progress.completed).toEqual([episode.id]);expect(beginOrResume(progress,episode.id)).toEqual(state);
    expect(answerJourney(state,0)).toBe(state);expect(nextJourneyEpisode(episode.id)?.number).toBe(episode.number===36?undefined:episode.number+1);
  });
  it('normaliza diagonais, limita tempo e respeita colisões e controles inválidos',()=>{
    const state={...newJourney('creation'),introduced:true};
    const diagonal=moveJourney(state,1,1,.05);expect(Math.hypot(diagonal.x-state.x,diagonal.y-state.y)).toBeCloseTo(.295);
    expect(moveJourney(state,1,0,900,true).x-state.x).toBeCloseTo(.45);
    expect(moveJourney(state,NaN,0,.05)).toBe(state);expect(moveJourney(state,1,0,-1)).toBe(state);
    let corner:JourneyState={...state,x:1.4,y:15};for(let i=0;i<100;i++)corner=moveJourney(corner,-1,0,.05,true);expect(corner.x).toBeGreaterThanOrEqual(1.3);
    let wall:JourneyState={...state,x:3.7,y:12};for(let i=0;i<100;i++)wall=moveJourney(wall,-1,0,.05,true);expect(wall.x).toBeGreaterThanOrEqual(3.5);
    expect(interactJourney(state,99).visited).toEqual([]);expect(interactJourney(state,-1).visited).toEqual([]);
  });
  it('permite revisitar um marco sem duplicar descoberta e bloqueia índices estranhos',()=>{
    let state=walkTo({...newJourney('creation'),introduced:true},STATIONS[0].x,STATIONS[0].y);state=closeJourneyDialogue(interactJourney(state));
    const revisit=interactJourney(state);expect(revisit.visited).toEqual([0]);expect(revisit.dialogue).toBe(0);
    const trial=discovered('creation');expect(answerJourney(trial,NaN)).toBe(trial);expect(answerJourney(trial,3)).toBe(trial);
  });
  it('recusa estados corrompidos e progresso incoerente',()=>{
    const g=newJourney('creation');const bad=[null,[],{}, {...g,version:2},{...g,x:Infinity},{...g,x:0},{...g,visited:[0,0]},{...g,dialogue:2},{...g,phase:'complete'},{...g,steps:-1},{...g,feedback:'x'.repeat(451)},{...g,introduced:'yes'},{...g,visited:[0,1,2],phase:'trial',dialogue:0},{...g,visited:[0,1,2],phase:'complete',attempts:0}];
    for(const value of bad)expect(validJourney(value),JSON.stringify(value)).toBe(false);
    const p=progressWithJourney(emptyProgress(),g);expect(validCampaignProgress({...p,completed:['creation']})).toBe(false);expect(validCampaignProgress({...p,activeEpisodeId:'garden'})).toBe(false);expect(validCampaignProgress({...p,selectedSaga:6})).toBe(false);expect(()=>newJourney('unknown')).toThrow();expect(nextJourneyEpisode('unknown')).toBeUndefined();
  });
});

describe('Persistência das aventuras: transações, corrupção, backup e recuperação',()=>{
  beforeEach(async()=>{for(const key of [CAMPAIGN_SAVE_KEY,CAMPAIGN_BACKUP_KEY,CAMPAIGN_DAMAGED_KEY,SAVE_KEY,'mezuzah:classic:save'])await del('meta',key);});
  it('retoma exatamente capítulo, coordenadas, diálogo, resposta errada e conclusão',async()=>{
    expect(await loadCampaign()).toEqual(emptyProgress());
    let state=walkTo({...newJourney('creation'),introduced:true},5,6);state=interactJourney(state);
    let progress:CampaignProgress={...progressWithJourney(emptyProgress(),state),activeEpisodeId:'creation',selectedSaga:0};await saveCampaign(progress);expect(await loadCampaign()).toEqual(progress);
    state=answerJourney(discovered('creation'),0);progress=progressWithJourney(progress,state);await saveCampaign(progress);expect(await loadCampaign()).toEqual(progress);
    state=answerJourney(state,CAMPAIGN_EPISODES[0].trial.correct);progress=progressWithJourney(progress,state);await saveCampaign(progress);expect((await loadCampaign()).completed).toEqual(['creation']);
  });
  it('salva e reabre os 36 capítulos sem perder o estado individual',async()=>{
    let progress=emptyProgress();for(const e of CAMPAIGN_EPISODES){const state=answerJourney(discovered(e.id),e.trial.correct);progress=progressWithJourney(progress,state);await saveCampaign(progress);expect(await loadCampaign()).toEqual(progress);}expect(progress.completed).toHaveLength(36);
  });
  it('grava snapshots em ordem mesmo quando há checkpoints simultâneos',async()=>{
    const first=progressWithJourney(emptyProgress(),{...newJourney('creation'),introduced:true});
    const second=progressWithJourney(first,{...first.episodes.creation,x:18});const third={...second,activeEpisodeId:'creation',selectedSaga:0};
    const calls=[saveCampaign(first),saveCampaign(second),saveCampaign(third)];first.episodes.creation.x=22;await Promise.all(calls);expect(await loadCampaign()).toEqual(third);expect((await get<{state:unknown}>('meta',CAMPAIGN_BACKUP_KEY))?.state).toEqual(second);
  });
  it('recupera backup válido, preserva o inválido e não toca no piloto, Mezuzá ou cartões',async()=>{
    await saveGame(createGame());const pilot=await loadGame();await put('meta',{key:'mezuzah:classic:save',keep:true});const cards=await getAll('flashcards'),reviews=await getAll('review_history');
    const progress=progressWithJourney(emptyProgress(),newJourney('creation'));await saveCampaign(progress);await saveCampaign({...progress,selectedSaga:1});
    await put('meta',{key:CAMPAIGN_SAVE_KEY,state:{version:99}});
    try{await loadCampaign();throw new Error('Deveria falhar');}catch(e){expect(e).toBeInstanceOf(CampaignSaveError);expect((e as CampaignSaveError).recoverable).toBe(true);}
    await expect(saveCampaign(emptyProgress())).rejects.toThrow(/anterior está danificado/);
    expect(await recoverCampaign()).toEqual(progress);expect(await loadCampaign()).toEqual(progress);expect(await get('meta',CAMPAIGN_DAMAGED_KEY)).toHaveProperty('envelope.state.version',99);
    expect(await loadGame()).toEqual(pilot);expect(await get('meta','mezuzah:classic:save')).toEqual({key:'mezuzah:classic:save',keep:true});expect(await getAll('flashcards')).toEqual(cards);expect(await getAll('review_history')).toEqual(reviews);
  });
  it('sem backup, mantém o save e só recomeça por ação explícita com cópia preservada',async()=>{
    await put('meta',{key:CAMPAIGN_SAVE_KEY,state:{broken:true}});await expect(loadCampaign()).rejects.toThrow(/Nenhum dado/);await expect(recoverCampaign()).rejects.toThrow(/Não há cópia/);
    expect(await get('meta',CAMPAIGN_SAVE_KEY)).toHaveProperty('state.broken',true);
    expect(JSON.parse(await exportCampaignArchive()).entries[0]).toHaveProperty('state.broken',true);
    expect(await preserveAndRestartCampaign()).toEqual(emptyProgress());expect(await loadCampaign()).toEqual(emptyProgress());expect(await get('meta',CAMPAIGN_DAMAGED_KEY)).toHaveProperty('envelope.state.broken',true);
  });
  it('aceita saves v1 anteriores à interface e rejeita gravação inválida sem substituir o válido',async()=>{
    const old={...newJourney('creation')};delete old.introduced;const progress=progressWithJourney(emptyProgress(),old);await put('meta',{key:CAMPAIGN_SAVE_KEY,state:progress});expect(await loadCampaign()).toEqual(progress);
    await expect(saveCampaign({...progress,completed:['creation']})).rejects.toThrow(/inválido/);expect(await loadCampaign()).toEqual(progress);
  });
});
