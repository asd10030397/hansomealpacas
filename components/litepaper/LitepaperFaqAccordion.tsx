"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { EASE } from "@/lib/motion";
import { useLocale } from "@/context/LocaleContext";

export function LitepaperFaqAccordion() {
  const { t } = useLocale();
  const items = t.litepaper.faq.items;
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [printMode, setPrintMode] = useState(false);

  // Printed / PDF-exported versions should show every answer, not just the
  // currently-expanded one, so the document reads in full on paper.
  useEffect(() => {
    const query = window.matchMedia("print");
    const handleChange = () => setPrintMode(query.matches);
    handleChange();
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  return (
    <dl className="divide-y divide-white/10 border-y border-white/10">
      {items.map((item, index) => {
        const open = printMode || openIndex === index;
        return (
          <div key={item.question}>
            <dt>
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : index)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-4 py-5 text-left text-base font-medium text-white transition-colors hover:text-white/80"
              >
                {item.question}
                <span
                  aria-hidden="true"
                  className={`shrink-0 text-xl text-white/40 transition-transform duration-300 ${open ? "rotate-45" : ""}`}
                >
                  +
                </span>
              </button>
            </dt>
            <AnimatePresence initial={false}>
              {open ? (
                <m.dd
                  key="content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="overflow-hidden"
                >
                  <p className="pb-6 pr-8 text-sm leading-relaxed text-white/60">{item.answer}</p>
                </m.dd>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </dl>
  );
}
