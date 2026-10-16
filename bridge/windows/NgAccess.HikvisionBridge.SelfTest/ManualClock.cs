// Ağ ve SDK kullanmadan uzun beklemeleri deterministik olarak ilerletir.
sealed class ManualClock : TimeProvider
{
  private readonly object _lock = new();
  private readonly List<ClockTimer> _timers = [];
  private long _ticks;
  public override long TimestampFrequency => TimeSpan.TicksPerSecond;
  public override long GetTimestamp() { lock (_lock) return _ticks; }
  public override DateTimeOffset GetUtcNow() => DateTimeOffset.UnixEpoch.AddTicks(GetTimestamp());
  public int PendingTimers { get { lock (_lock) return _timers.Count(t => t.Due is not null); } }
  public override ITimer CreateTimer(TimerCallback callback, object? state, TimeSpan dueTime, TimeSpan period)
  {
    var timer = new ClockTimer(this, callback, state);
    lock (_lock) _timers.Add(timer);
    timer.Change(dueTime, period);
    return timer;
  }
  public void Advance(TimeSpan duration)
  {
    List<ClockTimer> due;
    lock (_lock)
    {
      _ticks += duration.Ticks;
      due = _timers.Where(t => t.Due <= _ticks).ToList();
      foreach (var timer in due) timer.Due = timer.Period > TimeSpan.Zero ? _ticks + timer.Period.Ticks : null;
    }
    foreach (var timer in due) timer.Fire();
  }
  private sealed class ClockTimer(ManualClock owner, TimerCallback callback, object? state) : ITimer
  {
    public long? Due { get; set; }
    public TimeSpan Period { get; private set; }
    private bool _disposed;
    public bool Change(TimeSpan dueTime, TimeSpan period)
    {
      lock (owner._lock)
      {
        if (_disposed) return false;
        Due = dueTime == Timeout.InfiniteTimeSpan ? null : owner._ticks + dueTime.Ticks;
        Period = period;
        return true;
      }
    }
    public void Fire() { if (!_disposed) callback(state); }
    public void Dispose() { lock (owner._lock) { _disposed = true; Due = null; owner._timers.Remove(this); } }
    public ValueTask DisposeAsync() { Dispose(); return ValueTask.CompletedTask; }
  }
}
