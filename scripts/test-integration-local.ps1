$ErrorActionPreference = 'Stop'

Write-Host 'Starting local integration Postgres container...'
docker compose -f docker-compose.integration.yml up -d

try {
  Write-Host 'Waiting for Postgres health...'
  $maxAttempts = 30
  $attempt = 0

  while ($attempt -lt $maxAttempts) {
    $attempt++
    $health = docker inspect -f "{{.State.Health.Status}}" ludo-postgres-test 2>$null

    if ($health -eq 'healthy') {
      break
    }

    Start-Sleep -Seconds 2
  }

  if ($health -ne 'healthy') {
    throw 'Postgres container did not become healthy in time.'
  }

  Write-Host 'Running migrations and integration tests...'
  $env:DATABASE_URL = 'disabled'
  $env:DB_HOST = 'localhost'
  $env:DB_PORT = '5433'
  $env:DB_NAME = 'ludo_test'
  $env:DB_USER = 'postgres'
  $env:DB_PASSWORD = 'postgres'
  $env:DB_SSL = 'false'
  $env:NODE_ENV = 'test'

  npm run migrate:test
  npm run test:integration
}
finally {
  Write-Host 'Stopping local integration Postgres container...'
  docker compose -f docker-compose.integration.yml down -v
}
