import { appIcon } from "@/components/brand/app-icon";

// The icon iOS puts on the home screen ("Add to Home Screen"). Next links it as apple-touch-icon.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return appIcon(180);
}
