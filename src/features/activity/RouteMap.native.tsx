import Constants from 'expo-constants';
import { type ReactNode, useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { radius, useTheme } from '@/theme';

import { RouteSvg, type LatLng } from './RouteSvg';

const hasAndroidKey = !!(Constants.expoConfig?.extra as { hasAndroidMapsKey?: boolean } | undefined)
  ?.hasAndroidMapsKey;

const toCoord = (p: LatLng) => ({ latitude: p.lat, longitude: p.lng });
/** Street level: a walk or run around the block fills the map. */
const FOLLOW_ZOOM = 16;
/** About 100 m in degrees: smaller routes are shown at street level instead of fitted. */
const TINY_SPAN_DEG = 0.001;
/** About 1 km across: street level for the first view. */
const STREET_DELTA = 0.01;
const tiny = (cs: readonly { latitude: number; longitude: number }[]) => {
  const lats = cs.map((c) => c.latitude);
  const lngs = cs.map((c) => c.longitude);
  return (
    Math.max(...lats) - Math.min(...lats) < TINY_SPAN_DEG &&
    Math.max(...lngs) - Math.min(...lngs) < TINY_SPAN_DEG
  );
};

/** Apple Maps on iOS, Google Maps on Android when a key is configured, else an SVG shape. */
export function RouteMap({
  pieces,
  height = 240,
  follow = false,
  fill = false,
  overlay,
}: {
  pieces: readonly (readonly LatLng[])[];
  height?: number;
  follow?: boolean;
  /** Take all the space the parent gives (the live recording screen). */
  fill?: boolean;
  /** Drawn on top of the map's top edge (status and GPS badges). */
  overlay?: ReactNode;
}) {
  const { colors } = useTheme();
  const ref = useRef<MapView>(null);
  const coords = useMemo(() => pieces.map((p) => p.map(toCoord)), [pieces]);
  const all = useMemo(() => coords.flat(), [coords]);
  const last = all[all.length - 1];
  // Before the first route point the map would open on the whole world: it centres on the phone's
  // location once instead.
  const centred = useRef(false);

  useEffect(() => {
    if (!all.length || !ref.current) return;
    if (follow && last) {
      ref.current.animateCamera({ center: last, zoom: FOLLOW_ZOOM }, { duration: 500 });
      centred.current = true;
    } else if (tiny(all) && last) {
      // A route of a few metres would be "fitted" at maximum zoom (a pin on a blank map).
      ref.current.animateCamera({ center: last, zoom: FOLLOW_ZOOM }, { duration: 0 });
    } else {
      ref.current.fitToCoordinates(all, {
        edgePadding: { top: 32, right: 32, bottom: 32, left: 32 },
        animated: false,
      });
    }
  }, [all, follow, last]);

  if (Platform.OS === 'android' && !hasAndroidKey)
    return (
      <View style={fill ? styles.fill : undefined}>
        <RouteSvg pieces={pieces} height={height} />
        {overlay ? <View style={styles.overlay}>{overlay}</View> : null}
      </View>
    );
  return (
    <View style={[styles.box, fill ? styles.fill : { height }]}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        showsUserLocation={follow}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        onUserLocationChange={(e) => {
          const c = e.nativeEvent.coordinate;
          if (!follow || centred.current || !c || !ref.current) return;
          centred.current = true;
          // A region jumps straight to street level (a camera zoom eased in slowly on Android).
          ref.current.animateToRegion(
            {
              latitude: c.latitude,
              longitude: c.longitude,
              latitudeDelta: STREET_DELTA,
              longitudeDelta: STREET_DELTA,
            },
            0,
          );
        }}
        initialCamera={
          last
            ? { center: last, zoom: FOLLOW_ZOOM, heading: 0, pitch: 0, altitude: 1500 }
            : undefined
        }
        accessibilityLabel="Route map"
      >
        {coords.map((c, i) =>
          c.length > 1 ? (
            <Polyline key={i} coordinates={c} strokeColor={colors.accent} strokeWidth={5} />
          ) : null,
        )}
        {all[0] && !follow ? <Marker coordinate={all[0]} title="Start" pinColor="green" /> : null}
        {last && !follow ? <Marker coordinate={last} title="Finish" /> : null}
      </MapView>
      {overlay ? (
        <View style={styles.overlay} pointerEvents="box-none">
          {overlay}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.card, overflow: 'hidden' },
  fill: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0 },
});
