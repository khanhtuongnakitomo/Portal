Write-Host "Stopping UTS-TNE Portal processes (Ports 3000, 5174, and cloudflared)..." -ForegroundColor Yellow

# Stop processes listening on 3000 (Express) and 5174 (Vite)
foreach ($port in @(3000, 5174)) {
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    if ($c.OwningProcess -gt 0) {
      Write-Host "  Stopping PID $($c.OwningProcess) on port $port..."
      Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  }
}

# Stop cloudflared tunnel if running
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "All UTS-TNE Portal services stopped." -ForegroundColor Green
