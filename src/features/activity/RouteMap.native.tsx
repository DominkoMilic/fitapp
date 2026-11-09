import Constants from 'expo-constants';
import { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { radius, useTheme } from '@/theme';

import { RouteSvg, type LatLng } from './RouteSvg';

const hasAndroidKey = !!(Constants.expoConfig?.extra as { hasAndroidMapsKey?: boolean } | undefined)
  ?.hasAndroidMapsKey;

const toCoord = (p: LatLng) => ({ latitude: p.lat, longitude: p.lng });

/** Apple Maps on iOS, Google Maps on Android when a key is configured, else an SVG shape. */
export function RouteMap({
  pieces,
  height = 240,
  follow = false,
}: {
  pieces: readonly (readonly LatLng[])[];
  height?: number;
  follow?: boolean;
}) {
  const { colors } = useTheme();
  const ref = useRef<MapView>(null);
  const coords = useMemo(() => pieces.map((p) => p.map(toCoord)), [pieces]);
  const all = useMemo(() => coords.flat(), [coords]);
  const last = all[all.length - 1];

  useEffect(() => {
    if (!all.length || !ref.current) return;
    if (follow && last) {
      ref.current.animateCamera({ center: last }, { duration: 500 });
    } else {
      ref.current.fitToCoordinates(all, {
        edgePadding: { top: 32, right: 32, bottom: 32, left: 32 },
        animated: false,
      });
    }
  }, [all, follow, last]);

  if (Platform.OS === 'android' && !hasAndroidKey)
    return <RouteSvg pieces={pieces} height={height} />;
  return (
    <View style={[styles.box, { height }]}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        showsUserLocation={follow}
        initialCamera={
          last ? { center: last, zoom: 15, heading: 0, pitch: 0, altitude: 1500 } : undefined
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
    </View>
  );
}

const styles = StyleSheet.create({ box: { borderRadius: radius.card, overflow: 'hidden' } });
