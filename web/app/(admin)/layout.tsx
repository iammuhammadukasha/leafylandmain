// Admin route group (Architecture Volume 03 §6): admin console, behind
// admin/super_admin auth (FR-ID-006). Placeholder only — the Admin module
// (API Spec §7) is out of scope for this Identity + User vertical slice.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
