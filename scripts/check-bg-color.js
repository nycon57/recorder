const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    colorScheme: 'dark'
  });
  const page = await context.newPage();

  // Navigate to localhost
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Wait for page to be fully rendered
  await page.waitForTimeout(2000);

  // Get computed background color of body and other elements
  const result = await page.evaluate(() => {
    const body = document.body;
    const html = document.documentElement;
    const bodyComputed = window.getComputedStyle(body);
    const htmlComputed = window.getComputedStyle(html);

    // Helper to convert rgb to hex
    const rgbToHex = (rgbString) => {
      const match = rgbString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return rgbString;
      return '#' + [match[1], match[2], match[3]]
        .map(x => parseInt(x).toString(16).padStart(2, '0'))
        .join('');
    };

    const bodyBg = bodyComputed.backgroundColor;
    const htmlBg = htmlComputed.backgroundColor;

    // Check all elements with background colors
    const allBackgrounds = [];
    document.querySelectorAll('*').forEach(el => {
      const bg = window.getComputedStyle(el).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        allBackgrounds.push({
          tag: el.tagName.toLowerCase(),
          class: el.className,
          bg: bg,
          hex: rgbToHex(bg)
        });
      }
    });

    return {
      html: {
        background: htmlBg,
        hex: rgbToHex(htmlBg),
        classes: Array.from(html.classList)
      },
      body: {
        background: bodyBg,
        hex: rgbToHex(bodyBg),
        classes: Array.from(body.classList)
      },
      darkMode: html.classList.contains('dark'),
      cssVariables: {
        background: bodyComputed.getPropertyValue('--background').trim(),
        richBlack: bodyComputed.getPropertyValue('--color-rich-black').trim()
      },
      uniqueBackgrounds: [...new Set(allBackgrounds.map(b => b.hex))]
        .map(hex => {
          const match = allBackgrounds.find(b => b.hex === hex);
          return { hex, example: match };
        })
    };
  });

  console.log('\n========== BACKGROUND COLOR INSPECTION ==========\n');
  console.log('📌 EXPECTED: rgb(1, 0, 26) / #01001a (Rich Black)\n');

  console.log('🌐 HTML Element:');
  console.log('  Background:', result.html.background);
  console.log('  Hex:', result.html.hex);
  console.log('  Classes:', result.html.classes.join(', ') || 'none');
  console.log();

  console.log('📄 BODY Element:');
  console.log('  Background:', result.body.background);
  console.log('  Hex:', result.body.hex);
  console.log('  Classes:', result.body.classes.join(', ') || 'none');
  console.log();

  console.log('🎨 CSS Variables:');
  console.log('  --background:', result.cssVariables.background || 'not set');
  console.log('  --color-rich-black:', result.cssVariables.richBlack || 'not set');
  console.log();

  console.log('🌙 Dark Mode:', result.darkMode ? 'ENABLED' : 'DISABLED');
  console.log();

  console.log('🎯 All Unique Background Colors on Page:');
  result.uniqueBackgrounds.slice(0, 10).forEach(bg => {
    console.log(`  ${bg.hex} - <${bg.example.tag}> ${bg.example.class ? `class="${bg.example.class}"` : ''}`);
  });
  if (result.uniqueBackgrounds.length > 10) {
    console.log(`  ... and ${result.uniqueBackgrounds.length - 10} more`);
  }
  console.log();

  // Check if colors match expected
  const bodyMatches = result.body.hex === '#01001a' ||
                     result.body.background === 'rgb(1, 0, 26)';
  const htmlMatches = result.html.hex === '#01001a' ||
                     result.html.background === 'rgb(1, 0, 26)';

  if (bodyMatches && htmlMatches) {
    console.log('✅ SUCCESS! Both HTML and BODY show exact Rich Black (#01001a)');
  } else {
    console.log('❌ MISMATCH DETECTED!');
    if (!htmlMatches) {
      console.log(`  HTML: Expected #01001a, got ${result.html.hex}`);
    }
    if (!bodyMatches) {
      console.log(`  BODY: Expected #01001a, got ${result.body.hex}`);
    }
  }

  console.log('\n================================================\n');

  await browser.close();
})();
