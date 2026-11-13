//using AIInterview.API.Data;
//using AIInterview.API.DTOs;
//using AIInterview.API.Models;
//using AIInterview.API.Services;
//using Microsoft.AspNetCore.Mvc;
//using System.Text.Json;
//namespace AIInterview.API.Controllers;
//[ApiController]
//[Route("api/resumes")]
//public class ResumeController(AppDbContext db, ResumeTextExtractor extractor, ResumeAnalysisService analyzer) : ControllerBase
//{
//    [HttpPost("upload")]
//    [Consumes("multipart/form-data")]
//    [RequestSizeLimit(10_000_000)]
//    public async Task<IActionResult> Upload([FromForm] ResumeUploadRequest request, CancellationToken ct)
//    {
//        var file = request.File;

//        if (file == null || file.Length == 0)
//            return BadRequest(new { message = "Please upload a CV." });

//        try
//        {
//            var text = await extractor.ExtractAsync(file, ct);
//            var analysis = await analyzer.AnalyzeAsync(text, ct);
//            var record = new ResumeRecord { FileName = Path.GetFileName(file.FileName), CandidateName = analysis.CandidateName, ExtractedText = text, AnalysisJson = JsonSerializer.Serialize(analysis) };
//            db.Resumes.Add(record);
//            await db.SaveChangesAsync(ct);
//            return Ok(new { record.Id, record.FileName, record.CandidateName, analysis, record.UploadedAtUtc });
//        }
//        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
//        catch (HttpRequestException ex) { return StatusCode(503, new { message = "Could not reach Ollama. Check that Ollama is running and phi3:mini is installed.", detail = ex.Message }); }
//        catch (JsonException ex) { return BadRequest(new { message = "The AI response could not be read. Please retry.", detail = ex.Message }); }
//    }
//}

using AIInterview.API.Data;
using AIInterview.API.DTOs;
using AIInterview.API.Models;
using AIInterview.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace AIInterview.API.Controllers;

[ApiController]
[Route("api/resumes")]
public class ResumeController(
    AppDbContext db,
    ResumeTextExtractor extractor,
    ResumeAnalysisService analyzer,
    ILogger<ResumeController> logger) : ControllerBase
{
    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> Upload(
        [FromForm] ResumeUploadRequest request,
        CancellationToken ct)
    {
        var file = request.File;

        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Please upload a CV." });

        try
        {
            var text = await extractor.ExtractAsync(file, ct);

            if (string.IsNullOrWhiteSpace(text))
                return BadRequest(new { message = "No readable text found in the CV." });

            if (text.Length > 10000)
                text = text[..10000];

            var analysis = await analyzer.AnalyzeAsync(text, ct);

            var record = new ResumeRecord
            {
                FileName = Path.GetFileName(file.FileName),
                CandidateName = analysis.CandidateName,
                ExtractedText = text,
                AnalysisJson = JsonSerializer.Serialize(analysis)
            };

            db.Resumes.Add(record);
            await db.SaveChangesAsync(ct);

            return Ok(new
            {
                record.Id,
                record.FileName,
                record.CandidateName,
                analysis,
                record.UploadedAtUtc
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            logger.LogError(ex, "Ollama connection failed.");

            return StatusCode(503, new
            {
                message = "Could not reach Ollama. Check that Ollama is running."
            });
        }
        catch (JsonException ex)
        {
            logger.LogError(ex, "Resume AI analysis returned invalid JSON.");

            return StatusCode(502, new
            {
                message = "AI returned incomplete or invalid JSON. Please retry."
            });
        }
        catch (OperationCanceledException ex) when (!ct.IsCancellationRequested)
        {
            logger.LogError(ex, "Resume analysis timed out.");

            return StatusCode(504, new
            {
                message = "AI analysis took too long. Please try again."
            });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Resume upload failed.");

            return StatusCode(500, new
            {
                message = "An unexpected error occurred during resume analysis."
            });
        }
    }
}