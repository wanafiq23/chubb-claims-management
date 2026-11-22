using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Chubb.Api;

[ApiController, Route("api/claims"), Authorize(Roles = "Customer,Staff,Manager")]
public class ClaimsController(ClaimsDb db, ClaimService service) : ControllerBase
{
    object View(Claim c) => User.IsInRole("Customer") ? Views.Customer(c) : Views.Internal(c);
    IActionResult WithVersion(Claim c)
    {
        Response.Headers.ETag = $"\"{c.Version}\"";
        return Ok(View(c));
    }

    [HttpPost, Authorize(Roles = "Customer")]
    public async Task<IActionResult> Submit(Submission input, CancellationToken ct)
    {
        if (!Enum.IsDefined(input.Type)) throw new ApiException(400, "Type must be Motor or Property.");
        if (input.IncidentAt.Kind != DateTimeKind.Utc || input.IncidentAt < new DateTime(1900, 1, 1) || input.IncidentAt > DateTime.UtcNow)
            throw new ApiException(400, "IncidentAt must be a UTC date from 1900 through now (use Z suffix).");
        var c = new Claim
        {
            CustomerId = User.FindFirstValue(ClaimTypes.NameIdentifier)!, Type = input.Type,
            IncidentAt = input.IncidentAt, IncidentDetails = ClaimService.RequiredText(input.IncidentDetails, "Incident details"),
            ClaimedAmountSen = ClaimService.Money(input.ClaimedAmount)
        };
        db.Claims.Add(c);
        await service.Save(c, "ClaimSubmitted", ct);
        Response.Headers.ETag = $"\"{c.Version}\"";
        return CreatedAtAction(nameof(Get), new { id = c.Id }, Views.Customer(c));
    }

    [HttpGet, Authorize(Roles = "Customer")]
    public async Task<IActionResult> Mine(CancellationToken ct, int page = 1, int pageSize = 20)
    {
        ValidatePage(page, pageSize);
        var query = service.Full.Where(c => c.CustomerId == User.FindFirstValue(ClaimTypes.NameIdentifier));
        var total = await query.CountAsync(ct);
        var claims = await query.OrderByDescending(c => c.SubmittedAt).ThenBy(c => c.Id).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return Ok(new { total, page, pageSize, items = claims.Select(Views.Customer) });
    }
    public static void ValidatePage(int page, int size)
    {
        if (page < 1 || page > 100000 || size < 1 || size > 100) throw new ApiException(400, "page must be 1–100000; pageSize must be 1–100.");
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct) => WithVersion(await service.Get(id, User, ct));

    [HttpPost("{id:guid}/documents"), Authorize(Roles = "Customer")]
    [RequestSizeLimit(27 * 1024 * 1024)]
    public async Task<IActionResult> Upload(Guid id, CancellationToken ct)
    {
        var c = await service.Get(id, User, ct);
        ClaimService.Match(c, Request);
        ClaimService.RequireStatus(c, ClaimStatus.Submitted);
        if (!Request.HasFormContentType) throw new ApiException(415, "Use multipart/form-data.");
        var form = await Request.ReadFormAsync(ct);
        var docs = await Uploads.Read(form.Files, c.Id, null, ct);
        if (docs.Count == 0) throw new ApiException(400, "At least one file is required.");
        CheckDocumentLimit(c, docs.Count);
        c.Documents.AddRange(docs);
        await service.Save(c, "DocumentsAdded", ct);
        return WithVersion(c);
    }
    static void CheckDocumentLimit(Claim c, int additional)
    {
        if (c.Documents.Count + additional > 20) throw new ApiException(400, "At most 20 documents per claim.");
    }

    [HttpGet("{id:guid}/documents/{documentId:guid}")]
    public async Task<IActionResult> Download(Guid id, Guid documentId, CancellationToken ct)
    {
        var c = await service.Get(id, User, ct);
        var d = c.Documents.SingleOrDefault(d => d.Id == documentId) ?? throw new ApiException(404, "Document not found.");
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        return File(d.Content, d.ContentType, d.FileName);
    }

