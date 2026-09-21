/**
 * Build do site da FIPV. HTML, CSS e JS estático, gerado em português (/),
 * espanhol (/es/) e inglês (/en/) a partir de uma fonte só.
 *
 *   node build.mjs                          página inteira em dist/
 *   node build.mjs --preview 02-sobre       só aquela seção, em dist/preview/
 *   node build.mjs --preview 00-header,01-hero
 *
 * Como funciona:
 * - src/index.html é o molde. <!-- @parcial NOME --> puxa src/partials/NOME.html.
 *   Dentro de um parcial, <!-- @incluir ARQ --> puxa src/partials/ARQ.
 *   Trecho entre <!-- @head --> e <!-- /@head --> num parcial vai pro <head>.
 * - CSS: src/css/_*.css primeiro (fontes e base), depois o resto em ordem de
 *   nome. Cada seção tem o seu arquivo com o mesmo nome do parcial.
 * - JS: mesma regra, em src/js.
 * - Outros idiomas (lista em IDIOMAS): todo elemento com data-i18n="chave"
 *   recebe o HTML da chave em src/i18n/<idioma>/*.json. data-i18n-attr=
 *   "alt:chave;aria-label:chave2" troca atributos. Chave sem tradução mantém
 *   o português e aparece no aviso.
 * - Idioma: <a data-idioma="pt|es|en"> recebe o href certo e marca o ativo;
 *   <img data-bandeira-atual> recebe a bandeira do idioma da página.
 * - Links do site.config.json: href="{{links.instagram}}" vazio vira link
 *   pendente (sem href, com data-pendente). Elemento com data-requer="video"
 *   some quando links.video está vazio.
 * - Grava tudo de forma atômica (arquivo temporário e rename), porque vários
 *   agentes podem rodar o preview ao mesmo tempo.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync, copyFileSync, renameSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import * as cheerio from 'cheerio'

const RAIZ = path.dirname(fileURLToPath(import.meta.url))
const P = (...a) => path.join(RAIZ, ...a)
const DIST = P('dist')
const cfg = JSON.parse(readFileSync(P('site.config.json'), 'utf8'))
const avisos = []

// pt é o original (fica na raiz); os outros saem em /<pasta>/
const IDIOMAS = {
  pt: { pasta: '', html: 'pt-BR', og: 'pt_BR' },
  es: { pasta: 'es', html: 'es', og: 'es_PY' },
  en: { pasta: 'en', html: 'en', og: 'en_US' },
}
const url = (l) => (IDIOMAS[l].pasta ? `/${IDIOMAS[l].pasta}/` : '/')

const argPreview = (() => {
  const i = process.argv.indexOf('--preview')
  return i > -1 ? process.argv[i + 1].split(',').map((s) => s.trim()) : null
})()

// ---------------------------------------------------------------- utilidades
function gravar(arq, conteudo) {
  mkdirSync(path.dirname(arq), { recursive: true })
  const tmp = `${arq}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`
  writeFileSync(tmp, conteudo)
  for (let t = 0; t < 20; t++) {
    try {
      renameSync(tmp, arq)
      return
    } catch (e) {
      if (t === 19) throw e
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50)
    }
  }
}

function copiarPasta(de, para) {
  if (!existsSync(de)) return
  mkdirSync(para, { recursive: true })
  for (const nome of readdirSync(de)) {
    if (nome.startsWith('.')) continue
    const a = path.join(de, nome)
    const b = path.join(para, nome)
    const st = statSync(a)
    if (st.isDirectory()) copiarPasta(a, b)
    else if (!existsSync(b) || statSync(b).size !== st.size || statSync(b).mtimeMs < st.mtimeMs) {
      try {
        copyFileSync(a, b)
      } catch {
        /* outro processo copiando o mesmo arquivo: ignora */
      }
    }
  }
}

