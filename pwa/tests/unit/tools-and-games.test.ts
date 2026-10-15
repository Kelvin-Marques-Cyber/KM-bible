import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { t } from '../../src/lib/i18n';
import ToolsAndGames from '../../src/screens/ToolsAndGames';

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT=true; });
let host:HTMLDivElement|null=null,root:Root|null=null;
afterEach(()=>{act(()=>root?.unmount());host?.remove();host=null;root=null;});
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
describe('Ferramentas e Games',()=>{
  it('renomeia a quinta área mantendo acesso a cartões',()=>{
    expect(t('memory')).toBe('Ferramentas e Games');
  });
  it('abre uma partida real do Mezuzá e preserva menu de memorização',async()=>{
    try{localStorage.removeItem('km-mezuzah-v1');}catch{}
    host=document.createElement('div');document.body.appendChild(host);
    root=createRoot(host);
    act(()=>root!.render(createElement(ToolsAndGames)));
    expect(host.textContent).toContain('Ferramentas e Games');
    expect(host.textContent).toContain('Mezuzá 3D');
    expect(host.textContent).toContain('Memorização');
    click('Jogar agora');
    await until(()=>!!host!.querySelector('select#mezuzah-players'));
    expect(host.textContent).toContain('Nova partida');
    click('Iniciar jornada');
    await until(()=>host!.textContent!.includes('Lançar dado'));
    expect(host.textContent).toContain('Classificação');
    click('Ferramentas e Games');
    await until(()=>host!.textContent!.includes('Abrir meus cartões'));
    expect(host.textContent).toContain('Memorização');
  });
});
