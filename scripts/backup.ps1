# Rada Backup Script
# Run this script daily to backup critical data

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = ".\backups\$timestamp"

# Create backup directory
New-Item -ItemType Directory -Path $backupPath -Force

# Backup database (requires pg_dump)
if (Get-Command pg_dump -ErrorAction SilentlyContinue) {
    pg_dump -h localhost -U postgres rada > "$backupPath\database.sql"
}

# Backup configuration files
Copy-Item -Path ".\config\*" -Destination "$backupPath\config" -Recurse -Force
Copy-Item -Path ".\certificates\*" -Destination "$backupPath\certificates" -Recurse -Force

# Cleanup old backups (keep last 7 days)
Get-ChildItem ".\backups" | Where-Object {
    $_.PSIsContainer -and $_.LastWriteTime -lt (Get-Date).AddDays(-7)
} | Remove-Item -Recurse -Force
