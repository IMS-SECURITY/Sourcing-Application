# TalentFlow — Local Development Guide (Firebase)

This project has been fully migrated from Supabase to **Firebase** (Auth + Firestore + Storage).

## Setup Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the root directory (or update the existing one):
   ```env
   # Firebase Config (Browser-safe)
   VITE_FIREBASE_API_KEY="your-api-key"
   VITE_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
   VITE_FIREBASE_PROJECT_ID="your-project-id"
   VITE_FIREBASE_STORAGE_BUCKET="your-project.firebasestorage.app"
   VITE_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
   VITE_FIREBASE_APP_ID="your-app-id"

   # Firebase Service Account JSON (Server-side/REST Admin)
   # Copy the entire JSON block from your Service Account Private Key file and paste it here:
   FIREBASE_SERVICE_ACCOUNT_JSON='{"type": "service_account", "project_id": "your-project-id", ...}'

   # App details
   APP_URL="http://localhost:8080"

   # Mailer Config (optional)
   GMAIL_USER="your-email@gmail.com"
   GMAIL_APP_PASSWORD="your-app-password"
   ```

3. **Run Locally**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:8080](http://localhost:8080) in your browser.

## Database Security Rules
To apply firestore security rules, copy the contents of [firestore.rules](file:///d:/testing/hirepath-suite-main/firestore.rules) to the Firestore rules editor in your Firebase Console.
