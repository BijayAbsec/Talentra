using AIInterview.API.Models;
using Microsoft.EntityFrameworkCore;
namespace AIInterview.API.Data;
public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<ResumeRecord> Resumes => Set<ResumeRecord>();
    public DbSet<InterviewSession> InterviewSessions => Set<InterviewSession>();
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ResumeRecord>().Property(x => x.ExtractedText).HasColumnType("nvarchar(max)");
        modelBuilder.Entity<ResumeRecord>().Property(x => x.AnalysisJson).HasColumnType("nvarchar(max)");
        modelBuilder.Entity<InterviewSession>().Property(x => x.QuestionsJson).HasColumnType("nvarchar(max)");
        modelBuilder.Entity<InterviewSession>().Property(x => x.AnswersJson).HasColumnType("nvarchar(max)");
        modelBuilder.Entity<InterviewSession>().Property(x => x.FeedbackJson).HasColumnType("nvarchar(max)");
        modelBuilder.Entity<InterviewSession>().HasOne<ResumeRecord>().WithMany().HasForeignKey(x => x.ResumeRecordId).OnDelete(DeleteBehavior.Cascade);
    }
}
