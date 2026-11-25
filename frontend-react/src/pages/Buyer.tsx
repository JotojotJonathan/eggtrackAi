import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  createOrder,
  getEggPrices,
  getInventory,
  getMyBuyerProfile,
  getOrders,
} from '../api/api';
import type {
  BuyerProfile,
  EggPrice,
  EggSize,
  EggType,
  InventorySummary,
  Order,
  OrderInput,
} from '../api/api';
import SizeStockGrid from '../components/SizeStockGrid';
import type { SizeStockOption } from '../components/SizeStockGrid';
import StatusPill from '../components/StatusPill';
import TrayQuantityInput from '../components/TrayQuantityInput';
import type { TrayQuantityValue } from '../components/trayQuantity';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const SIZES: { value: EggSize; label: string; shortLabel: string }[] = [
  { value: 'PEEWEE', label: 'Peewee', shortLabel: 'P' },
  { value: 'SMALL', label: 'Small', shortLabel: 'S' },
  { value: 'MEDIUM', label: 'Medium', shortLabel: 'M' },
  { value: 'LARGE', label: 'Large', shortLabel: 'L' },
  { value: 'XL', label: 'Extra Large', shortLabel: 'XL' },
  { value: 'JUMBO', label: 'Jumbo', shortLabel: 'J' },
];

const EGG_TYPES: { value: EggType; label: string }[] = [
  { value: 'GOOD', label: 'Good eggs' },
  { value: 'DIRTY', label: 'Dirty eggs' },
];

interface OrderFormState {
  egg_size: EggSize;
  egg_type: EggType;
  is_tray: boolean;
  delivery_date: string;
  quantity: string;
  notes: string;
}

const getTodayISO = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const getErrorMessage = (error: any) => {
  const data = error?.response?.data;
  if (data && typeof data === 'object') {
    return Object.values(data).flat().join(', ');
  }
  return error?.message || 'Something went wrong';
};

const formatCurrency = (value: number | string) => {
  const amount = Number(value) || 0;
  return `₱${amount.toFixed(2)}`;
};

const formatTrays = (eggs: number) => {
  const trays = eggs / 30;
  return Number.isInteger(trays) ? String(trays) : trays.toFixed(2);
};

const emptyStock = (): Record<EggSize, { GOOD: number; DIRTY: number }> =>
  SIZES.reduce(
    (acc, size) => {
      acc[size.value] = { GOOD: 0, DIRTY: 0 };
      return acc;
    },
    {} as Record<EggSize, { GOOD: number; DIRTY: number }>
  );

