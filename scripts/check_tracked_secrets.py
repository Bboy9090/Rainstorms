#!/usr/bin/env python3
import re
import subprocess
from pathlib import Path

KEYS = {
    'JWT_SECRET', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY',
    'GROQ_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
    'DATABASE_URL', 'MONGO_URL', 'MONGODB_URI', 'TWILIO_AUTH_TOKEN',
}
SKIP = {'.png','.jpg','.jpeg','.gif','.webp','.ico','.pdf','.zip','.gz','.lock','.mp3','.wav','.mp4','.mov','.glb'}
PLACEHOLDERS = ('your_', 'your-', 'example', 'placeholder', 'changeme', 'replace_me', 'dummy', 'localhost')
ASSIGN = re.compile(r'^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*[\"\']?([^\s\"\'#]+)')
PATTERNS = [
    ('private key', re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----')),
    ('GitHub token', re.compile(r'\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b')),
    ('OpenAI-style key', re.compile(r'\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b')),
    ('JWT-shaped token', re.compile(r'\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b')),
]

def placeholder(value):
    low = value.lower()
    return value.startswith('$') or any(marker in low for marker in PLACEHOLDERS)

files = subprocess.check_output(['git','ls-files','-z']).split(b'\0')
findings = []
for raw_path in files:
    if not raw_path:
        continue
    path = Path(raw_path.decode('utf-8'))
    if path.suffix.lower() in SKIP:
        continue
    try:
        data = path.read_bytes()
        if b'\0' in data:
            continue
        text = data.decode('utf-8')
    except (OSError, UnicodeDecodeError):
        continue
    for number, line in enumerate(text.splitlines(), 1):
        match = ASSIGN.match(line)
        if match and match.group(1) in KEYS and not placeholder(match.group(2)):
            findings.append(f'{path}:{number}: non-placeholder assignment to {match.group(1)}')
    for label, pattern in PATTERNS:
        for match in pattern.finditer(text):
            if not placeholder(match.group(0)):
                number = text.count('\n', 0, match.start()) + 1
                findings.append(f'{path}:{number}: {label}')

if findings:
    print('Tracked secret scan failed:')
    for finding in findings:
        print(' - ' + finding)
    raise SystemExit(1)

print('Tracked secret scan passed.')
