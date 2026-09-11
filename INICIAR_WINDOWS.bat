@echo off
setlocal
cd /d "%~dp0"
if not exist backend\.env (echo Ejecute INSTALAR_WINDOWS.bat y configure backend\.env primero.& pause & exit /b 1)
start "Logistic Control API" /D "%~dp0backend" cmd /k npm run dev
start "Logistic Control Web" /D "%~dp0frontend" cmd /k npm run dev -- --host 127.0.0.1 --port 5173
echo Abra http://localhost:5173 cuando ambas ventanas indiquen que iniciaron.
pause
