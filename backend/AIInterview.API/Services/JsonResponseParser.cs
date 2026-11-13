using System.Text.Json;
namespace AIInterview.API.Services;
internal static class JsonResponseParser
{
    public static string ExtractJson(string output, char open, char close)
    {
        if (string.IsNullOrWhiteSpace(output))
            throw new InvalidOperationException("The local AI model returned an empty response. Please try again.");

        var clean = output.Replace("```json", "", StringComparison.OrdinalIgnoreCase).Replace("```", "").Trim();
        var start = clean.IndexOf(open);
        var end = clean.LastIndexOf(close);
        if (start < 0 || end <= start) throw new InvalidOperationException("The local AI model returned an unexpected response. Please try again.");
        return clean[start..(end + 1)];
    }
}
