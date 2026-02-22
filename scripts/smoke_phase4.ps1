$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:4000"
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$email = "smoke+$timestamp@lastreia.local"
$password = "Smoke12345!"
$orgName = "Smoke Org $timestamp"
$results = [System.Collections.Generic.List[object]]::new()

function Add-Result {
    param(
        [string]$Flow,
        [string]$Step,
        [string]$Status,
        [string]$Detail
    )

    $results.Add([PSCustomObject]@{
        flow = $Flow
        step = $Step
        status = $Status
        detail = $Detail
    })
}

function Invoke-Api {
    param(
        [ValidateSet("GET", "POST", "PATCH", "PUT", "DELETE")]
        [string]$Method,
        [string]$Path,
        $Body = $null,
        [string]$Token = ""
    )

    $headers = @{}
    if ($Token) {
        $headers["Authorization"] = "Bearer $Token"
    }

    $uri = "$baseUrl$Path"
    if ($null -eq $Body) {
        if ($Method -in @("POST", "PATCH", "PUT")) {
            return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -ContentType "application/json" -Body "{}"
        }
        return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
    }

    $json = $Body | ConvertTo-Json -Depth 10
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -ContentType "application/json" -Body $json
}

function Expect-ApiError {
    param(
        [ValidateSet("GET", "POST", "PATCH", "PUT", "DELETE")]
        [string]$Method,
        [string]$Path,
        $Body = $null,
        [string]$Token = "",
        [int]$ExpectedStatus = 400
    )

    try {
        if ($null -eq $Body) {
            Invoke-Api -Method $Method -Path $Path -Token $Token | Out-Null
        } else {
            Invoke-Api -Method $Method -Path $Path -Body $Body -Token $Token | Out-Null
        }
        throw "Expected HTTP $ExpectedStatus but request succeeded: $Method $Path"
    } catch {
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            if ($statusCode -ne $ExpectedStatus) {
                throw "Expected HTTP $ExpectedStatus but got $statusCode for $Method $Path"
            }
            return
        }
        throw
    }
}

function Assert-Success {
    param(
        [bool]$Condition,
        [string]$Message
    )
    if (-not $Condition) {
        throw $Message
    }
}

Write-Host "Starting Phase 4 smoke test..."

# 0) Health
$healthRaw = Invoke-WebRequest -Uri "$baseUrl/health" -UseBasicParsing
Assert-Success ($healthRaw.StatusCode -eq 200) "Health check failed"
Add-Result -Flow "platform" -Step "health" -Status "PASS" -Detail "backend health 200"

# 1) Auth
$register = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{
    email = $email
    name = "Smoke User"
    password = $password
    organizationName = $orgName
}
Assert-Success ($register.success -eq $true) "Auth register did not return success"
$token = [string]$register.data.token
$organizationId = [string]$register.data.organization.id
Assert-Success (-not [string]::IsNullOrWhiteSpace($token)) "Token missing after register"
Add-Result -Flow "auth" -Step "register" -Status "PASS" -Detail "user + org created"

$login = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{
    email = $email
    password = $password
}
Assert-Success ($login.success -eq $true) "Auth login failed"
Add-Result -Flow "auth" -Step "login" -Status "PASS" -Detail "login ok"

$me = Invoke-Api -Method GET -Path "/api/auth/me" -Token $token
Assert-Success ($me.success -eq $true) "Auth me failed"
Add-Result -Flow "auth" -Step "me" -Status "PASS" -Detail "token valid"

# 2) Leads
$lead = Invoke-Api -Method POST -Path "/api/leads" -Token $token -Body @{
    fullName = "Lead Smoke $timestamp"
    email = "lead.$timestamp@example.com"
    companyName = "Smoke Co"
    jobTitle = "Founder"
}
Assert-Success ($lead.success -eq $true) "Lead create failed"
$leadId = [string]$lead.data.id
Add-Result -Flow "leads" -Step "create" -Status "PASS" -Detail "leadId=$leadId"

$leadsList = Invoke-Api -Method GET -Path "/api/leads?page=1&limit=5" -Token $token
Assert-Success ($leadsList.success -eq $true) "Lead list failed"
Add-Result -Flow "leads" -Step "list" -Status "PASS" -Detail "total=$($leadsList.meta.total)"

# 3) Scraping
$scraping = Invoke-Api -Method POST -Path "/api/scraping/jobs" -Token $token -Body @{
    name = "Smoke Scraping $timestamp"
    source = "google_maps"
    query = @{
        city = "Sao Paulo"
        category = "software"
    }
}
Assert-Success ($scraping.success -eq $true) "Scraping job create failed"
$scrapingJobId = [string]$scraping.data.id
Add-Result -Flow "scraping" -Step "create-job" -Status "PASS" -Detail "jobId=$scrapingJobId"

