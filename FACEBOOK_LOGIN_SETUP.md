# Facebook client access

Target: `apurba-roy` on team `ramyachobi`, https://apurba-roy-three.vercel.app.
Supabase: `izfmwvqveiphyuufvxoq` (RommoChobi).

## What is implemented

- `/face-search`, `/client-gallery`, `/albums`, and their album detail aliases require a verified Facebook client session before mounting the gallery UI.
- Login returns to the requested gallery path and query. Return destinations are restricted to gallery routes on the same origin.
- Facebook clients use a separate Supabase storage key. They do not replace the existing studio Google Drive login or the anonymous gallery access session.
- Follow and Write a Review open the RamyaChobi Facebook Page in another tab. Neither is a condition of access. The old public album follow checkbox gate is removed from routing.
- The homepage review submission action opens Facebook. It does not claim that a website form can publish a Facebook recommendation.
- Existing approved website testimonials remain separate from the Facebook section.

## Activation still required

At inspection on 2026-10-18, Supabase `/auth/v1/settings` reported `external.facebook=false`.

1. Create or select the studio's Meta app with Facebook Login. Enable the required email permission. Complete the app's publication requirements for public login.
2. Configure this exact Valid OAuth Redirect URI in Meta:
   `https://izfmwvqveiphyuufvxoq.supabase.co/auth/v1/callback`
3. In Supabase > Authentication > Sign In / Providers > Facebook, enter the Meta App ID and App Secret directly, and enable Facebook. Do not commit or paste the App Secret into source or chat.
4. In Supabase Authentication URL Configuration, add the production callback:
   `https://apurba-roy-three.vercel.app/facebook-login**`
   Add the exact stable preview callback origin separately if testing previews. Keep existing Google and gallery redirect settings.
5. Verify a real Facebook login, cancellation, return to the requested album, and logout on production. This cannot be certified while the provider is disabled.

Docs: https://supabase.com/docs/guides/auth/social-login/auth-facebook

## Facebook review display

Do not use the legacy `/{page-id}/ratings` endpoint as a promised auto-sync integration: review/recommendation fields were deprecated in the Graph API v22 rollout. Permission approval alone is not evidence of an operational review feed.

For public Facebook review posts that support embedding, set the public build variable `VITE_FACEBOOK_REVIEW_POST_URLS` to a comma-separated list of up to six Facebook post permalinks. Redeploy after setting it. The homepage embeds those original public posts and includes links to their Facebook originals. Private/non-embeddable reviews cannot be displayed this way. Without selected post links, the section links to the Page's Reviews tab and does not display invented Facebook reviews.

This is a curated embed, not automatic review synchronization. Meta page tokens are not needed or exposed by this implementation.

## Security boundary

This change gates the requested website screens. It does not replace the existing database row policies, secure album links, PINs, client grants, payments, or media download authorization. The Facebook session is isolated from the existing gallery data session; it is not a new server-enforced authorization layer for legacy gallery APIs. Do not treat Facebook login as proof of album ownership.
