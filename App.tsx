import React, { useMemo, useState } from 'react';
import { CalendarPlus, Clock3, HelpCircle, Languages, Lock, Plus, Save, Trash2, X } from 'lucide-react';
import ReviewZipGenerator from './ReviewZipGenerator';

type Manuscript = {
  id: string;
  title: string;
  notes: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
};

type Meeting = {
  id: string;
  time: string;
  manuscripts: Manuscript[];
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
};

type AgendaData = {
  meetings: Meeting[];
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type Language = 'en' | 'pl' | 'es' | 'ca' | 'fr' | 'zh-CN';

const emptyAgenda: AgendaData = { meetings: [] };

const createId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const nowIso = () => new Date().toISOString();

const EASTERN_TIME_ZONE = 'America/New_York';
const REFERENCE_TIME_ZONE_KEY = 'agenda-reference-time-zone';

const fallbackTimeZones = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Warsaw',
  'Europe/Madrid',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
];

const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const intlWithSupportedValues = Intl as typeof Intl & {
  supportedValuesOf?: (key: 'timeZone') => string[];
};
const timeZoneOptions = Array.from(
  new Set([
    browserTimeZone,
    EASTERN_TIME_ZONE,
    'UTC',
    ...(intlWithSupportedValues.supportedValuesOf?.('timeZone') ?? fallbackTimeZones),
  ]),
).sort();

const getInitialReferenceTimeZone = () => {
  const stored = window.localStorage.getItem(REFERENCE_TIME_ZONE_KEY);
  return stored && timeZoneOptions.includes(stored) ? stored : browserTimeZone;
};

type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const zonedFormatterCache = new Map<string, Intl.DateTimeFormat>();

const getZonedFormatter = (timeZone: string) => {
  const cached = zonedFormatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  zonedFormatterCache.set(timeZone, formatter);
  return formatter;
};

const getZonedParts = (date: Date, timeZone: string): ZonedDateTimeParts => {
  const values = Object.fromEntries(
    getZonedFormatter(timeZone)
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
};

const padDateTimePart = (value: number) => String(value).padStart(2, '0');

const toZonedDateTimeLocalValue = (value: string, timeZone: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = getZonedParts(date, timeZone);
  return `${parts.year}-${padDateTimePart(parts.month)}-${padDateTimePart(parts.day)}T${padDateTimePart(parts.hour)}:${padDateTimePart(parts.minute)}`;
};

const getTimeZoneOffsetMs = (date: Date, timeZone: string) => {
  const parts = getZonedParts(date, timeZone);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return representedAsUtc - date.getTime();
};

const fromZonedDateTimeLocalValue = (value: string, timeZone: string) => {
  if (!value) return '';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return '';

  const [, year, month, day, hour, minute] = match.map(Number);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let instant = wallClockAsUtc;

  // Recalculate because the first estimate can cross a daylight-saving boundary.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    instant = wallClockAsUtc - getTimeZoneOffsetMs(new Date(instant), timeZone);
  }

  return new Date(instant).toISOString();
};

