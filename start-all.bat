@echo off
title UTS-TNE Portal Launcher
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-all.ps1" %*
pause
