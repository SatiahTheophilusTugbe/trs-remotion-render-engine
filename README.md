# TRS Remotion Render Engine

The Remotion render engine for ThirdRailSports' Avatar Video pipeline. Compositions
render on AWS Lambda via `@remotion/lambda`, and a thin Vercel API surface exposes
render submission and polling so n8n workflows can drive renders without touching
AWS directly.

## API

**`POST /api/submit-render`**
Request: `{ compositionId: string, inputProps: object }`
Response: `{ render_id: string, bucket_name: string }`

**`GET /api/render-status?render_id=<id>&bucket_name=<bucket>`**
Response: `{ status: 'rendering' | 'done' | 'failed', progress: number, render_url: string | null }`

See `api/submit-render.ts` and `api/render-status.ts` for the implementation.

### Example: `BeatSequence` request

The real composition rendered on Lambda is `BeatSequence` (`AvatarBeat` + `BrollBeat`,
assembled dynamically from a `beats` array). Example `submit-render` request body:

```json
{
  "compositionId": "BeatSequence",
  "inputProps": {
    "beats": [
      { "type": "avatar", "photo_url": "https://example.com/avatar-frame.jpg", "clip_url": "https://example.com/avatar-clip.mp4", "overlay_text": "", "narration_line": "Welcome back to Third Rail Sports.", "duration_sec": 5, "beat_index": 0 },
      { "type": "broll", "photo_url": "https://example.com/broll-photo.jpg", "audio_url": "https://example.com/narration.mp3", "overlay_text": "REAL MADRID WIN", "narration_line": "Real Madrid took all three points.", "duration_sec": 4, "beat_index": 1 }
    ],
    "fps": 30
  }
}
```

`beats` is an array of `Beat` (see `src/types/beat.ts`) — `type: 'avatar'` beats use
`clip_url`, `type: 'broll'` beats use `audio_url` (Ken Burns effect over `photo_url`).
`fps` must match the frame rate the composition should render at.

## Environment variables

Six env vars are required, both locally and on Vercel:

- `REMOTION_AWS_ACCESS_KEY_ID` / `REMOTION_AWS_SECRET_ACCESS_KEY` — AWS credentials with Lambda render access. Copy `.env.example` to `.env` for local dev and fill in real values (never commit `.env`).
- `REMOTION_REGION`, `REMOTION_FUNCTION_NAME`, `REMOTION_SERVE_URL` — must match the currently deployed Lambda function and site. Real values live in `deploy-manifest.json` (`region`, `functionName`, `serveUrl`).
- `TRS_RENDER_API_KEY` — shared secret required on every request to both `/api/submit-render` and `/api/render-status`. The caller (eventually n8n) must send it as the `x-trs-render-key` header; requests missing it or sending the wrong value get a `401` before either endpoint touches AWS/Lambda.

The same 6 variables must be set on Vercel (`vercel env add <NAME>`) for the deployed API to work. Deployment location: `apiBaseUrl` and `vercelProject` in `deploy-manifest.json`.

## Redeploying the Lambda site

```
npx remotion lambda sites create src/index.ts --site-name=<name>
```

**Before you redeploy:** re-running this with the *same* `--site-name` overwrites the
existing S3 content at that URL in place — the URL is keyed on the site name you pass,
not a content hash. `deploy-manifest.json`'s `serveUrl` and the Vercel
`REMOTION_SERVE_URL` env var must be updated together whenever the site is redeployed
under a new name, or the two will silently drift apart (API renders against a stale or
mismatched site). If you redeploy under the same name to intentionally update the live
site in place, no URL changes are needed — but double-check `serveUrl` in
`deploy-manifest.json` still matches reality.

## Redeploying the API

```
npx vercel --prod
```

Run `vercel env add <NAME>` first for any env var that changed, then redeploy so the
new values take effect.
