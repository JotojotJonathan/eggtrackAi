from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from . import export_views

router = DefaultRouter()
router.register(r'buyers', views.BuyerViewSet)
router.register(r'production', views.ProductionViewSet)
router.register(r'orders', views.OrderViewSet)
router.register(r'deliveries', views.DeliveryViewSet)
router.register(r'alerts', views.AlertViewSet)
router.register(r'forecasts', views.AIForecastViewSet)
router.register(r'users', views.UserViewSet)
router.register(r'ratings', views.DeliveryRatingViewSet)

urlpatterns = [
    # ✅ Custom routes FIRST (before router)
    path('auth/login/', views.CustomTokenObtainPairView.as_view(), name='login'),
    path('auth/me/', views.get_current_user, name='current-user'),
    path('auth/register/', views.register_buyer, name='register'),
    path('auth/create_staff/', views.create_staff_account, name='create-staff'),
    path('buyers/me/', views.get_my_buyer_profile, name='my-buyer-profile'),  # ✅ BEFORE router
    path('buyers/geocode_all/', views.BuyerViewSet.as_view({'post': 'geocode_all'}), name='geocode-all'),
    path('orders/<int:order_id>/payments/', views.order_payments, name='order-payments'),
    path('orders/<int:order_id>/payments/<int:payment_id>/', views.order_payment_detail, name='order-payment-detail'),
    path('prices/', views.get_egg_prices, name='egg-prices'),
    path('prices/<str:egg_size>/', views.egg_price_detail, name='egg-price-detail'),
    path('validate-buyer/', views.validate_buyer, name='validate-buyer'),
    path('ai/run/', views.run_ai_tasks, name='run-ai'),
    path('ai/predict/', views.get_prediction, name='predict'),
    path('ai/anomaly/', views.check_anomaly, name='anomaly'),
    path('ai/overcommitment/', views.check_overcommitment, name='overcommitment'),
    path('reports/', views.get_reports, name='reports'),
    path('inventory/', views.get_inventory, name='inventory'),
    path('inventory/adjust/', views.adjust_inventory, name='inventory-adjust'),
    path('inventory/history/', views.get_inventory_history, name='inventory-history'),
    path('inventory/logs/', views.get_stock_logs, name='stock-logs'),
    path('notifications/', views.get_notifications, name='notifications'),
    path('notifications/unread_count/', views.get_unread_count, name='unread-count'),
    path('notifications/<int:pk>/read/', views.mark_notification_read, name='mark-read'),
    path('notifications/read_all/', views.mark_all_notifications_read, name='mark-all-read'),
    path('export/orders/', export_views.export_orders_csv, name='export-orders'),
    path('export/buyers/', export_views.export_buyers_csv, name='export-buyers'),
    path('export/production/', export_views.export_production_csv, name='export-production'),
    path('export/deliveries/', export_views.export_deliveries_csv, name='export-deliveries'),
    path('export/inventory/', export_views.export_inventory_csv, name='export-inventory'),
    path('export/stock_logs/', export_views.export_stock_logs_csv, name='export-stock-logs'),
    path('export/alerts/', export_views.export_alerts_csv, name='export-alerts'),
    # ✅ Router LAST
    path('', include(router.urls)),
]