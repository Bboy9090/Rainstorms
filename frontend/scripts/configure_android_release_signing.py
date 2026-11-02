from pathlib import Path
import re

gradle = Path("android/app/build.gradle")
text = gradle.read_text()

loader = """def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file("keystore.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

"""
if "def keystoreProperties =" not in text:
    text = text.replace("android {", loader + "android {", 1)

signing_match = re.search(r"signingConfigs\s*\{([\s\S]*?)\n\s*\}", text)
if not signing_match:
    raise SystemExit("signingConfigs block not found")

if "keystoreProperties['storeFile']" not in text:
    insert_at = signing_match.end() - 1
    release = """
        release {
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
        }
"""
    text = text[:insert_at] + release + text[insert_at:]

release_block = re.compile(r"(release\s*\{[\s\S]*?)(signingConfig\s+signingConfigs\.debug)([\s\S]*?\n\s*\})")
text, count = release_block.subn(r"\1signingConfig signingConfigs.release\3", text, count=1)
if count != 1:
    raise SystemExit("release buildType signingConfig not found")

gradle.write_text(text)
