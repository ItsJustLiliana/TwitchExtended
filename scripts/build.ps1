$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
node --test tests/*.test.cjs
if ($LASTEXITCODE -ne 0) { throw 'JavaScript tests failed' }
& .\gradlew.bat :app:assembleRelease :app:lintRelease
if ($LASTEXITCODE -ne 0) { throw 'Android build failed' }
New-Item -ItemType Directory -Force dist | Out-Null
$metadata=Get-Content -LiteralPath app/build/outputs/apk/release/output-metadata.json -Raw | ConvertFrom-Json
$apkName="Twitch-Extended-$($metadata.elements[0].versionName).apk"
Copy-Item -LiteralPath app/build/outputs/apk/release/app-release.apk -Destination "dist/$apkName"
$hash = (Get-FileHash -LiteralPath "dist/$apkName" -Algorithm SHA256).Hash.ToLower()
"$hash  $apkName" | Set-Content -LiteralPath dist/SHA256SUMS.txt
