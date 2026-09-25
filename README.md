# TRS Remotion Render Engine

The Remotion render engine for ThirdRailSports' Avatar Video pipeline. Compositions
render on AWS Lambda via `@remotion/lambda`, and a thin Vercel API surface exposes
render submission and polling so n8n workflows can drive renders without touching
AWS directly.

## API

**`POST /api/submit-render`**
Request: `{ compositionId: string, inputProps: object, framesPerLambda?: number }`
Response: `{ render_id: string, bucket_name: string }`

**`GET /api/render-status?render_id=<id>&bucket_name=<bucket>`**
Response: `{ status: 'rendering' | 'done' | 'failed', progress: number, render_url: string | null }`.
When `status` is `failed`, the response also carries `error: { type, is_fatal, message } | null`
(`message` is the first line of the underlying error only, never a stack trace; any URL in it is reduced to `<url:host>`, so only the host is shown).

`framesPerLambda` (optional, integer, minimum 5) sets how many frames each Lambda chunk
renders: fewer, larger chunks mean fewer parallel Lambda invocations but a slower render,
bounded by the function's 120s timeout. Omit it to use Remotion's default chunking. A
value that is not an integer of at least 5 returns `400` before Lambda is called.

See `api/submit-render.ts` and `api/render-status.ts` for the implementation.

### Example: `BeatSequence` request

The real composition rendered on Lambda is `BeatSequence` (`AvatarBeat` + `BrollBeat`,
assembled dynamically from a `beats` array). Send the header
`x-trs-render-key: <TRS_RENDER_API_KEY>` with every request, or the API returns 401.
Example `submit-render` request body:

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

The `https://example.com/...` URLs above are placeholders. Replace `photo_url`,
`clip_url` and `audio_url` with real, publicly reachable media URLs — otherwise the
submit call still returns a valid `render_id`, but the render then fails on unfetchable media.

`beats` is an array of `Beat` (see `src/types/beat.ts`). `photo_url` is read by both beat
types. `clip_url` is read only by `avatar` beats (required for them); `audio_url` is read
only by `broll` beats (optional; a Ken Burns effect runs over `photo_url`).

**Null tolerance.** Real pipeline data contains nulls, and these are tolerated (no crash):

- `overlay_text` null/empty: no banner.
- `audio_url` null: no narration audio (only b-roll beats read it).
- `photo_url` null, empty or missing: a dark (`#0a0a0a`) background with a faint centered `TRS` watermark.
- `word_timings` null or invalid: no captions on that beat, never an error.
- `clip_url` on b-roll beats: ignored.

These DO fail the render: an `avatar` beat without a `clip_url` (it is required for avatar
beats; input validation is planned for the n8n integration), and any image, audio or video
URL that cannot be fetched.

`fps` is honored: the composition's timeline length is derived from the beats' `duration_sec`
at the requested `fps` (default 30).

### Optional inputs and caption / banner / badge / music behavior

`BeatSequence` also accepts two optional top-level inputs:

- `leagueBadge` (string, e.g. `"NBA"`): shown as a badge in the top-right corner for the whole video. Omitted or empty = no league badge.
- `musicUrl` (string URL): a music bed played under the whole video, looped, at a low volume (0.045 peak) with a 1s fade-in and 1s fade-out over the total video length. Omitted or empty = no music.

Each beat may carry `word_timings`: either a JSON string or an array of
`{ word: string, start: number, end: number }` with `start`/`end` in seconds **relative to
the start of that beat**. Invalid or unparseable values are ignored (no captions for that beat).

What is rendered:

- **Captions:** words are shown four at a time (a fixed pager) in bold Montserrat, white with a black stroke; the currently spoken word is highlighted lime (`#CCFF00`). Captions are drawn on both `broll` and `avatar` beats when `word_timings` is present, and a page stays visible through gaps shorter than 0.25 s between word pages (no blinking) but disappears during real pauses. On broll beats they sit near the bottom; on avatar beats they sit above the corner avatar box.
- **Banner:** a `broll` beat's `overlay_text` is shown as a banner near the top (below the badge row) for the first 4 seconds of that beat only. Avatar beats do not show a banner.
- **Badges:** a `THIRD RAIL SPORTS` badge in the top-left on every frame, plus the optional `leagueBadge` in the top-right.
- **Music:** see `musicUrl` above.
- A null, empty or missing `photo_url` renders the dark `#0a0a0a` background with a faint centered `TRS` watermark (see Null tolerance above).

## Known limitations

