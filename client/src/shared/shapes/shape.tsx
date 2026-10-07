import type { SVGProps } from "react";
import { SHAPE_PATHS, type ShapeName } from "./shape-data";

export interface ShapeProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  /** Which library shape to draw. */
  name: ShapeName;
  /** Rendered box in px. The viewBox is 100x100. */
  size?: number;
}

/**
 * One M3 Expressive shape from the library.
 *
 * All shapes are normalised to a 100x100 viewBox with a common vertex count, so
 * this can also be used as a `clipPath` source or interpolated (see shape-morph).
 */
export function Shape({ name, size = 48, ...rest }: ShapeProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <path d={SHAPE_PATHS[name]} />
    </svg>
  );
}

export type { ShapeName };
export { SHAPE_PATHS, LOADING_MORPH } from "./shape-data";
