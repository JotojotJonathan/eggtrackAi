from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from decimal import Decimal
import random
import string


EGGS_PER_TRAY = 30

EGG_SIZE_CHOICES = [
    ('PEEWEE', 'Peewee'),
    ('SMALL', 'Small'),
    ('MEDIUM', 'Medium'),
    ('LARGE', 'Large'),
    ('XL', 'Extra Large'),
    ('JUMBO', 'Jumbo'),
]

EGG_GRADE_CHOICES = [
    ('GOOD', 'Good Egg'),
    ('DIRTY', 'Dirty Egg'),
    ('BROKEN', 'Broken Egg'),
]


# ============================================================
# ORDER NUMBER GENERATOR
# ============================================================

def generate_order_number():
    """Generate a professional order number: EGG-YYYY-XXXX"""
    from datetime import datetime
    from django.db import transaction
    
    year = datetime.now().year
    prefix = f'EGG-{year}-'
    
    # Use transaction to prevent race conditions
    with transaction.atomic():
        # Get all order numbers for this year, sorted
        existing = Order.objects.filter(
            order_number__startswith=prefix
        ).select_for_update().order_by('-order_number')
        
        max_num = 0
        for o in existing:
            if o.order_number:
                try:
                    num = int(o.order_number.split('-')[-1])
                    if num > max_num:
                        max_num = num
                except (ValueError, IndexError):
                    continue
        
        new_num = max_num + 1
        return f'EGG-{year}-{new_num:04d}'


# Create your models here.

class Buyer(models.Model):
    """Model for egg buyers/customers with structured address"""
    name = models.CharField(max_length=200)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20)
    user = models.OneToOneField(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='buyer_profile',
    )
    
    # Structured address
    address = models.TextField(blank=True)  # OLD field - keep for backward compatibility
    province = models.CharField(max_length=100, blank=True)
    municipality = models.CharField(max_length=100, blank=True)  # City/Municipality
    barangay = models.CharField(max_length=100, blank=True)
    purok = models.CharField(max_length=100, blank=True)  # Purok/Street/Subdivision
    landmark = models.CharField(max_length=200, blank=True)  # Additional landmark
    
    # GPS coordinates (auto-filled via geocoding)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.name
    
    @property
    def full_address(self):
        """Build full address string for geocoding/display"""
        parts = []
        if self.purok:
            parts.append(self.purok)
        if self.barangay:
            parts.append(f"Barangay {self.barangay}")
        if self.municipality:
            parts.append(self.municipality)
        if self.province:
            parts.append(self.province)
        parts.append("Philippines")
        return ", ".join(parts)
    
    class Meta:
        ordering = ['name']


class Production(models.Model):
    """Model for daily egg production records per batch/hen house"""
    date = models.DateField()
    batch_name = models.CharField(max_length=100, blank=True, default='Main Batch')  # NEW
    total_eggs = models.IntegerField()
    good_eggs = models.IntegerField()
    broken_eggs = models.IntegerField(default=0)
    dirty_eggs = models.IntegerField(default=0)
    recorded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    man_hours = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.date} - {self.batch_name} - {self.total_eggs} eggs"
    
    class Meta:
        ordering = ['-date', 'batch_name']
        verbose_name_plural = "Production"
        # Allow multiple batches per date
        unique_together = []  # Removed unique constraint
    
    @property
    def production_rate(self):
        if self.total_eggs > 0:
            return (self.good_eggs / self.total_eggs) * 100
        return 0


class ProductionSizeCount(models.Model):
    """Per-size and per-grade egg counts for a production record"""
    production = models.ForeignKey(
        Production,
        on_delete=models.CASCADE,
        related_name='size_counts',
    )
    egg_size = models.CharField(max_length=20, choices=EGG_SIZE_CHOICES)
    grade = models.CharField(max_length=10, choices=EGG_GRADE_CHOICES)
    count = models.PositiveIntegerField(default=0)
    
    def __str__(self):
        return f"{self.production_id} - {self.egg_size} {self.grade}: {self.count}"
    
    class Meta:
        ordering = ['egg_size', 'grade']
        unique_together = [('production', 'egg_size', 'grade')]


