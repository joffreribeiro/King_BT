import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, Modal, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import Avatar from '@/components/Avatar';
import { Icon } from '@/components/icons';
import { ProgressBar } from '@/components/ProgressBar';
import { formatRating } from '@/logic/format';
import { playerLevel } from '@/logic/playerLevel';
import { usePlayerXp } from '@/hooks/usePlayerXp';
import { useSettings } from '@/store/SettingsContext';
import type { Skills } from '@/logic/skills';

/** Dica ao parar o mouse (só na web: o react-native-web não repassa `title`, então vai direto no elemento). */
const hoverTip = (text: string) =>
  Platform.OS === 'web' ? { ref: (el: any) => { el?.setAttribute?.('title', text); } } : {};

interface Props {
  name: string;
  avatarColor: string;
  /** Posição no ranking (0 ou menos = ainda fora do ranking). */
  position: number;
  points: number;
  winRate: number;
  /** XP do jogador — decide o nível. */
  xp: number;
  /** De onde veio o XP (mostrado ao tocar no nível). */
  xpInfo?: ReturnType<typeof usePlayerXp>;
  groupName: string;
  /** Lápis ao lado do nome (só no próprio perfil). */
  onEdit?: () => void;
  /** "+" ao lado do nome do grupo: abre a tela de grupos (só no próprio perfil). */
  onAddGroup?: () => void;
  /** Botão de compartilhar no canto (só no próprio perfil). */
  onShare?: () => void;
  sharing?: boolean;
}

/**
 * Card do topo do perfil: vespa como marca d'água, avatar, nome, ranking, grupo
 * e nível com progresso. É o mesmo no seu perfil e no dos outros jogadores.
 * XP = jogos disputados + bônus pela nota do Radar (ver logic/playerLevel).
 */
