
interface FormFieldProps {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  required?: boolean;
  className?: string;
  options?: { id: number | string; name: string }[];
  maxLength?: number;
  pattern?: string;
  title?: string;
  isTextarea?: boolean;
}

export default function FormField({
  label,
  id,
  type = "text",
  value,
  onChange,
  required = false,
  className = "",
  options,
  maxLength,
  pattern,
  title,
  isTextarea = false
}: FormFieldProps) {
  const baseClasses = "block w-full rounded-lg border border-gray-300 bg-white shadow-sm px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary focus:ring-opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors duration-150";

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
      >
        {label}
      </label>
      
      {options ? (
        <select
          id={id}
          value={value}
          onChange={onChange}
          className={baseClasses}
          required={required}
        >
          <option value="">Seçiniz</option>
          {options.map(option => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      ) : isTextarea ? (
        <textarea
          id={id}
          value={value}
          onChange={onChange}
          className={`${baseClasses} min-h-[80px] resize-y`}
          required={required}
        />
      ) : (
        <input
          type={type}
          id={id}
          value={value}
          onChange={onChange}
          className={baseClasses}
          required={required}
          maxLength={maxLength}
          pattern={pattern}
          title={title}
        />
      )}
    </div>
  );
}
