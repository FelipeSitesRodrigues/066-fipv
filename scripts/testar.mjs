/**
 * Testa as interações do site montado (dist/), em português e espanhol:
 * header ao rolar, scrollspy e clique no menu, menu do celular (foco preso,
 * Esc, rolagem travada), seletor de idioma, frases do hero, setas e lightbox
 * da galeria, mapa da expansão. Também acusa erro de console, requisição que
 * falhou, estouro horizontal e português sobrando no /es/.
 *
 * Tira print dos estados que o revisar não mostra (frases 2 e 3 do hero, menu
 * aberto, idioma aberto, lightbox) em revisao/testes/.
 *
 *   node scripts/testar.mjs              precisa do build e do servidor (3066)
 *   node scripts/testar.mjs --movimento  sem forçar reduced motion
 */
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const PASTA = path.join(RAIZ, 'revisao/testes')
mkdirSync(PASTA, { recursive: true })
const base = process.env.BASE_URL ?? 'http://localhost:3066'
const movimento = process.argv.includes('--movimento')
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p))
const nav = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--disable-gpu', '--hide-scrollbars', ...(movimento ? [] : ['--force-prefers-reduced-motion'])],
})

let falhas = 0
const ok = (cond, msg) => {
  console.log(`  ${cond ? 'ok    ' : 'FALHOU'} ${msg}`)
  if (!cond) falhas++
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

async function abrir(rota, largura, altura) {
  const page = await nav.newPage()
  const erros = []
  page.on('console', (m) => m.type() === 'error' && erros.push(m.text().slice(0, 200)))
  page.on('pageerror', (e) => erros.push(`pageerror: ${e.message.slice(0, 200)}`))
  page.on('response', (r) => r.status() >= 400 && erros.push(`${r.status()} ${r.url().replace(base, '')}`))
  const celular = largura < 600
  await page.setViewport({ width: largura, height: altura, deviceScaleFactor: celular ? 2 : 1, isMobile: celular, hasTouch: celular })
  if (!movimento) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await page.goto(base + rota, { waitUntil: 'networkidle2', timeout: 90000 })
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto'
  })
  const $ = (fn, ...a) => page.evaluate(fn, ...a)
  const cabH = await $(() => parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0)
  return { page, erros, $, cabH }
}

async function bloco(nome, fn) {
  try {
    await fn()
  } catch (e) {
    ok(false, `${nome}: ${e.message.split('\n')[0]}`)
  }
}

// ------------------------------------------------------------------ comum
async function comum({ page, erros, $ }, rota, rotulo) {
  await bloco('estouro', async () => {
    const r = await $(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth }))
    ok(r.sw <= r.w + 1, `sem estouro horizontal (${r.sw}px em ${r.w}px)`)
  })
  if (rota.startsWith('/es')) {
    await bloco('espanhol', async () => {
      const r = await $(() => {
        const textos = []
        const andar = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode: (n) => (n.parentElement.closest('script, style, noscript') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
        })
        while (andar.nextNode()) textos.push(andar.currentNode.textContent)
        for (const el of document.querySelectorAll('[alt], [aria-label], [title]')) textos.push(el.getAttribute('alt') || '', el.getAttribute('aria-label') || '', el.getAttribute('title') || '')
        textos.push(document.title, document.querySelector('meta[name=description]')?.content || '')
        const sobras = new Set()
        for (const t of textos) for (const m of t.match(/[\p{L}]*[çãõÇÃÕ][\p{L}]*/gu) || []) if (!/^portugu[êe]s$/i.test(m)) sobras.add(m)
        return { lang: document.documentElement.lang, sobras: [...sobras] }
      })
      ok(r.lang === 'es', `html lang=${r.lang}`)
      ok(!r.sobras.length, `sem português sobrando no /es/${r.sobras.length ? ': ' + r.sobras.slice(0, 12).join(', ') : ''}`)
    })
  }
  const unicos = [...new Set(erros)]
  ok(!unicos.length, `console e rede limpos${unicos.length ? ':\n           ' + unicos.slice(0, 8).join('\n           ') : ''}`)
  await page.close()
}

