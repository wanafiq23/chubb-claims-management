using Chubb.Api;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
namespace Chubb.Api.Tests;

public sealed class FakePublisher : IEventPublisher
{
    public bool Fail { get; set; }
    public List<(long Sequence, Guid EventId, string Payload)> Delivered { get; } = [];
    public Task Publish(OutboxMessage message, CancellationToken ct)
    {
        if (Fail) throw new IOException("Simulated broker outage");
        Delivered.Add((message.Sequence, message.EventId, message.Payload));
        return Task.CompletedTask;
    }
}

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public string DatabasePath { get; } = Path.Combine(Path.GetTempPath(), $"chubb-test-{Guid.NewGuid()}.db");
    public FakePublisher Publisher { get; } = new();
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, c) => c.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Claims"] = $"Data Source={DatabasePath};Pooling=False;Default Timeout=5",
            ["DemoAuth:Enabled"] = "true", ["Kafka:Enabled"] = "false",
            ["Logging:LogLevel:Default"] = "Warning"
        }));
        builder.ConfigureServices(s =>
        {
            s.RemoveAll<IEventPublisher>();
            s.AddSingleton<IEventPublisher>(Publisher);
        });
    }
    public HttpClient Client(string? token = "customer-alice")
    {
        var client = CreateClient();
        if (token != null) client.DefaultRequestHeaders.Authorization = new("Bearer", token);
        return client;
    }
    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
            foreach (var suffix in new[] { "", "-wal", "-shm" }) File.Delete(DatabasePath + suffix);
    }
}
