@echo off
setlocal
title VIVA - Simulador de Vida
set "GAME=%~dp0"
if "%GAME:~-1%"=="\" set "GAME=%GAME:~0,-1%"
set "PAGE=%GAME%\dist\index.html"

if not exist "%PAGE%" (
  echo Preparando o jogo pela primeira vez, aguarde...
  pushd "%GAME%"
  where npm >nul 2>nul
  if errorlevel 1 (
    echo Node.js nao encontrado. Instale em https://nodejs.org e tente novamente.
    pause
    exit /b 1
  )
  if not exist node_modules call npm install
  call npm run build
  popd
)

if not exist "%PAGE%" (
  echo Nao foi possivel preparar o jogo.
  pause
  exit /b 1
)

rem Abre em janela de aplicativo (Edge ou Chrome) para parecer um jogo de verdade.
set "URL=file:///%PAGE:\=/%"
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
set "EDGE2=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set "CHROME2=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if exist "%CHROME%" goto chrome
if exist "%CHROME2%" goto chrome2
if exist "%EDGE%" goto edge
if exist "%EDGE2%" goto edge2
start "" "%PAGE%"
exit /b 0

:chrome
start "" "%CHROME%" --app="%URL%" --start-maximized
exit /b 0
:chrome2
start "" "%CHROME2%" --app="%URL%" --start-maximized
exit /b 0
:edge
start "" "%EDGE%" --app="%URL%" --start-maximized
exit /b 0
:edge2
start "" "%EDGE2%" --app="%URL%" --start-maximized
exit /b 0