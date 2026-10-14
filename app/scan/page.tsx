import type { Metadata } from "next";
import SecurityScanConsole from "@/components/scan/security-scan-console";

export const metadata: Metadata = {
  title: "Security Scan | CloudGuard",
  description: "Configure and preview CloudGuard's AWS security scan interface for IAM, S3, Security Groups, Network ACLs, and CloudTrail.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ScanPage() {
  return <SecurityScanConsole />;
}
