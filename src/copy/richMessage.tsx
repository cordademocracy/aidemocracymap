import { Fragment, type ReactNode } from "react";

// non-printing, so it can never collide with sentence text
const MARK = "\u0000";
const SPLIT = new RegExp(`${MARK}(\\w+)${MARK}`);

/**
 * Renders a message whose placeholders are React nodes (links inside a
 * sentence), so the translator keeps one whole sentence instead of fragments.
 */
export function richMessage<K extends string>(
  message: (inputs: Record<K, string>) => string,
  nodes: Record<K, ReactNode>
): ReactNode {
  const inputs = {} as Record<K, string>;
  for (const key of Object.keys(nodes) as K[]) inputs[key] = `${MARK}${key}${MARK}`;
  return message(inputs)
    .split(SPLIT)
    .map((part, i) => <Fragment key={i}>{i % 2 === 1 ? nodes[part as K] : part}</Fragment>);
}
