import { useMemo, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/store/ThemeContext';
import { FontFamily, Radius, type ThemeColors } from '@/theme';
import type { BtCelulaBola } from '@/logic/btTracker';
import { chaveCelula, ehCelulaFora } from '@/logic/btMapaCalor';

// Faixas do grid, do mais "quente" (perto da rede) ao mais "frio" (fundo)
const QUENTE = '#E5483D';
const MEDIO = '#E8A33D';
const FRIO = '#2FA58A';

type Indice = BtCelulaBola['linha'];

type Rotulos = {
  /** Rótulo acima do grid (ex.: "Fundo" ou "Rede"). */
  cima: string;
  /** Rótulo abaixo do grid. */
  baixo: string;
  esquerda: string;
  direita: string;
  /** Linha 0 = quente (vermelho) → linha 2 = fria (verde), ou invertido. */
  quenteEmCima: boolean;
  /** Mostra a faixa de 12 casas "fora da quadra" em volta do 3×3. */
  comFora?: boolean;
  /** Espelha esquerda/direita — mantém a casa fisicamente correta ao trocar o lado de referência. */
  invertido?: boolean;
};

const DENTRO: Indice[] = [0, 1, 2];
const COM_FORA: Indice[] = [-1, 0, 1, 2, 3];

/** Esqueleto comum: rótulos, faixa de fora opcional e cores por linha. Cada casa é desenhada por `renderCelula`. */
function MapaCalorBase({
  cima, baixo, esquerda, direita, quenteEmCima, comFora, invertido, renderCelula,
}: Rotulos & {
  renderCelula: (celula: BtCelulaBola, estilo: { fundo: string; borda: string; fora: boolean }) => ReactNode;
}) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const cores = [QUENTE, MEDIO, FRIO];
  const indices = comFora ? COM_FORA : DENTRO;

  const colFisica = (colVis: Indice): Indice => (invertido ? ((2 - colVis) as Indice) : colVis);
  const corDaLinha = (linha: number, alpha: string) => cores[quenteEmCima ? linha : 2 - linha] + alpha;

  return (
    <View style={s.wrap}>
      <Text style={s.rotuloCentro}>{cima}</Text>
      <View style={s.linhaLabels}>
        <Text style={s.rotuloLado}>{invertido ? direita : esquerda}</Text>
        <View style={s.grid}>
          {indices.map(linha => (
            <View key={linha} style={s.linha}>
              {indices.map(colVis => {
                const coluna = colFisica(colVis);
                const celula: BtCelulaBola = { linha, coluna };
                const canto = (linha === -1 || linha === 3) && (coluna === -1 || coluna === 3);
                if (canto) return <View key={colVis} style={s.celula} />;
                const fora = ehCelulaFora(celula);
                return (
                  <View key={colVis}>
                    {renderCelula(celula, fora
                      ? { fundo: Colors.surf2, borda: Colors.line, fora: true }
                      : { fundo: corDaLinha(linha, '33'), borda: corDaLinha(linha, '77'), fora: false })}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
        <Text style={s.rotuloLado}>{invertido ? esquerda : direita}</Text>
      </View>
      <Text style={s.rotuloCentro}>{baixo}</Text>
      {comFora && <Text style={s.legendaFora}>Casas cinzas = bola fora da quadra</Text>}
    </View>
  );
}

/** Grid para registrar a posição de um ponto (toque marca, toque de novo desmarca). */
export function MapaCalorGrid<C extends BtCelulaBola>({
  value, onChange, ...rotulos
}: Rotulos & { value?: C; onChange: (celula: C | undefined) => void }) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <MapaCalorBase
      {...rotulos}
      renderCelula={(celula, estilo) => {
        const selecionado = value?.linha === celula.linha && value?.coluna === celula.coluna;
        return (
          <TouchableOpacity
            style={[
              s.celula,
              { backgroundColor: estilo.fundo, borderColor: estilo.borda },
              estilo.fora && s.celulaFora,
              selecionado && { borderColor: Colors.gold, borderWidth: 2, borderStyle: 'solid', backgroundColor: Colors.gold + '33' },
            ]}
            onPress={() => onChange(selecionado ? undefined : (celula as C))}
            accessibilityRole="button"
            accessibilityLabel={estilo.fora ? 'Fora da quadra' : undefined}
            accessibilityState={{ selected: selecionado }}
          />
        );
      }}
    />
  );
}

/** Mapa agregado do relatório: cada casa mostra quantas vezes foi marcada; a cor da dupla fica mais forte com a frequência. */
export function MapaCalorResumo({
  contagens, cor, ...rotulos
}: Rotulos & { contagens: Record<string, number>; cor: string }) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const max = Math.max(0, ...Object.values(contagens));
  return (
    <MapaCalorBase
      {...rotulos}
      renderCelula={(celula, estilo) => {
        const n = contagens[chaveCelula(celula)] ?? 0;
        // Opacidade de ~20% a 100%, proporcional à casa mais marcada
        const alpha = n > 0 && max > 0 ? Math.round((0.2 + 0.8 * (n / max)) * 255).toString(16).padStart(2, '0') : null;
        return (
          <View
            style={[
              s.celula,
              { backgroundColor: estilo.fundo, borderColor: estilo.borda },
              estilo.fora && s.celulaFora,
              alpha && { backgroundColor: cor + alpha, borderColor: cor, borderStyle: 'solid' },
              s.celulaResumo,
            ]}
          >
            {n > 0 && <Text style={[s.contagem, { color: n / max > 0.55 ? Colors.bg : Colors.text }]}>{n}</Text>}
          </View>
        );
      }}
    />
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  wrap: { alignItems: 'center', gap: 4 },
  rotuloCentro: { fontFamily: FontFamily.bodyMed, fontSize: 11, color: Colors.faint },
  linhaLabels: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rotuloLado: { fontFamily: FontFamily.bodyMed, fontSize: 11, color: Colors.faint, width: 14, textAlign: 'center' },
  grid: { gap: 4 },
  linha: { flexDirection: 'row', gap: 4 },
  celula: { width: 44, height: 32, borderRadius: Radius.sm, borderWidth: 1, borderColor: 'transparent' },
  celulaFora: { borderStyle: 'dashed' },
  celulaResumo: { alignItems: 'center', justifyContent: 'center' },
  contagem: { fontFamily: FontFamily.numberBold, fontSize: 13 },
  legendaFora: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.faint, marginTop: 2 },
});
