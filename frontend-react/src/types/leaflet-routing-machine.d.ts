import * as L from 'leaflet';

declare module 'leaflet' {
  namespace Routing {
    interface ControlOptions {
      waypoints: L.LatLng[];
      routeWhileDragging?: boolean;
      showAlternatives?: boolean;
      fitSelectedRoutes?: boolean;
      lineOptions?: {
        styles: Array<{ color: string; weight: number; opacity: number }>;
      };
      createMarker?: () => null;
      show?: boolean;
      addWaypoints?: boolean;
      draggableWaypoints?: boolean;
    }

    class Control extends L.Control {
      constructor(options?: ControlOptions);
      onAdd(map: L.Map): HTMLElement;
      onRemove(map: L.Map): void;
      getWaypoints(): L.LatLng[];
      getRouter(): any;
      route(): void;
    }
  }
}