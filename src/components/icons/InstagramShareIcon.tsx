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
    viewBox="0 0 122.88 108.3"
    width={size}
    height={size}
    fill="currentColor"
    aria-hidden="true"
    {...props}
  >
    <path d="M96.14,12.47l-76.71-1.1,28.3,27.85L96.14,12.47ZM53.27,49l9.88,39.17L102.1,22,53.27,49ZM117,1.6a5.59,5.59,0,0,1,4.9,8.75L66.06,105.21a5.6,5.6,0,0,1-10.44-1.15L41.74,49,1.67,9.57A5.59,5.59,0,0,1,5.65,0L117,1.6Z" />
  </svg>
);

export default InstagramShareIcon;
