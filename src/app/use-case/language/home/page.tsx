"use client";

import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import { Tooltip } from "@/components/ui/Tooltip";

export default function LanguageHomePage() {
  return (
    <div className="flex justify-center px-5 py-10">
      <div className="flex flex-col gap-6 w-full max-w-[900px]">
        {/* Hero */}
        <div className="flex flex-col gap-2">
          <h1 className="text-[32px] font-semibold text-[#314158] leading-[1.4]">
            Explore language data with AI
          </h1>
          <p className="text-[20px] font-normal text-[#5b708f] leading-[1.4]">
            Ask questions in natural language get answers from real data
          </p>
        </div>

        {/* Start Research card — horizontal layout */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex items-center gap-6">
          <div className="bg-[#f5f9ff] rounded-lg p-2 w-10 h-10 flex items-center justify-center shrink-0">
            <Search size={20} className="text-[#2b7fff]" />
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <h2 className="text-[18px] font-semibold text-[#1d293d] leading-[1.4]">
              Start Your Research
            </h2>
            <p className="text-[14px] font-normal text-[#5b708f] leading-[1.5]">
              Get reliable answers grounded in real language data.
            </p>
          </div>
          <Link
            href="/use-case/language/question"
            className="inline-flex items-center gap-2 bg-[#052f4a] text-white text-[14px] font-medium leading-[1.5] px-4 h-10 rounded-[40px] shrink-0 shadow-[0px_1px_0.5px_rgba(213,218,227,0.3)]"
          >
            Start Research
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col gap-4">
            <div className="bg-[#f5f9ff] inline-flex items-center px-3 h-6 rounded-full w-fit">
              <span className="text-[12px] font-medium text-[#193cb8] tracking-[0.12px]">
                01
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <h4 className="text-[16px] font-semibold text-[#1d293d] leading-[1.5]">
                Ask Your Question
              </h4>
              <p className="text-[14px] font-normal text-[#5b708f] leading-[1.5]">
                Write your research question in natural language.
              </p>
            </div>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col gap-4">
            <div className="bg-[#ecfdf5] inline-flex items-center px-3 h-6 rounded-full w-fit">
              <span className="text-[12px] font-medium text-[#006045] tracking-[0.12px]">
                02
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <h4 className="text-[16px] font-semibold text-[#1d293d] leading-[1.5]">
                Select Data Sources
              </h4>
              <p className="text-[14px] font-normal text-[#5b708f] leading-[1.5]">
                Browse available datasets and select those relevant to your
                question.
              </p>
            </div>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col gap-4">
            <div className="bg-[#fff7ed] inline-flex items-center px-3 h-6 rounded-full w-fit">
              <span className="text-[12px] font-medium text-[#f54900] tracking-[0.12px]">
                03
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <h4 className="text-[16px] font-semibold text-[#1d293d] leading-[1.5]">
                Analyze &amp; Explore
              </h4>
              <p className="text-[14px] font-normal text-[#5b708f] leading-[1.5]">
                Explore explanations showing how concepts influenced findings.
              </p>
            </div>
          </div>
        </div>

        {/* Example Research Questions */}
        <div className="flex flex-col gap-4">
          <h3 className="text-[16px] font-semibold text-[#314158] leading-[1.5]">
            Example Research Questions
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <Tooltip
              content="Coming soon"
              position="top"
              delay={200}
              className="flex"
            >
              <div
                className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col gap-6 w-full opacity-80 cursor-default"
                style={{ pointerEvents: "none" }}
              >
                <div className="flex flex-col gap-4">
                  <div className="bg-[#f5f9ff] rounded-lg p-2 w-10 h-10 flex items-center justify-center">
                    <Search size={20} className="text-[#2b7fff]" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <h4 className="text-[18px] font-semibold text-[#1d293d] leading-[1.4]">
                      Track concept evolution
                    </h4>
                    <p className="text-[14px] font-normal text-[#5b708f] leading-[1.5]">
                      How did &lsquo;democracy&rsquo; change in news 2000-2020?
                    </p>
                  </div>
                </div>
                <button className="inline-flex items-center justify-center bg-white border border-[#cad5e2] text-[#314158] text-[14px] font-medium leading-[1.5] px-4 h-10 rounded-[40px] w-fit shadow-[0px_1px_0.5px_rgba(213,218,227,0.3)]">
                  Check Example
                </button>
              </div>
            </Tooltip>
            <Tooltip
              content="Coming soon"
              position="top"
              delay={200}
              className="flex"
            >
              <div
                className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col gap-6 w-full opacity-80 cursor-default"
                style={{ pointerEvents: "none" }}
              >
                <div className="flex flex-col gap-4">
                  <div className="bg-[#f5f9ff] rounded-lg p-2 w-10 h-10 flex items-center justify-center">
                    <Search size={20} className="text-[#2b7fff]" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <h4 className="text-[18px] font-semibold text-[#1d293d] leading-[1.4]">
                      Compare linguistic features
                    </h4>
                    <p className="text-[14px] font-normal text-[#5b708f] leading-[1.5]">
                      Sentiment patterns across political speeches
                    </p>
                  </div>
                </div>
                <button className="inline-flex items-center justify-center bg-white border border-[#cad5e2] text-[#314158] text-[14px] font-medium leading-[1.5] px-4 h-10 rounded-[40px] w-fit shadow-[0px_1px_0.5px_rgba(213,218,227,0.3)]">
                  Check Example
                </button>
              </div>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
