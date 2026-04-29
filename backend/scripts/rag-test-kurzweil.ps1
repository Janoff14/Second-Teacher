$ErrorActionPreference = "Stop"
$base = "https://second-teacher-production.up.railway.app"
$teacherPassword = $env:TEACHER_PASSWORD
if (-not $teacherPassword) {
    throw "Set TEACHER_PASSWORD before running this script."
}

function Api {
    param([string]$Method, [string]$Path, [object]$Body, [string]$Token)
    $uri = "$base$Path"
    $headers = @{ "Content-Type" = "application/json" }
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    $params = @{ Uri = $uri; Method = $Method; Headers = $headers; ContentType = "application/json" }
    if ($Body) {
        $json = ($Body | ConvertTo-Json -Depth 10 -Compress)
        $params.Body = [System.Text.Encoding]::UTF8.GetBytes($json)
    }
    try {
        return Invoke-RestMethod @params
    } catch {
        $err = $_.ErrorDetails.Message
        if ($err) { Write-Host "ERROR: $err" } else { Write-Host "ERROR: $_" }
        return $null
    }
}

Write-Host "=== 1. Login as teacher ==="
$login = Api -Method POST -Path "/auth/login" -Body @{ email = "teacher@secondteacher.dev"; password = $teacherPassword }
$token = $login.data.token
Write-Host "Logged in: $($login.data.user.email)"

Write-Host "`n=== 2. Reuse or create subject + group ==="
$subjects = Api -Method GET -Path "/subjects" -Token $token
$subjectId = ($subjects.data | Where-Object { $_.name -eq "History" } | Select-Object -First 1).id
if (-not $subjectId) {
    $s = Api -Method POST -Path "/subjects" -Body @{ name = "History" } -Token $token
    $subjectId = $s.data.id
    Write-Host "Created subject: $subjectId"
} else {
    Write-Host "Reusing subject: $subjectId"
}

$groups = Api -Method GET -Path "/groups" -Token $token
$groupId = ($groups.data | Where-Object { $_.name -eq "Ancient Civilizations" } | Select-Object -First 1).id
if (-not $groupId) {
    $g = Api -Method POST -Path "/groups" -Body @{ subjectId = $subjectId; name = "Ancient Civilizations" } -Token $token
    $groupId = $g.data.id
    Write-Host "Created group: $groupId"
} else {
    Write-Host "Reusing group: $groupId"
}

Write-Host "`n=== 3. Ingest Kurzweil - The Singularity Is Near ==="
$textPath = Join-Path $PSScriptRoot "_kurzweil_text.txt"
$docText = [System.IO.File]::ReadAllText($textPath, [System.Text.Encoding]::UTF8)
$charCount = $docText.Length
Write-Host "Text length: $charCount chars"

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$ingest = Api -Method POST -Path "/rag/sources/textbooks" -Body @{
    subjectId    = $subjectId
    title        = "The Singularity Is Near - Ray Kurzweil"
    versionLabel = "v1"
    text         = $docText
} -Token $token
$sw.Stop()

if ($ingest) {
    Write-Host "Ingested: source=$($ingest.data.source.id), chunks=$($ingest.data.chunksCreated) (took $($sw.Elapsed.TotalSeconds.ToString('F1'))s)"
} else {
    Write-Host "INGEST FAILED - stopping"
    exit 1
}

Write-Host "`n=== 4. RAG query tests (diverse topics from the book) ==="

$queries = @(
    @{ q = "law of accelerating returns"; desc = "Core thesis - exponential growth" },
    @{ q = "When will computers match human intelligence?"; desc = "2029 prediction" },
    @{ q = "What is a singularity?"; desc = "Definition of the Singularity" },
    @{ q = "nanotechnology in the human body"; desc = "Nanobots and biology" },
    @{ q = "uploading the brain into a computer"; desc = "Mind uploading" },
    @{ q = "GNR genetics nanotechnology robotics"; desc = "Three revolutions" },
    @{ q = "Moore's law transistor density"; desc = "Computational growth" },
    @{ q = "spiritual machines consciousness"; desc = "Consciousness discussion" },
    @{ q = "life expectancy longevity escape velocity"; desc = "Longevity predictions" },
    @{ q = "criticism of the singularity"; desc = "Counterarguments" }
)

foreach ($entry in $queries) {
    Write-Host "`n--- [$($entry.desc)] Query: $($entry.q) ---"
    $hits = Api -Method POST -Path "/rag/query" -Body @{
        query   = $entry.q
        groupId = $groupId
        topK    = 3
    } -Token $token
    if ($hits.data) {
        foreach ($h in $hits.data) {
            $preview = if ($h.text.Length -gt 140) { $h.text.Substring(0, 140) + "..." } else { $h.text }
            Write-Host ("  [score={0:N4}] {1}" -f $h.score, $h.citation.anchor)
            Write-Host "    $preview"
        }
    } else {
        Write-Host "  (no hits)"
    }
}

Write-Host "`n=== 5. Agent chat test ==="
$chat = Api -Method POST -Path "/agent/teacher/chat" -Body @{
    message = "According to Kurzweil, when will machines surpass human intelligence and what evidence does he give for the law of accelerating returns?"
    groupId = $groupId
} -Token $token
if ($chat.data) {
    Write-Host "Agent reply (first 600 chars):"
    $reply = $chat.data.reply
    if ($reply.Length -gt 600) { $reply = $reply.Substring(0, 600) + "..." }
    Write-Host $reply
    Write-Host "`nTools used: $(($chat.data.tools | ForEach-Object { $_.name }) -join ', ')"
    Write-Host "Citations: $($chat.data.citations.Count)"
} else {
    Write-Host "(agent returned no data)"
}

Write-Host "`n=== Done ==="
