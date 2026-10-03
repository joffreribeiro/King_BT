import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, Modal, ScrollView } from 'react-native';
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
  const { colors: Colors, mode } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const level = playerLevel(xp);
  const [showXp, setShowXp] = useState(false);
  const { xpConfig } = useSettings();

  return (
    <View style={s.card}>
      <Image source={require('../../../assets/kingbt-mascote-fogo.jpg')} style={[s.img, { opacity: mode === 'dark' ? 0.2 : 0.24 }]} resizeMode="cover" />

      {onShare && (
        <TouchableOpacity style={[s.shareBtn, sharing && { opacity: 0.5 }]} onPress={onShare} activeOpacity={0.75} disabled={sharing} accessibilityRole="button" accessibilityLabel="Compartilhar">
          <Icon name="share" size={16} color={Colors.gold} />
        </TouchableOpacity>
      )}

      <Avatar name={name} color={avatarColor} size={88} showCrown={position === 1} />
      <View style={s.nameRow}>
        <Text style={s.name}>{name.toUpperCase()}</Text>
        {onEdit && (
          <TouchableOpacity onPress={onEdit} hitSlop={10} accessibilityRole="button" accessibilityLabel="Editar perfil" {...hoverTip('Editar perfil')}>
            <Icon name="edit" size={16} color={Colors.muted} />
          </TouchableOpacity>
        )}
      </View>
      <Text style={s.sub}>
        {position > 0 ? `#${position}` : '#—'} no ranking · {formatRating(points)} pts · <Text style={{ color: Colors.teal, fontFamily: FontFamily.title }}>{winRate}%</Text> aproveit.
      </Text>

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
        <ProgressBar pct={level.progress * 100} height={10} />
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
    alignItems: 'center', marginTop: Spacing.sm, marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingTop: Spacing.lg, paddingBottom: Spacing.lg,
    borderRadius: 22, borderWidth: 1, borderColor: Colors.gold + '55',
    backgroundColor: Colors.surf, position: 'relative', overflow: 'hidden',
  },
  img: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  shareBtn: {
    position: 'absolute', top: 12, right: 12, zIndex: 2,
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.gold + '55', backgroundColor: Colors.gold + '11',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: Spacing.sm },
  name: { fontFamily: FontFamily.serif, fontVariant: ['lining-nums' as const], fontSize: 26, lineHeight: 30, color: Colors.text, textAlign: 'center', letterSpacing: 0.5 },
  sub: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted, marginTop: 6, textAlign: 'center' },
  groupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: Spacing.md },
  group: { flexShrink: 1, fontFamily: FontFamily.titleBold, fontSize: 19, lineHeight: 24, color: Colors.text },
  addBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.gold, backgroundColor: Colors.gold + '1F' },
  addPlus: { fontFamily: FontFamily.titleBold, fontSize: 20, lineHeight: 22, color: Colors.gold, marginTop: -1 },
  levelBox: { alignSelf: 'stretch', marginTop: Spacing.md, gap: 8, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.bg + 'B3', borderWidth: 1, borderColor: Colors.gold + '33' },
  levelTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  levelLabel: { fontFamily: FontFamily.titleBold, fontSize: 13, letterSpacing: 1.6, color: Colors.muted },
  levelName: { fontFamily: FontFamily.serif, fontVariant: ['lining-nums' as const], fontSize: 26, lineHeight: 30, color: Colors.gold },
  levelHint: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.text },
  levelMore: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, marginTop: 2 },
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
