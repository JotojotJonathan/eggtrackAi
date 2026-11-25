import { useEffect, useMemo, useState } from 'react';
import { getInventory, getProductions } from '../../api/api';
import type { EggSize, Production } from '../../api/api';
import ExportButton from '../../components/ExportButton';
import StatusPill from '../../components/StatusPill';
import { EXPORT_URLS } from '../../api/api';
import toast from 'react-hot-toast';

const SIZE_ORDER: { value: EggSize; shortLabel: string; label: string }[] = [
  { value: 'PEEWEE', shortLabel: 'P', label: 'Peewee' },
  { value: 'SMALL', shortLabel: 'S', label: 'Small' },
  { value: 'MEDIUM', shortLabel: 'M', label: 'Medium' },
  { value: 'LARGE', shortLabel: 'L', label: 'Large' },
  { value: 'XL', shortLabel: 'XL', label: 'Extra Large' },
  { value: 'JUMBO', shortLabel: 'J', label: 'Jumbo' },
];

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const formatTrays = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
};

const AdminProduction = () => {
  const [records, setRecords] = useState<Production[]>([]);
  const [inventoryTrays, setInventoryTrays] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      const [productionResult, inventoryResult] = await Promise.allSettled([
        getProductions(),
        getInventory(),
      ]);

      if (!active) return;

      if (productionResult.status === 'fulfilled') {
        setRecords(productionResult.value.data);
      } else {
        toast.error('Failed to load production records');
      }

      if (inventoryResult.status === 'fulfilled') {
        setInventoryTrays(
          Number(inventoryResult.value.data.trays_available) || 0
        );
      }

      setLoading(false);
    };

    loadData();
    return () => {
      active = false;
    };
  }, []);

  const years = useMemo(
    () =>
      Array.from(
        new Set(
          records
            .map((record) => record.date?.slice(0, 4))
            .filter((year): year is string => Boolean(year))
        )
      ).sort((a, b) => b.localeCompare(a)),
    [records]
  );

  const filteredRecords = useMemo(
    () =>
      records.filter((record) => {
        const date = record.date || '';
        if (filterDate && date !== filterDate) return false;
        if (filterYear && !date.startsWith(filterYear)) return false;
        if (filterMonth && date.slice(5, 7) !== filterMonth.padStart(2, '0')) {
          return false;
        }
        return true;
      }),
    [records, filterDate, filterYear, filterMonth]
  );

  const summary = useMemo(() => {
    const totalEggs = filteredRecords.reduce(
      (sum, record) => sum + Number(record.total_eggs || 0),
      0
    );
    return {
      totalEggs,
      trays: Math.floor(totalEggs / 30),
      pieces: totalEggs % 30,
    };
  }, [filteredRecords]);

  const getSizeBreakdown = (record: Production) => {
    const counts: Partial<Record<EggSize, number>> = {};
    (record.size_counts || []).forEach((row) => {
      counts[row.egg_size] =
        (counts[row.egg_size] || 0) + Number(row.count || 0);
    });

    return SIZE_ORDER.map((size) => ({
      ...size,
      count: counts[size.value] || 0,
    })).filter((size) => size.count > 0);
  };

  const clearFilters = () => {
    setFilterYear('');
    setFilterMonth('');
    setFilterDate('');
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white lg:text-3xl">
          All Production Records
        </h1>
        <ExportButton url={EXPORT_URLS.production} filename="production.csv" />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg bg-white p-4 shadow dark:bg-gray-800 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Year
          </label>
          <select
            value={filterYear}
            onChange={(event) => setFilterYear(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="">All Years</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Month
          </label>
          <select
            value={filterMonth}
            onChange={(event) => setFilterMonth(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="">All Months</option>
            {MONTHS.map((month, index) => (
              <option key={month} value={String(index + 1)}>
                {month}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Date
          </label>
          <input
            type="date"
            value={filterDate}
            onChange={(event) => setFilterDate(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={clearFilters}
            className="w-full rounded-lg bg-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
          Loading records...
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow dark:bg-gray-800 dark:text-gray-400">
          No production records yet
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow dark:bg-gray-800">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 lg:px-4">
                  Date
                </th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 lg:px-4">
                  Batch Name
                </th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 lg:px-4">
                  Egg Size
                </th>
                <th className="px-3 py-3 text-right font-semibold text-gray-600 dark:text-gray-300 lg:px-4">
                  Broken
                </th>
                <th className="px-3 py-3 text-right font-semibold text-gray-600 dark:text-gray-300 lg:px-4">
                  Total
                </th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 lg:px-4">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    No production records match your filters
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const breakdown = getSizeBreakdown(record);
                  const isDone = Number(record.total_eggs) > 0;

                  return (
                    <tr
                      key={record.id}
                      className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
                    >
                      <td className="whitespace-nowrap px-3 py-3 text-gray-700 dark:text-gray-300 lg:px-4">
                        {record.date}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-600 dark:text-gray-400 lg:px-4">
                        {record.batch_name || 'Main'}
                      </td>
                      <td className="px-3 py-3 lg:px-4">
                        {breakdown.length === 0 ? (
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            No size breakdown
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {breakdown.map((size) => (
                              <span
                                key={size.value}
                                title={`${size.label}: ${size.count} eggs`}
                                className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                              >
                                {size.shortLabel}: {size.count}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right text-red-600 dark:text-red-400 lg:px-4">
                        {record.broken_eggs}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-gray-900 dark:text-white lg:px-4">
                        {record.total_eggs}
                      </td>
                      <td className="px-3 py-3 lg:px-4">
                        <StatusPill
                          status={isDone ? 'DONE' : 'NEED'}
                          label={isDone ? 'Done' : 'Need'}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 lg:px-4"
                >
                  Total Trays &amp; Pieces
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-gray-900 dark:text-white lg:px-4">
                  {summary.trays} trays + {summary.pieces} pcs
                </td>
              </tr>
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 lg:px-4"
                >
                  Total Trays Available
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-green-700 dark:text-green-400 lg:px-4">
                  {formatTrays(inventoryTrays)} trays
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminProduction;
