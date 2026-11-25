import axios from 'axios';

export type EggSize = 'PEEWEE' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'XL' | 'JUMBO';
export type EggGrade = 'GOOD' | 'DIRTY' | 'BROKEN';
export type EggType = 'GOOD' | 'DIRTY';
export type OrderStatus = 'PENDING' | 'APPROVED' | 'IN_DELIVERY' | 'COMPLETED' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';
export type PaymentMethod = 'COD' | 'GCASH' | 'BANK' | 'MAYA';

export interface ProductionSizeCountInput {
  egg_size: EggSize;
  grade: EggGrade;
  count: number;
}

export interface ProductionSizeCount extends ProductionSizeCountInput {
  id: number;
  production: number;
  egg_size_display?: string;
  grade_display?: string;
}

export interface Production {
  id: number;
  date: string;
  batch_name: string;
  total_eggs: number;
  good_eggs: number;
  broken_eggs: number;
  dirty_eggs: number;
  man_hours: string;
  notes: string;
  size_counts: ProductionSizeCount[];
  production_rate?: number;
  recorded_by?: number | null;
  recorded_by_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProductionInput {
  date: string;
  batch_name: string;
  man_hours?: string | number;
  notes?: string;
  size_counts: ProductionSizeCountInput[];
}

export interface InventoryItem {
  id: number;
  inventory: number;
  egg_size: EggSize;
  grade: EggGrade;
  available_eggs: number;
  reserved_eggs: number;
  sold_eggs: number;
  spoiled_eggs: number;
  total_eggs?: number;
  egg_size_display?: string;
  grade_display?: string;
}

export interface InventoryBySize {
  egg_size: EggSize;
  grade: EggGrade;
  available_eggs: number;
  reserved_eggs: number;
  sold_eggs: number;
  spoiled_eggs: number;
  available_trays: number;
}

export interface InventorySummary {
  available: number;
  reserved: number;
  sold: number;
  spoiled: number;
  sellable_now: number;
  trays_available: number;
  by_size: InventoryBySize[];
}

export interface InventoryHistoryEntry {
  date: string;
  available: number;
  reserved: number;
  sold: number;
  spoiled: number;
  total_eggs: number;
  items: InventoryItem[];
}

export interface StockLog {
  id: number;
  inventory: number;
  inventory_date?: string;
  action: string;
  action_display?: string;
  quantity: number;
  egg_size?: EggSize | null;
  grade?: EggGrade | null;
  egg_size_display?: string;
  grade_display?: string;
  reference: string;
  notes: string;
  created_at: string;
}

export interface EggPrice {
  size: EggSize;
  good_range: [number, number];
  dirty_range: [number, number];
  good_mid: number;
  dirty_mid: number;
  good_tray: number;
  dirty_tray: number;
  price_per_egg: number;
  price_source: 'DB' | 'FALLBACK';
}

export interface EggPriceRecord {
  id: number;
  egg_size: EggSize;
  egg_size_display?: string;
  price_per_egg: string;
  is_active: boolean;
  updated_by?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface EggPriceInput {
  egg_size: EggSize;
  price_per_egg: number | string;
  is_active?: boolean;
}

export interface Payment {
  id: number;
  order: number;
  order_number?: string;
  amount: string;
  method: PaymentMethod;
  method_display?: string;
  reference: string;
  proof_data?: string;
  proof_text?: string;
  paid_at: string;
  recorded_by?: number | null;
  recorded_by_name?: string | null;
  created_at?: string;
}

export interface PaymentInput {
  amount: number | string;
  method?: PaymentMethod;
  reference?: string;
  proof_data?: string;
  proof_text?: string;
  paid_at?: string;
}

export interface Order {
  id: number;
  order_number: string;
  buyer: number;
  buyer_name?: string;
  buyer_email?: string;
  buyer_phone?: string;
  buyer_address?: string;
  order_date: string;
  delivery_date: string;
  egg_size: EggSize;
  egg_type: EggType;
  is_tray: boolean;
  quantity: number;
  quantity_eggs: number;
  quantity_trays: number;
  price_per_egg: string;
  total_amount: string;
  balance: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  payment_reference: string;
  amount_paid: string;
  notes: string;
  payments?: Payment[];
  created_at?: string;
  updated_at?: string;
}

export interface OrderInput {
  buyer: number;
  delivery_date: string;
  egg_size: EggSize;
  egg_type: EggType;
  is_tray: boolean;
  quantity: number;
  price_per_egg?: number | string;
  notes?: string;
}

export interface BuyerProfile {
  id: number;
  name: string;
  email: string;
  phone: string;
  province?: string;
  municipality?: string;
  barangay?: string;
  purok?: string;
  landmark?: string;
  full_address: string;
  latitude?: number | null;
  longitude?: number | null;
}

export type DeliveryStatus = 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED';

export interface Delivery {
  id: number;
  order: number;
  order_number?: string;
  order_buyer?: string;
  order_address?: string;
  order_phone?: string;
  order_quantity?: number;
  order_quantity_eggs?: number;
  order_egg_size?: EggSize;
  order_egg_type?: EggType;
  buyer_lat?: number | null;
  buyer_lng?: number | null;
  delivery_staff?: number | null;
  staff_name?: string | null;
  delivery_date: string;
  status: DeliveryStatus;
  photo_proof?: string | null;
  signature?: string | null;
  signature_data?: string | null;
  failure_reason?: string | null;
  notes?: string;
  delivered_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StaffMember {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

export interface InventoryAdjustmentInput {
  egg_size: EggSize;
  grade: EggGrade;
  quantity: number;
  action?: 'ADJUSTMENT' | 'SPOILED';
  date?: string;
  notes?: string;
  reference?: string;
}

export interface Forecast {
  id: number;
  forecasted_date: string;
  forecasted_eggs: number;
  confidence_score: number;
  model_used?: string;
  actual_eggs?: number | null;
}

// ✅ Use VITE_API_BASE_URL from environment (set in .env) for API base path
//    Falls back to '/api' so Nginx reverse proxy can route /api/ to the backend
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

const API = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ✅ Login: authenticate user and store JWT tokens
export const login = async (username: string, password: string) => {
  const response = await API.post('/auth/login/', { username, password });
  localStorage.setItem('access_token', response.data.access);
  localStorage.setItem('refresh_token', response.data.refresh);
  return response.data;
};

// Attach JWT token to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses (redirect to login)
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Production API
export const getProductions = () => API.get<Production[]>('/production/');
export const createProduction = (data: ProductionInput) =>
  API.post<Production>('/production/', data);
export const updateProduction = (id: number, data: ProductionInput) =>
  API.patch<Production>(`/production/${id}/`, data);
export const deleteProduction = (id: number) => API.delete(`/production/${id}/`);
export const getTodayProduction = () => API.get<Production>('/production/today/');

// Buyer API
export const getBuyers = () => API.get('/buyers/');
export const createBuyer = (data: any) => API.post('/buyers/', data);

// Order API
export const getOrders = () => API.get<Order[]>('/orders/');
export const createOrder = (data: OrderInput) => API.post<Order>('/orders/', data);
export const getPendingOrders = () => API.get<Order[]>('/orders/pending/');

// Order payments
export const getOrderPayments = (orderId: number) =>
  API.get<Payment[]>(`/orders/${orderId}/payments/`);
export const createOrderPayment = (orderId: number, data: PaymentInput) =>
  API.post<Payment>(`/orders/${orderId}/payments/`, data);
export const updateOrderPayment = (
  orderId: number,
  paymentId: number,
  data: Partial<PaymentInput>
) => API.patch<Payment>(`/orders/${orderId}/payments/${paymentId}/`, data);
export const deleteOrderPayment = (orderId: number, paymentId: number) =>
  API.delete(`/orders/${orderId}/payments/${paymentId}/`);

// Delivery API
export const getDeliveries = () => API.get<Delivery[]>('/deliveries/');
export const getDeliveryStaff = () =>
  API.get<StaffMember[]>('/users/delivery_staff/');
export const assignDeliveryStaff = (deliveryId: number, staffId: number | null) =>
  API.post(`/deliveries/${deliveryId}/assign_staff/`, { staff_id: staffId });
export const markDelivered = (id: number) => API.post(`/deliveries/${id}/mark_delivered/`);
export const getPendingDeliveries = () => API.get<Delivery[]>('/deliveries/pending_deliveries/');

// Alert API
export const getAlerts = () => API.get('/alerts/');
export const getUnreadAlerts = () => API.get('/alerts/unread/');

// Forecast API
export const getTomorrowForecast = () => API.get<Forecast>('/forecasts/latest/');

// Inventory API
export const getInventory = () => API.get<InventorySummary>('/inventory/');
export const getInventoryHistory = () =>
  API.get<InventoryHistoryEntry[]>('/inventory/history/');
export const getStockLogs = () => API.get<StockLog[]>('/inventory/logs/');
export const adjustInventory = (data: InventoryAdjustmentInput) =>
  API.post<InventoryItem>('/inventory/adjust/', data);

// Pricing API
export const getEggPrices = () => API.get<EggPrice[]>('/prices/');
export const getEggPriceRecord = (eggSize: EggSize) =>
  API.get<EggPriceRecord>(`/prices/${eggSize}/`);
export const setEggPrice = (data: EggPriceInput) =>
  API.post<EggPriceRecord>('/prices/', data);
export const updateEggPrice = (eggSize: EggSize, data: Partial<EggPriceInput>) =>
  API.patch<EggPriceRecord>(`/prices/${eggSize}/`, data);
export const deleteEggPrice = (eggSize: EggSize) =>
  API.delete(`/prices/${eggSize}/`);

// Auth
export const getCurrentUser = () => API.get('/auth/me/');
// Notifications
export const getNotifications = () => API.get('/notifications/');
export const getUnreadCount = () => API.get('/notifications/unread_count/');
export const markNotificationRead = (id: number) => API.post(`/notifications/${id}/read/`);
export const markAllRead = () => API.post('/notifications/read_all/');

// Legacy payment helper (kept for admin screens)
export const updatePayment = (orderId: number, data: any) =>
  API.post(`/orders/${orderId}/update_payment/`, data);

// Export URLs (direct download)
export const EXPORT_URLS = {
  orders: `${API_BASE}/export/orders/`,
  buyers: `${API_BASE}/export/buyers/`,
  production: `${API_BASE}/export/production/`,
  deliveries: `${API_BASE}/export/deliveries/`,
  inventory: `${API_BASE}/export/inventory/`,
  stockLogs: `${API_BASE}/export/stock_logs/`,
  alerts: `${API_BASE}/export/alerts/`,
};

export const submitRating = (data: any) => API.post('/ratings/', data);
export const getRatingSummary = () => API.get('/ratings/summary/');
export const getRatings = () => API.get('/ratings/');
export default API;

export const getMyBuyerProfile = () => API.get<BuyerProfile>('/buyers/me/');
export const validateBuyer = (email: string, phone?: string) =>
  API.post('/validate-buyer/', { email, phone });
