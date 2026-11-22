using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Chubb.Api;

public class DemoAuth(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger,
    UrlEncoder encoder, IConfiguration configuration, IHostEnvironment environment)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!environment.IsDevelopment() && !environment.IsEnvironment("Testing"))
            return Task.FromResult(AuthenticateResult.Fail("Demo authentication is disabled outside Development/Testing."));
        if (!configuration.GetValue<bool>("DemoAuth:Enabled"))
            return Task.FromResult(AuthenticateResult.NoResult());
        var token = Request.Headers.Authorization.ToString();
        var identity = token switch
        {
            "Bearer customer-alice" => ("alice", "Customer"),
            "Bearer customer-bob" => ("bob", "Customer"),
            "Bearer staff-demo" => ("staff", "Staff"),
            "Bearer manager-demo" => ("manager", "Manager"),
            _ => ((string, string)?)null
        };
        if (identity is null) return Task.FromResult(AuthenticateResult.NoResult());
        var (id, role) = identity.Value;
        var principal = new ClaimsPrincipal(new ClaimsIdentity([
            new System.Security.Claims.Claim(ClaimTypes.NameIdentifier, id), new System.Security.Claims.Claim(ClaimTypes.Role, role)
        ], Scheme.Name));
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(principal, Scheme.Name)));
    }
}
