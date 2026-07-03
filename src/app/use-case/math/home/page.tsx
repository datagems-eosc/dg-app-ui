import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";

export default function MathHomePage() {
  return (
    <div className="flex justify-center px-5 py-10">
      <div className="flex flex-col gap-6 w-full max-w-[900px]">
        {/* Hero */}
        <div className="flex flex-col gap-2">
          <h1 className="text-[32px] font-semibold text-[#314158] leading-[1.4]">
            Explore math data on MathE
          </h1>
          <p className="text-[20px] font-normal text-[#5b708f] leading-[1.4]">
            Solve complex math problems with AI support
          </p>
        </div>

        {/* Start Research card */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col gap-6 justify-between">
          <div className="flex flex-col gap-6">
            <div className="bg-[#f5f9ff] rounded-lg p-2 w-10 h-10 flex items-center justify-center">
              <Search size={20} className="text-[#2b7fff]" />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-[20px] font-semibold text-[#314158] leading-[1.4]">
                Open MathE platform
              </h2>
              <p className="text-[14px] font-normal text-[#5b708f] leading-[1.5]">
                Get access to reliable math resources on MathE. Explore topics,
                exercises, and evidence across trusted materials.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Link
              href="/use-case/math/chat"
              className="inline-flex items-center gap-2 bg-[#052f4a] text-white text-[14px] font-medium leading-[1.5] px-4 h-10 rounded-[40px] w-fit shadow-[0px_1px_0.5px_rgba(213,218,227,0.3)]"
            >
              Go to MathE
              <ArrowRight size={16} />
            </Link>
            <p className="text-[12px] font-normal text-[#5b708f] leading-[1.5]">
              Clicking this button takes you to the external platform.
            </p>
          </div>
        </div>

        {/* How it works */}
        <div className="flex flex-col gap-4">
          <h3 className="text-[16px] font-semibold text-[#314158] leading-[1.5]">
            How it works?
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {/* Step 1 */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col gap-4">
              <div className="bg-[#f5f9ff] inline-flex items-center px-3 h-6 rounded-full w-fit">
                <span className="text-[12px] font-medium text-[#193cb8] tracking-[0.12px]">
                  1. Browse
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <h4 className="text-[16px] font-semibold text-[#1d293d] leading-[1.5]">
                  Browse MathE
                </h4>
                <p className="text-[14px] font-normal text-[#5b708f] leading-[1.5]">
                  Browse mathematics topics and resources to start the
                  exploration.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col gap-4">
              <div className="bg-[#ecfdf5] inline-flex items-center px-3 h-6 rounded-full w-fit">
                <span className="text-[12px] font-medium text-[#006045] tracking-[0.12px]">
                  2. Learn
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <h4 className="text-[16px] font-semibold text-[#1d293d] leading-[1.5]">
                  Study the Material
                </h4>
                <p className="text-[14px] font-normal text-[#5b708f] leading-[1.5]">
                  Access explanations and materials, with hints along the way
                  and the option to ask questions as you learn.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col gap-4">
              <div className="bg-[#fff7ed] inline-flex items-center px-3 h-6 rounded-full w-fit">
                <span className="text-[12px] font-medium text-[#f54900] tracking-[0.12px]">
                  3. Solve
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <h4 className="text-[16px] font-semibold text-[#1d293d] leading-[1.5]">
                  Practice &amp; Solve
                </h4>
                <p className="text-[14px] font-normal text-[#5b708f] leading-[1.5]">
                  Work through exercises and problems, applying what you&apos;ve
                  learned.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
