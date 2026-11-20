import { appIcon } from "@/components/brand/app-icon";

// PNG icons for the web app manifest, drawn once at build time.
export const dynamic = "force-static";
export const dynamicParams = false;
export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }];
}

export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  return appIcon(Number((await params).size));
}
