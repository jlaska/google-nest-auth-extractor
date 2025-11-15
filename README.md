# Nest Authentication Extractor

Automates the extraction of `issue_token` and `cookies` credentials needed for the [ha-nest-protect](https://github.com/iMicknl/ha-nest-protect) Home Assistant integration.

## Purpose

This tool uses Playwright to automate the manual process of capturing Google Nest authentication credentials by monitoring network traffic during the Google sign-in flow. It eliminates the need to manually inspect browser developer tools.

## Installation

```bash
npm install
npx playwright install chromium
```

## Usage

Run the script and follow the on-screen prompts:

```bash
npm run nest-auth
```

The script will:
1. Open a Chrome browser window to home.nest.com
2. Prompt you to sign in with your Google account
3. Automatically capture the authentication credentials
4. Save them to `nest-credentials.json`

**Important:** Do not log out of home.nest.com after extraction - this will invalidate the credentials.

## Using the Credentials

Add the extracted values to your Home Assistant configuration:

```yaml
nest_protect:
  issue_token: "paste-issue-token-here"
  cookies: "paste-cookies-here"
```

## License

MIT
