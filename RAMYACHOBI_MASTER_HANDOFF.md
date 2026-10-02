# RamyaChobi Master Handoff

Use this file to continue the RamyaChobi project from another ChatGPT account or a future session.

## Quick-start prompt
After opening this file in another ChatGPT account, send:

> Continue the RamyaChobi project from this handoff. Treat this file as the source of truth. Before changing production code, inspect the current GitHub `main` branch and verify the active Vercel production deployment. Do not expose secrets.

---

## 1. Project identity
- Brand: **RamyaChobi / রম্যছবি**
- Type: wedding photography + cinematography + client workflow platform
- GitHub: **apurbabhaiya/Apurba-Roy**
- Branch: **main**
- Frontend: Vite + React 19 + TypeScript + Tailwind CSS v4 + lucide-react
- Backend/data: Supabase
- Private original media: Google Drive

## 2. Current deployment / domains
Known recent working deployment:
- Main: https://apurba-roy-three.vercel.app/
- Portfolio: https://apurba-roy-three.vercel.app/portfolio
- Packages: https://apurba-roy-three.vercel.app/packages
- Admin: https://apurba-roy-three.vercel.app/delivery-admin

Another recent deployment:
- https://apurba-3m3cqh147-ramyachobi.vercel.app/

Old short alias:
- https://apurba-roy.vercel.app/

The old short alias previously showed 404 on direct SPA routes such as /packages. The repo already contains a catch-all SPA rewrite in vercel.json, so the remaining issue is Vercel production alias/project assignment.

## 3. Route map
- / — homepage
- /about — about/team
- /packages — packages
- /portfolio — published + featured posts only
- /stories — all published portfolio/blog posts
- /blog — all published portfolio/blog posts
- /booking — booking
- /photo-selection — legacy photo-selection system
- /gallery/:token — client gallery
- /select/:token — client selection
- /face-search — face-search access
- /client-gallery — private gallery access
- /delivery — delivery entry/demo
- /delivery/:token — private final delivery
- /delivery-admin — admin panel + Portfolio Manager
- /studio — legacy admin route

## 4. Exact Main Menu order
1. Home
2. Portfolio
3. Photo Selection
4. Final Delivery
5. Face Search
6. Client Gallery
7. Packages
8. Our Services
9. About RamyaChobi
10. Client Reviews
11. Contact / Booking

## 5. Homepage
Homepage includes:
- Hero
- Portfolio preview
- Services
- Trust/process
- Client journey
- Client Reviews
- Contact / Booking
- Right-side main menu

Homepage Portfolio cards should show:
- one Cover Photo
- Event Type
- Title
- one Caption/Story excerpt

Clicking a post should open the full album.

## 6. Portfolio / Blog management
Implemented admin flow:
**Admin → New Post → Upload multiple photos → Set Cover → Publish → Featured**

Rules:
- Published + Featured → /portfolio
- Published only → /stories and /blog
- Unfeatured → removed from Portfolio but stays as a published story
- Cover photo → the one public card image
- Full post → multiple-photo album

Admin route:
- **/delivery-admin**

Portfolio Manager supports:
- New Post
- Title
- Story / Caption
- Event Type
- Multiple images
- Set Cover
- Featured / Unfeatured
- Publish / Unpublish
- Edit
- Delete
- Add Photos
- Delete media

Event types:
Wedding, Holud, Reception, Pre-Wedding, Engagement, Couple, Birthday, Corporate, Family, Other.

## 7. Supabase portfolio model
Supabase project:
- Name: **RommoChobi**
- Ref: **izfmwvqveiphyuufvxoq**
- Region: **ap-southeast-1**

Tables:
### portfolio_posts
- id
- title
- slug
- story
- event_type
- is_featured
- is_published
- cover_image_url
- cover_storage_path
- published_at
- created_at
- updated_at

### portfolio_media
- id
- post_id
- image_url
- storage_path
- caption
- alt_text
- sort_order
- is_cover
- created_at

Storage bucket:
- **portfolio-media**
- public portfolio media only
- max 15 MB
- JPEG / PNG / WebP / AVIF

Edge Function:
- **portfolio-admin**
- list
- create
- update
- upload
- set_cover
- delete_media
- delete

