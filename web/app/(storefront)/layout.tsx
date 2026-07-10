// Storefront route group (Architecture Volume 03 §6): public catalog,
// cart, checkout, account. Foundation-phase slice only wires login +
// account; catalog/cart/checkout land with the Product Marketplace /
// Orders modules.
export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
