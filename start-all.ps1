param(
  [switch]$NoTunnel,
  [switch]$Seed
)

$ErrorActionPreference = "Continue"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RootDir

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  UTS-TNE Room Booking Portal - Launcher" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# Free ports 3000 and 5174 if already in use
foreach ($port in @(3000, 5174)) {
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    if ($c.OwningProcess -gt 0) {
      Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  }
}

# Optional: Run Prisma seed against Supabase
if ($Seed) {
  Write-Host "[0/3] Seeding Supabase database (Rooms 601, 602, 605 and accounts)..." -ForegroundColor Yellow
  Push-Location "$RootDir\backend"
  npx tsx prisma/seed.ts
  Pop-Location
  Write-Host ""
}

# 1. Start ExpressJS Backend on Port 3000
Write-Host "[1/3] Starting ExpressJS Backend (http://127.0.0.1:3000/api/v1)..." -ForegroundColor Green
$BackendDir = Join-Path $RootDir "backend"
Start-Process powershell.exe -WorkingDirectory $BackendDir -ArgumentList "-NoExit", "-Command", "pnpm start"

Start-Sleep -Seconds 2

# 2. Start Vite Frontend on Port 5174
Write-Host "[2/3] Starting Vite Frontend (http://127.0.0.1:5174)..." -ForegroundColor Green
$FrontendDir = Join-Path $RootDir "frontend"
Start-Process powershell.exe -WorkingDirectory $FrontendDir -ArgumentList "-NoExit", "-Command", "npm run dev -- --port 5174 --host 127.0.0.1 --strictPort"

Start-Sleep -Seconds 2

# 3. Start Cloudflare Tunnel (unless -NoTunnel is passed)
if (-not $NoTunnel) {
  $cf = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($null -ne $cf) {
    Write-Host "[3/3] Starting Cloudflare Tunnel -> http://127.0.0.1:5174 ..." -ForegroundColor Green
    Start-Process powershell.exe -WorkingDirectory $RootDir -ArgumentList "-NoExit", "-Command", "cloudflared tunnel --url http://127.0.0.1:5174"
  } else {
    Write-Host "[3/3] cloudflared not found in PATH - skipping tunnel." -ForegroundColor Yellow
  }
} else {
  Write-Host "[3/3] Skipping Cloudflare Tunnel (-NoTunnel)." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  All Services Activated!" -ForegroundColor Green
Write-Host "----------------------------------------------------------"
Write-Host "  Local Portal : http://127.0.0.1:5174"
Write-Host "  Backend API  : http://127.0.0.1:3000/api/v1/health/ready"
Write-Host "  Public URL   : Check the Cloudflare Tunnel window for the *.trycloudflare.com link"
Write-Host "----------------------------------------------------------"
Write-Host "  Test Accounts:"
Write-Host "    Student 1  : student@tne.edu.vn  / Student123456!"
Write-Host "    Student 2  : student2@tne.edu.vn / Student123456!"
Write-Host "    Manager    : manager@tne.edu.vn  / Manager123456!"
Write-Host "    Admin      : admin@tne.edu.vn    / Admin12345678!"
Write-Host "==========================================================" -ForegroundColor Cyan
