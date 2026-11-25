"""
Inventory service — manages egg stock automatically.
Called from Production, Order, and Delivery views.
"""
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .models import EGGS_PER_TRAY, Inventory, InventoryItem, StockLog


def get_or_create_today_inventory():
    """Get or create today's inventory record"""
    today = timezone.now().date()
    inventory, created = Inventory.objects.get_or_create(date=today)
    return inventory


def get_order_quantity_eggs(order):
    """Return the order quantity in eggs (trays are converted to eggs)"""
    quantity_eggs = getattr(order, 'quantity_eggs', 0) or 0
    if quantity_eggs:
        return int(quantity_eggs)
    quantity = getattr(order, 'quantity', 0) or 0
    if getattr(order, 'is_tray', False):
        return int(quantity) * EGGS_PER_TRAY
    return int(quantity)


def get_or_create_inventory_item(inventory, egg_size, grade):
    """Get or create a per-size/per-grade inventory row"""
    item, created = InventoryItem.objects.get_or_create(
        inventory=inventory,
        egg_size=egg_size,
        grade=grade,
    )
    return item


def _apply_item_updates(item, inventory, updates):
    """Apply matching egg deltas to an inventory item and its daily inventory"""
    for field, delta in updates.items():
        setattr(item, field, getattr(item, field) + delta)
    item.save(update_fields=list(updates.keys()))
    for field, delta in updates.items():
        setattr(inventory, field, getattr(inventory, field) + delta)
    inventory.save()


def get_production_contribution(production):
    """Return a production's egg contribution keyed by (size, grade)"""
    rows = list(production.size_counts.all())
    contribution = {}

    if rows:
        for row in rows:
            count = int(row.count or 0)
            if count <= 0:
                continue
            key = (row.egg_size, row.grade)
            contribution[key] = contribution.get(key, 0) + count
        return contribution

    for grade, quantity in (
        ('GOOD', production.good_eggs),
        ('DIRTY', production.dirty_eggs),
        ('BROKEN', production.broken_eggs),
    ):
        quantity = int(quantity or 0)
        if quantity > 0:
            contribution[(None, grade)] = quantity
    return contribution


def _get_inventory_for_date(date):
    inventory, _ = Inventory.objects.get_or_create(date=date)
    return inventory


def _apply_contribution_delta(date, egg_size, grade, delta, production, action):
    """Apply a single production contribution delta to a date's inventory"""
    if not delta:
        return

    inventory = _get_inventory_for_date(date)
    field = 'spoiled_eggs' if grade == 'BROKEN' else 'available_eggs'

    if egg_size:
        item = get_or_create_inventory_item(inventory, egg_size, grade)
        if getattr(item, field) + delta < 0:
            raise ValueError(
                f'Cannot reduce {egg_size} {grade} inventory below zero'
            )
        _apply_item_updates(item, inventory, {field: delta})
        note = f'{action.title()} {delta} {grade.lower()} {egg_size} eggs'
    else:
        if getattr(inventory, field) + delta < 0:
            raise ValueError(f'Cannot reduce {grade} inventory below zero')
        setattr(inventory, field, getattr(inventory, field) + delta)
        inventory.save()
        note = f'{action.title()} {delta} {grade.lower()} eggs'

    StockLog.objects.create(
        inventory=inventory,
        action=action,
        quantity=delta,
        egg_size=egg_size,
        grade=grade,
        reference=f'Production #{production.id}',
        notes=note,
    )


def sync_production_inventory(production, old_contribution=None, old_date=None):
    """Sync inventory with a production's current and previous contribution"""
    old_contribution = old_contribution or {}
    new_contribution = get_production_contribution(production)
    old_date = old_date or production.date
    new_date = production.date
    action = 'PRODUCTION' if not old_contribution else 'ADJUSTMENT'

    with transaction.atomic():
        if old_date == new_date:
            keys = set(old_contribution) | set(new_contribution)
            for egg_size, grade in keys:
                delta = (
                    new_contribution.get((egg_size, grade), 0)
                    - old_contribution.get((egg_size, grade), 0)
                )
                _apply_contribution_delta(
                    new_date, egg_size, grade, delta, production, action
                )
        else:
            for (egg_size, grade), count in old_contribution.items():
                _apply_contribution_delta(
                    old_date, egg_size, grade, -count, production, 'ADJUSTMENT'
                )
            for (egg_size, grade), count in new_contribution.items():
                _apply_contribution_delta(
                    new_date, egg_size, grade, count, production, action
                )
    return production


