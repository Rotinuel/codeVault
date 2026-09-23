"use client";

import { motion, useReducedMotion } from "framer-motion";

const TAGS = { div: motion.div, li: motion.li, section: motion.section };

/** Fades content in as it scrolls into view (respects reduced-motion). */
export function Reveal({ as = "div", children, delay = 0, className }) {
  const reduce = useReducedMotion();
  if (reduce) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }
  const M = TAGS[as] || motion.div;
  return (
    <M
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </M>
  );
}
