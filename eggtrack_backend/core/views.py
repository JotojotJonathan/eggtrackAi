from decimal import Decimal, InvalidOperation

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from datetime import datetime, timedelta
import time

from .models import (
    Buyer, Production, Order, Delivery, Alert, AIForecast,
    UserProfile, Inventory, InventoryItem, EggPrice, Payment,
    StockLog, Notification, DeliveryRating, EGG_SIZE_CHOICES,
)
from .serializers import (
    BuyerSerializer,
    ProductionSerializer,
    OrderSerializer,
    DeliverySerializer,
    AlertSerializer,
    AIForecastSerializer,
    UserSerializer,
    CustomTokenObtainPairSerializer,
    DeliveryRatingSerializer,
    InventoryItemSerializer,
    StockLogSerializer,
    EggPriceSerializer,
    PaymentSerializer,
)

from django.contrib.auth.models import User

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.permissions import AllowAny, IsAuthenticated

from . import ai_engine

# Inventory service imports
from .inventory_service import (
    add_production_to_inventory,
    reserve_eggs_for_order,
    release_reserved_eggs,
    mark_as_delivered as inventory_mark_delivered,
    get_current_stock,
    get_production_contribution,
    sync_production_inventory,
    remove_production_from_inventory,
    adjust_inventory as adjust_inventory_stock,
)

# Payment service imports
from .payment_service import (
    record_payment,
    update_payment,
    delete_payment,
)

# Notification service imports
from .notifications_service import (
    on_order_placed,
    on_order_approved,
    on_order_rejected,
    on_order_delivered,
    notify_user,
    notify_role,
)


def user_is_admin(user):
    """Return True for authenticated admins/superusers"""
    return bool(
        user
        and user.is_authenticated
        and (
            user.is_superuser
            or (hasattr(user, 'profile') and user.profile.role == 'ADMIN')
        )
    )


class IsAdminRole(permissions.BasePermission):
    message = 'Admin access required'

    def has_permission(self, request, view):
        return user_is_admin(request.user)


def user_can_view_order(user, order):
    """Admins or the buyer who owns the order can view its payments"""
    if user_is_admin(user):
        return True
    if not user or not user.is_authenticated:
        return False
    if (
        hasattr(user, 'buyer_profile')
        and user.buyer_profile
        and user.buyer_profile.id == order.buyer_id
    ):
        return True
    return bool(
        user.email
        and order.buyer.email
        and user.email.lower() == order.buyer.email.lower()
    )


# ============================================================
# BUYER
# ============================================================

from .geocode import geocode_buyer


class BuyerViewSet(viewsets.ModelViewSet):
    queryset = Buyer.objects.all()
    serializer_class = BuyerSerializer
    permission_classes = [permissions.AllowAny]

    def perform_create(self, serializer):
        """Auto-geocode when creating a buyer"""
        buyer = serializer.save()
        geocode_buyer(buyer)

    def perform_update(self, serializer):
        """Re-geocode if address changes"""
        buyer = serializer.save()
        if buyer.address and (not buyer.latitude or not buyer.longitude):
            geocode_buyer(buyer)

    @action(detail=False, methods=['post'])
    def geocode_all(self, request):
        """Bulk geocode all buyers without coordinates"""
        buyers = Buyer.objects.filter(latitude__isnull=True) | Buyer.objects.filter(longitude__isnull=True)
        count = 0
        for buyer in buyers:
            if geocode_buyer(buyer):
                count += 1
            time.sleep(1)  # Rate limit for Nominatim
        return Response({'geocoded': count, 'total': buyers.count()})


# ============================================================
# PRODUCTION
# ============================================================