// ------------------------------------------------------------------ desktop
async function desktop(rota) {
  const rotulo = rota === '/' ? 'pt' : 'es'
  console.log(`\n${rota} · 1440x900`)
  const t = await abrir(rota, 1440, 900)
  const { page, $, cabH } = t

  await bloco('header', async () => {
    ok(!(await $(() => document.documentElement.classList.contains('rolou'))), 'header transparente no topo')
    await $(() => scrollTo(0, 500))
    await esperar(300)
    ok(await $(() => document.documentElement.classList.contains('rolou')), 'header ganha fundo ao rolar (html.rolou)')
  })

  await bloco('menu', async () => {
    // o menu não tem mais 'Início': o topo se testa pelo logo
    for (const id of ['sobre', 'esporte', 'competicoes', 'categorias', 'diretoria', 'galeria', 'contato', 'inicio']) {
      await page.click(id === 'inicio' ? '.cab__marca' : `.cab__link[href="#${id}"]`)
      await esperar(450)
      const r = await $((id) => {
        const topo = document.getElementById(id).getBoundingClientRect().top
        return {
          topo: Math.round(topo),
          ativo: document.querySelector('.cab__link.ativo')?.getAttribute('href'),
          fim: innerHeight + scrollY >= document.documentElement.scrollHeight - 2,
        }
      }, id)
      const encosta = id === 'inicio' ? r.topo === 0 : r.fim || Math.abs(r.topo - cabH) < 8
      ok((id === 'inicio' || r.ativo === `#${id}`) && encosta, `menu #${id}: ativo ${r.ativo}, topo da seção ${r.topo}px (header ${Math.round(cabH)}px)`)
    }
  })

  await bloco('idioma', async () => {
    await $(() => scrollTo(0, 0))
    await esperar(200)
    await page.click('.cab__idioma-btn')
    await esperar(300)
    const aberto = () =>
      $(() => {
        const b = document.querySelector('.cab__idioma-btn')
        const m = document.querySelector('.cab__idioma-menu')
        const cs = getComputedStyle(m)
        return b.getAttribute('aria-expanded') === 'true' && cs.visibility !== 'hidden' && cs.opacity !== '0' && m.getBoundingClientRect().height > 20
      })
    ok(await aberto(), 'seletor de idioma abre')
    await page.screenshot({ path: path.join(PASTA, `idioma-1440-${rotulo}.png`), clip: { x: 900, y: 0, width: 540, height: 260 } })
    await page.keyboard.press('Escape')
    await esperar(300)
    ok(!(await aberto()) && (await $(() => document.activeElement?.classList.contains('cab__idioma-btn'))), 'Esc fecha e o foco volta pro botão')
    await page.click('.cab__idioma-btn')
    await esperar(200)
    await page.mouse.click(300, 820)
    await esperar(300)
    ok(!(await aberto()), 'clique fora fecha')
    const hrefs = await $(() => [...document.querySelectorAll('.cab__idioma-menu a')].map((a) => a.getAttribute('href')).join(' '))
    ok(hrefs === '/ /es/', `links de idioma: ${hrefs}`)
  })

  await hero(t, 1440, rotulo)
  await galeria(t, 1440, rotulo)

  await bloco('expansão', async () => {
    await $(() => document.getElementById('expansao').scrollIntoView())
    await esperar(700)
    const r = await $(() => ({
      visivel: document.querySelector('.exp__mapa')?.classList.contains('visivel'),
      rotas: document.querySelectorAll('.mapa-arcos__rota').length,
      desenhadas: [...document.querySelectorAll('.mapa-arcos__rota')].filter((p) => parseFloat(getComputedStyle(p).strokeDashoffset || '0') < 0.01).length,
    }))
    ok(r.visivel && r.rotas === 8, `mapa da expansão visível com ${r.rotas} rotas`)
    if (!movimento) ok(r.desenhadas === r.rotas, `rotas desenhadas no estado final (${r.desenhadas}/${r.rotas})`)
  })

  await bloco('números', async () => {
    await $(() => document.getElementById('numeros').scrollIntoView())
    await esperar(2200)
    const r = await $(() => [...document.querySelectorAll('#numeros .num__item')].map((li) => li.innerText.replace(/\s+/g, ' ').trim()))
    ok(r.length === 4 && r.some((s) => s.includes('25+')), `números: ${r.join(' | ')}`)
  })

  await comum(t, rota, rotulo)
}

// ------------------------------------------------------------------ hero
async function hero({ page, $ }, largura, rotulo) {
  await bloco('hero', async () => {
    await $(() => scrollTo(0, 0))
    await esperar(200)
    const tracos = await page.$$('.hero__traco')
    ok(tracos.length === 3, `${tracos.length} tracinhos no hero`)
    for (const i of [1, 2, 0]) {
      await tracos[i].click()
      await esperar(movimento ? 2000 : 300)
      const r = await $(() => {
        const f = document.querySelector('.hero__frase.ativa')
        const cs = getComputedStyle(f)
        const box = f.getBoundingClientRect()
        const hero = document.querySelector('.hero').getBoundingClientRect()
        return {
          ativa: f?.dataset.frase,
          atual: [...document.querySelectorAll('.hero__traco')].findIndex((t) => t.getAttribute('aria-current') === 'true'),
          h1: document.querySelector('h1').getAttribute('aria-hidden'),
          visivel: box.width > 0 && cs.visibility !== 'hidden' && cs.opacity !== '0',
          dentro: box.left >= -1 && box.right <= innerWidth + 1 && box.top >= hero.top - 1 && box.bottom <= hero.bottom + 1,
        }
      })
      ok(r.ativa === String(i) && r.atual === i && r.h1 === null && r.visivel && r.dentro, `frase ${i + 1}: ativa ${r.ativa}, tracinho ${r.atual}, visível ${r.visivel}, dentro do hero ${r.dentro}`)
      if (i) await page.screenshot({ path: path.join(PASTA, `hero-${largura}-${rotulo}-frase${i + 1}.png`) })
    }
  })
}

