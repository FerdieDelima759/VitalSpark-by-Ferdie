"use client";

export interface LoaderProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  inline?: boolean;
  color?: "amber" | "green";
  textColor?: "white" | "slate";
}

export default function Loader({ 
  size = "md", 
  text, 
  inline = false,
  color = "amber",
  textColor = "white"
}: LoaderProps) {
  const sizeClasses = {
    sm: "w-6 h-6 border-2",
    md: "w-12 h-12 border-[3px]",
    lg: "w-16 h-16 border-4",
  };

  const colorClasses = {
    amber: "border-amber-400",
    green: "border-green-500",
  };

  const textColorClasses = {
    white: "text-white",
    slate: "text-slate-700",
  };

  const spinner = (
    <div
      className={`${sizeClasses[size]} ${colorClasses[color]} border-t-transparent rounded-full animate-spin`}
    />
  );

  if (inline) {
    return spinner;
  }

  return (
    <div className="flex flex-col items-center justify-center">
      {spinner}
      {text && (
        <p className={`mt-4 text-lg font-semibold ${textColorClasses[textColor]}`}>{text}</p>
      )}
    </div>
  );
}

