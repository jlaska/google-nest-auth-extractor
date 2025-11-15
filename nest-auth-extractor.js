const { chromium } = require('playwright');
const fs = require('fs');

// Parse command-line arguments
const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');

// Logging helper
function log(message, alwaysShow = false) {
  if (verbose || alwaysShow) {
    console.log(message);
  }
}

async function extractNestCredentials() {
  log('🚀 Starting Nest authentication credential extractor...\n', true);

  // Launch browser in non-headless mode so user can interact
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      // Explicitly allow third-party cookies
      '--disable-features=SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure'
    ]
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    // Accept downloads and other features
    acceptDownloads: true
  });

  const page = await context.newPage();

  let issueToken = null;
  let cookies = null;
  let foundOauth2Iframe = false;

  // Set up network monitoring
  log('📡 Setting up network monitoring...');

  // Listen for iframerpc RESPONSE to capture issue_token from response body
  page.on('response', async response => {
    const url = response.url();

    // Capture issue_token from iframerpc response
    if (url.includes('iframerpc') && url.includes('issueToken')) {
      try {
        log('✅ Found iframerpc call with issueToken!');
        const text = await response.text();
        log('   Response preview:', text.substring(0, 150) + '...\n');

        // The response should contain the issue_token
        // It might be in the response body directly or we need the full URL
        issueToken = url; // Store the full URL as per documentation
        log('📋 Issue Token URL captured', true);
      } catch (error) {
        log('   ⚠️  Could not read response:', error.message);
      }
    }

    // Detect oauth2/iframe calls (we'll capture cookies after authentication)
    if (url.includes('oauth2/iframe') && !foundOauth2Iframe) {
      foundOauth2Iframe = true;
      log('✅ Found oauth2/iframe call - will capture cookies after auth completes\n');
    }
  });

  try {
    // Navigate to home.nest.com
    log('🌐 Navigating to home.nest.com...', true);
    await page.goto('https://home.nest.com', { waitUntil: 'networkidle' });

    console.log('\n⏸️  PLEASE COMPLETE THE FOLLOWING STEPS:');
    console.log('   1. Click "Sign in with Google"');
    console.log('   2. Enter your Google credentials');
    console.log('   3. Complete any 2FA if required');
    console.log('   4. Wait for the Nest dashboard to load');
    console.log('   5. DO NOT log out\n');
    console.log('   The script will automatically detect and extract the credentials.');
    console.log('   Press Ctrl+C when you see "✅ SUCCESS" message below.\n');

    // Wait for user to complete authentication
    // We'll check every 5 seconds if we have the issue token
    const maxWaitTime = 5 * 60 * 1000; // 5 minutes
    const checkInterval = 5000; // 5 seconds
    let elapsed = 0;

    while (!issueToken && elapsed < maxWaitTime) {
      await page.waitForTimeout(checkInterval);
      elapsed += checkInterval;
      if (verbose) {
        console.log('⏳ Waiting for authentication... (' + Math.floor(elapsed/1000) + 's)');
      } else {
        // Show progress dots in non-verbose mode
        process.stdout.write('.');
      }
    }

    if (!verbose && elapsed > 0) {
      console.log(); // New line after progress dots
    }

    // Once we have the issue token, capture all cookies from accounts.google.com
    if (issueToken) {
      log('🍪 Capturing cookies from browser context...');
      const allCookies = await context.cookies();

      // Filter for Google account cookies and format them as a cookie header string
      const googleCookies = allCookies
        .filter(cookie => cookie.domain.includes('google.com'))
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join('; ');

      if (googleCookies) {
        cookies = googleCookies;
        const cookieCount = allCookies.filter(c => c.domain.includes('google.com')).length;
        log('✅ Captured ' + cookieCount + ' Google cookies');
        log('   Total cookie string length: ' + googleCookies.length + ' characters');
      } else {
        log('⚠️  No Google cookies found');
      }
    }

    if (issueToken && cookies) {
      console.log('\n🎉 ✅ SUCCESS! Credentials captured!\n');

      // According to the documentation, we need the entire URL starting from accounts.google.com
      // This is the issue_token value
      const issueTokenValue = issueToken;

      // Save to file
      const output = {
        issue_token: issueTokenValue,
        cookies: cookies,
        captured_at: new Date().toISOString(),
        note: 'Do not log out of home.nest.com as this will invalidate these credentials'
      };

      const outputFile = 'nest-credentials.json';
      fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

      console.log('📁 Credentials saved to:', outputFile);

      if (verbose) {
        console.log('\n📋 ISSUE_TOKEN:');
        console.log(issueTokenValue);
        console.log('\n🍪 COOKIES:');
        console.log(cookies.substring(0, 100) + '...');
      }

      console.log('\n⚠️  IMPORTANT: Do not log out of home.nest.com!');
      console.log('⚠️  These credentials will be invalidated if you log out.\n');

      // Keep browser open for 10 seconds so user can see the result
      console.log('Browser will close in 10 seconds...');
      await page.waitForTimeout(10000);
    } else {
      console.log('\n❌ Failed to capture credentials within the time limit.');
      console.log('Please try again and ensure you complete the authentication process.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

// Run the extractor
extractNestCredentials().catch(console.error);