class Order(models.Model):
    """Model for buyer orders with payment tracking"""
    ORDER_STATUS = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('IN_DELIVERY', 'In Delivery'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    PAYMENT_STATUS = [
        ('UNPAID', 'Unpaid'),
        ('PARTIAL', 'Partial'),
        ('PAID', 'Paid'),
    ]
    
    PAYMENT_METHODS = [
        ('COD', 'Cash on Delivery'),
        ('GCASH', 'GCash'),
        ('BANK', 'Bank Transfer'),
        ('MAYA', 'Maya'),
    ]
    
    EGG_SIZES = [
        ('PEEWEE', 'Peewee'),
        ('SMALL', 'Small'),
        ('MEDIUM', 'Medium'),
        ('LARGE', 'Large'),
        ('XL', 'Extra Large'),
        ('JUMBO', 'Jumbo'),
    ]
    
    EGG_TYPES = [
        ('GOOD', 'Good Egg'),
        ('DIRTY', 'Dirty Egg'),
    ]
    
    order_number = models.CharField(max_length=30, unique=True, blank=True, null=True)
    buyer = models.ForeignKey(Buyer, on_delete=models.CASCADE, related_name='orders')
    order_date = models.DateField(auto_now_add=True)
    delivery_date = models.DateField()
    
    # NEW — Egg details
    egg_size = models.CharField(max_length=20, choices=EGG_SIZES, default='MEDIUM')
    egg_type = models.CharField(max_length=10, choices=EGG_TYPES, default='GOOD')
    is_tray = models.BooleanField(default=False)  # NEW — order by tray or per piece
    
    quantity = models.IntegerField()  # Number of eggs OR trays
    quantity_eggs = models.PositiveIntegerField(default=0)  # Canonical egg quantity
    price_per_egg = models.DecimalField(max_digits=10, decimal_places=2, default=6.00)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=ORDER_STATUS, default='PENDING')
    
    # NEW - Payment fields
    payment_status = models.CharField(max_length=10, choices=PAYMENT_STATUS, default='UNPAID')
    payment_method = models.CharField(max_length=10, choices=PAYMENT_METHODS, default='COD')
    payment_reference = models.CharField(max_length=100, blank=True)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.order_number or f'Order #{self.id}'} - {self.buyer.name}"
    
    class Meta:
        ordering = ['-order_date']
    
    def save(self, *args, **kwargs):
        # Auto-calculate total amount
        self.total_amount = self.quantity * self.price_per_egg
        # Canonical egg quantity for inventory (trays -> eggs)
        self.quantity_eggs = (
            self.quantity * EGGS_PER_TRAY if self.is_tray else self.quantity
        )
        # Auto-generate order number on first save
        if not self.order_number:
            self.order_number = generate_order_number()
        super().save(*args, **kwargs)
    
    @property
    def balance(self):
        """Remaining balance to be paid"""
        return self.total_amount - self.amount_paid


class Payment(models.Model):
    """Partial or full payment recorded against an order"""
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='payments',
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=10, choices=Order.PAYMENT_METHODS, default='COD')
    reference = models.CharField(max_length=100, blank=True)
    proof_data = models.TextField(blank=True)
    proof_text = models.TextField(blank=True)
    paid_at = models.DateTimeField(default=timezone.now)
    recorded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recorded_payments',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Payment for Order #{self.order_id}: {self.amount}"
    
    class Meta:
        ordering = ['-paid_at']


