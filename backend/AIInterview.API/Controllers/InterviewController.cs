using AIInterview.API.Data;
using AIInterview.API.Models;
using AIInterview.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
namespace AIInterview.API.Controllers;
[ApiController]
[Route("api/interviews")]
public class InterviewController(AppDbContext db, InterviewService service, LiveKitTokenService liveKit) : ControllerBase
{
    public record StartRequest(int ResumeId, string Role);
    public record AnswerRequest(int SessionId, int QuestionIndex, string Answer);
    public record NextQuestionRequest(int SessionId, int QuestionIndex);
    [HttpPost("start")]
    public async Task<IActionResult> Start(StartRequest request, CancellationToken ct)
    {
        var resume = await db.Resumes.FindAsync([request.ResumeId], ct);
        if (resume is null) return NotFound(new { message = "Resume not found." });
        try
        {
            var questions = await service.GenerateQuestionsAsync(resume.ExtractedText, request.Role, ct);
            var session = new InterviewSession { ResumeRecordId = resume.Id, Role = request.Role, QuestionsJson = JsonSerializer.Serialize(questions) };
            db.InterviewSessions.Add(session); await db.SaveChangesAsync(ct);
            return Ok(new { session.Id, session.Role, questions });
        }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (HttpRequestException ex) { return StatusCode(503, new { message = "Ollama is unavailable.", detail = ex.Message }); }
    }
    [HttpPost("answer")]
    public async Task<IActionResult> Answer(AnswerRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Answer)) return BadRequest(new { message = "Answer cannot be empty." });
        var session = await db.InterviewSessions.FindAsync([request.SessionId], ct);
        if (session is null) return NotFound(new { message = "Interview session not found." });
        var questions = JsonSerializer.Deserialize<List<string>>(session.QuestionsJson) ?? [];
        if (request.QuestionIndex < 0 || request.QuestionIndex >= questions.Count) return BadRequest(new { message = "Invalid question index." });
        try
        {
            var feedback = await service.EvaluateAsync(questions[request.QuestionIndex], request.Answer, ct);
            var answers = JsonSerializer.Deserialize<List<string>>(session.AnswersJson) ?? [];
            while (answers.Count <= request.QuestionIndex) answers.Add("");
            answers[request.QuestionIndex] = request.Answer;
            var feedbackList = JsonSerializer.Deserialize<List<JsonElement>>(session.FeedbackJson) ?? [];
            while (feedbackList.Count <= request.QuestionIndex) feedbackList.Add(JsonDocument.Parse("null").RootElement.Clone());
            feedbackList[request.QuestionIndex] = feedback;
            session.AnswersJson = JsonSerializer.Serialize(answers);
            session.FeedbackJson = JsonSerializer.Serialize(feedbackList);
            await db.SaveChangesAsync(ct);
            return Ok(new { feedback });
        }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (HttpRequestException ex) { return StatusCode(503, new { message = "Ollama is unavailable.", detail = ex.Message }); }
        catch (JsonException ex) { return BadRequest(new { message = "AI evaluation returned invalid JSON. Please retry.", detail = ex.Message }); }
    }

    [HttpPost("next-question")]
    public async Task<IActionResult> NextQuestion(NextQuestionRequest request, CancellationToken ct)
    {
        var session = await db.InterviewSessions.FindAsync([request.SessionId], ct);
        if (session is null) return NotFound(new { message = "Interview session not found." });

        var questions = JsonSerializer.Deserialize<List<string>>(session.QuestionsJson) ?? [];
        var answers = JsonSerializer.Deserialize<List<string>>(session.AnswersJson) ?? [];

        if (request.QuestionIndex < 0 || request.QuestionIndex >= questions.Count ||
            request.QuestionIndex >= answers.Count ||
            string.IsNullOrWhiteSpace(answers[request.QuestionIndex]))
            return BadRequest(new { message = "Submit an answer before requesting the next question." });

        // Keep sessions bounded. Eight initial questions plus four adaptive follow-ups.
        const int maxQuestions = 12;
        var nextIndex = request.QuestionIndex + 1;
        if (nextIndex >= maxQuestions)
            return Ok(new { completed = true, question = (string?)null, questionIndex = nextIndex });

        try
        {
            var history = Enumerable.Range(0, request.QuestionIndex + 1)
                .Where(i => i < answers.Count && !string.IsNullOrWhiteSpace(answers[i]))
                .Select(i => (Question: questions[i], Answer: answers[i]))
                .ToList();

            var nextQuestion = await service.GenerateFollowUpQuestionAsync(session.Role, history, ct);

            if (nextIndex < questions.Count)
                questions[nextIndex] = nextQuestion;
            else
                questions.Add(nextQuestion);

            session.QuestionsJson = JsonSerializer.Serialize(questions);
            await db.SaveChangesAsync(ct);

            return Ok(new { completed = false, question = nextQuestion, questionIndex = nextIndex, questions });
        }
        catch (HttpRequestException ex)
        {
            return StatusCode(503, new { message = "Ollama is unavailable.", detail = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }


    [HttpPost("{id:int}/livekit-token")]
    public async Task<IActionResult> CreateLiveKitToken(int id, CancellationToken ct)
    {
        var session = await db.InterviewSessions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (session is null) return NotFound(new { message = "Interview session not found." });

        // Use a non-identifying random participant identity; names and email addresses are not put in LiveKit logs.
        var identity = $"candidate-{Guid.NewGuid():N}";
        var roomName = $"talentra-interview-{session.Id}";
        try
        {
            var token = liveKit.CreateParticipantToken(roomName, identity);
            return Ok(new { serverUrl = liveKit.ServerUrl, token, roomName, identity, expiresInSeconds = 1800 });
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(503, new { message = ex.Message });
        }
    }

    [HttpGet("{id:int}") ]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        var session = await db.InterviewSessions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (session is null) return NotFound();
        return Ok(new { session.Id, session.Role, questions = JsonSerializer.Deserialize<List<string>>(session.QuestionsJson), answers = JsonSerializer.Deserialize<List<string>>(session.AnswersJson), feedback = JsonSerializer.Deserialize<JsonElement>(session.FeedbackJson), session.CreatedAtUtc });
    }
}