Do not expose service-role or secret keys.

## 8. Reviews on homepage
### Wedding Reviews
**Shuvojit & Tisha** — Reception • Dhaka — ★★★★★  
“কোয়ালিটি একদম প্রিমিয়াম। কালার টোন ও সিনেমাটিক ভিডিও অসাধারণ।”  
Avatar: https://i.postimg.cc/BnPncZmR/Shuvojit.jpg

**Anika & Rafi** — Muslim Wedding • Mymensingh — ★★★★★  
“অনেক সুন্দর কভারেজ হয়েছে। সময়মতো সব ডেলিভারি দিয়েছে।”  
Avatar: https://i.postimg.cc/tg0Cr0cv/anika.jpg

### Pre-Wedding / Engagement Reviews
**Nazmul & Sumi** — Pre-Wedding • Outdoor — ★★★★★  
“পোজিং গাইড ও লোকেশন সাজেশন খুব ভালো ছিল।”  
Avatar: https://i.postimg.cc/cLtLM1DG/Puja.jpg

**Rifat & Nabila** — Engagement • Gauripur — ★★★★★  
“ছবিগুলো এক কথায় অসাধারণ। অল্প সময়ে ডেলিভারি পেয়েছি।”  
Avatar: https://i.postimg.cc/g09kM975/mou.jpg

Homepage initially shows Wedding Reviews; See more expands the second group.

## 9. About / Team
**Apurba Roy** — Founder, Lead Photographer  
Image: https://i.postimg.cc/3w2dXrtr/Apurba-Roy-CEO-Core-Photographer.jpg

**Maya Chaudhary** — Core Cinematographer  
Image: https://i.postimg.cc/C1N52PT8/Maya-Chowdhury-Niyaz-Core-CInematographer.jpg

## 10. Final approved package prices
### Regular
- Regular Basic — **৳15,000**
- Regular Standard — **৳23,000**
- Regular Storytelling — **৳55,000**

### Outdoor
- Outdoor Essentials — **৳13,000**
- Outdoor Cinematic — **৳23,000**
- Outdoor Signature — **৳47,000**

### Sonaton — Both Side
- Signature — **৳124,000**
- Prestige — **৳184,000**
- Storytelling — **৳339,000**

### Sonaton — Bride Side
- Signature — **৳44,000**
- Prestige — **৳89,000**
- Storytelling — **৳219,000**

### Sonaton — Groom Side
- Signature — **৳63,000**
- Prestige — **৳134,000**
- Storytelling — **৳209,000**

### Sonaton — Wedding Day
- Signature — **৳34,000**
- Prestige — **৳55,000**
- Storytelling — **৳109,000**

Package design rule:
- do not copy competitor screenshots exactly
- use RamyaChobi's own warm ivory / maroon / charcoal / warm-gold premium styling

## 11. Photo Selection
Existing legacy system must remain working.

Required behavior:
- Admin login only
- Client link works without admin login
- Selection persistence/resume
- Re-selection
- Admin can view results
- Full-image viewing
- Multiple collections
- Google Drive connection
- JSON/CSV export for Lightroom desired

## 12. Face Search target
Architecture:
Google Drive originals → backend scan → face detection → embeddings/index → Supabase metadata/vector index → client selfie/camera → similarity search → matching photos.

Requirements:
- Drive remains master storage
- gallery-specific isolation
- Client A cannot search Client B gallery
- incremental indexing
- consent + retention/deletion for biometric data
- no public face DB

Current status:
**Existing FaceSearch UI exists, but the full production backend embedding/vector-index pipeline is NOT complete.**

## 13. Final Delivery business rules
- Private Drive originals
- protected preview before full payment
- typical advance 50–70%
- bKash submission: payer mobile + trx ID + amount
- admin manually verifies
- full payment verified → admin activates Final Delivery
- 30 days complimentary original access from activation
- after 30 days gallery/download logically locks
- restoration fee: **৳20/day**
- restoration options: 1 / 2 / 3 / 5 / 7 days
- server time determines expiry
- storage_retention_until may control retention

Current limitation:
**Secure backend-controlled Google Drive original download/ZIP delivery is not fully implemented yet.**

