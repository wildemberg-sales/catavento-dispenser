import React from "react";

export function Card({
  children,
  style,
  className,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={["card", className].filter(Boolean).join(" ")} style={style}>
      {children}
    </div>
  );
}
