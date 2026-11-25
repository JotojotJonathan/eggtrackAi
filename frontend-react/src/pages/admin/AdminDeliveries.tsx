import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  assignDeliveryStaff,
  getDeliveries,
  getDeliveryStaff,
} from '../../api/api';
import type { Delivery, DeliveryStatus, StaffMember } from '../../api/api';
import StatusPill from '../../components/StatusPill';
import toast from 'react-hot-toast';

const DELIVERY_STEPS: { key: DeliveryStatus; label: string }[] = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'IN_TRANSIT', label: 'Out for Delivery' },
  { key: 'DELIVERED', label: 'Done' },
];

const DeliveryTimeline = ({ status }: { status: DeliveryStatus }) => {
  const failed = status === 'FAILED';
  const currentIndex =
    status === 'DELIVERED' ? 2 : status === 'IN_TRANSIT' ? 1 : 0;

  return (
    <div className="flex min-w-[220px] items-center gap-1">
      {DELIVERY_STEPS.map((step, index) => {
        const complete = !failed && index <= currentIndex;
        const current = index === currentIndex;
        const dotClass =
          failed && current
            ? 'bg-red-500'
            : complete
              ? 'bg-green-500'
              : 'bg-gray-300 dark:bg-gray-600';
        const labelClass = complete
          ? 'text-green-700 dark:text-green-400'
          : current
            ? 'text-gray-700 dark:text-gray-200'
            : 'text-gray-400 dark:text-gray-500';

        return (
          <div key={step.key} className="flex items-center gap-1">
            <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
            <span className={`text-[10px] ${labelClass}`}>{step.label}</span>
            {index < DELIVERY_STEPS.length - 1 && (
              <span
                className={`h-px w-3 ${
                  complete && !failed
                    ? 'bg-green-500'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            )}
          </div>
        );
      })}
      {failed && (
        <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
          Failed
        </span>
      )}
    </div>
  );
};

const getStatusProps = (status: DeliveryStatus) => {
  switch (status) {
    case 'DELIVERED':
      return { status: 'DONE', label: 'Done' };
    case 'IN_TRANSIT':
      return { status: 'IN_TRANSIT', label: 'Out for Delivery' };
    case 'FAILED':
      return { status: 'FAILED', label: 'Failed' };
    default:
      return { status: 'NEED_TO_DELIVER', label: 'Need to deliver' };
  }
};

const getSignatureSrc = (delivery: Delivery) => {
  if (delivery.signature_data) {
    return delivery.signature_data.startsWith('data:image')
      ? delivery.signature_data
      : `data:image/png;base64,${delivery.signature_data}`;
  }
  return delivery.signature || null;
};

const getErrorMessage = (error: any) => {
  const data = error?.response?.data;
  if (data && typeof data === 'object') {
    return Object.values(data).flat().join(', ');
  }
  return error?.message || 'Something went wrong';
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const AdminDeliveries = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(
    null
  );
  const [selectedStaff, setSelectedStaff] = useState('');
  const [proofDelivery, setProofDelivery] = useState<Delivery | null>(null);

  useEffect(() => {
    let active = true;

    const loadInitialData = async () => {
      const [deliveriesResult, staffResult] = await Promise.allSettled([
        getDeliveries(),
        getDeliveryStaff(),
      ]);

      if (!active) return;

      if (deliveriesResult.status === 'fulfilled') {
        setDeliveries(deliveriesResult.value.data);
      } else {
        toast.error('Failed to load deliveries');
      }

      if (staffResult.status === 'fulfilled') {
        setStaffList(staffResult.value.data);
      } else {
        console.error('Failed to load staff');
      }

      setLoading(false);
    };

    loadInitialData();
    return () => {
      active = false;
    };
  }, []);

  const loadDeliveries = async () => {
    try {
      const res = await getDeliveries();
      setDeliveries(res.data);
    } catch {
      toast.error('Failed to load deliveries');
    }
  };

  const openAssignModal = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    setSelectedStaff(
      delivery.delivery_staff ? String(delivery.delivery_staff) : ''
    );
    setShowAssignModal(true);
  };

  const handleAssign = async () => {
    if (!selectedDelivery) return;

    try {
      await assignDeliveryStaff(
        selectedDelivery.id,
        selectedStaff ? Number(selectedStaff) : null
      );
      toast.success(selectedStaff ? 'Staff assigned' : 'Staff unassigned');
      setShowAssignModal(false);
      await loadDeliveries();
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    }
  };

  const signatureSrc = proofDelivery
    ? getSignatureSrc(proofDelivery)
    : null;
  const proofStatus = proofDelivery
    ? getStatusProps(proofDelivery.status)
    : null;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white lg:text-3xl">
          Delivery Management
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {deliveries.length} deliveries
        </p>
      </div>

      {loading ? (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
          Loading...
        </div>
      ) : deliveries.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow dark:bg-gray-800 dark:text-gray-400">
          No deliveries yet
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow dark:bg-gray-800">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 lg:px-4">
                  Order
                </th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 lg:px-4">
                  Buyer
                </th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 lg:px-4">
                  Home Address
                </th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 lg:px-4">
                  Timeline
                </th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 lg:px-4">
                  Status
                </th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 lg:px-4">
                  Staff
                </th>
                <th className="px-3 py-3 text-center font-semibold text-gray-600 dark:text-gray-300 lg:px-4">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((delivery) => {
                const statusProps = getStatusProps(delivery.status);
                const hasCoordinates = Boolean(
                  delivery.buyer_lat && delivery.buyer_lng
                );

                return (
                  <tr
                    key={delivery.id}
                    className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-3 py-3 lg:px-4">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {delivery.order_number || `#${delivery.order}`}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">
                        {formatDateTime(delivery.delivery_date)}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300 lg:px-4">
                      {delivery.order_buyer || 'Unknown'}
                    </td>
                    <td className="px-3 py-3 lg:px-4">
                      <span
                        className="block max-w-[240px] truncate text-xs text-gray-600 dark:text-gray-400"
                        title={delivery.order_address || ''}
                      >
                        {delivery.order_address || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-3 lg:px-4">
                      <DeliveryTimeline status={delivery.status} />
                    </td>
                    <td className="px-3 py-3 lg:px-4">
                      <StatusPill
                        status={statusProps.status}
                        label={statusProps.label}
                      />
                    </td>
                    <td className="px-3 py-3 lg:px-4">
                      {delivery.staff_name ? (
                        <span className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          {delivery.staff_name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 lg:px-4">
                      <div className="flex flex-wrap justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => openAssignModal(delivery)}
                          className="rounded bg-blue-600 px-2 py-1 text-xs text-white transition hover:bg-blue-700"
                        >
                          {delivery.staff_name ? 'Reassign' : 'Assign'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setProofDelivery(delivery)}
                          className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 transition hover:bg-gray-200 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                        >
                          Proof
                        </button>
                        {hasCoordinates ? (
                          <Link
                            to={`/admin/map?order=${delivery.order}`}
                            className="rounded bg-green-100 px-2 py-1 text-xs text-green-700 transition hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60"
                          >
                            Map
                          </Link>
                        ) : (
                          <span
                            className="cursor-not-allowed rounded bg-gray-100 px-2 py-1 text-xs text-gray-400 dark:bg-gray-700 dark:text-gray-500"
                            title="Buyer location is not geocoded"
                          >
                            Map
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Assign Delivery Staff
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {selectedDelivery?.order_number || `#${selectedDelivery?.order}`}{' '}
              · {selectedDelivery?.order_buyer}
            </p>

            <label className="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Select Staff
            </label>
            <select
              value={selectedStaff}
              onChange={(event) => setSelectedStaff(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">— Unassigned —</option>
              {staffList.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.username} ({staff.email})
                </option>
              ))}
            </select>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={handleAssign}
                className="flex-1 rounded-lg bg-green-600 py-2 font-medium text-white transition hover:bg-green-700"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="rounded-lg bg-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-400 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {proofDelivery && proofStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Proof of Delivery
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {proofDelivery.order_number || `#${proofDelivery.order}`} ·{' '}
                  {proofDelivery.order_buyer}
                </p>
              </div>
              <StatusPill
                status={proofStatus.status}
                label={proofStatus.label}
                size="md"
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Photo Proof
                </h4>
                {proofDelivery.photo_proof ? (
                  <img
                    src={proofDelivery.photo_proof}
                    alt="Delivery proof"
                    className="max-h-64 w-full rounded-lg border border-gray-200 bg-gray-50 object-contain dark:border-gray-700 dark:bg-gray-900"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-gray-300 text-sm text-gray-400 dark:border-gray-600 dark:text-gray-500">
                    No photo proof uploaded
                  </div>
                )}
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Signature
                </h4>
                {signatureSrc ? (
                  <img
                    src={signatureSrc}
                    alt="Delivery signature"
                    className="max-h-64 w-full rounded-lg border border-gray-200 bg-white object-contain dark:border-gray-700"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-gray-300 text-sm text-gray-400 dark:border-gray-600 dark:text-gray-500">
                    No signature uploaded
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-700/60 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Home Address
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  {proofDelivery.order_address || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Delivered At
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  {formatDateTime(proofDelivery.delivered_at)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Failure Reason
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  {proofDelivery.failure_reason || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Notes
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  {proofDelivery.notes || '-'}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {proofDelivery.buyer_lat && proofDelivery.buyer_lng && (
                <Link
                  to={`/admin/map?order=${proofDelivery.order}`}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  View on Map
                </Link>
              )}
              <button
                type="button"
                onClick={() => setProofDelivery(null)}
                className="rounded-lg bg-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-400 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500"
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

export default AdminDeliveries;
