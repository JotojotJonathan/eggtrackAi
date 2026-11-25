from rest_framework import serializers
from .models import (
    Buyer, DeliveryRating, Production, ProductionSizeCount, Order, Payment,
    Delivery, Alert, AIForecast, UserProfile, Inventory, InventoryItem,
    EggPrice, StockLog, EGGS_PER_TRAY,
)
from django.contrib.auth.models import User
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .pricing import get_order_unit_price


class BuyerSerializer(serializers.ModelSerializer):
    full_address = serializers.ReadOnlyField()
    
    class Meta:
        model = Buyer
        fields = '__all__'
        read_only_fields = ['user']


class ProductionSizeCountSerializer(serializers.ModelSerializer):
    egg_size_display = serializers.CharField(source='get_egg_size_display', read_only=True)
    grade_display = serializers.CharField(source='get_grade_display', read_only=True)

    class Meta:
        model = ProductionSizeCount
        fields = '__all__'
        read_only_fields = ['production']


class ProductionSerializer(serializers.ModelSerializer):
    production_rate = serializers.ReadOnlyField()
    recorded_by_name = serializers.CharField(source='recorded_by.username', read_only=True)
    size_counts = ProductionSizeCountSerializer(many=True, required=False)
    
    class Meta:
        model = Production
        fields = '__all__'
        extra_kwargs = {
            'recorded_by': {'required': False, 'allow_null': True},
            'total_eggs': {'required': False},
            'good_eggs': {'required': False},
        }

    def validate(self, attrs):
        if 'size_counts' not in attrs and self.instance is None:
            for field in ('total_eggs', 'good_eggs'):
                if field not in attrs:
                    raise serializers.ValidationError(
                        {field: 'This field is required.'}
                    )
        return attrs

    def validate_size_counts(self, value):
        seen = set()
        for row in value:
            key = (row.get('egg_size'), row.get('grade'))
            if key in seen:
                raise serializers.ValidationError(
                    'Duplicate egg size and grade rows are not allowed'
                )
            seen.add(key)
        return value

    def _derive_totals(self, size_counts):
        totals = {'GOOD': 0, 'DIRTY': 0, 'BROKEN': 0}
        for row in size_counts:
            grade = row.get('grade')
            totals[grade] = totals.get(grade, 0) + int(row.get('count') or 0)
        return {
            'total_eggs': sum(totals.values()),
            'good_eggs': totals.get('GOOD', 0),
            'dirty_eggs': totals.get('DIRTY', 0),
            'broken_eggs': totals.get('BROKEN', 0),
        }

    def _existing_size_counts(self, production):
        return [
            {'egg_size': row.egg_size, 'grade': row.grade, 'count': row.count}
            for row in production.size_counts.all()
        ]

    def create(self, validated_data):
        size_counts = validated_data.pop('size_counts', None)
        if size_counts is not None:
            validated_data.update(self._derive_totals(size_counts))

        production = Production.objects.create(**validated_data)

        if size_counts:
            ProductionSizeCount.objects.bulk_create([
                ProductionSizeCount(production=production, **row)
                for row in size_counts
            ])
        return production

    def update(self, instance, validated_data):
        size_counts = validated_data.pop('size_counts', None)

        if size_counts is not None:
            validated_data.update(self._derive_totals(size_counts))
        elif instance.size_counts.exists():
            validated_data.update(
                self._derive_totals(self._existing_size_counts(instance))
            )

        production = super().update(instance, validated_data)

        if size_counts is not None:
            production.size_counts.all().delete()
            if size_counts:
                ProductionSizeCount.objects.bulk_create([
                    ProductionSizeCount(production=production, **row)
                    for row in size_counts
                ])
        return production


class PaymentSummarySerializer(serializers.ModelSerializer):
    method_display = serializers.CharField(source='get_method_display', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.username', read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'order', 'amount', 'method', 'method_display', 'reference',
            'paid_at', 'recorded_by', 'recorded_by_name', 'created_at',
        ]


class PaymentSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    method_display = serializers.CharField(source='get_method_display', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.username', read_only=True)

    class Meta:
        model = Payment
        fields = '__all__'


class OrderSerializer(serializers.ModelSerializer):
    buyer_name = serializers.CharField(source='buyer.name', read_only=True)
    buyer_email = serializers.CharField(source='buyer.email', read_only=True)
    buyer_phone = serializers.CharField(source='buyer.phone', read_only=True)
    buyer_lat = serializers.FloatField(source='buyer.latitude', read_only=True)
    buyer_lng = serializers.FloatField(source='buyer.longitude', read_only=True)
    buyer_address = serializers.CharField(source='buyer.full_address', read_only=True)
    total_amount = serializers.ReadOnlyField()
    balance = serializers.ReadOnlyField()
    payments = PaymentSummarySerializer(many=True, read_only=True)
    quantity_trays = serializers.SerializerMethodField()
    egg_size_display = serializers.CharField(source='get_egg_size_display', read_only=True)
    egg_type_display = serializers.CharField(source='get_egg_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_status_display = serializers.CharField(source='get_payment_status_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)

    class Meta:
        model = Order
        fields = '__all__'
        read_only_fields = ['order_number', 'quantity_eggs']

    def validate(self, attrs):
        price_fields = ('egg_size', 'egg_type', 'is_tray')
        if self.instance is None or any(field in attrs for field in price_fields):
            egg_size = attrs.get('egg_size', getattr(self.instance, 'egg_size', 'MEDIUM'))
            egg_type = attrs.get('egg_type', getattr(self.instance, 'egg_type', 'GOOD'))
            is_tray = attrs.get('is_tray', getattr(self.instance, 'is_tray', False))
            attrs['price_per_egg'] = get_order_unit_price(
                egg_size, egg_type, is_tray=is_tray
            )
        return attrs

    def get_quantity_trays(self, obj):
        if not EGGS_PER_TRAY:
            return 0
        return round((obj.quantity_eggs or 0) / EGGS_PER_TRAY, 2)


class DeliverySerializer(serializers.ModelSerializer):
    order_buyer = serializers.CharField(
        source='order.buyer.name',
        read_only=True
    )
    staff_name = serializers.CharField(
        source='delivery_staff.username',
        read_only=True
    )

    class Meta:
        model = Delivery
        fields = '__all__'


class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = '__all__'


class AIForecastSerializer(serializers.ModelSerializer):
    accuracy = serializers.ReadOnlyField()

    class Meta:
        model = AIForecast
        fields = '__all__'


class InventoryItemSerializer(serializers.ModelSerializer):
    egg_size_display = serializers.CharField(source='get_egg_size_display', read_only=True)
    grade_display = serializers.CharField(source='get_grade_display', read_only=True)
    total_eggs = serializers.SerializerMethodField()

    class Meta:
        model = InventoryItem
        fields = '__all__'

    def get_total_eggs(self, obj):
        return (
            (obj.available_eggs or 0)
            + (obj.reserved_eggs or 0)
            + (obj.sold_eggs or 0)
            + (obj.spoiled_eggs or 0)
        )


class InventorySerializer(serializers.ModelSerializer):
    items = InventoryItemSerializer(many=True, read_only=True)
    total_eggs = serializers.ReadOnlyField()

    class Meta:
        model = Inventory
        fields = '__all__'


class EggPriceSerializer(serializers.ModelSerializer):
    egg_size_display = serializers.CharField(source='get_egg_size_display', read_only=True)

    class Meta:
        model = EggPrice
        fields = '__all__'


class StockLogSerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    egg_size_display = serializers.CharField(source='get_egg_size_display', read_only=True)
    grade_display = serializers.CharField(source='get_grade_display', read_only=True)
    inventory_date = serializers.DateField(source='inventory.date', read_only=True)

    class Meta:
        model = StockLog
        fields = '__all__'


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name'
        ]


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Add custom claims
        token['username'] = user.username
        token['role'] = (
            user.profile.role
            if hasattr(user, 'profile')
            else 'WORKER'
        )

        return token

    def validate(self, attrs):
        data = super().validate(attrs)

        # Add user info to response
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'role': (
                self.user.profile.role
                if hasattr(self.user, 'profile')
                else 'WORKER'
            ),
        }


        return data

class DeliverySerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    order_buyer = serializers.CharField(source='order.buyer.name', read_only=True)
    order_address = serializers.CharField(source='order.buyer.full_address', read_only=True)
    order_phone = serializers.CharField(source='order.buyer.phone', read_only=True)
    order_quantity = serializers.IntegerField(source='order.quantity', read_only=True)
    order_quantity_eggs = serializers.IntegerField(source='order.quantity_eggs', read_only=True)
    order_egg_size = serializers.CharField(source='order.egg_size', read_only=True)
    order_egg_type = serializers.CharField(source='order.egg_type', read_only=True)
    buyer_lat = serializers.FloatField(source='order.buyer.latitude', read_only=True)
    buyer_lng = serializers.FloatField(source='order.buyer.longitude', read_only=True)
    staff_name = serializers.CharField(source='delivery_staff.username', read_only=True)

    class Meta:
        model = Delivery
        fields = '__all__'
        extra_kwargs = {
            'delivery_staff': {'required': False, 'allow_null': True},
        }

class DeliveryRatingSerializer(serializers.ModelSerializer):
    buyer_name = serializers.CharField(source='buyer.name', read_only=True)
    order_id = serializers.IntegerField(source='delivery.order.id', read_only=True)
    
    class Meta:
        model = DeliveryRating
        fields = '__all__'        