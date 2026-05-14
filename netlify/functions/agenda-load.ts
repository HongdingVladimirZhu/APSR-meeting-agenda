import type { Handler } from '@netlify/functions';
import {
  connectBlobs,
  getErrorMessage,
  jsonResponse,
  loadAgenda,
  readJsonBody,
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

  if (!validatePassword(body.password)) {
    return jsonResponse(401, { error: 'Incorrect password' });
  }

  try {
    connectBlobs(event);
    const agenda = await loadAgenda();
    return jsonResponse(200, { agenda });
  } catch (error) {
    console.error('Failed to load agenda from Netlify Blobs:', error);
    return jsonResponse(500, {
      error: 'Failed to load agenda data from Netlify Blobs.',
      detail: getErrorMessage(error),
    });
  }
};
