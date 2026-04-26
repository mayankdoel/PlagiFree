# PlagiFree

PlagiFree is a no-login, no-signup plagiarism checker built with Next.js, Tailwind CSS, and Express. Users can paste text or upload PDF, DOCX, and TXT files, scan the web with Bing Search API-backed phrase lookups, and instantly download a PDF report.

## Stack

- Next.js 15 + Tailwind CSS
- Express + TypeScript
- MongoDB for report caching
- Redis for phrase and page caching
- Mammoth + pdf-parse for file extraction
- PDFKit for downloadable reports

## Run locally

1. Copy `.env.example` to `.env`.
2. Set `BING_API_KEY`, `MONGODB_URI`, and `REDIS_URL`.
3. Install dependencies:

```bash
npm install
```

4. Start the web and API servers:

```bash
npm run dev
```

## Routes

- `GET /` landing page
- `POST /api/check` run plagiarism detection
- `GET /api/check/:id` fetch a saved report
- `GET /api/report/:id` download PDF report

## Notes

- There is no authentication, session storage, cookie flow, or account model anywhere in the app.
- If MongoDB or Redis are unavailable, the app falls back to in-memory caching so development can still continue.
- Bing Search API credentials are required for live source discovery in the detection pipeline.
