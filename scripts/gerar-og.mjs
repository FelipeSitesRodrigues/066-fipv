/**
 * Gera assets/img/og.jpg (1200x630), a imagem que aparece quando o link do
 * site é compartilhado (WhatsApp, Instagram, Facebook). Monta em HTML com as
 * fontes do site e tira print no Edge. Precisa do servidor rodando (3066) e de
 * um build feito antes (usa dist/assets).
 *
 * Uso: node scripts/gerar-og.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import sharp from 'sharp'

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/assets/css/site.css">
<style>
  html,body{margin:0;background:#0a0a0a}
  .og{position:relative;width:1200px;height:630px;overflow:hidden;background:#0a0a0a}
  .og img.foto{position:absolute;top:0;left:390px;height:100%;width:auto;
    -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 16%);mask-image:linear-gradient(90deg,transparent 0,#000 16%)}
  .og::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(10,10,10,.96) 0,rgba(10,10,10,.75) 30%,rgba(10,10,10,0) 50%),linear-gradient(0deg,rgba(10,10,10,.7),rgba(10,10,10,0) 40%)}
  .txt{position:absolute;left:64px;top:70px;z-index:2}
  .marca{display:flex;align-items:center;gap:14px}
  .marca img{height:66px;width:auto}
  .marca .fipv{height:34px}
  .k{margin-top:84px;font:500 italic 30px/1 'Barlow Condensed';letter-spacing:.12em;text-transform:uppercase;color:#fff}
  .g{font:italic 400 128px/.92 Anton;text-transform:uppercase;color:#fff;margin-top:14px}
  .g .ouro{background-image:linear-gradient(180deg,#f3d48e,#d8af5e 48%,#a77a2e);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;padding-right:.1em}
  .s{margin-top:22px;font:600 17px/1 Barlow;letter-spacing:.22em;text-transform:uppercase;color:#ededed}
</style></head><body><div class="og">
<img class="foto" src="/assets/img/hero-desktop-1731.webp" alt="">
<div class="txt">
  <div class="marca"><img src="/assets/img/logo-globo-192.webp" alt=""><img class="fipv" src="/assets/img/logo-fipv-320.webp" alt=""></div>
  <div class="k">Da América do Sul para o mundo</div>
  <div class="g">Tem chão,<br><span class="ouro">tem jogo.</span></div>
  <div class="s">Federação Internacional de Pikivoley</div>
</div></div></body></html>`

mkdirSync(path.join(RAIZ, 'dist/preview'), { recursive: true })
writeFileSync(path.join(RAIZ, 'dist/preview/og.html'), html)
const nav = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new' })
const pg = await nav.newPage()
await pg.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 })
await pg.goto('http://localhost:3066/preview/og.html', { waitUntil: 'networkidle0' })
await pg.evaluate(() => document.fonts.ready)
const png = await pg.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1200, height: 630 } })
await nav.close()
await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toFile(path.join(RAIZ, 'assets/img/og.jpg'))
console.log('ok assets/img/og.jpg')
