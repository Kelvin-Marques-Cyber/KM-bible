import { get, put } from '../../lib/db';
import { emptyProgress, validCampaignProgress, type CampaignProgress } from './campaign-engine';

export const CAMPAIGN_SAVE_KEY = 'chronicles:campaigns:v1';
type Envelope={key:typeof CAMPAIGN_SAVE_KEY;state:CampaignProgress;savedAt:string};
export async function loadCampaign():Promise<CampaignProgress>{
  const envelope=await get<Envelope>('meta',CAMPAIGN_SAVE_KEY);
  if(!envelope)return emptyProgress();
  if(envelope.key!==CAMPAIGN_SAVE_KEY||!validCampaignProgress(envelope.state))
    throw new Error('O progresso das campanhas está danificado ou é de outra versão. Nenhum dado foi apagado.');
  return envelope.state;
}
export async function saveCampaign(state:CampaignProgress):Promise<void>{
  if(!validCampaignProgress(state))throw new Error('Progresso inválido; os dados anteriores foram preservados.');
  await put('meta',{key:CAMPAIGN_SAVE_KEY,state,savedAt:new Date().toISOString()} satisfies Envelope);
}
