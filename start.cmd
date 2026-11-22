@echo off
setlocal
cd /d "%~dp0"

if not defined CHUBB_API_PORT set "CHUBB_API_PORT=5080"
if not defined CHUBB_FRONTEND_PORT set "CHUBB_FRONTEND_PORT=4200"
if not defined CHUBB_KAFKA_PORT set "CHUBB_KAFKA_PORT=9092"

where docker >nul 2>&1
if errorlevel 1 goto missing_tools
where dotnet >nul 2>&1
if errorlevel 1 goto missing_tools
where npm.cmd >nul 2>&1
if errorlevel 1 goto missing_tools
where curl.exe >nul 2>&1
if errorlevel 1 goto missing_tools

docker info >nul 2>&1
if errorlevel 1 (
    echo Docker Desktop is not ready. Open Docker Desktop, wait for it to start, then run start.cmd again.
    exit /b 1
)

if not exist "frontend\node_modules\.bin\ng.cmd" (
    echo Installing frontend dependencies...
    call npm.cmd --prefix frontend ci
    if errorlevel 1 goto failed
)

echo Restoring backend dependencies...
dotnet restore Chubb.sln --locked-mode
if errorlevel 1 goto failed

echo Starting Kafka and waiting for it to become healthy...
docker compose up -d --wait --wait-timeout 120 kafka
if errorlevel 1 goto failed
docker compose up -d --no-deps kafka-init
if errorlevel 1 goto failed
docker compose wait kafka-init
if errorlevel 1 goto failed

set "ASPNETCORE_ENVIRONMENT=Development"
set "DemoAuth__Enabled=true"
set "Kafka__Enabled=true"
set "Kafka__BootstrapServers=localhost:%CHUBB_KAFKA_PORT%"
set "Kafka__Topic=chubb.claims.lifecycle.v1"
set "ConnectionStrings__Claims=Data Source=%~dp0claims.db;Default Timeout=5"

curl.exe --fail --silent --max-time 3 http://localhost:%CHUBB_API_PORT%/health | findstr /C:"CHUBB claims API" >nul
if errorlevel 1 (
    echo Starting the backend with Kafka publishing enabled...
    start "CHUBB Backend" /D "%~dp0src\Chubb.Api" cmd.exe /k "dotnet run --no-restore --no-launch-profile --urls http://localhost:%CHUBB_API_PORT%"
) else (
    echo Backend is already running; using the existing process.
)

call :wait_for http://localhost:%CHUBB_API_PORT%/health
if errorlevel 1 goto failed

curl.exe --fail --silent --max-time 3 http://localhost:%CHUBB_FRONTEND_PORT%/login | findstr /C:"app-root" >nul
if errorlevel 1 (
    echo Starting the Angular frontend...
    start "CHUBB Frontend" /D "%~dp0frontend" cmd.exe /k "npm.cmd start -- --port %CHUBB_FRONTEND_PORT%"
) else (
    echo Frontend is already running; using the existing process.
)

call :wait_for http://localhost:%CHUBB_FRONTEND_PORT%/login
if errorlevel 1 goto failed
call :wait_for http://localhost:%CHUBB_FRONTEND_PORT%/health
if errorlevel 1 goto failed

echo.
echo CHUBB is ready: http://localhost:%CHUBB_FRONTEND_PORT%
echo Choose Customer, Claims Staff or Manager. No password is required.
echo Keep the backend and frontend windows open while testing.
echo Stop them with Ctrl+C in their windows; stop Kafka with docker compose down.
exit /b 0

:wait_for
for /l %%n in (1,1,90) do (
    curl.exe --fail --silent --max-time 3 --output NUL "%~1"
    if not errorlevel 1 exit /b 0
    powershell.exe -NoProfile -NonInteractive -Command "Start-Sleep -Seconds 2"
)
echo Timed out waiting for %~1. Check the service window for errors.
exit /b 1

:missing_tools
echo Docker Desktop, .NET 10, Node.js/npm and curl must be installed and available in PATH.
exit /b 1

:failed
echo CHUBB startup did not finish. Check the error above and the service windows.
echo Existing services and data have been left intact.
exit /b 1
