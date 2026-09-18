/**
 * Gera todas as imagens do site a partir de "../066 - Piki Voley/Recursos Site".
 *
 * - Hero desktop e mobile em WebP, em várias larguras, com JPG de reserva.
 * - Recorte do atleta (com a bola) em WebP com alfa, do MESMO tamanho da foto
 *   do hero. Como o recorte usa os mesmos pixels, ele encaixa por cima da foto
 *   sem costura, com o mesmo object-fit e object-position.
 * - As 4 fotos reais do Vitor, em WebP e JPG. O preto e branco sai por CSS
 *   (filter), assim a mesma foto colorida da galeria vem do cache.
 * - Logo: a marca do globo e a palavra FIPV com fundo transparente. O fundo
 *   preto do JPG vira alfa por "desmultiplicação": alfa = canal mais claro.
 *
 * Grava assets/img/manifesto.json com largura e altura de cada arquivo, pra
 * pôr width e height no HTML e não ter salto de layout.
 *
 * Uso: node scripts/processar-imagens.mjs   (ou npm run imagens)
 */
import sharp from 'sharp'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'

const R = '../066 - Piki Voley/Recursos Site/'
const OUT = 'assets/img/'
const CACHE = 'scripts/.cache/'
mkdirSync(OUT, { recursive: true })
mkdirSync(CACHE, { recursive: true })
const manifesto = {}
const registra = async (arq) => {
  const m = await sharp(OUT + arq).metadata()
  manifesto[arq] = { w: m.width, h: m.height, kb: Math.round(readFileSync(OUT + arq).length / 1024) }
}

async function variantes(origem, nome, larguras, { jpg = true, qualidade = 80 } = {}) {
  const meta = await sharp(origem).metadata()
  for (const l of larguras) {
    const w = Math.min(l, meta.width)
    await sharp(origem).resize({ width: w }).webp({ quality: qualidade, effort: 6 }).toFile(`${OUT}${nome}-${w}.webp`)
    await registra(`${nome}-${w}.webp`)
  }
  if (jpg) {
    const w = Math.min(larguras.at(-1), meta.width)
    await sharp(origem).resize({ width: w }).jpeg({ quality: 82, mozjpeg: true }).toFile(`${OUT}${nome}-${w}.jpg`)
    await registra(`${nome}-${w}.jpg`)
  }
}

// ---------- hero ----------
await variantes(R + 'DESKTOP/05 - IMAGEM HERO.png', 'hero-desktop', [960, 1280, 1731], { qualidade: 78 })
await variantes(R + 'MOBILE/06 - IMAGEM HERO MOBILE.png', 'hero-mobile', [480, 720, 941], { qualidade: 78 })

// ---------- recorte do atleta ----------
// Máscara da IA (cache), depois: só o componente ligado ao atleta principal,
// dentro de uma caixa que exclui árbitro, colega e defensores. A bola não sai
// na máscara da IA, então entra como círculo detectado pela cor amarela.
// A máscara vem de scripts/gerar-mascaras.mjs, que roda em outro processo.
async function mascaraIA(origem, chave) {
  const cache = `${CACHE}ia-${chave}.png`
  if (!existsSync(cache)) throw new Error(`Falta ${cache}. Rode antes: node scripts/gerar-mascaras.mjs`)
  return sharp(cache).extractChannel('alpha').raw().toBuffer({ resolveWithObject: true })
}

async function recorte(origem, chave, { semente, caixa, bola }) {
  const { data: m, info } = await mascaraIA(origem, chave)
  const W = info.width, H = info.height
  // 1. componente conexo a partir da semente (alfa > 110), preso na caixa
  const dentro = (x, y) => x >= caixa[0] && x <= caixa[2] && y >= caixa[1] && y <= caixa[3]
  const comp = new Uint8Array(W * H)
  const pilha = [semente[1] * W + semente[0]]
  while (pilha.length) {
    const i = pilha.pop()
    if (comp[i]) continue
    const x = i % W, y = (i / W) | 0
    if (!dentro(x, y) || m[i] < 60) continue
    comp[i] = 1
    if (x > 0) pilha.push(i - 1)
    if (x < W - 1) pilha.push(i + 1)
    if (y > 0) pilha.push(i - W)
    if (y < H - 1) pilha.push(i + W)
  }
  // 2. dilata 3 px pra recuperar a borda macia da máscara original
  let reg = comp
  for (let k = 0; k < 3; k++) {
    const n = new Uint8Array(W * H)
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x
      n[i] = reg[i] || reg[i - 1] || reg[i + 1] || reg[i - W] || reg[i + W] ? 1 : 0
    }
    reg = n
  }
  // A IA marca cabelo escuro com pouca certeza (cinza na máscara). A curva
  // leva tudo acima de 150 a opaco, senão a cabeça fica transparente.
  const alfa = Buffer.alloc(W * H)
  for (let i = 0; i < W * H; i++) alfa[i] = reg[i] ? Math.round(255 * Math.max(0, Math.min(1, (m[i] - 40) / 110))) : 0
  // 3. bola: pixels amarelos perto do ponto esperado viram um círculo. Usa os
  // percentis 3 e 97 pra não deixar um reflexo solto inflar o raio.
  const { data: rgb } = await sharp(origem).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const xs = [], ys = []
  for (let y = bola[1] - bola[2]; y < bola[1] + bola[2]; y++) for (let x = bola[0] - bola[2]; x < bola[0] + bola[2]; x++) {
    const k = (y * W + x) * 3
    if (rgb[k] > 180 && rgb[k + 1] > 150 && rgb[k + 2] < 100 && rgb[k] - rgb[k + 2] > 110) { xs.push(x); ys.push(y) }
  }
  const pct = (v, p) => v.sort((a, b) => a - b)[Math.floor((v.length - 1) * p)]
  const bx0 = pct(xs, 0.03), bx1 = pct(xs, 0.97), by0 = pct(ys, 0.03), by1 = pct(ys, 0.97)
  const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2, r = Math.max(bx1 - bx0, by1 - by0) / 2 + 3
  for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++) for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
    const d = Math.hypot(x - cx, y - cy)
    const a = Math.max(0, Math.min(1, r + 0.5 - d)) * 255
    const i = y * W + x
    alfa[i] = Math.max(alfa[i], a)
  }
  console.log(`recorte ${chave}: bola em (${cx.toFixed(0)}, ${cy.toFixed(0)}) raio ${r.toFixed(0)}`)
  const rgba = await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).joinChannel(alfa, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer()
  writeFileSync(`${CACHE}recorte-${chave}.png`, rgba)
  return rgba
}

