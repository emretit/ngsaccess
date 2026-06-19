using Microsoft.Extensions.Hosting.WindowsServices;
using NgAccess.HikvisionBridge;
using NgAccess.HikvisionBridge.Sdk;
using NgAccess.HikvisionBridge.Services;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.Configure<BridgeOptions>(builder.Configuration.GetSection("Bridge"));
builder.Services.Configure<LocalApiOptions>(builder.Configuration.GetSection("LocalApi"));

builder.Services.AddWindowsService(options =>
{
  options.ServiceName = "NGS Access Hikvision Bridge";
});

builder.Services.AddHttpClient();
builder.Services.AddSingleton<HikvisionSdkRuntime>();
builder.Services.AddSingleton<PanelConfigStore>();
builder.Services.AddSingleton<PanelManager>();
builder.Services.AddSingleton<LocalConfigServer>();
builder.Services.AddHostedService<BridgeWorker>();

if (WindowsServiceHelpers.IsWindowsService())
{
  Directory.SetCurrentDirectory(AppContext.BaseDirectory);
}

var host = builder.Build();
await host.RunAsync();
