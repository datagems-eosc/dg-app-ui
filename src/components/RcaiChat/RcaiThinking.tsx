"use client";

export default function RcaiThinking({ text }: { text: string }) {
  return (
    <div className="flex items-center space-x-2">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
      </div>
      <div className="text-gray-500" aria-label={text}>
        {text.split("").map((char, i) => (
          <span
            key={i}
            className="inline-block animate-shimmer"
            style={{
              animationDelay: `${i * 0.03}s`,
            }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        ))}
      </div>
    </div>
  );
}
