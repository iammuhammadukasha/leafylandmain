// Vendor route group (Architecture Volume 03 §6): vendor dashboard, behind
// vendor_owner/vendor_staff auth (FR-ID-006). Placeholder only — the
// Vendor bounded context (Volume 02 §4) is out of scope for this
// Identity + User vertical slice.
export default function VendorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
