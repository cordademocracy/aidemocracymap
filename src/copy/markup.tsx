import type { ReactNode } from "react";

type InlineMarkupProps = { children?: ReactNode };

const italic = ({ children }: InlineMarkupProps) => <em>{children}</em>;
const bold = ({ children }: InlineMarkupProps) => <strong>{children}</strong>;

export const markup = {
  i: italic,
  b: bold,
};
