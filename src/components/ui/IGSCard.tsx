import { CSSProperties, ReactNode } from "react";
import { IGS } from "@/lib/tokens";

type Props = {
  children: ReactNode;
  padding?: number;
  style?: CSSProperties;
};

export default function IGSCard({ children, padding = 20, style }: Props) {
  return (
    <div
      style={{
        background: IGS.surface,
        borderRadius: 14,
        border: `1px solid ${IGS.line}`,
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
