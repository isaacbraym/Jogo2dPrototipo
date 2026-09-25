@echo off
setlocal
title VIVA - Simulador de Vida
set "GAME=%~dp0"
if "%GAME:~-1%"=="\" set "GAME=%GAME:~0,-1%"
set "PAGE=%GAME%\dist\index.html"

rem Sempre abre a versao MAIS RECENTE do codigo:
rem  1) se estiver no branch main, traz o que foi publicado no GitHub (so avanca, nunca apaga trabalho local);
rem  2) recompila o jogo (dist\index.html) a partir do codigo atual.
rem A versao em execucao aparece no rodape da tela de titulo (data e commit).
pushd "%GAME%"
where git >nul 2>nul
if not errorlevel 1 (
  set "BR="
  for /f %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "BR=%%b"
  call :atualizaGit
)
where npm >nul 2>nul
if errorlevel 1 goto semNode
if not exist node_modules (
  echo Instalando dependencias pela primeira vez, aguarde...
  call npm install
)
echo Preparando a versao mais recente do jogo...
call npm run build >nul 2>nul
if errorlevel 1 echo Aviso: nao foi possivel recompilar agora - abrindo a ultima versao pronta.
popd
goto abrir

:atualizaGit
if /i not "%BR%"=="main" goto :eof
echo Buscando atualizacoes do GitHub...
git pull --ff-only --quiet >nul 2>nul
goto :eof

:semNode
popd
if not exist "%PAGE%" (
  echo Node.js nao encontrado. Instale em https://nodejs.org e tente novamente.
  pause
  exit /b 1
)
echo Node.js nao encontrado: abrindo a ultima versao pronta do jogo.

:abrir
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
