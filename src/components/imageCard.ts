import type { ImageItem } from '../shared/types';

const ZOOM_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>`;

export interface ImageCardHandle {
  el: HTMLElement;
  setSelected: (selected: boolean) => void;
}

export function createImageCard(
  item: ImageItem,
  isSelected: boolean,
  onToggle: (item: ImageItem, selected: boolean) => void,
  onPreview: (item: ImageItem) => void,
): ImageCardHandle {
  const card = document.createElement('div');
  card.className = 'image-card' + (isSelected ? ' is-selected' : '');
  card.dataset.id = item.id;

  const img = document.createElement('img');
  img.loading = 'lazy';
  img.src = item.thumb;
  img.alt = item.id;
  img.addEventListener('click', () => onPreview(item));

  const check = document.createElement('label');
  check.className = 'image-card__check';
  check.title = '选择';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = isSelected;
  checkbox.addEventListener('change', () => onToggle(item, checkbox.checked));
  const mark = document.createElement('span');
  mark.className = 'image-card__mark';
  check.append(checkbox, mark);

  const zoom = document.createElement('div');
  zoom.className = 'image-card__zoom';
  zoom.innerHTML = ZOOM_ICON;
  zoom.addEventListener('click', (event) => {
    event.stopPropagation();
    onPreview(item);
  });

  card.append(img, check, zoom);

  return {
    el: card,
    setSelected: (selected: boolean) => {
      card.classList.toggle('is-selected', selected);
      checkbox.checked = selected;
    },
  };
}
