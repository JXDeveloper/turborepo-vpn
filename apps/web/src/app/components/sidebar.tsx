"use client";

import { ReactNode } from "react";

export default function Sidebar({ children }: Readonly<{ children: ReactNode }>): ReactNode {
  return <div>{children}</div>;
}