    [HttpPost("{id:guid}/review"), Authorize(Roles = "Staff")]
    public async Task<IActionResult> Review(Guid id, CancellationToken ct)
    {
        var c = await service.Get(id, User, ct);
        ClaimService.Match(c, Request);
        ClaimService.RequireStatus(c, ClaimStatus.Submitted);
        c.Status = ClaimStatus.UnderReview;
        await service.Save(c, "ReviewStarted", ct);
        return WithVersion(c);
    }

    [HttpPut("{id:guid}/estimate"), Authorize(Roles = "Staff")]
    public async Task<IActionResult> Estimate(Guid id, EstimateInput input, CancellationToken ct)
    {
        var c = await service.Get(id, User, ct);
        ClaimService.Match(c, Request);
        ClaimService.RequireStatus(c, ClaimStatus.UnderReview, ClaimStatus.AwaitingInformation);
        c.EstimatedLiabilitySen = ClaimService.Money(input.EstimatedLiability, true);
        await service.Save(c, "LiabilityEstimated", ct);
        return WithVersion(c);
    }

    [HttpPost("{id:guid}/information-requests"), Authorize(Roles = "Staff")]
    public async Task<IActionResult> RequestInformation(Guid id, RequestInput input, CancellationToken ct)
    {
        var c = await service.Get(id, User, ct);
        ClaimService.Match(c, Request);
        ClaimService.RequireStatus(c, ClaimStatus.UnderReview);
        c.InformationRequests.Add(new InformationRequest { Question = ClaimService.RequiredText(input.Question, "Question"), ClaimId = c.Id });
        c.Status = ClaimStatus.AwaitingInformation;
        await service.Save(c, "InformationRequested", ct);
        return WithVersion(c);
    }

    [HttpPost("{id:guid}/information-requests/{requestId:guid}/reply"), Authorize(Roles = "Customer")]
    [RequestSizeLimit(27 * 1024 * 1024)]
    public async Task<IActionResult> Reply(Guid id, Guid requestId, CancellationToken ct)
    {
        var c = await service.Get(id, User, ct);
        ClaimService.Match(c, Request);
        ClaimService.RequireStatus(c, ClaimStatus.AwaitingInformation);
        var info = c.InformationRequests.SingleOrDefault(r => r.Id == requestId) ?? throw new ApiException(404, "Information request not found.");
        if (info.RepliedAt is not null) throw new ApiException(409, "Request already answered.");
        if (!Request.HasFormContentType) throw new ApiException(415, "Use multipart/form-data with a text field.");
        var form = await Request.ReadFormAsync(ct);
        info.Reply = ClaimService.RequiredText(form["text"], "Reply");
        var docs = await Uploads.Read(form.Files, c.Id, info.Id, ct);
        CheckDocumentLimit(c, docs.Count);
        c.Documents.AddRange(docs);
        info.RepliedAt = DateTime.UtcNow;
        c.Status = ClaimStatus.UnderReview;
        await service.Save(c, "InformationReplied", ct);
        return WithVersion(c);
    }

    [HttpPost("{id:guid}/decision"), Authorize(Roles = "Staff")]
    public async Task<IActionResult> Decide(Guid id, DecisionInput input, CancellationToken ct)
    {
        var c = await service.Get(id, User, ct);
        ClaimService.Match(c, Request);
        ClaimService.RequireStatus(c, ClaimStatus.UnderReview);
        if (input.Decision is not (ClaimStatus.Approved or ClaimStatus.Rejected)) throw new ApiException(400, "Decision must be Approved or Rejected.");
        if (input.Decision == ClaimStatus.Approved && c.EstimatedLiabilitySen is null) throw new ApiException(409, "Save an estimate before approval.");
        c.DecisionReason = ClaimService.RequiredText(input.Reason, "Reason");
        c.Status = input.Decision;
        c.CompletedAt = DateTime.UtcNow;
        await service.Save(c, $"Claim{c.Status}", ct);
        return WithVersion(c);
    }
}
