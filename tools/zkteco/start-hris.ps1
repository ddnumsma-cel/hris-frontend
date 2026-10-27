# Starts the MSMA HRIS backend (port 4000) and the ZKTeco https helper (port 4443) after Windows sign-in, then keeps
# watching: if the office Wi-Fi is down it waits for it, and if the laptop's office address changes or either program
# stops, it starts it again. Run by the "HRIS autostart" shortcut in the Startup folder.
# PostgreSQL starts on its own as a Windows service. To stop autostart: delete that shortcut. Logs: .\logs\

$ErrorActionPreference = 'Continue'
$here = $PSScriptRoot
$backend = 'C:\Users\admin\Documents\Projects\hris-frontend\backend'
$logs = Join-Path $here 'logs'
function Day { Get-Date -Format 'yyyy-MM-dd' }
function Say($msg) { "$(Get-Date -Format 'HH:mm:ss') $msg" | Out-File -FilePath (Join-Path $logs "start-$(Day).log") -Append -Encoding utf8 }
function Listening($port) { [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) }
function ListeningOn($port, $ip) { [bool](Get-NetTCPConnection -LocalPort $port -LocalAddress $ip -State Listen -ErrorAction SilentlyContinue) }
function OfficeIp { (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -like '192.168.1.*' } | Select-Object -First 1).IPAddress }

function Start-Backend($build) {
  if ($build) {
    Say 'Backend: building'
    Push-Location $backend
    & pnpm --filter @msma/api build *>> (Join-Path $logs "build-$(Day).log")
    Pop-Location
  }
  Say 'Backend: starting'
  Start-Process -FilePath 'node' -ArgumentList 'dist/main.js' -WorkingDirectory (Join-Path $backend 'apps\api') `
    -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs "api-$(Day).log") -RedirectStandardError (Join-Path $logs "api-errors-$(Day).log")
}

function Start-Helper {
  Say 'Helper: starting'
  Start-Process -FilePath 'node' -ArgumentList 'zkteco-https-helper.cjs' -WorkingDirectory $here -PassThru `
    -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs "helper-$(Day).log") -RedirectStandardError (Join-Path $logs "helper-errors-$(Day).log")
}

# Only one copy watches at a time (e.g. if the shortcut is double-clicked twice).
$mutex = New-Object System.Threading.Mutex($false, 'Local\MSMA-HRIS-autostart')
if (-not $mutex.WaitOne(0)) { Say 'Already running in another window: this copy exits'; exit }

Say 'Sign-in: starting HRIS'

# 1. The backend doesn't need the Wi-Fi (the phone preview and this PC use it locally), so start it first.
if (Listening 4000) { Say 'Backend: already running on port 4000' } else { Start-Backend $true }

# 2. Then keep watching, every 15 seconds.
$helper = $null      # the helper this script started (so it can be restarted on a new address)
$helperIp = $null    # the office address it was started for
$waitingSaid = $false
while ($true) {
  $ip = OfficeIp

  if (-not $ip) {
    # No office Wi-Fi: the ZKTeco keeps its punches and sends them when the helper is back.
    if (-not $waitingSaid) { Say 'Office Wi-Fi not connected: waiting for it (punches wait on the device)'; $waitingSaid = $true }
  } else {
    if ($waitingSaid) { Say "Office Wi-Fi back: $ip"; $waitingSaid = $false }

    if (-not (ListeningOn 4443 $ip)) {
      if ($helper -and -not $helper.HasExited) {
        Say "Office address changed ($helperIp -> $ip): restarting helper"
        Stop-Process -Id $helper.Id -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
      } elseif (Listening 4443) {
        # A helper started by someone else is running on another address; leave it, but say so once per change.
        if ($helperIp -ne $ip) { Say "Helper on port 4443 is not on the office address $ip (started by hand?)"; $helperIp = $ip }
        Start-Sleep -Seconds 15
        continue
      }
      $helper = Start-Helper
      $helperIp = $ip
      Start-Sleep -Seconds 3
      Say ("Helper on ${ip}:4443: " + $(if (ListeningOn 4443 $ip) { 'running' } else { 'NOT running - see helper-errors log' }))
    }
  }

  if (-not (Listening 4000)) {
    Say 'Backend stopped: starting it again'
    Start-Backend $false
  }

  Start-Sleep -Seconds 15
}
