import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export interface FormulaMathProps {
  latex: string;
  /** Công thức riêng một dòng, cỡ lớn; mặc định là chữ nằm trong dòng */
  block?: boolean;
}

/** Dựng công thức toán học bằng KaTeX; LaTeX do hệ thống sinh từ cây biểu thức, không nhận chuỗi người dùng gõ */
export const FormulaMath: React.FC<FormulaMathProps> = ({ latex, block = false }) => {
  const html = useMemo(
    () => katex.renderToString(latex, { displayMode: block, throwOnError: false, strict: 'ignore', output: 'htmlAndMathml' }),
    [latex, block],
  );
  return <span className={block ? 'formula-math formula-math-block' : 'formula-math'} dangerouslySetInnerHTML={{ __html: html }} />;
};
