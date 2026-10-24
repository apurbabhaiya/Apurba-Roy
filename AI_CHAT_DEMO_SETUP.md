# Ramya Chobi site chat support

Branch: `feat/ai-live-chat-demo`.

## Included
- Floating support chat on public home, about, packages, booking, portfolio, stories and public delivery list.
- FAQ replies based on the website's public services and page structure.
- Deterministic fixed-package quotes using the current admin-controlled discount setting and the booking form's per-event rules.
- Bengali browser speech input and optional spoken answers when the visitor's browser supports them.
- WhatsApp and phone links for human support.

## Runtime
Chat requests go to a public Supabase Edge Function in the site's own project. Visitor text is not sent to an external AI provider and is not stored. The function applies origin checks, request size limits and best-effort per-instance throttling.

## Behavior and limits
- Voice input uses the browser's Web Speech API. Availability depends on browser support and microphone permission. The recognized transcript is submitted to this site only after the visitor taps Send. Speech providers may process audio as part of browser speech recognition.
- Spoken answers use browser speech synthesis; Bengali voice availability depends on the device.
- The widget does not connect to a staffed inbox. Customers can contact the team through WhatsApp or phone.
- Custom package and hourly city-shoot quotes require event, city, date, time, team and travel inputs. The bot directs those cases to the interactive booking calculator rather than guessing.
- Booking dates and availability, payment verification and final confirmation are handled by the office, never inferred by the bot.
- The in-memory rate limiter is best-effort per serverless instance; stronger abuse protection requires platform firewall configuration.

## Privacy
Microphone activation is visitor-controlled. The app sends only the transcript after the visitor taps Send and does not persist chat transcripts.