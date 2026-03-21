const { test, expect } = require('@playwright/test');

function registrationPayload(overrides = {}) {
  return {
    emailVerificationEnabled: true,
    recaptchaEnabled: true,
    captchaProvider: 'recaptcha',
    recaptchaSiteKey: 'site-key-demo',
    ...overrides
  };
}

async function mockRegistrationSettings(page, payload) {
  await page.route('**/api/public/registration-settings', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        message: 'success',
        data: payload
      })
    });
  });
}

async function mockCaptchaProvider(page, provider) {
  const isTurnstile = provider === 'turnstile';
  const url = isTurnstile
    ? '**/challenges.cloudflare.com/turnstile/v0/api.js**'
    : '**/www.google.com/recaptcha/api.js**';

  const body = isTurnstile
    ? `
      window.__e2eCaptchaProvider = 'turnstile';
      window.turnstile = {
        render(selector, options) {
          const target = document.querySelector(selector);
          if (target) target.setAttribute('data-rendered-provider', 'turnstile');
          window.__e2eCaptchaSiteKey = options.sitekey;
          return 'turnstile-widget';
        },
        getResponse() {
          return 'turnstile-token';
        }
      };
      if (typeof window.onCaptchaApiReady === 'function') window.onCaptchaApiReady();
    `
    : `
      window.__e2eCaptchaProvider = 'recaptcha';
      window.grecaptcha = {
        render(targetId, options) {
          const target = document.getElementById(targetId);
          if (target) target.setAttribute('data-rendered-provider', 'recaptcha');
          window.__e2eCaptchaSiteKey = options.sitekey;
          return 'recaptcha-widget';
        },
        getResponse() {
          return 'recaptcha-token';
        }
      };
      if (typeof window.onCaptchaApiReady === 'function') window.onCaptchaApiReady();
    `;

  await page.route(url, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body
    });
  });
}

test.describe('Register page captcha provider', () => {
  test('renders Google reCAPTCHA when public settings request recaptcha', async ({ page, baseURL }) => {
    const payload = registrationPayload({
      captchaProvider: 'recaptcha',
      recaptchaSiteKey: 'google-site-key'
    });

    await mockRegistrationSettings(page, payload);
    await mockCaptchaProvider(page, 'recaptcha');

    await page.goto(`${baseURL}/register.html`);

    await expect(page.locator('#verificationCodeGroup')).toBeVisible();
    await expect(page.locator('#sendCodeBtn')).toBeVisible();
    await expect(page.locator('#captchaContainer')).not.toHaveClass(/hidden/);
    await expect(page.locator('#captcha-widget')).toHaveAttribute('data-rendered-provider', 'recaptcha');
    await expect.poll(async () => page.evaluate(() => window.__e2eCaptchaProvider)).toBe('recaptcha');
    await expect.poll(async () => page.evaluate(() => window.__e2eCaptchaSiteKey)).toBe('google-site-key');
  });

  test('renders Cloudflare Turnstile when public settings request turnstile', async ({ page, baseURL }) => {
    const payload = registrationPayload({
      captchaProvider: 'turnstile',
      recaptchaSiteKey: 'turnstile-site-key'
    });

    await mockRegistrationSettings(page, payload);
    await mockCaptchaProvider(page, 'turnstile');

    await page.goto(`${baseURL}/register.html`);

    await expect(page.locator('#verificationCodeGroup')).toBeVisible();
    await expect(page.locator('#sendCodeBtn')).toBeVisible();
    await expect(page.locator('#captchaContainer')).not.toHaveClass(/hidden/);
    await expect(page.locator('#captcha-widget')).toHaveAttribute('data-rendered-provider', 'turnstile');
    await expect.poll(async () => page.evaluate(() => window.__e2eCaptchaProvider)).toBe('turnstile');
    await expect.poll(async () => page.evaluate(() => window.__e2eCaptchaSiteKey)).toBe('turnstile-site-key');
  });

  test('hides email verification and captcha UI when public settings disable them', async ({ page, baseURL }) => {
    const payload = registrationPayload({
      emailVerificationEnabled: false,
      recaptchaEnabled: false,
      recaptchaSiteKey: '',
      captchaProvider: 'recaptcha'
    });

    await mockRegistrationSettings(page, payload);
    await page.goto(`${baseURL}/register.html`);

    await expect(page.locator('#verificationCodeGroup')).toHaveClass(/hidden/);
    await expect(page.locator('#sendCodeBtn')).toHaveClass(/hidden/);
    await expect(page.locator('#sendCodeBtn')).toBeDisabled();
    await expect(page.locator('#captchaContainer')).toHaveClass(/hidden/);
    await expect(page.locator('#captchaContainer')).toBeEmpty();
  });
});
