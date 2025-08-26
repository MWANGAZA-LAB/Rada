# Windows Setup Configuration for Rada Infrastructure
# PowerShell Configuration Script

# Configuration Settings
$config = @{
    ProjectName = "rada"
    Environments = @("staging", "production")
    SecretsPath = ".\secrets"
    BackupPath = ".\backups"
    LogPath = ".\logs"
}

# Create required directories
$directories = @(
    $config.SecretsPath,
    $config.BackupPath,
    $config.LogPath,
    ".\config",
    ".\certificates"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir | Out-Null
        Write-Host "Created directory: $dir"
    }
}

# Function to generate secure random strings
function New-SecureString {
    param (
        [int]$length = 32
    )
    $characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+'
    $bytes = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes($length)
    $result = ""
    for ($i = 0; $i -lt $length; $i++) {
        $result += $characters[$bytes[$i] % $characters.Length]
    }
    return $result
}

# Generate secrets
$secrets = @{
    "JWT_SECRET" = New-SecureString
    "DB_PASSWORD" = New-SecureString
    "REDIS_PASSWORD" = New-SecureString
    "MPESA_CONSUMER_KEY" = New-SecureString
    "MPESA_CONSUMER_SECRET" = New-SecureString
    "SESSION_SECRET" = New-SecureString
    "ENCRYPTION_KEY" = New-SecureString
}

# Save secrets to files
foreach ($key in $secrets.Keys) {
    $secureFilePath = Join-Path $config.SecretsPath "$key.txt"
    $secrets[$key] | ConvertTo-SecureString -AsPlainText -Force | 
        ConvertFrom-SecureString | 
        Set-Content $secureFilePath
    Write-Host "Generated and saved secret: $key"
}

# Create secrets manifest
$manifestContent = @"
# Rada Secrets Manifest
# Generated: $(Get-Date)

Secrets:
  Application:
    - JWT_SECRET
    - SESSION_SECRET
    - ENCRYPTION_KEY
  
  Database:
    - DB_PASSWORD
    - REDIS_PASSWORD
  
  External:
    - MPESA_CONSUMER_KEY
    - MPESA_CONSUMER_SECRET

Rotation Schedule:
  - JWT_SECRET: 90 days
  - DB_PASSWORD: 180 days
  - Other secrets: 365 days

Security Guidelines:
  1. Never commit secrets to version control
  2. Rotate secrets according to schedule
  3. Use secure channels for distribution
  4. Monitor secret usage and access
"@

$manifestContent | Set-Content (Join-Path $config.SecretsPath "secrets-manifest.txt")

# Create backup script
$backupScript = @"
# Rada Backup Script
# Run this script daily to backup critical data

`$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
`$backupPath = ".\backups\`$timestamp"

# Create backup directory
New-Item -ItemType Directory -Path `$backupPath -Force

# Backup database (requires pg_dump)
if (Get-Command pg_dump -ErrorAction SilentlyContinue) {
    pg_dump -h localhost -U postgres rada > "`$backupPath\database.sql"
}

# Backup configuration files
Copy-Item -Path ".\config\*" -Destination "`$backupPath\config" -Recurse -Force
Copy-Item -Path ".\certificates\*" -Destination "`$backupPath\certificates" -Recurse -Force

# Cleanup old backups (keep last 7 days)
Get-ChildItem ".\backups" | Where-Object {
    `$_.PSIsContainer -and `$_.LastWriteTime -lt (Get-Date).AddDays(-7)
} | Remove-Item -Recurse -Force
"@

$backupScript | Set-Content ".\scripts\backup.ps1"

# Create monitoring script
$monitoringScript = @"
# Rada Monitoring Script
# Run this script to check system health

function Test-ServiceHealth {
    param (
        [string]`$serviceName,
        [string]`$url
    )
    try {
        `$response = Invoke-WebRequest -Uri `$url -Method Head
        return `$response.StatusCode -eq 200
    } catch {
        return `$false
    }
}

# Check API endpoints
`$services = @{
    "Main API" = "http://localhost:8080/health"
    "Payment Service" = "http://localhost:8081/health"
    "Auth Service" = "http://localhost:8082/health"
}

foreach (`$service in `$services.GetEnumerator()) {
    `$status = Test-ServiceHealth -serviceName `$service.Key -url `$service.Value
    Write-Host "`$(`$service.Key): `$(if (`$status) {'Healthy'} else {'Unhealthy'})"
}

# Check database connection
try {
    `$dbConn = New-Object System.Data.Odbc.OdbcConnection
    `$dbConn.ConnectionString = "Driver={PostgreSQL UNICODE};Server=localhost;Database=rada;Uid=postgres;Pwd=`$DB_PASSWORD;"
    `$dbConn.Open()
    Write-Host "Database: Connected"
    `$dbConn.Close()
} catch {
    Write-Host "Database: Connection Failed"
}

# Check disk space
Get-WmiObject Win32_LogicalDisk | 
    Where-Object { `$_.DriveType -eq 3 } |
    Select-Object DeviceID, 
        @{Name="Size(GB)";Expression={[math]::Round(`$_.Size/1GB,2)}},
        @{Name="FreeSpace(GB)";Expression={[math]::Round(`$_.FreeSpace/1GB,2)}}
"@

$monitoringScript | Set-Content ".\scripts\monitor.ps1"

Write-Host "`nSetup completed successfully!"
Write-Host "Important next steps:"
Write-Host "1. Review generated secrets in $($config.SecretsPath)"
Write-Host "2. Configure your database connection strings"
Write-Host "3. Set up scheduled tasks for backup.ps1"
Write-Host "4. Configure monitoring alerts"
Write-Host "`nFor security reasons, please change all generated secrets before going to production."
