import type { Handler } from '@netlify/functions';
import {
  connectBlobs,
  getErrorMessage,
  isAgendaData,
  jsonResponse,
  parseAgendaPod,
  readJsonBody,
  saveAgenda,
  validatePassword,
} from './lib/agenda';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const body = readJsonBody(event.body);
  if (!body) {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const pod = parseAgendaPod(body.pod);
  if (!pod) {
    return jsonResponse(400, { error: 'Invalid agenda portal' });
  }

  if (!validatePassword(body.password, pod)) {
    return jsonResponse(401, { error: 'Incorrect password' });
  }

  if (!isAgendaData(body.agenda)) {
    return jsonResponse(400, { error: 'Invalid agenda data' });
  }

  try {
    connectBlobs(event);
    await saveAgenda(pod, body.agenda);
    return jsonResponse(200, { agenda: body.agenda, pod });
  } catch (error) {
    console.error('Failed to save agenda to Netlify Blobs:', error);
    return jsonResponse(500, {
      error: 'Failed to save agenda data to Netlify Blobs.',
      detail: getErrorMessage(error),
    });
  }
};