export function ProfileHeroCard({ name, avatarColor, position, points, winRate, xp, groupName, xpInfo, onEdit, onAddGroup, onShare, sharing }: Props) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const level = playerLevel(xp);
  const [showXp, setShowXp] = useState(false);
  const { xpConfig } = useSettings();

  return (
    <View style={s.card}>
      {/* Mesmo desenho do card de Próximo evento: a arte cobre o topo, o texto fica embaixo à esquerda (sobre a bola)
          e o rosto da vespa fica livre à direita. */}
      <View style={s.hero}>
        <Image source={require('../../../assets/kingbt-mascote-fogo.jpg')} style={s.heroImg} resizeMode="cover" accessibilityIgnoresInvertColors />
        <LinearGradient
          colors={['rgba(11,11,13,0.35)', 'rgba(11,11,13,0)', 'rgba(11,11,13,0.55)', 'rgba(11,11,13,0.96)']}
          locations={[0, 0.3, 0.62, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={s.heroBottom}>
          <View style={s.avatarWrap}>
            <Avatar name={name} color={avatarColor} size={60} showCrown={position === 1} onDark />
            {onEdit && (
              <TouchableOpacity style={s.editBtn} onPress={onEdit} hitSlop={8} accessibilityRole="button" accessibilityLabel="Editar perfil" {...hoverTip('Editar perfil')}>
                <Icon name="edit" size={13} color={Colors.gold} />
              </TouchableOpacity>
            )}
          </View>
          <View style={s.heroInfo}>
            <Text style={s.name} numberOfLines={2}>{name.toUpperCase()}</Text>
            <Text style={s.sub}>
              {position > 0 ? `#${position}` : '#—'} no ranking · {formatRating(points)} pts · <Text style={{ color: Colors.teal, fontFamily: FontFamily.title }}>{winRate}%</Text> aproveit.
            </Text>
          </View>
        </View>
      </View>

      {onShare && (
        <TouchableOpacity style={[s.shareBtn, sharing && { opacity: 0.5 }]} onPress={onShare} activeOpacity={0.75} disabled={sharing} accessibilityRole="button" accessibilityLabel="Compartilhar">
          <Icon name="share" size={16} color={Colors.gold} />
        </TouchableOpacity>
      )}

      <View style={s.groupRow}>
        <Text style={s.group} numberOfLines={1}>{groupName}</Text>
        {onAddGroup && (
          <TouchableOpacity style={s.addBtn} onPress={onAddGroup} activeOpacity={0.75} hitSlop={8} accessibilityRole="button" accessibilityLabel="Trocar ou entrar em grupo" {...hoverTip('Trocar ou entrar em grupo')}>
            <Text style={s.addPlus}>+</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={s.levelBox} activeOpacity={xpInfo ? 0.8 : 1} disabled={!xpInfo} onPress={() => setShowXp(true)} accessibilityRole="button" accessibilityLabel="Ver como o XP é calculado">
        <View style={s.levelTop}>
          <Text style={s.levelLabel}>NÍVEL</Text>
          <Text style={s.levelName}>{level.name}</Text>
        </View>
        <ProgressBar pct={level.progress * 100} height={8} />
        <Text style={s.levelHint}>
          {level.next ? (
            <>
              Faltam <Text style={s.levelStrong}>{level.remaining} XP</Text> para <Text style={s.levelStrong}>{level.next.name}</Text>
            </>
          ) : 'Nível máximo'}
        </Text>
        {!!xpInfo && <Text style={s.levelMore}>Toque para ver como o XP é calculado</Text>}
      </TouchableOpacity>

      {!!xpInfo && (
        <Modal visible={showXp} transparent animationType="fade" onRequestClose={() => setShowXp(false)}>
          <TouchableOpacity style={s.xpOverlay} activeOpacity={1} onPress={() => setShowXp(false)}>
            <TouchableOpacity style={s.xpSheet} activeOpacity={1}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
            <Text style={s.xpTitle}>Como seu XP é calculado</Text>
            <Text style={s.xpNote}>O XP decide o seu nível. Você tem {xp} XP.</Text>
            {([
              { label: 'Jogos disputados', n: xpInfo.counts.played, each: xpConfig.game, total: xpInfo.games },
              { label: 'Vitórias', n: xpInfo.counts.wins, each: xpConfig.win, total: xpInfo.winsXp },
              { label: 'Competições disputadas', n: xpInfo.counts.events, each: xpConfig.event, total: xpInfo.eventsXp },
              { label: 'Colegas avaliados', n: xpInfo.counts.rated, each: xpConfig.rating, total: xpInfo.ratingXp },
              { label: 'Honrarias recebidas', n: xpInfo.counts.honors, each: xpConfig.honor, total: xpInfo.honorsXp },
              { label: 'Conquistas desbloqueadas', n: xpInfo.unlocked, each: null, total: xpInfo.achievementsXp },
              { label: 'Nota da avaliação', n: null, each: null, total: xpInfo.bonus },
            ] as const).map(r => (
              <View key={r.label} style={s.xpRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.xpLabel}>{r.label}</Text>
                  <Text style={s.xpSub}>{r.n != null ? (r.each != null ? `${r.n} × ${r.each} XP` : `${r.n} (XP pela raridade de cada uma)`) : 'Autoavaliação e média dos colegas'}</Text>
                </View>
                <Text style={s.xpVal}>+{r.total}</Text>
              </View>
            ))}
            <View style={[s.xpRow, { borderTopWidth: 1, borderTopColor: Colors.line }]}>
              <Text style={[s.xpLabel, { flex: 1 }]}>Total</Text>
              <Text style={[s.xpVal, { fontSize: 20 }]}>{xp} XP</Text>
            </View>
            <Text style={s.xpNote}>Conquistas valem mais quanto mais raras: Comum {xpConfig.rarity.comum}, Incomum {xpConfig.rarity.incomum}, Rara {xpConfig.rarity.rara}, Épica {xpConfig.rarity.epica}, Lendária {xpConfig.rarity.lendaria}, Mítica {xpConfig.rarity.mitica} XP.</Text>
              </ScrollView>
              <TouchableOpacity style={s.xpClose} onPress={() => setShowXp(false)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Fechar">
                <Text style={s.xpCloseText}>Fechar</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  card: {
    alignItems: 'center', marginTop: 0, marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingTop: 0, paddingBottom: Spacing.md,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.gold + '55',
    backgroundColor: Colors.surf, position: 'relative', overflow: 'hidden',
  },
  // Só as bordas (top/left/right/bottom = 0), sem width/height em %: assim a imagem cobre o card inteiro,
  // mesmo quando a altura do card só é conhecida depois que o conteúdo é desenhado.
  hero: { alignSelf: 'stretch', height: 210, marginHorizontal: -Spacing.md, backgroundColor: '#0B0B0D', overflow: 'hidden' },
  // Igual ao EventHero (card de Próximo evento): borda a borda E largura/altura 100% de uma área de altura FIXA.
  // Só com as bordas, a web desenhava a imagem no tamanho natural e aparecia apenas o canto de cima.
  heroImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: Spacing.md, paddingBottom: 12 },
  heroInfo: { flex: 1, minWidth: 0 },
  shareBtn: {
    position: 'absolute', top: 12, right: 12, zIndex: 2,
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.gold + '55', backgroundColor: Colors.gold + '11',
  },
  // minWidth/flexShrink: o nome encolhe e quebra de linha em vez de ser cortado pelo card (lápis ao lado).
  avatarWrap: { position: 'relative' },
  editBtn: {
    position: 'absolute', right: -6, bottom: -4, width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.gold, backgroundColor: Colors.surf,
  },
  // Texto sobre a arte: claro, com sombra, como o título do card de evento. O nome quebra de linha se for comprido.
  name: { fontFamily: FontFamily.serif, fontVariant: ['lining-nums' as const], fontSize: 22, lineHeight: 26, color: '#F6EFDD', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } },
  sub: { fontFamily: FontFamily.body, fontSize: 12.5, color: '#E7DFC8', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  groupRow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.sm },
  group: { flexShrink: 1, fontFamily: FontFamily.titleBold, fontSize: 16, lineHeight: 20, color: Colors.text },
  addBtn: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.gold, backgroundColor: Colors.gold + '1F' },
  addPlus: { fontFamily: FontFamily.titleBold, fontSize: 18, lineHeight: 20, color: Colors.gold, marginTop: -1 },
  levelBox: { alignSelf: 'stretch', marginTop: Spacing.sm, gap: 6, padding: Spacing.sm + 2, borderRadius: Radius.md, backgroundColor: Colors.bg + 'B3', borderWidth: 1, borderColor: Colors.gold + '33' },
  levelTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  levelLabel: { fontFamily: FontFamily.titleBold, fontSize: 12, letterSpacing: 1.4, color: Colors.muted },
  levelName: { fontFamily: FontFamily.serif, fontVariant: ['lining-nums' as const], fontSize: 22, lineHeight: 26, color: Colors.gold },
  levelHint: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.text },
  levelMore: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  xpOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', padding: Spacing.lg },
  xpSheet: { backgroundColor: Colors.surf, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.gold + '55', padding: Spacing.md, maxHeight: '88%', maxWidth: 480, width: '100%', alignSelf: 'center' },
  xpClose: { minHeight: 48, borderRadius: Radius.full, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  xpCloseText: { fontFamily: FontFamily.titleBold, fontSize: 15, color: Colors.bg },
  xpTitle: { fontFamily: FontFamily.serif, fontVariant: ['lining-nums' as const], fontSize: 24, color: Colors.text },
  xpNote: { fontFamily: FontFamily.body, fontSize: 13, lineHeight: 19, color: Colors.muted, marginVertical: 4 },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10 },
  xpLabel: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: Colors.text },
  xpSub: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  xpVal: { fontFamily: FontFamily.numberBold, fontSize: 17, color: Colors.gold },
  levelStrong: { fontFamily: FontFamily.titleBold, color: Colors.gold },
});

type CardProps = Omit<Props, 'xp'>;

/**
 * O card já com o XP calculado: jogos disputados + bônus pela nota do Radar
 * (autoavaliação e, quando existir, a média dos colegas). Usado nos dois perfis.
 */
export function PlayerHeroCard({ playerId, played, skills, ratedCount = 0, ...rest }: CardProps & { playerId: string; played: number; skills?: Skills; ratedCount?: number }) {
  const info = usePlayerXp(playerId, played, skills, rest.points, ratedCount);
  return <ProfileHeroCard {...rest} xp={info.xp} xpInfo={info} />;
}
