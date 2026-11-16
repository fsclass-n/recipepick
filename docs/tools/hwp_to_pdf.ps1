# Open each generated HWPX in Hancom Hwp (COM), export PDF to docs\pdf, then re-save the HWPX (normalized layout).
# Templates under docs\tools are skipped.
# Notes: export the PDF first (re-saving the open HWPX first makes the PDF export silently produce nothing),
#        and export to an ASCII temp path before moving it to the Korean file name.
param([switch]$NoPdf)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$docs = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$pdfDir = Join-Path $docs "pdf"
New-Item -ItemType Directory -Force -Path $pdfDir | Out-Null
$files = @(Get-ChildItem $docs -Recurse -Filter *.hwpx | Where-Object { $_.FullName -notlike "*\tools\*" } | Sort-Object FullName)
Write-Output ("files: {0}" -f $files.Count)

Get-Process Hwp -ErrorAction SilentlyContinue | Stop-Process -Force
$hwp = New-Object -ComObject HWPFrame.HwpObject
$hwp.SetMessageBoxMode(0x00020021) | Out-Null
try { $hwp.XHwpWindows.Item(0).Visible = $false } catch {}
$failed = 0
try {
  $i = 0
  foreach ($f in $files) {
    $i++
    $tmpPdf = Join-Path $env:TEMP ("hwp_export_{0}.pdf" -f $i)
    Remove-Item $tmpPdf -ErrorAction SilentlyContinue
    $target = Join-Path $pdfDir ($f.BaseName + ".pdf")
    $o = $hwp.Open($f.FullName, "HWPX", "forceopen:true")
    $pdfOk = $true
    if (-not $NoPdf) {
      $null = $hwp.SaveAs($tmpPdf, "PDF", "")
      for ($k = 0; $k -lt 40 -and -not (Test-Path $tmpPdf); $k++) { Start-Sleep -Milliseconds 250 }
      $pdfOk = Test-Path $tmpPdf
      if ($pdfOk) { Move-Item $tmpPdf $target -Force }
    }
    $s = $hwp.SaveAs($f.FullName, "HWPX", "")
    $pages = $hwp.PageCount
    $hwp.Clear(1) | Out-Null
    if ($o -and $s -and $pdfOk) { Write-Output ("  OK   {0}  ({1} pages)" -f $f.Name, $pages) }
    else { Write-Output ("  FAIL {0}  open={1} hwpx={2} pdf={3}" -f $f.Name, $o, $s, $pdfOk); $failed++ }
  }
} finally {
  $hwp.Quit()
  Get-Process Hwp -ErrorAction SilentlyContinue | Stop-Process -Force
}
if ($failed) { exit 1 }
