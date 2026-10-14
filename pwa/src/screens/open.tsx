// Abertura das telas em folhas (bottom sheets), cada uma carregada sob demanda.
import { lazy } from 'react';
import { app, openSheet } from '../lib/app';
import type { DocumentRow, Model3D, Study } from '../lib/content';
import { refLabel, type Ref } from '../lib/domain';
import { lang, t, tr } from '../lib/i18n';
import type { Note } from '../lib/store';
import type { ModuleInfo } from '../lib/catalog';

const L = {
  Search: lazy(() => import('./Search')),
  Settings: lazy(() => import('./Settings')),
  Commentaries: lazy(() => import('./Commentaries')),
  Comparison: lazy(() => import('./Comparison')),
  CrossReferences: lazy(() => import('./CrossReferences')),
  VerseStudy: lazy(() => import('./VerseStudy')),
  Original: lazy(() => import('./Original').then((m) => ({ default: m.OriginalPage }))),
  Lexeme: lazy(() => import('./Original').then((m) => ({ default: m.LexemePage }))),
  Linguistics: lazy(() => import('./Original').then((m) => ({ default: m.LinguisticSearchPage }))),
  Topics: lazy(() => import('./Topics').then((m) => ({ default: m.BibleTopicsPage }))),
  Topic: lazy(() => import('./Topics').then((m) => ({ default: m.TopicPage }))),
  Document: lazy(() => import('./Documents').then((m) => ({ default: m.DocumentPage }))),
  LongText: lazy(() => import('./Documents').then((m) => ({ default: m.LongStudyText }))),
  NoteEditor: lazy(() => import('./Notes').then((m) => ({ default: m.NoteEditor }))),
  Confessions: lazy(() => import('./Studies').then((m) => ({ default: m.ConfessionsPage }))),
  StudiesBrowser: lazy(() => import('./Studies').then((m) => ({ default: m.StudiesBrowser }))),
  Study: lazy(() => import('./Studies').then((m) => ({ default: m.StudyPage }))),
  Arena: lazy(() => import('./Studies').then((m) => ({ default: m.ArenaPage }))),
  Apologists: lazy(() => import('./Studies').then((m) => ({ default: m.ApologistsPage }))),
  Science: lazy(() => import('./Studies').then((m) => ({ default: m.SciencePage }))),
  Religions: lazy(() => import('./Studies').then((m) => ({ default: m.ReligionCurriculaPage }))),
  ReligionCourse: lazy(() => import('./Studies').then((m) => ({ default: m.ReligionCoursePage }))),
  Compare: lazy(() => import('./Studies').then((m) => ({ default: m.ArgumentComparison }))),
  Augustine: lazy(() => import('./Augustine')),
  Devotionals: lazy(() => import('./Devotionals')),
  DevotionalReader: lazy(() => import('./Devotionals').then((m) => ({ default: m.DevotionalReader }))),
  Timeline: lazy(() => import('./Explore').then((m) => ({ default: m.TimelinePage }))),
  ContextCompare: lazy(() => import('./Explore').then((m) => ({ default: m.ContextComparisonPage }))),
  Units: lazy(() => import('./Explore').then((m) => ({ default: m.UnitsPage }))),
  Atlas: lazy(() => import('./Atlas')),
  Place: lazy(() => import('./Atlas').then((m) => ({ default: m.PlacePage }))),
  Models: lazy(() => import('./Models').then((m) => ({ default: m.ModelsPage }))),
  Model: lazy(() => import('./Models').then((m) => ({ default: m.ModelPage }))),
  Graph: lazy(() => import('./Graph')),
  Module: lazy(() => import('./Library').then((m) => ({ default: m.ModulePage }))),
  Library: lazy(() => import('./Library')),
  Offline: lazy(() => import('./Library').then((m) => ({ default: m.OfflinePage }))),
  Review: lazy(() => import('./Memory').then((m) => ({ default: m.ReviewPage }))),
  CreateCard: lazy(() => import('./Memory').then((m) => ({ default: m.CreateCard }))),
  SavedPlaces: lazy(() => import('./SavedPlaces')),
  Dedication: lazy(() => import('./Onboarding').then((m) => ({ default: m.DedicationPage }))),
  InstallHelp: lazy(() => import('./PwaBanners').then((m) => ({ default: m.InstallHelp }))),
  Picker: lazy(() => import('./Passage').then((m) => ({ default: m.PassagePicker }))),
  Preview: lazy(() => import('./Passage').then((m) => ({ default: m.PassagePreview }))),
};

export const openSearch = () => openSheet(t('search'), () => <L.Search />);
export const openSettings = () => openSheet(t('settings'), () => <L.Settings />);
export const choosePassage = (options: { onSelect?: (r: Ref) => void; initial?: Ref; edition?: string } = {}) =>
  openSheet(t('reference'), () => <L.Picker {...options} />);
export const showPassage = (r: Ref, options: { sourceEdition?: string; end?: Ref } = {}) =>
  openSheet(refLabel(r, lang()), () => <L.Preview reference={r} {...options} />);
export const openCommentaries = (r: Ref, title = t('commentaries')) => openSheet(title, () => <L.Commentaries reference={r} />);
export const openComparison = (r: Ref) => openSheet(t('compare'), () => <L.Comparison reference={r} />);
export const openCrossReferences = (r: Ref) => openSheet(tr('Referências cruzadas', 'Cross references', 'Referencias cruzadas'), () => <L.CrossReferences reference={r} />);
export const openVerseStudy = (r: Ref) =>
  openSheet(`${tr('Estudo conectado', 'Connected study', 'Estudio conectado')} · ${refLabel(r, lang())}`, () => <L.VerseStudy reference={r} />);
