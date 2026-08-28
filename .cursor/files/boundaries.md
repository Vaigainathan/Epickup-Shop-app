# Project boundaries — read before making changes

- NEVER modify files in driver-app/ — this app needs zero changes for the marketplace update.
- In backend/, customer-app/, and admin-dashboard/: only add NEW files for marketplace features.
  Never edit existing production files (e.g. booking.js, payments.js, customer.js, driver.js in backend/).
- Before making any change, confirm the current git branch is marketplace-dev, not main.
- shop-app/ is a brand-new project — normal editing rules apply, no restrictions.
- Never launch a separate `expo start --web` process for verification. 
  Metro is already running and connected to a physical device for testing — 
  use that, don't spin up a second instance.
-Figma is a reference for layout, spacing, and component structure only. Never carry forward literal placeholder content — dummy shop names, sample product names, mock order data, category examples shown in mockups — into real code, defaults, or seed data. Treat all visible Figma text content as illustrative unless explicitly specified in the Workflow or Architecture Blueprint.
-Never read or write any file via an absolute path that resolves outside this workspace folder (c:\Dev\EPickup-app\shop-app). If backend work is needed, tell the user explicitly that this requires the separate backend Cursor window — do not attempt to reach it directly, even if the path is known from earlier context.