async function callFunction<T>(path: string, password: string, body: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`/.netlify/functions/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, ...body }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }
  return payload as T;
}

const languageNames: Record<Language, string> = {
  en: 'English',
  pl: 'Polski',
  es: 'Español',
  ca: 'Català',
  fr: 'Français',
  'zh-CN': '简体中文',
};

const copy: Record<Language, Record<string, string>> = {
  en: {
    appTitle: "Let's Discuss A Manuscript!",
    subtitle: 'For exclusive use by APSR editors coordinating manuscript discussion agendas.',
    passwordPrompt: 'Enter the shared password to view and edit.',
    password: 'Password',
    openAgenda: 'Open agenda',
    checking: 'Checking...',
    reviewZip: 'Review ZIP Generator',
    addMeeting: 'Add meeting',
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving...',
    saved: 'Saved.',
    upcoming: 'Upcoming',
    past: 'Past',
    noUpcoming: 'No upcoming meetings.',
    noPast: 'No past meetings.',
    meetingTime: 'Meeting time',
    easternTime: 'US Eastern Time',
    referenceTime: 'Reference time',
    referenceTimeZone: 'Reference time zone',
    timeZoneHint: 'Edit either time; both stay synchronized.',
    manuscript: 'Manuscript',
    delete: 'Delete',
    noManuscripts: 'No manuscripts yet.',
    titleOrId: 'Title or ID',
    titlePlaceholder: 'Manuscript title or ID',
    notes: 'Notes',
    notesPlaceholder: 'Discussion notes',
    help: 'Help',
    hideHelp: 'Hide help',
    help1: 'Add a meeting, set its time in US Eastern or your reference time zone, then add one or more manuscripts.',
    help2: 'Use the notes area for discussion points, decisions, and follow-up tasks.',
    help3: 'Save writes the agenda to Netlify Blobs. Cancel discards unsaved edits.',
    help4: 'Deleted meetings and manuscripts are hidden here but kept in stored JSON with deleted: true.',
    language: 'Language',
  },
  pl: {
    appTitle: 'Porozmawiajmy o manuskrypcie!',
    subtitle: 'Do wyłącznego użytku redaktorów APSR koordynujących agendy dyskusji nad manuskryptami.',
    passwordPrompt: 'Wpisz wspólne hasło, aby przeglądać i edytować.',
    password: 'Hasło',
    openAgenda: 'Otwórz agendę',
    checking: 'Sprawdzanie...',
    reviewZip: 'Generator ZIP recenzji',
    addMeeting: 'Dodaj spotkanie',
    cancel: 'Anuluj',
    save: 'Zapisz',
    saving: 'Zapisywanie...',
    saved: 'Zapisano.',
    upcoming: 'Nadchodzące',
    past: 'Minione',
    noUpcoming: 'Brak nadchodzących spotkań.',
    noPast: 'Brak minionych spotkań.',
    meetingTime: 'Czas spotkania',
    easternTime: 'Czas wschodni USA',
    referenceTime: 'Czas referencyjny',
    referenceTimeZone: 'Referencyjna strefa czasowa',
    timeZoneHint: 'Edytuj dowolny czas; oba pozostaną zsynchronizowane.',
    manuscript: 'Manuskrypt',
    delete: 'Usuń',
    noManuscripts: 'Nie ma jeszcze manuskryptów.',
    titleOrId: 'Tytuł lub ID',
    titlePlaceholder: 'Tytuł lub ID manuskryptu',
    notes: 'Notatki',
    notesPlaceholder: 'Notatki z dyskusji',
    help: 'Pomoc',
    hideHelp: 'Ukryj pomoc',
    help1: 'Dodaj spotkanie, ustaw czas w strefie wschodniej USA lub referencyjnej, a następnie dodaj manuskrypty.',
    help2: 'Użyj pola notatek na punkty dyskusji, decyzje i dalsze zadania.',
    help3: 'Zapis zapisuje agendę w Netlify Blobs. Anuluj odrzuca niezapisane zmiany.',
    help4: 'Usunięte spotkania i manuskrypty są ukryte tutaj, ale pozostają w JSON z deleted: true.',
    language: 'Język',
  },
  es: {
    appTitle: '¡Hablemos de un manuscrito!',
    subtitle: 'Para uso exclusivo de editores de APSR que coordinan agendas de discusión de manuscritos.',
    passwordPrompt: 'Introduce la contraseña compartida para ver y editar.',
    password: 'Contraseña',
    openAgenda: 'Abrir agenda',
    checking: 'Comprobando...',
    reviewZip: 'Generador ZIP de reseñas',
    addMeeting: 'Añadir reunión',
    cancel: 'Cancelar',
    save: 'Guardar',
    saving: 'Guardando...',
    saved: 'Guardado.',
    upcoming: 'Próximas',
    past: 'Pasadas',
    noUpcoming: 'No hay reuniones próximas.',
    noPast: 'No hay reuniones pasadas.',
    meetingTime: 'Hora de la reunión',
    easternTime: 'Hora del este de EE. UU.',
    referenceTime: 'Hora de referencia',
    referenceTimeZone: 'Zona horaria de referencia',
    timeZoneHint: 'Edita cualquiera de las horas; ambas se sincronizan.',
    manuscript: 'Manuscrito',
    delete: 'Eliminar',
    noManuscripts: 'Aún no hay manuscritos.',
    titleOrId: 'Título o ID',
    titlePlaceholder: 'Título o ID del manuscrito',
    notes: 'Notas',
    notesPlaceholder: 'Notas de discusión',
    help: 'Ayuda',
    hideHelp: 'Ocultar ayuda',
    help1: 'Añade una reunión, fija la hora del este de EE. UU. o la de referencia y luego añade manuscritos.',
    help2: 'Usa el área de notas para puntos de discusión, decisiones y tareas de seguimiento.',
    help3: 'Guardar escribe la agenda en Netlify Blobs. Cancelar descarta cambios sin guardar.',
    help4: 'Las reuniones y manuscritos eliminados se ocultan aquí, pero quedan en el JSON con deleted: true.',
    language: 'Idioma',
  },
  ca: {
    appTitle: "Parlem d'un manuscrit!",
    subtitle: "Per a l'ús exclusiu dels editors d'APSR que coordinen agendes de discussió de manuscrits.",
    passwordPrompt: 'Introdueix la contrasenya compartida per veure i editar.',
    password: 'Contrasenya',
    openAgenda: "Obre l'agenda",
    checking: 'Comprovant...',
    reviewZip: 'Generador ZIP de revisions',
    addMeeting: 'Afegeix reunió',
    cancel: 'Cancel·la',
    save: 'Desa',
    saving: 'Desant...',
    saved: 'Desat.',
    upcoming: 'Properes',
    past: 'Passades',
    noUpcoming: 'No hi ha reunions properes.',
    noPast: 'No hi ha reunions passades.',
    meetingTime: 'Hora de la reunió',
    easternTime: 'Hora de l’est dels EUA',
    referenceTime: 'Hora de referència',
    referenceTimeZone: 'Fus horari de referència',
    timeZoneHint: 'Edita qualsevol hora; totes dues es mantenen sincronitzades.',
    manuscript: 'Manuscrit',
    delete: 'Suprimeix',
    noManuscripts: 'Encara no hi ha manuscrits.',
    titleOrId: 'Títol o ID',
    titlePlaceholder: 'Títol o ID del manuscrit',
    notes: 'Notes',
    notesPlaceholder: 'Notes de discussió',
    help: 'Ajuda',
    hideHelp: "Amaga l'ajuda",
    help1: 'Afegeix una reunió, defineix l’hora de l’est dels EUA o la de referència i després afegeix manuscrits.',
    help2: 'Fes servir les notes per als punts de discussió, decisions i tasques de seguiment.',
    help3: 'Desa escriu l’agenda a Netlify Blobs. Cancel·la descarta els canvis no desats.',
    help4: 'Les reunions i manuscrits suprimits s’oculten aquí, però es conserven al JSON amb deleted: true.',
    language: 'Llengua',
  },
  fr: {
    appTitle: 'Discutons un manuscrit !',
    subtitle: "Réservé exclusivement aux éditeurs d'APSR qui coordonnent les ordres du jour de discussion des manuscrits.",
    passwordPrompt: 'Saisissez le mot de passe partagé pour consulter et modifier.',
    password: 'Mot de passe',
    openAgenda: "Ouvrir l'agenda",
    checking: 'Vérification...',
    reviewZip: 'Générateur ZIP des rapports',
    addMeeting: 'Ajouter une réunion',
    cancel: 'Annuler',
    save: 'Enregistrer',
    saving: 'Enregistrement...',
    saved: 'Enregistré.',
    upcoming: 'À venir',
    past: 'Passées',
    noUpcoming: 'Aucune réunion à venir.',
    noPast: 'Aucune réunion passée.',
    meetingTime: 'Heure de la réunion',
    easternTime: 'Heure de l’Est américain',
    referenceTime: 'Heure de référence',
    referenceTimeZone: 'Fuseau horaire de référence',
    timeZoneHint: 'Modifiez l’une des heures ; les deux restent synchronisées.',
    manuscript: 'Manuscrit',
    delete: 'Supprimer',
    noManuscripts: 'Aucun manuscrit pour le moment.',
    titleOrId: 'Titre ou ID',
    titlePlaceholder: 'Titre ou ID du manuscrit',
    notes: 'Notes',
    notesPlaceholder: 'Notes de discussion',
    help: 'Aide',
    hideHelp: "Masquer l'aide",
    help1: 'Ajoutez une réunion, réglez l’heure de l’Est américain ou l’heure de référence, puis ajoutez des manuscrits.',
    help2: 'Utilisez les notes pour les points de discussion, décisions et suivis.',
    help3: 'Enregistrer écrit l’agenda dans Netlify Blobs. Annuler ignore les modifications non enregistrées.',
    help4: 'Les réunions et manuscrits supprimés sont masqués ici, mais conservés dans le JSON avec deleted: true.',
    language: 'Langue',
  },
  'zh-CN': {
    appTitle: '我们来讨论一篇手稿！',
    subtitle: '仅供 APSR 编辑协调手稿讨论议程时使用。',
    passwordPrompt: '输入共享密码后即可查看和编辑。',
    password: '密码',
    openAgenda: '进入议程',
    checking: '验证中...',
    reviewZip: '审稿 ZIP 工具',
    addMeeting: '添加会议',
    cancel: '取消',
    save: '保存',
    saving: '保存中...',
    saved: '已保存。',
    upcoming: '即将进行',
    past: '过去会议',
    noUpcoming: '暂无即将进行的会议。',
    noPast: '暂无过去会议。',
    meetingTime: '会议时间',
    easternTime: '美国东部时间',
    referenceTime: '参考时间',
    referenceTimeZone: '参考时区',
    timeZoneHint: '修改任一时间，两个时间会同步更新。',
    manuscript: '手稿',
    delete: '删除',
    noManuscripts: '还没有手稿。',
    titleOrId: '标题或编号',
    titlePlaceholder: '手稿标题或编号',
    notes: '备注',
    notesPlaceholder: '讨论备注',
    help: '帮助',
    hideHelp: '收起帮助',
    help1: '添加会议后，可用美国东部时间或参考时区设置时间，然后加入一篇或多篇手稿。',
    help2: '在备注框记录讨论要点、决定和后续事项。',
    help3: '保存会把议程写入 Netlify Blobs；取消会放弃未保存的修改。',
    help4: '删除的会议和手稿会在界面中隐藏，但会以 deleted: true 保留在 JSON 中。',
    language: '语言',
  },
};

function AgendaApp() {
  const [language, setLanguage] = useState<Language>('en');
  const [referenceTimeZone, setReferenceTimeZone] = useState(getInitialReferenceTimeZone);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [authenticatedPassword, setAuthenticatedPassword] = useState('');
  const [agenda, setAgenda] = useState<AgendaData>(emptyAgenda);
  const [draft, setDraft] = useState<AgendaData>(emptyAgenda);
  const [loginError, setLoginError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const t = copy[language];

  const visibleMeetings = useMemo(
    () => draft.meetings.filter((meeting) => !meeting.deleted),
    [draft.meetings],
  );

  const { upcoming, past } = useMemo(() => {
    const currentTime = Date.now();
    const sorted = [...visibleMeetings].sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
    );

    return {
      upcoming: sorted.filter((meeting) => new Date(meeting.time).getTime() >= currentTime),
      past: sorted.filter((meeting) => new Date(meeting.time).getTime() < currentTime).reverse(),
    };
  }, [visibleMeetings]);

  const hasUnsavedChanges = JSON.stringify(agenda) !== JSON.stringify(draft);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError('');
    setLoadError('');
    setIsLoading(true);

    try {
      await callFunction<{ ok: boolean }>('login', password);
      const loaded = await callFunction<{ agenda: AgendaData }>('agenda-load', password);
      const nextAgenda = loaded.agenda || emptyAgenda;
      setAgenda(nextAgenda);
      setDraft(structuredClone(nextAgenda));
      setAuthenticatedPassword(password);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Could not sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const updateMeeting = (meetingId: string, updater: (meeting: Meeting) => Meeting) => {
    setDraft((current) => ({
      meetings: current.meetings.map((meeting) =>
        meeting.id === meetingId ? updater(meeting) : meeting,
      ),
    }));
    setSaveState('idle');
  };

  const updateReferenceTimeZone = (timeZone: string) => {
    setReferenceTimeZone(timeZone);
    window.localStorage.setItem(REFERENCE_TIME_ZONE_KEY, timeZone);
  };

  const updateMeetingTime = (meetingId: string, value: string, timeZone: string) => {
    const nextTime = fromZonedDateTimeLocalValue(value, timeZone);
    if (!nextTime) return;

    const timestamp = nowIso();
    updateMeeting(meetingId, (meeting) => ({
      ...meeting,
      time: nextTime,
      updatedAt: timestamp,
    }));
  };

  const addMeeting = () => {
    const timestamp = nowIso();
    const newMeeting: Meeting = {
      id: createId('meeting'),
      time: timestamp,
      manuscripts: [],
      deleted: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    setDraft((current) => ({ meetings: [newMeeting, ...current.meetings] }));
    setSaveState('idle');
  };

  const deleteMeeting = (meetingId: string) => {
    const timestamp = nowIso();
    updateMeeting(meetingId, (meeting) => ({
      ...meeting,
      deleted: true,
      updatedAt: timestamp,
    }));
  };

  const addManuscript = (meetingId: string) => {
    const timestamp = nowIso();
    const manuscript: Manuscript = {
      id: createId('ms'),
      title: '',
      notes: '',
      deleted: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    updateMeeting(meetingId, (meeting) => ({
      ...meeting,
      manuscripts: [...meeting.manuscripts, manuscript],
      updatedAt: timestamp,
    }));
  };

  const updateManuscript = (
    meetingId: string,
    manuscriptId: string,
    updater: (manuscript: Manuscript) => Manuscript,
  ) => {
    const timestamp = nowIso();
    updateMeeting(meetingId, (meeting) => ({
      ...meeting,
      manuscripts: meeting.manuscripts.map((manuscript) =>
        manuscript.id === manuscriptId ? updater(manuscript) : manuscript,
      ),
      updatedAt: timestamp,
    }));
  };

  const deleteManuscript = (meetingId: string, manuscriptId: string) => {
    const timestamp = nowIso();
    updateManuscript(meetingId, manuscriptId, (manuscript) => ({
      ...manuscript,
      deleted: true,
      updatedAt: timestamp,
    }));
  };

  const saveAgenda = async () => {
    setSaveState('saving');
    setLoadError('');

    try {
      const saved = await callFunction<{ agenda: AgendaData }>('agenda-save', authenticatedPassword, {
        agenda: draft,
      });
      setAgenda(saved.agenda);
      setDraft(structuredClone(saved.agenda));
      setSaveState('saved');
    } catch (error) {
      setSaveState('error');
      setLoadError(error instanceof Error ? error.message : 'Could not save agenda');
    }
  };

  const cancelEdits = () => {
    setDraft(structuredClone(agenda));
    setSaveState('idle');
    setLoadError('');
  };

  if (!authenticatedPassword) {
    return (
      <main className="min-h-screen bg-[#f4f1ea] px-4 py-12 text-gray-800">
        <section className="mx-auto max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border-4 border-gray-600 bg-gray-800 text-white shadow-xl">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-bold">{t.appTitle}</h1>
            <p className="mt-2 text-sm italic text-gray-600">{t.subtitle}</p>
            <p className="mt-2 text-sm text-gray-600">{t.passwordPrompt}</p>
          </div>

          <div className="mb-4 rounded border border-gray-300 bg-[#fcfbf9] p-4 shadow-md paper-shadow">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
              <Languages className="h-4 w-4" />
              {t.language}
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
                className="ml-auto rounded border border-gray-300 bg-white px-2 py-1 text-sm outline-none focus:border-gray-800"
              >
                {(Object.keys(languageNames) as Language[]).map((code) => (
                  <option key={code} value={code}>
                    {languageNames[code]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <form onSubmit={login} className="space-y-4 border-2 border-gray-300 bg-[#fcfbf9] p-6 shadow-md paper-shadow">
            <label className="block">
              <span className="text-sm font-semibold text-gray-700">{t.password}</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-base outline-none focus:border-gray-800"
                autoComplete="current-password"
              />
            </label>
            {loginError && <p className="text-sm font-semibold text-red-700">{loginError}</p>}
            <button
              type="submit"
              disabled={isLoading || !password}
              className="w-full rounded border-2 border-gray-800 bg-gray-800 px-4 py-2 font-semibold text-white transition-colors hover:bg-white hover:text-gray-800 disabled:cursor-not-allowed disabled:border-gray-400 disabled:bg-gray-400 disabled:text-white"
            >
              {isLoading ? t.checking : t.openAgenda}
            </button>
          </form>

          <a className="mt-6 block text-center text-sm font-semibold text-gray-700 underline" href="/review-zip-generator">
            {t.reviewZip}
          </a>
        </section>
      </main>
    );
  }

  const renderMeetingGroup = (title: string, emptyText: string, meetings: Meeting[]) => (
    <section className="space-y-4">
      <h2 className="border-b-2 border-gray-300 pb-2 text-xl font-bold text-gray-800">{title}</h2>
      {meetings.length === 0 ? (
        <p className="rounded border border-dashed border-gray-300 bg-[#fcfbf9] p-4 text-sm text-gray-500">
          {emptyText}
        </p>
      ) : (
        meetings.map((meeting) => (
          <article key={meeting.id} className="border-2 border-gray-300 bg-[#fcfbf9] p-4 shadow-md paper-shadow">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex-1">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold text-gray-700">{t.easternTime}</span>
                    <span className="ml-2 text-xs text-gray-500">America/New_York</span>
                    <input
                      type="datetime-local"
                      value={toZonedDateTimeLocalValue(meeting.time, EASTERN_TIME_ZONE)}
                      onChange={(event) =>
                        updateMeetingTime(meeting.id, event.target.value, EASTERN_TIME_ZONE)
                      }
                      className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 outline-none focus:border-gray-800"
                    />
                  </label>
                  <label className="block border-l-0 border-gray-300 sm:border-l sm:pl-3">
                    <span className="text-sm font-semibold text-gray-700">{t.referenceTime}</span>
                    <span className="ml-2 text-xs text-gray-500">{referenceTimeZone}</span>
                    <input
                      type="datetime-local"
                      value={toZonedDateTimeLocalValue(meeting.time, referenceTimeZone)}
                      onChange={(event) =>
                        updateMeetingTime(meeting.id, event.target.value, referenceTimeZone)
                      }
                      className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 outline-none focus:border-gray-800"
                    />
                  </label>
                </div>
                <p className="mt-2 flex items-center gap-1 text-xs italic text-gray-500">
                  <Clock3 className="h-3.5 w-3.5" />
                  {t.timeZoneHint}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => addManuscript(meeting.id)}
                  className="inline-flex items-center gap-2 rounded border border-gray-400 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100"
                >
                  <Plus className="h-4 w-4" />
                  {t.manuscript}
                </button>
                <button
                  type="button"
                  onClick={() => deleteMeeting(meeting.id)}
                  className="inline-flex items-center gap-2 rounded border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {t.delete}
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {meeting.manuscripts.filter((manuscript) => !manuscript.deleted).length === 0 && (
                <p className="text-sm text-gray-500">{t.noManuscripts}</p>
              )}

              {meeting.manuscripts
                .filter((manuscript) => !manuscript.deleted)
                .map((manuscript) => (
                  <div key={manuscript.id} className="rounded border border-gray-300 bg-[#fffdf5] p-3 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      <label className="block sm:flex-1">
                        <span className="text-sm font-semibold text-gray-700">{t.titleOrId}</span>
                        <input
                          value={manuscript.title}
                          onChange={(event) => {
                            const timestamp = nowIso();
                            updateManuscript(meeting.id, manuscript.id, (current) => ({
                              ...current,
                              title: event.target.value,
                              updatedAt: timestamp,
                            }));
                          }}
                          className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 outline-none focus:border-gray-800"
                          placeholder={t.titlePlaceholder}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => deleteManuscript(meeting.id, manuscript.id)}
                        className="inline-flex items-center justify-center gap-2 rounded border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 sm:mt-7"
                      >
                        <Trash2 className="h-4 w-4" />
                        {t.delete}
                      </button>
                    </div>
                    <label className="mt-3 block">
                      <span className="text-sm font-semibold text-gray-700">{t.notes}</span>
                      <textarea
                        value={manuscript.notes}
                        onChange={(event) => {
                          const timestamp = nowIso();
                          updateManuscript(meeting.id, manuscript.id, (current) => ({
                            ...current,
                            notes: event.target.value,
                            updatedAt: timestamp,
                          }));
                        }}
                        className="mt-2 min-h-28 w-full rounded border border-gray-300 bg-white px-3 py-2 outline-none focus:border-gray-800"
                        placeholder={t.notesPlaceholder}
                      />
                    </label>
                  </div>
                ))}
            </div>
          </article>
        ))
      )}
    </section>
  );

  return (
    <main className="min-h-screen bg-[#f4f1ea] px-4 py-8 text-gray-800">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="border-b-2 border-gray-300 pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{t.appTitle}</h1>
            <p className="mt-1 text-sm italic text-gray-600">{t.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-2 rounded border border-gray-400 bg-[#fcfbf9] px-3 py-2 text-sm font-semibold shadow-sm">
              <Languages className="h-4 w-4" />
              <span className="sr-only">{t.language}</span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
                className="bg-transparent text-sm outline-none"
              >
                {(Object.keys(languageNames) as Language[]).map((code) => (
                  <option key={code} value={code}>
                    {languageNames[code]}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-flex min-w-0 items-center gap-2 rounded border border-gray-400 bg-[#fcfbf9] px-3 py-2 text-sm font-semibold shadow-sm">
              <Clock3 className="h-4 w-4 shrink-0" />
              <span className="sr-only">{t.referenceTimeZone}</span>
              <select
                value={referenceTimeZone}
                onChange={(event) => updateReferenceTimeZone(event.target.value)}
                className="max-w-52 min-w-0 bg-transparent text-sm outline-none"
                title={t.referenceTimeZone}
              >
                {timeZoneOptions.map((timeZone) => (
                  <option key={timeZone} value={timeZone}>
                    {timeZone}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setIsHelpOpen((current) => !current)}
              className="inline-flex items-center gap-2 rounded border border-gray-400 bg-[#fcfbf9] px-3 py-2 text-sm font-semibold shadow-sm hover:bg-gray-100"
            >
              <HelpCircle className="h-4 w-4" />
              {isHelpOpen ? t.hideHelp : t.help}
            </button>
            <a className="rounded border border-gray-400 bg-[#fcfbf9] px-3 py-2 text-sm font-semibold shadow-sm hover:bg-gray-100" href="/review-zip-generator">
              {t.reviewZip}
            </a>
            <button
              type="button"
              onClick={addMeeting}
              className="inline-flex items-center gap-2 rounded border border-gray-400 bg-[#fcfbf9] px-3 py-2 text-sm font-semibold shadow-sm hover:bg-gray-100"
            >
              <CalendarPlus className="h-4 w-4" />
              {t.addMeeting}
            </button>
            <button
              type="button"
              onClick={cancelEdits}
              disabled={!hasUnsavedChanges}
              className="inline-flex items-center gap-2 rounded border border-gray-400 bg-[#fcfbf9] px-3 py-2 text-sm font-semibold shadow-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={saveAgenda}
              disabled={!hasUnsavedChanges || saveState === 'saving'}
              className="inline-flex items-center gap-2 rounded border-2 border-gray-800 bg-gray-800 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-white hover:text-gray-800 disabled:cursor-not-allowed disabled:border-gray-400 disabled:bg-gray-400 disabled:text-white"
            >
              <Save className="h-4 w-4" />
              {saveState === 'saving' ? t.saving : t.save}
            </button>
          </div>
          </div>
        </header>

        {isHelpOpen && (
          <section className="border border-gray-300 bg-[#fcfbf9] p-5 shadow-md paper-shadow">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-800">
              <HelpCircle className="h-5 w-5" />
              {t.help}
            </h2>
            <ol className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start"><span className="step-number">1</span><span>{t.help1}</span></li>
              <li className="flex items-start"><span className="step-number">2</span><span>{t.help2}</span></li>
              <li className="flex items-start"><span className="step-number">3</span><span>{t.help3}</span></li>
              <li className="flex items-start"><span className="step-number">4</span><span>{t.help4}</span></li>
            </ol>
          </section>
        )}

        {saveState === 'saved' && <p className="rounded bg-green-50 p-3 text-sm font-semibold text-green-800">{t.saved}</p>}
        {loadError && <p className="rounded bg-red-50 p-3 text-sm font-semibold text-red-800">{loadError}</p>}

        <div className="grid gap-8">
          {renderMeetingGroup(t.upcoming, t.noUpcoming, upcoming)}
          {renderMeetingGroup(t.past, t.noPast, past)}
        </div>
      </div>
    </main>
  );
}

function App() {
  if (window.location.pathname.replace(/\/$/, '') === '/review-zip-generator') {
    return <ReviewZipGenerator />;
  }

  return <AgendaApp />;
}

export default App;
