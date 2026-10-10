# Album face indexing

Gallery saves request a durable `face-index` queue message. Admin can start/resume,
retry unreadable photos, or explicitly rebuild an index after replacing Drive
contents. A worker processes five photos per invocation and publishes the next
bounded batch before acknowledging its current message. A database lease keeps
one batch active per gallery. Interrupted batches recover after 180 seconds;
individual photos stop after three attempts. Queue transport retries stop after
ten failed deliveries, leaving unfinished DB work visible for manual resume.

Only server-side Supabase credentials can read/write derived face features.
Client requests verify their Supabase user and gallery claim, active status,
deadline, and PIN when enabled. Only a non-anonymous gallery owner can start,
retry, or rebuild. Existing gallery/photo RLS is unchanged. The worker endpoint
is a private Vercel Queue consumer, not a publicly callable indexing endpoint.

The browser detects reference faces, offers a face picker for group references,
and checks minimum face size, detector confidence and crop sharpness. It then sends
the selected face’s 128 features in an
authenticated, uncached search request. The reference image is not uploaded or
persisted. The server does not save reference features or log face data. Only
matching Drive photo IDs and ranking scores return to the client; gallery
features never return. Search is album-scoped and stops while indexing is
incomplete. A score is not an accuracy probability or an identity guarantee.

The Node WASM and browser models use the same pinned face-api models. The
starting Euclidean cutoff is 0.5; labeled real positive/negative portraits,
different poses, small/group faces and lighting must still be evaluated before
making any accuracy claim. The upstream face-api repository is archived.

## Drive behavior

The worker reads only a Drive file ID belonging to a verified DB photo, or a
stored Google-hosted thumbnail. Redirects and response sizes are bounded.
Original Drive files, downloads, selections, bookings and payments are not
changed. Final Delivery OAuth is not reused. A private file without a readable
Photo Selection thumbnail fails visibly and needs a refreshed thumbnail or
separate server-side Photo Selection connection. No automatic public-sharing
permission changes are made.

Changes to source ID, size, creation time or MIME invalidate features immediately.
Temporary thumbnail URL refreshes do not invalidate an index. If Drive contents
are replaced without changing those fields, use **Rebuild index**. Photo/gallery
deletion cascades only to the associated derived face index.

## Checks

```
npm run lint
npm run build
node --import tsx tests/face-match.test.ts
node --import tsx tests/face-index-api.test.ts
FACE_TEST_IMAGE=/absolute/authorized/portrait.jpg node --import tsx tests/face-runtime.test.ts
```

API tests cover missing/unauthorized sessions, disabled galleries, PIN gate,
owner-only management, rate limit, unfinished index and 1501-photo pagination.
Runtime tests prove actual inference on an authorized portrait, repeat-image
matching and no-face behavior on a blank image. They do not establish accuracy.

Database checks verify service-only grants, batch leases, duplicate delivery
exclusion, retry reset, crash attempt limit and source invalidation in a rolled
back transaction using the isolated test gallery.

## Deployment verification still required

Vercel needs the existing server-only `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) in Preview and Production,
and Queue OIDC authentication. Build success alone does not verify that a Queue
message is delivered, WASM/model assets are traced into the worker, Drive images
are readable from Vercel, or cross-runtime reference matching works.

Sign into the preview as the actual test-gallery owner, start its index, confirm
all three fixture statuses, upload the authorized reference in a separate client
session, and verify results. Repeated search must not read album images again.
Test retry after an inaccessible fixture preview and confirm that original Drive
files are unchanged. Do not merge this draft until those checks are observed.

## Labeled accuracy evaluation

Run `node --import tsx scripts/evaluate-face-matches.ts /absolute/labels.json`
with authorized local photos and photographer-assigned labels:

```json
{
  "reference": "reference.jpg",
  "cutoff": 0.5,
  "cases": [
    { "file": "same-person-different-light.jpg", "expected": true },
    { "file": "group-with-reference-person.jpg", "expected": true },
    { "file": "different-person.jpg", "expected": false }
  ]
}
```

For a group reference add `referenceFaceIndex` after verifying its detected face
order. Reports include true/false positives, true/false negatives, unreadable
photos, precision and recall. Exit status is nonzero for a missed positive, false
positive or unreadable case. The 0.5 cutoff and quality gates are starting values,
not calibrated guarantees. Use held-out photos and multiple people before release.

Current production `apurba-roy-three.vercel.app` still runs the main branch's
RGB heuristic; draft PR 14 contains this replacement. The target 1491-photo
gallery has no derived index yet. Preview needs the server-only Supabase key,
which currently targets Production only. Keep release blocked until actual
Queue processing and labeled cross-runtime searches pass.
