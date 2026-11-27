import { appendInlineContent } from './math-markup.js';

export function readingPanel(label, side, ...content) {
  const panel = document.createElement('details');
  panel.className = 'reading-panel reading-panel-' + side;
  panel.open = matchMedia('(min-width: 1140px)').matches;
  const summary = document.createElement('summary');
  summary.textContent = label;
  panel.append(summary, ...content);
  return panel;
}

export function readingLink(label, activate) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'reading-panel-link';
  appendInlineContent(button, label);
  button.addEventListener('click', activate);
  return button;
}

export function mountReadingFrame(main, left, right) {
  const frame = document.createElement('div');
  frame.className = 'reading-frame';
  main.classList.add('reading-frame-body');
  main.before(frame);
  frame.append(left, main, right);
  return frame;
}

