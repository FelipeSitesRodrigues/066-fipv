/**
 * Gera os gráficos do site que não existem como foto:
 *
 * 1. assets/img/globo-america-do-sul-{520,1000}.webp (seção Sobre): globo em projeção
 *    ortográfica centrado na América do Sul, com a malha de meridianos, os
 *    continentes em traço claro e a América Latina em dourado.
 * 2. assets/img/mapa-pontos.svg (Expansão e fundo de Números): mapa-múndi
 *    pontilhado em dourado claro, fundo transparente. SVG porque comprime ~10x
 *    no servidor e fica nítido em qualquer tela.
 * 3. src/partials/_mapa-arcos.svg (Expansão): camada em SVG com o MESMO
 *    viewBox do mapa, com os arcos saindo de Ciudad del Este e os pinos.
 *    Fica inline no HTML pra poder animar o traço quando a seção aparece.
 * 4. assets/img/bandeira-paraguai.webp (Origem): bandeira ondulada em preto e
 *    branco, com o brasão simplificado. Ondulação e sombra por filtro SVG.
 *
 * Uso: node scripts/gerar-graficos.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import sharp from 'sharp'
import { geoOrthographic, geoPath, geoGraticule10, geoGraticule } from 'd3-geo'
import { feature } from 'topojson-client'
import DottedMap from 'dotted-map'
import puppeteer from 'puppeteer-core'

mkdirSync('assets/img', { recursive: true })
mkdirSync('src/partials', { recursive: true })
const redondo = (d) => d.replace(/(\d+\.\d{2})\d+/g, '$1')

// ------------------------------------------------------------------ 1. globo
{
  const topo = JSON.parse(readFileSync('node_modules/world-atlas/countries-50m.json', 'utf8'))
  const paises = feature(topo, topo.objects.countries).features
  // Códigos ISO numéricos. América do Sul em dourado forte; México, América
  // Central e Caribe em dourado mais claro, como no mockup.
  const sul = new Set(['032', '068', '076', '152', '170', '218', '328', '600', '604', '740', '858', '862', '238'])
  const central = new Set(['484', '084', '320', '340', '222', '558', '188', '591', '192', '332', '214', '388', '630', '044', '780'])
  const L = 1000
  const proj = geoOrthographic().rotate([62, 8, 0]).scale(470).translate([L / 2, L / 2]).clipAngle(90).precision(0.3)
  const path = geoPath(proj)
  const grat = path(geoGraticule().step([20, 20])())
  const outros = paises.filter((f) => !sul.has(f.id) && !central.has(f.id)).map((f) => path(f)).filter(Boolean).join('')
  // Tom de cada país varia um pouco, como no mockup (Brasil mais escuro).
  const tom = { '076': 'url(#ouro-a)', '600': 'url(#ouro-c)', '032': 'url(#ouro-b)', '068': 'url(#ouro-b)', '604': 'url(#ouro-b)' }
  const sulSvg = paises
    .filter((f) => sul.has(f.id))
    .map((f) => `<path d="${redondo(path(f) || '')}" fill="${tom[f.id] || 'url(#ouro-b)'}"/>`)
    .join('')
  const centralSvg = paises.filter((f) => central.has(f.id)).map((f) => path(f)).filter(Boolean).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L} ${L}" role="img" aria-label="Globo com a América do Sul em destaque">
<defs>
<radialGradient id="esfera" cx="38%" cy="32%" r="72%"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".6" stop-color="#f3eee4" stop-opacity=".85"/><stop offset="1" stop-color="#d9cfbc" stop-opacity=".9"/></radialGradient>
<radialGradient id="brilho" cx="30%" cy="24%" r="30%"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<linearGradient id="ouro-a" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="#b8893a"/><stop offset=".55" stop-color="#9c7230"/><stop offset="1" stop-color="#7a5723"/></linearGradient>
<linearGradient id="ouro-b" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#d9b76a"/><stop offset="1" stop-color="#a88346"/></linearGradient>
<linearGradient id="ouro-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6c47a"/><stop offset="1" stop-color="#c29a52"/></linearGradient>
<clipPath id="disco"><circle cx="${L / 2}" cy="${L / 2}" r="470"/></clipPath>
</defs>
<circle cx="${L / 2}" cy="${L / 2}" r="470" fill="url(#esfera)" stroke="#cfc5b1" stroke-width="2"/>
<g clip-path="url(#disco)">
<path d="${redondo(grat)}" fill="none" stroke="#b9ad96" stroke-opacity=".55" stroke-width="1.4"/>
<path d="${redondo(outros)}" fill="#cdbf9f" fill-opacity=".28" stroke="#b3a37f" stroke-opacity=".55" stroke-width="1"/>
<path d="${redondo(centralSvg)}" fill="#dcc48c" fill-opacity=".85" stroke="#fff" stroke-opacity=".5" stroke-width=".8"/>
<g stroke="#f6efdc" stroke-opacity=".7" stroke-width="1.2">${sulSvg}</g>
</g>
<circle cx="${L / 2}" cy="${L / 2}" r="470" fill="url(#brilho)"/>
</svg>`
  writeFileSync('scripts/.cache/globo.svg', svg)
  for (const w of [520, 1000]) {
    await sharp(Buffer.from(svg), { density: 144 }).resize({ width: w }).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(`assets/img/globo-america-do-sul-${w}.webp`)
  }
  console.log('globo ok')
}

// -------------------------------------------------- 2 e 3. mapa pontilhado
{
  const map = new DottedMap({ height: 86, grid: 'vertical' })
  const hub = { lat: -25.51, lng: -54.61, nome: 'Ciudad del Este' }
  const destinos = [
    { lat: 34.05, lng: -118.24, nome: 'Los Angeles' },
    { lat: 25.76, lng: -80.19, nome: 'Miami' },
    { lat: 38.72, lng: -9.14, nome: 'Lisboa' },
    { lat: 41.9, lng: 12.5, nome: 'Roma' },
    { lat: 25.2, lng: 55.27, nome: 'Dubai' },
    { lat: -26.2, lng: 28.05, nome: 'Joanesburgo' },
    { lat: 35.68, lng: 139.69, nome: 'Tóquio' },
    { lat: -33.87, lng: 151.21, nome: 'Sydney' },
  ]
  const svgPontos = map.getSVG({ radius: 0.3, color: '#C7AA68', shape: 'circle', backgroundColor: 'transparent' })
  const vb = svgPontos.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number)
  writeFileSync('assets/img/mapa-pontos.svg', svgPontos.replace(/(\d+\.\d{2})\d+/g, '$1').replace(/\s*\/>/g, '/>').replace(/>\s+</g, '><'))
  const pino = (p) => map.getPin({ lat: p.lat, lng: p.lng })
  const h = pino(hub)
  const arcos = destinos.map((d) => {
    const p = pino(d)
    const mx = (h.x + p.x) / 2
    const my = (h.y + p.y) / 2
    const dist = Math.hypot(p.x - h.x, p.y - h.y)
    // Arco sobe (y menor) proporcional à distância, como rota de voo.
    const cy = my - dist * 0.32
    return { d: `M${h.x.toFixed(2)} ${h.y.toFixed(2)} Q${mx.toFixed(2)} ${cy.toFixed(2)} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`, p, nome: d.nome }
  })
  const camada = `<svg class="mapa-arcos" viewBox="${vb.join(' ')}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="arco-ouro" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#B8862B"/><stop offset=".5" stop-color="#E7C46E"/><stop offset="1" stop-color="#C99A3E"/></linearGradient>
  </defs>
  <g class="mapa-arcos__rotas" fill="none" stroke="url(#arco-ouro)" stroke-width=".32" stroke-linecap="round">
${arcos.map((a, i) => `    <path class="mapa-arcos__rota" style="--i:${i}" pathLength="1" d="${a.d}"><title>${a.nome}</title></path>`).join('\n')}
  </g>
  <g class="mapa-arcos__pinos" fill="#C99A3E">
${arcos.map((a, i) => `    <circle class="mapa-arcos__pino" style="--i:${i}" cx="${a.p.x.toFixed(2)}" cy="${a.p.y.toFixed(2)}" r=".62"/>`).join('\n')}
    <circle class="mapa-arcos__halo" cx="${h.x.toFixed(2)}" cy="${h.y.toFixed(2)}" r="1.9" fill="#C99A3E" fill-opacity=".25"/>
    <circle class="mapa-arcos__origem" cx="${h.x.toFixed(2)}" cy="${h.y.toFixed(2)}" r=".95"/>
  </g>
</svg>
`
  writeFileSync('src/partials/_mapa-arcos.svg', camada)
  console.log('mapa', `viewBox ${vb.join(' ')}`, `origem ${h.x},${h.y}`)
}

// ------------------------------------------------------- 4. bandeira
{
  const W = 900, H = 900
  // Bandeira maior que o quadro, pra ondulação não mostrar borda.
  const estrela = (cx, cy, r) => {
    const pts = []
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const rr = i % 2 ? r * 0.42 : r
      pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`)
    }
    return pts.join(' ')
  }
  const cx = 470, cy = 470
  const folhas = Array.from({ length: 11 }, (_, i) => {
    const a = Math.PI * 0.62 + (i / 10) * Math.PI * 0.76
    const x = cx + 62 * Math.cos(a), y = cy + 62 * Math.sin(a)
    const x2 = cx + 62 * Math.cos(Math.PI - a + Math.PI), y2 = y
    return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="9" ry="4.5" transform="rotate(${((a * 180) / Math.PI + 90).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/><ellipse cx="${(2 * cx - x).toFixed(1)}" cy="${y2.toFixed(1)}" rx="9" ry="4.5" transform="rotate(${(-(a * 180) / Math.PI - 90).toFixed(0)} ${(2 * cx - x).toFixed(1)} ${y2.toFixed(1)})"/>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<filter id="tecido" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.0016 0.0042" numOctaves="1" seed="11" result="ruido"/>
  <feDisplacementMap in="SourceGraphic" in2="ruido" scale="46" xChannelSelector="R" yChannelSelector="G" result="ondulada"/>
  <feGaussianBlur in="ruido" stdDeviation="7" result="relevo"/>
  <feDiffuseLighting in="relevo" surfaceScale="60" diffuseConstant="1.05" lighting-color="#ffffff" result="luz"><feDistantLight azimuth="215" elevation="40"/></feDiffuseLighting>
  <feComposite in="ondulada" in2="luz" operator="arithmetic" k1="1.12" k2="0" k3="0" k4="0" result="sombreada"/>
  <feColorMatrix in="sombreada" type="matrix" values=".30 .55 .15 0 -.02  .30 .55 .15 0 -.02  .30 .55 .15 0 -.02  0 0 0 1 0"/>
</filter>
</defs>
<rect width="${W}" height="${H}" fill="#2b2b2b"/>
<g filter="url(#tecido)"><g transform="rotate(-9 450 450) translate(-20 10)">
  <rect x="-60" y="-60" width="${W + 120}" height="${(H + 120) / 3 + 1}" fill="#D52B1E"/>
  <rect x="-60" y="${-60 + (H + 120) / 3}" width="${W + 120}" height="${(H + 120) / 3 + 1}" fill="#FFFFFF"/>
  <rect x="-60" y="${-60 + (2 * (H + 120)) / 3}" width="${W + 120}" height="${(H + 120) / 3}" fill="#0038A8"/>
  <circle cx="${cx}" cy="${cy}" r="92" fill="#ffffff" stroke="#1a1a1a" stroke-width="3"/>
  <circle cx="${cx}" cy="${cy}" r="80" fill="none" stroke="#D52B1E" stroke-width="14"/>
  <circle cx="${cx}" cy="${cy}" r="72" fill="#ffffff" stroke="#1a1a1a" stroke-width="2"/>
  <g fill="#1f7a3a" stroke="#0f4020" stroke-width="1">${folhas}</g>
  <polygon points="${estrela(cx, cy - 4, 30)}" fill="#F4C300" stroke="#1a1a1a" stroke-width="2"/>
</g></g>
</svg>`
  writeFileSync('scripts/.cache/bandeira.svg', svg)
  // Renderiza no Edge: o libvips do sharp faz a luz em 8 bits e o tecido sai
  // com anéis de curva de nível. O Chrome calcula em ponto flutuante.
  const nav = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new' })
  const pg = await nav.newPage()
  await pg.setViewport({ width: W, height: H })
  await pg.setContent(`<html><body style="margin:0">${svg}</body></html>`)
  const png = await pg.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } })
  await nav.close()
  await sharp(png).resize({ width: 600 }).linear(1.18, -18).webp({ quality: 86 }).toFile('assets/img/bandeira-paraguai.webp')
  console.log('bandeira ok')
}
