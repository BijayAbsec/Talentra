namespace AIInterview.API.Models;
public class InterviewSession
{
    public int Id { get; set; }
    public int ResumeRecordId { get; set; }
    public string Role { get; set; } = "Senior .NET Developer";
    public string QuestionsJson { get; set; } = "[]";
    public string AnswersJson { get; set; } = "[]";
    public string FeedbackJson { get; set; } = "[]";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
