@echo off
cd /d "%~dp0"  # This will set the directory to where the batch file is located
npm run dev
pause
