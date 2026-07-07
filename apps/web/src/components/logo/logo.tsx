import { cn } from "@/lib/utils";

/**
 * The single logo component — admin header AND marketing header/footer render this;
 * never create a second logo implementation.
 * Rebrand contract (see src/brand.ts): the two variants (full wordmark + compact
 * mobile mark) use token-based tinting (fill-text-primary / hsl(var(--primary-*))
 * gradients) so the logo follows light/dark mode.
 * Artwork: Seenaly bird mark (from the brand master art, tile removed)
 * + "seenaly" text wordmark. Master SVGs with the Baloo Thambi 2 wordmark live in
 * packages/content/brand/logo-{dark,lite,icon}.svg.
 */

const Mark = ({ gradientId }: { gradientId: string }) => (
  <>
    <g transform="matrix(3.027022,0.045393,-0.045393,3.027022,-599.87756,-608.431569)">
      <path
        d="M385.421,330.631C394.526,319.28 402.903,307.467 404.679,299.537C410.196,274.911 381.759,257.66 381.759,257.66C381.759,257.66 407.161,264.982 417.556,267.107C426.598,267.983 426.499,267.971 435.506,267.887C437.627,267.678 447.562,268.24 461.338,262.148C466.702,259.776 489.144,241.111 489.144,241.111C489.144,241.111 471.198,264.316 467.741,271.613C457.178,293.912 464.604,309.166 467.345,315.578C468.594,318.043 472.753,325.764 473.228,326.647C492.313,362.342 496.636,381.094 489.141,414.391C488.454,416.432 488.183,419.076 483.355,429.426C472.9,451.836 444.234,477.922 401.511,479.847C346.617,482.321 317.885,452.317 308.211,449.947C301.696,448.352 295.671,448.185 287.987,453.353C270.503,465.112 246.673,483.487 247.398,482.462C255.951,470.365 277.327,441.812 279.068,439.234C288.491,425.286 280.077,424.539 267.336,402.591C218.872,313.916 271.226,248.139 331.524,244.751C364.068,242.922 373.562,255 373.562,255C373.562,255 362.177,254.209 360.508,254.137C303.032,251.664 294.345,301.51 306.001,339.695C310.338,351.238 312.357,358.363 326.297,375.659C327.84,377.384 337.828,388.545 347.805,395.005C408.78,434.482 470.491,405.49 470.541,366.501C470.581,334.888 449.614,329.725 443.454,327.738C423.945,325.1 410.887,333.013 397.776,342.166C407.342,355.236 408.249,371.662 398.999,381.687C388.125,393.475 367.304,391.981 352.533,378.355C337.762,364.728 334.599,344.094 345.473,332.307C354.825,322.17 371.531,321.855 385.421,330.631Z"
        fill={`url(#${gradientId})`}
      />
    </g>
    <defs>
      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
        <stop style={{ stopColor: "hsl(var(--primary-light))" }} />
        <stop offset="1" style={{ stopColor: "hsl(var(--primary-dark))" }} />
      </linearGradient>
    </defs>
  </>
);

export default function Logo({ classNameFull, classNameMobile }: { classNameFull?: string; classNameMobile?: string }) {
  return (
    <>
      <svg
        className={cn("fill-current", classNameFull)}
        width="124"
        height="27"
        viewBox="0 0 124 27"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <svg x="0" y="0" width="27" height="27" viewBox="0 0 1000 1000">
          <Mark gradientId="seenaly_logo_full" />
        </svg>
        <text
          x="32"
          y="20.5"
          className="fill-text-primary"
          style={{ fontFamily: "inherit", fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em" }}
        >
          seenaly
        </text>
      </svg>

      <svg
        className={cn("fill-current", classNameMobile)}
        width="27"
        height="27"
        viewBox="0 0 1000 1000"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <Mark gradientId="seenaly_logo_mobile" />
      </svg>
    </>
  );
}
