import type { Handler } from '@netlify/functions';
import { jsonResponse, readJsonBody, validatePassword } from './lib/agenda';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const body = readJsonBody(event.body);
  if (!body) {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  if (!process.env.AGENDA_PASSWORD) {
    return jsonResponse(500, { error: 'AGENDA_PASSWORD is not configured' });
  }

  if (!validatePassword(body.password)) {
    return jsonResponse(401, { error: 'Incorrect password' });
  }

  return jsonResponse(200, { ok: true });
};