class Delivery(models.Model):
    DELIVERY_STATUS = [
        ('PENDING', 'Pending'),
        ('IN_TRANSIT', 'In Transit'),
        ('DELIVERED', 'Delivered'),
        ('FAILED', 'Failed'),
    ]
    
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='deliveries')
    delivery_staff = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='deliveries')
    delivery_date = models.DateTimeField()
    status = models.CharField(max_length=20, choices=DELIVERY_STATUS, default='PENDING')
    photo_proof = models.ImageField(upload_to='delivery_proofs/', blank=True, null=True)
    signature = models.ImageField(upload_to='signatures/', blank=True, null=True)
    signature_data = models.TextField(blank=True, null=True)  # NEW - base64 signature
    failure_reason = models.TextField(blank=True, null=True)  # NEW
    notes = models.TextField(blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Delivery for Order #{self.order.id} - {self.status}"
    
    class Meta:
        ordering = ['-delivery_date']
        verbose_name_plural = "Deliveries"
    
    def mark_as_delivered(self):
        self.status = 'DELIVERED'
        self.delivered_at = timezone.now()
        self.save()
        self.order.status = 'COMPLETED'
        self.order.save()
    
    def mark_as_failed(self, reason=''):
        self.status = 'FAILED'
        self.failure_reason = reason
        self.save()


class Alert(models.Model):
    """Model for system alerts (anomaly detection, overcommitment warnings)"""
    ALERT_TYPES = [
        ('ANOMALY', 'Production Anomaly'),
        ('OVERCOMMITMENT', 'Order Overcommitment'),
        ('FORECAST', 'Forecast Update'),
        ('SYSTEM', 'System Alert'),
    ]
    
    SEVERITY = [
        ('INFO', 'Information'),
        ('WARNING', 'Warning'),
        ('CRITICAL', 'Critical'),
    ]
    
    alert_type = models.CharField(max_length=20, choices=ALERT_TYPES)
    severity = models.CharField(max_length=10, choices=SEVERITY, default='WARNING')
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    related_production = models.ForeignKey(Production, on_delete=models.SET_NULL, null=True, blank=True)
    related_order = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.get_alert_type_display()}: {self.title}"
    
    class Meta:
        ordering = ['-created_at']


class AIForecast(models.Model):
    """Model to store AI production forecasts"""
    production = models.ForeignKey(Production, on_delete=models.CASCADE, related_name='forecasts')
    forecasted_date = models.DateField()
    forecasted_eggs = models.IntegerField()
    confidence_score = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)  # 0.00 - 1.00
    actual_eggs = models.IntegerField(null=True, blank=True)  # Filled after actual production
    model_used = models.CharField(max_length=100, default='LSTM')
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Forecast for {self.forecasted_date}: {self.forecasted_eggs} eggs"
    
    class Meta:
        ordering = ['-forecasted_date']
    
    @property
    def accuracy(self):
        """Calculate forecast accuracy if actual data is available"""
        if self.actual_eggs and self.actual_eggs > 0:
            diff = abs(self.forecasted_eggs - self.actual_eggs)
            return max(0, 100 - (diff / self.actual_eggs * 100))
        return None


class UserProfile(models.Model):
    """Extended user profile with role"""
    ROLE_CHOICES = [
        ('ADMIN', 'Admin'),
        ('WORKER', 'Farm Worker'),
        ('BUYER', 'Buyer'),
        ('DELIVERY', 'Delivery Staff'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='WORKER')
    phone = models.CharField(max_length=20, blank=True)
    
    def __str__(self):
        return f"{self.user.username} - {self.get_role_display()}"


# ============================================================
# INVENTORY & STOCK LOG
# ============================================================

class Inventory(models.Model):
    """
    Track current egg inventory.
    Auto-updated on production, order approval, and delivery.
    """
    date = models.DateField(unique=True)
    available_eggs = models.IntegerField(default=0)   # Eggs available for sale
    reserved_eggs = models.IntegerField(default=0)    # Reserved for approved orders
    sold_eggs = models.IntegerField(default=0)        # Sold/delivered
    spoiled_eggs = models.IntegerField(default=0)     # Discarded
    notes = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.date}: {self.available_eggs} available"
    
    class Meta:
        ordering = ['-date']
        verbose_name_plural = "Inventories"
    
    @property
    def total_eggs(self):
        return self.available_eggs + self.reserved_eggs + self.sold_eggs + self.spoiled_eggs


