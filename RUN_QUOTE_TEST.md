How to test Quote modal (temporary helper)

This file explains the temporary "Test Quote" helper added to the Run preview.

What was added
- A visible "Test Quote" button in the Run header.
- A client-side handler that calls a mock API endpoint (example URL) and opens the runtime modal with the JSON response.
- The modal displays the response using `client/components/test-display-element.tsx`.
- Toasts are shown: a transient "Fetching quote..." and then "Quote fetched successfully." on success.

How to run
1. Start the client dev server (from workspace root):

```powershell
cd 'c:\Users\adiap\OneDrive\Documents\FloNeo\client'
npm run dev
```

2. Open the run preview in your browser (example):

```
http://localhost:3000/run?appId=1&pageId=page-1
```

3. Click the "Test Quote" button in the header.

Expected behavior
- A short "Fetching quote..." toast appears.
- The mock API is called; the JSON response is logged in the browser console with prefix "🌐 [TEST-QUOTE] Mock API response:".
- A modal opens showing the JSON response (pretty-printed).
- A success toast "Quote fetched successfully." appears.
- The modal Close button closes the modal without errors.

If something fails
- Check browser console for logs and errors.
- Ensure the client server is running and reachable.

Notes
- The mock URL used is an example and can be changed in `client/app/run/page.tsx` (the `handleTestQuote` function).
- The permanent Get Quote workflow should use server-side `http.request` blocks; the front-end detects returned HTTP objects and modal actions and renders them in the runtime modal.
