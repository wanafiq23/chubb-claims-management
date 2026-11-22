param([string]$BaseUrl = 'http://localhost:5080')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http

function Invoke-Api {
    param([string]$Method, [string]$Path, [string]$Token, $Body, [string]$Version)
    $headers = @{ Authorization = "Bearer $Token" }
    if ($Version) { $headers['If-Match'] = '"' + $Version + '"' }
    $parameters = @{ Method = $Method; Uri = "$BaseUrl$Path"; Headers = $headers }
    if ($null -ne $Body) { $parameters.ContentType = 'application/json'; $parameters.Body = ($Body | ConvertTo-Json -Depth 10) }
    Invoke-RestMethod @parameters
}

function Send-Form {
    param([string]$Path, [string]$Version, [string]$Text, [bool]$Attach)
    $client = New-Object System.Net.Http.HttpClient
    $form = New-Object System.Net.Http.MultipartFormDataContent
    try {
        $client.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue('Bearer', 'customer-alice')
        $client.DefaultRequestHeaders.TryAddWithoutValidation('If-Match', ('"' + $Version + '"')) | Out-Null
        if ($Text) { $form.Add((New-Object System.Net.Http.StringContent($Text)), 'text') }
        if ($Attach) {
            $bytes = [System.Text.Encoding]::ASCII.GetBytes("%PDF-1.7`nDemo supporting evidence`n%%EOF")
            $file = New-Object System.Net.Http.ByteArrayContent -ArgumentList (,$bytes)
            $file.Headers.ContentType = New-Object System.Net.Http.Headers.MediaTypeHeaderValue('application/pdf')
            $form.Add($file, 'files', 'evidence.pdf')
        }
        $response = $client.PostAsync("$BaseUrl$Path", $form).GetAwaiter().GetResult()
        $content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        if (-not $response.IsSuccessStatusCode) { throw "HTTP $([int]$response.StatusCode): $content" }
        $content | ConvertFrom-Json
    }
    finally { $form.Dispose(); $client.Dispose() }
}

$claim = Invoke-Api POST '/api/claims' 'customer-alice' @{
    type = 'Motor'; incidentAt = '2026-01-01T00:00:00Z'; incidentDetails = 'Rear bumper damaged in collision'; claimedAmount = 2500.50
}
$id = $claim.id
Write-Host "Submitted claim $id"
$claim = Send-Form "/api/claims/$id/documents" $claim.version '' $true
$internal = Invoke-Api POST "/api/claims/$id/review" 'staff-demo' $null $claim.version
$internal = Invoke-Api PUT "/api/claims/$id/estimate" 'staff-demo' @{ estimatedLiability = 1800.25 } $internal.claim.version
$internal = Invoke-Api POST "/api/claims/$id/information-requests" 'staff-demo' @{ question = 'Please confirm whether the vehicle was parked.' } $internal.claim.version
$requestId = $internal.claim.informationRequests[0].id
$claim = Send-Form "/api/claims/$id/information-requests/$requestId/reply" $internal.claim.version 'The vehicle was parked.' $false
$internal = Invoke-Api POST "/api/claims/$id/decision" 'staff-demo' @{ decision = 'Approved'; reason = 'Covered collision damage supported by evidence.' } $claim.version

Write-Host 'Customer decision and history (internal estimate is omitted):'
Invoke-Api GET "/api/claims/$id" 'customer-alice' | ConvertTo-Json -Depth 10
Write-Host 'Team workload:'
Invoke-Api GET '/api/staff/workload' 'staff-demo' | ConvertTo-Json -Depth 10
Write-Host 'Manager outstanding totals (this approved claim is excluded):'
Invoke-Api GET '/api/manager/outstanding' 'manager-demo' | ConvertTo-Json -Depth 10