export const openOriginal = (r: Ref) => openSheet(t('original'), () => <L.Original reference={r} />);
export const openLexeme = (id: string, title = tr('Dicionário do original', 'Original-language dictionary', 'Diccionario del original')) =>
  openSheet(title, () => <L.Lexeme id={id} />);
export const openLinguistics = () => openSheet(t('linguistics'), () => <L.Linguistics />);
export const openTopics = (reference?: Ref) => openSheet(tr('Temas bíblicos', 'Bible topics', 'Temas bíblicos'), () => <L.Topics reference={reference} />);
export const openTopic = (id: string, title: string) => openSheet(title, () => <L.Topic id={id} />);
export const openDocument = (doc: DocumentRow) => openSheet(doc.pt?.title && !['WCF', 'WSC', 'WLC'].includes(doc.module_id) ? doc.pt.title : doc.title, () => <L.Document document={doc} />);
export const openLongText = (title: string, text: string) => openSheet(title, () => <L.LongText text={text} />);
export const openNote = (note: Note) => openSheet(note.title || t('newNote'), () => <L.NoteEditor noteId={note.id} />);
export const openConfessions = () => openSheet(tr('Confissões e catecismos', 'Confessions and catechisms', 'Confesiones y catecismos'), () => <L.Confessions />);
export const openStudiesBrowser = (apologetic: boolean) => openSheet(t(apologetic ? 'apologetics' : 'desk'), () => <L.StudiesBrowser apologetic={apologetic} />);
export const openStudy = (study: Study, apologetic: boolean) => openSheet(study.title, () => <L.Study study={study} apologetic={apologetic} />);
export const openArgumentComparison = (study: Study) => openSheet(t('argumentCompare'), () => <L.Compare study={study} />);
export const openArena = () => openSheet(t('arena'), () => <L.Arena />);
export const openApologists = () => openSheet(t('apologists'), () => <L.Apologists />);
export const openScience = () => openSheet(tr('Ciência e ateísmo', 'Science and atheism', 'Ciencia y ateísmo'), () => <L.Science />);
export const openReligions = (apologetic = false) => openSheet(tr('Religiões e cosmovisões', 'Religions and worldviews', 'Religiones y cosmovisiones'), () => <L.Religions apologetic={apologetic} />);
export const openReligionCourse = (target: string, title: string, apologetic = false) =>
  openSheet(title, () => <L.ReligionCourse target={target} apologetic={apologetic} />);
export const openAugustine = (initial: { book?: number; chapter?: number } = {}) =>
  openSheet(tr('Confissões de Agostinho', "Augustine's Confessions", 'Confesiones de Agustín'), () => <L.Augustine initialBook={initial.book} initialChapter={initial.chapter} />);
export const openDevotionals = () => openSheet(tr('Devocionais', 'Devotionals', 'Devocionales'), () => <L.Devotionals />);
export const openDevotional = (moduleId: string, title: string, documentId?: string) =>
  openSheet(title, () => <L.DevotionalReader moduleId={moduleId} documentId={documentId} />);
export const openTimeline = (reference?: Ref) => openSheet(reference ? t('context') : t('timeline'), () => <L.Timeline reference={reference} />);
export const openContextCompare = (first: Ref) => openSheet(t('contextCompare'), () => <L.ContextCompare first={first} />);
export const openUnits = () => openSheet(t('units'), () => <L.Units />);
export const openAtlas = (focus?: string | null) => openSheet(t('map'), () => <L.Atlas focus={focus ?? undefined} />, { full: true });
export const openPlace = (id: string, title: string) => openSheet(title, () => <L.Place id={id} />);
export const openModels = (reference?: Ref) => openSheet(t('models'), () => <L.Models reference={reference} />);
export const openModel = (model: Model3D) => openSheet(model.title, () => <L.Model model={model} />, { full: true });
export const openGraph = (reference?: Ref) => openSheet(reference ? tr('Conexões bíblicas', 'Biblical connections', 'Conexiones bíblicas') : t('graph'), () => <L.Graph reference={reference} />);
export const openModule = (m: ModuleInfo) => openSheet(m.title, () => <L.Module moduleId={m.id} />);
export const openLibrary = () => openSheet(t('library'), () => <L.Library />);
export const openOffline = () => openSheet(t('offlinePacks'), () => <L.Offline />);
export const openReview = (cardIds: string[] | null) => openSheet(t('review'), () => <L.Review cardIds={cardIds} />);
export const createCard = (reference: Ref, text: string) => openSheet(t('addCard'), () => <L.CreateCard reference={reference} text={text} />);
export const openSavedPlaces = (kind: 'bookmarks' | 'study_tabs') => openSheet(t(kind === 'study_tabs' ? 'tabs' : 'bookmarks'), () => <L.SavedPlaces kind={kind} />);
export const openDedication = () => openSheet(t('dedication'), () => <L.Dedication />, { full: true });
export const openInstallHelp = () => openSheet(t('installApp'), () => <L.InstallHelp />);

export const currentPassage = () => app.passage;

/** openNewNote do original: cria a nota já salva e abre o editor. */
export async function openNewNote(options: { title?: string; body?: string; reference?: string; notebook?: string } = {}) {
  const { note, saveNote } = await import('../lib/store');
  const id = await saveNote({ title: options.title || t('newNote'), body: options.body ?? '', reference: options.reference ?? '', notebook: options.notebook });
  const created = await note(id);
  if (created) openNote(created);
}
