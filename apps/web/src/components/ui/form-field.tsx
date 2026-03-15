import type { ChangeEvent } from 'react';

interface FormFieldProps {
  id: string;
  label: string;
  type: 'email' | 'password' | 'text';
  autoComplete: string;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
}

export const FormField = ({ id, label, type, autoComplete, value, onChange }: FormFieldProps) => {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-text-muted">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={onChange}
        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-text outline-none transition focus:border-info focus:ring-2 focus:ring-info/30"
      />
    </div>
  );
};
