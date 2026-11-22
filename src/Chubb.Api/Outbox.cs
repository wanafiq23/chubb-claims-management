using Confluent.Kafka;
using Microsoft.EntityFrameworkCore;
namespace Chubb.Api;

public interface IEventPublisher { Task Publish(OutboxMessage message, CancellationToken ct); }
public sealed class KafkaEventPublisher : IEventPublisher, IDisposable
{
    readonly IProducer<string, string> producer;
    readonly string topic;
    public KafkaEventPublisher(IConfiguration config)
    {
        topic = config["Kafka:Topic"] ?? "chubb.claims.lifecycle.v1";
        producer = new ProducerBuilder<string, string>(new ProducerConfig
        {
            BootstrapServers = config["Kafka:BootstrapServers"] ?? "localhost:9092",
            EnableIdempotence = true, Acks = Acks.All, MessageTimeoutMs = 5000,
            SocketTimeoutMs = 5000, AllowAutoCreateTopics = false
        }).Build();
    }
    public async Task Publish(OutboxMessage message, CancellationToken ct) =>
        await producer.ProduceAsync(topic, new Message<string, string> { Key = message.ClaimId.ToString(), Value = message.Payload }, ct);
    public void Dispose() => producer.Dispose();
}

// One dispatcher; run exactly one API replica for this SQLite MVP.
public class OutboxDispatcher(ClaimsDb db, IEventPublisher publisher, ILogger<OutboxDispatcher> logger)
{
    public async Task<int> Dispatch(CancellationToken ct)
    {
        var batch = await db.Outbox.Where(o => o.PublishedAt == null).OrderBy(o => o.Sequence).Take(50).ToListAsync(ct);
        var sent = 0;
        foreach (var message in batch)
        {
            message.Attempts++;
            try
            {
                await publisher.Publish(message, ct);
                message.PublishedAt = DateTime.UtcNow;
                message.LastError = null;
                await db.SaveChangesAsync(ct);
                sent++;
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
            catch (Exception ex)
            {
                message.LastError = ex.GetType().Name;
                await db.SaveChangesAsync(ct);
                logger.LogWarning(ex, "Outbox delivery failed for event {EventId}; will retry", message.EventId);
                break;
            }
        }
        return sent;
    }
}
public class OutboxWorker(IServiceScopeFactory scopes, IConfiguration config, ILogger<OutboxWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!config.GetValue<bool>("Kafka:Enabled")) return;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<OutboxDispatcher>().Dispatch(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "Outbox dispatcher failed; retrying"); }
            try { await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
}
