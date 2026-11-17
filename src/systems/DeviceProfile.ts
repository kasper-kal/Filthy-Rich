/**
 * Device capability detection.
 *
 * The game was built keyboard-and-mouse-first with desktop graphics settings
 * left at maximum, which makes it freeze on phones. This module decides, once
 * at startup, whether we are on a phone/tablet and which graphics budget to use.
 *
 * Detection is deliberately conservative: a desktop touched by a touchscreen
 * laptop, or a desktop browser window that happens to be narrow, still counts
 * as desktop. Only a mobile user agent or a coarse (finger-first) pointer on a
 * small screen counts as mobile.
 *
 * Either result can be overridden for testing with ?mobile=1 or ?mobile=0.
 */

export interface DeviceProfile {
  /** Phone/tablet: gets touch controls and the lighter graphics budget. */
  isMobile: boolean;
  isTouch: boolean;
  /** Renderer cap for devicePixelRatio (1 on mobile keeps fill-rate sane). */
  maxPixelRatio: number;
  enableShadows: boolean;
  shadowMapSize: number;
  enablePostProcessing: boolean;
  /** Heightmap resolution for the landscape mesh. */
  terrainResolution: number;
  enableTerrainLod: boolean;
}

function detectDevice(): DeviceProfile {
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  const userAgent = nav.userAgent || '';

  const coarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const touchPoints = typeof nav.maxTouchPoints === 'number' ? nav.maxTouchPoints : 0;
  const isTouch = touchPoints > 0 || coarsePointer || 'ontouchstart' in window;

  const shortSide = Math.min(window.innerWidth || 0, window.innerHeight || 0);
  const isSmallScreen = shortSide > 0 && shortSide <= 900;

  // Unambiguous mobile/tablet agents.
  const mobileUserAgent = /Android|iPhone|iPod|iPad|IEMobile|Windows Phone|Mobile Safari|Silk|Kindle/i.test(
    userAgent
  );
  const mobileClientHint = nav.userAgentData?.mobile === true;

  const forced = new URLSearchParams(window.location.search).get('mobile');
  let isMobile: boolean;
  if (forced === '1') {
    isMobile = true;
  } else if (forced === '0') {
    isMobile = false;
  } else {
    isMobile = mobileUserAgent || mobileClientHint || (coarsePointer && isSmallScreen);
  }

  return {
    isMobile,
    isTouch,
    maxPixelRatio: isMobile ? 1 : 2,
    enableShadows: !isMobile,
    shadowMapSize: isMobile ? 1024 : 4096,
    enablePostProcessing: !isMobile,
    terrainResolution: isMobile ? 128 : 1024,
    enableTerrainLod: !isMobile,
  };
}

export const DEVICE: DeviceProfile = detectDevice();
