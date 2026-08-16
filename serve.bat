@echo off
cd /d "%~dp0"
start /min python -m http.server 8123
timeout /t 1 >nul
start "" "http://localhost:8123/index.html"
