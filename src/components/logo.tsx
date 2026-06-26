import React from "react";

interface LogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  containerClassName?: string;
  showText?: boolean;
  lightText?: boolean;
}

export function Logo({
  containerClassName = "",
  className = "",
  showText,
  lightText,
  ...props
}: LogoProps) {
  return (
    <div className={`flex items-center select-none ${containerClassName}`}>
      <img
        src="/logo.png"
        alt="SupportDesk Logo"
        className={`shrink-0 object-contain ${className}`}
        {...props}
      />
    </div>
  );
}
