import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  const classes = ["btn", `btn-${variant}`, size === "sm" ? "btn-sm" : "", className]
    .filter(Boolean)
    .join(" ");
  return <button className={classes} {...props} />;
}
