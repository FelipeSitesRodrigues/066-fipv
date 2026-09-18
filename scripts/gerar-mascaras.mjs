/**
 * Roda a IA de remoção de fundo nas duas fotos do hero e grava o PNG dela em
 * scripts/.cache. Fica num processo separado porque o pacote traz outra versão
 * do sharp, e duas versões no mesmo processo derrubam o libvips.
 *
 * Uso: node scripts/gerar-mascaras.mjs
 */
import { removeBackground } from '@imgly/background-removal-node'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const R = '../066 - Piki Voley/Recursos Site/'
mkdirSync('scripts/.cache', { recursive: true })
for (const [arq, chave] of [[R + 'DESKTOP/05 - IMAGEM HERO.png', 'desktop'], [R + 'MOBILE/06 - IMAGEM HERO MOBILE.png', 'mobile']]) {
  const blob = await removeBackground(pathToFileURL(path.resolve(arq)).href, { model: 'medium', output: { format: 'image/png' } })
  writeFileSync(`scripts/.cache/ia-${chave}.png`, Buffer.from(await blob.arrayBuffer()))
  console.log('ok', chave)
}
