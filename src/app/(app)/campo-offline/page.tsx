import type { Metadata } from "next";
import { CampoOfflineClient } from "@/components/offline/CampoOfflineClient";

export const metadata: Metadata = {
  title: "Modo campo",
};

export default function CampoOfflinePage() {
  return <CampoOfflineClient />;
}
