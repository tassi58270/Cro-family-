"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type {
  GeoJSONSourceSpecification,
  LayerSpecification,
  Map as MapLibre,
  Marker,
} from "maplibre-gl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/design/cn";

/**
 * The map of the Places and events page (6.6), drawn by MapLibre GL over a
 * background of our own (public/carte/fond.json): no tile server, no key,
 * the colours of the site in both themes. Places are marked by two red dots,
 * the dieresis of the ÿ.
 */

export type MapPoint = { id: string; name: string; lat: number; lng: number };

/** Room kept free on each side, for what covers the map. */
export type Inset = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

export type MapApi = {
  flyTo: (id: string, inset?: Inset) => void;
  fit: (ids?: string[]) => void;
  zoomBy: (delta: number) => void;
};

const EUROPE: [[number, number], [number, number]] = [
  [-10, 36],
  [28, 59],
];
const DETAIL_ZOOM = 5;
const PLACE_ZOOM = 6.5;

type Palette = { sea: string; land: string; coast: string; border: string };

function palette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(name).trim();
  return {
    sea: token("--paper-2"),
    land: token("--paper"),
    coast: token("--hairline-strong"),
    border: token("--hairline-strong"),
  };
}

function layers(source: string, colors: Palette): LayerSpecification[] {
  const of = (layer: string) => ["==", ["get", "layer"], layer] as const;
  return [
    {
      id: `${source}-land`,
      type: "fill",
      source,
      filter: of("land") as never,
      paint: { "fill-color": colors.land },
    },
    {
      id: `${source}-coast`,
      type: "line",
      source,
      filter: of("land") as never,
      paint: { "line-color": colors.coast, "line-width": 0.8 },
    },
    {
      id: `${source}-borders`,
      type: "line",
      source,
      filter: of("borders") as never,
      paint: {
        "line-color": colors.border,
        "line-width": 0.7,
        "line-dasharray": [3, 2],
      },
    },
  ];
}

function paint(map: MapLibre, colors: Palette) {
  map.setPaintProperty("sea", "background-color", colors.sea);
  for (const source of ["fond", "detail"]) {
    if (!map.getLayer(`${source}-land`)) continue;
    map.setPaintProperty(`${source}-land`, "fill-color", colors.land);
    map.setPaintProperty(`${source}-coast`, "line-color", colors.coast);
    map.setPaintProperty(`${source}-borders`, "line-color", colors.border);
  }
}

function markerElement(point: MapPoint, onSelect: (id: string) => void) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "map-marker";
  button.dataset.place = point.id;
  button.setAttribute("aria-label", point.name);
  const dots = document.createElement("span");
  dots.className = "map-marker-dots";
  dots.setAttribute("aria-hidden", "true");
  dots.append(document.createElement("i"), document.createElement("i"));
  const label = document.createElement("span");
  label.className = "map-marker-label";
  label.setAttribute("aria-hidden", "true");
  label.textContent = point.name;
  button.append(dots, label);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onSelect(point.id);
  });
  return button;
}

