# AI Mystery Room

A fictional, AI-powered detective game. Players submit a scenario, inspect a generated case, and make one final accusation. Case generation and accusation checks run on the server; the culprit and solution are withheld until an accusation is accepted.

## Requirements

- Node.js 22.12 or newer and npm
- MongoDB (local or hosted)
- A Gemini API key

## Setup

1. Install all workspace dependencies from the repository root with `npm install`.
2. Copy `server/.env.example` to `server/.env` and set `MONGODB_URI`, `GEMINI_API_KEY`, and a supported `GEMINI_MODEL`.
3. Copy `client/.env.example` to `client/.env.local` if the API is not at `http://localhost:5000/api/v1`.
4. Start MongoDB, then run `npm run dev` from the root. The client is at http://localhost:5173 and API at http://localhost:5000.

Cases are not generated using mock data. If MongoDB or Gemini is unavailable, the API returns an error and the UI lets the user retry. Text-only evidence and CCTV-style still descriptions are supported; image generation is not configured in this MVP.

## Environment

Server variables are documented in `server/.env.example`. `GEMINI_API_KEY` is backend-only. `GEMINI_MODEL` defaults to `gemini-3.8-flash` and can be changed to a model enabled for your API key. `CASE_GENERATION_TIMEOUT_MS` and `CASE_GENERATION_MAX_ATTEMPTS` control generation safety. The client only needs `VITE_API_BASE_URL`.

## Tests

- `npm test` runs the server and client test suites.
- `npm run build` creates the production client build.

The server tests exercise validation, public case sanitization, and accusation rules without live Gemini or MongoDB credentials.

## Structure

```text
client/   React + Vite application
server/   Express API, Gemini integration, validation and persistence
spec.md   Product and implementation specification
```

All cases and characters are fictional AI-generated entertainment. Simulated chats and CCTV-style material are not real records. Do not submit real personal information or use the application to investigate real people or incidents.
