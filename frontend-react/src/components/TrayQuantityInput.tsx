import type { ChangeEvent } from 'react';
import { trayQuantityToEggs } from './trayQuantity';
import type { TrayQuantityValue } from './trayQuantity';

export type TrayQuantityMode = 'both' | 'trays' | 'pieces';

const sanitizeInteger = (raw: string, max?: number) => {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return '';
  const parsed = parseInt(digits, 10);
  if (!Number.isFinite(parsed)) return '';
  return String(max !== undefined ? Math.min(parsed, max) : parsed);
};

const formatTrays = (eggs: number) => {
  const trays = eggs / 30;
  return Number.isInteger(trays) ? String(trays) : trays.toFixed(2);
};

interface TrayQuantityInputProps {
  value: TrayQuantityValue;
  onChange: (value: TrayQuantityValue) => void;
  mode?: TrayQuantityMode;
  disabled?: boolean;
  maxEggs?: number;
  compact?: boolean;
  ariaLabel?: string;
}

const TrayQuantityInput = ({
  value,
  onChange,
  mode = 'both',
  disabled = false,
  maxEggs,
  compact = false,
  ariaLabel,
}: TrayQuantityInputProps) => {
  const totalEggs = trayQuantityToEggs(value);
  const maxTrays =
    maxEggs !== undefined ? Math.floor(Math.max(0, maxEggs) / 30) : undefined;
  const maxPieces =
    mode === 'both'
      ? 29
      : maxEggs !== undefined
        ? Math.max(0, Math.floor(maxEggs))
        : undefined;

  const handleTrays = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...value,
      trays: sanitizeInteger(event.target.value, maxTrays),
    });
  };

  const handlePieces = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...value,
      pieces: sanitizeInteger(event.target.value, maxPieces),
    });
  };

  const inputClass = `w-full rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/30 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:disabled:bg-gray-800 ${
    compact ? 'px-2 py-1.5 text-sm' : 'px-3 py-2 text-sm'
  }`;

  return (
    <div className="space-y-1">
      <div className={mode === 'both' ? 'grid grid-cols-2 gap-2' : ''}>
        {mode !== 'pieces' && (
          <div>
            {mode === 'both' && (
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Trays
              </span>
            )}
            <input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={value.trays}
              onChange={handleTrays}
              disabled={disabled}
              placeholder="0"
              aria-label={
                ariaLabel ? `${ariaLabel} trays` : 'Quantity in trays'
              }
              className={inputClass}
            />
          </div>
        )}
        {mode !== 'trays' && (
          <div>
            {mode === 'both' && (
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Pieces
              </span>
            )}
            <input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={value.pieces}
              onChange={handlePieces}
              disabled={disabled}
              placeholder="0"
              aria-label={
                ariaLabel ? `${ariaLabel} pieces` : 'Quantity in pieces'
              }
              className={inputClass}
            />
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        {totalEggs} eggs · {formatTrays(totalEggs)} trays
        {maxEggs !== undefined && (
          <span className="ml-1 text-gray-400 dark:text-gray-500">
            (max {Math.max(0, Math.floor(maxEggs))} eggs)
          </span>
        )}
      </p>
    </div>
  );
};

export default TrayQuantityInput;
