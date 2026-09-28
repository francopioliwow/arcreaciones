@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel% equ 0 (
  py -3 probar.py
) else (
  python probar.py
)
pause
