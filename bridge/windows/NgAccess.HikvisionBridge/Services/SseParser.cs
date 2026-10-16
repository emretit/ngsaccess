using System.Globalization;
using System.Text;

namespace NgAccess.HikvisionBridge.Services;

public sealed record SseEvent(string Event, string Data);

/// <summary>Satırları işler; bağlantı, saat veya ağ durumuna bağımlı değildir.</summary>
public sealed class SseParser
{
  private string _event = "";
  private readonly StringBuilder _data = new();
  public int? RetryMilliseconds { get; private set; }
  public bool IsComment { get; private set; }

  public SseEvent? ProcessLine(string line)
  {
    line = line.TrimEnd('\r');
    IsComment = line.StartsWith(':');
    if (IsComment) return null;
    if (line.Length == 0)
    {
      var result = _data.Length > 0 && _event is "wake" or "ready"
        ? new SseEvent(_event, _data.ToString(0, _data.Length - 1)) : null;
      _event = "";
      _data.Clear();
      return result;
    }
    var colon = line.IndexOf(':');
    var field = colon < 0 ? line : line[..colon];
    var value = colon < 0 ? "" : line[(colon + 1)..];
    if (value.StartsWith(' ')) value = value[1..];
    switch (field)
    {
      case "event": _event = value; break;
      case "data":
        if (_data.Length + value.Length > 65536) throw new InvalidDataException("SSE olayı çok büyük");
        _data.Append(value).Append('\n');
        break;
      case "retry":
        if (int.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out var retry))
          RetryMilliseconds = retry;
        break;
    }
    return null;
  }
}
