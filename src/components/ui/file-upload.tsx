"use client";

import { cn } from "@/lib/utils";
import { ChangeEvent, useRef } from "react";

interface FileUploadProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  onFileChange: (file: File) => void;
  accept?: string;
}

export function FileUpload({
  className,
  onFileChange,
  onClick,
  accept = "image/*",
  children,
  ...props
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    inputRef.current?.click();
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileChange(file);
    }
  };

  return (
    <>
      <button
        {...props}
        type="button"
        onClick={handleClick}
        className={cn(
          "w-full cursor-pointer rounded-md border border-dashed border-input bg-background p-4 text-left transition-colors hover:border-ring hover:bg-muted/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
      >
        {children}
      </button>
      <input
        type="file"
        ref={inputRef}
        onChange={handleChange}
        accept={accept}
        className="hidden"
      />
    </>
  );
}
