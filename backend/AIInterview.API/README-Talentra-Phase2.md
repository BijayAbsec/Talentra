# Talentra Phase 2 — Adaptive AI Interview Questions

## What changed
- Added `POST /api/interviews/next-question`.
- The endpoint reads the saved interview questions and answers, asks Ollama for one contextual follow-up question, and persists that question in `QuestionsJson`.
- The question list starts with the existing eight questions and is capped at twelve total questions.
- The React app requests the next adaptive question after a successful answer evaluation. The current feedback remains visible; the candidate clicks Next question to continue.
- Existing routes and the SQL Server schema are unchanged.

## Run
1. Start Ollama and ensure the model configured in `appsettings.json` is available.
2. Start the .NET 10 API.
3. Start the React Vite app with `npm install` and `npm run dev`.
4. Upload a resume, start an interview, answer a question, and submit it.
5. After the evaluation, use Next question. The next question should probe the candidate's latest answer.

## Notes
- Adaptive follow-up generation is an additional Ollama request after answer evaluation, so submission may take longer. A later performance improvement is to combine evaluation and follow-up generation into one model call or queue follow-up generation.
- This phase does not implement WebRTC, a remote peer, or streaming avatar video. It adds adaptive interview logic to the existing voice/avatar UI.
- No EF Core migration is required: the existing `QuestionsJson` column stores the updated question list.
- Verify `Ollama:Model` and database connection settings locally. Do not commit production secrets.
