# Ramya Chobi AI Chat — Demo Setup

Branch: `feat/ai-live-chat-demo`. This branch is not production.

## Implemented
- `src/components/RamyaChatWidget.tsx`: floating text chat UI, not mounted in RouterApp yet.
- `api/chat.ts`: server-side Gemini chat endpoint with conservative pricing policy. API is not verified deployed.

## Required before testing
1. Set `GEMINI_API_KEY` as a server-only environment variable in Vercel Preview; never use `VITE_` for the secret.
2. Verify the project can compile the serverless handler. If TypeScript complains about `@vercel/node` types, install that package or replace the type imports with compatible local types.
3. Mount `RamyaChatWidget` once in the public layout or RouterApp (avoid embedding it in private admin pages).
4. Add request throttling and abuse controls before exposing the API publicly.
5. Read package prices, approved discounts, extra-event counts and payment terms from the existing booking source of truth. Do not use AI-generated numeric values.
6. Implement voice transcription with explicit mic permission, audio limits, and a privacy notice. Voice is not yet implemented.
7. Implement an authenticated admin inbox, conversation persistence, RLS policies and a real human handoff flow. Not yet implemented.
8. Test mobile UX, Bengali/Banglish, price arithmetic, unauthorized data access, error cases and accessibility.
9. Publish only after preview QA and explicit approval.

## Pricing contract
`gross = basePackagePrice * (1 + extraEventCount)`
`discount = gross * approvedDiscountPercent / 100`
`payable = gross - discount`
`balance = payable - confirmedAdvance`
Use the booking calculator's rounding and rules as the authoritative implementation, rather than duplicating formulas in AI.

## Security
Never pass service-role keys or Gemini keys to the browser. Do not expose booking or client data to public anonymous chat. Store conversations only with a defined retention policy.
