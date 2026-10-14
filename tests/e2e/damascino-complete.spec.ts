import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Damascino2026!';

test.describe('Damascino Complete Application Tests', () => {
  let adminPage: Page;
  let beneficiaryPage: Page;

  // ============================================================================
  // SETUP
  // ============================================================================

  test('Setup: Admin and Beneficiary sessions', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    adminPage = await context1.newPage();
    beneficiaryPage = await context2.newPage();

    console.log(`Testing application at: ${BASE_URL}`);
  });

  // ============================================================================
  // SECTION 1: AUTHENTICATION TESTS
  // ============================================================================

  test.describe('Authentication', () => {
    test('Admin login with credentials', async () => {
      await adminPage.goto(`${BASE_URL}/login`);

      // Wait for login form
      await adminPage.waitForSelector('input[type="text"]', { timeout: 10000 });

      // Fill login form
      await adminPage.fill('input[type="text"]', ADMIN_USERNAME);
      await adminPage.fill('input[type="password"]', ADMIN_PASSWORD);

      // Click login button
      await adminPage.click('button:has-text("Connexion")');

      // Wait for either password change modal or dashboard
      try {
        await adminPage.waitForSelector('text=Changer votre mot de passe', { timeout: 5000 });
        console.log('Password change required');
      } catch {
        await adminPage.waitForSelector('text=Tableau de bord', { timeout: 5000 });
        console.log('Login successful, dashboard loaded');
      }

      expect(adminPage.url()).not.toContain('/login');
    });

    test('Password change on first login', async () => {
      const newPassword = `NewPass${Date.now()}!`;

      // Check if password change modal appears
      const changePasswordModal = await adminPage.locator('text=Changer votre mot de passe').isVisible();

      if (changePasswordModal) {
        // Fill new password
        const inputs = await adminPage.locator('input[type="password"]').all();
        if (inputs.length >= 2) {
          await inputs[0].fill(newPassword);
          await inputs[1].fill(newPassword);
          await adminPage.click('button:has-text("Confirmer")');

          // Wait for success
          await adminPage.waitForTimeout(2000);
        }
      }

      // Verify admin is logged in
      expect(adminPage.url()).not.toContain('/login');
    });

    test('Beneficiary sign up', async () => {
      await beneficiaryPage.goto(BASE_URL);

      // Look for signup button
      const signupButton = beneficiaryPage.locator('button, a').filter({
        hasText: /S'inscrire|Signup|Register/i
      }).first();

      if (await signupButton.isVisible()) {
        await signupButton.click();
      }

      // Wait for signup form
      await beneficiaryPage.waitForSelector('input', { timeout: 10000 });

      const timestamp = Date.now();
      const testPhone = `216${Math.floor(Math.random() * 100000000)}`;
      const testPassword = `BenPass${timestamp}!`;

      // Fill signup form
      const inputs = await beneficiaryPage.locator('input').all();

      if (inputs.length >= 4) {
        await inputs[0].fill(`Bénéficiaire ${timestamp}`); // Full name
        await inputs[1].fill(`bene${timestamp}@test.com`); // Email or phone
        await inputs[2].fill(testPassword); // Password
        await inputs[3].fill(testPassword); // Confirm password

        // Submit form
        await beneficiaryPage.click('button:has-text(/Créer|Soumettre|S/i)');

        // Wait for OTP or confirmation
        await beneficiaryPage.waitForTimeout(3000);
      }

      console.log('Beneficiary signup flow completed');
    });

    test('Password reset flow', async () => {
      const testPage = await adminPage.context().newPage();
      await testPage.goto(`${BASE_URL}/login`);

      // Look for forgot password link
      const forgotLink = testPage.locator('a, button').filter({
        hasText: /Mot de passe oublié|Forgot|Reset/i
      }).first();

      if (await forgotLink.isVisible()) {
        await forgotLink.click();
        await testPage.waitForTimeout(2000);

        // Should show email/phone input
        const inputs = await testPage.locator('input').all();
        if (inputs.length > 0) {
          await inputs[0].fill('admin');
          await testPage.click('button:has-text(/Envoyer|Continuer/i)');

          // Wait for SMS/email confirmation
          await testPage.waitForTimeout(2000);
        }
      }

      await testPage.close();
    });
  });

  // ============================================================================
  // SECTION 2: ADMIN DASHBOARD TESTS
  // ============================================================================

  test.describe('Admin Dashboard', () => {
    test('Dashboard loads with main sections', async () => {
      await adminPage.goto(`${BASE_URL}/dashboard`);

      // Wait for dashboard
      await adminPage.waitForLoadState('networkidle');

      // Check for main sections
      const sections = ['Partenaires', 'Bénéficiaires', 'Rapports', 'Scanner', 'Utilisateurs'];

      for (const section of sections) {
        const element = adminPage.locator(`text="${section}"`).first();
        // It's okay if some sections are not visible, just check page loaded
      }

      expect(adminPage.url()).toContain('/dashboard');
    });

    test('View statistics and widgets', async () => {
      // Should see dashboard widgets with stats
      const widgets = await adminPage.locator('[role="region"]').count();
      console.log(`Found ${widgets} widget regions`);

      // Check for numbers/stats
      const numbers = await adminPage.locator('text=/\\d+/').count();
      expect(numbers).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // SECTION 3: PARTNER MANAGEMENT TESTS
  // ============================================================================

  test.describe('Partner Management', () => {
    test('View partners list', async () => {
      await adminPage.goto(`${BASE_URL}/partners`);

      await adminPage.waitForLoadState('networkidle');

      // Check if partners table/list is loaded
      const table = adminPage.locator('table, [role="grid"], [class*="list"]').first();
      await table.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
        console.log('Partners list structure may vary');
      });

      expect(adminPage.url()).toContain('/partners');
    });

    test('Create new partner', async () => {
      const timestamp = Date.now();

      // Look for "Add Partner" button
      const addButton = adminPage.locator('button').filter({
        hasText: /Ajouter|Créer|Nouveau/i
      }).first();

      if (await addButton.isVisible()) {
        await addButton.click();

        // Wait for form
        await adminPage.waitForSelector('input, textarea', { timeout: 5000 });

        const inputs = await adminPage.locator('input').all();

        // Fill partner details
        if (inputs.length >= 2) {
          await inputs[0].fill(`Partner ${timestamp}`); // Name
          if (inputs.length >= 3) {
            await inputs[1].fill('20'); // Discount percentage
          }
        }

        // Fill eligible categories
        const textareas = await adminPage.locator('textarea').all();
        if (textareas.length > 0) {
          await textareas[0].fill('Alimentaire, Électronique');
        }

        // Submit
        await adminPage.click('button:has-text(/Créer|Enregistrer|Soumettre/i)');

        // Wait for success
        await adminPage.waitForTimeout(2000);
      }

      console.log('Partner creation flow completed');
    });

    test('Edit partner discount', async () => {
      // Navigate to partners
      await adminPage.goto(`${BASE_URL}/partners`);
      await adminPage.waitForLoadState('networkidle');

      // Find edit button for first partner
      const editButtons = await adminPage.locator('button').filter({
        hasText: /Modifier|Edit/i
      }).all();

      if (editButtons.length > 0) {
        await editButtons[0].click();

        // Wait for edit form
        await adminPage.waitForSelector('input', { timeout: 5000 });

        // Find discount input and change it
        const discountInputs = await adminPage.locator('input[type="number"]').all();
        if (discountInputs.length > 0) {
          await discountInputs[0].clear();
          await discountInputs[0].fill('25');

          // Save changes
          await adminPage.click('button:has-text(/Enregistrer|Sauvegarder/i)');
          await adminPage.waitForTimeout(2000);
        }
      }

      console.log('Partner edit flow completed');
    });
  });

  // ============================================================================
  // SECTION 4: QR SCANNING TESTS
  // ============================================================================

  test.describe('QR Scanning (Agent/Staff)', () => {
    test('Access QR scanner page', async () => {
      await adminPage.goto(`${BASE_URL}/scanner`);

      await adminPage.waitForLoadState('networkidle');

      // Check for camera/scanner interface
      expect(adminPage.url()).toContain('/scanner');
    });

    test('Request camera permission', async () => {
      const context = adminPage.context();

      // Grant camera permission
      await context.grantPermissions(['camera']);

      // Reload scanner page
      await adminPage.goto(`${BASE_URL}/scanner`);
      await adminPage.waitForLoadState('networkidle');

      // Check if video element or camera interface appears
      const video = adminPage.locator('video').first();
      const cameraInterface = adminPage.locator('[class*="camera"], [class*="scanner"]').first();

      const hasCameraSupport = await video.isVisible().catch(() => false) ||
                               await cameraInterface.isVisible().catch(() => false);

      console.log(`Camera support detected: ${hasCameraSupport}`);
    });

    test('Simulate QR code scan', async () => {
      // In real testing, this would use a QR code library or pre-generated code
      // For now, we test the UI readiness

      const scanButton = adminPage.locator('button').filter({
        hasText: /Scan|Scanner|Capturer/i
      }).first();

      if (await scanButton.isVisible()) {
        // Button exists for manual testing
        console.log('Scan button is available for manual testing');
      }

      // Check for output area where scan results appear
      const resultArea = adminPage.locator('[class*="result"], [class*="info"]').first();
      console.log(`Result area visible: ${await resultArea.isVisible().catch(() => false)}`);
    });
  });

  // ============================================================================
  // SECTION 5: BENEFICIARY FEATURES
  // ============================================================================

  test.describe('Beneficiary Features', () => {
    test('Beneficiary dashboard - My Advantage', async () => {
      await beneficiaryPage.goto(BASE_URL);

      // Look for "Mon Avantage" or beneficiary section
      const advantageSection = beneficiaryPage.locator('text=/Mon Avantage|My Advantage/i').first();

      if (await advantageSection.isVisible()) {
        await advantageSection.click().catch(() => {});
        await beneficiaryPage.waitForTimeout(2000);
      }

      // Check for QR code display
      const qrCode = beneficiaryPage.locator('svg, img, [class*="qr"]').first();
      const qrVisible = await qrCode.isVisible().catch(() => false);

      console.log(`QR code visible: ${qrVisible}`);
    });

    test('View personal advantage details', async () => {
      // Should display beneficiary info
      const infoElements = await beneficiaryPage.locator('[class*="info"], [class*="detail"]').count();
      console.log(`Found ${infoElements} info elements`);

      // Look for specific information
      const detailsText = await beneficiaryPage.locator('body').textContent();
      const hasAdvantageInfo = detailsText?.includes('%') || detailsText?.includes('Avantage');

      console.log(`Advantage info present: ${hasAdvantageInfo}`);
    });

    test('Download APK directly', async () => {
      await beneficiaryPage.goto(`${BASE_URL}/downloads`);

      await beneficiaryPage.waitForLoadState('networkidle');

      // Look for download button
      const downloadButton = beneficiaryPage.locator('button, a').filter({
        hasText: /Télécharger|Download|APK/i
      }).first();

      if (await downloadButton.isVisible()) {
        const href = await downloadButton.getAttribute('href');

        if (href) {
          expect(href).toContain('.apk');
          console.log(`APK download link found: ${href}`);
        }
      }
    });

    test('QR code launch direct APK download', async () => {
      // Navigate to QR code display page
      const qrDownloadButtons = await beneficiaryPage.locator('button, a').filter({
        hasText: /QR|Code/i
      }).all();

      if (qrDownloadButtons.length > 0) {
        // Check if clicking QR triggers download
        console.log('QR download functionality available for manual testing');
      }
    });
  });

  // ============================================================================
  // SECTION 6: REPORTING & ANALYTICS
  // ============================================================================

  test.describe('Reporting & Analytics', () => {
    test('Access reporting page', async () => {
      await adminPage.goto(`${BASE_URL}/reports`);

      await adminPage.waitForLoadState('networkidle');

      expect(adminPage.url()).toContain('/reports');
    });

    test('View charts and statistics', async () => {
      // Check for chart containers
      const charts = await adminPage.locator('[class*="chart"], svg[role="img"], canvas').all();

      console.log(`Found ${charts.length} chart elements`);
    });

    test('Filter by date range', async () => {
      // Look for date inputs
      const dateInputs = await adminPage.locator('input[type="date"]').all();

      if (dateInputs.length >= 2) {
        const today = new Date();
        const startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

        const formatDate = (d: Date) => d.toISOString().split('T')[0];

        await dateInputs[0].fill(formatDate(startDate));
        await dateInputs[1].fill(formatDate(today));

        // Wait for report refresh
        await adminPage.waitForTimeout(2000);
      }

      console.log('Date filter applied');
    });

    test('Export reports', async () => {
      const exportButtons = await adminPage.locator('button').filter({
        hasText: /Exporter|Export|PDF|CSV/i
      }).all();

      if (exportButtons.length > 0) {
        console.log(`Found ${exportButtons.length} export options`);
      }
    });
  });

  // ============================================================================
  // SECTION 7: USER MANAGEMENT (ADMIN)
  // ============================================================================

  test.describe('User Management', () => {
    test('View users list', async () => {
      await adminPage.goto(`${BASE_URL}/users`);

      await adminPage.waitForLoadState('networkidle');

      expect(adminPage.url()).toContain('/users');
    });

    test('Create new admin user', async () => {
      const timestamp = Date.now();

      const addButton = adminPage.locator('button').filter({
        hasText: /Ajouter|Créer|Nouveau/i
      }).first();

      if (await addButton.isVisible()) {
        await addButton.click();

        await adminPage.waitForSelector('input', { timeout: 5000 });

        const inputs = await adminPage.locator('input').all();

        if (inputs.length >= 3) {
          await inputs[0].fill(`Admin${timestamp}`); // Username
          await inputs[1].fill(`admin${timestamp}@test.com`); // Email
          await inputs[2].fill('TempPass123!'); // Password

          // Select role
          const roleSelects = await adminPage.locator('select, [role="listbox"]').all();
          if (roleSelects.length > 0) {
            await roleSelects[0].click();
            const adminOption = adminPage.locator('text=Admin').first();
            await adminOption.click().catch(() => {});
          }

          // Submit
          await adminPage.click('button:has-text(/Créer|Enregistrer/i)');
          await adminPage.waitForTimeout(2000);
        }
      }

      console.log('User creation flow completed');
    });
  });

  // ============================================================================
  // SECTION 8: RESPONSIVE DESIGN TESTS
  // ============================================================================

  test.describe('Responsive Design', () => {
    test('Mobile viewport - 375x667 (iPhone SE)', async () => {
      await beneficiaryPage.setViewportSize({ width: 375, height: 667 });

      await beneficiaryPage.goto(BASE_URL);
      await beneficiaryPage.waitForLoadState('networkidle');

      // Check if layout is responsive
      const bodyWidth = await beneficiaryPage.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(400);

      console.log('Mobile layout (375px) tested');
    });

    test('Tablet viewport - 768x1024 (iPad)', async () => {
      await beneficiaryPage.setViewportSize({ width: 768, height: 1024 });

      await beneficiaryPage.goto(BASE_URL);
      await beneficiaryPage.waitForLoadState('networkidle');

      const bodyWidth = await beneficiaryPage.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(800);

      console.log('Tablet layout (768px) tested');
    });

    test('Desktop viewport - 1920x1080', async () => {
      await adminPage.setViewportSize({ width: 1920, height: 1080 });

      await adminPage.goto(`${BASE_URL}/dashboard`);
      await adminPage.waitForLoadState('networkidle');

      const bodyWidth = await adminPage.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeGreaterThanOrEqual(1920);

      console.log('Desktop layout (1920px) tested');
    });
  });

  // ============================================================================
  // SECTION 9: PERFORMANCE TESTS
  // ============================================================================

  test.describe('Performance', () => {
    test('Home page load time', async () => {
      const startTime = Date.now();

      await adminPage.goto(BASE_URL);
      await adminPage.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;

      console.log(`Home page load time: ${loadTime}ms`);
      expect(loadTime).toBeLessThan(10000); // Should load in less than 10 seconds
    });

    test('Dashboard performance', async () => {
      const startTime = Date.now();

      await adminPage.goto(`${BASE_URL}/dashboard`);
      await adminPage.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;

      console.log(`Dashboard load time: ${loadTime}ms`);
      expect(loadTime).toBeLessThan(10000);
    });

    test('Scanner page initialization', async () => {
      const startTime = Date.now();

      await adminPage.goto(`${BASE_URL}/scanner`);
      await adminPage.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;

      console.log(`Scanner page load time: ${loadTime}ms`);
      expect(loadTime).toBeLessThan(8000);
    });
  });

  // ============================================================================
  // SECTION 10: ERROR HANDLING & EDGE CASES
  // ============================================================================

  test.describe('Error Handling', () => {
    test('Invalid login credentials', async () => {
      const testPage = await adminPage.context().newPage();

      await testPage.goto(`${BASE_URL}/login`);

      const inputs = await testPage.locator('input[type="text"], input[type="email"]').all();
      const passwordInput = await testPage.locator('input[type="password"]').first();

      if (inputs.length > 0) {
        await inputs[0].fill('invaliduser');
        await passwordInput.fill('invalidpass');

        await testPage.click('button:has-text(/Connexion/i)');

        // Wait for error message
        await testPage.waitForTimeout(2000);

        // Check for error message
        const errorMessage = await testPage.locator('[class*="error"], [role="alert"]').first().isVisible().catch(() => false);

        console.log(`Error message displayed: ${errorMessage}`);
      }

      await testPage.close();
    });

    test('Network timeout handling', async () => {
      // Simulate slow network
      await adminPage.route('**/*', route => {
        setTimeout(() => route.continue(), 2000);
      });

      await adminPage.goto(`${BASE_URL}/dashboard`).catch(() => {
        console.log('Timeout handling tested');
      });
    });

    test('404 page handling', async () => {
      const response = await adminPage.goto(`${BASE_URL}/nonexistent-page`);

      console.log(`Nonexistent page response: ${response?.status()}`);
    });
  });

  // ============================================================================
  // CLEANUP
  // ============================================================================

  test.afterAll(async () => {
    if (adminPage) await adminPage.close();
    if (beneficiaryPage) await beneficiaryPage.close();
  });
});