class InventoryItem(models.Model):
    """Per-size and per-grade stock levels for a daily inventory record"""
    inventory = models.ForeignKey(
        Inventory,
        on_delete=models.CASCADE,
        related_name='items',
    )
    egg_size = models.CharField(max_length=20, choices=EGG_SIZE_CHOICES)
    grade = models.CharField(max_length=10, choices=EGG_GRADE_CHOICES)
    available_eggs = models.PositiveIntegerField(default=0)
    reserved_eggs = models.PositiveIntegerField(default=0)
    sold_eggs = models.PositiveIntegerField(default=0)
    spoiled_eggs = models.PositiveIntegerField(default=0)
    
    def __str__(self):
        return f"{self.inventory.date} - {self.egg_size} {self.grade}: {self.available_eggs} available"
    
    class Meta:
        ordering = ['egg_size', 'grade']
        unique_together = [('inventory', 'egg_size', 'grade')]


class EggPrice(models.Model):
    """Admin-managed price per egg size (grade does not affect price yet)"""
    egg_size = models.CharField(max_length=20, choices=EGG_SIZE_CHOICES, unique=True)
    price_per_egg = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_egg_prices',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.egg_size}: {self.price_per_egg}"
    
    class Meta:
        ordering = ['egg_size']


class StockLog(models.Model):
    """Audit log for all inventory changes"""
    ACTION_CHOICES = [
        ('PRODUCTION', 'Production Added'),
        ('ORDER_RESERVED', 'Order Reserved'),
        ('ORDER_CANCELLED', 'Order Cancelled'),
        ('DELIVERED', 'Delivered'),
        ('SPOILED', 'Spoiled'),
        ('ADJUSTMENT', 'Manual Adjustment'),
    ]
    
    inventory = models.ForeignKey(Inventory, on_delete=models.CASCADE, related_name='logs')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    quantity = models.IntegerField()
    egg_size = models.CharField(max_length=20, choices=EGG_SIZE_CHOICES, blank=True, null=True)
    grade = models.CharField(max_length=10, choices=EGG_GRADE_CHOICES, blank=True, null=True)
    reference = models.CharField(max_length=100, blank=True)  # e.g., "Order #5"
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.action} ({self.quantity}) - {self.created_at}"
    
    class Meta:
        ordering = ['-created_at']


# ============================================================
# NOTIFICATIONS
# ============================================================

class Notification(models.Model):
    """In-app notifications for users"""
    NOTIF_TYPES = [
        ('ORDER_PLACED', 'New Order Placed'),
        ('ORDER_APPROVED', 'Order Approved'),
        ('ORDER_REJECTED', 'Order Rejected'),
        ('ORDER_DELIVERED', 'Order Delivered'),
        ('DELIVERY_ASSIGNED', 'Delivery Assigned'),
        ('ANOMALY', 'Production Anomaly'),
        ('OVERCOMMITMENT', 'Order Overcommitment'),
        ('LOW_STOCK', 'Low Stock Alert'),
        ('SYSTEM', 'System'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=30, choices=NOTIF_TYPES)
    title = models.CharField(max_length=200)
    message = models.TextField()
    link = models.CharField(max_length=200, blank=True)  # Frontend route
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.user.username}: {self.title}"
    
    class Meta:
        ordering = ['-created_at']


# ============================================================
# DELIVERY RATING
# ============================================================

class DeliveryRating(models.Model):
    """Buyer rating for a completed delivery"""
    delivery = models.OneToOneField(Delivery, on_delete=models.CASCADE, related_name='rating')
    buyer = models.ForeignKey(Buyer, on_delete=models.CASCADE, related_name='ratings')
    rating = models.IntegerField()  # 1-5 stars
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Order #{self.delivery.order.id} - {self.rating}★"
    
    class Meta:
        ordering = ['-created_at']