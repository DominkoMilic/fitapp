import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { Text } from '@/components/ui';
import { radius, useTheme } from '@/theme';

export type LatLng = { lat: number; lng: number };

/** Equirectangular projection of route pieces into a box (fine at activity scale). */
export function projectPieces(
  pieces: readonly (readonly LatLng[])[],
  w: number,
  h: number,
  pad = 12,
) {
  const all = pieces.flat();
  if (!all.length) return [];
  const lat0 = all.reduce((a, p) => a + p.lat, 0) / all.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = all.map((p) => p.lng * k);
  const ys = all.map((p) => p.lat);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const span = Math.max(maxX - minX, maxY - minY, 1e-6);
  const s = Math.min(w - 2 * pad, h - 2 * pad) / span;
  const ox = (w - (maxX - minX) * s) / 2;
  const oy = (h - (maxY - minY) * s) / 2;
  return pieces.map((piece) =>
    piece.map((p) => ({ x: ox + (p.lng * k - minX) * s, y: h - (oy + (p.lat - minY) * s) })),
  );
}

/** Route drawn without a map (web, or Android without a Maps key). */
export function RouteSvg({
  pieces,
  height = 220,
}: {
  pieces: readonly (readonly LatLng[])[];
  height?: number;
}) {
  const { colors } = useTheme();
  const width = 320;
  const proj = projectPieces(pieces, width, height);
  const first = proj[0]?.[0];
  const lastPiece = proj[proj.length - 1];
  const last = lastPiece?.[lastPiece.length - 1];
  if (!first) {
    return (
      <View style={[styles.box, { height, backgroundColor: colors.surface }]}>
        <Text variant="small" color="textSecondary">
          No route yet
        </Text>
      </View>
    );
  }
  return (
    <View
      style={[styles.box, { height, backgroundColor: colors.surface }]}
      accessibilityRole="image"
      accessibilityLabel="Route shape"
    >
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {proj.map((piece, i) => (
          <Polyline
            key={i}
            points={piece.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={colors.accent}
            strokeWidth={4}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        <Circle cx={first.x} cy={first.y} r={6} fill={colors.accent} />
        {last ? <Circle cx={last.x} cy={last.y} r={6} fill={colors.textPrimary} /> : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.card,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
