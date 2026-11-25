"""
Notification service — handles in-app and email notifications.
"""
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth.models import User
from .models import Notification


def notify_user(user, notif_type, title, message, link=''):
    """Create an in-app notification for a user"""
    return Notification.objects.create(
        user=user,
        notification_type=notif_type,
        title=title,
        message=message,
        link=link,
    )


def notify_role(role, notif_type, title, message, link=''):
    """Send notification to all users with a specific role"""
    from .models import UserProfile
    users = User.objects.filter(profile__role=role)
    notifications = []
    for user in users:
        notifications.append(Notification(
            user=user,
            notification_type=notif_type,
            title=title,
            message=message,
            link=link,
        ))
    return Notification.objects.bulk_create(notifications)


def send_email_notification(to_email, subject, message):
    """Send email notification (if email configured)"""
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL if hasattr(settings, 'DEFAULT_FROM_EMAIL') else 'noreply@eggtrack.com',
            recipient_list=[to_email],
            fail_silently=True,
        )
        return True
    except Exception as e:
        print(f"Email error: {e}")
        return False


# ============================================================
# EVENT HANDLERS
# ============================================================

def on_order_placed(order):
    """Triggered when buyer places a new order"""
    # Notify all admins
    notify_role(
        'ADMIN',
        'ORDER_PLACED',
        f'📦 New Order #{order.id}',
        f'{order.buyer.name} placed an order for {order.quantity} eggs (₱{order.total_amount}).',
        link='/admin/orders',
    )
    
    # Notify delivery staff (if auto-assigned)
    notify_role(
        'DELIVERY',
        'ORDER_PLACED',
        f'📦 New Order #{order.id}',
        f'Prepare for delivery on {order.delivery_date}.',
        link='/delivery',
    )


def on_order_approved(order):
    """Triggered when admin approves order"""
    if order.buyer.email:
        send_email_notification(
            order.buyer.email,
            f'✅ Order #{order.id} Approved',
            f'Hi {order.buyer.name},\n\n'
            f'Your order for {order.quantity} eggs (₱{order.total_amount}) has been approved.\n'
            f'Expected delivery: {order.delivery_date}.\n\n'
            f'Thank you!\nEggTrack AI',
        )
    
    # Notify delivery staff
    notify_role(
        'DELIVERY',
        'DELIVERY_ASSIGNED',
        f'🚚 Order #{order.id} Ready for Delivery',
        f'Deliver {order.quantity} eggs to {order.buyer.name} on {order.delivery_date}.',
        link='/delivery',
    )


def on_order_rejected(order):
    """Triggered when order is rejected"""
    if order.buyer.email:
        send_email_notification(
            order.buyer.email,
            f'❌ Order #{order.id} Cancelled',
            f'Hi {order.buyer.name},\n\n'
            f'Unfortunately, your order for {order.quantity} eggs has been cancelled.\n'
            f'Please contact us for more information.\n\n'
            f'EggTrack AI',
        )


def on_order_delivered(order):
    """Triggered when delivery is completed"""
    if order.buyer.email:
        send_email_notification(
            order.buyer.email,
            f'🎉 Order #{order.id} Delivered', 
            f'Hi {order.buyer.name},\n\n'
            f'Your order of {order.quantity} eggs has been delivered successfully.\n'
            f'Thank you for your business!\n\n'
            f'EggTrack AI',
        )


def on_low_stock(available, threshold):
    """Triggered when stock is low"""
    notify_role(
        'ADMIN',
        'LOW_STOCK',
        f'⚠️ Low Stock Alert',
        f'Only {available} eggs remaining in inventory (threshold: {threshold}). Consider increasing production or limiting new orders.',
        link='/admin/inventory',
    )