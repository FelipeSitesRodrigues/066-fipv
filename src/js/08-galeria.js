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
    anunciar(`${atual + 1} de ${botoes.length}: ${mini.alt}`)
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
