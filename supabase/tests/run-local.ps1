# Dựng cụm Postgres tạm (cổng 55432), chạy toàn bộ migration rồi chạy kiểm thử hành vi.
# Mỗi file kiểm thử chạy trên một database mới. Không kết nối Supabase thật. Cần PostgreSQL 18 cài sẵn trên máy.
param(
  [string]$PgBin = 'C:\Program Files\PostgreSQL\18\bin',
  [int]$Port = 55432,
  [string[]]$Tests = @('phase3_behaviour.sql', 'phase2_career_fit.sql', 'phase2_career_publish.sql', 'phase2_career_admin.sql', 'phase3_decision_goal.sql')
)
$ErrorActionPreference = 'Continue'
$env:PGCLIENTENCODING = 'UTF8'
$env:PGOPTIONS = '-c client_min_messages=warning'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$data = Join-Path $env:TEMP 'vm_pgtest'
$psql = Join-Path $PgBin 'psql.exe'

if (-not (Test-Path $data)) {
  & (Join-Path $PgBin 'initdb.exe') -D $data -U postgres -A trust -E UTF8 --locale=C | Out-Null
}
& (Join-Path $PgBin 'pg_ctl.exe') -D $data status *> $null
if ($LASTEXITCODE -ne 0) {
  # Không nối ống xuất: tiến trình server giữ ống đó và làm lệnh treo
  Start-Process -FilePath (Join-Path $PgBin 'pg_ctl.exe') -WindowStyle Hidden `
    -ArgumentList @('-D', "`"$data`"", '-o', "`"-p $Port`"", '-l', "`"$(Join-Path $data 'log.txt')`"", 'start')
  Start-Sleep 4
}

foreach ($test in $Tests) {
  & $psql -p $Port -U postgres -q -c 'DROP DATABASE IF EXISTS vm_test;' -c 'CREATE DATABASE vm_test;'
  & $psql -p $Port -U postgres -d vm_test -q -v ON_ERROR_STOP=1 -f (Join-Path $here 'supabase_stub.sql')
  foreach ($file in Get-ChildItem (Join-Path $here '..\migrations\*.sql') | Sort-Object Name) {
    & $psql -p $Port -U postgres -d vm_test -q -v ON_ERROR_STOP=1 -f $file.FullName 2>&1 | Where-Object { $_ -match 'ERROR' }
    if ($LASTEXITCODE -ne 0) { throw "Migration lỗi: $($file.Name)" }
  }
  Write-Output "Migration: tất cả chạy thành công ($test)"
  Push-Location $here
  try {
    & $psql -p $Port -U postgres -d vm_test -v ON_ERROR_STOP=1 -f $test 2>&1 |
      Where-Object { $_ -match 'ok |FAIL|ERROR|Hoàn tất' } | ForEach-Object { ($_ -replace '^.*WARNING:\s*', '') }
    if ($LASTEXITCODE -ne 0) { throw "Kiểm thử hành vi thất bại: $test" }
  } finally {
    Pop-Location
  }
}
