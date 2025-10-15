#!/usr/bin/env python3
"""
Test multiple locations to see if the 0 comparables issue is location-specific
"""

import requests
import json

BASE_URL = "https://label-persist.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test different locations across France
TEST_LOCATIONS = [
    {
        "name": "Champs-Élysées Paris (User's case)",
        "address": "15 Avenue des Champs-Élysées, 75008 Paris",
        "lat": 48.8698,
        "lng": 2.3085,
        "type": "appartement",
        "surface": 80
    },
    {
        "name": "Marais Paris",
        "address": "Place des Vosges, 75004 Paris",
        "lat": 48.8555,
        "lng": 2.3665,
        "type": "appartement",
        "surface": 75
    },
    {
        "name": "Montparnasse Paris",
        "address": "Tour Montparnasse, 75015 Paris",
        "lat": 48.8420,
        "lng": 2.3219,
        "type": "appartement",
        "surface": 85
    },
    {
        "name": "Lyon Presqu'île",
        "address": "Place Bellecour, 69002 Lyon",
        "lat": 45.7578,
        "lng": 4.8320,
        "type": "appartement",
        "surface": 70
    },
    {
        "name": "Marseille Vieux-Port",
        "address": "Vieux-Port, 13001 Marseille",
        "lat": 43.2951,
        "lng": 5.3781,
        "type": "appartement",
        "surface": 65
    },
    {
        "name": "Nice Promenade",
        "address": "Promenade des Anglais, 06000 Nice",
        "lat": 43.6947,
        "lng": 7.2659,
        "type": "appartement",
        "surface": 60
    }
]

