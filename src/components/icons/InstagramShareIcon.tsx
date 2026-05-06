import { SVGProps } from "react";

/**
 * Instagram-style share icon (paper-plane outline) sourced from uxwing.com.
 * Uses currentColor so it inherits text color via Tailwind.
 */
const InstagramShareIcon = ({
  size = 24,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    aria-hidden="true"
    {...props}
  >
    <path
      d="M21.39 2.97c.46-.46.06-1.24-.56-1.06L2.42 6.86c-.56.16-.6.95-.06 1.18l6.93 2.97 6.18-4.47c.24-.18.5.1.3.32l-4.47 6.18 2.97 6.93c.22.54 1.02.5 1.18-.06l4.94-18.41c.04-.14.02-.28-.04-.4l.04-.13z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

export default InstagramShareIcon;
