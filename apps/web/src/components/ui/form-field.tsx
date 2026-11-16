import type { ChangeEvent } from 'react';
import { CAMPO_CLASSES } from './campo-classes';

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
        className={CAMPO_CLASSES}
      />
    </div>
  );
};
