$ErrorActionPreference = "Stop"
$base = "https://second-teacher-production.up.railway.app"

function Api {
    param([string]$Method, [string]$Path, [object]$Body, [string]$Token)
    $uri = "$base$Path"
    $headers = @{ "Content-Type" = "application/json" }
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    $params = @{ Uri = $uri; Method = $Method; Headers = $headers; ContentType = "application/json" }
    if ($Body) { $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress) }
    try {
        $resp = Invoke-RestMethod @params
        return $resp
    } catch {
        $err = $_.ErrorDetails.Message
        if ($err) { Write-Host "ERROR: $err" } else { Write-Host "ERROR: $_" }
        return $null
    }
}

Write-Host "`n=== 1. Login as teacher ==="
$login = Api -Method POST -Path "/auth/login" -Body @{ email = "teacher@secondteacher.dev"; password = "ChangeMe123!" }
$token = $login.data.token
Write-Host "Logged in as $($login.data.user.email) (role: $($login.data.user.role))"

Write-Host "`n=== 2. Create subject: History ==="
$subj = Api -Method POST -Path "/subjects" -Body @{ name = "History" } -Token $token
$subjectId = $subj.data.id
Write-Host "Subject created: $subjectId"

Write-Host "`n=== 3. Create group: Ancient Civilizations ==="
$grp = Api -Method POST -Path "/groups" -Body @{ subjectId = $subjectId; name = "Ancient Civilizations" } -Token $token
$groupId = $grp.data.id
Write-Host "Group created: $groupId"

Write-Host "`n=== 4. Ingest textbook (Theater doc) ==="
$docText = @"
Theater was one of the greatest inventions by Greeks. That is because theater had the influence over the people. That is what helped the Democracy, another great invention, to live on and develop. Ancient Greeks used the theater as a stage to expose people to dilemmas that urged viewers to question their perspectives and actions. Euripides used the tragedy The Trojan Women to show that what Athens did to island of Melos and their women may not be something to be proud of. Comedies were used to mock and expose politicians who one way or another did wrong like in the example of King Creon.

Of course, over millenniums after Greeks, we have now developed new sorts of media that are connected to politics. However, are we using it in the right way? Are they helpful today as they were in the times of Athens? In my opinion, once noble profession of journalism now has lost its dignity. A lot of journalists tell lies to spread propaganda in countries like Russia, China and even the USA. Most mass media is influenced by governments themselves, which already makes them unreliable. People stopped believing what they say, and just like in Athens, developing theater helped develop democracy, today, downfall of journalism is leading to mistrust towards governments and leaders all over the world. For example, purposeful bad image of Muslims in the media, which we can see by the coverage of Israelis attacks on Palestine where they call say certain number of civilians from Palestine died and certain number of civilians from Israel killed in clashes. Even the fact they call it a clash when hundreds of Palestinians die opposed to a dozen Israelis is horrible. So, we can see that media nowadays does not intend to open peoples eyes. They want to keep them shut and see what is shown.

In this case, how do we make sure that media plays the role of theatres in Athens and take responsibility?

How do we make sure that people see the truth when everywhere you look at people see deceptions that are designated lure people in and make them feed off of them?

How can we contribute to the development of just representations of situations happening in the world?
"@

$ingest = Api -Method POST -Path "/rag/sources/textbooks" -Body @{
    subjectId    = $subjectId
    title        = "Theater and Greek Democracy"
    versionLabel = "v1"
    text         = $docText
} -Token $token
Write-Host "Ingested: source=$($ingest.data.source.id), chunks=$($ingest.data.chunksCreated)"

Write-Host "`n=== 5. RAG query tests ==="

$queries = @(
    "What did Euripides write about?",
    "How did theater help democracy in Athens?",
    "What is the connection between journalism and mistrust?",
    "King Creon comedy politicians",
    "Palestine media coverage bias",
    "How can media take responsibility like Athenian theater?"
)

foreach ($q in $queries) {
    Write-Host "`n--- Query: $q ---"
    $hits = Api -Method POST -Path "/rag/query" -Body @{
        query   = $q
        groupId = $groupId
        topK    = 3
    } -Token $token
    if ($hits.data) {
        foreach ($h in $hits.data) {
            $preview = if ($h.text.Length -gt 120) { $h.text.Substring(0,120) + "..." } else { $h.text }
            Write-Host ("  [score={0:N4}] chunk={1} anchor={2}" -f $h.score, $h.chunkId, $h.citation.anchor)
            Write-Host "    $preview"
        }
    } else {
        Write-Host "  (no hits)"
    }
}

Write-Host "`n=== 6. Agent chat test (teacher) ==="
$chat1 = Api -Method POST -Path "/agent/teacher/chat" -Body @{
    message = "According to the textbook, how did Greek theater influence democracy?"
    groupId = $groupId
} -Token $token
if ($chat1.data) {
    Write-Host "Agent response:"
    Write-Host ($chat1.data | ConvertTo-Json -Depth 5)
} else {
    Write-Host "(agent returned no data or errored)"
}

Write-Host "`n=== 7. Agent chat test 2 (teacher) ==="
$chat2 = Api -Method POST -Path "/agent/teacher/chat" -Body @{
    message = "What does the source material say about media coverage of Palestine?"
    groupId = $groupId
} -Token $token
if ($chat2.data) {
    Write-Host "Agent response:"
    Write-Host ($chat2.data | ConvertTo-Json -Depth 5)
} else {
    Write-Host "(agent returned no data or errored)"
}

Write-Host "`n=== Done ==="
