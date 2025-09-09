import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

test('should analyze a file and display the results in the desktop app', async () => {
  const electronApp = await electron.launch({ args: ['.'] });
  const window = await electronApp.firstWindow();

  const dropzone = window.locator('div[style*="border: 2px dashed"]');

  const dataTransfer = await window.evaluateHandle((filePath) => {
    const data = new DataTransfer();
    const file = new File(['this is a test file'], 'sample.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    Object.defineProperty(file, 'path', { value: filePath });
    data.items.add(file);
    return data;
  }, path.resolve(__dirname, '../../../tests/fixtures/sample.docx'));

  await dropzone.dispatchEvent('drop', { dataTransfer });

  await expect(window.locator('text=Analysis Results')).toBeVisible();
  await expect(window.locator('li:has-text("The author of the document.")')).toBeVisible();

  await electronApp.close();
});
