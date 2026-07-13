import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('http://127.0.0.1:8080/login/index.php');
  await page.fill('#username', 'admin');
  await page.fill('#password', 'Admin123!');
  await page.click('#loginbtn');
  
  await page.waitForLoadState('networkidle');
  
  const formHtml = await page.evaluate(() => {
    const form = document.querySelector('.editmode-switch-form');
    return form ? form.outerHTML : 'Not found';
  });
  
  console.log(formHtml);
  
  await browser.close();
})();
