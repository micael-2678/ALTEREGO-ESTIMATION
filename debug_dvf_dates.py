#!/usr/bin/env python3
"""
Debug DVF date filtering issue
Check date formats and filtering logic
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = "https://label-persist.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# User's exact test case
TEST_PAYLOAD = {
    "address": "15 Avenue des Champs-Élysées, 75008 Paris",
    "lat": 48.8698,
    "lng": 2.3085,
    "type": "appartement",
    "surface": 80,
    "characteristics": {"floor": "1-3", "standing": 4}
}

def test_different_date_ranges():
    """Test with different date ranges to see if it's a date filtering issue"""
    
    print("🔍 TESTING DIFFERENT DATE RANGES")
    print("=" * 50)
    
    # Test different month ranges
    month_ranges = [6, 12, 18, 24, 30, 36]
    
    for months in month_ranges:
        print(f"\nTesting with {months} months lookback:")
        
        params = {
            'lat': TEST_PAYLOAD['lat'],
            'lng': TEST_PAYLOAD['lng'],
            'type': TEST_PAYLOAD['type'],
            'surface': TEST_PAYLOAD['surface'],
            'radiusMeters': 500,
            'months': months
        }
        
        try:
            response = requests.get(f"{API_BASE}/dvf/comparables", params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                count = data.get('count', 0)
                stats = data.get('stats', {})
                warning = data.get('warning')
                
                print(f"  Count: {count}")
                if count > 0 and stats:
                    print(f"  Mean Price/m²: €{stats.get('meanPricePerM2', 'N/A')}")
                if warning:
                    print(f"  Warning: {warning}")
                    
                # Show date range of comparables if any
                comparables = data.get('comparables', [])
                if comparables:
                    dates = [c.get('date') for c in comparables if c.get('date')]
                    if dates:
                        dates.sort()
                        print(f"  Date range: {dates[0]} to {dates[-1]}")
            else:
                print(f"  ERROR: HTTP {response.status_code}")
                
        except Exception as e:
            print(f"  ERROR: {str(e)}")

def test_estimate_vs_direct_dvf():
    """Compare /api/estimate vs /api/dvf/comparables results"""
    
    print("\n🔍 COMPARING /api/estimate vs /api/dvf/comparables")
    print("=" * 60)
    
    # Test direct DVF
    print("1. Testing /api/dvf/comparables:")
    params = {
        'lat': TEST_PAYLOAD['lat'],
        'lng': TEST_PAYLOAD['lng'],
        'type': TEST_PAYLOAD['type'],
        'surface': TEST_PAYLOAD['surface'],
        'radiusMeters': 500,
        'months': 24
    }
    
    try:
        response = requests.get(f"{API_BASE}/dvf/comparables", params=params, timeout=10)
        if response.status_code == 200:
            dvf_data = response.json()
            dvf_count = dvf_data.get('count', 0)
            print(f"   DVF Direct Count: {dvf_count}")
        else:
            print(f"   DVF Direct ERROR: HTTP {response.status_code}")
    except Exception as e:
        print(f"   DVF Direct ERROR: {str(e)}")
    
    # Test estimate endpoint
    print("\n2. Testing /api/estimate:")
    try:
        response = requests.post(f"{API_BASE}/estimate", json=TEST_PAYLOAD, timeout=30)
        if response.status_code == 200:
            estimate_data = response.json()
            estimate_dvf = estimate_data.get('dvf', {})
            estimate_count = estimate_dvf.get('count', 0)
            print(f"   Estimate DVF Count: {estimate_count}")
            
            # Compare parameters used
            estimate_radius = estimate_dvf.get('radius', 'Unknown')
            estimate_months = estimate_dvf.get('months', 'Unknown')
            print(f"   Estimate used: radius={estimate_radius}m, months={estimate_months}")
            
        else:
            print(f"   Estimate ERROR: HTTP {response.status_code}")
    except Exception as e:
        print(f"   Estimate ERROR: {str(e)}")

def test_with_current_date_issue():
    """Test if there's a current date calculation issue"""
    
    print("\n🔍 TESTING DATE CALCULATION LOGIC")
    print("=" * 40)
    
    # Calculate what the cutoff date should be for 24 months
    now = datetime.now()
    cutoff_24_months = now - timedelta(days=24*30)  # Approximate
    cutoff_date_str = cutoff_24_months.strftime('%Y-%m-%d')
    
    print(f"Current date: {now.strftime('%Y-%m-%d')}")
    print(f"24 months ago: {cutoff_date_str}")
    print(f"Expected date range: {cutoff_date_str} to {now.strftime('%Y-%m-%d')}")
    
    # Test with a very wide date range to see if we get more results
    print(f"\nTesting with 60 months (5 years) lookback:")
    params = {
        'lat': TEST_PAYLOAD['lat'],
        'lng': TEST_PAYLOAD['lng'],
        'type': TEST_PAYLOAD['type'],
        'surface': TEST_PAYLOAD['surface'],
        'radiusMeters': 500,
        'months': 60
    }
    
    try:
        response = requests.get(f"{API_BASE}/dvf/comparables", params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            count = data.get('count', 0)
            print(f"  Count with 60 months: {count}")
            
            comparables = data.get('comparables', [])
            if comparables:
                dates = [c.get('date') for c in comparables if c.get('date')]
                if dates:
                    dates.sort()
                    print(f"  Actual date range found: {dates[0]} to {dates[-1]}")
        else:
            print(f"  ERROR: HTTP {response.status_code}")
    except Exception as e:
        print(f"  ERROR: {str(e)}")

def main():
    print("DVF DATE FILTERING DEBUG")
    print("Testing user's exact coordinates: 48.8698, 2.3085 (Champs-Élysées)")
    print("=" * 70)
    
    test_different_date_ranges()
    test_estimate_vs_direct_dvf()
    test_with_current_date_issue()
    
    print("\n" + "=" * 70)
    print("DEBUG COMPLETE")

if __name__ == "__main__":
    main()