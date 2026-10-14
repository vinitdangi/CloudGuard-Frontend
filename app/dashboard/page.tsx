import type { Metadata } from "next";
import DashboardConsole from "@/components/dashboard/dashboard-console";

export const metadata: Metadata = {
  title: "Security Console | CloudGuard",
  description: "CloudGuard AWS security overview and security scan console.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardPage() {
  return <DashboardConsole />;
}
