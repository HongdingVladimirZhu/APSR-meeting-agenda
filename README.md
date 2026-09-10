# Meeting Agenda

A Netlify-compatible Vite React TypeScript site with two password-protected agenda portals. The root page lets users choose IR POD or CP POD, and the review ZIP generator is preserved at `/review-zip-generator`.

## Local Development

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Set both agenda passwords in `.env`, then run the app with Netlify Functions:

```bash
npm run dev
```

Open the local URL shown by Netlify. The frontend calls:

- `/.netlify/functions/login`
- `/.netlify/functions/agenda-load`
- `/.netlify/functions/agenda-save`

You can still run the Vite-only frontend with `npm run vite`, but login and persistence require `npm run dev` or a deployed Netlify site.

## Required Environment Variables

- `AGENDA_PASSWORD`: the shared password for IR POD. This retains compatibility with the original portal.
- `CP_AGENDA_PASSWORD`: the separate shared password for CP POD.

Passwords are checked only inside Netlify Functions and are not exposed in frontend code.

## Netlify Deployment

1. Push this project to a Git repository.
2. Create a new Netlify site from that repository.
3. Use the included `netlify.toml` build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
4. In Netlify, add both `AGENDA_PASSWORD` and `CP_AGENDA_PASSWORD` under Site configuration > Environment variables.
5. Deploy the site.

IR POD keeps using the existing `meeting-agenda` Netlify Blobs store, so previously saved data remains available. CP POD uses the separate `meeting-agenda-cp` store and starts empty. Meetings and manuscripts are soft-deleted with `deleted: true` so they remain in the stored JSON.

## Build

```bash
npm run build
```