const recMob = await recorte(R + 'MOBILE/06 - IMAGEM HERO MOBILE.png', 'mobile', { semente: [470, 900], caixa: [300, 500, 700, 1345], bola: [715, 605, 55] })
for (const w of [480, 720, 941]) {
  await sharp(recMob).resize({ width: w }).webp({ quality: 82, alphaQuality: 90, effort: 6 }).toFile(`${OUT}hero-mobile-atleta-${w}.webp`)
  await registra(`hero-mobile-atleta-${w}.webp`)
}
// O recorte do desktop não entra: a IA não pegou a cabeça do atleta nessa
// foto. No desktop a foto é deslocada pra direita e o atleta não fica atrás
// do texto, então o recorte não faz falta.

// ---------- fotos reais ----------
await variantes(R + '01 - Imagem Piki Voley ao vivo.jfif', 'foto-01-terra', [480, 800, 1200, 1600])
await variantes(R + '02 - Imagem Piki Voley ao vivo.jfif', 'foto-02-grama', [480, 800, 1200, 1600])
await variantes(R + '03 - Imagem Piki Voley ao vivo.jfif', 'foto-03-noturna', [480, 800, 1097])
await variantes(R + '04 - Imagem Piki Voley ao vivo.jfif', 'foto-04-cabeceio', [480, 800, 1086])

// ---------- logo ----------
// Desmultiplica o preto: alfa = maior canal; cor = canal / alfa.
async function semFundo(origem, extrair, nome, larguras) {
  const { data, info } = await sharp(origem).extract(extrair).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const n = info.width * info.height
  const out = Buffer.alloc(n * 4)
  for (let i = 0; i < n; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2]
    const mx = Math.max(r, g, b)
    const a = mx < 28 ? 0 : Math.min(255, (mx - 28) * (255 / 227)) // corta o ruído do JPG no preto
    const f = a > 0 ? 255 / Math.max(1, mx) : 0
    out[i * 4] = Math.min(255, r * f)
    out[i * 4 + 1] = Math.min(255, g * f)
    out[i * 4 + 2] = Math.min(255, b * f)
    out[i * 4 + 3] = a
  }
  const png = await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).trim({ threshold: 1 }).png().toBuffer()
  for (const w of larguras) {
    await sharp(png).resize({ width: w }).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(`${OUT}${nome}-${w}.webp`)
    await registra(`${nome}-${w}.webp`)
  }
  const wp = larguras[1] ?? larguras[0]
  await sharp(png).resize({ width: wp }).png({ compressionLevel: 9 }).toFile(`${OUT}${nome}-${wp}.png`)
  await registra(`${nome}-${wp}.png`)
  return png
}
// Logo 01: globo em cima, "FIPV" embaixo. Logo 02: "FIPV" + nome em português.
const marca = await semFundo(R + 'LOGOS/01.jfif', { left: 200, top: 40, width: 860, height: 800 }, 'logo-globo', [96, 192, 640])
await semFundo(R + 'LOGOS/02.jfif', { left: 80, top: 320, width: 1160, height: 258 }, 'logo-fipv', [160, 320, 640])

// ---------- ícones do site ----------
async function marcaQuadrada(lado, fundo) {
  const pad = Math.round(lado * (fundo ? 0.14 : 0.04))
  const m = await sharp(marca).resize({ width: lado - pad * 2, height: lado - pad * 2, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer()
  return sharp({ create: { width: lado, height: lado, channels: 4, background: fundo ? { r: 0, g: 0, b: 0, alpha: 1 } : { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: m, left: pad, top: pad }])
    .png()
}
await (await marcaQuadrada(32, false)).toFile(OUT + 'favicon-32.png')
await (await marcaQuadrada(180, true)).toFile(OUT + 'apple-touch-icon.png')
await (await marcaQuadrada(512, true)).toFile(OUT + 'icon-512.png')
for (const f of ['favicon-32.png', 'apple-touch-icon.png', 'icon-512.png']) await registra(f)

writeFileSync(OUT + 'manifesto.json', JSON.stringify(manifesto, null, 2))
console.log(`${Object.keys(manifesto).length} arquivos, manifesto gravado`)