function lerParcial(nome, pilha = []) {
  const arq = P('src/partials', nome.endsWith('.html') || nome.endsWith('.svg') ? nome : `${nome}.html`)
  if (!existsSync(arq)) {
    avisos.push(`parcial ausente: ${nome}`)
    return `<!-- parcial ${nome} ainda não existe -->`
  }
  if (pilha.includes(nome)) throw new Error(`inclusão circular: ${[...pilha, nome].join(' > ')}`)
  const html = readFileSync(arq, 'utf8')
  return html.replace(/<!--\s*@incluir\s+([\w.\-]+)\s*-->/g, (_, n) => lerParcial(n, [...pilha, nome]))
}

function arquivos(pasta, ext, so = null) {
  if (!existsSync(P(pasta))) return []
  const todos = readdirSync(P(pasta)).filter((f) => f.endsWith(ext))
  const base = todos.filter((f) => f.startsWith('_')).sort()
  const resto = todos.filter((f) => !f.startsWith('_')).sort().filter((f) => !so || so.includes(f.replace(ext, '')))
  return [...base, ...resto]
}

function juntar(pasta, ext, so) {
  return arquivos(pasta, ext, so)
    .map((f) => {
      const c = readFileSync(P(pasta, f), 'utf8')
      if (ext === '.css') {
        const abre = (c.match(/{/g) || []).length
        const fecha = (c.match(/}/g) || []).length
        if (abre !== fecha) avisos.push(`CSS com chaves desbalanceadas: ${f} (${abre} abre, ${fecha} fecha)`)
      }
      return `/* ${f} */\n${c}`
    })
    // no JS, o ";" entre arquivos impede que um IIFE vire chamada do anterior
    .join(ext === '.js' ? '\n;\n' : '\n')
}

function traducoes(lang) {
  const dir = P('src/i18n', lang)
  const dic = {}
  if (!existsSync(dir)) return dic
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    try {
      Object.assign(dic, JSON.parse(readFileSync(path.join(dir, f), 'utf8')))
    } catch (e) {
      avisos.push(`JSON inválido em src/i18n/${lang}/${f}: ${e.message}`)
    }
  }
  return dic
}

// ---------------------------------------------------------------- montagem
function montar(parciais) {
  let html = readFileSync(P('src/index.html'), 'utf8')
  if (parciais) {
    // preview: só o(s) parcial(is) pedido(s); header e rodapé ficam fora do <main>
    const header = parciais.includes('00-header') ? '<!-- @parcial 00-header -->' : ''
    const rodape = parciais.includes('09-rodape') ? '<!-- @parcial 09-rodape -->' : ''
    const meio = parciais
      .filter((n) => n !== '00-header' && n !== '09-rodape')
      .map((n) => `<!-- @parcial ${n} -->`)
      .join('\n')
    html = html.replace(
      /<!--\s*@parcial 00-header\s*-->[\s\S]*<!--\s*@parcial 09-rodape\s*-->/,
      `${header}\n  <main id="conteudo">\n${meio}\n  </main>\n${rodape}`,
    )
  }
  html = html.replace(/<!--\s*@parcial\s+([\w\-]+)\s*-->/g, (_, n) => lerParcial(n))
  // blocos @head dos parciais sobem pro <head>
  const cabeca = []
  html = html.replace(/<!--\s*@head\s*-->([\s\S]*?)<!--\s*\/@head\s*-->/g, (_, c) => {
    cabeca.push(c.trim())
    return ''
  })
  html = html.replace('<!-- @preload-hero -->', cabeca.join('\n  '))
  return html
}

function aplicarConfig(html, versao) {
  const pendentes = new Set()
  html = html
    .replaceAll('{{siteUrl}}', cfg.siteUrl.replace(/\/$/, ''))
    .replaceAll('{{ano}}', String(cfg.ano))
    .replaceAll('{{versao}}', versao)
    .replace(/href="\{\{links\.(\w+)\}\}"/g, (_, k) => {
      const v = cfg.links[k]
      if (v) return `href="${v}"`
      pendentes.add(k)
      return `data-pendente="${k}" role="link" aria-disabled="true"`
    })
    .replace(/\{\{links\.(\w+)\}\}/g, (_, k) => cfg.links[k] || '')
  return { html, pendentes }
}

