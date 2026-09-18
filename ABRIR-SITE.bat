@echo off
rem Abre o site da FIPV no navegador. Dois cliques e pronto.
rem O site usa caminhos do tipo /assets/..., que só funcionam servidos
rem (por isso não dá pra abrir o index.html direto do disco).
cd /d "%~dp0"
start "Servidor FIPV (feche esta janela pra desligar)" /min node scripts\serve.mjs 3066
timeout /t 2 /nobreak >nul
start "" http://localhost:3066
