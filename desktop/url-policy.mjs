const PROJECT_REPOSITORY_ORIGIN = "https://github.com";
const PROJECT_REPOSITORY_PATH = "/aEboli/GPT-Image2-Studio";
const IMAGE_HOSTING_CONSOLE_ORIGIN = "https://console.cloudinary.com";
const IMAGE_HOSTING_CONSOLE_PATH = "/settings/upload";

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isAllowedStudioNavigation(targetUrl, studioOrigin) {
  const target = parseUrl(targetUrl);
  const studio = parseUrl(studioOrigin);
  if (!target || !studio) {
    return false;
  }

  return (
    target.protocol === "http:" &&
    target.hostname === "127.0.0.1" &&
    !target.username &&
    !target.password &&
    target.origin === studio.origin
  );
}

export function isAllowedExternalUrl(targetUrl) {
  const target = parseUrl(targetUrl);
  if (!target) {
    return false;
  }
  if (target.protocol !== "https:" || target.username || target.password) {
    return false;
  }

  if (target.origin === PROJECT_REPOSITORY_ORIGIN) {
    return (
      target.pathname === PROJECT_REPOSITORY_PATH ||
      target.pathname.startsWith(`${PROJECT_REPOSITORY_PATH}/`)
    );
  }

  if (target.origin === IMAGE_HOSTING_CONSOLE_ORIGIN) {
    return target.pathname === IMAGE_HOSTING_CONSOLE_PATH;
  }

  return false;
}
