import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { RouteSvg, type LatLng } from './RouteSvg';

/** Web: no native map; draw the route shape. */
export function RouteMap(props: {
  pieces: readonly (readonly LatLng[])[];
  height?: number;
  follow?: boolean;
  fill?: boolean;
  overlay?: ReactNode;
}) {
  return (
    <View style={props.fill ? styles.fill : undefined}>
      <RouteSvg pieces={props.pieces} height={props.height} />
      {props.overlay ? <View style={styles.overlay}>{props.overlay}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0 },
});
