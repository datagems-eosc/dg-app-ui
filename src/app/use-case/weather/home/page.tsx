import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";

export default function WeatherHomePage() {
  return (
    <div className="flex justify-center px-5 py-10">
      <div className="flex flex-col gap-6 w-full max-w-[900px]">
        {/* Hero */}
        <div className="flex flex-col gap-2">
          <h1 className="text-[32px] font-semibold text-[#314158] leading-[1.4]">
            Explore Weather data with AI
          </h1>
          <p className="text-[20px] font-normal text-[#5b708f] leading-[1.4]">
            Ask questions in natural language get answers from real data
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
                Start Your Research
              </h2>
              <p className="text-[14px] font-normal text-[#5b708f] leading-[1.5]">
                Get reliable answers grounded in real weather data.
                <br />
                Explore patterns, trends, and evidence across trusted datasets.
              </p>
            </div>
          </div>
          <Link
            href="/use-case/weather/chat"
            className="inline-flex items-center gap-2 bg-[#052f4a] text-white text-[14px] font-medium leading-[1.5] px-4 h-10 rounded-[40px] w-fit shadow-[0px_1px_0.5px_rgba(213,218,227,0.3)]"
          >
            Start Research
            <ArrowRight size={16} />
          </Link>
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
                  1. Ask
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <h4 className="text-[16px] font-semibold text-[#1d293d] leading-[1.5]">
                  Ask Your Question
                </h4>
                <p className="text-[14px] font-normal text-[#5b708f] leading-[1.5]">
                  Enter your research question in natural language to start the
                  exploration.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col gap-4">
              <div className="bg-[#ecfdf5] inline-flex items-center px-3 h-6 rounded-full w-fit">
                <span className="text-[12px] font-medium text-[#006045] tracking-[0.12px]">
                  2. Select data
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <h4 className="text-[16px] font-semibold text-[#1d293d] leading-[1.5]">
                  Select Data Sources
                </h4>
                <p className="text-[14px] font-normal text-[#5b708f] leading-[1.5]">
                  Choose relevant datasets that help answer and support your
                  question.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col gap-4">
              <div className="bg-[#fff7ed] inline-flex items-center px-3 h-6 rounded-full w-fit">
                <span className="text-[12px] font-medium text-[#f54900] tracking-[0.12px]">
                  3. Explore results
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <h4 className="text-[16px] font-semibold text-[#1d293d] leading-[1.5]">
                  Analyze &amp; Explore
                </h4>
                <p className="text-[14px] font-normal text-[#5b708f] leading-[1.5]">
                  Review explanations and insights showing how findings were
                  generated.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
