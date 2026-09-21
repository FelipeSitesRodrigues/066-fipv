/* _base.js */
/* FIPV · comportamento global: revelar ao rolar e estado do header.
   Cada seção com comportamento próprio tem o seu arquivo em src/js. */
(() => {
  const raiz = document.documentElement
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)')

  // Revelar ao rolar. Sem suporte ou com movimento reduzido, mostra tudo.
  const alvos = document.querySelectorAll('[data-revelar]')
  if (!('IntersectionObserver' in window) || reduzido.matches) {
    alvos.forEach((el) => el.classList.add('visivel'))
  } else {
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue
          e.target.classList.add('visivel')
          obs.unobserve(e.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    alvos.forEach((el) => obs.observe(el))
  }

  // html.rolou quando a página saiu do topo (o header usa pra ganhar fundo).
  let rolou = null
  const marca = () => {
    const agora = window.scrollY > 8
    if (agora !== rolou) {
      rolou = agora
      raiz.classList.toggle('rolou', agora)
    }
  }
  marca()
  window.addEventListener('scroll', marca, { passive: true })

  // Links pendentes (rede social ou vídeo sem endereço ainda) não navegam.
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest('a[data-pendente]')
    if (a) ev.preventDefault()
  })
})()

;
/* 00-header.js */
/* Header: menu do celular (foco preso, Esc, trava a rolagem), seletor de
   idioma e scrollspy do item ativo. */
;(() => {
  const cab = document.querySelector('.cab')
  if (!cab) return
  const raiz = document.documentElement
  const abrir = cab.querySelector('.cab__abrir')
  const nav = cab.querySelector('.cab__nav')
  const celular = window.matchMedia('(max-width: 1099.98px)')
  const visivel = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'

  // ------------------------------------------------------------ menu do celular
  let menuAberto = false
  // teclado: aberto pelo teclado (Enter/Espaço dão click com detail 0), o foco
  // vai pro primeiro link; por toque ou mouse, vai pro próprio menu, sem
  // acender contorno em nenhum link
  function definirMenu(estado, focar = true, teclado = false) {
    if (!abrir || !nav || estado === menuAberto) return
    menuAberto = estado
    cab.classList.toggle('cab--aberto', estado)
    abrir.setAttribute('aria-expanded', String(estado))
    abrir.setAttribute('aria-label', estado ? abrir.dataset.rotuloFechar : abrir.dataset.rotuloAbrir)
    raiz.classList.toggle('cab-travado', estado)
    // o resto da página fica inerte enquanto o menu cobre a tela
    for (const el of document.body.children) {
      if (el === cab || el.tagName === 'SCRIPT') continue
      el.inert = estado
    }
    if (!focar) return
    if (estado) requestAnimationFrame(() => (teclado ? nav.querySelector('.cab__link') : nav)?.focus({ preventScroll: true }))
    else abrir.focus()
  }
  abrir?.addEventListener('click', (ev) => definirMenu(!menuAberto, true, ev.detail === 0))
  // clicar num link (ou na marca) fecha o menu antes de o navegador rolar
  cab.addEventListener('click', (ev) => {
    if (menuAberto && ev.target.closest('a[href]')) definirMenu(false, false)
  })
  celular.addEventListener('change', (ev) => {
    if (!ev.matches) definirMenu(false, false)
  })

  // --------------------------------------------------------- seletor de idioma
  const caixaIdioma = cab.querySelector('.cab__idioma')
  const btnIdioma = cab.querySelector('.cab__idioma-btn')
  const menuIdioma = cab.querySelector('.cab__idioma-menu')
  let idiomaAberto = false
  const opcoes = () => [...menuIdioma.querySelectorAll('a')]
  function definirIdioma(estado, focarBotao = false) {
    if (!btnIdioma || !menuIdioma) return
    idiomaAberto = estado
    btnIdioma.setAttribute('aria-expanded', String(estado))
    menuIdioma.classList.toggle('aberto', estado)
    if (!estado && focarBotao) btnIdioma.focus()
  }
  btnIdioma?.addEventListener('click', () => definirIdioma(!idiomaAberto))
  btnIdioma?.addEventListener('keydown', (ev) => {
    if (ev.key !== 'ArrowDown') return
    ev.preventDefault()
    definirIdioma(true)
    ;(menuIdioma.querySelector('a.ativo') || opcoes()[0])?.focus()
  })
  menuIdioma?.addEventListener('keydown', (ev) => {
    if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return
    ev.preventDefault()
    const lista = opcoes()
    const i = lista.indexOf(document.activeElement)
    const passo = ev.key === 'ArrowDown' ? 1 : -1
    lista[(i + passo + lista.length) % lista.length]?.focus()
  })
  caixaIdioma?.addEventListener('focusout', (ev) => {
    if (idiomaAberto && !caixaIdioma.contains(ev.relatedTarget)) definirIdioma(false)
  })
  document.addEventListener('click', (ev) => {
    if (idiomaAberto && !ev.target.closest('.cab__idioma')) definirIdioma(false)
  })

  // ------------------------------------------------------ teclado: Esc e Tab
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      if (idiomaAberto) definirIdioma(false, true)
      if (menuAberto) definirMenu(false)
      return
    }
    if (ev.key !== 'Tab' || !menuAberto) return
    const lista = [...cab.querySelectorAll('a[href], button:not([disabled])')].filter(visivel)
    if (!lista.length) return
    const primeiro = lista[0]
    const ultimo = lista[lista.length - 1]
    if (ev.shiftKey && (document.activeElement === primeiro || !cab.contains(document.activeElement))) {
      ev.preventDefault()
      ultimo.focus()
    } else if (!ev.shiftKey && (document.activeElement === ultimo || !cab.contains(document.activeElement))) {
      ev.preventDefault()
      primeiro.focus()
    }
  })

  // --------------------------------------------------------------- scrollspy
  const links = [...cab.querySelectorAll('.cab__link')]
  const pares = links
    .map((a) => [a, document.getElementById(decodeURIComponent(a.hash.slice(1)))])
    .filter(([, secao]) => secao)
  let pedido = 0
  function espiar() {
    pedido = 0
    if (!pares.length) return
    const linha = window.innerHeight * 0.38
    let ativo = pares[0][0]
    for (const [a, secao] of pares) if (secao.getBoundingClientRect().top <= linha) ativo = a
    const fim = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
    if (fim && window.scrollY > 0) ativo = pares[pares.length - 1][0]
    for (const a of links) {
      const sim = a === ativo
      a.classList.toggle('ativo', sim)
      if (sim) a.setAttribute('aria-current', 'location')
      else a.removeAttribute('aria-current')
    }
  }
  const agendar = () => {
    if (!pedido) pedido = requestAnimationFrame(espiar)
  }
  window.addEventListener('scroll', agendar, { passive: true })
  window.addEventListener('resize', agendar)
  window.addEventListener('load', agendar)
  espiar()
})()

