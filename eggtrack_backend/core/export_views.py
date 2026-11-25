"""
CSV export views for all major models.
"""
import csv
from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from .models import Order, Buyer, Production, Delivery, Inventory, StockLog, Alert
from django.utils import timezone


def csv_response(filename, headers, rows):
    """Helper to build CSV response"""
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    writer = csv.writer(response)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)
    return response


@api_view(['GET'])
@permission_classes([AllowAny])
def export_orders_csv(request):
    """Export all orders to CSV"""
    orders = Order.objects.all().select_related('buyer')
    headers = [
        'Order ID', 'Buyer Name', 'Buyer Email', 'Buyer Phone',
        'Order Date', 'Delivery Date', 'Quantity', 'Price/Egg',
        'Total Amount', 'Status', 'Payment Status', 'Payment Method',
        'Amount Paid', 'Notes',
    ]
    rows = [
        [
            o.id, o.buyer.name, o.buyer.email, o.buyer.phone,
            o.order_date, o.delivery_date, o.quantity, o.price_per_egg,
            o.total_amount, o.status, o.payment_status, o.payment_method,
            o.amount_paid, o.notes,
        ]
        for o in orders
    ]
    filename = f'orders_{timezone.now().strftime("%Y%m%d_%H%M%S")}.csv'
    return csv_response(filename, headers, rows)


@api_view(['GET'])
@permission_classes([AllowAny])
def export_buyers_csv(request):
    """Export all buyers to CSV"""
    buyers = Buyer.objects.all()
    headers = [
        'ID', 'Name', 'Email', 'Phone',
        'Province', 'Municipality', 'Barangay', 'Purok', 'Landmark',
        'Latitude', 'Longitude', 'Active', 'Created',
    ]
    rows = [
        [
            b.id, b.name, b.email, b.phone,
            b.province, b.municipality, b.barangay, b.purok, b.landmark,
            b.latitude, b.longitude, b.is_active, b.created_at,
        ]
        for b in buyers
    ]
    filename = f'buyers_{timezone.now().strftime("%Y%m%d_%H%M%S")}.csv'
    return csv_response(filename, headers, rows)


@api_view(['GET'])
@permission_classes([AllowAny])
def export_production_csv(request):
    """Export production records to CSV"""
    records = Production.objects.all().order_by('-date')
    headers = [
        'ID', 'Date', 'Total Eggs', 'Good Eggs', 'Broken Eggs', 'Dirty Eggs',
        'Production Rate (%)', 'Recorded By', 'Notes', 'Created',
    ]
    rows = [
        [
            r.id, r.date, r.total_eggs, r.good_eggs, r.broken_eggs, r.dirty_eggs,
            round(r.production_rate, 2) if r.production_rate else 0,
            r.recorded_by.username if r.recorded_by else '',
            r.notes, r.created_at,
        ]
        for r in records
    ]
    filename = f'production_{timezone.now().strftime("%Y%m%d_%H%M%S")}.csv'
    return csv_response(filename, headers, rows)


@api_view(['GET'])
@permission_classes([AllowAny])
def export_deliveries_csv(request):
    """Export deliveries to CSV"""
    deliveries = Delivery.objects.all().select_related('order', 'order__buyer', 'delivery_staff')
    headers = [
        'Delivery ID', 'Order ID', 'Buyer', 'Address',
        'Delivery Date', 'Status', 'Staff', 'Delivered At',
        'Failure Reason', 'Notes',
    ]
    rows = [
        [
            d.id, d.order.id, d.order.buyer.name, d.order.buyer.full_address,
            d.delivery_date, d.status,
            d.delivery_staff.username if d.delivery_staff else 'Unassigned',
            d.delivered_at, d.failure_reason or '', d.notes,
        ]
        for d in deliveries
    ]
    filename = f'deliveries_{timezone.now().strftime("%Y%m%d_%H%M%S")}.csv'
    return csv_response(filename, headers, rows)


@api_view(['GET'])
@permission_classes([AllowAny])
def export_inventory_csv(request):
    """Export inventory history to CSV"""
    inventory = Inventory.objects.all().order_by('-date')
    headers = [
        'Date', 'Available', 'Reserved', 'Sold', 'Spoiled',
        'Total', 'Notes', 'Last Updated',
    ]
    rows = [
        [
            i.date, i.available_eggs, i.reserved_eggs, i.sold_eggs,
            i.spoiled_eggs, i.total_eggs, i.notes, i.updated_at,
        ]
        for i in inventory
    ]
    filename = f'inventory_{timezone.now().strftime("%Y%m%d_%H%M%S")}.csv'
    return csv_response(filename, headers, rows)


@api_view(['GET'])
@permission_classes([AllowAny])
def export_stock_logs_csv(request):
    """Export stock logs to CSV"""
    logs = StockLog.objects.all().order_by('-created_at')[:1000]
    headers = ['ID', 'Action', 'Quantity', 'Reference', 'Notes', 'Date']
    rows = [
        [l.id, l.action, l.quantity, l.reference, l.notes, l.created_at]
        for l in logs
    ]
    filename = f'stock_logs_{timezone.now().strftime("%Y%m%d_%H%M%S")}.csv'
    return csv_response(filename, headers, rows)


@api_view(['GET'])
@permission_classes([AllowAny])
def export_alerts_csv(request):
    """Export alerts to CSV"""
    alerts = Alert.objects.all().order_by('-created_at')
    headers = ['ID', 'Type', 'Severity', 'Title', 'Message', 'Is Read', 'Created']
    rows = [
        [a.id, a.alert_type, a.severity, a.title, a.message, a.is_read, a.created_at]
        for a in alerts
    ]
    filename = f'alerts_{timezone.now().strftime("%Y%m%d_%H%M%S")}.csv'
    return csv_response(filename, headers, rows)