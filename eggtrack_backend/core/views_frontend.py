from django.shortcuts import render

def worker_page(request):
    return render(request, 'pages/worker.html')

def buyer_page(request):
    return render(request, 'pages/buyer.html')

def delivery_page(request):
    return render(request, 'pages/delivery.html')

def admin_page(request):
    return render(request, 'pages/admin.html')