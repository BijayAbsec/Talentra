using AIInterview.API.Data;
using AIInterview.API.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(options => options.AddPolicy("Frontend", policy =>
    policy.WithOrigins(builder.Configuration.GetSection("Frontend:AllowedOrigins").Get<string[]>() ?? ["http://localhost:5173"])
        .AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
// ResponseHeadersRead is used by OllamaService so this timeout covers connection
// and response headers, not the full streamed model generation.
var ollamaTimeoutSeconds = builder.Configuration.GetValue("Ollama:HttpTimeoutSeconds", 600);
builder.Services.AddHttpClient<OllamaService>(client =>
    client.Timeout = TimeSpan.FromSeconds(ollamaTimeoutSeconds));
builder.Services.AddScoped<ResumeTextExtractor>();
builder.Services.AddScoped<ResumeAnalysisService>();
builder.Services.AddScoped<InterviewService>();
builder.Services.AddScoped<LiveKitTokenService>();

var app = builder.Build();
app.UseCors("Frontend");
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.MapControllers();
app.Run();
