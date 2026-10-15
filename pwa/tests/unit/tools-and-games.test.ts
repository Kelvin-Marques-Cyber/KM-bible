import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../src/lib/i18n';
import { ref } from '../../src/lib/domain';
import { addCard, cards, reviewCard, reviewStats } from '../../src/lib/store';
import ToolsAndGames from '../../src/screens/ToolsAndGames';

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT=true; });
// jsdom não implementa WebGL. Simular ausência de suporte e validar o
// fallback 2D sem gerar erros falsos de HTMLCanvasElement.getContext.
beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
let host:HTMLDivElement|null=null,root:Root|null=null;
afterEach(()=>{act(()=>root?.unmount());host?.remove();host=null;root=null;vi.restoreAllMocks();});
const click=(text:string)=>{
  const el=[...host!.querySelectorAll('button')].find(b=>b.textContent?.includes(text));
  expect(el,'Botão '+text+' deve existir').toBeDefined();
  act(()=>el!.click());
};
async function until(check:()=>boolean,ms=5000){
  const start=Date.now();
  while(!check()){
    if(Date.now()-start>ms)throw new Error('Tempo esgotado na tela: '+host?.textContent?.slice(0,350));
    await act(async()=>{await new Promise(r=>setTimeout(r,25));});
  }
}
function setRoute(label:string,value:string){
  const input=host!.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  expect(input).not.toBeNull();
  act(()=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);
    input!.dispatchEvent(new Event('input',{bubbles:true}));
  });
}
describe('Ferramentas e Games',()=>{
  it('renomeia a quinta área mantendo acesso a cartões',()=>{
    expect(t('memory')).toBe('Ferramentas e Games');
  });
  it('abre uma partida clássica real e preserva cartões e histórico de memorização',async()=>{
    localStorage.removeItem('km-mezuzah-classic-v2');
    await addCard('ARA',ref(43,3,16),'Cartão de memorização preservado durante o Mezuzá');
    const stored=await cards();
    await reviewCard(stored[stored.length-1],4);
    const beforeCards=await cards(),beforeReviews=await reviewStats();
    host=document.createElement('div');document.body.appendChild(host);
    root=createRoot(host);
    act(()=>root!.render(createElement(ToolsAndGames)));
    expect(host.textContent).toContain('Ferramentas e Games');
    expect(host.textContent).toContain('Mezuzá 3D');
    expect(host.textContent).toContain('Memorização');
    click('Jogar agora');
    await until(()=>!!host!.querySelector('select#mezuzah-classic-players'));
    await until(()=>!!host!.querySelector('[aria-label="Resumo acessível da partida sem WebGL"]'));
    expect(host.textContent).toContain('Nova partida');
    setRoute('Passos até a estrela','3');setRoute('Passos na volta da estrela','3');
    click('Iniciar partida clássica');
    await until(()=>host!.textContent!.includes('Comprar cartão'));
    click('Comprar cartão');
    await until(()=>host!.textContent!.includes('escolha um número de 1 a 10'));
    const one=[...host.querySelectorAll('button')].find(b=>b.textContent?.trim()==='1');
    expect(one).toBeDefined();act(()=>one!.click());
    expect(host.textContent).toContain('Desafio individual · sem repasse');
    click('Confirmar acerto de Equipe 1');
    expect(host.textContent).toContain('Vez de Equipe 2');
    expect(host.textContent).not.toContain('Lançar dado');
    click('Ferramentas e Games');
    await until(()=>host!.textContent!.includes('Abrir meus cartões'));
    expect(host.textContent).toContain('Memorização');
    click('Abrir meus cartões');
    await until(()=>host!.textContent!.includes('Cartão de memorização preservado durante o Mezuzá'));
    expect(await cards()).toEqual(beforeCards);
    expect(await reviewStats()).toEqual(beforeReviews);
  });
});