class ProductionViewSet(viewsets.ModelViewSet):
    queryset = Production.objects.prefetch_related('size_counts')
    serializer_class = ProductionSerializer
    permission_classes = [permissions.AllowAny]

    def perform_create(self, serializer):
        production = serializer.save()

        # Auto-update inventory
        try:
            add_production_to_inventory(production)
        except Exception as e:
            print(f"Inventory error: {e}")

        # Auto-generate forecast
        try:
            from .ai_service import save_forecast
            save_forecast()
        except Exception as e:
            print(f"Forecast error: {e}")

        # Check for anomalies
        try:
            from .ai_service import detect_anomaly
            result = detect_anomaly(production)
            if result and result.get('is_anomaly'):
                print(f"⚠️ Anomaly detected: {result}")
        except Exception as e:
            print(f"Anomaly error: {e}")

    def perform_update(self, serializer):
        instance = serializer.instance
        has_size_counts = instance.size_counts.exists()
        needs_sync = (
            'size_counts' in serializer.validated_data
            or (has_size_counts and 'date' in serializer.validated_data)
        )
        old_contribution = (
            get_production_contribution(instance) if needs_sync else None
        )
        old_date = instance.date

        with transaction.atomic():
            production = serializer.save()
            if needs_sync:
                sync_production_inventory(
                    production,
                    old_contribution=old_contribution,
                    old_date=old_date,
                )

    def destroy(self, request, *args, **kwargs):
        production = self.get_object()

        if production.size_counts.exists():
            try:
                with transaction.atomic():
                    remove_production_from_inventory(production)
                    production.delete()
            except ValueError as e:
                return Response({'error': str(e)}, status=400)
            return Response(status=204)

        production.delete()
        return Response(status=204)

    @action(detail=False, methods=['get'])
    def today(self, request):
        today = timezone.now().date()
        production = Production.objects.filter(
            date=today
        ).order_by('-created_at').first()

        if not production:
            return Response(
                {'detail': 'No production recorded today'},
                status=404
            )

        serializer = self.get_serializer(production)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def last_7_days(self, request):
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=7)

        productions = Production.objects.filter(
            date__range=[start_date, end_date]
        )
        serializer = self.get_serializer(productions, many=True)
        return Response(serializer.data)


# ============================================================
# ORDER
# ============================================================

class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.select_related('buyer').prefetch_related('payments')
    serializer_class = OrderSerializer
    permission_classes = [permissions.AllowAny]

    def perform_create(self, serializer):
        order = serializer.save()
        # Notify admins & delivery staff
        try:
            on_order_placed(order)
        except Exception as e:
            print(f"Notification error: {e}")

    @action(detail=False, methods=['get'])
    def pending(self, request):
        orders = Order.objects.filter(status='PENDING')
        serializer = self.get_serializer(orders, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminRole])
    def approve(self, request, pk=None):
        """Approve order AND create delivery record"""
        order = self.get_object()

        if order.status != 'PENDING':
            return Response(
                {'error': 'Only pending orders can be approved'},
                status=400
            )

        # Check inventory
        if not reserve_eggs_for_order(order):
            return Response(
                {'error': 'Not enough eggs in inventory to fulfill this order'},
                status=400
            )

        order.status = 'APPROVED'
        order.save()

        # Auto-create delivery
        Delivery.objects.create(
            order=order,
            delivery_date=timezone.now() + timedelta(days=1),
            status='PENDING',
        )

        # Notify buyer
        try:
            on_order_approved(order)
        except Exception as e:
            print(f"Notification error: {e}")

        return Response({'status': 'Order approved, eggs reserved'})

    @action(detail=True, methods=['post'], permission_classes=[IsAdminRole])
    def reject(self, request, pk=None):
        order = self.get_object()

        if order.status in ('COMPLETED', 'CANCELLED'):
            return Response(
                {'error': 'Completed or cancelled orders cannot be rejected'},
                status=400
            )

        old_status = order.status
        order.status = 'CANCELLED'
        order.save()

        # Release reserved eggs if they were reserved
        if old_status in ('APPROVED', 'IN_DELIVERY'):
            release_reserved_eggs(order)

        # Notify buyer
        try:
            on_order_rejected(order)
        except Exception as e:
            print(f"Notification error: {e}")

        return Response({'status': 'Order cancelled'})

    @action(detail=True, methods=['post'], permission_classes=[IsAdminRole])
    def update_payment(self, request, pk=None):
        """Update payment status"""
        order = self.get_object()
        order.payment_status = request.data.get('payment_status', order.payment_status)
        order.payment_method = request.data.get('payment_method', order.payment_method)
        order.payment_reference = request.data.get('payment_reference', order.payment_reference)
        order.amount_paid = request.data.get('amount_paid', order.amount_paid)
        order.save()
        return Response({'status': 'Payment updated'})


