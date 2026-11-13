# Talentra AI Interview Dashboard UI

A responsive React dashboard based on the uploaded reference design.

## Run
```bash
npm install
npm run dev
```
Open the Vite URL (usually http://localhost:5173).

## Included interactions
- Responsive dark sidebar and navigation state
- Interview dashboard cards, score ring, score breakdown and AI insights
- Camera preview using browser permission (`getUserMedia`)
- Microphone toggle UI, recording pause/resume UI, end-session UI
- Question navigation, answer input, submit feedback placeholder
- Responsive mobile navigation

## Backend integration
This is the dashboard UI layer. The buttons currently use local demo state. Connect:
- `POST /api/resumes/upload` for CV upload and analysis
- `POST /api/interviews/start` for AI-generated interview questions
- `POST /api/interviews/answer` for Phi-3 Mini evaluation
- Add session/report endpoints to load real score breakdown and AI insights.
Camera preview is local browser video only; it is not streamed or recorded by the backend.
