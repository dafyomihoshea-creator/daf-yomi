# Build the site with its search-engine pages and publish it to Firebase Hosting (free plan),
# with the security rules. Uses the worker's key in %USERPROFILE%\.dafyomi (never the office
# account). Normally GitHub Actions does this every day; run it by hand after a code change:
#   powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1
$ErrorActionPreference = "Stop"
$keys = Join-Path $env:USERPROFILE ".dafyomi"
$env:GOOGLE_APPLICATION_CREDENTIALS = Join-Path $keys "worker-key.json"
$env:XDG_CONFIG_HOME = Join-Path $keys "fbconfig"   # keeps firebase-tools from using a personal login
$env:VITE_GEMINI_API_KEY = (Get-Content (Join-Path $keys "browser-gemini-key.txt") -Raw).Trim()
$env:VITE_YOUTUBE_API_KEY = (Get-Content (Join-Path $keys "browser-youtube-key.txt") -Raw).Trim()

npx.cmd vite build
if ($LASTEXITCODE -ne 0) { throw "build failed" }
npx.cmd tsx worker/build-static.ts
if ($LASTEXITCODE -ne 0) { throw "static pages failed" }
npx.cmd --yes firebase-tools@14 deploy --only hosting,firestore:rules --project dafyomi-cb680 --non-interactive
if ($LASTEXITCODE -ne 0) { throw "deploy failed" }
Write-Host "DONE: https://daf-yomi-hoshea.web.app"
