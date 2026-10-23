/** Motion communicates a change of view or selection. It never changes data. */
let initialized = false;
let before = null;
let navPosition = null;
let hoverTarget = null;
let focusTarget = null;
let highlightedFigure = null;
let frame = 0;
const running = new Set();
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = 'cubic-bezier(.2,.7,.2,1)';
const panels = '.chart-panel, .conversation-pane, .record-table-wrap, .scope-diagrams';

function animate(element, frames, options = {}) {
  if (!element || reduced() || typeof element.animate !== 'function') return;
  const animation = element.animate(frames, {duration: 180, easing: ease, ...options});
  running.add(animation);
  animation.finished.catch(() => {}).finally(() => running.delete(animation));
  return animation;
}

// Text and plotted dimensions form the signature; hover and focus do not.
function signature(element) {
  const geometry = [...element.querySelectorAll('rect, path, circle, [style]')]
    .map(node => ['width', 'height', 'd', 'cx', 'cy', 'style'].map(a => node.getAttribute(a) || '').join('|'))
    .join(';');
  return element.textContent + geometry;
}

function barSnapshot(root) {
  const result = new Map();
  root?.querySelectorAll('.dashboard-distribution').forEach((chart, chartIndex) => {
    const chartKey = `${chartIndex}:${chart.getAttribute('aria-label') || ''}`;
    chart.querySelectorAll('.dashboard-distribution-row').forEach(row => {
      const fill = row.lastElementChild?.firstElementChild;
      if (!fill || !fill.style.width.endsWith('%')) return; // Exclude dot plots.
      const label = row.dataset.value || row.firstElementChild?.firstElementChild?.textContent || '';
      result.set(`${chartKey}:${label}`, {fill, width: fill.style.width});
    });
  });
  return result;
}

/** Call immediately before replacing #main. */
export function beforeRender() {
  const main = document.getElementById('main');
  before = main ? {
    route: main.dataset.route,
    panels: [...main.querySelectorAll(panels)].map(signature),
    bars: barSnapshot(main),
  } : null;
}

/** Call after #main and navigation have been rendered. */
export function afterRender() {
  const main = document.getElementById('main');
  if (!main) return;
  hoverTarget = null;
  focusTarget = null;
  highlightedFigure = null;
  const routeChanged = !before || before.route !== main.dataset.route;
  if (routeChanged) {
    animate(main, [{opacity: .72, transform: 'translateY(5px)'}, {opacity: 1, transform: 'translateY(0)'}]);
  } else {
    [...main.querySelectorAll(panels)].forEach((panel, index) => {
      if (before.panels[index] !== signature(panel)) {
        animate(panel, [{opacity: .62}, {opacity: 1}], {duration: 160});
      }
    });
  }
  for (const [key, {fill, width}] of barSnapshot(main)) {
    const prior = !routeChanged && before?.bars.get(key)?.width;
    if (prior && prior !== width) {
      animate(fill, [{width: prior}, {width}], {duration: 220});
    } else if (routeChanged || !prior) {
      animate(fill, [{opacity: .6}, {opacity: 1}], {duration: 220});
    }
  }
  updateNav(true);
  updateActiveTurn();
  before = null;
}

function updateNav(allowMotion = false) {
  const nav = document.getElementById('nav');
  const active = nav?.querySelector('.nav-item.active');
  if (!nav) return;
  nav.classList.add('motion-nav');
  let indicator = nav.querySelector('.motion-nav-indicator');
  if (!active) {
    indicator?.remove();
    navPosition = null;
    return;
  }
  if (!indicator) {
    indicator = document.createElement('span');
    indicator.className = 'motion-nav-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    nav.append(indicator);
  }
  const outer = nav.getBoundingClientRect();
  const rect = active.getBoundingClientRect();
  const next = {x: rect.left - outer.left + nav.scrollLeft, width: rect.width};
  indicator.style.transform = `translateX(${next.x}px)`;
  indicator.style.width = `${next.width}px`;
  if (allowMotion && navPosition && (next.x !== navPosition.x || next.width !== navPosition.width)) {
    animate(indicator, [
      {transform: `translateX(${navPosition.x}px)`, width: `${navPosition.width}px`},
      {transform: `translateX(${next.x}px)`, width: `${next.width}px`},
    ], {duration: 220});
  }
  navPosition = next;
}