- Some real photo hosts cannot be loaded by the renderer. Verified: `cdn.nba.com` images fail on Lambda with `Error loading image with src: ...`. Re-host photos (e.g. to blob storage) before rendering.
- A failed render's `error.message` shows only the host of any URL (e.g. `<url:cdn.nba.com>`), never the full asset URL.
- Avatar-beat caption timing comes from the ElevenLabs alignment of the script, while the audible voice is HeyGen's, so it can drift slightly; it is unverified against a real HeyGen clip.
- The AWS Lambda concurrency limit (see below) constrains long renders.

## Lambda concurrency

With the default 20 frames per chunk, a render needs `ceil(frames/20) + 1` Lambda
invocations. The AWS account's concurrent-execution limit is currently 10 (a quota
increase has been requested and was pending at the time of writing), so long videos need
either the quota increase or a larger `framesPerLambda`. Failure symptom: status `failed`
with an error message starting `AWS Concurrency limit reached`.

## Testing a render directly on Lambda

```
node --env-file=.env scripts/test-render.mjs [short|full|g4]
```

Renders the real `BeatSequence` composition straight on Lambda, bypassing the Vercel API.
`short` (default) is a 2s avatar + 2s broll beat with default chunking; `full` is a 5s +
4s (270 frame) render using `framesPerLambda: 45` to stay under the concurrency limit.
`g4` is avatar 4s + stat 3s + broll 4s (330 frames, `framesPerLambda: 60`, 7 invocations) and
exercises the stat beat and both wipe transitions. Prints the final output URL on success or `progress.errors` on failure.

## Stat beat and transitions (G4)

**`stat` beat** (additive; `avatar`/`broll` beats are unchanged). Fields:
`{ type: 'stat', photo_url, audio_url?, overlay_text?, narration_line, duration_sec, beat_index, stat: { value: number, label: string, prefix?: string, suffix?: string, decimals?: number } }`.
It renders a count-up stat card (lime `#CCFF00` value, white label) over the photo. Keep
the rendered `value` (including prefix/suffix and separators) to about 7 characters or
fewer so it fits the card. The upstream pipeline does not emit `stat` beats yet.

**`transitions` prop** on `BeatSequence` (boolean, default `true`): a lime wipe panel
sweeps across at every beat cut. It is non-overlapping: the cut frame is fully lime, so
the wipe never changes total duration and never shifts any beat or audio. Pass
`transitions: false` to disable it.

**Current site:** `trs-remotion-g4-8df37ac` (see `deploy-manifest.json`). The live API keeps
rendering the previous site (`trs-remotion-g3-bbfa0ca`) until the human updates
`REMOTION_SERVE_URL`:

```
npx vercel env rm REMOTION_SERVE_URL production
npx vercel env add REMOTION_SERVE_URL production
npx vercel --prod
```

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

## Input validation (`/api/submit-render`)

After the auth check, `inputProps` is validated and normalised by `validateRenderInput` (`src/lib/validate.ts`) before anything is sent to Lambda. Invalid input returns HTTP 400 `{ "error": "invalid input", "details": [ ...messages ] }`; the NORMALISED props are what get rendered. Success returns `{ render_id, bucket_name, warnings }`.

Rules:

- `inputProps` is an object; `beats` is a non-empty array of at most 40; `fps`, if present, must be 30 (absent defaults to 30); `musicUrl`, if present, must be `https://`.
- Every beat: `type` is `avatar|broll|stat`; `beat_index` is a number; `duration_sec` is finite, 0.5..60; all beats total at most 180s.
- `duration_sec` and `beat_index` may be numeric strings (n8n often stringifies numbers); they are coerced to numbers in the submitted props. Non-numeric strings are errors.
- `avatar` beats need a non-empty `https://` `clip_url`. `broll` `clip_url` stays optional.
- `photo_url`: EVERY beat (avatar, broll, stat) needs a non-empty `https://` string of at most 2000 chars. Missing, null, empty, non-https or too long is an ERROR (HTTP 400, e.g. `beat 2 (position 1): photo_url missing`); there is no fallback background and the message never echoes the URL. Photos are human-approved upstream, so a beat without one is a hard stop.
- `overlay_text` is trimmed and clamped to 80 chars (ends with `…`, adds a warning).
- `stat` beats need a `stat` object: finite `value`; non-empty `label` (clamped to 40 chars with a warning); `prefix`/`suffix` at most 3 chars; `decimals` an integer 0..2; the formatted value (e.g. `$1,234%`) must be at most 7 characters.
- `word_timings` passes through untouched.

`warnings` is an array of non-fatal notices (clamped text); callers should log them. A non-JSON or non-object request body returns 400 `request body must be a JSON object`; a Lambda submit failure returns 502 `{ error: 'render submit failed', details: [<redacted first line>] }`. Beat error labels include the array position, e.g. `beat 1 (position 0)`.
