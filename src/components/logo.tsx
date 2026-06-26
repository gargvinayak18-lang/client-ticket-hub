import React from "react";

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  showText?: boolean;
  lightText?: boolean;
  containerClassName?: string;
}

export function Logo({
  showText = true,
  lightText = false,
  containerClassName = "",
  className = "",
  ...props
}: LogoProps) {
  return (
    <div className={`flex items-center gap-2 select-none ${containerClassName}`}>
      {/* Dynamic SVG Logo Icon */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 ${className}`}
        {...props}
      >
        {/* 3/4 Outer Ring (representing top-left, top-right, bottom-right quadrants) */}
        {/* Radius 8, Center (12,12). Starts at 6 o'clock (12, 20), goes clockwise to 9 o'clock (4, 12). */}
        <path
          d="M 12 20 A 8 8 0 1 1 4 12"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          className={lightText ? "text-white" : "text-current"}
        />

        {/* Pink Wedge in the bottom-left quadrant (representing the SupportDesk pink accent) */}
        {/* Center (12,12) -> left edge (4,12) -> arc counter-clockwise to bottom edge (12,20) -> back to center (12,12) */}
        <path
          d="M 12 12 L 4 12 A 8 8 0 0 0 12 20 Z"
          fill="#D6336C"
        />
      </svg>

      {/* Brand Text */}
      {showText && (
        <span className="font-extrabold text-lg tracking-tight font-sans">
          <span style={{ color: "#D6336C" }}>Support</span>
          <span className={lightText ? "text-white" : "text-current"}>Desk</span>
          <span style={{ color: "#D6336C" }}>.</span>
        </span>
      )}
    </div>
  );
}
