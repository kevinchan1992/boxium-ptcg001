import { GlobalNav } from "./GlobalNav";

interface PageWrapperProps {
  children: React.ReactNode;
}

export function PageWrapper({ children }: PageWrapperProps) {
  return (
    <>
      <GlobalNav />
      {children}
    </>
  );
}
