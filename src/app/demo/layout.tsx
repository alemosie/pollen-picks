import { DemoBanner } from "@/components/DemoBanner";

// Public. Nothing under /demo reads a Buffer session to do its job (the header link only checks the cookie to swap its
// label) and nothing here can reach Buffer's API: the sample issue is never sent.
export default function DemoLayout({ children }: LayoutProps<"/demo">) {
  return (
    <>
      <DemoBanner />
      {children}
    </>
  );
}
