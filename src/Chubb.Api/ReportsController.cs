using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
namespace Chubb.Api;

[ApiController, Route("api/staff"), Authorize(Roles = "Staff")]
public class StaffController(ClaimService service, ClaimsDb db) : ControllerBase
{
    [HttpGet("queue")]
    public async Task<IActionResult> Queue(CancellationToken ct, int page = 1, int pageSize = 20)
    {
        ClaimsController.ValidatePage(page, pageSize);
        var query = service.Full.Where(c => c.Status != ClaimStatus.Approved && c.Status != ClaimStatus.Rejected);
        var total = await query.CountAsync(ct);
        var claims = await query.OrderBy(c => c.SubmittedAt).ThenBy(c => c.Id).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return Ok(new { total, page, pageSize, items = claims.Select(Views.Internal) });
    }
    [HttpGet("workload")]
    public async Task<IActionResult> Workload(CancellationToken ct)
    {
        var claims = await db.Claims.AsNoTracking().Select(c => new { c.Status, c.SubmittedAt, c.CompletedAt }).ToListAsync(ct);
        var durations = claims.Where(c => c.CompletedAt != null).Select(c => (c.CompletedAt!.Value - c.SubmittedAt).TotalHours).Order().ToArray();
        double? median = durations.Length == 0 ? null : durations.Length % 2 == 1
            ? durations[durations.Length / 2] : (durations[durations.Length / 2 - 1] + durations[durations.Length / 2]) / 2;
        return Ok(new
        {
            scope = "All time; shared team queue", generatedAt = DateTime.UtcNow,
            outstanding = claims.Count(c => c.Status is not (ClaimStatus.Approved or ClaimStatus.Rejected)),
            byStatus = Enum.GetValues<ClaimStatus>().Select(status => new { status, count = claims.Count(c => c.Status == status) }),
            outcomes = new { approved = claims.Count(c => c.Status == ClaimStatus.Approved), rejected = claims.Count(c => c.Status == ClaimStatus.Rejected) },
            completedCount = durations.Length,
            averageCompletionHours = durations.Length == 0 ? (double?)null : durations.Average(), medianCompletionHours = median
        });
    }
}

[ApiController, Route("api/manager"), Authorize(Roles = "Manager")]
public class ManagerController(ClaimsDb db, ClaimService service) : ControllerBase
{
    [HttpGet("outstanding")]
    public async Task<IActionResult> Outstanding(CancellationToken ct)
    {
        var claims = await db.Claims.AsNoTracking().Where(c => c.Status != ClaimStatus.Approved && c.Status != ClaimStatus.Rejected)
            .Select(c => new { c.Type, c.ClaimedAmountSen, c.EstimatedLiabilitySen }).ToListAsync(ct);
        return Ok(new
        {
            currency = "MYR", generatedAt = DateTime.UtcNow, count = claims.Count,
            claimedAmount = claims.Sum(c => c.ClaimedAmountSen) / 100m,
            estimatedLiability = claims.Sum(c => c.EstimatedLiabilitySen ?? 0) / 100m,
            withoutEstimateCount = claims.Count(c => c.EstimatedLiabilitySen == null),
            byType = Enum.GetValues<ClaimType>().Select(type =>
            {
                var group = claims.Where(c => c.Type == type).ToList();
                return new { type, count = group.Count, claimedAmount = group.Sum(c => c.ClaimedAmountSen) / 100m,
                    estimatedLiability = group.Sum(c => c.EstimatedLiabilitySen ?? 0) / 100m,
                    withoutEstimateCount = group.Count(c => c.EstimatedLiabilitySen == null) };
            })
        });
    }
    [HttpGet("outstanding/claims")]
    public async Task<IActionResult> Claims(CancellationToken ct, ClaimType? type = null, bool withoutEstimate = false, int page = 1, int pageSize = 20)
    {
        ClaimsController.ValidatePage(page, pageSize);
        if (type is not null && !Enum.IsDefined(type.Value)) throw new ApiException(400, "Type must be Motor or Property.");
        var query = service.Full.Where(c => c.Status != ClaimStatus.Approved && c.Status != ClaimStatus.Rejected);
        if (type is not null) query = query.Where(c => c.Type == type);
        if (withoutEstimate) query = query.Where(c => c.EstimatedLiabilitySen == null);
        var total = await query.CountAsync(ct);
        var claims = await query.OrderBy(c => c.SubmittedAt).ThenBy(c => c.Id).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return Ok(new { total, page, pageSize, items = claims.Select(Views.Internal) });
    }
}
