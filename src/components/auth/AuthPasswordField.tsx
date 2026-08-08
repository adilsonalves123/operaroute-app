"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  inputClassName?: string;
  labelClassName?: string;
};

export function AuthPasswordField({
  label,
  value,
  onChange,
  placeholder = "••••••••",
  autoComplete = "current-password",
  required = true,
  inputClassName = "auth-input-v2",
  labelClassName = "text-[10px] font-medium uppercase tracking-[0.2em] text-[#7a8494]",
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block space-y-1.5">
      <span className={labelClassName}>{label}</span>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className={`${inputClassName} !pr-11`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#7a8494] transition hover:text-[#c9a87c]"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}
