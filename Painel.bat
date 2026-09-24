@echo off
setlocal
title VIVA - Painel de QA
rem Abre o Painel de QA local (http://localhost:5199/painel.html).
rem O painel precisa do servidor de desenvolvimento (Vite): se ele nao estiver rodando, este .bat
rem abre uma janela "VIVA - servidor do painel" com ele. Feche essa janela para desligar o servidor.
set "PROJ=%~dp0"
if "%PROJ:~-1%"=="\" set "PROJ=%PROJ:~0,-1%"
set "URL=http://localhost:5199/painel.html"
pushd "%PROJ%"

if not exist "painel.html" (
  echo O painel nao existe nesta copia do projeto.
  echo Ele esta no branch "claude/painel-qa". Rode:  git checkout claude/painel-qa
  pause
  popd
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale em https://nodejs.org e tente novamente.
  pause
  popd
  exit /b 1
)

if not exist node_modules (
  echo Instalando dependencias pela primeira vez, aguarde...
  call npm install
)

rem Servidor ja esta no ar? Entao so abre o navegador.
curl -s -o nul "%URL%" >nul 2>nul
if not errorlevel 1 goto abrir

echo Iniciando o servidor do painel...
start "VIVA - servidor do painel" /min cmd /k "cd /d "%PROJ%" && npx vite --port 5199 --strictPort"

rem Espera o servidor responder (ate ~40 s).
set /a TENT=0
:esperar
timeout /t 1 /nobreak >nul
curl -s -o nul "%URL%" >nul 2>nul
if not errorlevel 1 goto abrir
set /a TENT+=1
if %TENT% lss 40 goto esperar
echo O servidor nao respondeu. Veja a janela "VIVA - servidor do painel" para o erro.
pause
popd
exit /b 1

:abrir
start "" "%URL%"
popd
exit /b 0
