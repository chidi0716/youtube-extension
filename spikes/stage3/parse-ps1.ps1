# 只解析（不執行）PowerShell 腳本，回報語法錯誤。用法：pwsh -NoProfile -File parse-ps1.ps1 <檔案>...
# 以 -Script 傳入時解析字串本身。
[CmdletBinding(PositionalBinding = $false)]
param(
    [string]$Script,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Files
)
$failed = $false
if ($Script) {
    $tokens = $null; $errors = $null
    [System.Management.Automation.Language.Parser]::ParseInput($Script, [ref]$tokens, [ref]$errors) | Out-Null
    if ($errors.Count -gt 0) {
        $failed = $true
        foreach ($e in $errors) { Write-Host ("<script>:{0}: {1}" -f $e.Extent.StartLineNumber, $e.Message) }
    } else {
        Write-Host 'OK  <script>'
    }
}
foreach ($file in $Files) {
    $tokens = $null; $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($file, [ref]$tokens, [ref]$errors) | Out-Null
    if ($errors.Count -gt 0) {
        $failed = $true
        foreach ($e in $errors) { Write-Host ("{0}:{1}: {2}" -f $file, $e.Extent.StartLineNumber, $e.Message) }
    } else {
        Write-Host ("OK  {0}" -f $file)
    }
}
if ($failed) { exit 1 }
