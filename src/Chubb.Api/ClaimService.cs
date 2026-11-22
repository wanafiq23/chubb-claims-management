using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace Chubb.Api;

public class ApiException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}

public class ClaimService(ClaimsDb db)
{
    public IQueryable<Claim> Full => db.Claims.Include(c => c.Documents).Include(c => c.InformationRequests).Include(c => c.History).AsSplitQuery();
    public async Task<Claim> Get(Guid id, ClaimsPrincipal user, CancellationToken ct)
    {
        var c = await Full.SingleOrDefaultAsync(c => c.Id == id, ct);
        if (c is null || (user.IsInRole("Customer") && c.CustomerId != user.FindFirstValue(ClaimTypes.NameIdentifier)))
            throw new ApiException(404, "Claim not found.");
        return c;
    }

    public static void Match(Claim c, HttpRequest request)
    {
        var header = request.Headers.IfMatch.ToString();
        if (string.IsNullOrEmpty(header)) throw new ApiException(428, "Supply the current quoted claim version in If-Match.");
        if (header != $"\"{c.Version}\"") throw new ApiException(412, "Claim changed. Reload and retry with its new version.");
    }
    public static void RequireStatus(Claim c, params ClaimStatus[] allowed)
    {
        if (!allowed.Contains(c.Status)) throw new ApiException(409, $"Action is not valid while claim is {c.Status}.");
    }
    public static string RequiredText(string? text, string field, int max = 4000)
    {
        if (string.IsNullOrWhiteSpace(text) || text.Trim().Length > max)
            throw new ApiException(400, $"{field} must contain 1–{max} characters.");
        return text.Trim();
    }
    public static long Money(decimal value, bool allowZero = false)
    {
        if (value < (allowZero ? 0 : 0.01m) || value > 1_000_000_000m || decimal.Round(value, 2) != value)
            throw new ApiException(400, "Amount must be within the allowed range (0.01–1,000,000,000 MYR; estimates may be zero), with at most two decimal places.");
        return (long)(value * 100);
    }

    public async Task Save(Claim c, string action, CancellationToken ct)
    {
        c.Version = Guid.NewGuid();
        var now = DateTime.UtcNow;
        c.History.Add(new HistoryEntry { Action = action, Status = c.Status, OccurredAt = now });
        var message = new OutboxMessage { ClaimId = c.Id, CreatedAt = now };
        message.Payload = JsonSerializer.Serialize(new
        {
            eventId = message.EventId, schemaVersion = 1, eventType = action,
            claimId = c.Id, claimVersion = c.Version, occurredAt = now, currency = "MYR",
            claimType = c.Type.ToString(), status = c.Status.ToString()
        });
        db.Outbox.Add(message);
        // EF wraps all changed entities in a single database transaction.
        await db.SaveChangesAsync(ct);
    }
}