def _parse_paid_at(value):
    if not value:
        return None
    parsed = parse_datetime(str(value))
    if parsed is None:
        raise ValueError('Invalid paid_at value')
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed)
    return parsed


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def order_payments(request, order_id):
    """List or record payments for an order"""
    order = get_object_or_404(Order, pk=order_id)

    if request.method == 'GET':
        if not user_can_view_order(request.user, order):
            return Response({'error': 'Not allowed'}, status=403)
        payments = order.payments.all()
        return Response(PaymentSerializer(payments, many=True).data)

    if not user_is_admin(request.user):
        return Response({'error': 'Admin access required'}, status=403)

    amount = request.data.get('amount')
    if amount in (None, ''):
        return Response({'error': 'amount is required'}, status=400)

    try:
        paid_at = _parse_paid_at(request.data.get('paid_at'))
        payment = record_payment(
            order,
            amount=amount,
            method=request.data.get('method') or order.payment_method,
            reference=request.data.get('reference', ''),
            proof_data=request.data.get('proof_data', ''),
            proof_text=request.data.get('proof_text', ''),
            paid_at=paid_at,
            recorded_by=request.user,
        )
    except ValueError as e:
        return Response({'error': str(e)}, status=400)

    return Response(PaymentSerializer(payment).data, status=201)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAdminRole])
def order_payment_detail(request, order_id, payment_id):
    """Update or delete a single payment"""
    order = get_object_or_404(Order, pk=order_id)
    payment = get_object_or_404(Payment, pk=payment_id, order=order)

    if request.method == 'DELETE':
        order = delete_payment(payment)
        return Response({
            'status': 'Payment deleted',
            'amount_paid': str(order.amount_paid),
            'payment_status': order.payment_status,
        })

    fields = {}
    for field in ('amount', 'method', 'reference', 'proof_data', 'proof_text'):
        if field in request.data:
            fields[field] = request.data[field]

    if 'paid_at' in request.data:
        try:
            fields['paid_at'] = _parse_paid_at(request.data['paid_at'])
        except ValueError as e:
            return Response({'error': str(e)}, status=400)

    if not fields:
        return Response({'error': 'No payment fields to update'}, status=400)

    try:
        payment = update_payment(payment, **fields)
    except ValueError as e:
        return Response({'error': str(e)}, status=400)

    return Response(PaymentSerializer(payment).data)


# ============================================================
# DELIVERY
# ============================================================

