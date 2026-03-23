import urllib.request, json, urllib.error
data = json.dumps({'original_idea': 'dragon', 'tone': 'funny', 'age_range': '4', 'page_count': 10}).encode('utf-8')
req = urllib.request.Request('https://backend-production-4938.up.railway.app/api/generate/blueprint', data=data, headers={'Content-Type': 'application/json'})
try:
    urllib.request.urlopen(req)
except urllib.error.HTTPError as e:
    print(e.read().decode('utf-8'))
