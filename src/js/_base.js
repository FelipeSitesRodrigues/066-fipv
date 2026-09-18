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
