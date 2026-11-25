"""
Egg pricing reference based on size and type.
All prices are per piece.
"""
from decimal import Decimal, ROUND_HALF_UP

from .models import EGGS_PER_TRAY, EggPrice


EGG_PRICES = {
    'PEEWEE': {'GOOD': (7.00, 7.50), 'DIRTY': (5.00, 6.00)},
    'SMALL':  {'GOOD': (7.00, 8.00), 'DIRTY': (5.00, 6.00)},
    'MEDIUM': {'GOOD': (8.00, 9.00), 'DIRTY': (6.00, 7.00)},
    'LARGE':  {'GOOD': (9.00, 10.00), 'DIRTY': (7.00, 8.00)},
    'XL':     {'GOOD': (9.00, 10.00), 'DIRTY': (7.00, 8.00)},
    'JUMBO':  {'GOOD': (10.00, 10.00), 'DIRTY': (8.00, 8.00)},
}

MONEY_QUANTUM = Decimal('0.01')


def get_price_range(egg_size, egg_type='GOOD'):
    """Get the price range for a specific egg size and type"""
    return EGG_PRICES.get(egg_size, {}).get(egg_type, (8.00, 9.00))


def get_mid_price(egg_size, egg_type='GOOD'):
    """Get the average price for a specific egg size and type"""
    low, high = get_price_range(egg_size, egg_type)
    return round((low + high) / 2, 2)


def get_db_price(egg_size):
    """Get the active admin-managed price for a size, if one exists"""
    return EggPrice.objects.filter(
        egg_size=egg_size,
        is_active=True,
    ).values_list('price_per_egg', flat=True).first()


def get_egg_price(egg_size, egg_type='GOOD'):
    """Get the server-side price per egg (DB price first, then fallback)"""
    db_price = get_db_price(egg_size)
    if db_price is not None:
        return Decimal(str(db_price)).quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)
    return Decimal(str(get_mid_price(egg_size, egg_type))).quantize(
        MONEY_QUANTUM, rounding=ROUND_HALF_UP
    )


def get_order_unit_price(egg_size, egg_type='GOOD', is_tray=False):
    """Get the price for one order unit (egg or tray)"""
    price = get_egg_price(egg_size, egg_type)
    if is_tray:
        price = price * EGGS_PER_TRAY
    return price.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)


def get_tray_price(egg_size, egg_type='GOOD'):
    """Get the price per tray (30 eggs)"""
    return float(get_order_unit_price(egg_size, egg_type, is_tray=True))


def trays_to_eggs(trays):
    """Convert whole trays to eggs"""
    return int(trays) * EGGS_PER_TRAY


def eggs_to_trays(eggs):
    """Convert eggs to trays (may be fractional for display)"""
    if not EGGS_PER_TRAY:
        return 0
    return round(int(eggs) / EGGS_PER_TRAY, 2)
