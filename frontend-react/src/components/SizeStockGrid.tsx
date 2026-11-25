import type { EggSize } from '../api/api';

export interface SizeStockOption {
  value: EggSize;
  label: string;
  shortLabel: string;
  availableEggs: number;
  availableTrays?: number;
}

interface SizeStockGridProps {
  options: SizeStockOption[];
  value: EggSize;
  onChange: (value: EggSize) => void;
  unit: 'tray' | 'piece';
  disabled?: boolean;
  className?: string;
}

const SizeStockGrid = ({
  options,
  value,
  onChange,
  unit,
  disabled = false,
  className = '',
}: SizeStockGridProps) => {
  return (
    <div
      className={`grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 ${className}`}
    >
      {options.map((option) => {
        const availableEggs = Math.max(0, Math.floor(option.availableEggs));
        const availableTrays =
          option.availableTrays !== undefined
            ? Math.max(0, Math.floor(option.availableTrays))
            : Math.floor(availableEggs / 30);
        const orderableUnits = unit === 'tray' ? availableTrays : availableEggs;
        const isOutOfStock = orderableUnits < 1;
        const isSelected = option.value === value;
        const isDisabled = disabled || isOutOfStock;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={isDisabled}
            aria-pressed={isSelected}
            title={isOutOfStock ? 'Out of stock' : `${availableEggs} eggs available`}
            className={`rounded-xl border p-3 text-left transition ${
              isSelected
                ? 'border-green-600 bg-green-50 ring-2 ring-green-500/30 dark:border-green-500 dark:bg-green-900/30'
                : 'border-gray-200 bg-white hover:border-green-400 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-green-500'
            } ${isDisabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {option.shortLabel}
              </span>
              {isSelected && (
                <span className="rounded-full bg-green-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  Selected
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
              {option.label}
            </p>
            <p
              className={`mt-1 text-[11px] font-medium ${
                isOutOfStock
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-green-700 dark:text-green-400'
              }`}
            >
              {isOutOfStock
                ? 'Out of stock'
                : `${availableTrays} trays · ${availableEggs} pcs`}
            </p>
          </button>
        );
      })}
    </div>
  );
};

export default SizeStockGrid;
