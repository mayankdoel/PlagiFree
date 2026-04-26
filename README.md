# PlagiFree

PlagiFree is a no-login, no-signup plagiarism checker built with Next.js, Tailwind CSS, and Express. Users can paste text or upload PDF, DOCX, and TXT files and get a saved report without creating an account.

## Stack

- Next.js 15 + Tailwind CSS
- Express + TypeScript
- MongoDB for cached reports
- Redis for repeated phrase lookups
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
