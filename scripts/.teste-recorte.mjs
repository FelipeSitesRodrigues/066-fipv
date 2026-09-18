import { removeBackground } from '@imgly/background-removal-node'
import sharp from 'sharp'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
const R = '../066 - Piki Voley/Recursos Site/'
for (const [arq, saida] of [[R + 'DESKTOP/05 - IMAGEM HERO.png', 'desk'], [R + 'MOBILE/06 - IMAGEM HERO MOBILE.png', 'mob']]) {
  const t = Date.now()
  const blob = await removeBackground(pathToFileURL(path.resolve(arq)).href, { model: 'medium', output: { format: 'image/png', quality: 1 } })
  const buf = Buffer.from(await blob.arrayBuffer())
  await sharp(buf).toFile(`revisao/teste-recorte-${saida}.png`)
  // mostra o alfa sozinho, pra ver a máscara
  await sharp(buf).extractChannel('alpha').toFile(`revisao/teste-mascara-${saida}.png`)
  console.log(saida, 'ok', ((Date.now() - t) / 1000).toFixed(1) + 's')
}
