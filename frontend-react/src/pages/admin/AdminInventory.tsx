import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  EXPORT_URLS,
  getEggPrices,
  getInventory,
  getInventoryHistory,
  getStockLogs,
  getTomorrowForecast,
  setEggPrice,
} from '../../api/api';
import type {
  EggPrice,
  EggSize,
  Forecast,
  InventoryHistoryEntry,
  InventorySummary,
  StockLog,
} from '../../api/api';
import ExportButton from '../../components/ExportButton';
import StatusPill from '../../components/StatusPill';
import toast from 'react-hot-toast';

const SIZE_ORDER: { value: EggSize; shortLabel: string; label: string }[] = [
  { value: 'PEEWEE', shortLabel: 'P', label: 'Peewee' },
  { value: 'SMALL', shortLabel: 'S', label: 'Small' },
  { value: 'MEDIUM', shortLabel: 'M', label: 'Medium' },
  { value: 'LARGE', shortLabel: 'L', label: 'Large' },
  { value: 'XL', shortLabel: 'XL', label: 'Extra Large' },
  { value: 'JUMBO', shortLabel: 'J', label: 'Jumbo' },
];

const LOW_STOCK_TRAY_THRESHOLD = 5;

const EMPTY_STOCK: InventorySummary = {
  available: 0,
  reserved: 0,
  sold: 0,
  spoiled: 0,
  sellable_now: 0,
  trays_available: 0,
  by_size: [],
};

const formatTrays = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
};

const formatCurrency = (value: number | string) => {
  const amount = Number(value) || 0;
  return `₱${amount.toFixed(2)}`;
};

const getErrorMessage = (error: any) => {
  const data = error?.response?.data;
  if (data && typeof data === 'object') {
    return Object.values(data).flat().join(', ');
  }
  return error?.message || 'Something went wrong';
};

