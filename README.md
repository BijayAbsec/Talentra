# Talentra AI Interview Platform — connected starter

## Stack
- Frontend: React + Vite + Axios
- Backend: ASP.NET Core Web API (.NET 10)
- Database: SQL Server LocalDB + EF Core 10
- Local model: Ollama `phi3:mini`
- Resume formats: PDF, DOCX, TXT (text-based documents)

## Prerequisites
- .NET 10 SDK and Visual Studio 2026
- Node.js 20+
- SQL Server LocalDB (or change `ConnectionStrings:DefaultConnection`)
- Ollama installed with `phi3:mini` available

## 1. Start Ollama
```powershell
ollama pull phi3:mini
ollama serve
```
If Ollama is already running as a background service, verify with `ollama list`.

## 2. Create database and run API
Open `backend/AIInterview.API` in Visual Studio or a terminal. In Package Manager Console, set Default project to `AIInterview.API`, then run:
```powershell
Add-Migration InitialCreate
Update-Database
```
Or from a terminal in the API project folder:
```powershell
dotnet restore
dotnet tool install --global dotnet-ef
dotnet ef migrations add InitialCreate
dotnet ef database update
dotnet run --urls http://localhost:5000
```
Swagger: http://localhost:5000/swagger

## 3. Run React
```powershell
cd frontend/ai-interview-ui
npm install
npm run dev
```
Open http://localhost:5173.

## Connected API workflow
1. Upload CV: `POST /api/resumes/upload` (multipart field `file`).
2. Start interview: `POST /api/interviews/start` with `{ "resumeId": 1, "role": "Senior .NET Developer" }`.
3. Evaluate answer: `POST /api/interviews/answer` with `{ "sessionId": 1, "questionIndex": 0, "answer": "..." }`.
4. Retrieve session: `GET /api/interviews/{id}`.

Frontend API URL can be overridden with `.env`:
```text
VITE_API_BASE_URL=http://localhost:5000/api
```

## Notes and limitations
- The frontend camera preview is local to the browser. It is not streamed to the API or recorded by this starter.
- Microphone control is a UI toggle only; speech capture/transcription is not implemented.
- Scanned/image-only PDFs require OCR and are not supported by text extraction yet.
- Score ring displays the latest evaluated answer score converted to percent; the category donut remains illustrative until a multi-answer analytics endpoint is added.
- This is a development starter, not production-ready. Add authentication/authorization, malware scanning, secure file storage, rate limiting, request validation, data retention controls, and HTTPS before deployment. Do not expose local Ollama or this API publicly without access controls.