$scrapingJobs = Invoke-Api -Method GET -Path "/api/scraping/jobs?page=1&limit=5" -Token $token
Assert-Success ($scrapingJobs.success -eq $true) "Scraping jobs list failed"
Add-Result -Flow "scraping" -Step "list-jobs" -Status "PASS" -Detail "total=$($scrapingJobs.meta.total)"

$scrapingJob = Invoke-Api -Method GET -Path "/api/scraping/jobs/$scrapingJobId" -Token $token
Assert-Success ($scrapingJob.success -eq $true) "Scraping job details failed"
Add-Result -Flow "scraping" -Step "job-details" -Status "PASS" -Detail "status=$($scrapingJob.data.status)"

# 4) Enrichment
$enrichment = Invoke-Api -Method POST -Path "/api/enrichment/jobs" -Token $token -Body @{
    name = "Smoke Enrichment $timestamp"
    leadIds = @($leadId)
}
Assert-Success ($enrichment.success -eq $true) "Enrichment job create failed"
$enrichmentJobId = [string]$enrichment.data.id
Add-Result -Flow "enrichment" -Step "create-job" -Status "PASS" -Detail "jobId=$enrichmentJobId"

$enrichmentJobs = Invoke-Api -Method GET -Path "/api/enrichment/jobs?page=1&limit=5" -Token $token
Assert-Success ($enrichmentJobs.success -eq $true) "Enrichment jobs list failed"
Add-Result -Flow "enrichment" -Step "list-jobs" -Status "PASS" -Detail "total=$($enrichmentJobs.meta.total)"

$enrichmentJob = Invoke-Api -Method GET -Path "/api/enrichment/jobs/$enrichmentJobId" -Token $token
Assert-Success ($enrichmentJob.success -eq $true) "Enrichment job details failed"
Add-Result -Flow "enrichment" -Step "job-details" -Status "PASS" -Detail "status=$($enrichmentJob.data.status)"

# 5) Campaign launch/pause/resume
$campaign = Invoke-Api -Method POST -Path "/api/campaigns" -Token $token -Body @{
    name = "Smoke Campaign $timestamp"
    type = "EMAIL"
    leadIds = @($leadId)
    steps = @(
        @{
            type = "EMAIL"
            subject = "Smoke Subject"
            content = "Hello from smoke"
            delayHours = 0
        }
    )
}
Assert-Success ($campaign.success -eq $true) "Campaign create failed"
$campaignId = [string]$campaign.data.id
Add-Result -Flow "campaigns" -Step "create" -Status "PASS" -Detail "campaignId=$campaignId"

$launch = Invoke-Api -Method POST -Path "/api/campaigns/$campaignId/launch" -Token $token
Assert-Success ($launch.success -eq $true) "Campaign launch failed"
Add-Result -Flow "campaigns" -Step "launch" -Status "PASS" -Detail "launch ok"

$pause = Invoke-Api -Method POST -Path "/api/campaigns/$campaignId/pause" -Token $token
Assert-Success ($pause.success -eq $true) "Campaign pause failed"
Add-Result -Flow "campaigns" -Step "pause" -Status "PASS" -Detail "pause ok"

$resume = Invoke-Api -Method POST -Path "/api/campaigns/$campaignId/resume" -Token $token
Assert-Success ($resume.success -eq $true) "Campaign resume failed"
Add-Result -Flow "campaigns" -Step "resume" -Status "PASS" -Detail "resume ok"

# 6) Inbox
$inboxConversations = Invoke-Api -Method GET -Path "/api/inbox/conversations?page=1&limit=10" -Token $token
Assert-Success ($inboxConversations.success -eq $true) "Inbox list conversations failed"
Add-Result -Flow "inbox" -Step "list-conversations" -Status "PASS" -Detail "total=$($inboxConversations.meta.total)"

$thread = Invoke-Api -Method GET -Path "/api/inbox/$leadId/messages?page=1&limit=20" -Token $token
Assert-Success ($thread.success -eq $true) "Inbox thread failed"
Add-Result -Flow "inbox" -Step "thread" -Status "PASS" -Detail "messages loaded"

$intelligence = Invoke-Api -Method GET -Path "/api/inbox/$leadId/intelligence" -Token $token
Assert-Success ($intelligence.success -eq $true) "Inbox intelligence failed"
Add-Result -Flow "inbox" -Step "intelligence" -Status "PASS" -Detail "intelligence loaded"

# 7) Signals
$signalsSummary = Invoke-Api -Method GET -Path "/api/signals/summary" -Token $token
Assert-Success ($signalsSummary.success -eq $true) "Signals summary failed"
Add-Result -Flow "signals" -Step "summary" -Status "PASS" -Detail "summary ok"

$signalsOverview = Invoke-Api -Method GET -Path "/api/signals/overview" -Token $token
Assert-Success ($signalsOverview.success -eq $true) "Signals overview failed"
Add-Result -Flow "signals" -Step "overview" -Status "PASS" -Detail "overview ok"

