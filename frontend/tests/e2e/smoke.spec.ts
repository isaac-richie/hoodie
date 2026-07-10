import { expect, test } from "@playwright/test";

test("marketing home renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/Hood Terminal/i).first()).toBeVisible();
});

test("app pulse route renders live board shell", async ({ page }) => {
  await page.goto("/pulse");
  await expect(page.getByText(/Bounty Board/i)).toBeVisible();
});

test("deployers route renders rap sheet shell", async ({ page }) => {
  await page.goto("/deployers");
  await expect(page.getByText(/Deployers/i)).toBeVisible();
});

test("account route renders operator profile", async ({ page }) => {
  await page.goto("/account");
  await expect(page.getByText(/Operator profile/i)).toBeVisible();
});
