# Bobby's Story Bench — Installable Android Test APK

The independent `Story Bench Self-Contained Android Test APK` GitHub Actions workflow builds a **self-contained APK that can be installed and launched without a Metro development server** for development and authorized QA. It does not replace the Play Store release workflow, signed AAB, or physical-device testing.

1. Run the workflow on the candidate commit (or validate it through its PR). Download the `BobbysStoryBench-self-contained-QA-APK` GitHub Actions artifact.
2. Extract `app-release.apk`, `APK-SHA256.txt`, `APK-SIGNATURE.txt`, and `APK-QUALIFICATION.txt`; verify the SHA-256 on the extracted APK and confirm the artifact's source SHA.
3. On a device that you own or are authorized to test, enable developer options and authorize USB debugging. Confirm it appears in `adb devices` before installing.
4. Execute `adb install -r app-release.apk`, open the app, and test sign-in, project creation, story editing, export, network failures, permissions, and recovery from app restart. Capture the OS version, model, app version, installation logs, failures, and a tested commit SHA.

**Important:** The workflow builds the non-debuggable release variant so JavaScript is embedded in the APK, but it intentionally uses development/debug signing rather than the Google Play upload keystore. Never upload this debug APK as a production release, report it as store-signed, or confuse successful compilation with device QA. Its package ID `com.rainstorms.app` intentionally remains unchanged to preserve canonical app identity. Installing over a differently signed production copy will fail; never uninstall a user's production app merely to force this debug package to install without their authorization and data-preservation plan.