def test_location(location):
    """Test a specific location"""
    
    print(f"\n📍 Testing: {location['name']}")
    print(f"   Address: {location['address']}")
    print(f"   Coordinates: {location['lat']}, {location['lng']}")
    
    # Test payload
    payload = {
        "address": location['address'],
        "lat": location['lat'],
        "lng": location['lng'],
        "type": location['type'],
        "surface": location['surface'],
        "characteristics": {"floor": "1-3", "standing": 4}
    }
    
    try:
        response = requests.post(f"{API_BASE}/estimate", json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            dvf_data = data.get('dvf', {})
            dvf_count = dvf_data.get('count', 0)
            dvf_stats = dvf_data.get('stats')
            dvf_warning = dvf_data.get('warning')
            dvf_radius = dvf_data.get('radius', 'Unknown')
            dvf_months = dvf_data.get('months', 'Unknown')
            
            if dvf_count == 0:
                print(f"   ❌ ISSUE: 0 comparables found")
                print(f"      Radius: {dvf_radius}m, Months: {dvf_months}")
                print(f"      Warning: {dvf_warning or 'None'}")
                return False, f"0 comparables - {dvf_warning or 'No warning'}"
            else:
                avg_price = dvf_stats.get('meanPricePerM2', 'N/A') if dvf_stats else 'N/A'
                confidence = dvf_stats.get('confidenceIndex', 'N/A') if dvf_stats else 'N/A'
                print(f"   ✅ SUCCESS: {dvf_count} comparables found")
                print(f"      Average: €{avg_price}/m², Confidence: {confidence}%")
                print(f"      Radius: {dvf_radius}m, Months: {dvf_months}")
                return True, f"{dvf_count} comparables, €{avg_price}/m²"
        else:
            print(f"   ❌ API ERROR: HTTP {response.status_code}")
            print(f"      Response: {response.text[:200]}...")
            return False, f"HTTP {response.status_code}"
            
    except Exception as e:
        print(f"   ❌ EXCEPTION: {str(e)}")
        return False, f"Exception: {str(e)}"

def test_edge_cases():
    """Test some edge cases that might trigger the 0 comparables issue"""
    
    print(f"\n🔍 TESTING EDGE CASES")
    print("=" * 50)
    
    edge_cases = [
        {
            "name": "Very small surface",
            "payload": {
                "address": "15 Avenue des Champs-Élysées, 75008 Paris",
                "lat": 48.8698,
                "lng": 2.3085,
                "type": "appartement",
                "surface": 15,  # Very small
                "characteristics": {"floor": "1-3", "standing": 4}
            }
        },
        {
            "name": "Very large surface",
            "payload": {
                "address": "15 Avenue des Champs-Élysées, 75008 Paris",
                "lat": 48.8698,
                "lng": 2.3085,
                "type": "appartement",
                "surface": 300,  # Very large
                "characteristics": {"floor": "1-3", "standing": 4}
            }
        },
        {
            "name": "House instead of apartment",
            "payload": {
                "address": "15 Avenue des Champs-Élysées, 75008 Paris",
                "lat": 48.8698,
                "lng": 2.3085,
                "type": "maison",  # House in city center
                "surface": 80,
                "characteristics": {"floor": "1-3", "standing": 4}
            }
        },
        {
            "name": "Remote location",
            "payload": {
                "address": "Rural France",
                "lat": 46.0,  # Center of France, likely rural
                "lng": 2.0,
                "type": "appartement",
                "surface": 80,
                "characteristics": {"floor": "1-3", "standing": 4}
            }
        }
    ]
    
    results = []
    
    for case in edge_cases:
        print(f"\n   Testing: {case['name']}")
        
        try:
            response = requests.post(f"{API_BASE}/estimate", json=case['payload'], timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                dvf_count = data.get('dvf', {}).get('count', 0)
                dvf_warning = data.get('dvf', {}).get('warning')
                
                if dvf_count == 0:
                    print(f"      ❌ 0 comparables - {dvf_warning or 'No warning'}")
                    results.append((case['name'], False, dvf_warning))
                else:
                    print(f"      ✅ {dvf_count} comparables found")
                    results.append((case['name'], True, dvf_count))
            else:
                print(f"      ❌ HTTP {response.status_code}")
                results.append((case['name'], False, f"HTTP {response.status_code}"))
                
        except Exception as e:
            print(f"      ❌ Exception: {str(e)}")
            results.append((case['name'], False, f"Exception: {str(e)}"))
    
    return results

def main():
    print("MULTIPLE LOCATION TESTING")
    print("Testing if 0 comparables issue is location or parameter specific")
    print("=" * 70)
    
    # Test main locations
    location_results = []
    for location in TEST_LOCATIONS:
        success, message = test_location(location)
        location_results.append((location['name'], success, message))
    
    # Test edge cases
    edge_results = test_edge_cases()
    
    # Summary
    print("\n" + "=" * 70)
    print("📊 SUMMARY")
    print("=" * 70)
    
    print("\n🏙️ LOCATION RESULTS:")
    working_locations = 0
    for name, success, message in location_results:
        status = "✅" if success else "❌"
        print(f"  {status} {name}: {message}")
        if success:
            working_locations += 1
    
    print(f"\n   Working locations: {working_locations}/{len(location_results)}")
    
    print("\n🔍 EDGE CASE RESULTS:")
    working_edge_cases = 0
    for name, success, message in edge_results:
        status = "✅" if success else "❌"
        print(f"  {status} {name}: {message}")
        if success:
            working_edge_cases += 1
    
    print(f"\n   Working edge cases: {working_edge_cases}/{len(edge_results)}")
    
    # Analysis
    if working_locations == len(location_results):
        print(f"\n✅ CONCLUSION: All locations work - user's issue may be resolved or intermittent")
    elif working_locations == 0:
        print(f"\n❌ CONCLUSION: Systematic issue - no locations work")
    else:
        print(f"\n⚠️ CONCLUSION: Partial issue - some locations fail")
        
        failing_locations = [name for name, success, _ in location_results if not success]
        print(f"   Failing locations: {', '.join(failing_locations)}")

if __name__ == "__main__":
    main()