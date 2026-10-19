import { describe, expect, it } from 'vitest';
import { detectPlatform, INSTALL_STEPS } from './pwa';

const UA = {
  chromeWin:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  edgeWin:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
  safariMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  samsung:
    'Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36',
  firefoxAndroid: 'Mozilla/5.0 (Android 15; Mobile; rv:140.0) Gecko/140.0 Firefox/140.0',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
};

describe('detectPlatform', () => {
  it('recognizes common browsers and devices', () => {
    expect(detectPlatform(UA.chromeWin)).toBe('desktop-chromium');
    expect(detectPlatform(UA.edgeWin)).toBe('desktop-edge');
    expect(detectPlatform(UA.safariMac)).toBe('desktop-safari');
    expect(detectPlatform(UA.firefoxLinux)).toBe('desktop-firefox');
    expect(detectPlatform(UA.chromeAndroid)).toBe('android-chrome');
    expect(detectPlatform(UA.samsung)).toBe('android-samsung');
    expect(detectPlatform(UA.firefoxAndroid)).toBe('android-firefox');
    expect(detectPlatform(UA.iphone)).toBe('ios');
    expect(detectPlatform('curl/8.0')).toBe('other');
  });

  it('has install steps for every platform', () => {
    for (const ua of Object.values(UA)) {
      expect(INSTALL_STEPS[detectPlatform(ua)].steps.length).toBeGreaterThan(0);
    }
  });
});