;
/* 01-hero.js */
/* Hero: troca de frase a cada ~7 s (sempre sobre a mesma foto), tracinhos
   clicáveis e lightbox do vídeo. O tempo de cada frase é a própria animação
   da barrinha de progresso: pausar a barra pausa a troca. */
;(() => {
  const hero = document.querySelector('.hero')
  if (!hero) return
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)')
  const frases = [...hero.querySelectorAll('.hero__frase')]
  const tracos = [...hero.querySelectorAll('.hero__traco')]
  const bloco = hero.querySelector('.hero__frases')
  const grupoTracos = hero.querySelector('.hero__tracos')

  // fim da entrada: tira a classe pra a animação não voltar quando a frase 1
  // reaparecer depois de uma volta
  const fimIntro = () => hero.classList.remove('hero--intro')
  if (reduzido.matches) fimIntro()
  else setTimeout(fimIntro, 3300)

  // ------------------------------------------------------------ troca de frase
  let atual = 0
  let limpeza = 0
  let tApoio = 0
  // A pilha (desktop) e o subtítulo (celular) repetem as frases 2 e 3. Quando
  // uma delas entra, a parte repetida sai (CSS por [data-atual]); a troca
  // acontece no meio de um apagar e acender, pra não pular.
  function apoio(n, animar) {
    clearTimeout(tApoio)
    if (!animar) {
      hero.dataset.atual = n
      return
    }
    hero.classList.remove('trocando')
    void hero.offsetWidth // reinicia a animação
    hero.classList.add('trocando')
    tApoio = setTimeout(() => {
      hero.dataset.atual = n
    }, 420)
  }
  function ir(n) {
    if (n === atual || !frases[n]) return
    const velha = frases[atual]
    const nova = frases[n]
    const animar = !reduzido.matches
    clearTimeout(limpeza)
    frases.forEach((f) => f.classList.remove('saindo', 'entrando'))
    velha.classList.remove('ativa')
    nova.classList.add('ativa')
    if (animar) {
      velha.classList.add('saindo')
      nova.classList.add('entrando')
      limpeza = setTimeout(() => {
        frases.forEach((f) => f.classList.remove('saindo', 'entrando'))
        hero.classList.remove('trocando')
      }, 1900)
    }
    apoio(n, animar)
    // a frase 1 é o h1: fica sempre na árvore de acessibilidade
    if (atual !== 0) velha.setAttribute('aria-hidden', 'true')
    if (n !== 0) nova.removeAttribute('aria-hidden')
    tracos.forEach((t, i) => {
      if (i === n) t.setAttribute('aria-current', 'true')
      else t.removeAttribute('aria-current')
    })
    atual = n
  }

  // --------------------------------------------------------------- autoplay
  const MAX_TROCAS = frases.length * 2 // duas voltas, termina de novo na frase 1
  let trocas = 0
  let rodando = false
  const motivos = new Set()
  function pausar(motivo, sim) {
    if (sim) motivos.add(motivo)
    else motivos.delete(motivo)
    hero.classList.toggle('pausado', motivos.size > 0)
  }
  function tocar() {
    if (reduzido.matches || frases.length < 2) return
    rodando = true
    hero.classList.add('rodando')
  }
  function parar() {
    rodando = false
    hero.classList.remove('rodando')
  }
  hero.addEventListener('animationend', (ev) => {
    if (!rodando || !ev.target.classList.contains('hero__progresso')) return
    trocas += 1
    ir((atual + 1) % frases.length)
    if (trocas >= MAX_TROCAS) parar()
  })

  tracos.forEach((t) =>
    t.addEventListener('click', () => {
      parar() // quem escolhe a frase assume o controle
      clearTimeout(tInicio)
      hero.dataset.manual = '1'
      ir(Number(t.dataset.ir))
    }),
  )

  const pausaMouse = (el, nome) => {
    if (!el) return
    el.addEventListener('pointerenter', (ev) => ev.pointerType === 'mouse' && pausar(nome, true))
    el.addEventListener('pointerleave', () => pausar(nome, false))
  }
  pausaMouse(bloco, 'mouse-frase')
  pausaMouse(grupoTracos, 'mouse-tracos')
  hero.addEventListener('focusin', () => pausar('foco', true))
  hero.addEventListener('focusout', (ev) => {
    if (!hero.contains(ev.relatedTarget)) pausar('foco', false)
  })
  document.addEventListener('visibilitychange', () => pausar('aba', document.hidden))
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => pausar('fora', !e.isIntersecting), { threshold: 0.25 }).observe(hero)
  }
  let tInicio = 0
  reduzido.addEventListener?.('change', () => {
    if (reduzido.matches) {
      clearTimeout(tInicio)
      parar()
      fimIntro()
    }
  })
  // o relógio da frase 1 começa quando o título termina de entrar (~1,8 s),
  // senão ela fica legível só uns 5 s na primeira passada
  if (!reduzido.matches) tInicio = setTimeout(() => trocas === 0 && !hero.dataset.manual && tocar(), 1800)

  // ------------------------------------------------------------ vídeo (lightbox)
  const btnVideo = hero.querySelector('.hero__video')
  const dialogo = hero.querySelector('.hero__dialogo')
  if (btnVideo && dialogo && typeof dialogo.showModal === 'function') {
    const player = dialogo.querySelector('.hero__player')
    const idYouTube = (url) => {
      const m = String(url).match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/)
      return m ? m[1] : null
    }
    btnVideo.addEventListener('click', () => {
      const url = btnVideo.dataset.video || ''
      const id = idYouTube(url)
      if (!id) {
        if (url) window.open(url, '_blank', 'noopener')
        return
      }
      const quadro = document.createElement('iframe')
      quadro.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`
      quadro.title = dialogo.getAttribute('aria-label') || 'Vídeo'
      quadro.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'
      quadro.allowFullscreen = true
      player.replaceChildren(quadro)
      dialogo.showModal()
      pausar('video', true)
    })
    dialogo.addEventListener('close', () => {
      player.replaceChildren()
      pausar('video', false)
    })
    dialogo.querySelector('.hero__fechar')?.addEventListener('click', () => dialogo.close())
    dialogo.addEventListener('click', (ev) => {
      if (ev.target === dialogo) dialogo.close()
    })
  }
})()

;
/* 05-numeros.js */
/* 05 · Pikivoley em números: o "25" conta de 0 a 25 quando a faixa aparece.
   O HTML já traz o valor final (e um texto só pra leitor de tela); sem JS,
   sem IntersectionObserver ou com movimento reduzido, nada muda.
   O ponto e vírgula inicial protege a concatenação com o arquivo anterior. */
;(() => {
  const el = document.querySelector('#numeros [data-num-contar]')
  if (!el) return
  if (!('IntersectionObserver' in window)) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const alvo = Number(el.dataset.numContar) || 0
  const final = el.textContent
  const duracao = 1500
  const suave = (t) => 1 - Math.pow(1 - t, 3)

  // Mede a largura do valor final com a fonte já carregada e só então troca
  // pelo zero. Assim o "+" ao lado fica parado do começo ao fim, inclusive
  // enquanto o item entra na tela e o contador ainda não começou.
  // A largura vai em em, porque o tamanho da fonte é fluido e muda com a tela.
  const pronto = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    const px = el.getBoundingClientRect().width
    const fonte = parseFloat(getComputedStyle(el).fontSize) || 1
    el.style.minWidth = `${(px / fonte).toFixed(3)}em`
    el.textContent = '0'
  })

  const contar = () => {
    const inicio = performance.now()
    const passo = (agora) => {
      const t = Math.min(1, (agora - inicio) / duracao)
      el.textContent = t < 1 ? String(Math.round(suave(t) * alvo)) : final
      if (t < 1) requestAnimationFrame(passo)
      else el.style.minWidth = ''
    }
    requestAnimationFrame(passo)
  }

  const obs = new IntersectionObserver(
    (entradas) => {
      if (!entradas.some((e) => e.isIntersecting)) return
      obs.disconnect()
      // o atraso casa com a entrada do item (data-revelar)
      pronto.then(() => setTimeout(contar, 300))
    },
    { threshold: 0.5 },
  )
  obs.observe(el)
})()

;
/* 08-galeria.js */
/* FIPV · galeria: setas que rolam a faixa uma foto por vez e lightbox com
   anterior/próxima, teclado, gesto de arrastar e foco de volta na miniatura.
   O ; inicial protege a junção dos arquivos (o anterior termina em "})()"). */
;(() => {
  const sec = document.getElementById('galeria')
  if (!sec) return
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)')
  const comportamento = () => (reduzido.matches ? 'auto' : 'smooth')

  // ------------------------------------------------------------ faixa
  const faixa = sec.querySelector('.gal__faixa')
  const ant = sec.querySelector('.gal__seta--ant')
  const prox = sec.querySelector('.gal__seta--prox')

  const passo = () => {
    const item = faixa.querySelector('.gal__item')
    const vao = parseFloat(getComputedStyle(faixa).columnGap) || 0
    return item ? item.getBoundingClientRect().width + vao : faixa.clientWidth
  }

  // Desativa a seta da ponta. Se ela estava com foco, o foco passa pra outra.
  const marcar = (btn, desligar, outra) => {
    if (btn.disabled === desligar) return
    const tinhaFoco = document.activeElement === btn
    btn.disabled = desligar
    if (desligar && tinhaFoco && !outra.disabled) outra.focus()
  }
  const atualizar = () => {
    const max = faixa.scrollWidth - faixa.clientWidth
    const x = Math.abs(faixa.scrollLeft)
    marcar(ant, x <= 2, prox)
    marcar(prox, x >= max - 2, ant)
  }

  let quadro = 0
  faixa.addEventListener(
    'scroll',
    () => {
      if (quadro) return
      quadro = requestAnimationFrame(() => {
        quadro = 0
        atualizar()
      })
    },
    { passive: true },
  )
  if ('ResizeObserver' in window) new ResizeObserver(atualizar).observe(faixa)
  else window.addEventListener('resize', atualizar)
  atualizar()

  ant.addEventListener('click', () => faixa.scrollBy({ left: -passo(), behavior: comportamento() }))
  prox.addEventListener('click', () => faixa.scrollBy({ left: passo(), behavior: comportamento() }))

  // ---------------------------------------------------------- lightbox
  const caixa = sec.querySelector('.gal__caixa')
  if (!caixa || typeof caixa.showModal !== 'function') return
  const botoes = [...sec.querySelectorAll('.gal__abrir')]
  const grande = caixa.querySelector('.gal__grande')
  const texto = caixa.querySelector('.gal__texto')
  const contador = caixa.querySelector('.gal__contador')
  const aviso = caixa.querySelector('.gal__aviso')
  const dois = (n) => String(n).padStart(2, '0')
  let atual = 0
  let origem = null

  // Leitor de tela: posição e descrição numa frase só ("2 de 4: ..."; em
  // espanhol também é "de"). Esvazia antes pra repetir o aviso se precisar.
  let tAviso = 0
  const anunciar = (msg) => {
    if (!aviso) return
    clearTimeout(tAviso)
    aviso.textContent = ''
    tAviso = setTimeout(() => (aviso.textContent = msg), 80)
  }

  const preCarregar = (b) => {
    const img = new Image()
    img.sizes = b.dataset.sizes
    img.srcset = b.dataset.srcset
    img.src = b.dataset.src
  }

  const mostrar = (i) => {
    atual = (i + botoes.length) % botoes.length
    const b = botoes[atual]
    const mini = b.querySelector('img')
    if (grande.getAttribute('src') !== b.dataset.src) grande.classList.add('gal__grande--troca')
    grande.width = Number(b.dataset.w)
    grande.height = Number(b.dataset.h)
    grande.sizes = b.dataset.sizes
    grande.srcset = b.dataset.srcset
    grande.src = b.dataset.src
    grande.alt = mini.alt
    texto.textContent = mini.alt
    contador.textContent = `${dois(atual + 1)} / ${dois(botoes.length)}`
    anunciar(`${atual + 1} ${document.documentElement.lang === 'en' ? 'of' : 'de'} ${botoes.length}: ${mini.alt}`)
  }
  const tirarTroca = () => grande.classList.remove('gal__grande--troca')
  grande.addEventListener('load', () => {
    tirarTroca()
    preCarregar(botoes[(atual + 1) % botoes.length])
    preCarregar(botoes[(atual - 1 + botoes.length) % botoes.length])
  })
  grande.addEventListener('error', tirarTroca)

  botoes.forEach((b, i) =>
    b.addEventListener('click', () => {
      origem = b
      mostrar(i)
      caixa.showModal()
    }),
  )
  caixa.querySelector('.gal__nav--ant').addEventListener('click', () => mostrar(atual - 1))
  caixa.querySelector('.gal__nav--prox').addEventListener('click', () => mostrar(atual + 1))
  caixa.querySelector('.gal__fechar').addEventListener('click', () => caixa.close())

  // Clique fora da foto (no fundo escuro) fecha.
  caixa.addEventListener('click', (ev) => {
    if (ev.target === caixa || ev.target.classList.contains('gal__palco')) caixa.close()
  })
  caixa.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowLeft') {
      ev.preventDefault()
      mostrar(atual - 1)
    } else if (ev.key === 'ArrowRight') {
      ev.preventDefault()
      mostrar(atual + 1)
    }
  })
  // Esc fecha pelo próprio <dialog>. Ao fechar, o foco volta pra foto clicada.
  caixa.addEventListener('close', () => {
    clearTimeout(tAviso)
    if (aviso) aviso.textContent = ''
    if (origem) origem.focus({ preventScroll: false })
  })

  // Com o lightbox aberto, a página de trás não rola.
  caixa.addEventListener('wheel', (ev) => ev.preventDefault(), { passive: false })
  caixa.addEventListener(
    'touchmove',
    (ev) => {
      if (ev.touches.length === 1) ev.preventDefault()
    },
    { passive: false },
  )

  // Arrastar pro lado troca de foto.
  let x0 = null
  let y0 = null
  caixa.addEventListener(
    'touchstart',
    (ev) => {
      if (ev.touches.length !== 1) return (x0 = null)
      x0 = ev.touches[0].clientX
      y0 = ev.touches[0].clientY
    },
    { passive: true },
  )
  caixa.addEventListener('touchend', (ev) => {
    if (x0 === null) return
    const t = ev.changedTouches[0]
    const dx = t.clientX - x0
    const dy = t.clientY - y0
    x0 = null
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.3) mostrar(atual + (dx < 0 ? 1 : -1))
  })
})()