$detect = Invoke-Api -Method POST -Path "/api/signals/detect" -Token $token -Body @{
    async = $true
}
Assert-Success ($detect.success -eq $true) "Signals detect enqueue failed"
Add-Result -Flow "signals" -Step "detect" -Status "PASS" -Detail "queued=$($detect.data.queued)"

$recommendations = Invoke-Api -Method POST -Path "/api/signals/leads/recommendations" -Token $token -Body @{
    leadIds = @($leadId)
}
Assert-Success ($recommendations.success -eq $true) "Signals lead recommendations failed"
Add-Result -Flow "signals" -Step "lead-recommendations" -Status "PASS" -Detail "recommendations ok"

# 8) Distribution / Growth publish
$backendDir = Resolve-Path (Join-Path $PSScriptRoot "..\backend")

Push-Location $backendDir
$signalId = (
    node --input-type=module -e @'
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const organizationId = process.argv[1];
const timestamp = process.argv[2];
const signal = await prisma.signal.create({
  data: {
    organizationId,
    signature: `smoke-${timestamp}`,
    type: 'TIMING',
    confidence: 82,
    insight: 'Smoke signal insight',
    dataPoints: 10,
    suggestedFormats: ['CHART', 'TWEET'],
    rawData: { source: 'smoke', timestamp }
  }
});
console.log(signal.id);
await prisma.$disconnect();
'@ $organizationId $timestamp
).Trim()
Pop-Location

Assert-Success (-not [string]::IsNullOrWhiteSpace($signalId)) "Failed to create smoke signal"
Add-Result -Flow "distribution" -Step "seed-signal" -Status "PASS" -Detail "signalId=$signalId"

$generatedDrafts = Invoke-Api -Method POST -Path "/api/distribution/generate" -Token $token -Body @{
    signalId = $signalId
    formats = @("CHART")
}
Assert-Success ($generatedDrafts.success -eq $true) "Distribution generate failed"
$draftId = [string]$generatedDrafts.data.created[0].id
Add-Result -Flow "distribution" -Step "generate" -Status "PASS" -Detail "draftId=$draftId"

$draft = Invoke-Api -Method GET -Path "/api/distribution/$draftId" -Token $token
Assert-Success ($draft.success -eq $true) "Distribution draft detail failed"
Add-Result -Flow "distribution" -Step "draft-detail" -Status "PASS" -Detail "format=$($draft.data.format)"

$publishDraft = Invoke-Api -Method POST -Path "/api/distribution/$draftId/publish" -Token $token -Body @{
    platform = "manual"
}
Assert-Success ($publishDraft.success -eq $true) "Distribution publish failed"
Add-Result -Flow "distribution" -Step "publish" -Status "PASS" -Detail "status=$($publishDraft.data.status)"

$trackDraft = Invoke-Api -Method POST -Path "/api/distribution/$draftId/track" -Token $token -Body @{
    impressions = 120
    engagement = 18
}
Assert-Success ($trackDraft.success -eq $true) "Distribution tracking failed"
Add-Result -Flow "distribution" -Step "track" -Status "PASS" -Detail "engagement updated"

$exportDraft = Invoke-Api -Method GET -Path "/api/distribution/$draftId/export" -Token $token
Assert-Success ($exportDraft.success -eq $true) "Distribution export failed"
Add-Result -Flow "distribution" -Step "export" -Status "PASS" -Detail "png url generated"

$integrationStatus = Invoke-Api -Method GET -Path "/api/integrations/status" -Token $token
Assert-Success ($integrationStatus.success -eq $true) "Integrations status failed"
Add-Result -Flow "growth" -Step "integration-status" -Status "PASS" -Detail "status endpoint ok"

# Growth publish with no token configured is expected to return 400.
Expect-ApiError -Method POST -Path "/api/integrations/twitter/publish" -Token $token -Body @{
    content = "Smoke publish twitter $timestamp"
    draftId = $draftId
} -ExpectedStatus 400
Add-Result -Flow "growth" -Step "twitter-publish-no-token" -Status "PASS" -Detail "expected 400 without token"

Expect-ApiError -Method POST -Path "/api/integrations/linkedin/publish" -Token $token -Body @{
    content = "Smoke publish linkedin $timestamp"
    draftId = $draftId
} -ExpectedStatus 400
Add-Result -Flow "growth" -Step "linkedin-publish-no-token" -Status "PASS" -Detail "expected 400 without token"

Write-Host ""
Write-Host "Smoke summary:"
$results | Format-Table -AutoSize

$outputPath = Join-Path $PSScriptRoot "smoke_phase4_result_$timestamp.json"
$results | ConvertTo-Json -Depth 5 | Out-File -Encoding UTF8 $outputPath
Write-Host ""
Write-Host "Saved result to $outputPath"
