namespace AIInterview.API.DTOs;
public class ResumeAnalysisDto
{
    public string CandidateName { get; set; } = "Candidate";
    public string ProfessionalSummary { get; set; } = "";
    public int? TotalExperienceYears { get; set; }
    public List<string> TechnicalSkills { get; set; } = [];
    public Dictionary<string, List<string>> SkillCategories { get; set; } = new();
    public List<WorkExperienceDto> WorkExperience { get; set; } = [];
    public List<ProjectDto> Projects { get; set; } = [];
    public List<string> Strengths { get; set; } = [];
    public List<string> SkillGaps { get; set; } = [];
    public List<string> SuggestedInterviewTopics { get; set; } = [];
}
public class WorkExperienceDto
{
    public string Company { get; set; } = "";
    public string JobTitle { get; set; } = "";
    public string Duration { get; set; } = "";
    public List<string> Responsibilities { get; set; } = [];
}
public class ProjectDto
{
    public string ProjectName { get; set; } = "";
    public string Description { get; set; } = "";
    public List<string> Technologies { get; set; } = [];
}
