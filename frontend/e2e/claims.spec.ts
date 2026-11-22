import { test, expect, Page, APIRequestContext } from '@playwright/test';

const evidence = { name: 'evidence.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nCHUBB browser test evidence\n%%EOF') };
const staffHeaders = { Authorization: 'Bearer staff-demo' };
const managerHeaders = { Authorization: 'Bearer manager-demo' };

async function signIn(page: Page, role: 'Customer' | 'Claims Staff' | 'Manager') {
  await page.goto('/login');
  await page.getByRole('button', { name: new RegExp(`^${role}\\b`) }).click();
  await page.getByRole('button', { name: `Continue as ${role}`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${role === 'Customer' ? 'customer' : role === 'Manager' ? 'manager' : 'staff'}$`));
}
async function createClaim(page: Page, type: 'Motor' | 'Property', documents = true) {
  await signIn(page, 'Customer');
  await page.goto('/customer/submit');
  await page.getByLabel('Claim type', { exact: true }).selectOption(type);
  await page.getByLabel('Incident date', { exact: true }).fill('2026-01-01');
  await page.getByLabel('Incident details', { exact: true }).fill(`Browser verified ${type} incident ${Date.now()}`);
  await page.getByLabel('Claimed amount (MYR)', { exact: true }).fill('2500.50');
  if (documents) await page.getByLabel('Select supporting documents (optional)', { exact: true }).setInputFiles(evidence);
  await page.getByRole('button', { name: 'Submit claim', exact: true }).click();
  await expect(page).toHaveURL(/\/claims\/[a-f\d-]{36}$/);
  const id = page.url().split('/').pop()!;
  await expect(page.getByRole('heading', { name: `Claim ${id.slice(0, 8).toUpperCase()}`, exact: true })).toBeVisible();
  return id;
}
async function outstanding(request: APIRequestContext) {
  const response = await request.get('/api/manager/outstanding', { headers: managerHeaders });
  expect(response.ok()).toBeTruthy(); return response.json();
}
async function openClaim(page: Page, id: string) { await page.goto(`/claims/${id}`); await expect(page.getByRole('heading', { name: `Claim ${id.slice(0, 8).toUpperCase()}`, exact: true })).toBeVisible(); }
async function noPageOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy(); }

for (const [type, decision] of [['Motor', 'Approved'], ['Property', 'Rejected']] as const) {
  test(`${type} full real API workflow ends ${decision}`, async ({ page, request }, info) => {
    const failures: string[] = [];
    page.on('pageerror', error => failures.push(error.message));
    const baseline = await outstanding(request);
    const id = await createClaim(page, type);
    await page.goto('/customer/claims');
    await expect(page.getByRole('link', { name: id.slice(0, 8).toUpperCase(), exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByRole('link', { name: id.slice(0, 8).toUpperCase(), exact: true }).click();
    await expect(page.getByRole('heading', { name: `Claim ${id.slice(0, 8).toUpperCase()}`, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Estimated liability', exact: true })).toHaveCount(0);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download evidence.pdf', exact: true }).click();
    expect((await download).suggestedFilename()).toBe('evidence.pdf');
    await signIn(page, 'Manager');
    await expect(page.getByTestId('manager-outstanding')).toHaveText(String(baseline.count + 1));
    await expect(page.getByRole('link', { name: id.slice(0, 8).toUpperCase(), exact: true })).toBeVisible();
    await noPageOverflow(page);
    await page.screenshot({ path: info.outputPath('manager-outstanding.png'), fullPage: true });

    await signIn(page, 'Claims Staff');
    await page.goto('/staff/queue');
    const queueLink = page.getByRole('link', { name: id.slice(0, 8).toUpperCase(), exact: true });
    await queueLink.scrollIntoViewIfNeeded();
    await expect(queueLink).toBeInViewport();
    await queueLink.click();
    await page.getByRole('button', { name: 'Start review', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Save estimate', exact: true })).toBeVisible();
    await page.getByLabel('Estimated liability (MYR)', { exact: true }).fill('1800.25');
    await page.getByRole('button', { name: 'Save estimate', exact: true }).click();
    await expect(page.locator('.saved-estimate')).toContainText('1,800.25');
    await page.getByLabel('Information needed and reason', { exact: true }).fill('Please provide a repair quotation to verify the damage.');
    await page.getByRole('button', { name: 'Request information', exact: true }).click();
    await expect(page.getByText('Awaiting a customer reply. Decisions become available', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Review decision', exact: true })).toHaveCount(0);

    await signIn(page, 'Customer');
    await openClaim(page, id);
    await page.getByLabel('Your reply', { exact: true }).fill('The attached quotation confirms the repair cost.');
    await page.getByLabel('Attach supporting documents (optional)', { exact: true }).setInputFiles({ ...evidence, name: 'quotation.pdf' });
    await page.getByRole('button', { name: 'Send reply', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Send reply', exact: true })).toHaveCount(0);
    await expect(page.locator('.customer-reply')).toContainText('quotation.pdf');
    await expect(page.getByText('1,800.25', { exact: false })).toHaveCount(0);

    await signIn(page, 'Claims Staff');
    await openClaim(page, id);
    await expect(page.locator('.customer-reply')).toContainText('quotation confirms');
    await page.getByLabel('Decision', { exact: true }).selectOption(decision);
    await page.getByLabel('Decision reason', { exact: true }).fill(decision === 'Approved' ? 'Covered damage supported by the quotation.' : 'The loss falls outside the demonstrated coverage.');
    await page.getByRole('button', { name: 'Review decision', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm decision', exact: true }).click();
    await expect(page.locator('.decision-banner')).toContainText(`Claim ${decision.toLowerCase()}`);
    await expect(page.getByRole('button', { name: 'Save estimate', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Review decision', exact: true })).toHaveCount(0);

    await signIn(page, 'Customer');
    await openClaim(page, id);
    await expect(page.locator('.decision-banner')).toContainText(decision === 'Approved' ? 'Covered damage' : 'outside');
    await expect(page.getByRole('heading', { name: 'Estimated liability', exact: true })).toHaveCount(0);
    await expect(page.locator('.timeline li')).toHaveCount(7);
    await noPageOverflow(page);
    await page.screenshot({ path: info.outputPath('customer-decision.png'), fullPage: true });
    await signIn(page, 'Manager');
    await expect(page.getByTestId('manager-outstanding')).toHaveText(String(baseline.count));
    await expect(page.getByRole('link', { name: id.slice(0, 8).toUpperCase(), exact: true })).toHaveCount(0);
    expect(failures).toEqual([]);
  });
}

test('form and upload validation, zero estimate, and required decision reason', async ({ page }) => {
  await signIn(page, 'Customer');
  await page.goto('/customer/submit');
  await page.getByRole('button', { name: 'Submit claim', exact: true }).click();
  await expect(page.getByText('Choose a date from 1900 through today.', { exact: true })).toBeVisible();
  await page.getByLabel('Claimed amount (MYR)', { exact: true }).fill('1.001');
  await page.getByRole('button', { name: 'Submit claim', exact: true }).click();
  await expect(page.getByLabel('Claimed amount (MYR)', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  const input = page.getByLabel('Select supporting documents (optional)', { exact: true });
  await input.setInputFiles({ name: 'unsafe.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('unsafe') });
  await expect(page.getByRole('button', { name: 'Submit claim', exact: true })).toBeDisabled();
  await expect(page.getByText('use PDF, JPG/JPEG or PNG', { exact: false })).toBeVisible();
  await input.setInputFiles({ ...evidence, buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect(page.getByText('files must be nonempty and no larger than 5 MiB.', { exact: false })).toBeVisible();
  await input.setInputFiles(Array.from({ length: 6 }, (_, index) => ({ ...evidence, name: `file${index}.pdf` })));
  await expect(page.getByText('Select no more than five files per upload.', { exact: true })).toBeVisible();
  const id = await createClaim(page, 'Motor', false);
  await signIn(page, 'Claims Staff'); await openClaim(page, id);
  await page.getByRole('button', { name: 'Start review', exact: true }).click();
  await page.getByRole('button', { name: 'Review decision', exact: true }).click();
  await expect(page.getByText('Enter a decision reason containing 1–4000 characters.', { exact: true })).toBeVisible();
  await page.getByLabel('Decision reason', { exact: true }).fill('Covered with no expected liability.');
  await page.getByRole('button', { name: 'Review decision', exact: true }).click();
  await expect(page.getByText('Save an estimated liability before approving', { exact: false })).toBeVisible();
  await page.getByLabel('Estimated liability (MYR)', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Save estimate', exact: true }).click();
  await expect(page.locator('.saved-estimate')).toContainText('0.00');
  await page.getByRole('button', { name: 'Review decision', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm decision', exact: true }).click();
  await expect(page.locator('.decision-banner')).toContainText('Claim approved');
});

test('route guards, backend ownership and role permissions, missing claims, logout', async ({ page, request }) => {
  await page.goto('/staff/queue'); await expect(page).toHaveURL(/\/login$/);
  const id = await createClaim(page, 'Property', false);
  await page.goto('/staff/queue'); await expect(page.getByRole('heading', { name: 'Access restricted', exact: true })).toBeVisible();
  const bob = await request.get(`/api/claims/${id}`, { headers: { Authorization: 'Bearer customer-bob' } }); expect(bob.status()).toBe(404);
  const forbidden = await request.get('/api/manager/outstanding', { headers: { Authorization: 'Bearer customer-alice' } }); expect(forbidden.status()).toBe(403);
  await page.goto('/claims/00000000-0000-0000-0000-000000000000');
  await expect(page.getByText('This claim or document was not found', { exact: false })).toBeVisible();
  await noPageOverflow(page);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await expect(page).toHaveURL(/\/login$/);
  await page.goto('/customer'); await expect(page).toHaveURL(/\/login$/);
});

test('stale version is explained and reload recovers without replaying a write', async ({ page, request }) => {
  const id = await createClaim(page, 'Motor', false);
  await signIn(page, 'Claims Staff'); await openClaim(page, id);
  const current = await (await request.get(`/api/claims/${id}`, { headers: staffHeaders })).json();
  const update = await request.post(`/api/claims/${id}/review`, { headers: { ...staffHeaders, 'If-Match': `"${current.claim.version}"` } }); expect(update.ok()).toBeTruthy();
  await page.getByRole('button', { name: 'Start review', exact: true }).click();
  await expect(page.getByText('This claim changed since you opened it.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start review', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Reload claim', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save estimate', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start review', exact: true })).toHaveCount(0);
});

test('manager auto-refreshes server reports and stays read-only', async ({ page, request }) => {
  const id = await createClaim(page, 'Property', false);
  await signIn(page, 'Manager');
  await expect(page.getByTestId('manager-outstanding')).toBeVisible();
  const prior = Number(await page.getByTestId('manager-outstanding').textContent());
  await openClaim(page, id);
  await expect(page.getByRole('button', { name: 'Start review', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save estimate', exact: true })).toHaveCount(0);
  await page.goto('/manager');
  // Let both real report requests finish before changing the claim; otherwise the
  // independently queried totals and table can straddle the external decision.
  await expect(page.getByTestId('manager-outstanding')).toHaveText(String(prior));
  await expect(page.getByRole('link', { name: id.slice(0, 8).toUpperCase(), exact: true })).toBeVisible();
  const before = await (await request.get(`/api/claims/${id}`, { headers: staffHeaders })).json();
  const review = await (await request.post(`/api/claims/${id}/review`, { headers: { ...staffHeaders, 'If-Match': `"${before.claim.version}"` } })).json();
  const result = await request.post(`/api/claims/${id}/decision`, { headers: { ...staffHeaders, 'If-Match': `"${review.claim.version}"` }, data: { decision: 'Rejected', reason: 'Auto-refresh browser verification.' } }); expect(result.ok()).toBeTruthy();
  await expect(page.getByTestId('manager-outstanding')).toHaveText(String(prior - 1), { timeout: 22000 });
  await expect(page.getByRole('link', { name: id.slice(0, 8).toUpperCase(), exact: true })).toHaveCount(0, { timeout: 22000 });
});

test('desktop login and all roles offer real sign-in', async ({ page }, info) => {
  await page.goto('/login');
  await expect(page).toHaveTitle('CHUBB | Sign in');
  await noPageOverflow(page);
  await page.screenshot({ path: info.outputPath('login.png'), fullPage: true });
  await expect(page.getByRole('button', { name: /^Customer\b/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Claims Staff\b/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Manager\b/ })).toBeVisible();
});

test('failed document upload keeps the submitted claim and supports safe upload retry', async ({ page, request }) => {
  await signIn(page, 'Customer');
  const own = await (await request.get('/api/claims?pageSize=1', { headers: { Authorization: 'Bearer customer-alice' } })).json();
  await page.goto('/customer/submit');
  await page.getByLabel('Incident date', { exact: true }).fill('2026-01-01');
  await page.getByLabel('Incident details', { exact: true }).fill('Partial upload recovery browser verification.');
  await page.getByLabel('Claimed amount (MYR)', { exact: true }).fill('500');
  // Extension/type pass client validation; the real backend rejects the signature.
  await page.getByLabel('Select supporting documents (optional)', { exact: true }).setInputFiles({ ...evidence, buffer: Buffer.from('invalid document signature') });
  await page.getByRole('button', { name: 'Submit claim', exact: true }).click();
  await expect(page.getByText('The claim is saved. Your documents could not be uploaded.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit claim', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Open saved claim', exact: true }).click();
  await expect(page).toHaveURL(/\/claims\/[a-f\d-]{36}$/);
  await page.getByLabel('Add supporting documents', { exact: true }).setInputFiles(evidence);
  await page.getByRole('button', { name: 'Upload documents', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download evidence.pdf', exact: true })).toBeVisible();
  const after = await (await request.get('/api/claims?pageSize=1', { headers: { Authorization: 'Bearer customer-alice' } })).json();
  expect(after.total).toBe(own.total + 1);
});

test('manager type and missing-estimate drill-down use backend queries', async ({ page, request }) => {
  const id = await createClaim(page, 'Property', false);
  await signIn(page, 'Claims Staff'); await openClaim(page, id);
  await page.getByRole('button', { name: 'Start review', exact: true }).click();
  await page.getByLabel('Estimated liability (MYR)', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Save estimate', exact: true }).click();
  await expect(page.locator('.saved-estimate')).toContainText('0.00');
  await signIn(page, 'Manager');
  await expect(page.getByLabel('Claim type', { exact: true })).toBeEnabled();
  const typed = page.waitForResponse(response => response.url().includes('/api/manager/outstanding/claims?') && response.url().includes('type=Property'));
  await page.getByLabel('Claim type', { exact: true }).selectOption('Property');
  expect((await typed).ok()).toBeTruthy();
  await expect(page.getByLabel('Only claims without an estimate', { exact: true })).toBeEnabled();
  const missing = page.waitForResponse(response => response.url().includes('/api/manager/outstanding/claims?') && response.url().includes('withoutEstimate=true'));
  await page.getByLabel('Only claims without an estimate', { exact: true }).check();
  const drill = await (await missing).json();
  expect(drill.items.every((row: { claim: { type: string }; estimatedLiability: number | null }) => row.claim.type === 'Property' && row.estimatedLiability === null)).toBeTruthy();
  await expect(page.getByRole('link', { name: id.slice(0, 8).toUpperCase(), exact: true })).toHaveCount(0);
  // Leave this test claim final to keep repeated runs' outstanding queue manageable.
  const current = await (await request.get(`/api/claims/${id}`, { headers: staffHeaders })).json();
  const done = await request.post(`/api/claims/${id}/decision`, { headers: { ...staffHeaders, 'If-Match': `"${current.claim.version}"` }, data: { decision: 'Rejected', reason: 'Drill-down verification complete.' } });
  expect(done.ok()).toBeTruthy();
});
