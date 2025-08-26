# Rada Monitoring Script
# Run this script to check system health

function Test-ServiceHealth {
    param (
        [string]$serviceName,
        [string]$url
    )
    try {
        $response = Invoke-WebRequest -Uri $url -Method Head
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

# Check API endpoints
$services = @{
    "Main API" = "http://localhost:8080/health"
    "Payment Service" = "http://localhost:8081/health"
    "Auth Service" = "http://localhost:8082/health"
}

foreach ($service in $services.GetEnumerator()) {
    $status = Test-ServiceHealth -serviceName $service.Key -url $service.Value
    Write-Host "$($service.Key): $(if ($status) {'Healthy'} else {'Unhealthy'})"
}

# Check database connection
try {
    $dbConn = New-Object System.Data.Odbc.OdbcConnection
    $dbConn.ConnectionString = "Driver={PostgreSQL UNICODE};Server=localhost;Database=rada;Uid=postgres;Pwd=$DB_PASSWORD;"
    $dbConn.Open()
    Write-Host "Database: Connected"
    $dbConn.Close()
} catch {
    Write-Host "Database: Connection Failed"
}

# Check disk space
Get-WmiObject Win32_LogicalDisk | 
    Where-Object { $_.DriveType -eq 3 } |
    Select-Object DeviceID, 
        @{Name="Size(GB)";Expression={[math]::Round($_.Size/1GB,2)}},
        @{Name="FreeSpace(GB)";Expression={[math]::Round($_.FreeSpace/1GB,2)}}
