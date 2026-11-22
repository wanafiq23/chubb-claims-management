using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json.Nodes;
using Chubb.Api;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Hosting;
namespace Chubb.Api.Tests;

public sealed class ClaimsTests : IDisposable
{
    readonly ApiFactory app = new();
    public void Dispose() => app.Dispose();
    static async Task<JsonObject> Json(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, $"{response.StatusCode}: {text}");
        return JsonNode.Parse(text)!.AsObject();
    }
    async Task<JsonObject> Submit(string type = "Motor", decimal amount = 1000)
    {
        using var customer = app.Client();
        var response = await customer.PostAsJsonAsync("/api/claims", new { type, incidentAt = "2026-01-01T00:00:00Z", incidentDetails = "Vehicle damaged in incident", claimedAmount = amount });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.NotNull(response.Headers.Location);
        var claim = await Json(response);
        Assert.Equal($"\"{claim["version"]}\"", response.Headers.ETag!.Tag);
        return claim;
    }
    static string Id(JsonObject c) => c["id"]!.GetValue<string>();
    static string Version(JsonObject c) => c["version"]!.GetValue<string>();
    static JsonObject Internal(JsonObject c) => c["claim"]!.AsObject();
    async Task<HttpResponseMessage> Change(string id, string action, object? body, string? version, string token = "staff-demo", HttpMethod? method = null)
    {
        using var client = app.Client(token);
        using var request = new HttpRequestMessage(method ?? HttpMethod.Post, $"/api/claims/{id}/{action}");
        if (version != null) request.Headers.TryAddWithoutValidation("If-Match", $"\"{version}\"");
        if (body != null) request.Content = JsonContent.Create(body);
        return await client.SendAsync(request);
    }
    async Task<JsonObject> Review(JsonObject c) => Internal(await Json(await Change(Id(c), "review", null, Version(c))));
    async Task<JsonObject> Estimate(JsonObject c, decimal amount) => Internal(await Json(await Change(Id(c), "estimate", new { estimatedLiability = amount }, Version(c), method: HttpMethod.Put)));
    static MultipartFormDataContent Form(string? text = null, string fileName = "proof.pdf", string mediaType = "application/pdf", byte[]? bytes = null, bool attach = true)
    {
        var form = new MultipartFormDataContent();
        if (text != null) form.Add(new StringContent(text), "text");
        if (attach)
        {
            var file = new ByteArrayContent(bytes ?? Encoding.ASCII.GetBytes("%PDF-1.7\nDemo evidence\n%%EOF"));
            file.Headers.ContentType = new(mediaType);
            form.Add(file, "files", fileName);
        }
        return form;
    }
    async Task<HttpResponseMessage> Upload(JsonObject c, MultipartFormDataContent form, string action = "documents", string token = "customer-alice")
    {
        using var client = app.Client(token);
        using var req = new HttpRequestMessage(HttpMethod.Post, $"/api/claims/{Id(c)}/{action}");
        req.Headers.TryAddWithoutValidation("If-Match", $"\"{Version(c)}\"");
        req.Content = form;
        return await client.SendAsync(req);
    }

    [Fact]
    public async Task Full_workflow_preserves_amounts_documents_history_and_hides_estimates()
    {
        var c = await Submit();
        c = await Json(await Upload(c, Form()));
        var documentId = c["documents"]![0]!["id"]!.GetValue<string>();
        using var customer = app.Client();
        var download = await customer.GetAsync($"/api/claims/{Id(c)}/documents/{documentId}");
        Assert.Equal("application/pdf", download.Content.Headers.ContentType!.MediaType);
        Assert.Contains("attachment", download.Content.Headers.ContentDisposition!.ToString());
        Assert.Equal("nosniff", download.Headers.GetValues("X-Content-Type-Options").Single());
        c = await Review(c);
        c = await Estimate(c, 750.25m);
        var requested = await Json(await Change(Id(c), "information-requests", new { question = "Provide a repair quotation" }, Version(c)));
        c = Internal(requested);
        var requestId = c["informationRequests"]![0]!["id"]!.GetValue<string>();
        Assert.Equal("AwaitingInformation", c["status"]!.GetValue<string>());
        c = await Json(await Upload(c, Form("Here is the quotation"), $"information-requests/{requestId}/reply"));
        Assert.Equal("UnderReview", c["status"]!.GetValue<string>());
        Assert.Equal(2, c["documents"]!.AsArray().Count);
        Assert.Equal(requestId, c["documents"]![1]!["informationRequestId"]!.GetValue<string>());
        var decision = await Json(await Change(Id(c), "decision", new { decision = "Approved", reason = "Covered damage" }, Version(c)));
        Assert.Equal(750.25m, decision["estimatedLiability"]!.GetValue<decimal>());
        var visible = await Json(await customer.GetAsync($"/api/claims/{Id(c)}"));
        Assert.Equal(1000m, visible["claimedAmount"]!.GetValue<decimal>());
        Assert.Equal("Approved", visible["status"]!.GetValue<string>());
        Assert.Equal("Covered damage", visible["decisionReason"]!.GetValue<string>());
        Assert.EndsWith("Z", visible["incidentAt"]!.GetValue<string>());
        Assert.EndsWith("Z", visible["completedAt"]!.GetValue<string>());
        Assert.EndsWith("Z", visible["documents"]![0]!["uploadedAt"]!.GetValue<string>());
        Assert.EndsWith("Z", visible["history"]![0]!["occurredAt"]!.GetValue<string>());
        Assert.Equal(7, visible["history"]!.AsArray().Count);
        Assert.DoesNotContain("estimatedLiability", visible.ToJsonString(), StringComparison.OrdinalIgnoreCase);
        var mine = await Json(await customer.GetAsync("/api/claims"));
        Assert.DoesNotContain("estimatedLiability", mine.ToJsonString(), StringComparison.OrdinalIgnoreCase);
        Assert.Equal(1, mine["total"]!.GetValue<int>());
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClaimsDb>();
        Assert.Equal(7, await db.Outbox.CountAsync());
        Assert.All(await db.Outbox.ToListAsync(), x => Assert.Null(x.PublishedAt));
    }

    [Fact]
    public async Task Authentication_roles_and_ownership_cover_reads_and_writes()
    {
        var c = await Submit();
        c = await Json(await Upload(c, Form()));
        using var anonymous = app.Client(null);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/claims")).StatusCode);
        using var bob = app.Client("customer-bob");
        Assert.Equal(HttpStatusCode.NotFound, (await bob.GetAsync($"/api/claims/{Id(c)}")).StatusCode);
        var docId = c["documents"]![0]!["id"]!.GetValue<string>();
        Assert.Equal(HttpStatusCode.NotFound, (await bob.GetAsync($"/api/claims/{Id(c)}/documents/{docId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Upload(c, Form(), token: "customer-bob")).StatusCode);
        Assert.Equal(0, (await Json(await bob.GetAsync("/api/claims")))["total"]!.GetValue<int>());
        Assert.Equal(HttpStatusCode.Forbidden, (await Change(Id(c), "review", null, Version(c), "customer-alice")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Change(Id(c), "review", null, Version(c), "manager-demo")).StatusCode);
        using var customer = app.Client();
        Assert.Equal(HttpStatusCode.Forbidden, (await customer.GetAsync("/api/staff/queue")).StatusCode);
        using var staff = app.Client("staff-demo");
        Assert.Equal(HttpStatusCode.Forbidden, (await staff.GetAsync("/api/manager/outstanding")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await staff.PostAsJsonAsync("/api/claims", new { })).StatusCode);
    }

    [Fact]
    public async Task Version_preconditions_and_terminal_state_protect_updates()
    {
        var c = await Submit();
        Assert.Equal((HttpStatusCode)428, (await Change(Id(c), "review", null, null)).StatusCode);
        var reviewed = await Review(c);
        Assert.Equal(HttpStatusCode.PreconditionFailed, (await Change(Id(c), "review", null, Version(c))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Change(Id(c), "review", null, Version(reviewed))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Change(Id(c), "decision", new { decision = "Approved", reason = "Valid" }, Version(reviewed))).StatusCode);
        var rejected = Internal(await Json(await Change(Id(c), "decision", new { decision = "Rejected", reason = "Excluded loss" }, Version(reviewed))));
        Assert.Equal(HttpStatusCode.Conflict, (await Change(Id(c), "estimate", new { estimatedLiability = 10 }, Version(rejected), method: HttpMethod.Put)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Change(Id(c), "decision", new { decision = "Approved", reason = "Changed mind" }, Version(rejected))).StatusCode);
    }

    [Fact]
    public async Task Ef_concurrency_rolls_back_history_and_outbox_for_losing_writer()
    {
        var c = await Submit();
        using var first = app.Services.CreateScope();
        using var second = app.Services.CreateScope();
        var a = first.ServiceProvider.GetRequiredService<ClaimsDb>();
        var b = second.ServiceProvider.GetRequiredService<ClaimsDb>();
        var id = Guid.Parse(Id(c));
        var ca = await a.Claims.SingleAsync(x => x.Id == id);
        var cb = await b.Claims.SingleAsync(x => x.Id == id);
        ca.Status = ClaimStatus.UnderReview;
        cb.Status = ClaimStatus.UnderReview;
        await first.ServiceProvider.GetRequiredService<ClaimService>().Save(ca, "ReviewStarted", default);
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => second.ServiceProvider.GetRequiredService<ClaimService>().Save(cb, "ReviewStarted", default));
        using var verify = app.Services.CreateScope();
        var db = verify.ServiceProvider.GetRequiredService<ClaimsDb>();
        Assert.Equal(2, await db.Outbox.CountAsync());
        Assert.Equal(2, (await db.Claims.Include(x => x.History).SingleAsync()).History.Count);
    }

    [Fact]
    public async Task Reports_exclude_both_terminal_states_and_distinguish_missing_from_zero_estimates()
    {
        var motor = await Estimate(await Review(await Submit()), 100.25m);
        var property = await Submit("Property", 2000);
        await Estimate(await Review(await Submit("Property", 3000)), 0);
        var approved = await Estimate(await Review(await Submit()), 900);
        await Json(await Change(Id(approved), "decision", new { decision = "Approved", reason = "Covered" }, Version(approved)));
        var rejected = await Review(await Submit());
        await Json(await Change(Id(rejected), "decision", new { decision = "Rejected", reason = "Not covered" }, Version(rejected)));
        using var manager = app.Client("manager-demo");
        var report = await Json(await manager.GetAsync("/api/manager/outstanding"));
        Assert.Equal(3, report["count"]!.GetValue<int>());
        Assert.Equal(6000m, report["claimedAmount"]!.GetValue<decimal>());
        Assert.Equal(100.25m, report["estimatedLiability"]!.GetValue<decimal>());
        Assert.Equal(1, report["withoutEstimateCount"]!.GetValue<int>());
        Assert.Equal(2, report["byType"]![1]!["count"]!.GetValue<int>());
        var drill = await Json(await manager.GetAsync("/api/manager/outstanding/claims?type=Property&withoutEstimate=true"));
        Assert.Equal(1, drill["total"]!.GetValue<int>());
        Assert.Equal(Id(property), drill["items"]![0]!["claim"]!["id"]!.GetValue<string>());
        using var staff = app.Client("staff-demo");
        var queue = await Json(await staff.GetAsync("/api/staff/queue?pageSize=1"));
        Assert.Equal(3, queue["total"]!.GetValue<int>());
        Assert.Single(queue["items"]!.AsArray());
        var workload = await Json(await staff.GetAsync("/api/staff/workload"));
        Assert.Equal(2, workload["completedCount"]!.GetValue<int>());
        Assert.Equal(1, workload["outcomes"]!["approved"]!.GetValue<int>());
        Assert.Equal(1, workload["outcomes"]!["rejected"]!.GetValue<int>());
        Assert.True(workload["averageCompletionHours"]!.GetValue<double>() >= 0);
    }

    [Theory]
    [InlineData("evil.exe", "application/pdf", "%PDF-1.7")]
    [InlineData("fake.pdf", "application/pdf", "not a PDF")]
    [InlineData("proof.pdf", "text/plain", "%PDF-1.7")]
    [InlineData("empty.pdf", "application/pdf", "")]
    public async Task Invalid_uploads_leave_claim_history_and_outbox_unchanged(string name, string mime, string content)
    {
        var c = await Submit();
        var response = await Upload(c, Form(fileName: name, mediaType: mime, bytes: Encoding.ASCII.GetBytes(content)));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var customer = app.Client();
        var after = await Json(await customer.GetAsync($"/api/claims/{Id(c)}"));
        Assert.Equal(Version(c), Version(after));
        Assert.Empty(after["documents"]!.AsArray());
        using var scope = app.Services.CreateScope();
        Assert.Equal(1, await scope.ServiceProvider.GetRequiredService<ClaimsDb>().Outbox.CountAsync());
    }

    [Fact]
    public async Task Oversize_and_excess_files_are_rejected()
    {
        var c = await Submit();
        Assert.Equal(HttpStatusCode.BadRequest, (await Upload(c, Form(bytes: new byte[Uploads.MaxSize + 1]))).StatusCode);
        using var form = Form();
        for (var i = 0; i < 5; i++) form.Add(new StringContent("%PDF-1.7"), "files", $"proof{i}.pdf");
        Assert.Equal(HttpStatusCode.BadRequest, (await Upload(c, form)).StatusCode);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(0)]
    [InlineData(1.001)]
    [InlineData(1000000001)]
    public async Task Invalid_money_is_rejected(decimal amount)
    {
        using var customer = app.Client();
        Assert.Equal(HttpStatusCode.BadRequest, (await customer.PostAsJsonAsync("/api/claims", new
        { type = "Motor", incidentAt = "2026-01-01T00:00:00Z", incidentDetails = "Damage", claimedAmount = amount })).StatusCode);
    }

    [Fact]
    public async Task Pending_information_requires_a_reply_before_a_decision()
    {
        var c = await Review(await Submit());
        c = Internal(await Json(await Change(Id(c), "information-requests", new { question = "Explain" }, Version(c))));
        var requestId = c["informationRequests"]![0]!["id"]!.GetValue<string>();
        Assert.Equal(HttpStatusCode.Conflict, (await Change(Id(c), "decision", new { decision = "Rejected", reason = "Reason" }, Version(c))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Upload(c, Form("Reply", attach: false), $"information-requests/{Guid.NewGuid()}/reply")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Upload(c, Form(" ", attach: false), $"information-requests/{requestId}/reply")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Upload(c, Form("Reply", attach: false), $"information-requests/{requestId}/reply", "customer-bob")).StatusCode);
        c = await Json(await Upload(c, Form("Reply without attachments", attach: false), $"information-requests/{requestId}/reply"));
        Assert.Equal("UnderReview", c["status"]!.GetValue<string>());
        Assert.Equal(HttpStatusCode.Conflict, (await Upload(c, Form("Duplicate", attach: false), $"information-requests/{requestId}/reply")).StatusCode);
    }

    [Fact]
    public async Task Demo_tokens_are_disabled_in_production_even_with_enabled_flag()
    {
        using var production = app.WithWebHostBuilder(builder => builder.UseEnvironment("Production"));
        using var client = production.CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", "customer-alice");
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/claims")).StatusCode);
    }

    [Fact]
    public async Task Empty_reports_have_explicit_zero_groups_and_null_completion_times()
    {
        using var manager = app.Client("manager-demo");
        var report = await Json(await manager.GetAsync("/api/manager/outstanding"));
        Assert.Equal(0, report["count"]!.GetValue<int>());
        Assert.Equal(2, report["byType"]!.AsArray().Count);
        Assert.All(report["byType"]!.AsArray(), g => Assert.Equal(0, g!["count"]!.GetValue<int>()));
        using var staff = app.Client("staff-demo");
        var workload = await Json(await staff.GetAsync("/api/staff/workload"));
        Assert.Null(workload["averageCompletionHours"]);
        Assert.Null(workload["medianCompletionHours"]);
    }

    [Fact]
    public async Task Invalid_dates_enums_missing_fields_and_blank_reasons_are_rejected()
    {
        using var customer = app.Client();
        foreach (var incidentAt in new[] { "2999-01-01T00:00:00Z", "2026-01-01T00:00:00", "1899-01-01T00:00:00Z" })
            Assert.Equal(HttpStatusCode.BadRequest, (await customer.PostAsJsonAsync("/api/claims", new
            { type = "Motor", incidentAt, incidentDetails = "Damage", claimedAmount = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await customer.PostAsJsonAsync("/api/claims", new
        { type = "Boat", incidentAt = "2026-01-01T00:00:00Z", incidentDetails = "Damage", claimedAmount = 1 })).StatusCode);
        var c = await Review(await Submit());
        Assert.Equal(HttpStatusCode.BadRequest, (await Change(Id(c), "estimate", new { }, Version(c), method: HttpMethod.Put)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Change(Id(c), "estimate", new { estimatedLiability = -1 }, Version(c), method: HttpMethod.Put)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Change(Id(c), "decision", new { decision = "Rejected", reason = " " }, Version(c))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Change(Id(c), "decision", new { decision = "Submitted", reason = "Invalid" }, Version(c))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await customer.GetAsync("/api/claims?page=0")).StatusCode);
    }

    [Fact]
    public async Task Concurrent_http_updates_allow_only_one_writer()
    {
        var c = await Review(await Submit());
        var responses = await Task.WhenAll(
            Change(Id(c), "estimate", new { estimatedLiability = 100 }, Version(c), method: HttpMethod.Put),
            Change(Id(c), "estimate", new { estimatedLiability = 200 }, Version(c), method: HttpMethod.Put));
        Assert.Single(responses, r => r.IsSuccessStatusCode);
        Assert.Single(responses, r => r.StatusCode is HttpStatusCode.PreconditionFailed or HttpStatusCode.Conflict);
        using var scope = app.Services.CreateScope();
        Assert.Equal(3, await scope.ServiceProvider.GetRequiredService<ClaimsDb>().Outbox.CountAsync());
    }

    [Fact]
    public async Task Outbox_survives_broker_outage_retries_in_order_and_marks_only_acknowledged_events()
    {
        var c = await Submit();
        await Review(c);
        app.Publisher.Fail = true;
        using (var scope = app.Services.CreateScope())
        {
            Assert.Equal(0, await scope.ServiceProvider.GetRequiredService<OutboxDispatcher>().Dispatch(default));
            var messages = await scope.ServiceProvider.GetRequiredService<ClaimsDb>().Outbox.OrderBy(x => x.Sequence).ToListAsync();
            Assert.All(messages, x => Assert.Null(x.PublishedAt));
            Assert.Equal(1, messages[0].Attempts);
            Assert.Equal(0, messages[1].Attempts);
        }
        app.Publisher.Fail = false;
        using (var scope = app.Services.CreateScope())
            Assert.Equal(2, await scope.ServiceProvider.GetRequiredService<OutboxDispatcher>().Dispatch(default));
        using (var scope = app.Services.CreateScope())
        {
            Assert.Equal(0, await scope.ServiceProvider.GetRequiredService<OutboxDispatcher>().Dispatch(default));
            Assert.Equal(2, await scope.ServiceProvider.GetRequiredService<ClaimsDb>().Outbox.CountAsync(x => x.PublishedAt != null));
        }
        Assert.Equal(2, app.Publisher.Delivered.Count);
        Assert.True(app.Publisher.Delivered[0].Sequence < app.Publisher.Delivered[1].Sequence);
        var payload = JsonNode.Parse(app.Publisher.Delivered[0].Payload)!;
        Assert.Equal("ClaimSubmitted", payload["eventType"]!.GetValue<string>());
        Assert.Equal(app.Publisher.Delivered[0].EventId.ToString(), payload["eventId"]!.GetValue<string>());
        Assert.Equal(Id(c), payload["claimId"]!.GetValue<string>());
        Assert.DoesNotContain("incidentDetails", app.Publisher.Delivered[0].Payload);
    }
}
