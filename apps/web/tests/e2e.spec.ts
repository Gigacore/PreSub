import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

test('should analyze a file and display the results in the web app', async ({ page }) => {
  await page.goto('/');

  const dropzone = page.locator('div[style*="border: 2px dashed"]');

  const dataTransfer = await page.evaluateHandle((filePath) => {
    const data = new DataTransfer();
    const file = new File(['this is a test file'], 'sample.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    // This is a hack to set the path property on the file object
    Object.defineProperty(file, 'path', { value: filePath });
    data.items.add(file);
    return data;
  }, path.resolve(__dirname, '../../../tests/fixtures/sample.docx'));

  await dropzone.dispatchEvent('drop', { dataTransfer });

  await expect(page.locator('text=Analysis Results')).toBeVisible();
  await expect(page.locator('li:has-text("The author of the document.")')).toBeVisible();
});
