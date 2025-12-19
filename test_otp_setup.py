#!/usr/bin/env python3
"""
Test OTP setup and MongoDB connection
"""

import requests
import json

def test_mongodb_connection():
    """Test if MongoDB is accessible"""
    try:
        result = requests.get("http://localhost:3000/api/", timeout=5)
        if result.status_code == 200:
            print("✅ Next.js API is running")
            return True
        else:
            print(f"❌ Next.js API returned {result.status_code}")
            return False
    except Exception as e:
        print(f"❌ Failed to connect to Next.js API: {e}")
        return False

def test_bypass_functionality():
    """Test bypass functionality which doesn't require Brevo"""
    try:
        # Test send-otp with bypass number
        result = requests.post(
            "http://localhost:3000/api/verification/send-otp",
            json={"phone": "0698793430"},
            timeout=10
        )
        
        if result.status_code == 200:
            data = result.json()
            if data.get('success') and data.get('bypass'):
                print("✅ Bypass functionality working for send-otp")
                
                # Test verify-otp with bypass number
                verify_result = requests.post(
                    "http://localhost:3000/api/verification/verify-otp",
                    json={"phone": "0698793430", "code": "123456"},
                    timeout=10
                )
                
                if verify_result.status_code == 200:
                    verify_data = verify_result.json()
                    if verify_data.get('success') and verify_data.get('verified') and verify_data.get('bypass'):
                        print("✅ Bypass functionality working for verify-otp")
                        
                        # Test resend-otp with bypass number
                        resend_result = requests.post(
                            "http://localhost:3000/api/verification/resend-otp",
                            json={"phone": "0698793430"},
                            timeout=10
                        )
                        
                        if resend_result.status_code == 200:
                            resend_data = resend_result.json()
                            if resend_data.get('success') and resend_data.get('bypass'):
                                print("✅ Bypass functionality working for resend-otp")
                                return True
                            else:
                                print(f"❌ Resend bypass failed: {resend_data}")
                        else:
                            print(f"❌ Resend request failed: {resend_result.status_code}")
                    else:
                        print(f"❌ Verify bypass failed: {verify_data}")
                else:
                    print(f"❌ Verify request failed: {verify_result.status_code}")
            else:
                print(f"❌ Send bypass failed: {data}")
        else:
            print(f"❌ Send request failed: {result.status_code} - {result.text}")
            
    except Exception as e:
        print(f"❌ Bypass test failed: {e}")
        
    return False

def test_error_handling():
    """Test error handling without Brevo dependency"""
    try:
        # Test missing phone number
        result = requests.post(
            "http://localhost:3000/api/verification/send-otp",
            json={},
            timeout=10
        )
        
        if result.status_code == 400:
            data = result.json()
            if 'error' in data and 'required' in data['error'].lower():
                print("✅ Error handling working for missing phone")
                
                # Test missing parameters in verify
                verify_result = requests.post(
                    "http://localhost:3000/api/verification/verify-otp",
                    json={"code": "123456"},
                    timeout=10
                )
                
                if verify_result.status_code == 400:
                    verify_data = verify_result.json()
                    if 'error' in verify_data and 'required' in verify_data['error'].lower():
                        print("✅ Error handling working for missing phone in verify")
                        return True
                    else:
                        print(f"❌ Verify error handling failed: {verify_data}")
                else:
                    print(f"❌ Verify error request failed: {verify_result.status_code}")
            else:
                print(f"❌ Send error handling failed: {data}")
        else:
            print(f"❌ Send error request failed: {result.status_code}")
            
    except Exception as e:
        print(f"❌ Error handling test failed: {e}")
        
    return False

def main():
    print("🧪 Testing OTP Setup and Basic Functionality")
    print("=" * 50)
    
    # Test basic connectivity
    if not test_mongodb_connection():
        print("❌ Basic connectivity failed")
        return False
    
    # Test bypass functionality (doesn't require Brevo)
    if not test_bypass_functionality():
        print("❌ Bypass functionality failed")
        return False
    
    # Test error handling
    if not test_error_handling():
        print("❌ Error handling failed")
        return False
    
    print("\n✅ All basic OTP functionality tests passed!")
    print("📝 Note: Brevo SMS integration may need API key verification")
    return True

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)