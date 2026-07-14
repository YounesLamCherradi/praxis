import React from "react";

export default function TrustedBy() {
  const items = [
    "Plan your thoughts",
    "Write raw drafts",
    "Review assignment briefs",
    "Reflect on evolution",
    "AI Coach enabled",
    "Honest work protected",
    "Timeline playback check",
    "Conversations not verdicts",
  ];

  return (
    <div className="bg-slate-950 border-y border-slate-900 py-5 overflow-hidden flex select-none">
      {/* CSS styling for .animate-marquee-ribbon can be placed in your index.css */}
      <div className="animate-marquee-ribbon flex whitespace-nowrap">
        {/* Track segment 1 */}
        <div className="inline-flex items-center text-slate-400 font-serif text-lg italic tracking-wide shrink-0">
          {items.map((item, idx) => (
            <React.Fragment key={`t1-${idx}`}>
              <span className="w-2 h-2 rounded-full bg-blue-500 mx-8 shrink-0 shadow-[0_0_12px_rgba(59,130,246,0.65)]" />
              {item}
            </React.Fragment>
          ))}
        </div>
        {/* Track segment 2 to ensure loop continuity */}
        <div className="inline-flex items-center text-slate-400 font-serif text-lg italic tracking-wide shrink-0">
          {items.map((item, idx) => (
            <React.Fragment key={`t2-${idx}`}>
              <span className="w-2 h-2 rounded-full bg-blue-500 mx-8 shrink-0 shadow-[0_0_12px_rgba(59,130,246,0.65)]" />
              {item}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}