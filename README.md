# Gmail Airtable Processor

## 1. Application Purpose

This application is a productivity tool designed to help property managers automate the process of tracking bookings. It connects to a user's Gmail account, finds reservation confirmation emails from platforms like Airbnb and Vrbo, extracts key details (such as guest name, check-in/check-out dates, and property name), and organizes this information neatly in a user-provided Airtable base.

The goal is to eliminate manual data entry, reduce errors, and provide a centralized dashboard of all bookings within Airtable.

## 2. Scopes Justification & Data Handling

To achieve its purpose, this application requires the following Google API scope:

-   **`https://www.googleapis.com/auth/gmail.readonly`**: **(Restricted Scope)** This permission is essential for the core functionality of the application. It is used exclusively to **read the content of reservation emails** to find and extract booking details.

### Data Flow:

1.  The application authenticates with the user's Google Account via OAuth2.
2.  It searches for emails matching specific criteria for reservation confirmations (e.g., from `automated@airbnb.com`).
3.  It reads the body of the identified emails to parse booking information.
4.  The extracted data is sent directly to the user's specified Airtable base.
5.  **Important**: This application **does not store, copy, or save any of the user's email data** on its own servers or any third-party service other than the user's own Airtable. All processing happens in memory during the execution of the function.

## 3. Privacy Policy

A detailed Privacy Policy is available here: [https://gmail-airtable-function.netlify.app/privacy](https://gmail-airtable-function.netlify.app/privacy)

---

## 4. Technical Details

### Features
- Extracts and transforms booking data from emails.
- Robust logic for flagging reservations that need manual review.
- Automatic mapping of properties to canonical names.
- Unit tested with advanced mocks for Airtable.

### Project Structure
```
├── src/
│   ├── services/
│   │   ├── airtable.ts
│   │   ├── gmail.ts
│   │   └── gemini.ts
│   └── ...
├── .env.example
└── ...
```

### Installation & Usage

1.  **Prerequisites**: Node.js, npm.
2.  Clone the repository.
3.  Install dependencies: `npm install`.
4.  Create a `.env` file from `.env.example` and fill in your credentials for Google Cloud, Airtable, and Gemini.
5.  Run the application: `npm start`.

### Running Tests
```sh
npm test
```
