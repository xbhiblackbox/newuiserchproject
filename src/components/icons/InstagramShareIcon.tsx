import { SVGProps } from "react";

/**
 * Instagram-style share (paper plane) outline icon — simple triangle, no middle fold line.
 */
const InstagramShareIcon = ({
  size = 24,
  strokeWidth = 1.8,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M21.5 3.5 L3 10.5 L11 13 L21.5 3.5 Z" />
    <path d="M21.5 3.5 L11 13 L13.5 21 L21.5 3.5 Z" />
  </svg>
);

export default InstagramShareIcon;
