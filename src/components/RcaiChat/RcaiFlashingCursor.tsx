"use client";

export default function RcaiFlashingCursor() {
  return (
    <>
      <style>
        {"@keyframes rcaiBlink{0%,49%{opacity:1}50%,100%{opacity:0}}"}
      </style>
      <span
        className="inline-block bg-slate-500 align-middle rounded-[2px]"
        style={{
          width: "0.65em",
          height: "1.15em",
          animation: "rcaiBlink 1s step-end infinite",
          marginLeft: "0.25em",
          transform: "translateY(0.15em)",
        }}
        aria-hidden="true"
      />
    </>
  );
}
