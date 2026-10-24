# Ramya Chobi AI Chat

Branch: `feat/ai-live-chat-demo`.

## Included
- Floating support chat on public home, about, packages, booking, portfolio and stories pages.
- Gemini responses grounded in the site's fixed package catalog and approved public service information.
- Deterministic fixed-package quotes using the current admin-controlled discount setting and the booking form's per-event rules.
- Bengali browser speech input and optional spoken answers when the visitor's browser supports them.
- WhatsApp and phone links for human support.

## Required to enable AI answers
Set `GEMINI_API_KEY` as a server-only Vercel environment variable for the preview and production targets. Never prefix it with `VITE_` or include it in browser code. The current project has no Gemini key configured, so until an administrator adds one, the chat can still provide deterministic package quotes but general questions will show a fallback reply.

## Limits
- Voice input uses the browser's Web Speech API. Availability depends on browser support and microphone permission. The recognized transcript is submitted only after the visitor taps Send.
- Spoken answers use the browser's speech synthesis voices; Bengali voice availability depends on the device.
- The widget does not store conversations and does not connect to a staffed inbox. Customers can contact the team through WhatsApp or phone.
- Custom package and hourly city-shoot quotes require event, city, date, time, team and travel inputs. The bot directs those cases to the interactive booking calculator rather than guessing.
- Booking dates and availability, payment verification and final confirmation are handled by the office, never inferred by the bot.
- The in-memory API rate limiter is best-effort per serverless instance; configure Vercel Firewall rules for stronger production abuse protection.

## Privacy
Microphone activation is visitor-controlled. Speech recognition is supplied by the browser and may process audio through its speech provider; only the resulting text is sent by the app to the chat endpoint. The app does not persist chat transcripts.
