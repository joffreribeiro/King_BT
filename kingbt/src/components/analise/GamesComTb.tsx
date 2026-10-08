import { View, Text, StyleSheet, type TextStyle, type StyleProp } from 'react-native';

type Props = {
  games: number;
  /** Pontos do tie-break do set; aparece nas duas duplas (ex.: 7⁷ e 6⁵). */
  tb?: number;
  /** Estilo do número; o `width` dele vira a largura da coluna. */
  style?: StyleProp<TextStyle>;
  tbColor?: string;
};

/** Número de games com os pontos do tie-break como expoente (ex.: 6⁵). */
export function GamesComTb({ games, tb, style, tbColor }: Props) {
  if (tb === undefined) return <Text style={style}>{games}</Text>;
  const { width, textAlign: _t, ...resto } = StyleSheet.flatten(style) ?? {};
  return (
    <View style={{ width, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' }}>
      <Text style={resto}>{games}</Text>
      <Text style={{ fontSize: 11, lineHeight: 14, marginTop: 2, color: tbColor ?? (resto.color as string | undefined) ?? '#999' }}>{tb}</Text>
    </View>
  );
}