/** Call after showModal/content replacement. Never moves keyboard focus. */
export function animateInspector(isNew = true) {
  const dialog = document.getElementById('inspect-dialog');
  if (!dialog?.open) return;
  if (isNew) {
    animate(dialog, [{opacity: .7, transform: 'translateX(28px)'}, {opacity: 1, transform: 'translateX(0)'}], {duration: 220});
  } else {
    animate(dialog.querySelector('.inspect-body'), [{opacity: .6}, {opacity: 1}], {duration: 140});
  }
}

function relatedTarget(target) {
  return target instanceof Element ? target.closest('.rv-tile-group[data-value], .rv-legend-row[data-value]') : null;
}

function clearHighlight(figure) {
  if (!figure) return;
  figure.removeAttribute('data-motion-highlight');
  figure.querySelectorAll('[data-motion-match]').forEach(node => node.removeAttribute('data-motion-match'));
}

function updateHighlight() {
  const target = hoverTarget?.isConnected ? hoverTarget : focusTarget?.isConnected ? focusTarget : null;
  const figure = target?.closest('.rv-relevance');
  if (highlightedFigure && highlightedFigure !== figure) clearHighlight(highlightedFigure);
  highlightedFigure = figure || null;
  if (!figure) return;
  figure.setAttribute('data-motion-highlight', target.dataset.value);
  figure.querySelectorAll('.rv-tile-group, .rv-legend-row').forEach(node => {
    node.toggleAttribute('data-motion-match', node.dataset.value === target.dataset.value);
  });
}

function updateActiveTurn() {
  const turns = [...document.querySelectorAll('#case-detail .exchange')];
  if (!turns.length) return;
  const anchor = Math.max(16, document.querySelector('.app-header')?.getBoundingClientRect().bottom || 0) + 20;
  const atEnd = document.documentElement.scrollHeight > innerHeight + 2 && scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
  const active = atEnd ? turns.at(-1) : turns.find(turn => {
    const rect = turn.getBoundingClientRect();
    return rect.top <= anchor && rect.bottom > anchor;
  }) || turns.find(turn => turn.getBoundingClientRect().top > anchor) || turns.at(-1);
  const id = active.id.replace('turn-', '');
  document.querySelectorAll('.turn-mark.shown').forEach(button => {
    if (button.dataset.id === id) button.setAttribute('aria-current', 'location');
    else button.removeAttribute('aria-current');
  });
}

/** Use instead of a hardcoded smooth scroll in the existing jump-turn action. */
export function jumpToTurn(id) {
  const turn = document.getElementById(`turn-${id}`);
  if (!turn) return;
  const header = document.querySelector('.app-header');
  const fixedHeader = header && ['sticky', 'fixed'].includes(getComputedStyle(header).position);
  turn.style.scrollMarginTop = `${fixedHeader ? header.getBoundingClientRect().height + 20 : 28}px`;
  turn.scrollIntoView({behavior: reduced() ? 'instant' : 'smooth', block: 'start'});
  document.querySelectorAll('.turn-mark.shown').forEach(button => {
    if (button.dataset.id === String(id)) button.setAttribute('aria-current', 'location');
    else button.removeAttribute('aria-current');
  });
  animate(turn, [{outlineColor: '#8ca9c580'}, {outlineColor: 'transparent'}], {duration: 900});
}

function scheduleLayout() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    updateActiveTurn();
    updateNav(false);
  });
}

/** Install delegated listeners once. Safe before or after the first render. */
export function initMotion() {
  if (initialized) return;
  initialized = true;
  document.addEventListener('pointerover', event => {
    hoverTarget = relatedTarget(event.target);
    updateHighlight();
  });
  document.addEventListener('pointerout', event => {
    hoverTarget = relatedTarget(event.relatedTarget);
    updateHighlight();
  });
  document.addEventListener('focusin', event => {
    focusTarget = relatedTarget(event.target);
    updateHighlight();
  });
  document.addEventListener('focusout', event => {
    focusTarget = relatedTarget(event.relatedTarget);
    updateHighlight();
  });
  window.addEventListener('scroll', scheduleLayout, {passive: true});
  window.addEventListener('resize', scheduleLayout, {passive: true});
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => {
    if (event.matches) {
      for (const animation of running) animation.cancel();
      running.clear();
    }
  });
}
