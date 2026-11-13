using Microsoft.AspNetCore.Http;
using System.ComponentModel.DataAnnotations;

namespace AIInterview.API.DTOs;

public class ResumeUploadRequest
{
    [Required]
    public IFormFile File { get; set; } = null!;
}
