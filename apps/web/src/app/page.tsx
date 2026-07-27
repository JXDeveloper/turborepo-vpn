"use client";
import makeReq from "./action";

export default function Home() {
  return (
    <div>
      <button type="button" onClick={makeReq}>
        Make request
      </button>
    </div>
  );
}
