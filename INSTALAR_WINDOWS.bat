@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (echo Instale Node.js 22 y vuelva a intentar.& pause & exit /b 1)
if not exist backend\.env copy backend\.env.example backend\.env >nul
cd backend
call npm ci
if errorlevel 1 (pause & exit /b 1)
cd ..\frontend
call npm ci
if errorlevel 1 (pause & exit /b 1)
echo Instalacion terminada. Configure backend\.env siguiendo LEEME_PRIMERO.txt.
pause
