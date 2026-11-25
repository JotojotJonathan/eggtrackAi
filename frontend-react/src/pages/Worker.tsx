import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  createProduction,
  deleteProduction,
  getProductions,
  getTomorrowForecast,
  updateProduction,
} from '../api/api';
import type {
  EggGrade,
  EggSize,
  Forecast,
  Production,
  ProductionInput,
} from '../api/api';
import TrayQuantityInput from '../components/TrayQuantityInput';
import {
  EMPTY_TRAY_QUANTITY,
  eggsToTrayQuantity,
  trayQuantityToEggs,
} from '../components/trayQuantity';
import type { TrayQuantityValue } from '../components/trayQuantity';
import toast from 'react-hot-toast';

const SIZES: { value: EggSize; label: string; shortLabel: string }[] = [
  { value: 'PEEWEE', label: 'Peewee', shortLabel: 'P' },
  { value: 'SMALL', label: 'Small', shortLabel: 'S' },
  { value: 'MEDIUM', label: 'Medium', shortLabel: 'M' },
  { value: 'LARGE', label: 'Large', shortLabel: 'L' },
  { value: 'XL', label: 'Extra Large', shortLabel: 'XL' },
  { value: 'JUMBO', label: 'Jumbo', shortLabel: 'J' },
];

const GRADES: {
  value: EggGrade;
  label: string;
  accent: string;
  dot: string;
}[] = [
  {
    value: 'GOOD',
    label: 'Good',
    accent: 'text-green-700 dark:text-green-400',
    dot: 'bg-green-500',
  },
  {
    value: 'DIRTY',
    label: 'Dirty',
    accent: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  {
    value: 'BROKEN',
    label: 'Broken',
    accent: 'text-red-700 dark:text-red-400',
    dot: 'bg-red-500',
  },
];

type CountMap = Record<string, TrayQuantityValue>;

const countKey = (size: EggSize, grade: EggGrade) => `${size}:${grade}`;

const getTodayISO = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const emptyForm = () => ({
  date: getTodayISO(),
  batch_name: 'Main Batch',
  man_hours: '',
  notes: '',
});

const formatTrays = (eggs: number) => {
  const trays = eggs / 30;
  return Number.isInteger(trays) ? String(trays) : trays.toFixed(2);
};

const getErrorMessage = (error: any) => {
  const data = error?.response?.data;
  if (data && typeof data === 'object') {
    return Object.values(data).flat().join(', ');
  }
  return error?.message || 'Something went wrong';
};

const Worker = () => {
  const [formData, setFormData] = useState(emptyForm);
  const [counts, setCounts] = useState<CountMap>({});
  const [history, setHistory] = useState<Production[]>([]);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingLegacy, setEditingLegacy] = useState(false);

  const loadHistory = async () => {
    try {
      const res = await getProductions();
      setHistory(res.data.slice(0, 30));
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadForecast = async () => {
    try {
      const res = await getTomorrowForecast();
      setForecast(res.data);
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error('Error loading forecast:', error);
      }
      setForecast(null);
    }
  };

  useEffect(() => {
    let active = true;

    const loadInitialData = async () => {
      try {
        const res = await getProductions();
        if (active) setHistory(res.data.slice(0, 30));
      } catch (error) {
        console.error('Error loading history:', error);
      } finally {
        if (active) setHistoryLoading(false);
      }

      try {
        const res = await getTomorrowForecast();
        if (active) setForecast(res.data);
      } catch (error: any) {
        if (error.response?.status !== 404) {
          console.error('Error loading forecast:', error);
        }
        if (active) setForecast(null);
      }
    };

    loadInitialData();
    return () => {
      active = false;
    };
  }, []);

  const totals = useMemo(() => {
    let total = 0;
    let good = 0;
    let dirty = 0;
    let broken = 0;

    SIZES.forEach((size) => {
      GRADES.forEach((grade) => {
        const eggs = trayQuantityToEggs(
          counts[countKey(size.value, grade.value)] || EMPTY_TRAY_QUANTITY
        );
        total += eggs;
        if (grade.value === 'GOOD') good += eggs;
        if (grade.value === 'DIRTY') dirty += eggs;
        if (grade.value === 'BROKEN') broken += eggs;
      });
    });

    return { total, good, dirty, broken, trays: total / 30 };
  }, [counts]);

  const updateCount = (
    size: EggSize,
    grade: EggGrade,
    value: TrayQuantityValue
  ) => {
    setCounts((prev) => ({ ...prev, [countKey(size, grade)]: value }));
  };

  const rowTotals = useMemo(() => {
    const result: Record<string, number> = {};
    SIZES.forEach((size) => {
      result[size.value] = GRADES.reduce(
        (sum, grade) =>
          sum +
          trayQuantityToEggs(
            counts[countKey(size.value, grade.value)] || EMPTY_TRAY_QUANTITY
          ),
        0
      );
    });
    return result;
  }, [counts]);

  const resetForm = () => {
    setFormData(emptyForm());
    setCounts({});
    setEditingId(null);
    setEditingLegacy(false);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!formData.date) {
      toast.error('Please select a date');
      return;
    }

    if (totals.total <= 0) {
      toast.error('Enter at least one egg count');
      return;
    }

    const size_counts: ProductionInput['size_counts'] = [];
    SIZES.forEach((size) => {
      GRADES.forEach((grade) => {
        const count = trayQuantityToEggs(
          counts[countKey(size.value, grade.value)] || EMPTY_TRAY_QUANTITY
        );
        if (count > 0) {
          size_counts.push({
            egg_size: size.value,
            grade: grade.value,
            count,
          });
        }
      });
    });

    const payload: ProductionInput = {
      date: formData.date,
      batch_name: formData.batch_name.trim() || 'Main Batch',
      man_hours: formData.man_hours === '' ? 0 : formData.man_hours,
      notes: formData.notes.trim(),
      size_counts,
    };

    setLoading(true);
    try {
      if (editingId) {
        await updateProduction(editingId, payload);
        toast.success('Production updated');
      } else {
        await createProduction(payload);
        toast.success('Production recorded');
      }

      resetForm();
      await Promise.all([loadHistory(), loadForecast()]);
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record: Production) => {
    setEditingId(record.id);
    setFormData({
      date: record.date,
      batch_name: record.batch_name || 'Main Batch',
      man_hours: record.man_hours ?? '',
      notes: record.notes || '',
    });

    const nextCounts: CountMap = {};
    let hasSizeCounts = false;

    (record.size_counts || []).forEach((row) => {
      const count = Number(row.count) || 0;
      if (count > 0) {
        nextCounts[countKey(row.egg_size, row.grade)] =
          eggsToTrayQuantity(count);
        hasSizeCounts = true;
      }
    });

    setCounts(nextCounts);
    setEditingLegacy(!hasSizeCounts && Number(record.total_eggs) > 0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this production record?')) return;

    try {
      await deleteProduction(id);
      toast.success('Record deleted');
      if (editingId === id) resetForm();
      await loadHistory();
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white';

  return (
    <div className="grid grid-cols-1 gap-4 lg:gap-6 xl:grid-cols-3">
      <div className="rounded-xl bg-white p-4 shadow dark:bg-gray-800 lg:p-6 xl:col-span-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white lg:text-2xl">
              {editingId ? 'Edit Production Record' : "Record Today's Production"}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Enter counts per size and grade. Totals are calculated automatically.
            </p>
          </div>
          {totals.total > 0 && (
            <div className="rounded-lg bg-green-50 px-3 py-2 text-right dark:bg-green-900/30">
              <p className="text-lg font-bold text-green-700 dark:text-green-300">
                {totals.total}
              </p>
              <p className="text-[11px] text-green-700 dark:text-green-400">
                eggs · {formatTrays(totals.total)} trays
              </p>
            </div>
          )}
        </div>

        {editingId && (
          <div className="mt-4 rounded-lg border-l-4 border-yellow-500 bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
            Editing record #{editingId}. Click Cancel to stop editing.
          </div>
        )}

        {editingLegacy && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
            This record has no per-size breakdown. Enter size counts below to
            replace the old totals when you save.
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Date *
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Hen House / Batch
              </label>
              <input
                type="text"
                name="batch_name"
                value={formData.batch_name}
                onChange={handleChange}
                placeholder="e.g., Hen House A"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Man-hours
              </label>
              <input
                type="number"
                name="man_hours"
                value={formData.man_hours}
                onChange={handleChange}
                min={0}
                step={0.25}
                placeholder="0"
                className={inputClass}
              />
            </div>
          </div>

          <div className="mt-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Egg counts by size and grade
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Enter whole trays and loose pieces. 30 eggs per tray.
                </p>
              </div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Total: {totals.total} eggs · {formatTrays(totals.total)} trays
              </p>
            </div>

            <div className="mt-3 space-y-3">
              {SIZES.map((size) => (
                <div
                  key={size.value}
                  className="rounded-xl border border-gray-200 p-3 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-100 text-xs font-bold text-green-700 dark:bg-green-900/40 dark:text-green-300">
                        {size.shortLabel}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {size.label}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          Size {size.shortLabel}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                      {rowTotals[size.value] || 0} eggs ·{' '}
                      {formatTrays(rowTotals[size.value] || 0)} trays
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {GRADES.map((grade) => (
                      <div key={grade.value}>
                        <label
                          className={`mb-1 flex items-center gap-1.5 text-xs font-semibold ${grade.accent}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${grade.dot}`}
                          />
                          {grade.label}
                        </label>
                        <TrayQuantityInput
                          compact
                          value={
                            counts[countKey(size.value, grade.value)] ||
                            EMPTY_TRAY_QUANTITY
                          }
                          onChange={(value) =>
                            updateCount(size.value, grade.value, value)
                          }
                          ariaLabel={`${size.label} ${grade.label}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/60">
              <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Total eggs
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {totals.total}
              </p>
            </div>
            <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/30">
              <p className="text-[11px] uppercase tracking-wide text-green-700 dark:text-green-400">
                Good
              </p>
              <p className="text-xl font-bold text-green-700 dark:text-green-300">
                {totals.good}
              </p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/30">
              <p className="text-[11px] uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Dirty
              </p>
              <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
                {totals.dirty}
              </p>
            </div>
            <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/30">
              <p className="text-[11px] uppercase tracking-wide text-red-700 dark:text-red-400">
                Broken
              </p>
              <p className="text-xl font-bold text-red-700 dark:text-red-300">
                {totals.broken}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Notes (optional)
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              className={inputClass}
              placeholder="Any observations for this batch?"
            />
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-green-600 px-4 py-3 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? 'Saving...'
                : editingId
                  ? 'Update Record'
                  : 'Save Production'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg bg-gray-200 px-6 py-3 font-medium text-gray-700 transition hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="space-y-4 lg:space-y-6">
        <div className="rounded-xl bg-white p-4 shadow dark:bg-gray-800 lg:p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Tomorrow&apos;s Forecast
          </h3>
          {forecast ? (
            <div className="mt-3">
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {forecast.forecasted_eggs}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">eggs</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Confidence: {(forecast.confidence_score * 100).toFixed(1)}%
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              No forecast available
            </p>
          )}
        </div>

        <div className="rounded-xl bg-white p-4 shadow dark:bg-gray-800 lg:p-6">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Recent History
            </h3>
            {historyLoading && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Loading...
              </span>
            )}
          </div>

          <div className="mt-3 max-h-96 overflow-auto">
            {history.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No records yet
              </p>
            ) : (
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/60">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
                      Date
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
                      Batch
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">
                      Total
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">
                      Good
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">
                      Dirty
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">
                      Broken
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record) => (
                    <tr
                      key={record.id}
                      className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40"
                    >
                      <td className="whitespace-nowrap px-2 py-2 text-gray-700 dark:text-gray-300">
                        {record.date}
                      </td>
                      <td className="px-2 py-2 text-xs text-gray-600 dark:text-gray-400">
                        {record.batch_name || 'Main'}
                      </td>
                      <td className="px-2 py-2 text-right font-medium text-gray-900 dark:text-white">
                        {record.total_eggs}
                      </td>
                      <td className="px-2 py-2 text-right text-green-700 dark:text-green-400">
                        {record.good_eggs}
                      </td>
                      <td className="px-2 py-2 text-right text-amber-700 dark:text-amber-400">
                        {record.dirty_eggs}
                      </td>
                      <td className="px-2 py-2 text-right text-red-700 dark:text-red-400">
                        {record.broken_eggs}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(record)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(record.id)}
                            className="text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Worker;
