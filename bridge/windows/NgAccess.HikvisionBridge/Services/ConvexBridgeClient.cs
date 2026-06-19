using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace NgAccess.HikvisionBridge.Services;

/// <summary>
/// Tek-yer modeli Convex istemcisi. Bridge token ile roster çeker (proje cihazları + işler)
/// ve işleri ack'ler. Kart-okutma event'leri ilgili cihazın per-device apiToken'ı ile
/// /card-reader'a basılır. Süreç-genel tek instance (PanelManager kurar).
/// </summary>
public sealed class ConvexBridgeClient
{
  // message=null gönderilmesin: Convex v.optional(v.string()) açık null'ı reddeder.
  private static readonly JsonSerializerOptions NullSkipping =
    new() { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

  private readonly HttpClient _http;
  private readonly string _bridgeToken;
  private readonly int _pollMax;
  private readonly ILogger _logger;

  public ConvexBridgeClient(HttpClient http, string siteUrl, string bridgeToken, int pollMax, ILogger logger)
  {
    _http = http;
    _bridgeToken = bridgeToken;
    _pollMax = pollMax;
    _logger = logger;
    if (!string.IsNullOrWhiteSpace(siteUrl))
    {
      _http.BaseAddress = new Uri(siteUrl.TrimEnd('/') + "/");
    }
  }

  public bool HasToken => !string.IsNullOrWhiteSpace(_bridgeToken);

  public async Task<RosterResponse> RosterAsync(CancellationToken cancellationToken)
  {
    if (!HasToken)
    {
      return new RosterResponse { Ok = false, Error = "bridge token boş" };
    }
    using var request = new HttpRequestMessage(HttpMethod.Post, "hik-bridge/roster");
    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _bridgeToken);
    request.Content = JsonContent.Create(new { max = Math.Clamp(_pollMax, 1, 25) });

    using var response = await _http.SendAsync(request, cancellationToken);
    if (!response.IsSuccessStatusCode)
    {
      return new RosterResponse { Ok = false, Error = $"roster HTTP {(int)response.StatusCode}" };
    }
    var body = await response.Content.ReadFromJsonAsync<RosterResponse>(cancellationToken: cancellationToken);
    return body ?? new RosterResponse { Ok = false, Error = "roster boş cevap" };
  }

  public async Task AckAsync(string opId, bool ok, string? message, CancellationToken cancellationToken)
  {
    using var request = new HttpRequestMessage(HttpMethod.Post, "hik-bridge/roster-ack");
    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _bridgeToken);
    request.Content = JsonContent.Create(new { opId, ok, message }, options: NullSkipping);

    using var response = await _http.SendAsync(request, cancellationToken);
    if (!response.IsSuccessStatusCode)
    {
      _logger.LogWarning("Ack failed for {OpId}: HTTP {Status}", opId, (int)response.StatusCode);
    }
  }

  /// <summary>Kart event'i — cihazın kendi apiToken'ı ile (bridge token DEĞİL).
  /// Başarı/başarısızlık döner ki çağıran (PanelWorker relay) geçici hatada retry edebilsin.</summary>
  public async Task<bool> PostCardReaderEventAsync(string deviceApiToken, CardReaderEventPayload payload, CancellationToken cancellationToken)
  {
    if (string.IsNullOrWhiteSpace(deviceApiToken))
    {
      _logger.LogWarning("Card event atlandı: cihaz apiToken boş");
      return false;
    }
    using var request = new HttpRequestMessage(HttpMethod.Post, "card-reader");
    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", deviceApiToken);
    request.Content = JsonContent.Create(payload);

    using var response = await _http.SendAsync(request, cancellationToken);
    if (!response.IsSuccessStatusCode)
    {
      _logger.LogWarning("Card event post failed: HTTP {Status}", (int)response.StatusCode);
      return false;
    }
    return true;
  }
}
