export type StatusPillSize = 'sm' | 'md';

interface StatusPillProps {
  status?: string | null;
  label?: string;
  size?: StatusPillSize;
  className?: string;
}

const STATUS_STYLES: Record<string, string> = {
  COMPLETED:
    'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  DELIVERED:
    'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  PAID: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  ACTIVE:
    'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  AVAILABLE:
    'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  DONE: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  OKAY: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  APPROVED:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  IN_DELIVERY:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  IN_TRANSIT:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  OUT_FOR_DELIVERY:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  PENDING:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  PARTIAL:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  LOW: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  NEED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  NEED_TO_DELIVER:
    'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  UNPAID: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  OUT_OF_STOCK:
    'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  INACTIVE: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  UNKNOWN: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

const SIZE_STYLES: Record<StatusPillSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

const StatusPill = ({
  status,
  label,
  size = 'sm',
  className = '',
}: StatusPillProps) => {
  const key = (status || 'UNKNOWN').toUpperCase();
  const styles = STATUS_STYLES[key] || STATUS_STYLES.UNKNOWN;
  const text = label || key.replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${SIZE_STYLES[size]} ${styles} ${className}`}
    >
      {text}
    </span>
  );
};

export default StatusPill;
