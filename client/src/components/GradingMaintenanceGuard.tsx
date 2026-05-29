/**
 * GradingMaintenanceGuard
 * Wraps grading routes — shows a maintenance page to non-whitelisted users
 * when grading_maintenance_mode is enabled.
 */
import { trpc } from "@/lib/trpc";
import { Wrench, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

interface Props {
  children: React.ReactNode;
}

export default function GradingMaintenanceGuard({ children }: Props) {
  const { t } = useTranslation();
  const { data: accessData, isLoading } = trpc.grading.getGradingAccess.useQuery();

  // While loading, render nothing (avoid flash)
  if (isLoading) return null;

  // Access denied → show maintenance page
  if (accessData && !accessData.allowed) {
    return (
      <div className="min-h-screen bg-[#06038d] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          {/* Icon */}
          <div className="w-20 h-20 bg-yellow-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <Wrench className="w-10 h-10 text-[#06038d]" />
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-white mb-3">
            {t("maintenance.gradingTitle")}
          </h1>
          <p className="text-white/70 mb-2 text-base leading-relaxed">
            {t("maintenance.gradingDesc")}
          </p>
          <p className="text-white/50 text-sm mb-8">
            {t("maintenance.contactSupport")}
          </p>

          {/* Back button */}
          <Link href="/">
            <span className="inline-flex items-center gap-2 bg-yellow-400 text-[#06038D] font-semibold px-6 py-3 rounded-xl hover:bg-yellow-300 transition-colors cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
              {t("common.backToHome")}
            </span>
          </Link>
        </div>
      </div>
    );
  }

  // Access granted → render children normally
  return <>{children}</>;
}
