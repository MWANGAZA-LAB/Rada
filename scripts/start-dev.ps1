# Start Services Script
Write-Host "Starting Rada development environment..."

# Start PostgreSQL
Write-Host "Starting PostgreSQL..."
pg_ctl -D "C:\Users\mwang\Desktop\Rada\data\postgres" -l "C:\Users\mwang\Desktop\Rada\logs\postgres.log" start

# Start Redis
Write-Host "Starting Redis..."
redis-server "C:\Users\mwang\Desktop\Rada\config\redis.windows.conf" --dir "C:\Users\mwang\Desktop\Rada\data\redis"

# Start API server
Write-Host "Starting API server..."
cd services/api-gateway
npm run dev
