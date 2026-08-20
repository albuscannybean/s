$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$out = Join-Path $root 'artifacts\windows'
New-Item -ItemType Directory -Force -Path $out | Out-Null
& "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /optimize+ "/out:$out\LMN.exe" "$PSScriptRoot\Program.cs"
Copy-Item -Recurse -Force (Join-Path $root 'apps') $out
Copy-Item -Recurse -Force (Join-Path $root 'packages') $out
Write-Host "Built $out\LMN.exe"