def remove_production_from_inventory(production):
    """Remove a production's contribution from inventory"""
    contribution = get_production_contribution(production)

    with transaction.atomic():
        for (egg_size, grade), count in contribution.items():
            _apply_contribution_delta(
                production.date, egg_size, grade, -count, production, 'ADJUSTMENT'
            )
    return production


def add_production_to_inventory(production):
    """Add production eggs to inventory by size and grade"""
    return sync_production_inventory(production)


def reserve_eggs_for_order(order):
    """Reserve eggs when an order is approved"""
    quantity_eggs = get_order_quantity_eggs(order)
    if quantity_eggs <= 0:
        return False

    egg_size = order.egg_size
    grade = order.egg_type

    with transaction.atomic():
        items = list(
            InventoryItem.objects.select_for_update()
            .filter(egg_size=egg_size, grade=grade, available_eggs__gt=0)
            .select_related('inventory')
            .order_by('inventory__date', 'id')
        )

        if sum(item.available_eggs for item in items) < quantity_eggs:
            return False

        remaining = quantity_eggs
        for item in items:
            if remaining <= 0:
                break
            take = min(item.available_eggs, remaining)
            _apply_item_updates(
                item,
                item.inventory,
                {'available_eggs': -take, 'reserved_eggs': take},
            )
            StockLog.objects.create(
                inventory=item.inventory,
                action='ORDER_RESERVED',
                quantity=-take,
                egg_size=egg_size,
                grade=grade,
                reference=f'Order #{order.id}',
                notes=f'Reserved {take} {grade.lower()} {egg_size} eggs for order',
            )
            remaining -= take

        return remaining == 0


def release_reserved_eggs(order):
    """Release reserved eggs when an order is cancelled"""
    quantity_eggs = get_order_quantity_eggs(order)
    if quantity_eggs <= 0:
        return get_or_create_today_inventory()

    egg_size = order.egg_size
    grade = order.egg_type
    last_inventory = None

    with transaction.atomic():
        items = list(
            InventoryItem.objects.select_for_update()
            .filter(egg_size=egg_size, grade=grade, reserved_eggs__gt=0)
            .select_related('inventory')
            .order_by('inventory__date', 'id')
        )

        remaining = quantity_eggs
        for item in items:
            if remaining <= 0:
                break
            take = min(item.reserved_eggs, remaining)
            _apply_item_updates(
                item,
                item.inventory,
                {'reserved_eggs': -take, 'available_eggs': take},
            )
            StockLog.objects.create(
                inventory=item.inventory,
                action='ORDER_CANCELLED',
                quantity=take,
                egg_size=egg_size,
                grade=grade,
                reference=f'Order #{order.id}',
                notes=f'Released {take} {grade.lower()} {egg_size} eggs back to inventory',
            )
            last_inventory = item.inventory
            remaining -= take

    return last_inventory or get_or_create_today_inventory()


def mark_as_delivered(order):
    """Move reserved eggs to sold when delivered"""
    quantity_eggs = get_order_quantity_eggs(order)
    if quantity_eggs <= 0:
        return get_or_create_today_inventory()

    egg_size = order.egg_size
    grade = order.egg_type
    last_inventory = None

    with transaction.atomic():
        items = list(
            InventoryItem.objects.select_for_update()
            .filter(egg_size=egg_size, grade=grade, reserved_eggs__gt=0)
            .select_related('inventory')
            .order_by('inventory__date', 'id')
        )

        remaining = quantity_eggs
        for item in items:
            if remaining <= 0:
                break
            take = min(item.reserved_eggs, remaining)
            _apply_item_updates(
                item,
                item.inventory,
                {'reserved_eggs': -take, 'sold_eggs': take},
            )
            StockLog.objects.create(
                inventory=item.inventory,
                action='DELIVERED',
                quantity=take,
                egg_size=egg_size,
                grade=grade,
                reference=f'Order #{order.id}',
                notes=f'Delivered {take} {grade.lower()} {egg_size} eggs',
            )
            last_inventory = item.inventory
            remaining -= take

    return last_inventory or get_or_create_today_inventory()


def get_available_eggs(egg_size, grade='GOOD'):
    """Total available eggs for a size and grade across all inventories"""
    total = InventoryItem.objects.filter(
        egg_size=egg_size,
        grade=grade,
    ).aggregate(total=Sum('available_eggs'))['total']
    return total or 0


def get_available_trays(egg_size, grade='GOOD'):
    """Available trays for a size and grade (30 eggs per tray)"""
    return round(get_available_eggs(egg_size, grade) / EGGS_PER_TRAY, 2)


