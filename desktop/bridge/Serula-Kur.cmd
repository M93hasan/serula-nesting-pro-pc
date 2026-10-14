@echo off
setlocal EnableExtensions
title Serula Nesting Pro - Automatic Transfer Bridge
echo Serula aktarim koprusu kuruluyor...
echo Windows yerel erisim izni isterse onaylayin.
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0SetupBundledBridge.ps1" -VerboseLog
if errorlevel 1 goto failed
echo.
echo Kopru hazir! http://127.0.0.1:43842/health
pause
exit /b 0
:failed
echo.
echo Kurulum basarisiz. Log: %LOCALAPPDATA%\SerulaBridge\installation.log
pause
exit /b 1
