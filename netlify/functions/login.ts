import type { Handler } from '@netlify/functions';
import {
  getPasswordVariableName,
  jsonResponse,
  parseAgendaPod,
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

  const pod = parseAgendaPod(body.pod);
  if (!pod) {
    return jsonResponse(400, { error: 'Invalid agenda portal' });
  }

  const passwordVariableName = getPasswordVariableName(pod);
  if (!process.env[passwordVariableName]) {
    return jsonResponse(500, { error: `${passwordVariableName} is not configured` });
  }

  if (!validatePassword(body.password, pod)) {
    return jsonResponse(401, { error: 'Incorrect password' });
  }

  return jsonResponse(200, { ok: true, pod });
};
