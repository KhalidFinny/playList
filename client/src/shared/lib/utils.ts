import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The M3 type-scale role names, kept in sync with `styles/typography.css`.
 *
 * These MUST be registered with tailwind-merge as font-size classes. Without
 * this, tailwind-merge sees an unknown `text-<word>` utility, assumes it is a
 * text COLOR, and silently drops the real color class when both appear on one
 * element. That failure is invisible: `<Button className="text-title-medium" />`
 * renders with no color set at all instead of `text-on-primary`.
 */
const TYPE_SCALE = [
  "display-large",
  "display-medium",
  "display-small",
  "headline-large",
  "headline-medium",
  "headline-small",
  "title-large",
  "title-medium",
  "title-small",
  "body-large",
  "body-medium",
  "body-small",
  "label-large",
  "label-medium",
  "label-small",
];

const EMPHASIZED = [
  "display-large",
  "display-medium",
  "display-small",
  "headline-large",
  "headline-medium",
  "headline-small",
  "title-large",
  "title-medium",
].map((role) => `${role}-emphasized`);

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...TYPE_SCALE, ...EMPHASIZED] }],
      // M3 shape scale. Also custom, so tailwind-merge would otherwise not know
      // these conflict with Tailwind's own rounded-* utilities.
      rounded: [
        {
          rounded: [
            "m3-xs",
            "m3-sm",
            "m3-md",
            "m3-lg",
            "m3-lg-plus",
            "m3-xl",
            "m3-xl-plus",
            "m3-2xl",
            "m3-full",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
