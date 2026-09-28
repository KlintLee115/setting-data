# Contributing

## Setup

- Install Node.js 22 or newer.
- Run `npm ci` from the repository root.
- Load the repository folder into Chrome as an unpacked extension using the README instructions.

## Source of truth

Chrome currently runs the JavaScript files in `scripts/`. Make runtime changes there and update the corresponding tests. The TypeScript files in `src/` are a migration in progress: they are typechecked, but Chrome does not load them. Keep the two implementations aligned when editing behavior represented in both places.

## Before opening a pull request

Run:

```powershell
npm run check
```

For changes to the extension UI or GoHighLevel integration, also reload the unpacked extension in `chrome://extensions`, refresh the GoHighLevel tab, and exercise the changed workflow manually. Do not use real customer information in tests or screenshots.

Keep pull requests focused, describe the user-visible behavior change, and include or update tests for changed logic.