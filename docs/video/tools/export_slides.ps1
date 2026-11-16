# PowerPoint: export the presentation deck to 1920x1080 PNG (opened read-only)
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$src = (Get-ChildItem (Join-Path $root "docs") -Filter *.pptx | Select-Object -First 1).FullName
$out = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\work\slides"))
New-Item -ItemType Directory -Force -Path $out | Out-Null
$app = New-Object -ComObject PowerPoint.Application
try {
  $pres = $app.Presentations.Open($src, $true, $false, $false)
  $i = 1
  foreach ($s in $pres.Slides) { $s.Export((Join-Path $out ("s{0:D2}.png" -f $i)), "PNG", 1920, 1080); $i++ }
  $pres.Close()
  Write-Output "exported $($i-1) slides"
} finally {
  $app.Quit()
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($app) | Out-Null
}