// ------------------------------------------------------------------ galeria
async function galeria({ page, $ }, largura, rotulo) {
  await bloco('galeria', async () => {
    await $(() => document.getElementById('galeria').scrollIntoView({ block: 'center' }))
    await esperar(600)
    const setas = () =>
      $(() => {
        const f = document.querySelector('.gal__faixa')
        return {
          ant: document.querySelector('.gal__seta--ant').disabled,
          prox: document.querySelector('.gal__seta--prox').disabled,
          cabe: f.scrollWidth <= f.clientWidth + 2,
          x: Math.round(f.scrollLeft),
        }
      })
    let s = await setas()
    if (s.cabe) ok(s.ant && s.prox, 'faixa cabe inteira: as duas setas desligadas')
    else {
      ok(s.ant && !s.prox, 'faixa com rolagem: só a seta de avançar ligada no começo')
      await page.click('.gal__seta--prox')
      await esperar(900)
      const s2 = await setas()
      ok(s2.x > s.x && !s2.ant, `seta avança a faixa (${s.x} → ${s2.x}px) e liga a de voltar`)
    }
    await page.click('.gal__abrir')
    await esperar(700)
    ok(await $(() => document.querySelector('.gal__caixa').open), 'lightbox abre')
    await page.keyboard.press('ArrowRight')
    await esperar(900)
    const r = await $(() => {
      const g = document.querySelector('.gal__grande')
      return { n: document.querySelector('.gal__contador').textContent, w: g.naturalWidth, alt: g.alt }
    })
    ok(r.n === '02 / 04' && r.w > 0 && r.alt, `seta do teclado troca a foto (${r.n}, ${r.w}px, alt "${r.alt.slice(0, 40)}")`)
    await page.screenshot({ path: path.join(PASTA, `lightbox-${largura}-${rotulo}.png`) })
    await page.keyboard.press('Escape')
    await esperar(400)
    ok(await $(() => !document.querySelector('.gal__caixa').open && document.activeElement === document.querySelector('.gal__abrir')), 'Esc fecha e o foco volta pra miniatura')
  })
}

// ------------------------------------------------------------------ celular
async function celular(rota, largura, altura) {
  const rotulo = rota === '/' ? 'pt' : 'es'
  console.log(`\n${rota} · ${largura}x${altura}`)
  const t = await abrir(rota, largura, altura)
  const { page, $, cabH } = t

  await bloco('menu do celular', async () => {
    const estado = () =>
      $(() => ({
        exp: document.querySelector('.cab__abrir').getAttribute('aria-expanded'),
        trava: document.documentElement.classList.contains('cab-travado'),
        inerte: document.querySelector('main').inert,
        foco: document.activeElement?.className || '',
        cobre: (() => {
          const n = document.querySelector('.cab__nav')
          const r = n.getBoundingClientRect()
          const cs = getComputedStyle(n)
          return r.width >= innerWidth - 1 && r.height >= innerHeight * 0.9 && cs.visibility !== 'hidden' && cs.opacity !== '0'
        })(),
      }))
    ok(await (await page.$('.cab__abrir')).isVisible(), 'botão do menu visível')
    await page.click('.cab__abrir')
    await esperar(600)
    let r = await estado()
    ok(r.exp === 'true' && r.trava && r.inerte && r.cobre, `menu abre em tela cheia, trava a rolagem e deixa o resto inerte (${JSON.stringify(r)})`)
    // aberto por toque/mouse o foco vai pro próprio menu (sem anel no 1º link); por teclado, pro 1º link
    ok(/cab__(link|nav)/.test(r.foco), `foco entra no menu (${r.foco})`)
    await page.screenshot({ path: path.join(PASTA, `menu-${largura}-${rotulo}.png`) })
    for (let i = 0; i < 14; i++) await page.keyboard.press('Tab')
    ok(await $(() => document.querySelector('.cab').contains(document.activeElement)), 'foco continua no menu depois de 14 Tabs')
    await page.keyboard.press('Escape')
    await esperar(500)
    r = await estado()
    ok(r.exp === 'false' && !r.trava && !r.inerte && /cab__abrir/.test(r.foco), 'Esc fecha e devolve o foco pro botão')
    await page.click('.cab__abrir')
    await esperar(600)
    await page.click('.cab__link[href="#galeria"]')
    await esperar(900)
    const g = await $(() => ({ exp: document.querySelector('.cab__abrir').getAttribute('aria-expanded'), topo: Math.round(document.getElementById('galeria').getBoundingClientRect().top) }))
    ok(g.exp === 'false' && Math.abs(g.topo - cabH) < 8, `link do menu fecha e leva à galeria (topo ${g.topo}px, header ${Math.round(cabH)}px)`)
  })

  await hero(t, largura, rotulo)
  await galeria(t, largura, rotulo)
  await comum(t, rota, rotulo)
}

try {
  for (const rota of ['/', '/es/']) {
    await desktop(rota)
    await celular(rota, 390, 844)
  }
  await celular('/', 1024, 768)
  await celular('/', 768, 1024)
} finally {
  await nav.close()
}
console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntudo certo')
process.exitCode = falhas ? 1 : 0
