$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$webViewVersion = '1.0.4129.50'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$outputRoot = Join-Path $projectRoot 'outputs\windows'
$buildRoot = Join-Path $projectRoot 'outputs\.desktop-build'
$portableRoot = Join-Path $outputRoot 'portable'
$packageArchive = Join-Path $buildRoot "Microsoft.Web.WebView2.$webViewVersion.nupkg"
$cachedPackage = Join-Path $projectRoot 'outputs\webview2.nupkg'
$packageRoot = Join-Path $buildRoot "Microsoft.Web.WebView2.$webViewVersion"
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'

foreach ($target in @($outputRoot, $buildRoot)) {
    if (Test-Path -LiteralPath $target) {
        $resolved = (Resolve-Path -LiteralPath $target).Path
        if (-not $resolved.StartsWith((Join-Path $projectRoot 'outputs'), [StringComparison]::OrdinalIgnoreCase)) { throw "Refusing to clean unexpected path: $resolved" }
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
New-Item -ItemType Directory -Force -Path $portableRoot, $buildRoot | Out-Null

Write-Host "Downloading Microsoft WebView2 SDK $webViewVersion..."
if (Test-Path -LiteralPath $cachedPackage) { Copy-Item -LiteralPath $cachedPackage -Destination $packageArchive }
else {
    & curl.exe --ssl-no-revoke --fail --location --retry 3 --output $packageArchive "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/$webViewVersion"
    if ($LASTEXITCODE -ne 0) { throw 'WebView2 SDK download failed.' }
}
Copy-Item -LiteralPath $packageArchive -Destination (Join-Path $buildRoot 'webview2.zip')
Expand-Archive -LiteralPath (Join-Path $buildRoot 'webview2.zip') -DestinationPath $packageRoot -Force

$coreDll = Join-Path $packageRoot 'lib\net462\Microsoft.Web.WebView2.Core.dll'
$formsDll = Join-Path $packageRoot 'lib\net462\Microsoft.Web.WebView2.WinForms.dll'
$loaderDll = Join-Path $packageRoot 'runtimes\win-x64\native\WebView2Loader.dll'
foreach ($required in @($compiler, $coreDll, $formsDll, $loaderDll)) { if (-not (Test-Path -LiteralPath $required)) { throw "Missing build dependency: $required" } }

& $compiler /nologo /target:winexe /optimize+ /platform:x64 "/out:$portableRoot\LMN.exe" "/reference:$coreDll" "/reference:$formsDll" /reference:System.dll /reference:System.Core.dll /reference:System.Drawing.dll /reference:System.Windows.Forms.dll (Join-Path $PSScriptRoot 'Program.cs')
if ($LASTEXITCODE -ne 0) { throw 'LMN desktop compilation failed.' }
Copy-Item -LiteralPath $coreDll, $formsDll, $loaderDll -Destination $portableRoot
New-Item -ItemType Directory -Force -Path (Join-Path $portableRoot 'apps') | Out-Null
Copy-Item -Recurse -Force (Join-Path $projectRoot 'apps\web') (Join-Path $portableRoot 'apps')
Copy-Item -Recurse -Force (Join-Path $projectRoot 'packages') $portableRoot

$payloadArchive = Join-Path $buildRoot 'payload.zip'
Compress-Archive -Path (Join-Path $portableRoot '*') -DestinationPath $payloadArchive -CompressionLevel Optimal
$setupOutput = Join-Path $outputRoot 'LMN_V4_3_0_x64_Setup.exe'
& $compiler /nologo /target:winexe /optimize+ /platform:x64 "/out:$setupOutput" "/resource:$payloadArchive,LMN.Payload.zip" /reference:System.dll /reference:System.Core.dll /reference:System.Windows.Forms.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll /reference:Microsoft.CSharp.dll (Join-Path $PSScriptRoot 'installer\Setup.cs')
if ($LASTEXITCODE -ne 0) { throw 'LMN installer compilation failed.' }

if (-not (Test-Path -LiteralPath (Join-Path $portableRoot 'LMN.exe'))) { throw 'Portable LMN.exe was not produced.' }
if (-not (Test-Path -LiteralPath $setupOutput)) { throw 'LMN_V4_3_0_x64_Setup.exe was not produced.' }
Write-Host "Built portable application: $portableRoot\LMN.exe"
Write-Host "Built installer: $setupOutput"