function idioma(html, lang, dic, faltando) {
  const $ = cheerio.load(html)
  $('html').attr('lang', IDIOMAS[lang].html)

  if (lang !== 'pt') {
    $('[data-i18n]').each((_, el) => {
      const k = $(el).attr('data-i18n')
      if (k in dic) $(el).html(dic[k])
      else faltando.add(`${lang}:${k}`)
    })
    $('[data-i18n-attr]').each((_, el) => {
      for (const par of $(el).attr('data-i18n-attr').split(';')) {
        const [attr, k] = par.split(':').map((s) => s.trim())
        if (!attr || !k) continue
        if (k in dic) $(el).attr(attr, dic[k])
        else faltando.add(`${lang}:${k}`)
      }
    })
  }
  $('[data-i18n]').removeAttr('data-i18n')
  $('[data-i18n-attr]').removeAttr('data-i18n-attr')

  // elementos que dependem de link configurado
  $('[data-requer]').each((_, el) => {
    const k = $(el).attr('data-requer')
    if (!cfg.links[k]) $(el).remove()
    else $(el).removeAttr('data-requer')
  })

  // seletor de idioma
  $('[data-idioma]').each((_, el) => {
    const alvo = $(el).attr('data-idioma')
    $(el).attr('href', url(alvo))
    $(el).attr('hreflang', IDIOMAS[alvo].html)
    $(el).attr('lang', IDIOMAS[alvo].html)
    if (alvo === lang) $(el).attr('aria-current', 'true').addClass('ativo')
    else $(el).removeAttr('aria-current').removeClass('ativo')
  })
  $('[data-bandeira-atual]').attr('src', `/assets/img/bandeiras/${lang}.svg`).removeAttr('data-bandeira-atual')

  // meta de idioma
  const base = cfg.siteUrl.replace(/\/$/, '')
  const outros = Object.keys(IDIOMAS).filter((l) => l !== lang)
  const meta = [
    `<meta property="og:locale" content="${IDIOMAS[lang].og}">`,
    ...outros.map((l) => `<meta property="og:locale:alternate" content="${IDIOMAS[l].og}">`),
  ]
  if (base) {
    meta.unshift(
      `<link rel="canonical" href="${base}${url(lang)}">`,
      ...Object.keys(IDIOMAS).map((l) => `<link rel="alternate" hreflang="${IDIOMAS[l].html}" href="${base}${url(l)}">`),
      `<link rel="alternate" hreflang="x-default" href="${base}/">`,
      `<meta property="og:url" content="${base}${url(lang)}">`,
    )
  }
  let saida = $.html().replace('<!-- @meta-idioma -->', meta.join('\n  '))
  return saida
}

function verificar(html, rotulo) {
  const $ = cheerio.load(html)
  const texto = $('body').text()
  const travessao = texto.match(/.{0,30}[—–].{0,30}/g)
  if (travessao) avisos.push(`[${rotulo}] travessão no texto (regra da casa): ${travessao.slice(0, 4).map((s) => JSON.stringify(s.trim())).join(' | ')}`)
  $('img').each((_, el) => {
    const src = $(el).attr('src') || '?'
    if ($(el).attr('alt') === undefined) avisos.push(`[${rotulo}] img sem alt: ${src}`)
    if (!$(el).attr('width') || !$(el).attr('height')) avisos.push(`[${rotulo}] img sem width/height (salto de layout): ${src}`)
  })
  const ids = {}
  $('[id]').each((_, el) => {
    const id = $(el).attr('id')
    ids[id] = (ids[id] || 0) + 1
  })
  for (const [id, n] of Object.entries(ids)) if (n > 1) avisos.push(`[${rotulo}] id repetido: #${id} (${n}x)`)
  $('a[href^="#"]').each((_, el) => {
    const alvo = $(el).attr('href').slice(1)
    if (alvo && !ids[alvo] && !argPreview) avisos.push(`[${rotulo}] âncora sem destino: #${alvo}`)
  })
}

