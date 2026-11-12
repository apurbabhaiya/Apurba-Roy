# InsightFace integration: deployment and limits

This replaces the browser colour heuristic with InsightFace detection and 512-dimensional face embeddings. It is an initial integration, **not a deployed production service**.

## Data flow

The signed-in browser reads an album preview it can already access, resizes it to at most 1600 pixels, and posts JPEG bytes to `/api/face-encode`. The Vercel endpoint validates the Supabase session using `getUser(token)`, rejects anonymous callers, and forwards bytes to a private Python encoder using a server-only key. The encoder never fetches supplied URLs or Drive IDs. Every detected face in a group image is compared with the reference face. Only the photos supplied by the current album UI are considered. No new privileged album retrieval or database policy is introduced.

A reference must contain exactly one face. Album photos without faces produce no match. A failed image stops the search visibly instead of returning misleading partial results. Cosine scores are ranking signals, not identity probabilities. The initial 0.5 threshold requires calibration on consented representative photos before production.

## Model licensing first

The InsightFace Python code is MIT, but the supplied pretrained model weights are generally restricted to non-commercial research. Do not enable those weights for a commercial photography service without appropriate permission. Obtain a suitable commercial license or provide compatible detection and recognition ONNX models whose license permits the intended use.

`FACE_MODEL_LICENSE_ACCEPTED=true` is an operator acknowledgement, not a license grant. The service refuses to start without it. `FaceAnalysis` may download a model pack when missing, so pre-provision and verify the licensed pack under `/models/models/<FACE_MODEL_NAME>/` before starting. The model must produce 512-dimensional recognition embeddings. Do not mix embeddings from different model packs.

## Deploy Python service

Build from this directory (Python 3.11 container):

```sh
docker build -t ramyachobi-insightface .
```

Configure the hosting service with:

- `FACE_SERVICE_KEY`: a cryptographically random secret of at least 32 characters.
- `FACE_MODEL_LICENSE_ACCEPTED=true`: only after the model license is settled.
- `FACE_MODEL_NAME`: licensed pack directory name; default `buffalo_l` is research-restricted.
- `FACE_MODEL_ROOT=/models`: mount the verified pack there.
- `PORT`: hosting provider port, default 8000.

Use one application worker and one service instance initially. Inference uses CPU and a single non-queued inference lock; busy requests return 429. A per-user limit of 5000 encodes/hour is held in process memory. This is not a distributed abuse-control system: keep one replica and add gateway rate limits before scaling. Budget RAM and CPU based on a real load test; no free-hosting or throughput claim has been verified.

`GET /health` returns `ready: true` only after the model has loaded. Disable image/body logging at the hosting provider. No source image or embedding is written to disk by this service.

## Configure Vercel

The public `/api/face-encode` URL rewrites to a private branch of the existing `drive-preview` function. Its handler lives in `api/_lib/faceEncode.ts`, so the integration stays within the existing 12-function Hobby limit. Regular Drive preview requests keep their existing handler.

Set server-only `FACE_SERVICE_URL` to the service HTTPS origin and `FACE_SERVICE_KEY` to the same key. The browser must never receive either secret. Configure `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (or the existing `VITE_` publishable equivalents) to match the website authentication project. Redeploy the website branch.

`VITE_FACE_COSINE_THRESHOLD=0.5` is a public build-time setting. The old `VITE_FACE_MATCH_THRESHOLD=84` setting is no longer used.

Vite dev alone does not run `api/` endpoints. Test through Vercel or an environment that runs its API handlers.

## Current indexing limits

Photos are encoded sequentially on the first search. Per-photo vectors are cached in browser memory for 15 minutes, capped at 2000 photos and scoped by user and source URL. Selfie embeddings are not cached. Cache is not persisted to storage; expired entries are removed on subsequent writes or page closure. Full reloads and another visitor require re-indexing. Large albums will be slow. Persistent upload-time background indexing, job status and an album-authorized vector database are a separate unfinished phase; do not advertise this version as production-scale live face search.

The new album screen explains server processing and asks for the user's consent before searching. Existing legacy modal callers also use the real encoder; they require a permanent signed-in session.

## Verification

```sh
npm install --ignore-scripts
npm run build
npm run lint
node --import tsx scripts/faceSimilarity.test.ts
node --import tsx scripts/faceEncode.test.ts
python -m pip install -r services/insightface/requirements.txt
python -m unittest discover -s services/insightface -p 'test_*.py' -v
```

Backend tests replace the recognition engine with deterministic fixtures. They verify auth, reference validation, group/no-face handling, malformed model output, overload rejection and quotas. They do **not** establish real model accuracy or a live deployment.

Before release: test a licensed real model with a single-face selfie, a group photo, unrelated faces, bad images and inaccessible previews, then calibrate the threshold and measure the full album latency. Verify unauthorized API calls fail, service secrets never appear in the frontend bundle, and switching albums cannot show a previous album's result.
