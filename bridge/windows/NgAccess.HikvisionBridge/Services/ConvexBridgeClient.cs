using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace NgAccess.HikvisionBridge.Services;

/// <summary>
/// Tek panel için Convex istemcisi: o panelin device token'ı ile poll/ack/event yapar.
/// Panel başına bir instance (PanelManager kurar); singleton DEĞİL.
/// </summary>
public sealed class ConvexBridgeClient
{
  private readonly HttpClient _http;
  private readonly string _token;
  private readonly int _pollMax;
  private readonly ILogger _logger;

  public ConvexBridgeClient(HttpClient http, string siteUrl, string token, int pollMax, ILogger logger)
  {
    _http = http;
    _token = token;
    _pollMax = pollMax;
    _logger = logger;
    if (!string.IsNullOrWhiteSpace(siteUrl))
    {
      _http.BaseAddress = new Uri(siteUrl.TrimEnd('/') + "/");
    }
  }

  public async Task<BridgePollResponse> PollAsync(CancellationToken cancellationToken)
  {
    if (string.IsNullOrWhiteSpace(_token))
    {
      return new BridgePollResponse { Ok = false, Error = "device token empty" };
    }
    using var request = new HttpRequestMessage(HttpMethod.Post, "hik-bridge/poll");
    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _token);
    request.Content = JsonContent.Create(new { max = Math.Clamp(_pollMax, 1, 25) });

    using var response = await _http.SendAsync(request, cancellationToken);
    var body = await response.Content.ReadFromJsonAsync<BridgePollResponse>(cancellationToken: cancellationToken);
    if (!response.IsSuccessStatusCode || body is null)
    {
      return new BridgePollResponse { Ok = false, Error = $"poll HTTP {(int)response.StatusCode}" };
    }
    return body;
  }

  public async Task AckAsync(string opId, bool ok, string? message, CancellationToken cancellationToken)
  {
    using var request = new HttpRequestMessage(HttpMethod.Post, "hik-bridge/ack");
    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _token);
    request.Content = JsonContent.Create(new { opId, ok, message });

    using var response = await _http.SendAsync(request, cancellationToken);
    if (!response.IsSuccessStatusCode)
    {
      _logger.LogWarning("Ack failed for {OpId}: HTTP {Status}", opId, (int)response.StatusCode);
    }
  }

  public async Task PostCardReaderEventAsync(CardReaderEventPayload payload, CancellationToken cancellationToken)
  {
    using var request = new HttpRequestMessage(HttpMethod.Post, "card-reader");
    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _token);
    request.Content = JsonContent.Create(payload);

    using var response = await _http.SendAsync(request, cancellationToken);
    if (!response.IsSuccessStatusCode)
    {
      _logger.LogWarning("Card event post failed: HTTP {Status}", (int)response.StatusCode);
    }
  }
}
