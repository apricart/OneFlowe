import { AuthSessionProvider } from "@/components/session-provider"

export const metadata = {
  title: "Order Portal - Apricart OneFlowe",
  description: "Employee Order Portal",
}

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthSessionProvider>
      {children}
    </AuthSessionProvider>
  )
}
