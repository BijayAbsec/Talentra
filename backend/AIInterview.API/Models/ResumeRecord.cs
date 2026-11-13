namespace AIInterview.API.Models;
public class ResumeRecord
{
    public int Id { get; set; }
    public string FileName { get; set; } = "";
    public string CandidateName { get; set; } = "Candidate";
    public string ExtractedText { get; set; } = "";
    public string AnalysisJson { get; set; } = "{}";
    public DateTime UploadedAtUtc { get; set; } = DateTime.UtcNow;
}
