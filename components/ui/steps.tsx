"use client";

import { Steps } from "@ark-ui/react/steps";

const PHASE_LABELS = ["Outreach", "Handoff", "Sampling", "Closing"];

interface StepsProgressProps {
  /** 0-based index of the current step (0–3) */
  currentStep: number;
}

export default function StepsProgress({ currentStep }: StepsProgressProps) {
  const steps = [0, 1, 2, 3];

  return (
    <Steps.Root count={4} step={currentStep} className="w-full">
      <Steps.List className="flex justify-between items-center">
        {steps.map((_, index) => (
          <Steps.Item
            key={index}
            index={index}
            className="relative flex not-last:flex-1 items-center"
          >
            <Steps.Trigger className="flex items-center gap-2 text-left cursor-default">
              <Steps.Indicator className="flex justify-center items-center shrink-0 rounded-full font-semibold w-7 h-7 text-xs border-2 data-[state=complete]:bg-green-600 data-[state=complete]:text-white data-[state=complete]:border-green-600 data-[state=current]:bg-green-600 data-[state=current]:text-white data-[state=current]:border-green-600 data-[state=incomplete]:bg-slate-50 data-[state=incomplete]:text-slate-400 data-[state=incomplete]:border-slate-200">
                {index + 1}
              </Steps.Indicator>
              <span className="text-xs font-medium data-[state=complete]:text-green-700 data-[state=current]:text-green-700 data-[state=incomplete]:text-slate-400 hidden sm:block">
                {PHASE_LABELS[index]}
              </span>
            </Steps.Trigger>
            <Steps.Separator
              hidden={index === steps.length - 1}
              className="flex-1 h-0.5 mx-2 bg-slate-200 data-[state=complete]:bg-green-500"
            />
          </Steps.Item>
        ))}
      </Steps.List>
    </Steps.Root>
  );
}
