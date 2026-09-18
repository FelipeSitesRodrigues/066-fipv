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
