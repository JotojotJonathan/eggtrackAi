from django.contrib import admin
from django.utils.html import format_html
from django.db.models import Sum, Count
from .models import (
    Buyer, Production, Order, Delivery, Alert, AIForecast,
    UserProfile, Inventory, StockLog, Notification, DeliveryRating,
    ProductionSizeCount, InventoryItem, EggPrice, Payment,
)


# ============================================================
# ADMIN SITE CUSTOMIZATION
# ============================================================

admin.site.site_header = "🥚 EggTrack AI Admin"
admin.site.site_title = "EggTrack AI"
admin.site.index_title = "System Administration"


# ============================================================
# BUYER
# ============================================================

@admin.register(Buyer)
class BuyerAdmin(admin.ModelAdmin):
    list_display = ['name', 'email', 'phone', 'municipality', 'is_active', 'order_count', 'created_at']
    search_fields = ['name', 'email', 'phone', 'barangay', 'municipality']
    list_filter = ['is_active', 'province', 'municipality']
    readonly_fields = ['created_at', 'updated_at', 'latitude', 'longitude']
    fieldsets = (
        ('Basic Info', {
            'fields': ('name', 'email', 'phone', 'is_active')
        }),
        ('Address', {
            'fields': ('province', 'municipality', 'barangay', 'purok', 'landmark')
        }),
        ('GPS', {
            'fields': ('latitude', 'longitude'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def order_count(self, obj):
        count = obj.orders.count()
        return format_html('<b style="color:#22c55e">{}</b>', count)
    order_count.short_description = 'Orders'


# ============================================================
# PRODUCTION
# ============================================================

@admin.register(Production)
class ProductionAdmin(admin.ModelAdmin):
    list_display = ['date', 'batch_name', 'total_eggs', 'good_eggs', 'broken_eggs', 'dirty_eggs', 'production_rate_display', 'recorded_by']
    list_filter = ['date', 'batch_name']
    search_fields = ['batch_name', 'notes']
    date_hierarchy = 'date'
    readonly_fields = ['created_at', 'updated_at']
    
    def production_rate_display(self, obj):
        rate = obj.production_rate
        color = '#22c55e' if rate >= 90 else '#eab308' if rate >= 70 else '#ef4444'
        return format_html('<b style="color:{}">{:.1f}%</b>', color, rate)
    production_rate_display.short_description = 'Good Rate'


@admin.register(ProductionSizeCount)
class ProductionSizeCountAdmin(admin.ModelAdmin):
    list_display = ['production', 'egg_size', 'grade', 'count']
    list_filter = ['egg_size', 'grade']
    search_fields = ['production__batch_name']


# ============================================================
# ORDER
# ============================================================

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['id', 'buyer', 'order_date', 'delivery_date', 'quantity', 'total_amount', 'status_colored', 'payment_status_colored']
    list_filter = ['status', 'payment_status', 'payment_method', 'order_date']
    search_fields = ['buyer__name', 'buyer__email', 'id']
    date_hierarchy = 'order_date'
    readonly_fields = ['created_at', 'updated_at']
    
    def status_colored(self, obj):
        colors = {
            'PENDING': '#eab308',
            'APPROVED': '#3b82f6',
            'IN_DELIVERY': '#8b5cf6',
            'COMPLETED': '#22c55e',
            'CANCELLED': '#ef4444',
        }
        return format_html(
            '<span style="background:{};color:white;padding:3px 8px;border-radius:4px;font-size:11px">{}</span>',
            colors.get(obj.status, '#6b7280'),
            obj.status,
        )
    status_colored.short_description = 'Status'
    
    def payment_status_colored(self, obj):
        colors = {'UNPAID': '#ef4444', 'PARTIAL': '#eab308', 'PAID': '#22c55e'}
        return format_html(
            '<span style="background:{};color:white;padding:3px 8px;border-radius:4px;font-size:11px">{}</span>',
            colors.get(obj.payment_status, '#6b7280'),
            obj.payment_status,
        )
    payment_status_colored.short_description = 'Payment'


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['order', 'amount', 'method', 'reference', 'paid_at', 'recorded_by']
    list_filter = ['method', 'paid_at']
    search_fields = ['order__order_number', 'reference']
    date_hierarchy = 'paid_at'


# ============================================================
# DELIVERY
# ============================================================

@admin.register(Delivery)
class DeliveryAdmin(admin.ModelAdmin):
    list_display = ['id', 'order', 'delivery_staff', 'delivery_date', 'status', 'has_proof']
    list_filter = ['status', 'delivery_date']
    search_fields = ['order__buyer__name', 'delivery_staff__username']
    readonly_fields = ['created_at', 'updated_at', 'signature_preview', 'photo_preview']
    
    def has_proof(self, obj):
        if obj.photo_proof:
            return format_html('✅')
        return format_html('❌')
    has_proof.short_description = 'Proof'
    
    def signature_preview(self, obj):
        """Display base64 signature image in admin"""
        if obj.signature_data:
            return format_html(
                '<img src="{}" style="max-width: 300px; border: 1px solid #ccc; background: #fff;" />',
                obj.signature_data
            )
        return "No signature"
    signature_preview.short_description = 'Signature'
    
    def photo_preview(self, obj):
        """Display photo proof in admin"""
        if obj.photo_proof:
            return format_html(
                '<img src="{}" style="max-width: 300px; border: 1px solid #ccc;" />',
                obj.photo_proof.url
            )
        return "No photo"
    photo_preview.short_description = 'Photo Proof'


# ============================================================
# ALERT
# ============================================================

@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ['alert_type', 'severity', 'title', 'is_read', 'created_at']
    list_filter = ['alert_type', 'severity', 'is_read', 'created_at']
    search_fields = ['title', 'message']
    date_hierarchy = 'created_at'


# ============================================================
# AI FORECAST
# ============================================================

@admin.register(AIForecast)
class AIForecastAdmin(admin.ModelAdmin):
    list_display = ['forecasted_date', 'forecasted_eggs', 'confidence_score', 'actual_eggs', 'accuracy_display', 'model_used']
    list_filter = ['forecasted_date', 'model_used']
    date_hierarchy = 'forecasted_date'
    
    def accuracy_display(self, obj):
        acc = obj.accuracy
        if acc is None:
            return '—'
        color = '#22c55e' if acc >= 90 else '#eab308' if acc >= 70 else '#ef4444'
        return format_html('<b style="color:{}">{:.1f}%</b>', color, acc)
    accuracy_display.short_description = 'Accuracy'


# ============================================================
# USER PROFILE
# ============================================================

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'role', 'phone']
    list_filter = ['role']
    search_fields = ['user__username', 'user__email']


# ============================================================
# INVENTORY
# ============================================================

@admin.register(Inventory)
class InventoryAdmin(admin.ModelAdmin):
    list_display = ['date', 'available_eggs', 'reserved_eggs', 'sold_eggs', 'spoiled_eggs', 'total_display', 'updated_at']
    list_filter = ['date']
    date_hierarchy = 'date'
    readonly_fields = ['updated_at']
    
    def total_display(self, obj):
        return format_html('<b>{}</b>', obj.total_eggs)
    total_display.short_description = 'Total'


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ['inventory', 'egg_size', 'grade', 'available_eggs', 'reserved_eggs', 'sold_eggs', 'spoiled_eggs']
    list_filter = ['egg_size', 'grade']
    search_fields = ['inventory__date']


@admin.register(EggPrice)
class EggPriceAdmin(admin.ModelAdmin):
    list_display = ['egg_size', 'price_per_egg', 'is_active', 'updated_by', 'updated_at']
    list_filter = ['is_active']
    list_editable = ['price_per_egg', 'is_active']


# ============================================================
# STOCK LOG
# ============================================================

@admin.register(StockLog)
class StockLogAdmin(admin.ModelAdmin):
    list_display = ['action_colored', 'quantity_colored', 'reference', 'created_at']
    list_filter = ['action', 'created_at']
    date_hierarchy = 'created_at'
    search_fields = ['reference', 'notes']
    
    def action_colored(self, obj):
        colors = {
            'PRODUCTION': '#22c55e',
            'ORDER_RESERVED': '#eab308',
            'ORDER_CANCELLED': '#ef4444',
            'DELIVERED': '#3b82f6',
            'SPOILED': '#6b7280',
            'ADJUSTMENT': '#8b5cf6',
        }
        return format_html(
            '<span style="background:{};color:white;padding:3px 8px;border-radius:4px;font-size:11px">{}</span>',
            colors.get(obj.action, '#6b7280'),
            obj.action,
        )
    action_colored.short_description = 'Action'
    
    def quantity_colored(self, obj):
        color = '#22c55e' if obj.quantity > 0 else '#ef4444'
        sign = '+' if obj.quantity > 0 else ''
        return format_html('<b style="color:{}">{}{}</b>', color, sign, obj.quantity)
    quantity_colored.short_description = 'Qty'


# ============================================================
# NOTIFICATION
# ============================================================

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['user', 'notification_type', 'title', 'is_read', 'created_at']
    list_filter = ['notification_type', 'is_read', 'created_at']
    search_fields = ['user__username', 'title', 'message']
    date_hierarchy = 'created_at'


# ============================================================
# DELIVERY RATING
# ============================================================

@admin.register(DeliveryRating)
class DeliveryRatingAdmin(admin.ModelAdmin):
    list_display = ['delivery', 'buyer', 'stars_display', 'created_at']
    list_filter = ['rating', 'created_at']
    search_fields = ['buyer__name', 'comment']
    date_hierarchy = 'created_at'
    
    def stars_display(self, obj):
        stars = '★' * obj.rating + '☆' * (5 - obj.rating)
        return format_html('<span style="color:#eab308;font-size:16px">{}</span>', stars)
    stars_display.short_description = 'Rating'