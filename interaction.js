/* Microinteracciones de las tarjetas. El personaje vive en assets/ariana/. */
(() => {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  document.querySelectorAll('.service-card, .plan-card').forEach(card => {
    const reset = () => {
      card.style.removeProperty('--card-rx'); card.style.removeProperty('--card-ry');
    };
    card.addEventListener('pointermove', event => {
      if (motion.matches || !pointer.matches) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--card-rx', `${-(event.clientY-r.top-r.height/2)/r.height*2.2}deg`);
      card.style.setProperty('--card-ry', `${(event.clientX-r.left-r.width/2)/r.width*2.4}deg`);
    }, { passive: true });
    card.addEventListener('pointerleave',reset,{passive:true});
    motion.addEventListener('change',reset);
  });
})();
