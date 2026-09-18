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