class DeliveryViewSet(viewsets.ModelViewSet):
    queryset = Delivery.objects.select_related('order', 'order__buyer', 'delivery_staff')
    serializer_class = DeliverySerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=True, methods=['post'])
    def mark_delivered(self, request, pk=None):
        """Mark as delivered with photo proof and signature"""
        delivery = self.get_object()

        # Handle photo
        if 'photo_proof' in request.FILES:
            delivery.photo_proof = request.FILES['photo_proof']

        # Handle signature (base64 string)
        if 'signature_data' in request.data:
            delivery.signature_data = request.data['signature_data']

        delivery.mark_as_delivered()

        # Update inventory + notify buyer
        try:
            inventory_mark_delivered(delivery.order)
            on_order_delivered(delivery.order)
        except Exception as e:
            print(f"Error: {e}")

        return Response({'status': 'Delivery marked as delivered'})

    @action(detail=True, methods=['post'])
    def mark_failed(self, request, pk=None):
        """Mark delivery as failed with reason"""
        delivery = self.get_object()
        reason = request.data.get('failure_reason', 'No reason provided')
        delivery.mark_as_failed(reason)
        return Response({'status': 'Delivery marked as failed'})

    @action(detail=True, methods=['post'], permission_classes=[IsAdminRole])
    def assign_staff(self, request, pk=None):
        """Assign or unassign delivery staff"""
        delivery = self.get_object()
        staff_id = request.data.get('staff_id')

        # Unassign
        if staff_id is None or staff_id == '':
            delivery.delivery_staff = None
            delivery.save()
            return Response({'status': 'Staff unassigned'})

        try:
            staff = User.objects.get(id=staff_id)
            # Check role
            if not hasattr(staff, 'profile') or staff.profile.role not in ['DELIVERY', 'ADMIN']:
                return Response(
                    {'error': 'User is not a delivery staff member'},
                    status=400
                )
            delivery.delivery_staff = staff
            delivery.save()

            # Notify assigned staff
            try:
                notify_user(
                    staff,
                    'DELIVERY_ASSIGNED',
                    'New Delivery Assigned',
                    f"You've been assigned to Order #{delivery.order.id}",
                    link=f"/delivery/{delivery.id}",
                )
            except Exception as e:
                print(f"Notification error: {e}")

            return Response({
                'status': 'Staff assigned',
                'staff_name': staff.username,
            })
        except User.DoesNotExist:
            return Response({'error': 'Staff not found'}, status=404)

    @action(detail=False, methods=['get'])
    def pending_deliveries(self, request):
        deliveries = Delivery.objects.filter(status__in=['PENDING', 'IN_TRANSIT'])
        serializer = self.get_serializer(deliveries, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my_deliveries(self, request):
        """Get deliveries assigned to current staff"""
        if not request.user.is_authenticated:
            return Response({'error': 'Not authenticated'}, status=401)
        deliveries = Delivery.objects.filter(delivery_staff=request.user)
        serializer = self.get_serializer(deliveries, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def today_deliveries(self, request):
        today = timezone.now().date()
        deliveries = Delivery.objects.filter(delivery_date__date=today)
        serializer = self.get_serializer(deliveries, many=True)
        return Response(serializer.data)


# ============================================================
# DELIVERY RATING
# ============================================================

class DeliveryRatingViewSet(viewsets.ModelViewSet):
    queryset = DeliveryRating.objects.all()
    serializer_class = DeliveryRatingSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['get'])
    def for_delivery(self, request):
        """Get rating for a specific delivery"""
        delivery_id = request.query_params.get('delivery_id')
        try:
            rating = DeliveryRating.objects.get(delivery_id=delivery_id)
            return Response(DeliveryRatingSerializer(rating).data)
        except DeliveryRating.DoesNotExist:
            return Response({'detail': 'No rating yet'}, status=404)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get average rating"""
        ratings = DeliveryRating.objects.all()
        if not ratings.exists():
            return Response({'average': 0, 'total': 0})
        avg = sum(r.rating for r in ratings) / ratings.count()
        return Response({
            'average': round(avg, 2),
            'total': ratings.count(),
        })


# ============================================================
# ALERT
# ============================================================

class AlertViewSet(viewsets.ModelViewSet):
    queryset = Alert.objects.all()
    serializer_class = AlertSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['get'])
    def unread(self, request):
        alerts = Alert.objects.filter(is_read=False)
        serializer = self.get_serializer(alerts, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def critical(self, request):
        alerts = Alert.objects.filter(severity='CRITICAL', is_read=False)
        serializer = self.get_serializer(alerts, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        alert = self.get_object()
        alert.is_read = True
        alert.save()
        return Response({'status': 'Alert marked as read'})


# ============================================================
# AI FORECAST
# ============================================================

class AIForecastViewSet(viewsets.ModelViewSet):
    queryset = AIForecast.objects.all()
    serializer_class = AIForecastSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Generate a new forecast using AI"""
        from .ai_service import save_forecast
        forecast = save_forecast()

        if forecast:
            serializer = self.get_serializer(forecast)
            return Response(serializer.data)

        return Response(
            {'detail': 'Not enough data to forecast'},
            status=400
        )

    @action(detail=False, methods=['get'])
    def latest(self, request):
        """Get the latest forecast"""
        forecast = AIForecast.objects.order_by('-forecasted_date').first()

        if forecast:
            serializer = self.get_serializer(forecast)
            return Response(serializer.data)

        return Response(
            {'detail': 'No forecast available'},
            status=404
        )


# ============================================================
# USER
# ============================================================

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['get'])
    def workers(self, request):
        users = User.objects.filter(profile__role='WORKER')
        serializer = self.get_serializer(users, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def delivery_staff(self, request):
        """Get all delivery staff members"""
        users = User.objects.filter(profile__role='DELIVERY')
        data = [
            {'id': u.id, 'username': u.username, 'email': u.email}
            for u in users
        ]
        return Response(data)

    @action(detail=False, methods=['post'], permission_classes=[IsAdminRole])
    def create_user(self, request):
        """Create a new user with role"""
        try:
            username = request.data.get('username')
            password = request.data.get('password')
            email = request.data.get('email', '')
            role = request.data.get('role', 'WORKER')

            if User.objects.filter(username=username).exists():
                return Response({'error': 'Username already exists'}, status=400)

            user = User.objects.create_user(
                username=username,
                password=password,
                email=email
            )
            UserProfile.objects.create(user=user, role=role)

            return Response({
                'id': user.id,
                'username': user.username,
                'role': role,
            })
        except Exception as e:
            return Response({'error': str(e)}, status=400)


# ============================================================
# AUTHENTICATION - JWT LOGIN
# ============================================================

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


# ============================================================
# CURRENT AUTHENTICATED USER
# ============================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_current_user(request):
    user = request.user

    return Response({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'role': (
            user.profile.role
            if hasattr(user, 'profile')
            else 'WORKER'
        ),
    })


# ============================================================
# STEP 3: AI API ENDPOINTS
# ============================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def run_ai_tasks(request):
    """Manually trigger all AI tasks"""
    results = ai_engine.run_all_ai_tasks()
    return Response(results)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_prediction(request):
    """Get tomorrow's production prediction"""
    prediction = ai_engine.predict_tomorrow_production()

    if not prediction:
        return Response({'detail': 'Not enough data'}, status=404)

    return Response(prediction)


@api_view(['GET'])
@permission_classes([AllowAny])
def check_anomaly(request):
    """Check for anomalies in production"""
    result = ai_engine.detect_anomaly()
    return Response(result)


@api_view(['GET'])
@permission_classes([AllowAny])
def check_overcommitment(request):
    """Check for order overcommitment"""
    result = ai_engine.check_order_overcommitment()
    return Response(result)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_reports(request):
    """Get analytics data for reports"""
    end_date = timezone.now().date()
    start_date = end_date - timedelta(days=30)

    # Production trend
    productions = Production.objects.filter(
        date__range=[start_date, end_date]
    ).order_by('date')

    production_data = [
        {'date': str(p.date), 'eggs': p.total_eggs, 'good': p.good_eggs}
        for p in productions
    ]

    # Sales trend (completed orders)
    orders = Order.objects.filter(
        order_date__range=[start_date, end_date]
    ).order_by('order_date')

    sales_data = {}
    for o in orders:
        date_str = str(o.order_date)
        if date_str not in sales_data:
            sales_data[date_str] = {'date': date_str, 'orders': 0, 'revenue': 0}
        sales_data[date_str]['orders'] += 1
        sales_data[date_str]['revenue'] += float(o.total_amount)

    return Response({
        'production': production_data,
        'sales': list(sales_data.values()),
        'totals': {
            'total_eggs': sum(p['eggs'] for p in production_data),
            'total_orders': orders.count(),
            'total_revenue': float(sum(o.total_amount for o in orders)),
        }
    })


# ============================================================
# INVENTORY API ENDPOINTS
# ============================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def get_inventory(request):
    """Get current stock levels"""
    stock = get_current_stock()
    return Response(stock)


@api_view(['POST'])
@permission_classes([IsAdminRole])
def adjust_inventory(request):
    """Manually adjust per-size/per-grade stock (admin only)"""
    egg_size = request.data.get('egg_size')
    grade = request.data.get('grade')
    quantity = request.data.get('quantity')
    action = str(request.data.get('action', 'ADJUSTMENT')).upper()

    if egg_size not in dict(EGG_SIZE_CHOICES):
        return Response({'error': 'Invalid egg size'}, status=400)
    if grade not in ('GOOD', 'DIRTY', 'BROKEN'):
        return Response({'error': 'Invalid egg grade'}, status=400)

    try:
        quantity = int(quantity)
    except (TypeError, ValueError):
        return Response({'error': 'Invalid quantity'}, status=400)

    date_raw = request.data.get('date')
    date = parse_date(date_raw) if date_raw else None
    if date_raw and not date:
        return Response({'error': 'Invalid date'}, status=400)

    try:
        item = adjust_inventory_stock(
            egg_size=egg_size,
            grade=grade,
            quantity=quantity,
            action=action,
            date=date,
            notes=request.data.get('notes', ''),
            reference=request.data.get('reference', 'Manual adjustment'),
        )
    except ValueError as e:
        return Response({'error': str(e)}, status=400)

    return Response(InventoryItemSerializer(item).data)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_inventory_history(request):
    """Get inventory history (last 30 days)"""
    inventory = Inventory.objects.prefetch_related('items').all()[:30]
    data = [
        {
            'date': str(i.date),
            'available': i.available_eggs,
            'reserved': i.reserved_eggs,
            'sold': i.sold_eggs,
            'spoiled': i.spoiled_eggs,
            'total_eggs': i.total_eggs,
            'items': InventoryItemSerializer(i.items.all(), many=True).data,
        }
        for i in inventory
    ]
    return Response(data)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_stock_logs(request):
    """Get recent stock activity logs"""
    logs = StockLog.objects.select_related('inventory').all()[:50]
    return Response(StockLogSerializer(logs, many=True).data)


# ============================================================
# NOTIFICATIONS API ENDPOINTS
# ============================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_notifications(request):
    """Get current user's notifications"""
    notifications = Notification.objects.filter(user=request.user)[:50]
    data = [
        {
            'id': n.id,
            'type': n.notification_type,
            'title': n.title,
            'message': n.message,
            'link': n.link,
            'is_read': n.is_read,
            'created_at': n.created_at,
        }
        for n in notifications
    ]
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_unread_count(request):
    """Get count of unread notifications"""
    count = Notification.objects.filter(user=request.user, is_read=False).count()
    return Response({'count': count})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_notification_read(request, pk):
    """Mark a notification as read"""
    try:
        n = Notification.objects.get(id=pk, user=request.user)
        n.is_read = True
        n.save()
        return Response({'status': 'marked'})
    except Notification.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_all_notifications_read(request):
    """Mark all notifications as read"""
    Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
    return Response({'status': 'all marked'})


# ============================================================
# BUYER SELF-REGISTRATION (NEW)
# ============================================================

@api_view(['POST'])
@permission_classes([AllowAny])
def register_buyer(request):
    """Public buyer registration with full info"""
    data = request.data
    
    # Validate required fields
    required = ['username', 'password', 'email', 'name', 'phone', 'province', 'municipality', 'barangay']
    for field in required:
        if not data.get(field):
            return Response({'error': f'{field} is required'}, status=400)
    
    # Check if username/email exists
    if User.objects.filter(username=data['username']).exists():
        return Response({'error': 'Username already taken'}, status=400)
    
    if User.objects.filter(email=data['email']).exists():
        return Response({'error': 'Email already registered'}, status=400)
    
    if Buyer.objects.filter(email=data['email']).exists():
        return Response({'error': 'Email already registered as buyer'}, status=400)
    
    try:
        # Create User
        user = User.objects.create_user(
            username=data['username'],
            password=data['password'],
            email=data['email'],
        )
        UserProfile.objects.create(user=user, role='BUYER')
        
        # Create Buyer profile
        buyer = Buyer.objects.create(
            name=data['name'],
            email=data['email'],
            phone=data['phone'],
            province=data.get('province', ''),
            municipality=data.get('municipality', ''),
            barangay=data.get('barangay', ''),
            purok=data.get('purok', ''),
            landmark=data.get('landmark', ''),
            is_active=True,
        )
        
        # Auto-geocode
        try:
            geocode_buyer(buyer)
        except Exception as e:
            print(f"Geocode error: {e}")
        
        # Send welcome notification
        try:
            notify_user(
                user,
                'SYSTEM',
                '🎉 Welcome to EggTrack AI!',
                f'Hi {buyer.name}! Your account is now active. Start ordering fresh eggs today!',
                link='/buyer',
            )
        except Exception as e:
            print(f"Notification error: {e}")
        
        return Response({
            'status': 'registered',
            'user_id': user.id,
            'buyer_id': buyer.id,
            'username': user.username,
        }, status=201)
        
    except Exception as e:
        return Response({'error': str(e)}, status=400)


# ============================================================
# CREATE STAFF ACCOUNT (NEW)
# ============================================================

@api_view(['POST'])
@permission_classes([IsAdminRole])
def create_staff_account(request):
    """Admin creates a worker/delivery/admin account with complete info"""
    data = request.data
    
    required = ['username', 'password', 'name', 'role']
    for field in required:
        if not data.get(field):
            return Response({'error': f'{field} is required'}, status=400)
    
    if data['role'] not in ['WORKER', 'DELIVERY', 'ADMIN']:
        return Response({'error': 'Invalid role'}, status=400)
    
    if User.objects.filter(username=data['username']).exists():
        return Response({'error': 'Username already taken'}, status=400)
    
    try:
        user = User.objects.create_user(
            username=data['username'],
            password=data['password'],
            email=data.get('email', ''),
            first_name=data.get('first_name', ''),
            last_name=data.get('last_name', ''),
        )
        
        UserProfile.objects.create(
            user=user,
            role=data['role'],
            phone=data.get('phone', ''),
        )
        
        return Response({
            'status': 'created',
            'user_id': user.id,
            'username': user.username,
            'role': data['role'],
        }, status=201)
        
    except Exception as e:
        return Response({'error': str(e)}, status=400)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_my_buyer_profile(request):
    """Get the buyer profile linked to the logged-in user"""
    try:
        # Match by email
        buyer = Buyer.objects.get(email=request.user.email)
        return Response({
            'id': buyer.id,
            'name': buyer.name,
            'email': buyer.email,
            'phone': buyer.phone,
            'province': buyer.province,
            'municipality': buyer.municipality,
            'barangay': buyer.barangay,
            'purok': buyer.purok,
            'landmark': buyer.landmark,
            'full_address': buyer.full_address,
            'latitude': buyer.latitude,
            'longitude': buyer.longitude,
        })
    except Buyer.DoesNotExist:
        return Response({'detail': 'No buyer profile found'}, status=404)


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def get_egg_prices(request):
    """Get egg pricing reference, or set a price (admin only)"""
    from .pricing import EGG_PRICES, get_db_price, get_egg_price, get_order_unit_price

    if request.method == 'POST':
        if not user_is_admin(request.user):
            return Response({'error': 'Admin access required'}, status=403)

        egg_size = str(request.data.get('egg_size', '')).upper()
        if egg_size not in dict(EGG_SIZE_CHOICES):
            return Response({'error': 'Invalid egg size'}, status=400)

        try:
            price = Decimal(str(request.data.get('price_per_egg')))
        except (InvalidOperation, TypeError, ValueError):
            return Response({'error': 'Invalid price_per_egg'}, status=400)
        if not price.is_finite() or price <= 0:
            return Response(
                {'error': 'price_per_egg must be greater than zero'},
                status=400
            )

        is_active = request.data.get('is_active', True)
        if isinstance(is_active, str):
            is_active = is_active.strip().lower() in ('true', '1', 'yes', 'on')

        egg_price, created = EggPrice.objects.update_or_create(
            egg_size=egg_size,
            defaults={
                'price_per_egg': price,
                'is_active': bool(is_active),
                'updated_by': request.user,
            },
        )
        return Response(
            EggPriceSerializer(egg_price).data,
            status=201 if created else 200
        )

    data = []
    for size, types in EGG_PRICES.items():
        db_price = get_db_price(size)
        good_price = float(get_egg_price(size, 'GOOD'))
        dirty_price = float(get_egg_price(size, 'DIRTY'))
        good_tray = float(get_order_unit_price(size, 'GOOD', is_tray=True))
        dirty_tray = float(get_order_unit_price(size, 'DIRTY', is_tray=True))
        data.append({
            'size': size,
            'good_range': types['GOOD'],
            'dirty_range': types['DIRTY'],
            'good_mid': good_price,
            'dirty_mid': dirty_price,
            'good_tray': good_tray,
            'dirty_tray': dirty_tray,
            'price_per_egg': good_price,
            'price_source': 'DB' if db_price is not None else 'FALLBACK',
        })
    return Response(data)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([AllowAny])
def egg_price_detail(request, egg_size):
    """Read, update, or delete a size price (writes are admin only)"""
    egg_price = get_object_or_404(EggPrice, egg_size=str(egg_size).upper())

    if request.method == 'GET':
        return Response(EggPriceSerializer(egg_price).data)

    if not user_is_admin(request.user):
        return Response({'error': 'Admin access required'}, status=403)

    if request.method == 'DELETE':
        egg_price.delete()
        return Response(status=204)

    if 'price_per_egg' in request.data:
        try:
            price = Decimal(str(request.data['price_per_egg']))
        except (InvalidOperation, TypeError, ValueError):
            return Response({'error': 'Invalid price_per_egg'}, status=400)
        if not price.is_finite() or price <= 0:
            return Response(
                {'error': 'price_per_egg must be greater than zero'},
                status=400
            )
        egg_price.price_per_egg = price

    if 'is_active' in request.data:
        is_active = request.data['is_active']
        if isinstance(is_active, str):
            is_active = is_active.strip().lower() in ('true', '1', 'yes', 'on')
        egg_price.is_active = bool(is_active)

    egg_price.updated_by = request.user
    egg_price.save()
    return Response(EggPriceSerializer(egg_price).data)


@api_view(['POST'])
@permission_classes([AllowAny])
def validate_buyer(request):
    """Validate if email/phone belongs to a registered buyer"""
    email = request.data.get('email', '').strip().lower()
    phone = request.data.get('phone', '').strip()
    
    if not email and not phone:
        return Response({'valid': False, 'error': 'Email or phone required'}, status=400)
    
    try:
        buyer = Buyer.objects.get(email__iexact=email)
        # Optional: check phone match
        if phone and buyer.phone != phone:
            return Response({
                'valid': False,
                'error': 'Phone number does not match our records',
            }, status=400)
        
        return Response({
            'valid': True,
            'buyer': {
                'id': buyer.id,
                'name': buyer.name,
                'email': buyer.email,
                'phone': buyer.phone,
                'full_address': buyer.full_address,
            }
        })
    except Buyer.DoesNotExist:
        return Response({
            'valid': False,
            'error': 'Email not registered. Please register first.',
        }, status=404)    