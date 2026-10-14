import { labels } from './labels';
import { pref } from './store';

// Rótulos novos da PWA (instalação, atualização, offline, migração).
const extra: Record<string, [string, string, string]> = {
  installApp: ['Instalar aplicativo', 'Install app', 'Instalar aplicación'],
  installed_app: ['Aplicativo instalado', 'App installed', 'Aplicación instalada'],
  updateReady: ['Nova versão disponível', 'New version available', 'Nueva versión disponible'],
  updateNow: ['Atualizar agora', 'Update now', 'Actualizar ahora'],
  later: ['Depois', 'Later', 'Después'],
  checkUpdates: ['Verificar atualizações', 'Check for updates', 'Buscar actualizaciones'],
  upToDate: ['Você já usa a versão mais recente.', 'You are on the latest version.', 'Ya usas la versión más reciente.'],
  offlineMode: ['Sem conexão — usando conteúdo salvo', 'Offline — using saved content', 'Sin conexión — usando contenido guardado'],
  offlinePacks: ['Conteúdo offline', 'Offline content', 'Contenido sin conexión'],
  storage: ['Armazenamento', 'Storage', 'Almacenamiento'],
  download: ['Baixar', 'Download', 'Descargar'],
  remove_offline: ['Remover do aparelho', 'Remove from device', 'Quitar del dispositivo'],
  migration: ['Migração da versão anterior', 'Migration from previous version', 'Migración de la versión anterior'],
  classic: ['Versão clássica (Flutter)', 'Classic version (Flutter)', 'Versión clásica (Flutter)'],
  retry: ['Tentar novamente', 'Try again', 'Intentar de nuevo'],
  loading: ['Carregando…', 'Loading…', 'Cargando…'],
  more: ['Mais', 'More', 'Más'],
  open: ['Abrir', 'Open', 'Abrir'],
  back: ['Voltar', 'Back', 'Volver'],
};

export type LabelKey = keyof typeof labels | keyof typeof extra;

export function lang(): 'pt' | 'en' | 'es' {
  const value = pref<string>('language', 'pt');
  return value === 'en' || value === 'es' ? value : 'pt';
}

export function t(key: string): string {
  const row = (labels as Record<string, [string, string, string]>)[key] ?? extra[key];
  if (!row) return key;
  const l = lang();
  return row[l === 'en' ? 1 : l === 'es' ? 2 : 0];
}

/** Escolhe texto por idioma para frases ainda não presentes na tabela. */
export const tr = (pt: string, en?: string, es?: string) => {
  const l = lang();
  return l === 'en' ? en ?? pt : l === 'es' ? es ?? en ?? pt : pt;
};
