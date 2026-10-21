import { expect, test } from '@playwright/test';

test('HR signs in, opens the dashboard and approves a request', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('hr@msma.test');
  await page.getByLabel('Password').fill('Demo@2026');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Dashboard
  await expect(page.getByRole('heading', { name: /Princess/ })).toBeVisible();
  const kpis = page.getByRole('region', { name: 'Today at a glance' });
  await expect(kpis.getByText('Headcount')).toBeVisible();
  await expect(kpis.getByText('180', { exact: true })).toBeVisible();
  await expect(page.getByText('Live punches')).toBeVisible();

  // Pending approvals card: approve the first request
  const pendingLink = page.getByRole('link', { name: /waiting · view all/ });
  await expect(pendingLink).toHaveText('9 waiting · view all');
  const firstApprove = page.getByRole('button', { name: /^Approve .*'s request$/ }).first();
  const label = await firstApprove.getAttribute('aria-label');
  const employee = label!.replace(/^Approve /, '').replace(/'s request$/, '');
  await firstApprove.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(`Approve ${employee}'s`);
  await dialog.getByRole('button', { name: 'Approve request' }).click();

  await expect(page.getByRole('status')).toContainText(`Approved ${employee}'s`);
  await expect(pendingLink).toHaveText('8 waiting · view all');
});
