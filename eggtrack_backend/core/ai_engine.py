"""
AI Engine for EggTrack AI
- Production Forecasting (Linear Regression)
- Anomaly Detection (Z-score)
- Order vs Forecast Alert
"""
import numpy as np
import pandas as pd
from datetime import date, timedelta
from sklearn.linear_model import LinearRegression
from django.utils import timezone
from .models import Production, Order, Alert, AIForecast


def predict_tomorrow_production():
    """
    Predict tomorrow's egg production using Linear Regression
    on the last 30 days of production data.
    """
    # Get last 30 days of production
    end_date = timezone.now().date()
    start_date = end_date - timedelta(days=30)
    records = Production.objects.filter(
        date__range=[start_date, end_date]
    ).order_by('date')
    
    if records.count() < 3:
        return None  # Not enough data
    
    # Prepare data
    dates = np.array([(r.date - start_date).days for r in records]).reshape(-1, 1)
    eggs = np.array([r.total_eggs for r in records])
    
    # Train linear regression
    model = LinearRegression()
    model.fit(dates, eggs)
    
    # Predict tomorrow
    tomorrow = (end_date + timedelta(days=1) - start_date).days
    predicted = model.predict([[tomorrow]])[0]
    
    # Confidence (R² score)
    confidence = max(0, min(1, model.score(dates, eggs)))
    
    return {
        'date': end_date + timedelta(days=1),
        'predicted_eggs': int(max(0, predicted)),
        'confidence': round(confidence, 2),
    }


def detect_anomaly():
    """
    Detect anomaly in today's production using Z-score.
    If today's production is more than 2 standard deviations
    below the recent average, create an alert.
    """
    end_date = timezone.now().date()
    start_date = end_date - timedelta(days=14)
    
    # Get historical data (excluding today)
    records = Production.objects.filter(
        date__range=[start_date, end_date - timedelta(days=1)]
    )
    
    if records.count() < 5:
        return None
    
    # Get today's production
    try:
        today_record = Production.objects.get(date=end_date)
    except Production.DoesNotExist:
        return None
    
    values = np.array([r.total_eggs for r in records])
    mean = np.mean(values)
    std = np.std(values)
    
    if std == 0:
        return None
    
    z_score = (today_record.total_eggs - mean) / std
    
    # If z-score < -2 (significantly below average)
    if z_score < -2:
        # Check if alert already exists for today
        existing = Alert.objects.filter(
            alert_type='ANOMALY',
            related_production=today_record,
        ).exists()
        
        if not existing:
            drop_percent = ((mean - today_record.total_eggs) / mean) * 100
            Alert.objects.create(
                alert_type='ANOMALY',
                severity='CRITICAL',
                title=f'⚠️ Production Drop Detected',
                message=f'Today\'s production ({today_record.total_eggs}) is {drop_percent:.1f}% below the 14-day average ({mean:.0f}). Possible disease or stress. Please investigate immediately.',
                related_production=today_record,
            )
            return {
                'detected': True,
                'drop_percent': round(drop_percent, 1),
                'average': round(mean),
                'today': today_record.total_eggs,
            }
    
    return {'detected': False}


def check_order_overcommitment():
    """
    Check if total pending orders exceed tomorrow's forecast.
    Create alert if orders > forecasted production.
    """
    tomorrow = timezone.now().date() + timedelta(days=1)
    
    # Get tomorrow's forecast
    try:
        forecast = AIForecast.objects.get(forecasted_date=tomorrow)
        forecasted_eggs = forecast.forecasted_eggs
    except AIForecast.DoesNotExist:
        # Try to generate one
        prediction = predict_tomorrow_production()
        if not prediction:
            return None
        forecasted_eggs = prediction['predicted_eggs']
    
    # Sum pending orders for tomorrow
    total_orders = sum(
        o.quantity for o in Order.objects.filter(
            delivery_date=tomorrow,
            status__in=['PENDING', 'APPROVED']
        )
    )
    
    if total_orders > forecasted_eggs:
        overcommit = total_orders - forecasted_eggs
        existing = Alert.objects.filter(
            alert_type='OVERCOMMITMENT',
            created_at__date=timezone.now().date(),
        ).exists()
        
        if not existing:
            Alert.objects.create(
                alert_type='OVERCOMMITMENT',
                severity='WARNING',
                title=f'⚠️ Order Overcommitment',
                message=f'Total orders for tomorrow ({total_orders}) exceed forecasted production ({forecasted_eggs}). You are short by {overcommit} eggs. Consider adjusting deliveries or increasing production.',
            )
            return {
                'detected': True,
                'total_orders': total_orders,
                'forecasted': forecasted_eggs,
                'shortage': overcommit,
            }
    
    return {'detected': False}


def generate_daily_forecast():
    """
    Generate and save tomorrow's forecast.
    """
    prediction = predict_tomorrow_production()
    if not prediction:
        return None
    
    # Get latest production record as FK
    latest = Production.objects.order_by('-date').first()
    if not latest:
        return None
    
    # Update or create forecast
    forecast, created = AIForecast.objects.update_or_create(
        forecasted_date=prediction['date'],
        defaults={
            'production': latest,
            'forecasted_eggs': prediction['predicted_eggs'],
            'confidence_score': prediction['confidence'],
            'model_used': 'LinearRegression',
        }
    )
    
    return forecast


def run_all_ai_tasks():
    """
    Run all AI tasks: forecast, anomaly detection, overcommitment check.
    Call this from a management command or API endpoint.
    """
    results = {}
    
    # 1. Generate tomorrow's forecast
    forecast = generate_daily_forecast()
    results['forecast'] = {
        'date': str(forecast.forecasted_date) if forecast else None,
        'predicted_eggs': forecast.forecasted_eggs if forecast else None,
        'confidence': float(forecast.confidence_score) if forecast else None,
    }
    
    # 2. Detect anomaly
    results['anomaly'] = detect_anomaly()
    
    # 3. Check overcommitment
    results['overcommitment'] = check_order_overcommitment()
    
    return results