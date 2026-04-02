import { CenteredLoadingOverlay } from "@/components/ui/centered-loading-overlay";

export default function GuildDashboardLoading() {
  return (
    <CenteredLoadingOverlay
      title="Loading Dashboard"
      description="Preparing module data and server settings."
      zIndex={55}
    />
  );
}
