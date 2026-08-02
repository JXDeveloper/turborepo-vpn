"use client";

import { ReactNode, useEffect, useState } from "react";

export default function Navbar({ children }: { readonly children: ReactNode }): ReactNode {
  const [isScrolled, setIsScrolled] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
      // Triggers the pop-up glass effect after scrolling 40px down
      if (window.scrollY > 40) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  return (
    <header className="fixed top-5 z-50 w-full px-4 sm:px-6 lg:px-8">
      <div
        className={`mx-auto max-w-6xl rounded-2xl px-6 py-4 transition-all duration-300 ease-out-back
          ${
            isScrolled
              ? "mt-2 border border-border/60 bg-background/80 shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] backdrop-blur-3xl"
              : "mt-0 scale-100 border border-transparent bg-transparent shadow-none backdrop-blur-none"
          }
        `}
      >
        {children}
      </div>
    </header>
  );
}
