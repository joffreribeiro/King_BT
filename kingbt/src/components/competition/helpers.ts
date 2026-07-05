import { PLAYERS } from '@/mocks/data';
import { standings, koRoundName, competitionChampion } from '@/logic/formats';
import type { Match, Competition, MatchSource } from '@/logic/types';
import type { ThemeColors } from '@/theme';

// Cor do saldo de games (SG): verde se positivo, vermelho se negativo, neutro se zero
export function sgColor(sg: number, Colors: ThemeColors): string {
  return sg > 0 ? Colors.teal : sg < 0 ? Colors.coral : Colors.muted;
}

export function getPlayer(id: string) {
  return PLAYERS.find(p => p.id === id);
}

export function getCompetitor(comp: Competition, id: string) {
  return comp.competitors.find(c => c.id === id);
}

// Retorna label de placeholder para um slot ainda não resolvido no bracket
export function srcLabel(comp: Competition, src: MatchSource | null | undefined): string | null {
  if (!src) return null;
  const ordinal = (n: number) => n === 1 ? '1º' : n === 2 ? '2º' : n === 3 ? '3º' : `${n}º`;
  if (src.type === 'group') {
    const gName = comp.groupDefs?.[src.g ?? 0]?.name ?? `Grupo ${src.g ?? 0 + 1}`;
    return `${ordinal(src.pos ?? 1)} ${gName}`;
  }
  if (src.type === 'best3') {
    return `${ordinal(src.best3Rank ?? 1)} melhor 3º`;
  }
  if (src.type === 'winner') return 'Vencedor';
  if (src.type === 'loser') return 'Perdedor';
  return null;
}

// Retorna true se o slot é BYE estrutural (não tem src nem id atribuído)
export function isByeSlot(id: string | null | undefined, src: MatchSource | null | undefined): boolean {
  return !id && !src;
}

export function firstUnscored(matches: Match[]): string | null {
  const m = matches.find(m => m.scoreA == null && ((m.aId && m.bId) || (m.teamA && m.teamB)));
  return m?.id ?? null;
}

// ─── Share helpers ────────────────────────────────────────────────────────────

export function buildShareText(comp: Competition, findPlayer: (id: string) => { name: string } | undefined): string {
  const lines: string[] = [`🏆 ${comp.name}\n`];

  if (comp.format === 'liga') {
    lines.push('CLASSIFICAÇÃO:');
    const st = standings(comp.competitors.map(c => c.id), comp.matches);
    st.forEach((s, i) => {
      const c = comp.competitors.find(x => x.id === s.id);
      lines.push(`${i + 1}. ${c?.name ?? s.id}  ${s.pts}pts  ${s.wins}V/${s.losses}D`);
    });
  } else if (comp.format === 'avulso' || comp.format === 'super8') {
    lines.push('RESULTADOS:');
    comp.matches.filter(m => m.scoreA != null).forEach(m => {
      const nA = m.teamA?.map(id => findPlayer(id)?.name.split(' ')[0]).join('/') ?? '?';
      const nB = m.teamB?.map(id => findPlayer(id)?.name.split(' ')[0]).join('/') ?? '?';
      lines.push(`${nA} ${m.scoreA}–${m.scoreB} ${nB}`);
    });
  } else {
    const done = comp.matches.filter(m => m.scoreA != null);
    lines.push(`JOGOS CONCLUÍDOS (${done.length}/${comp.matches.length}):`);
    done.forEach(m => {
      const nA = m.aId ? (getCompetitor(comp, m.aId)?.name ?? '?') : '?';
      const nB = m.bId ? (getCompetitor(comp, m.bId)?.name ?? '?') : '?';
      lines.push(`${nA} ${m.scoreA}–${m.scoreB} ${nB}`);
    });
  }

  const done = comp.matches.filter(m => m.scoreA != null).length;
  lines.push(`\n${done}/${comp.matches.length} jogos registrados`);
  lines.push('Enviado pelo King BT 👑');
  return lines.join('\n');
}

export function buildBracketShareText(comp: Competition): string {
  const lines: string[] = [`🏆 ${comp.name} — CHAVEAMENTO\n`];
  const roundNums = [...new Set(
    comp.matches.filter(m => m.stage === 'ko' && !m.third).map(m => m.koRound ?? 0)
  )].sort((a, b) => a - b);
  roundNums.forEach(r => {
    const rMatches = comp.matches.filter(m => m.koRound === r && !m.third);
    lines.push(koRoundName(rMatches[0]?.cnt ?? 0) + ':');
    rMatches.forEach(m => {
      const nA = m.aId ? comp.competitors.find(c => c.id === m.aId)?.name ?? '?' : '?';
      const nB = m.bId ? comp.competitors.find(c => c.id === m.bId)?.name ?? '?' : '?';
      if (m.scoreA != null) lines.push(`  ${nA} ${m.scoreA}–${m.scoreB} ${nB}`);
      else lines.push(`  ${nA} vs ${nB}`);
    });
  });
  const third = comp.matches.find(m => m.stage === 'ko' && m.third);
  if (third?.scoreA != null) {
    const nA = third.aId ? comp.competitors.find(c => c.id === third.aId)?.name ?? '?' : '?';
    const nB = third.bId ? comp.competitors.find(c => c.id === third.bId)?.name ?? '?' : '?';
    lines.push(`\n3º Lugar:\n  ${nA} ${third.scoreA}–${third.scoreB} ${nB}`);
  }
  const champ = competitionChampion(comp);
  if (champ) {
    const champName = (champ as any).name ?? comp.competitors.find(c => c.id === champ.members[0])?.name ?? champ.members[0];
    lines.push(`\n🥇 Campeão: ${champName}`);
  }
  lines.push('\nEnviado pelo King BT 👑');
  return lines.join('\n');
}
