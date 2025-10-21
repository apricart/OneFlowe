import { AppContextProvider } from "@/components/context/app-context"

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
    <AppContextProvider>
      {children}
    </AppContextProvider>
  )
}
