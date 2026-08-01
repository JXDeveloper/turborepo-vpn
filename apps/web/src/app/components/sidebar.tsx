"use client";

import { EventHandler, ReactNode, useState } from "react";

export default function Sidebar({ children }: { readonly children: ReactNode }): ReactNode {
  const [isShown, setIsShown] = useState<boolean>(false);

  const handleHideShow = () => {
    setIsShown(!isShown);
  };
  return (
    <div className={`flex flex-col ${isShown ? "w-80" : "w-20"} border border-amber-800`}>
      <div className="flex flex-row-reverse">
        <button onClick={handleHideShow}>{isShown ? "hide" : "show"}</button>
      </div>
      {children}
    </div>
  );
}
