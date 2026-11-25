"""
Geocoding service for converting addresses to GPS coordinates.
Uses OpenStreetMap's Nominatim API (free, no API key needed).
"""
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
import time

# Initialize geocoder with proper user agent
geolocator = Nominatim(user_agent="eggtrack_ai_capstone_v1")


def geocode_address(address):
    """
    Convert an address string to (latitude, longitude) tuple.
    Returns None if geocoding fails.
    """
    if not address:
        return None
    
    try:
        # Add Philippines context if not specified
        search_address = address
        if 'philippines' not in address.lower():
            search_address = f"{address}, Philippines"
        
        location = geolocator.geocode(
            search_address,
            timeout=10,
            exactly_one=True
        )
        
        if location:
            return (location.latitude, location.longitude)
        return None
        
    except (GeocoderTimedOut, GeocoderServiceError) as e:
        print(f"Geocoding error: {e}")
        return None
    except Exception as e:
        print(f"Unexpected geocoding error: {e}")
        return None


def geocode_buyer(buyer):
    """
    Geocode a Buyer object using structured address and save coordinates.
    Tries multiple address combinations for accuracy.
    """
    # Already has coordinates
    if buyer.latitude and buyer.longitude:
        return (buyer.latitude, buyer.longitude)
    
    # Try different address combinations
    attempts = []
    
    # Attempt 1: Full address with purok
    if buyer.purok and buyer.barangay and buyer.municipality and buyer.province:
        attempts.append(
            f"{buyer.purok}, Barangay {buyer.barangay}, {buyer.municipality}, {buyer.province}, Philippines"
        )
    
    # Attempt 2: Without purok
    if buyer.barangay and buyer.municipality and buyer.province:
        attempts.append(
            f"Barangay {buyer.barangay}, {buyer.municipality}, {buyer.province}, Philippines"
        )
    
    # Attempt 3: Without barangay
    if buyer.municipality and buyer.province:
        attempts.append(
            f"{buyer.municipality}, {buyer.province}, Philippines"
        )
    
    # Attempt 4: Province only
    if buyer.province:
        attempts.append(f"{buyer.province}, Philippines")
    
    # Try each attempt
    for i, address in enumerate(attempts):
        print(f"  Attempt {i+1}: {address}")
        coords = geocode_address(address)
        
        if coords:
            buyer.latitude, buyer.longitude = coords
            buyer.save()
            print(f"✅ Geocoded {buyer.name}: {coords}")
            return coords
        
        # Rate limit: 1 second between requests
        time.sleep(1)
    
    print(f"❌ Failed to geocode {buyer.name}")
    return None