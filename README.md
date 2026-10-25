# AI Mystery Room

A fictional, AI-powered detective game. Players submit a scenario, inspect a generated case, and make one final accusation. Case generation and accusation checks run on the server; the culprit and solution are withheld until an accusation is accepted.

## Requirements

- Node.js 22.12 or newer and npm
- MongoDB (local or hosted)
- A Gemini API key

## Run locally

1. From the repository root, install dependencies: `npm install`.
2. Copy `server/.env.example` to `server/.env` and set `MONGODB_URI` and `GEMINI_API_KEY`.
3. Run `npm run dev` from the repository root. The client is at http://localhost:5173 and API at http://localhost:5000.

The client uses a relative `/api/v1` URL, and Vite proxies API requests to the local server. Cases are not generated using mock data. If MongoDB or Gemini is unavailable, the API returns an error and the UI lets the user retry.

## Deploy to Render

The included `render.yaml` deploys the built React app and Express API as one Render web service. MongoDB and Gemini credentials are supplied as private environment variables.

1. Push this project to GitHub. In PowerShell, from the repository root:

   ```powershell
   git add .
   git commit -m "Prepare app for deployment"
   git push origin main
   ```

   If your branch is not named `main`, check it with `git branch --show-current` and push that branch instead. `server/.env` is ignored by Git; do not force-add it.

2. Create a MongoDB Atlas database if you do not already have one. In Atlas, add the deployment service's outbound IP access as appropriate for your plan, or temporarily allow access from anywhere (`0.0.0.0/0`) and use a strong database password. Create a database user and copy the application connection string. Replace its username, password, and database name. Keep the URI private.

3. Create a Gemini API key from Google AI Studio and keep it private.

4. Sign in to Render, choose **New → Blueprint**, connect the GitHub repository, and select the branch you pushed. Render reads `render.yaml` and creates the service.

5. When Render asks for the values marked `sync: false`, enter `MONGODB_URI` (the Atlas connection string) and `GEMINI_API_KEY`. Keep the default `GEMINI_MODEL` unless you need to select a model enabled for your key.

6. Start the deployment. Render runs `npm ci && npm run build`, then starts the API. Wait for the deploy to finish and open the `onrender.com` URL shown on the service page. The health endpoint is `<your-service-url>/api/v1/health`.

7. Try creating a case. If deployment succeeds but database connection fails, check Atlas **Security → Network Access** and confirm the database username/password and database name in `MONGODB_URI`. If the health endpoint works but case generation fails, check the Gemini key and model.

For later updates, commit and push changes to the connected branch; Render will deploy them automatically. Never put secrets in frontend variables such as `VITE_*`, commit `.env` files, or share screenshots containing credentials.

## Environment

Server variables are documented in `server/.env.example`. `GEMINI_API_KEY` is backend-only. `GEMINI_MODEL` defaults to `gemini-3.8-flash` and can be changed to a model enabled for your API key. `GEMINI_MAX_RETRIES` bounds retries for transient provider errors (default 2); `CASE_GENERATION_TIMEOUT_MS` bounds each provider request including retries, and `CASE_GENERATION_MAX_ATTEMPTS` controls retries for malformed or inconsistent generated cases. The client only needs `VITE_API_BASE_URL` when the API is hosted on a different origin.

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
