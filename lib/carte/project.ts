import { geoConicConformal } from "d3-geo";
import settings from "./projection.json";

/**
 * The projection of the map of Europe (public/carte/europe.json): turns a
 * [longitude, latitude] into a point of the 1000 × 860 map.
 */
const projection = geoConicConformal()
  .parallels(settings.parallels as [number, number])
  .rotate(settings.rotate as [number, number])
  .center(settings.center as [number, number])
  .scale(settings.scale)
  .translate(settings.translate as [number, number]);

export const MAP_WIDTH = settings.width;
export const MAP_HEIGHT = settings.height;

export function project(point: [number, number]): [number, number] | null {
  return projection(point);
}

/** The same point in a smaller frame of the given size, centred, or null outside. */
export function projectInto(
  point: [number, number],
  width: number,
  height: number,
): [number, number] | null {
  const xy = projection(point);
  if (!xy) return null;
  const scale = width / MAP_WIDTH;
  const x = xy[0] * scale;
  const y = xy[1] * scale - (MAP_HEIGHT * scale - height) / 2;
  return x >= 0 && x <= width && y >= 0 && y <= height ? [x, y] : null;
}
