using System.Text.Json.Serialization;
namespace Chubb.Api;

public record Submission([property: JsonRequired] ClaimType Type, [property: JsonRequired] DateTime IncidentAt,
    [property: JsonRequired] string IncidentDetails, [property: JsonRequired] decimal ClaimedAmount);
public record EstimateInput([property: JsonRequired] decimal EstimatedLiability);
public record RequestInput([property: JsonRequired] string Question);
public record DecisionInput([property: JsonRequired] ClaimStatus Decision, [property: JsonRequired] string Reason);

public record DocumentView(Guid Id, string FileName, string ContentType, int Size, Guid? InformationRequestId, DateTime UploadedAt);
public record RequestView(Guid Id, string Question, DateTime RequestedAt, string? Reply, DateTime? RepliedAt);
public record HistoryView(string Action, ClaimStatus Status, DateTime OccurredAt);
public record CustomerClaimView(Guid Id, ClaimType Type, string IncidentDetails, DateTime IncidentAt,
    decimal ClaimedAmount, string Currency, ClaimStatus Status, Guid Version, DateTime SubmittedAt,
    DateTime? CompletedAt, string? DecisionReason, DocumentView[] Documents, RequestView[] InformationRequests, HistoryView[] History);
public record InternalClaimView(CustomerClaimView Claim, string CustomerId, decimal? EstimatedLiability);

public static class Views
{
    public static CustomerClaimView Customer(Claim c) => new(c.Id, c.Type, c.IncidentDetails, c.IncidentAt,
        c.ClaimedAmountSen / 100m, "MYR", c.Status, c.Version, c.SubmittedAt, c.CompletedAt, c.DecisionReason,
        c.Documents.OrderBy(d => d.UploadedAt).Select(d => new DocumentView(d.Id, d.FileName, d.ContentType, d.Content.Length, d.InformationRequestId, d.UploadedAt)).ToArray(),
        c.InformationRequests.OrderBy(r => r.RequestedAt).Select(r => new RequestView(r.Id, r.Question, r.RequestedAt, r.Reply, r.RepliedAt)).ToArray(),
        c.History.OrderBy(h => h.Id).Select(h => new HistoryView(h.Action, h.Status, h.OccurredAt)).ToArray());
    public static InternalClaimView Internal(Claim c) => new(Customer(c), c.CustomerId, c.EstimatedLiabilitySen / 100m);
}