export function MapView({
  points,
  active,
  dimmed,
  onSelect,
  onReady,
  onPick,
  apiRef,
  labels,
  className,
}: {
  points: MapPoint[];
  active: string | null;
  dimmed: ReadonlySet<string>;
  onSelect: (id: string) => void;
  /** Once the map is drawn: the moment to frame the places. */
  onReady?: () => void;
  /** A click on the map, to place something there (dashboard). */
  onPick?: (lat: number, lng: number) => void;
  apiRef: { current: MapApi | null };
  labels: {
    map: string;
    loading: string;
    unavailable: string;
    credit: string;
  };
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const select = useRef(onSelect);
  const ready = useRef(onReady);
  const pick = useRef(onPick);
  const pointsRef = useRef(points);
  const look = useRef({ active, dimmed });
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );

  useLayoutEffect(() => {
    select.current = onSelect;
    ready.current = onReady;
    pick.current = onPick;
    pointsRef.current = points;
    look.current = { active, dimmed };
  });

  const syncMarkers = useRef(() => {
    const { active: current, dimmed: faded } = look.current;
    for (const [id, marker] of markers.current) {
      const element = marker.getElement();
      const on = id === current;
      element.toggleAttribute("data-active", on);
      element.toggleAttribute("data-dim", !on && faded.has(id));
      element.style.zIndex = on ? "2" : "";
      if (on) element.setAttribute("aria-current", "true");
      else element.removeAttribute("aria-current");
    }
  });

  // The map itself, created once.
  useEffect(() => {
    const placed = markers.current;
    let cancelled = false;
    let observer: MutationObserver | undefined;
    let scheme: MediaQueryList | undefined;
    const repaint = () => {
      if (mapRef.current?.isStyleLoaded()) paint(mapRef.current, palette());
    };

    import("maplibre-gl")
      .then(({ default: maplibregl }) => {
        if (cancelled || !container.current) return;
        const colors = palette();
        let map: MapLibre;
        try {
          map = new maplibregl.Map({
            container: container.current,
            bounds: EUROPE,
            fitBoundsOptions: { padding: 24 },
            minZoom: 2.5,
            maxZoom: 11,
            maxBounds: [
              [-45, 18],
              [65, 76],
            ],
            attributionControl: false,
            dragRotate: false,
            pitchWithRotate: false,
            touchPitch: false,
            style: {
              version: 8,
              sources: {
                fond: {
                  type: "geojson",
                  data: "/carte/fond.json",
                } satisfies GeoJSONSourceSpecification,
              },
              layers: [
                {
                  id: "sea",
                  type: "background",
                  paint: { "background-color": colors.sea },
                },
                ...layers("fond", colors),
              ],
            },
          });
        } catch {
          setStatus("unavailable");
          return;
        }
        map.touchZoomRotate.disableRotation();
        map.keyboard.disableRotation();
        map.getCanvas().setAttribute("aria-label", labels.map);
        mapRef.current = map;

        map.on("click", (event) =>
          pick.current?.(event.lngLat.lat, event.lngLat.lng),
        );
        if (pick.current) map.getCanvas().style.cursor = "crosshair";
        map.on("load", () => {
          if (cancelled) return;
          setStatus("ready");
        });
        map.once("idle", () => {
          if (!cancelled) ready.current?.();
        });
        // Finer coasts once the map comes closer, fetched only then.
        const detail = () => {
          if (map.getZoom() < DETAIL_ZOOM - 0.5 || map.getSource("detail"))
            return;
          map.addSource("detail", {
            type: "geojson",
            data: "/carte/fond-detail.json",
          });
          for (const layer of layers("detail", palette()))
            map.addLayer({ ...layer, minzoom: DETAIL_ZOOM });
          map.once("sourcedata", () => {
            for (const id of ["fond-land", "fond-coast", "fond-borders"])
              map.setLayerZoomRange(id, 0, DETAIL_ZOOM);
          });
        };
        map.on("zoomend", detail);

        observer = new MutationObserver(repaint);
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["data-theme"],
        });
        scheme = window.matchMedia("(prefers-color-scheme: dark)");
        scheme.addEventListener("change", repaint);
      })
      .catch(() => {
        if (!cancelled) setStatus("unavailable");
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
      scheme?.removeEventListener("change", repaint);
      mapRef.current?.remove();
      mapRef.current = null;
      placed.clear();
    };
    // Labels are read once: the map is created again only with the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The markers follow the places the viewer may see.
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;
    let alive = true;
    import("maplibre-gl").then(({ default: maplibregl }) => {
      if (!alive) return;
      for (const marker of markers.current.values()) marker.remove();
      markers.current.clear();
      // West to east, so that Tab follows the map.
      for (const point of [...points].sort((a, b) => a.lng - b.lng)) {
        const element = markerElement(point, (id) => select.current(id));
        markers.current.set(
          point.id,
          new maplibregl.Marker({ element, anchor: "center" })
            .setLngLat([point.lng, point.lat])
            .addTo(map),
        );
      }
      syncMarkers.current();
    });
    return () => {
      alive = false;
    };
  }, [points, status]);

  // Active and dimmed places.
  useEffect(() => syncMarkers.current(), [active, dimmed]);

  useEffect(() => {
    const at = (id: string) => pointsRef.current.find((p) => p.id === id);
    apiRef.current = {
      flyTo(id, inset = {}) {
        const map = mapRef.current;
        const point = at(id);
        if (!map || !point) return;
        map.flyTo({
          center: [point.lng, point.lat],
          zoom: Math.max(map.getZoom(), PLACE_ZOOM),
          duration: 1800,
          padding: { top: 0, right: 0, bottom: 0, left: 0, ...inset },
        });
      },
      fit(ids) {
        const map = mapRef.current;
        if (!map) return;
        const list = (ids ?? pointsRef.current.map((p) => p.id))
          .map(at)
          .filter((p): p is MapPoint => Boolean(p));
        if (!list.length) {
          map.fitBounds(EUROPE, { padding: 24, duration: 900 });
          return;
        }
        if (list.length === 1) {
          map.flyTo({
            center: [list[0].lng, list[0].lat],
            zoom: PLACE_ZOOM,
            duration: 900,
          });
          return;
        }
        const lngs = list.map((p) => p.lng);
        const lats = list.map((p) => p.lat);
        map.fitBounds(
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          { padding: 64, maxZoom: 7, duration: 900 },
        );
      },
      zoomBy(delta) {
        const map = mapRef.current;
        if (map) map.easeTo({ zoom: map.getZoom() + delta, duration: 250 });
      },
    };
  }, [apiRef]);

  return (
    <div className={cn("isolate overflow-hidden bg-paper-2", className)}>
      {/* MapLibre makes its container relative: it fills a positioned frame. */}
      <div className="absolute inset-0">
        <div
          ref={container}
          role="region"
          aria-label={labels.map}
          className="size-full"
        />
      </div>
      {status !== "ready" && (
        <p
          className={cn(
            "absolute inset-0 grid place-content-center px-8 text-center text-caption text-ink-muted",
            status === "loading" && "motion-safe:animate-pulse",
          )}
          role={status === "unavailable" ? "status" : undefined}
        >
          {status === "loading" ? labels.loading : labels.unavailable}
        </p>
      )}
      <p className="pointer-events-none absolute right-2 bottom-1.5 z-10 text-[0.6875rem] text-ink-muted">
        {labels.credit}
      </p>
    </div>
  );
}
