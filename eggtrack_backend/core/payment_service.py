"""
Payment service — records payments and keeps order payment totals in sync.
"""
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .models import Order, Payment


def _to_decimal(amount):
    try:
        return Decimal(str(amount))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError('Invalid payment amount')


def _validate_method(method):
    valid_methods = {choice[0] for choice in Order.PAYMENT_METHODS}
    if method not in valid_methods:
        raise ValueError('Invalid payment method')


def recalculate_order_payment(order):
    """Recalculate an order's amount paid and payment status from its payments"""
    total_paid = order.payments.aggregate(total=Sum('amount'))['total'] or Decimal('0')
    total_paid = Decimal(str(total_paid))
    if total_paid < 0:
        total_paid = Decimal('0')

    total_amount = Decimal(str(order.total_amount or 0))

    if total_paid <= 0:
        payment_status = 'UNPAID'
    elif total_paid < total_amount:
        payment_status = 'PARTIAL'
    else:
        payment_status = 'PAID'

    order.amount_paid = total_paid
    order.payment_status = payment_status
    order.save(update_fields=['amount_paid', 'payment_status'])
    return order


@transaction.atomic
def record_payment(order, amount, method=None, reference='', proof_data='',
                   proof_text='', paid_at=None, recorded_by=None):
    """Create a payment and recalculate the order's payment status"""
    amount = _to_decimal(amount)
    if amount <= 0:
        raise ValueError('Payment amount must be greater than zero')

    method = method or order.payment_method
    _validate_method(method)

    payment = Payment.objects.create(
        order=order,
        amount=amount,
        method=method,
        reference=reference or '',
        proof_data=proof_data or '',
        proof_text=proof_text or '',
        paid_at=paid_at or timezone.now(),
        recorded_by=recorded_by,
    )
    recalculate_order_payment(order)
    return payment


@transaction.atomic
def update_payment(payment, **fields):
    """Update an existing payment and recalculate the order's payment status"""
    allowed_fields = {
        'amount', 'method', 'reference', 'proof_data', 'proof_text',
        'paid_at', 'recorded_by',
    }
    unknown_fields = set(fields) - allowed_fields
    if unknown_fields:
        raise ValueError(f"Unsupported payment fields: {', '.join(sorted(unknown_fields))}")

    if 'amount' in fields:
        fields['amount'] = _to_decimal(fields['amount'])
        if fields['amount'] <= 0:
            raise ValueError('Payment amount must be greater than zero')
    if 'method' in fields:
        _validate_method(fields['method'])

    for field, value in fields.items():
        setattr(payment, field, value)
    payment.save()
    recalculate_order_payment(payment.order)
    return payment


@transaction.atomic
def delete_payment(payment):
    """Delete a payment and recalculate the order's payment status"""
    order = payment.order
    payment.delete()
    recalculate_order_payment(order)
    return order
