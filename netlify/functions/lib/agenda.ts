import { connectLambda, getStore } from '@netlify/blobs';
import type { HandlerEvent } from '@netlify/functions';

export type Manuscript = {
  id: string;
  title: string;
  notes: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Meeting = {
  id: string;
  time: string;
  manuscripts: Manuscript[];
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AgendaData = {
  meetings: Meeting[];
};

export const agendaKey = 'agenda.json';

export const jsonResponse = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const readJsonBody = (body: string | null) => {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
};

export const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

export const validatePassword = (password: unknown) => {
  const expectedPassword = process.env.AGENDA_PASSWORD;
  return Boolean(expectedPassword && typeof password === 'string' && password === expectedPassword);
};

export const getAgendaStore = () => getStore('meeting-agenda');

export const defaultAgenda: AgendaData = { meetings: [] };

export const connectBlobs = (event: HandlerEvent) => {
  const lambdaEvent = event as HandlerEvent & { blobs?: string };
  if (lambdaEvent.blobs) {
    connectLambda({ blobs: lambdaEvent.blobs, headers: event.headers });
  }
};

export const loadAgenda = async (): Promise<AgendaData> => {
  const store = getAgendaStore();
  const agenda = await store.get(agendaKey, { type: 'json' });
  if (!agenda || typeof agenda !== 'object' || !Array.isArray((agenda as AgendaData).meetings)) {
    return defaultAgenda;
  }
  return agenda as AgendaData;
};

export const saveAgenda = async (agenda: AgendaData) => {
  const store = getAgendaStore();
  await store.setJSON(agendaKey, agenda);
};

export const isAgendaData = (value: unknown): value is AgendaData => {
  if (!value || typeof value !== 'object') return false;
  const meetings = (value as AgendaData).meetings;
  if (!Array.isArray(meetings)) return false;

  return meetings.every((meeting) => {
    if (!meeting || typeof meeting !== 'object') return false;
    if (typeof meeting.id !== 'string' || typeof meeting.time !== 'string') return false;
    if (typeof meeting.deleted !== 'boolean') return false;
    if (!Array.isArray(meeting.manuscripts)) return false;

    return meeting.manuscripts.every((manuscript) => {
      if (!manuscript || typeof manuscript !== 'object') return false;
      return (
        typeof manuscript.id === 'string' &&
        typeof manuscript.title === 'string' &&
        typeof manuscript.notes === 'string' &&
        typeof manuscript.deleted === 'boolean'
      );
    });
  });
};
