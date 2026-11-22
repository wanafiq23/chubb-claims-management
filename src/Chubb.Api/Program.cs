using System.Text.Json.Serialization;
using Chubb.Api;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Services.AddDbContext<ClaimsDb>(o => o.UseSqlite(builder.Configuration.GetConnectionString("Claims") ?? "Data Source=claims.db;Default Timeout=5"));
builder.Services.AddScoped<ClaimService>();
builder.Services.AddControllers().AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(allowIntegerValues: false)));
builder.Services.Configure<FormOptions>(o => o.MultipartBodyLengthLimit = 27 * 1024 * 1024);
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 27 * 1024 * 1024);
builder.Services.AddAuthentication("Demo").AddScheme<AuthenticationSchemeOptions, DemoAuth>("Demo", _ => { });
builder.Services.AddAuthorization();
builder.Services.AddSingleton<IEventPublisher, KafkaEventPublisher>();
builder.Services.AddScoped<OutboxDispatcher>();
builder.Services.AddHostedService<OutboxWorker>();
var app = builder.Build();
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ClaimsDb>();
    await db.Database.EnsureCreatedAsync();
    await db.Database.ExecuteSqlRawAsync("PRAGMA journal_mode=WAL;");
}
app.Use(async (context, next) =>
{
    context.Response.Headers.CacheControl = "no-store";
    try { await next(); }
    catch (Exception ex) when (ex is ApiException or DbUpdateConcurrencyException or BadHttpRequestException or InvalidDataException ||
        ex is DbUpdateException { InnerException: SqliteException { SqliteErrorCode: 5 or 6 } })
    {
        var (status, detail) = ex switch
        {
            ApiException api => (api.Status, api.Message),
            DbUpdateConcurrencyException => (412, "Claim changed. Reload and retry with its new version."),
            DbUpdateException => (409, "Database busy. Reload the claim and retry."),
            BadHttpRequestException bad => (bad.StatusCode, "Invalid request body or upload size."),
            _ => (400, "Invalid multipart upload.")
        };
        context.Response.Clear();
        context.Response.StatusCode = status;
        await Results.Problem(statusCode: status, detail: detail).ExecuteAsync(context);
    }
});
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "CHUBB claims API" }));
app.Run();

public partial class Program { }