const AdminInventory = () => {
  const [stock, setStock] = useState<InventorySummary>(EMPTY_STOCK);
  const [history, setHistory] = useState<InventoryHistoryEntry[]>([]);
  const [logs, setLogs] = useState<StockLog[]>([]);
  const [prices, setPrices] = useState<EggPrice[]>([]);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [priceModalSize, setPriceModalSize] = useState<EggSize | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);

  useEffect(() => {
    let active = true;

    const loadAll = async () => {
      const results = await Promise.allSettled([
        getInventory(),
        getInventoryHistory(),
        getStockLogs(),
        getEggPrices(),
        getTomorrowForecast(),
      ]);

      if (!active) return;

      const [stockResult, historyResult, logsResult, pricesResult, forecastResult] =
        results;

      if (stockResult.status === 'fulfilled') {
        setStock(stockResult.value.data);
      }
      if (historyResult.status === 'fulfilled') {
        setHistory([...historyResult.value.data].reverse());
      }
      if (logsResult.status === 'fulfilled') {
        setLogs(logsResult.value.data);
      }
      if (pricesResult.status === 'fulfilled') {
        setPrices(pricesResult.value.data);
      }
      if (forecastResult.status === 'fulfilled') {
        setForecast(forecastResult.value.data);
      } else {
        setForecast(null);
      }

      if (results.some((result) => result.status === 'rejected')) {
        toast.error('Some inventory data could not be loaded');
      }

      setLoading(false);
    };

    loadAll();
    return () => {
      active = false;
    };
  }, []);

  const sizeRows = useMemo(
    () =>
      SIZE_ORDER.map((size) => {
        const rows = stock.by_size.filter(
          (row) => row.egg_size === size.value
        );
        const availableEggs = rows.reduce(
          (sum, row) => sum + Number(row.available_eggs || 0),
          0
        );
        const reservedEggs = rows.reduce(
          (sum, row) => sum + Number(row.reserved_eggs || 0),
          0
        );
        const soldEggs = rows.reduce(
          (sum, row) => sum + Number(row.sold_eggs || 0),
          0
        );
        const availableTrays = availableEggs / 30;
        const price = prices.find((item) => item.size === size.value);
        const status =
          availableTrays < 1
            ? 'NEED'
            : availableTrays < LOW_STOCK_TRAY_THRESHOLD
              ? 'LOW'
              : 'OKAY';

        return {
          ...size,
          availableEggs,
          availableTrays,
          reservedEggs,
          soldEggs,
          price,
          status,
        };
      }),
    [stock.by_size, prices]
  );

  const openPriceModal = (size: EggSize) => {
    const price = prices.find((item) => item.size === size);
    setPriceModalSize(size);
    setPriceInput(price ? String(price.price_per_egg) : '');
  };

  const handleSavePrice = async () => {
    if (!priceModalSize) return;

    const amount = Number(priceInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid price greater than zero');
      return;
    }

    setSavingPrice(true);
    try {
      await setEggPrice({
        egg_size: priceModalSize,
        price_per_egg: amount,
      });
      toast.success('Egg price updated');
      setPriceModalSize(null);
      const res = await getEggPrices();
      setPrices(res.data);
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingPrice(false);
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-gray-500 dark:text-gray-400">
        Loading...
      </div>
    );
  }

  const priceModalLabel = SIZE_ORDER.find(
    (size) => size.value === priceModalSize
  )?.label;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white lg:text-3xl">
          Inventory Tracking
        </h1>
        <div className="flex flex-wrap gap-2">
          <ExportButton
            url={EXPORT_URLS.inventory}
            filename="inventory-report.csv"
            label="Report"
          />
          <ExportButton
            url={EXPORT_URLS.stockLogs}
            filename="stock_logs.csv"
            label="Logs"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-lg border-l-4 border-green-500 bg-white p-6 shadow dark:bg-gray-800">
          <h3 className="text-xs text-gray-500 dark:text-gray-400 lg:text-sm">
            Available Eggs
          </h3>
          <p className="text-2xl font-bold text-green-600 lg:text-3xl">
            {stock.available}
          </p>
          <p className="mt-1 text-xs text-gray-400">Ready to sell</p>
        </div>
        <div className="rounded-lg border-l-4 border-yellow-500 bg-white p-6 shadow dark:bg-gray-800">
          <h3 className="text-xs text-gray-500 dark:text-gray-400 lg:text-sm">
            Reserved
          </h3>
          <p className="text-2xl font-bold text-yellow-600 lg:text-3xl">
            {stock.reserved}
          </p>
          <p className="mt-1 text-xs text-gray-400">For approved orders</p>
        </div>
        <div className="rounded-lg border-l-4 border-blue-500 bg-white p-6 shadow dark:bg-gray-800">
          <h3 className="text-xs text-gray-500 dark:text-gray-400 lg:text-sm">
            Sold
          </h3>
          <p className="text-2xl font-bold text-blue-600 lg:text-3xl">
            {stock.sold}
          </p>
          <p className="mt-1 text-xs text-gray-400">Delivered to buyers</p>
        </div>
        <div className="rounded-lg border-l-4 border-purple-500 bg-white p-6 shadow dark:bg-gray-800">
          <h3 className="text-xs text-gray-500 dark:text-gray-400 lg:text-sm">
            Sellable Now
          </h3>
          <p className="text-2xl font-bold text-purple-600 lg:text-3xl">
            {stock.sellable_now}
          </p>
          <p className="mt-1 text-xs text-gray-400">Available for new orders</p>
        </div>
        <div className="rounded-lg border-l-4 border-teal-500 bg-white p-6 shadow dark:bg-gray-800">
          <h3 className="text-xs text-gray-500 dark:text-gray-400 lg:text-sm">
            Trays Available
          </h3>
          <p className="text-2xl font-bold text-teal-600 lg:text-3xl">
            {formatTrays(stock.trays_available)}
          </p>
          <p className="mt-1 text-xs text-gray-400">30 eggs per tray</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 lg:p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            AI Forecast
          </h2>
          {forecast ? (
            <div className="mt-3 space-y-2">
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {forecast.forecasted_eggs}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                forecasted eggs
              </p>
              <div className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-700/60">
                <p className="text-gray-600 dark:text-gray-300">
                  Trays: {formatTrays(forecast.forecasted_eggs / 30)}
                </p>
                <p className="text-gray-600 dark:text-gray-300">
                  Confidence: {(Number(forecast.confidence_score) * 100).toFixed(1)}%
                </p>
                <p className="text-gray-600 dark:text-gray-300">
                  For: {forecast.forecasted_date}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              No forecast available
            </p>
          )}
        </div>

        <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 lg:col-span-2 lg:p-6">
          <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">
            Inventory Trend (Last 30 days)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  borderColor: '#374151',
                  color: '#f3f4f6',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="available"
                stroke="#22c55e"
                name="Available"
              />
              <Line
                type="monotone"
                dataKey="reserved"
                stroke="#eab308"
                name="Reserved"
              />
              <Line
                type="monotone"
                dataKey="sold"
                stroke="#3b82f6"
                name="Sold"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 lg:p-6">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Stock by Egg Size
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Available trays and current price per size.
            </p>
          </div>
          <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Total trays available: {formatTrays(stock.trays_available)}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                  Size
                </th>
                <th className="px-3 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                  Available Eggs
                </th>
                <th className="px-3 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                  Available Trays
                </th>
                <th className="px-3 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                  Reserved
                </th>
                <th className="px-3 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                  Sold
                </th>
                <th className="px-3 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                  Price / Egg
                </th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                  Status
                </th>
                <th className="px-3 py-3 text-center font-semibold text-gray-600 dark:text-gray-300">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {sizeRows.map((row) => (
                <tr
                  key={row.value}
                  className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
                >
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-xs font-bold text-green-700 dark:bg-green-900/40 dark:text-green-300">
                        {row.shortLabel}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {row.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                    {row.availableEggs}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-gray-900 dark:text-white">
                    {formatTrays(row.availableTrays)}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                    {row.reservedEggs}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                    {row.soldEggs}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {row.price ? (
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(row.price.price_per_egg)}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                          {row.price.price_source === 'DB'
                            ? 'Admin price'
                            : 'Fallback price'}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Not set</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill
                      status={row.status}
                      label={
                        row.status === 'OKAY'
                          ? 'Okay'
                          : row.status === 'LOW'
                            ? 'Low stock'
                            : 'Need'
                      }
                    />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => openPriceModal(row.value)}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
                    >
                      Set Price
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 lg:p-6">
        <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">
          Recent Stock Activity
        </h2>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No stock activity yet
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 lg:px-4">
                    Action
                  </th>
                  <th className="px-3 py-3 text-right font-semibold text-gray-600 dark:text-gray-300 lg:px-4">
                    Quantity
                  </th>
                  <th className="hidden px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 lg:table-cell lg:px-4">
                    Reference
                  </th>
                  <th className="hidden px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 lg:table-cell lg:px-4">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-t border-gray-100 dark:border-gray-700"
                  >
                    <td className="px-3 py-3 lg:px-4">
                      <span
                        className={`rounded px-2 py-1 text-xs ${
                          log.action === 'PRODUCTION'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                            : log.action === 'ORDER_RESERVED'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
                              : log.action === 'DELIVERED'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                                : log.action === 'ORDER_CANCELLED'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {log.action.replace('_', ' ')}
                      </span>
                    </td>
                    <td
                      className={`px-3 py-3 text-right font-medium lg:px-4 ${
                        log.quantity > 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {log.quantity > 0 ? '+' : ''}
                      {log.quantity}
                    </td>
                    <td className="hidden px-3 py-3 text-gray-600 dark:text-gray-300 lg:table-cell lg:px-4">
                      {log.reference || '-'}
                    </td>
                    <td className="hidden px-3 py-3 text-xs text-gray-500 dark:text-gray-400 lg:table-cell lg:px-4">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {priceModalSize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Set Egg Price
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {priceModalLabel} · price per egg
            </p>

            <label className="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Price per Egg
            </label>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={priceInput}
              onChange={(event) => setPriceInput(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="0.00"
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              This price is used for both good and dirty eggs of this size.
            </p>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={handleSavePrice}
                disabled={savingPrice}
                className="flex-1 rounded-lg bg-green-600 py-2 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingPrice ? 'Saving...' : 'Save Price'}
              </button>
              <button
                type="button"
                onClick={() => setPriceModalSize(null)}
                className="rounded-lg bg-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-400 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminInventory;