// ---------------------------------------------------------------- execução
const dics = Object.fromEntries(Object.keys(IDIOMAS).map((l) => [l, l === 'pt' ? {} : traducoes(l)]))
const faltando = new Set()
copiarPasta(P('assets'), path.join(DIST, 'assets'))

const secoes = argPreview
const css = juntar('src/css', '.css', secoes)
const js = juntar('src/js', '.js', secoes)
const versao = createHash('sha1').update(css + js).digest('hex').slice(0, 8)

if (!argPreview) {
  gravar(path.join(DIST, 'assets/css/site.css'), css)
  gravar(path.join(DIST, 'assets/js/site.js'), js)
  // a config entra depois do idioma, pra {{ano}} e {{links.x}} valerem também
  // dentro das traduções
  const montado = montar(null)
  let pendentes
  for (const l of Object.keys(IDIOMAS)) {
    const r = aplicarConfig(idioma(montado, l, dics[l], faltando), versao)
    pendentes ??= r.pendentes
    verificar(r.html, l)
    gravar(path.join(DIST, IDIOMAS[l].pasta, 'index.html'), r.html)
  }
  gravar(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n${cfg.siteUrl ? `Sitemap: ${cfg.siteUrl.replace(/\/$/, '')}/sitemap.xml\n` : ''}`)
  if (cfg.siteUrl) {
    const b = cfg.siteUrl.replace(/\/$/, '')
    gravar(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${Object.keys(IDIOMAS).map((u) => `  <url><loc>${b}${url(u)}</loc>${Object.keys(IDIOMAS).map((l) => `<xhtml:link rel="alternate" hreflang="${IDIOMAS[l].html}" href="${b}${url(l)}"/>`).join('')}</url>`).join('\n')}\n</urlset>\n`)
  }
  if (pendentes.size) avisos.push(`links pendentes em site.config.json: ${[...pendentes].join(', ')}`)
  if (!cfg.siteUrl) avisos.push('siteUrl vazio em site.config.json: sem canonical, sem hreflang absoluto e og:image relativo')
  console.log(`ok ${Object.keys(IDIOMAS).map((l) => `dist/${IDIOMAS[l].pasta ? IDIOMAS[l].pasta + '/' : ''}index.html`).join(', ')} · versão ${versao}`)
} else {
  const nome = argPreview.join('+')
  gravar(path.join(DIST, `preview/css/${nome}.css`), css)
  gravar(path.join(DIST, `preview/js/${nome}.js`), js)
  const montado = montar(argPreview)
    .replace(/\/assets\/css\/site\.css\?v=\{\{versao\}\}/, `/preview/css/${nome}.css?v={{versao}}`)
    .replace(/\/assets\/js\/site\.js\?v=\{\{versao\}\}/, `/preview/js/${nome}.js?v={{versao}}`)
  for (const l of Object.keys(IDIOMAS)) {
    const { html } = aplicarConfig(idioma(montado, l, dics[l], faltando), versao)
    if (l === 'pt') verificar(html, `preview ${nome}`)
    gravar(path.join(DIST, `preview/${nome}${l === 'pt' ? '' : '.' + l}.html`), html)
  }
  console.log(`ok /preview/${nome}.html (+ .es e .en)`)
}

if (faltando.size) avisos.push(`chaves sem tradução (${faltando.size}): ${[...faltando].slice(0, 12).join(', ')}${faltando.size > 12 ? '...' : ''}`)
if (avisos.length) console.log(`AVISOS:\n  ${avisos.join('\n  ')}`)
