using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Chubb.Api;

public enum ClaimType { Motor, Property }
public enum ClaimStatus { Submitted, UnderReview, AwaitingInformation, Approved, Rejected }

public class Claim
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string CustomerId { get; set; } = "";
    public ClaimType Type { get; set; }
    public string IncidentDetails { get; set; } = "";
    public DateTime IncidentAt { get; set; }
    public long ClaimedAmountSen { get; set; }
    public long? EstimatedLiabilitySen { get; set; }
    public ClaimStatus Status { get; set; } = ClaimStatus.Submitted;
    public Guid Version { get; set; } = Guid.NewGuid();
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
    public string? DecisionReason { get; set; }
    public List<ClaimDocument> Documents { get; set; } = [];
    public List<InformationRequest> InformationRequests { get; set; } = [];
    public List<HistoryEntry> History { get; set; } = [];
}

public class ClaimDocument
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ClaimId { get; set; }
    public Guid? InformationRequestId { get; set; }
    public string FileName { get; set; } = "";
    public string ContentType { get; set; } = "";
    public byte[] Content { get; set; } = [];
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}

public class InformationRequest
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ClaimId { get; set; }
    public string Question { get; set; } = "";
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    public string? Reply { get; set; }
    public DateTime? RepliedAt { get; set; }
}

public class HistoryEntry
{
    public long Id { get; set; }
    public Guid ClaimId { get; set; }
    public string Action { get; set; } = "";
    public ClaimStatus Status { get; set; }
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
    // No internal amounts or staff identities in customer-visible history.
}

public class OutboxMessage
{
    public long Sequence { get; set; }
    public Guid EventId { get; set; } = Guid.NewGuid();
    public Guid ClaimId { get; set; }
    public string Payload { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PublishedAt { get; set; }
    public int Attempts { get; set; }
    public string? LastError { get; set; }
}

public class ClaimsDb(DbContextOptions<ClaimsDb> options) : DbContext(options)
{
    public DbSet<Claim> Claims => Set<Claim>();
    public DbSet<ClaimDocument> Documents => Set<ClaimDocument>();
    public DbSet<OutboxMessage> Outbox => Set<OutboxMessage>();
    protected override void OnModelCreating(ModelBuilder b)
    {
        // IDs are allocated by the application before graph tracking, including new children.
        b.Entity<Claim>().Property(c => c.Id).ValueGeneratedNever();
        b.Entity<ClaimDocument>().Property(d => d.Id).ValueGeneratedNever();
        b.Entity<InformationRequest>().Property(r => r.Id).ValueGeneratedNever();
        b.Entity<Claim>().Property(c => c.Version).IsConcurrencyToken();
        b.Entity<Claim>().HasIndex(c => new { c.CustomerId, c.SubmittedAt });
        b.Entity<Claim>().HasIndex(c => c.Status);
        b.Entity<Claim>().HasMany(c => c.Documents).WithOne().HasForeignKey(d => d.ClaimId);
        b.Entity<Claim>().HasMany(c => c.InformationRequests).WithOne().HasForeignKey(r => r.ClaimId);
        b.Entity<Claim>().HasMany(c => c.History).WithOne().HasForeignKey(h => h.ClaimId);
        b.Entity<ClaimDocument>().HasOne<InformationRequest>().WithMany().HasForeignKey(d => d.InformationRequestId);
        b.Entity<OutboxMessage>().HasKey(o => o.Sequence);
        b.Entity<OutboxMessage>().HasIndex(o => o.EventId).IsUnique();
        b.Entity<OutboxMessage>().HasIndex(o => new { o.PublishedAt, o.Sequence });
        // SQLite does not preserve DateTime.Kind. Restore UTC on every database read.
        var utc = new ValueConverter<DateTime, DateTime>(v => v, v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
        foreach (var property in b.Model.GetEntityTypes().SelectMany(e => e.GetProperties()))
            if (property.ClrType == typeof(DateTime) || property.ClrType == typeof(DateTime?))
                property.SetValueConverter(utc);
    }
}
