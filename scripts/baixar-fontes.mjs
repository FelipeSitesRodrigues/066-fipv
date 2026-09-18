/**
 * Baixa do Google Fonts só o subset latin (cobre português e espanhol) e grava
 * as fontes em assets/fonts, com o @font-face apontando pro próprio site.
 * Fonte no próprio site levou a 047 de 78 a 97 no Lighthouse mobile.
 *
 * Uso: node scripts/baixar-fontes.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const css = readFileSync(new URL('./.google-fonts.css', import.meta.url), 'utf8')
mkdirSync('assets/fonts', { recursive: true })

const blocos = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*{([^}]*)}/g)]
const saida = []
for (const [, subset, corpo] of blocos) {
  if (subset !== 'latin') continue
  const familia = corpo.match(/font-family:\s*'([^']+)'/)[1]
  const estilo = corpo.match(/font-style:\s*(\w+)/)[1]
  const peso = corpo.match(/font-weight:\s*([\d ]+);/)[1].trim()
  const url = corpo.match(/url\(([^)]+)\)/)[1]
  const nome = `${familia.toLowerCase().replace(/\s+/g, '-')}-${peso.replace(' ', '-')}${estilo === 'italic' ? '-italic' : ''}.woff2`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  writeFileSync(`assets/fonts/${nome}`, Buffer.from(await r.arrayBuffer()))
  const range = corpo.match(/unicode-range:\s*([^;]+);/)[1]
  saida.push(
    `@font-face {\n  font-family: '${familia}';\n  font-style: ${estilo};\n  font-weight: ${peso};\n  font-display: swap;\n  src: url('/assets/fonts/${nome}') format('woff2');\n  unicode-range: ${range};\n}`,
  )
  console.log('ok', nome)
}
writeFileSync('src/css/_fontes.css', `/* Gerado por scripts/baixar-fontes.mjs. Não editar à mão. */\n${saida.join('\n')}\n`)
console.log(`${saida.length} fontes, src/css/_fontes.css gravado`)