def validate_order_stock(egg_size, egg_type, quantity_eggs):
    """Soft stock validation used before creating an order"""
    requested = int(quantity_eggs or 0)
    available = get_available_eggs(egg_size, egg_type)
    return {
        'egg_size': egg_size,
        'grade': egg_type,
        'requested_eggs': requested,
        'available_eggs': available,
        'sufficient': available >= requested,
    }


def can_fulfill_order(order):
    """Hard stock check used before approving an order"""
    return validate_order_stock(
        order.egg_size,
        order.egg_type,
        get_order_quantity_eggs(order),
    )['sufficient']


def get_stock_by_size(egg_size=None, grade=None):
    """Aggregated inventory rows grouped by size and grade"""
    queryset = InventoryItem.objects.all()
    if egg_size:
        queryset = queryset.filter(egg_size=egg_size)
    if grade:
        queryset = queryset.filter(grade=grade)

    rows = queryset.values('egg_size', 'grade').annotate(
        available_eggs=Sum('available_eggs'),
        reserved_eggs=Sum('reserved_eggs'),
        sold_eggs=Sum('sold_eggs'),
        spoiled_eggs=Sum('spoiled_eggs'),
    ).order_by('egg_size', 'grade')

    return [
        {
            'egg_size': row['egg_size'],
            'grade': row['grade'],
            'available_eggs': row['available_eggs'] or 0,
            'reserved_eggs': row['reserved_eggs'] or 0,
            'sold_eggs': row['sold_eggs'] or 0,
            'spoiled_eggs': row['spoiled_eggs'] or 0,
            'available_trays': round((row['available_eggs'] or 0) / EGGS_PER_TRAY, 2),
        }
        for row in rows
    ]


def adjust_inventory(egg_size, grade, quantity, action='ADJUSTMENT', date=None,
                     notes='', reference='Manual adjustment'):
    """Manually adjust per-size/per-grade stock"""
    quantity = int(quantity or 0)
    if quantity == 0:
        raise ValueError('Quantity must not be zero')
    if grade not in ('GOOD', 'DIRTY', 'BROKEN'):
        raise ValueError('Invalid egg grade')
    if action not in ('ADJUSTMENT', 'SPOILED'):
        raise ValueError('Invalid adjustment action')
    if action == 'SPOILED' and grade == 'BROKEN':
        raise ValueError('Broken eggs are already spoiled')
    if action == 'SPOILED' and quantity < 0:
        raise ValueError('Spoiled quantity must be positive')

    date = date or timezone.now().date()

    with transaction.atomic():
        inventory = _get_inventory_for_date(date)

        if action == 'SPOILED':
            source = get_or_create_inventory_item(inventory, egg_size, grade)
            target = get_or_create_inventory_item(inventory, egg_size, 'BROKEN')
            if source.available_eggs < quantity:
                raise ValueError('Not enough available eggs to spoil')
            _apply_item_updates(source, inventory, {'available_eggs': -quantity})
            _apply_item_updates(target, inventory, {'spoiled_eggs': quantity})
            log_quantity = quantity
            log_grade = grade
        else:
            item = get_or_create_inventory_item(inventory, egg_size, grade)
            field = 'spoiled_eggs' if grade == 'BROKEN' else 'available_eggs'
            if getattr(item, field) + quantity < 0:
                raise ValueError('Adjustment would make inventory negative')
            _apply_item_updates(item, inventory, {field: quantity})
            log_quantity = quantity
            log_grade = grade

        StockLog.objects.create(
            inventory=inventory,
            action='SPOILED' if action == 'SPOILED' else 'ADJUSTMENT',
            quantity=log_quantity,
            egg_size=egg_size,
            grade=log_grade,
            reference=reference,
            notes=notes,
        )

    return get_or_create_inventory_item(inventory, egg_size, grade)


def get_current_stock():
    """Get total available eggs across all dates"""
    totals = Inventory.objects.aggregate(
        available=Sum('available_eggs'),
        reserved=Sum('reserved_eggs'),
        sold=Sum('sold_eggs'),
        spoiled=Sum('spoiled_eggs'),
    )
    total_available = totals['available'] or 0
    total_reserved = totals['reserved'] or 0
    total_sold = totals['sold'] or 0
    total_spoiled = totals['spoiled'] or 0

    return {
        'available': total_available,
        'reserved': total_reserved,
        'sold': total_sold,
        'spoiled': total_spoiled,
        'sellable_now': total_available,
        'trays_available': round(total_available / EGGS_PER_TRAY, 2),
        'by_size': get_stock_by_size(),
    }