const Buyer = () => {
  const [buyerProfile, setBuyerProfile] = useState<BuyerProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [prices, setPrices] = useState<EggPrice[]>([]);
  const [inventory, setInventory] = useState<InventorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [formData, setFormData] = useState<OrderFormState>({
    egg_size: 'MEDIUM',
    egg_type: 'GOOD',
    is_tray: false,
    delivery_date: '',
    quantity: '',
    notes: '',
  });

  useEffect(() => {
    let active = true;

    const loadAll = async () => {
      setLoading(true);

      try {
        const profileRes = await getMyBuyerProfile();
        if (active) setBuyerProfile(profileRes.data);
      } catch (error: any) {
        if (error.response?.status === 404) {
          toast.error('Buyer profile not found. Please register first.');
        } else {
          console.error('Error loading buyer profile:', error);
        }
      }

      try {
        const [ordersRes, pricesRes, inventoryRes] = await Promise.all([
          getOrders(),
          getEggPrices(),
          getInventory(),
        ]);
        if (active) {
          setOrders(ordersRes.data);
          setPrices(pricesRes.data);
          setInventory(inventoryRes.data);
        }
      } catch (error) {
        console.error('Error loading order data:', error);
        toast.error('Could not load stock or prices. Please refresh.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadAll();
    return () => {
      active = false;
    };
  }, []);

  const loadOrders = async () => {
    try {
      const res = await getOrders();
      setOrders(res.data);
    } catch (error) {
      console.error('Error reloading orders:', error);
    }
  };

  const loadInventory = async () => {
    try {
      const res = await getInventory();
      setInventory(res.data);
    } catch (error) {
      console.error('Error reloading inventory:', error);
    }
  };

  const stockBySize = useMemo(() => {
    const stock = emptyStock();
    inventory?.by_size.forEach((row) => {
      if (row.grade === 'GOOD' || row.grade === 'DIRTY') {
        stock[row.egg_size][row.grade] += Number(row.available_eggs) || 0;
      }
    });
    return stock;
  }, [inventory]);

  const selectedPrice = prices.find((price) => price.size === formData.egg_size);
  const unitPrice = selectedPrice
    ? formData.is_tray
      ? formData.egg_type === 'GOOD'
        ? selectedPrice.good_tray
        : selectedPrice.dirty_tray
      : formData.egg_type === 'GOOD'
        ? selectedPrice.good_mid
        : selectedPrice.dirty_mid
    : 0;

  const selectedStock = stockBySize[formData.egg_size][formData.egg_type];
  const availableUnits = formData.is_tray
    ? Math.floor(selectedStock / 30)
    : selectedStock;
  const selectedUnavailable = availableUnits < 1;
  const quantityNumber = parseInt(formData.quantity, 10) || 0;
  const quantityExceedsStock = quantityNumber > availableUnits;
  const totalAmount = quantityNumber * unitPrice;

  const sizeOptions: SizeStockOption[] = SIZES.map((size) => {
    const availableEggs = stockBySize[size.value][formData.egg_type];
    return {
      ...size,
      availableEggs,
      availableTrays: Math.floor(availableEggs / 30),
    };
  });

  const myOrders = buyerProfile
    ? orders.filter((order) => order.buyer === buyerProfile.id)
    : orders;

  const handleSizeChange = (size: EggSize) => {
    setFormData((prev) => ({ ...prev, egg_size: size, quantity: '' }));
  };

  const handleEggTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      egg_type: event.target.value as EggType,
      quantity: '',
    }));
  };

  const handleUnitChange = (isTray: boolean) => {
    setFormData((prev) => ({ ...prev, is_tray: isTray, quantity: '' }));
  };

  const handleQuantityChange = (value: TrayQuantityValue) => {
    setFormData((prev) => ({
      ...prev,
      quantity: prev.is_tray ? value.trays : value.pieces,
    }));
  };

  const handleDeliveryDateChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      delivery_date: event.target.value,
    }));
  };

  const handleNotesChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, notes: event.target.value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!buyerProfile) {
      toast.error('Please complete registration first');
      return;
    }

    if (!selectedPrice) {
      toast.error('Price is not available for this size yet');
      return;
    }

    if (selectedUnavailable) {
      toast.error(
        formData.is_tray
          ? 'Not enough stock for a full tray'
          : 'Selected size is out of stock'
      );
      return;
    }

    if (quantityNumber < 1) {
      toast.error('Enter a quantity');
      return;
    }

    if (quantityExceedsStock) {
      toast.error(
        `Only ${availableUnits} ${formData.is_tray ? 'trays' : 'eggs'} available`
      );
      return;
    }

    if (!formData.delivery_date) {
      toast.error('Please select a delivery date');
      return;
    }

    const payload: OrderInput = {
      buyer: buyerProfile.id,
      egg_size: formData.egg_size,
      egg_type: formData.egg_type,
      is_tray: formData.is_tray,
      delivery_date: formData.delivery_date,
      quantity: quantityNumber,
      notes: formData.notes.trim(),
    };

    setSubmitting(true);
    try {
      await createOrder(payload);
      toast.success('Order placed successfully');
      setFormData((prev) => ({
        ...prev,
        delivery_date: '',
        quantity: '',
        notes: '',
      }));
      await Promise.all([loadOrders(), loadInventory()]);
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const downloadInvoice = (order: Order) => {
    const doc = new jsPDF();

    doc.setFillColor(21, 128, 61);
    doc.rect(0, 0, 210, 30, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('EggTrack AI', 105, 15, { align: 'center' });

    doc.setFontSize(10);
    doc.text('Fresh Eggs Delivery Service', 105, 23, {
      align: 'center',
    });

    doc.setTextColor(0, 0, 0);

    doc.setFontSize(18);
    doc.text('INVOICE / RECEIPT', 105, 45, {
      align: 'center',
    });

    doc.setFontSize(10);
    doc.text(
      `Invoice #: ${order.order_number || `INV-${order.id}`}`,
      20,
      55
    );
    doc.text(`Date: ${order.order_date || 'N/A'}`, 20, 62);
    doc.text(`Status: ${order.status || 'N/A'}`, 20, 69);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('BILL TO:', 20, 85);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    doc.text(order.buyer_name || 'N/A', 20, 92);
    doc.text(order.buyer_email || '', 20, 99);
    doc.text(order.buyer_phone || '', 20, 106);

    const buyerAddress = doc.splitTextToSize(
      order.buyer_address || 'N/A',
      80
    );
    doc.text(buyerAddress, 20, 113);

    doc.setFont('helvetica', 'bold');
    doc.text('DELIVERY DATE:', 120, 85);

    doc.setFont('helvetica', 'normal');
    doc.text(order.delivery_date || 'N/A', 120, 92);

    autoTable(doc, {
      startY: 130,
      head: [['Item', 'Size', 'Type', 'Qty', 'Price', 'Total']],
      body: [
        [
          'Fresh Eggs',
          order.egg_size || 'Medium',
          order.egg_type || 'Good',
          `${order.quantity} ${order.is_tray ? 'trays' : 'pcs'}`,
          formatCurrency(order.price_per_egg),
          formatCurrency(order.total_amount),
        ],
      ],
      theme: 'grid',
      headStyles: {
        fillColor: [21, 128, 61],
        textColor: 255,
        fontSize: 10,
      },
      bodyStyles: {
        fontSize: 10,
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');

    doc.text(`TOTAL: ${formatCurrency(order.total_amount)}`, 200, finalY, {
      align: 'right',
    });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    doc.text(
      `Payment: ${order.payment_status || 'UNPAID'} via ${
        order.payment_method || 'COD'
      }`,
      20,
      finalY + 15
    );

    doc.setFontSize(9);
    doc.setTextColor(100);

    doc.text('Thank you for your business!', 105, finalY + 35, {
      align: 'center',
    });

    doc.text(
      'EggTrack AI - Corazon, San Miguel, Bohol',
      105,
      finalY + 42,
      { align: 'center' }
    );

    doc.save(`invoice-${order.order_number || order.id}.pdf`);
    toast.success('Invoice downloaded');
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-gray-500 dark:text-gray-400">
        Loading...
      </div>
    );
  }

  if (!buyerProfile) {
    return (
      <div className="mx-auto max-w-lg py-8 text-center">
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Buyer profile not found.
        </p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Please register first to place orders.
        </p>
      </div>
    );
  }

  const quantityValue: TrayQuantityValue = {
    trays: formData.is_tray ? formData.quantity : '',
    pieces: formData.is_tray ? '' : formData.quantity,
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:gap-6 xl:grid-cols-3">
      <div className="rounded-xl bg-white p-4 shadow dark:bg-gray-800 lg:p-6 xl:col-span-2">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white lg:text-2xl">
          Place an Order
        </h2>

        <div className="mt-4 rounded-lg border-l-4 border-green-500 bg-green-50 p-4 dark:bg-green-900/30">
          <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
            Delivering to:
          </p>
          <p className="font-bold text-gray-800 dark:text-white">
            {buyerProfile.name}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {buyerProfile.email}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {buyerProfile.phone}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {buyerProfile.full_address}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Egg Type *
              </label>
              <select
                name="egg_type"
                value={formData.egg_type}
                onChange={handleEggTypeChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                required
              >
                {EGG_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Order Unit *
              </label>
              <div className="inline-flex w-full rounded-lg border border-gray-300 bg-gray-100 p-1 dark:border-gray-600 dark:bg-gray-700">
                <button
                  type="button"
                  onClick={() => handleUnitChange(false)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    !formData.is_tray
                      ? 'bg-white text-green-700 shadow dark:bg-gray-800 dark:text-green-300'
                      : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  Per piece
                </button>
                <button
                  type="button"
                  onClick={() => handleUnitChange(true)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    formData.is_tray
                      ? 'bg-white text-green-700 shadow dark:bg-gray-800 dark:text-green-300'
                      : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  Per tray (30)
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Egg Size *
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Out-of-stock sizes are disabled.
              </p>
            </div>
            <SizeStockGrid
              options={sizeOptions}
              value={formData.egg_size}
              onChange={handleSizeChange}
              unit={formData.is_tray ? 'tray' : 'piece'}
              className="mt-2"
            />
          </div>

          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-700/50">
            <p className="font-medium text-gray-800 dark:text-white">
              Available stock for {formData.egg_size} · {formData.egg_type}
            </p>
            <p className="mt-1 text-gray-600 dark:text-gray-300">
              {selectedStock} eggs · {formatTrays(selectedStock)} trays
            </p>
            {selectedUnavailable && (
              <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                {selectedStock < 1
                  ? 'This size and type is out of stock.'
                  : 'Not enough stock for a full tray (30 eggs).'}
              </p>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm dark:border-yellow-700 dark:bg-yellow-900/30">
            <p className="font-medium text-yellow-800 dark:text-yellow-200">
              Current price
            </p>
            <p className="text-yellow-700 dark:text-yellow-300">
              <strong>{formData.egg_size}</strong> ·{' '}
              <strong>{formData.egg_type}</strong> ·{' '}
              {selectedPrice
                ? `${formatCurrency(unitPrice)} / ${
                    formData.is_tray ? 'tray' : 'piece'
                  }`
                : 'Price unavailable'}
            </p>
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-blue-600 hover:underline dark:text-blue-400">
              View full price list
            </summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[520px] border text-xs">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className="border p-2 text-left dark:border-gray-600 dark:text-white">
                      Size
                    </th>
                    <th className="border p-2 text-left dark:border-gray-600 dark:text-white">
                      Good (₱/pc)
                    </th>
                    <th className="border p-2 text-left dark:border-gray-600 dark:text-white">
                      Dirty (₱/pc)
                    </th>
                    <th className="border p-2 text-left dark:border-gray-600 dark:text-white">
                      Good Tray
                    </th>
                    <th className="border p-2 text-left dark:border-gray-600 dark:text-white">
                      Dirty Tray
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {prices.map((price) => (
                    <tr
                      key={price.size}
                      className="border-t dark:border-gray-600"
                    >
                      <td className="border p-2 font-medium dark:border-gray-600 dark:text-white">
                        {price.size}
                      </td>
                      <td className="border p-2 dark:border-gray-600 dark:text-gray-300">
                        {formatCurrency(price.good_mid)}
                      </td>
                      <td className="border p-2 dark:border-gray-600 dark:text-gray-300">
                        {formatCurrency(price.dirty_mid)}
                      </td>
                      <td className="border p-2 dark:border-gray-600 dark:text-gray-300">
                        {formatCurrency(price.good_tray)}
                      </td>
                      <td className="border p-2 dark:border-gray-600 dark:text-gray-300">
                        {formatCurrency(price.dirty_tray)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Delivery Date *
              </label>
              <input
                type="date"
                name="delivery_date"
                value={formData.delivery_date}
                onChange={handleDeliveryDateChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                required
                min={getTodayISO()}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Quantity ({formData.is_tray ? 'trays' : 'pieces'}) *
              </label>
              <TrayQuantityInput
                mode={formData.is_tray ? 'trays' : 'pieces'}
                value={quantityValue}
                onChange={handleQuantityChange}
                maxEggs={selectedStock}
                disabled={selectedUnavailable}
                ariaLabel="Order quantity"
              />
              {quantityExceedsStock && (
                <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                  Quantity exceeds available stock.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Price per {formData.is_tray ? 'tray' : 'piece'}
              </label>
              <div className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                {selectedPrice ? formatCurrency(unitPrice) : 'Unavailable'}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Total Amount
              </label>
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-bold text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300">
                {formatCurrency(totalAmount)}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Notes (optional)
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleNotesChange}
              rows={2}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="Any special instructions?"
            />
          </div>

          <button
            type="submit"
            disabled={
              submitting ||
              !selectedPrice ||
              selectedUnavailable ||
              quantityNumber < 1 ||
              quantityExceedsStock ||
              !formData.delivery_date
            }
            className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Placing order...' : 'Place Order'}
          </button>
        </form>
      </div>

      <div className="max-h-[760px] overflow-y-auto rounded-xl bg-white p-4 shadow dark:bg-gray-800 lg:p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          My Orders
        </h3>
        {myOrders.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            No orders yet
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {myOrders.map((order) => (
              <div
                key={order.id}
                className="rounded-lg border border-gray-200 p-3 transition hover:shadow dark:border-gray-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {order.order_number || `#${order.id}`}
                  </span>
                  <StatusPill status={order.status} />
                </div>
                <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {order.quantity} {order.is_tray ? 'trays' : 'pcs'} ·{' '}
                  {order.egg_size} · {order.egg_type}
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatCurrency(order.total_amount)}
                </div>
                <div className="mb-2 text-xs text-gray-400 dark:text-gray-500">
                  Delivery: {order.delivery_date}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(order)}
                    className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadInvoice(order)}
                    className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60"
                  >
                    Invoice
                  </button>
                  <StatusPill status={order.payment_status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {selectedOrder.order_number || `Order #${selectedOrder.id}`}
              </h3>
              <StatusPill status={selectedOrder.status} />
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Egg Size:
                </span>
                <span className="font-medium dark:text-white">
                  {selectedOrder.egg_size}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Egg Type:
                </span>
                <span className="font-medium dark:text-white">
                  {selectedOrder.egg_type}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Quantity:
                </span>
                <span className="dark:text-white">
                  {selectedOrder.quantity}{' '}
                  {selectedOrder.is_tray ? 'trays' : 'eggs'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Total eggs:
                </span>
                <span className="dark:text-white">
                  {selectedOrder.quantity_eggs} eggs ·{' '}
                  {Number(selectedOrder.quantity_trays).toFixed(2)} trays
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Price:</span>
                <span className="dark:text-white">
                  {formatCurrency(selectedOrder.price_per_egg)} /{' '}
                  {selectedOrder.is_tray ? 'tray' : 'egg'}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 font-bold dark:border-gray-700">
                <span className="dark:text-white">Total:</span>
                <span className="text-green-600 dark:text-green-400">
                  {formatCurrency(selectedOrder.total_amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Paid:
                </span>
                <span className="dark:text-white">
                  {formatCurrency(selectedOrder.amount_paid)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Balance:
                </span>
                <span className="dark:text-white">
                  {formatCurrency(selectedOrder.balance)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Payment:
                </span>
                <StatusPill status={selectedOrder.payment_status} />
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Delivery Date:
                </span>
                <span className="dark:text-white">
                  {selectedOrder.delivery_date}
                </span>
              </div>
              {selectedOrder.notes && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    Notes:
                  </span>
                  <p className="mt-1 text-gray-700 dark:text-gray-300">
                    {selectedOrder.notes}
                  </p>
                </div>
              )}
              {selectedOrder.payments && selectedOrder.payments.length > 0 && (
                <div className="border-t border-gray-200 pt-2 dark:border-gray-700">
                  <p className="mb-1 font-medium text-gray-700 dark:text-gray-300">
                    Payments
                  </p>
                  <div className="space-y-1">
                    {selectedOrder.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex justify-between text-xs text-gray-600 dark:text-gray-400"
                      >
                        <span>
                          {payment.method_display || payment.method} ·{' '}
                          {payment.paid_at}
                        </span>
                        <span>{formatCurrency(payment.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => downloadInvoice(selectedOrder)}
                className="flex-1 rounded-lg bg-blue-600 py-2 font-medium text-white transition hover:bg-blue-700"
              >
                Invoice
              </button>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-lg bg-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-400 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Buyer;
