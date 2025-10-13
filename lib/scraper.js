import puppeteer from 'puppeteer';

// Scrape SeLoger for active listings
export async function scrapeSeLoger({ address, lat, lng, type, surface }) {
  let browser;
  
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Extract city and postal code from address
    const addressParts = address.split(',');
    const cityPart = addressParts[addressParts.length - 1]?.trim() || '';
    const postalMatch = cityPart.match(/(\d{5})/);
    const postalCode = postalMatch ? postalMatch[1] : '';
    
    const propertyType = type === 'appartement' ? 'appartement' : 'maison';
    
    // Build SeLoger search URL
    const searchUrl = `https://www.seloger.com/list.htm?types=${propertyType === 'appartement' ? '1' : '2'}&projects=2&places=[{%22inseeCodes%22:[${postalCode}]}]&surface=${Math.floor(surface * 0.7)}/${Math.ceil(surface * 1.3)}&sort=d_dt_crea`;
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for listings to load
    await page.waitForSelector('.CardList-wrapper', { timeout: 10000 }).catch(() => {});
    
    // Extract listings
    const listings = await page.evaluate(() => {
      const items = [];
      const cards = document.querySelectorAll('.SingleCard');
      
      cards.forEach(card => {
        try {
          const titleEl = card.querySelector('.SingleCard-title');
          const priceEl = card.querySelector('.SingleCard-price');
          const surfaceEl = card.querySelector('.SingleCard-surface');
          const linkEl = card.querySelector('a');
          
          if (titleEl && priceEl && surfaceEl) {
            const title = titleEl.textContent.trim();
            const priceText = priceEl.textContent.trim().replace(/\s/g, '');
            const price = parseInt(priceText.replace(/[^0-9]/g, ''));
            const surfaceText = surfaceEl.textContent.trim();
            const surfaceMatch = surfaceText.match(/(\d+)/);
            const surface = surfaceMatch ? parseInt(surfaceMatch[1]) : 0;
            const url = linkEl ? 'https://www.seloger.com' + linkEl.getAttribute('href') : '';
            
            if (price && surface && url) {
              items.push({ title, price, surface, url });
            }
          }
        } catch (e) {
          // Skip invalid cards
        }
      });
      
      return items;
    });
    
    await browser.close();
    
    // Deduplicate by URL
    const uniqueListings = [];
    const seenUrls = new Set();
    
    for (const listing of listings) {
      if (!seenUrls.has(listing.url)) {
        seenUrls.add(listing.url);
        uniqueListings.push({
          ...listing,
          pricePerM2: Math.round(listing.price / listing.surface),
          source: 'SeLoger',
          scrapedAt: new Date().toISOString()
        });
      }
    }
    
    return uniqueListings;
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    console.error('SeLoger scraping error:', error);
    throw error;
  }
}

// Calculate market statistics from listings
export function calculateMarketStats(listings) {
  if (!listings || listings.length === 0) {
    return null;
  }
  
  const pricesPerM2 = listings.map(l => l.pricePerM2);
  const mean = pricesPerM2.reduce((a, b) => a + b, 0) / pricesPerM2.length;
  
  const sortedPrices = [...pricesPerM2].sort((a, b) => a - b);
  const median = sortedPrices.length % 2 === 0
    ? (sortedPrices[sortedPrices.length / 2 - 1] + sortedPrices[sortedPrices.length / 2]) / 2
    : sortedPrices[Math.floor(sortedPrices.length / 2)];
  
  return {
    count: listings.length,
    meanPricePerM2: Math.round(mean),
    medianPricePerM2: Math.round(median)
  };
}