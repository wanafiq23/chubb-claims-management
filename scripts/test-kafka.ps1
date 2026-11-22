param(
    [string]$BaseUrl = 'http://localhost:5080',
    [string]$ComposeProject = '',
    [ValidateRange(5, 120)][int]$TimeoutSeconds = 15
)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$composeArgs = @('compose')
if ($ComposeProject) { $composeArgs += @('-p', $ComposeProject) }

# This smoke test creates one clearly labelled claim in the selected backend.
$body = @{
    type = 'Motor'
    incidentAt = [DateTime]::UtcNow.AddDays(-1).ToString('yyyy-MM-ddTHH:mm:ssZ')
    incidentDetails = 'Kafka publishing verification ' + [guid]::NewGuid().ToString()
    claimedAmount = 10.00
} | ConvertTo-Json
$claim = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/claims" -Headers @{ Authorization = 'Bearer customer-alice' } -ContentType 'application/json' -Body $body
$errorLog = [System.IO.Path]::GetTempFileName()
try {
    $consumerArgs = $composeArgs + @('exec', '-T', 'kafka', '/opt/kafka/bin/kafka-console-consumer.sh',
        '--bootstrap-server', 'kafka:19092', '--topic', 'chubb.claims.lifecycle.v1',
        '--from-beginning', '--timeout-ms', ($TimeoutSeconds * 1000).ToString())
    # Kafka exits nonzero on the intentional idle timeout; the matching event is the assertion.
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $lines = & docker @consumerArgs 2> $errorLog
    $consumerExit = $LASTEXITCODE
    $ErrorActionPreference = $previousPreference
    $matching = @($lines | ForEach-Object {
        try {
            $event = $_ | ConvertFrom-Json
            if ($event.claimId -eq $claim.id -and $event.eventType -eq 'ClaimSubmitted') { $event }
        } catch { }
    })
    if ($matching.Count -eq 0) {
        throw "No ClaimSubmitted event for $($claim.id). Consumer exit: $consumerExit. $(Get-Content -LiteralPath $errorLog -Raw)"
    }
    $event = $matching[0]
    if ($event.schemaVersion -ne 1 -or $event.status -ne 'Submitted' -or $event.currency -ne 'MYR') {
        throw 'The lifecycle event did not match the documented schema.'
    }
    $parsedId = [guid]::Empty
    if (-not [guid]::TryParse($event.eventId, [ref]$parsedId)) { throw 'Event ID is not a GUID.' }
    if ($event.PSObject.Properties.Name -contains 'incidentDetails') { throw 'Event unexpectedly includes incident text.' }
    [pscustomobject]@{ Result = 'PASS'; ClaimId = $claim.id; EventId = $event.eventId; EventType = $event.eventType }
} finally {
    $ErrorActionPreference = 'Stop'
    Remove-Item -LiteralPath $errorLog -ErrorAction SilentlyContinue
}
