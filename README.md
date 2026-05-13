# Meeting Agenda

A Netlify-compatible Vite React TypeScript site for a password-protected editable meeting agenda. The root page is the agenda editor, and the existing review ZIP generator is preserved at `/review-zip-generator`.

## Local Development

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Set `AGENDA_PASSWORD` in `.env`, then run the app with Netlify Functions:

```bash
npm run dev
```

Open the local URL shown by Netlify. The frontend calls:

- `/.netlify/functions/login`
- `/.netlify/functions/agenda-load`
- `/.netlify/functions/agenda-save`

You can still run the Vite-only frontend with `npm run vite`, but login and persistence require `npm run dev` or a deployed Netlify site.

## Required Environment Variables

- `AGENDA_PASSWORD`: the single shared password used for both viewing and editing.

Passwords are checked only inside Netlify Functions and are not exposed in frontend code.

## Netlify Deployment

1. Push this project to a Git repository.
2. Create a new Netlify site from that repository.
3. Use the included `netlify.toml` build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
4. In Netlify, add `AGENDA_PASSWORD` under Site configuration > Environment variables.
5. Deploy the site.

Agenda data is stored in Netlify Blobs under the `meeting-agenda` store. Meetings and manuscripts are soft-deleted with `deleted: true` so they remain in the stored JSON.

## Build

```bash
npm run build
```
