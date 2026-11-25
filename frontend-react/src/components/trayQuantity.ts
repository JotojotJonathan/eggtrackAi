export interface TrayQuantityValue {
  trays: string;
  pieces: string;
}

export const EMPTY_TRAY_QUANTITY: TrayQuantityValue = {
  trays: '',
  pieces: '',
};

const toCount = (value: string) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const trayQuantityToEggs = (value: TrayQuantityValue) =>
  toCount(value.trays) * 30 + toCount(value.pieces);

export const eggsToTrayQuantity = (eggs: number): TrayQuantityValue => {
  const safeEggs = Number.isFinite(eggs) && eggs > 0 ? Math.floor(eggs) : 0;
  if (safeEggs === 0) return EMPTY_TRAY_QUANTITY;
  return {
    trays: String(Math.floor(safeEggs / 30)) || '',
    pieces: String(safeEggs % 30) || '',
  };
};
