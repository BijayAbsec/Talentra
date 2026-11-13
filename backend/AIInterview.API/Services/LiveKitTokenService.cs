using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace AIInterview.API.Services;

/// <summary>Creates short-lived LiveKit participant JWTs. API secrets never leave the server.</summary>
public sealed class LiveKitTokenService(IConfiguration configuration)
{
    public string ServerUrl => configuration["LiveKit:Url"] ?? string.Empty;

    public string CreateParticipantToken(string roomName, string identity, TimeSpan? lifetime = null)
    {
        var apiKey = configuration["LiveKit:ApiKey"];
        var apiSecret = configuration["LiveKit:ApiSecret"];
        if (string.IsNullOrWhiteSpace(ServerUrl) || string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(apiSecret))
            throw new InvalidOperationException("LiveKit is not configured. Set LiveKit:Url, LiveKit:ApiKey and LiveKit:ApiSecret.");

        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var header = new { alg = "HS256", typ = "JWT" };
        var payload = new
        {
            iss = apiKey,
            sub = identity,
            nbf = now - 5,
            exp = now + (long)(lifetime ?? TimeSpan.FromMinutes(30)).TotalSeconds,
            video = new
            {
                room = roomName,
                roomJoin = true,
                canPublish = true,
                canSubscribe = true,
                canPublishData = true
            }
        };

        var encodedHeader = Base64Url(JsonSerializer.SerializeToUtf8Bytes(header));
        var encodedPayload = Base64Url(JsonSerializer.SerializeToUtf8Bytes(payload));
        var unsigned = $"{encodedHeader}.{encodedPayload}";
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(apiSecret));
        var signature = Base64Url(hmac.ComputeHash(Encoding.UTF8.GetBytes(unsigned)));
        return $"{unsigned}.{signature}";
    }

    private static string Base64Url(byte[] bytes) => Convert.ToBase64String(bytes)
        .TrimEnd('=')
        .Replace('+', '-')
        .Replace('/', '_');
}
