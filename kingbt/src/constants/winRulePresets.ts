export interface WinRulePreset {
  label: string;
  desc: string;
  sets: number;
  games: number;
  tb: number;
  tbAt: 'deuce' | 'full';
  stb: boolean;
  stbPts: number;
}

// Presets de formato de disputa (games/tie-break/super tie-break), usados
// tanto no wizard de nova competição quanto no atalho de jogo amistoso.
export const WIN_RULE_PRESETS: WinRulePreset[] = [
  // MD1 ordenado por games
  { label: 'MD1 · 4 games', desc: 'Com tie 7 em 3-3',            sets: 1, games: 4, tb: 7, tbAt: 'deuce', stb: false, stbPts: 10 },
  { label: 'MD1 · 4 games', desc: 'Com tie 7 em 4-4',            sets: 1, games: 4, tb: 7, tbAt: 'full',  stb: false, stbPts: 10 },
  { label: 'MD1 · 6 games', desc: 'Com tie 7 em 5-5',            sets: 1, games: 6, tb: 7, tbAt: 'deuce', stb: false, stbPts: 10 },
  { label: 'MD1 · 7 games', desc: 'Com tie 7 em 6-6',            sets: 1, games: 7, tb: 7, tbAt: 'deuce', stb: false, stbPts: 10 },
  { label: 'MD1 · 8 games', desc: 'Com tie 7 em 8-8',            sets: 1, games: 8, tb: 7, tbAt: 'full',  stb: false, stbPts: 10 },
  { label: 'Super TB · 10', desc: 'Apenas super tie-break',       sets: 1, games: 1, tb: 7, tbAt: 'deuce', stb: true,  stbPts: 10 },
  // MD3 ordenado por games
  { label: 'MD3 · 4 games', desc: 'Com tie 7 em 3-3 e super 10', sets: 3, games: 4, tb: 7, tbAt: 'deuce', stb: true,  stbPts: 10 },
  { label: 'MD3 · 4 games', desc: 'Com tie 7 em 4-4',            sets: 3, games: 4, tb: 7, tbAt: 'full',  stb: false, stbPts: 10 },
  { label: 'MD3 · 6 games', desc: 'Com tie 7 em 5-5 e super 10', sets: 3, games: 6, tb: 7, tbAt: 'deuce', stb: true,  stbPts: 10 },
  { label: 'MD3 · 6 games', desc: 'Com tie 7 em 5-5, sem super', sets: 3, games: 6, tb: 7, tbAt: 'deuce', stb: false, stbPts: 10 },
];