## 14. Delivery objects
Tables:
- delivery_portals
- delivery_payment_submissions
- delivery_audit_logs

Admin RPCs:
- delivery_admin_dashboard
- delivery_admin_create_from_booking
- delivery_admin_review_payment
- delivery_admin_activate_final_delivery
- delivery_admin_update_settings

Client RPCs:
- get_delivery_portal_by_token
- submit_delivery_payment

Demo token:
- demo-ramyachobi-2026

## 15. Security
Never expose:
- Supabase service-role/secret
- Google OAuth secret
- admin passwords/codes
- direct Drive original URLs
- customer-sensitive data

Known Supabase security-advisor warnings exist around older SECURITY DEFINER/public RPC patterns. Review advisors before full production launch.

## 16. User-supplied real portfolio assets from the development chat
Files uploaded:
- DSC08967.JPG
- 01.jpg
- 05.jpg
- DSC05110.jpg
- DSC05473-Edit.jpg
- DSC06128.jpg
- DSC01810.jpg
- DSC06437.jpg
- rc (45).jpg
- DSC04973-Edit.jpg
- RMC00242.jpg
- RC Nipa holud Promo_1.mp4

These chat attachments are not guaranteed to exist in another ChatGPT account. Keep a master copy in Google Drive and upload them through Admin.

Latest Portfolio screenshot showed:
**No portfolio stories published yet.**

So real posts still need to be created, published, and marked Featured.

## 17. Important code files
- src/home/RamyaChobiHome.tsx
- src/home/RamyaChobiAbout.tsx
- src/home/RamyaChobiPackages.tsx
- src/home/PortfolioPage.tsx
- src/home/ClientAccessPage.tsx
- src/components/PortfolioManager.tsx
- src/services/portfolioService.ts
- src/delivery/RamyaChobiDelivery.tsx
- src/delivery/RamyaChobiDeliveryAdmin.tsx
- src/RouterApp.tsx
- vercel.json
- src/App.tsx
- FaceSearchComponent.tsx / FaceSearchModal.tsx

## 18. Important recent commits
- Portfolio service: 5c02bfa120934e1ad6f69f773c90fa4f75023712
- Portfolio admin UI: 4d4f66820f28519c350250f97260aff2b0fe4f54
- Portfolio page: 149e2515b0df991d49f058dfe4fcd0ff71b3f275
- Homepage dynamic portfolio: 5e22cd511066ee41b3071fe05488e6e023e618bf
- Admin integration: 625b2ead31fa992a22582bfcd1f0440f00826bec
- Router: 2aa91824ec6287e59ca9fe56460ae6af297a5d10
- Reviews: 10b9281c2be15265e60e755490be00135e999cef
- Portfolio captions: 7114448a3f83005f14f7a51216e7136c13f28e15
- Final package pricing/design: b962017e651c696b58b684722c8130c0d6bcb6a6

Always inspect current main before assuming these are the latest.

## 19. Highest-priority next tasks
1. Fix Vercel production alias/domain
2. Seed real Portfolio posts
3. Verify Admin portfolio upload end-to-end
4. Complete secure Drive Final Delivery backend
5. Complete Face Search vector-index backend
6. Unify Admin Panel
7. Package → Booking preselection
8. Final mobile/desktop/security/SEO QA

## 20. Future admin goal
Desired unified admin:
- Dashboard
- Bookings
- Clients
- Portfolio / Blog
- Photo Selection
- Face Search Indexing
- Client Galleries
- Final Delivery
- Payments
- Packages
- Reviews
- Google Drive
- Reports
- Settings

## 21. Continuation rules
- Do not change user-approved business rules without asking.
- Do not fabricate reviews or client data.
- Do not copy competitor design exactly.
- Do not expose secrets.
- Drive originals remain private.
- Verify repo before code changes.
- Verify deployment after important changes.
- Preserve the exact Main Menu order unless the user requests a change.

## One-line summary
**RamyaChobi is a premium wedding photography/cinematography website plus a private client workflow platform combining booking, portfolio/blog, photo selection, face search, private galleries, payment verification, Google Drive-backed final delivery, and a progressively unified admin panel.**
