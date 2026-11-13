using System.Net.Http.Json;
using System.Text.Json;
namespace AIInterview.API.Services;

public class OllamaService(HttpClient http, IConfiguration configuration)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    public async Task<string> GenerateAsync(string prompt, CancellationToken ct)
    {
        var baseUrl = (configuration["Ollama:BaseUrl"] ?? "http://localhost:11434").TrimEnd('/');
        var model = configuration["Ollama:Model"] ?? "phi3:mini";
        var payload = new
        {
            model,
            prompt,
            // Ask Ollama to produce syntactically valid JSON rather than relying
            // only on the prompt. This is especially important for arrays of strings.
            format = "json",
            // Streaming prevents HttpClient from buffering the complete model response
            // before returning. This is important when Ollama has to load the model.
            stream = true,
            keep_alive = "10m",
            options = new
            {
                temperature = 0.1,
                num_predict = 700
            }
        };


        using var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/api/generate")
        {
            Content = JsonContent.Create(payload)
        };
        using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        response.EnsureSuccessStatusCode();

        await using var responseStream = await response.Content.ReadAsStreamAsync(ct);
        using var reader = new StreamReader(responseStream);
        var result = new System.Text.StringBuilder();

        string? line;
        while ((line = await reader.ReadLineAsync(ct)) is not null)
        {
            if (string.IsNullOrWhiteSpace(line))
                continue;

            using var chunk = JsonDocument.Parse(line);
            var root = chunk.RootElement;
            if (root.TryGetProperty("error", out var error))
                throw new HttpRequestException($"Ollama returned an error: {error.GetString()}");

            if (root.TryGetProperty("response", out var responsePart))
                result.Append(responsePart.GetString() ?? string.Empty);
        }

        return result.ToString();
    }
}
