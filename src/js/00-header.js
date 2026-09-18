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
