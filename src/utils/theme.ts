import { ThemeId, ThemeOption } from '../types';

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'cyber_gold',
    name: 'Cyber Gold & Azurová',
    nameEn: 'Cyber Gold & Azure',
    subtitle: 'Hluboká černá, luxusní zlato a azurové linky',
    subtitleEn: 'Deep black, luxury gold and cyan lines',
    accent: '#f59e0b',
    secondaryAccent: '#06b6d4',
    bg: '#08090d',
    isLight: false,
  },
  {
    id: 'emerald_cyan',
    name: 'Neon Smaragd & Cyan',
    nameEn: 'Neon Emerald & Cyan',
    subtitle: 'Černý podklad, zářivý smaragd a azurový neon',
    subtitleEn: 'Obsidian dark, radiant emerald and azure neon',
    accent: '#10b981',
    secondaryAccent: '#06b6d4',
    bg: '#060b09',
    isLight: false,
  },
  {
    id: 'prism_chroma',
    name: 'Velvet Prism Chroma',
    nameEn: 'Velvet Prism Chroma',
    subtitle: 'Zlato, neon růžová, béžová, zelená a modrá',
    subtitleEn: 'Rich gold, neon rose, beige, green and blue',
    accent: '#ec4899',
    secondaryAccent: '#fbbf24',
    bg: '#0a0b10',
    isLight: false,
  },
  {
    id: 'nordic_aurora',
    name: 'Nordic Aurora (Záře)',
    nameEn: 'Nordic Aurora',
    subtitle: 'Polární noc, ledovcová modř a tyrkysová aura',
    subtitleEn: 'Arctic night, glacier cyan and turquoise aura',
    accent: '#0ea5e9',
    secondaryAccent: '#2dd4bf',
    bg: '#060b13',
    isLight: false,
  },
  {
    id: 'cyber_amethyst',
    name: 'Cyber Amethyst',
    nameEn: 'Cyber Amethyst',
    subtitle: 'Obsidián, neonový ametyst a levandulová mlha',
    subtitleEn: 'Obsidian, neon amethyst and lavender glow',
    accent: '#a855f7',
    secondaryAccent: '#c084fc',
    bg: '#0b0914',
    isLight: false,
  },
  {
    id: 'warm_cashmere',
    name: 'Warm Cashmere (Kašmír)',
    nameEn: 'Warm Cashmere',
    subtitle: 'Příjemný kašmír, kamenná břidlice a jantar',
    subtitleEn: 'Soothing cashmere, slate grey and amber bronze',
    accent: '#d97706',
    secondaryAccent: '#059669',
    bg: '#f6f3ec',
    isLight: true,
  },
  {
    id: 'sand_terracotta',
    name: 'Sand Dune (Písek & Terakota)',
    nameEn: 'Sand Dune & Terracotta',
    subtitle: 'Hřejivý pouštní písek a pálená terakota',
    subtitleEn: 'Warm desert sand and earthy terracotta',
    accent: '#c2410c',
    secondaryAccent: '#15803d',
    bg: '#f5efe6',
    isLight: true,
  },
  {
    id: 'misty_sage',
    name: 'Misty Sage (Šalvěj & Mech)',
    nameEn: 'Misty Sage & Forest',
    subtitle: 'Tlumená svěží šalvěj a hluboká lesní zeleň',
    subtitleEn: 'Muted calming sage and deep forest green',
    accent: '#166534',
    secondaryAccent: '#0d9488',
    bg: '#edf2ed',
    isLight: true,
  },
  {
    id: 'nordic_fog',
    name: 'Nordic Fog (Polární mlha)',
    nameEn: 'Nordic Fog & Slate',
    subtitle: 'Chladivá ranní mlha a matná ocelová modř',
    subtitleEn: 'Cool morning fog and matte steel blue',
    accent: '#0284c7',
    secondaryAccent: '#6366f1',
    bg: '#ebf0f5',
    isLight: true,
  },
];

export const LOCAL_STORAGE_THEME_KEY = 'kiyodo_theme';

const LIGHT_THEMES: readonly ThemeId[] = ['warm_cashmere', 'sand_terracotta', 'misty_sage', 'nordic_fog'];

export function normalizeThemeId(theme: ThemeId | string | null): ThemeId {
  if (!theme) return 'cyber_gold';
  // Map legacy names to new modern themes
  switch (theme) {
    case 'cyber_gold':
      return 'cyber_gold';
    case 'emerald_cyan':
      return 'emerald_cyan';
    case 'prism_chroma':
      return 'prism_chroma';
    case 'nordic_aurora':
      return 'nordic_aurora';
    case 'cyber_amethyst':
      return 'cyber_amethyst';
    case 'warm_cashmere':
      return 'warm_cashmere';
    case 'sand_terracotta':
      return 'sand_terracotta';
    case 'misty_sage':
      return 'misty_sage';
    case 'nordic_fog':
      return 'nordic_fog';
    case 'default':
      return 'cyber_gold';
    case 'animism':
      return 'emerald_cyan';
    case 'flow':
      return 'prism_chroma';
    case 'midnight':
      return 'nordic_aurora';
    case 'light':
    case 'hermetic':
      return 'warm_cashmere';
    default:
      return 'cyber_gold';
  }
}

export function applyTheme(theme: ThemeId) {
  const root = document.documentElement;
  const effectiveTheme = normalizeThemeId(theme);
  root.setAttribute('data-theme', effectiveTheme);

  if (LIGHT_THEMES.includes(effectiveTheme)) {
    root.classList.remove('dark');
    root.classList.add('light');
  } else {
    root.classList.add('dark');
    root.classList.remove('light');
  }

  try {
    localStorage.setItem(LOCAL_STORAGE_THEME_KEY, effectiveTheme);
  } catch {
    // ignore
  }
}

export function getInitialTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_THEME_KEY);
    if (saved) {
      return normalizeThemeId(saved);
    }
  } catch {
    // ignore
  }
  return 'cyber_gold';
}
