# Jalankan sebagai Administrator PowerShell
# Forward port 8080 dari Windows host ke IP WSL (untuk NAT mode WSL2)

$WSLIP = (wsl hostname -I).Trim().Split(" ")[0]
Write-Host "WSL IP: $WSLIP"

$ports = @(8080, 8443, 162, 3000)

netsh interface portproxy reset
foreach ($p in $ports) {
    netsh interface portproxy add v4tov4 listenport=$p listenaddress=0.0.0.0 connectport=$p connectaddress=$WSLIP
    Write-Host "forwarded 0.0.0.0:$p -> $WSLIP:$p"
}

# buka firewall
$rulename = "NetMon Polije"
if (-not (Get-NetFirewallRule -DisplayName $rulename -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $rulename -Direction Inbound -Action Allow -Protocol TCP -LocalPort ($ports -join ",")
    Write-Host "firewall rule created"
}

netsh interface portproxy show v4tov4
