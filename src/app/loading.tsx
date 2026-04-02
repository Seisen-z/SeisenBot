import { CenteredLoadingOverlay } from "@/components/ui/centered-loading-overlay";

export default function RootLoading() {
  return (
    <CenteredLoadingOverlay
      title="Loading Seisen Hub"
      description="Preparing your dashboard modules and synced bot data."
      zIndex={60}
    />
  );
}
