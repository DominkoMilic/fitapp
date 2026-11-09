import { RouteSvg, type LatLng } from './RouteSvg';

/** Web: no native map; draw the route shape. */
export function RouteMap(props: {
  pieces: readonly (readonly LatLng[])[];
  height?: number;
  follow?: boolean;
}) {
  return <RouteSvg pieces={props.pieces} height={props.height} />;
}
