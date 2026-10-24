import type { Metadata } from "next";
import SecurityScanConsole from "@/components/scan/security-scan-console";

export const metadata: Metadata = {
  title: "Security Scan | CloudGuard",
  description: "Connect an AWS account and run CloudGuard security checks for IAM, S3, Security Groups, Network ACLs, and CloudTrail.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ScanPage() {
  return <SecurityScanConsole />;
}
